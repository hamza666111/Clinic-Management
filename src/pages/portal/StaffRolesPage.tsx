import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, Plus, Lock, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  LEGACY_PERMISSION_KEY_MAP,
  PERMISSION_DEFINITIONS,
  PermissionKey,
  getDefaultPermissionsForRole,
  mergePermissionsWithDefaults,
  resolvePermissionKeys,
} from '../../lib/portalPermissions';

interface Role {
  id: string;
  name: string;
  is_system_default: boolean;
  clinic_id: string | null;
}

interface Permission {
  permission_key: string;
  can_read: boolean;
  can_write: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

type StaffTab = 'team' | 'permissions';
type RoleSchemaMode = 'roles' | 'clinic_roles';
type PermissionSchemaMode = 'modern' | 'legacy';

const ROLE_PRIORITY = ['admin', 'doctor', 'assistant', 'receptionist', 'clinic_admin'];

const isMissingTableError = (message: string, table: string) => {
  const msg = message.toLowerCase();
  return msg.includes(`public.${table}`) || msg.includes(`relation "${table}"`) || msg.includes(`table '${table}'`);
};

const isMissingColumnError = (message: string, column: string) => {
  const msg = message.toLowerCase();
  return msg.includes(column.toLowerCase()) && (msg.includes('column') || msg.includes('does not exist'));
};

const normalizeRoleLabel = (role: string) => role.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const sortRoles = (roleList: Role[]) => {
  return [...roleList].sort((a, b) => {
    const aPriority = ROLE_PRIORITY.indexOf(a.name);
    const bPriority = ROLE_PRIORITY.indexOf(b.name);

    if (aPriority !== -1 || bPriority !== -1) {
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      return aPriority - bPriority;
    }

    return a.name.localeCompare(b.name);
  });
};

function buildPermissionState(roleName: string, overrides: Record<string, boolean>) {
  const merged = mergePermissionsWithDefaults(roleName, overrides);
  const state: Record<string, Permission> = {};

  PERMISSION_DEFINITIONS.forEach((perm) => {
    const enabled = merged[perm.key] !== false;
    state[perm.key] = {
      permission_key: perm.key,
      can_read: enabled,
      can_write: enabled,
    };
  });

  return state;
}

export default function StaffRolesPage() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<StaffTab>('permissions');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});
  const [roleSchemaMode, setRoleSchemaMode] = useState<RoleSchemaMode>('roles');
  const [permissionSchemaMode, setPermissionSchemaMode] = useState<PermissionSchemaMode>('modern');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [isAddingRole, setIsAddingRole] = useState(false);

  useEffect(() => {
    if (profile) {
      void fetchRoles();
    }
  }, [profile?.clinic_id]);

  useEffect(() => {
    if (selectedRole && activeTab === 'permissions') {
      void fetchPermissions(selectedRole.id, selectedRole.name);
    }
  }, [selectedRole?.id, activeTab]);

  useEffect(() => {
    if (profile && activeTab === 'team') {
      void fetchTeam();
    }
  }, [activeTab, profile?.clinic_id, profile?.role]);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const roleFilter = profile?.clinic_id
        ? `clinic_id.eq.${profile.clinic_id},is_system_default.eq.true`
        : 'is_system_default.eq.true';

      let normalizedRoles: Role[] = [];

      const modernResult = await supabase
        .from('roles')
        .select('id, name, is_system_default, clinic_id')
        .or(roleFilter)
        .order('is_system_default', { ascending: false })
        .order('name');

      if (modernResult.error) {
        if (!isMissingTableError(modernResult.error.message || '', 'roles')) {
          throw modernResult.error;
        }

        const legacyFilter = profile?.clinic_id
          ? `clinic_id.eq.${profile.clinic_id},is_default.eq.true`
          : 'is_default.eq.true';

        const legacyResult = await supabase
          .from('clinic_roles')
          .select('id, role_name, is_default, clinic_id')
          .or(legacyFilter)
          .order('is_default', { ascending: false })
          .order('role_name');

        if (legacyResult.error) throw legacyResult.error;

        setRoleSchemaMode('clinic_roles');
        normalizedRoles = (legacyResult.data || []).map((row: any) => ({
          id: row.id,
          name: row.role_name,
          is_system_default: Boolean(row.is_default),
          clinic_id: row.clinic_id,
        }));
      } else {
        setRoleSchemaMode('roles');
        normalizedRoles = (modernResult.data || []) as Role[];
      }

      const sortedRoles = sortRoles(normalizedRoles);
      setRoles(sortedRoles);
      setSelectedRole((prev) => {
        if (!sortedRoles.length) return null;
        if (!prev) return sortedRoles[0];
        return sortedRoles.find((r) => r.id === prev.id) || sortedRoles[0];
      });
    } catch (err: any) {
      toast.error('Failed to load roles: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeam = async () => {
    try {
      setTeamLoading(true);

      let query = supabase
        .from('users_profile')
        .select('id, name, email, role, is_active')
        .order('created_at', { ascending: false });

      if (profile?.role !== 'admin' && profile?.clinic_id) {
        query = query.eq('clinic_id', profile.clinic_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setTeam((data || []) as TeamMember[]);
    } catch (err: any) {
      toast.error('Failed to load team: ' + err.message);
    } finally {
      setTeamLoading(false);
    }
  };

  const fetchPermissions = async (roleId: string, roleName: string) => {
    try {
      const modernResult = await supabase
        .from('role_permissions')
        .select('permission_key, can_read, can_write')
        .eq('role_id', roleId);

      if (!modernResult.error) {
        const overrides: Record<string, boolean> = {};
        modernResult.data?.forEach((row: any) => {
          const enabled = Boolean(row.can_read || row.can_write);
          const keys = resolvePermissionKeys(String(row.permission_key || ''));

          if (!keys.length && row.permission_key) {
            overrides[String(row.permission_key)] = enabled;
            return;
          }

          keys.forEach((key) => {
            overrides[key] = enabled;
          });
        });

        setPermissionSchemaMode('modern');
        setPermissions(buildPermissionState(roleName, overrides));
        return;
      }

      const modernMessage = modernResult.error.message || '';
      if (isMissingTableError(modernMessage, 'role_permissions')) {
        setPermissions(buildPermissionState(roleName, getDefaultPermissionsForRole(roleName)));
        return;
      }

      const shouldFallbackToLegacy =
        isMissingColumnError(modernMessage, 'permission_key') ||
        isMissingColumnError(modernMessage, 'can_read') ||
        isMissingColumnError(modernMessage, 'can_write');

      if (!shouldFallbackToLegacy) {
        throw modernResult.error;
      }

      const legacyResult = await supabase
        .from('role_permissions')
        .select('page_key, can_view, can_edit, can_delete')
        .eq('role_id', roleId);

      if (legacyResult.error) throw legacyResult.error;

      const overrides: Record<string, boolean> = {};
      legacyResult.data?.forEach((row: any) => {
        const enabled = Boolean(row.can_view || row.can_edit || row.can_delete);
        const keys = resolvePermissionKeys(String(row.page_key || ''));
        keys.forEach((key) => {
          overrides[key] = enabled;
        });
      });

      setPermissionSchemaMode('legacy');
      setPermissions(buildPermissionState(roleName, overrides));
    } catch (err: any) {
      toast.error('Failed to load permissions: ' + err.message);
    }
  };

  const togglePermission = (key: PermissionKey) => {
    setPermissions((prev) => {
      const current = prev[key] || { permission_key: key, can_read: false, can_write: false };
      const nextState = !current.can_read;
      return {
        ...prev,
        [key]: { ...current, can_read: nextState, can_write: nextState },
      };
    });
  };

  const savePermissions = async () => {
    if (!selectedRole) return;

    try {
      setSaving(true);

      if (permissionSchemaMode === 'legacy') {
        const legacyRows = PERMISSION_DEFINITIONS.map((perm) => {
          const current = permissions[perm.key];
          return {
            role_id: selectedRole.id,
            page_key: (LEGACY_PERMISSION_KEY_MAP[perm.key] || [perm.key])[0],
            can_view: Boolean(current?.can_read),
            can_edit: Boolean(current?.can_write),
            can_delete: Boolean(current?.can_write),
          };
        });

        const { error: deleteLegacyError } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', selectedRole.id);

        if (deleteLegacyError) throw deleteLegacyError;

        const { error: insertLegacyError } = await supabase
          .from('role_permissions')
          .insert(legacyRows);

        if (insertLegacyError) throw insertLegacyError;
      } else {
        const rows = PERMISSION_DEFINITIONS.map((perm) => {
          const current = permissions[perm.key];
          return {
            role_id: selectedRole.id,
            permission_key: perm.key,
            can_read: Boolean(current?.can_read),
            can_write: Boolean(current?.can_write),
          };
        });

        const { error: deleteModernError } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', selectedRole.id);

        if (deleteModernError) throw deleteModernError;

        const { error: insertModernError } = await supabase
          .from('role_permissions')
          .insert(rows);

        if (insertModernError) throw insertModernError;
      }

      await refreshProfile();
      await fetchPermissions(selectedRole.id, selectedRole.name);
      toast.success('Permissions saved successfully');
    } catch (err: any) {
      toast.error('Failed to save permissions: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddRole = async () => {
    if (!newRoleName.trim()) return;

    try {
      let createdRole: Role;

      if (roleSchemaMode === 'clinic_roles') {
        const { data, error } = await supabase
          .from('clinic_roles')
          .insert([
            {
              role_name: newRoleName.trim().toLowerCase(),
              clinic_id: profile?.clinic_id,
              is_default: false,
            },
          ])
          .select('id, role_name, is_default, clinic_id')
          .single();

        if (error) throw error;

        createdRole = {
          id: data.id,
          name: data.role_name,
          is_system_default: Boolean(data.is_default),
          clinic_id: data.clinic_id,
        };
      } else {
        const { data, error } = await supabase
          .from('roles')
          .insert([
            {
              name: newRoleName.trim().toLowerCase(),
              clinic_id: profile?.clinic_id,
              is_system_default: false,
            },
          ])
          .select('id, name, is_system_default, clinic_id')
          .single();

        if (error) throw error;
        createdRole = data as Role;
      }

      const nextRoles = sortRoles([...roles, createdRole]);
      setRoles(nextRoles);
      setNewRoleName('');
      setIsAddingRole(false);
      setSelectedRole(createdRole);
      setActiveTab('permissions');
      toast.success('Role created successfully');
    } catch (err: any) {
      toast.error('Failed to create role: ' + err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff & Roles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage team members and global page permissions</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-medium">
            <button
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2 rounded-md transition-colors ${
                activeTab === 'team' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Team
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`px-4 py-2 rounded-md transition-colors ${
                activeTab === 'permissions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Roles & Permissions
            </button>
          </div>

          <button
            onClick={() => navigate('/portal/users')}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={18} />
            <span>Add Staff</span>
          </button>
        </div>
      </div>

      {activeTab === 'team' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
              <Users size={18} /> Team Members
            </h2>
            <span className="text-sm text-gray-500">{team.length} members</span>
          </div>

          <div className="p-4">
            {teamLoading ? (
              <p className="text-center text-sm text-gray-400 py-8">Loading team...</p>
            ) : team.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No team members found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="py-3 px-2 font-medium">Name</th>
                      <th className="py-3 px-2 font-medium">Email</th>
                      <th className="py-3 px-2 font-medium">Role</th>
                      <th className="py-3 px-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((member) => (
                      <tr key={member.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-3 px-2 font-medium text-gray-900">{member.name}</td>
                        <td className="py-3 px-2 text-gray-600">{member.email}</td>
                        <td className="py-3 px-2 text-gray-700">{normalizeRoleLabel(member.role)}</td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                              member.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {member.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-6 h-[calc(100vh-13rem)] min-h-[500px]">
          <div className="w-72 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                <ShieldCheck size={18} />
                Roles
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {loading ? (
                <p className="text-center text-sm text-gray-400 py-4">Loading roles...</p>
              ) : (
                roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role)}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors hover:bg-indigo-50 ${
                      selectedRole?.id === role.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{normalizeRoleLabel(role.name)}</span>
                      {role.is_system_default && <Lock size={12} className="text-gray-400" />}
                    </div>
                  </button>
                ))
              )}

              {isAddingRole ? (
                <div className="pt-2 px-2 pb-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Role name..."
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void handleAddRole()}
                    className="w-full text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 p-2 border"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => void handleAddRole()}
                      className="text-xs bg-indigo-600 text-white px-2 py-1 rounded"
                    >
                      Save
                    </button>
                    <button onClick={() => setIsAddingRole(false)} className="text-xs text-gray-500 px-2 py-1">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-2">
                  <button
                    onClick={() => setIsAddingRole(true)}
                    className="w-full flex items-center gap-2 text-sm text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Plus size={16} />
                    Add New Role
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            {selectedRole ? (
              <>
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                    Permissions for: {normalizeRoleLabel(selectedRole.name)}
                    {selectedRole.is_system_default && (
                      <span className="text-xs font-normal bg-gray-100 text-gray-500 px-2 py-1 rounded-full flex items-center gap-1">
                        <Lock size={10} /> System Default
                      </span>
                    )}
                  </h2>
                  <button
                    onClick={() => void savePermissions()}
                    disabled={saving}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-4 max-w-3xl">
                    {PERMISSION_DEFINITIONS.map((perm) => {
                      const isActive = permissions[perm.key]?.can_read || false;
                      return (
                        <div
                          key={perm.key}
                          className="flex items-center justify-between pb-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 p-2 rounded-lg transition-colors"
                        >
                          <div>
                            <h3 className="font-semibold text-gray-800">{perm.label}</h3>
                            <p className="text-sm text-gray-500">{perm.desc}</p>
                          </div>

                          <button
                            role="switch"
                            aria-checked={isActive}
                            onClick={() => togglePermission(perm.key)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                              isActive ? 'bg-indigo-600' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                isActive ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">Select a role to view permissions</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}