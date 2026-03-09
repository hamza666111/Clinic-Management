import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Lock, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  LEGACY_PERMISSION_KEY_MAP,
  PERMISSION_DEFINITIONS,
  PermissionKey,
  getDefaultPermissionsForRole,
  mergePermissionsWithDefaults,
  resolvePermissionKeys,
} from '../../lib/portalPermissions';

interface ClinicOption {
  id: string;
  clinic_name: string;
}

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
  clinic_id: string | null;
}

type StaffTab = 'team' | 'permissions';
type RoleSchemaMode = 'roles' | 'clinic_roles';
type PermissionSchemaMode = 'modern' | 'legacy';

const ROLE_PRIORITY = ['admin', 'doctor', 'assistant', 'receptionist', 'clinic_admin'];

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
  status?: number;
  statusCode?: number;
};

const isMissingTableError = (errorLike: SupabaseLikeError | string | null | undefined, table: string) => {
  if (!errorLike) return false;

  const tableName = table.toLowerCase();
  const buildMessage = (message: string) => {
    const msg = message.toLowerCase();
    return (
      msg.includes(`public.${tableName}`) ||
      msg.includes(`relation "${tableName}"`) ||
      msg.includes(`table '${tableName}'`) ||
      msg.includes(`table \"public.${tableName}\"`) ||
      msg.includes(`could not find the table 'public.${tableName}'`) ||
      (msg.includes('not found') && msg.includes(tableName))
    );
  };

  if (typeof errorLike === 'string') {
    return buildMessage(errorLike);
  }

  const status = errorLike.status ?? errorLike.statusCode;
  const code = (errorLike.code || '').toUpperCase();
  const message = [errorLike.message, errorLike.details, errorLike.hint].filter(Boolean).join(' ');

  return status === 404 || code === '42P01' || code === 'PGRST205' || buildMessage(message);
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

    if (aPriority !== bPriority) {
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      return aPriority - bPriority;
    }

    if (a.name === b.name && a.is_system_default !== b.is_system_default) {
      return Number(a.is_system_default) - Number(b.is_system_default);
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

  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleSchemaMode, setRoleSchemaMode] = useState<RoleSchemaMode>('roles');
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [permissions, setPermissions] = useState<Record<string, Permission>>({});
  const [permissionSchemaMode, setPermissionSchemaMode] = useState<PermissionSchemaMode>('modern');
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [assigningRole, setAssigningRole] = useState(false);

  const [newRoleName, setNewRoleName] = useState('');
  const [isAddingRole, setIsAddingRole] = useState(false);

  const hasMultipleClinics = clinics.length > 1;

  const effectiveClinicId = useMemo(() => {
    if (!profile) return null;
    if (profile.role === 'admin') return selectedClinicId || null;
    return profile.clinic_id || null;
  }, [profile?.role, profile?.clinic_id, selectedClinicId]);

  const selectedClinicName = useMemo(() => {
    if (!selectedClinicId) return 'All Clinics';
    return clinics.find((c) => c.id === selectedClinicId)?.clinic_name || 'Selected Clinic';
  }, [clinics, selectedClinicId]);

  const findRoleByName = (roleName?: string | null) => {
    if (!roleName) return null;
    const normalizedRole = roleName.trim().toLowerCase();

    return (
      roles.find((role) => role.name === normalizedRole && role.clinic_id === effectiveClinicId) ||
      roles.find((role) => role.name === normalizedRole && !role.is_system_default) ||
      roles.find((role) => role.name === normalizedRole && role.is_system_default) ||
      roles.find((role) => role.name === normalizedRole) ||
      null
    );
  };

  const fetchClinics = async () => {
    if (!profile) return;

    try {
      let query = supabase.from('clinics').select('id, clinic_name').order('clinic_name');

      if (profile.role !== 'admin' && profile.clinic_id) {
        query = query.eq('id', profile.clinic_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const clinicRows = (data || []) as ClinicOption[];
      setClinics(clinicRows);

      setSelectedClinicId((prev) => {
        if (profile.role !== 'admin') {
          return profile.clinic_id || clinicRows[0]?.id || '';
        }

        if (prev && clinicRows.some((clinic) => clinic.id === prev)) {
          return prev;
        }

        return clinicRows[0]?.id || '';
      });
    } catch (err: any) {
      if (profile.clinic_id) {
        setClinics([{ id: profile.clinic_id, clinic_name: 'My Clinic' }]);
        setSelectedClinicId(profile.clinic_id);
      }
      toast.error('Failed to load clinics: ' + err.message);
    }
  };

  const fetchRoles = async () => {
    if (!profile) return;

    try {
      setLoadingRoles(true);

      const roleFilter = effectiveClinicId
        ? `clinic_id.eq.${effectiveClinicId},is_system_default.eq.true`
        : 'is_system_default.eq.true';

      let normalizedRoles: Role[] = [];

      const fetchModernRoles = async () => {
        return supabase
          .from('roles')
          .select('id, name, is_system_default, clinic_id')
          .or(roleFilter)
          .order('is_system_default', { ascending: false })
          .order('name');
      };

      const fetchLegacyRoles = async () => {
        let legacyQuery = supabase
          .from('clinic_roles')
          .select('id, role_name, is_default, clinic_id')
          .order('is_default', { ascending: false })
          .order('role_name');

        if (effectiveClinicId) {
          legacyQuery = legacyQuery.eq('clinic_id', effectiveClinicId);
        }

        return legacyQuery;
      };

      if (roleSchemaMode === 'clinic_roles') {
        const legacyResult = await fetchLegacyRoles();

        if (legacyResult.error) {
          if (!isMissingTableError({ ...legacyResult.error, status: legacyResult.status }, 'clinic_roles')) {
            throw legacyResult.error;
          }

          const modernResult = await fetchModernRoles();
          if (modernResult.error) throw modernResult.error;

          setRoleSchemaMode('roles');
          normalizedRoles = (modernResult.data || []) as Role[];
        } else {
          setRoleSchemaMode('clinic_roles');
          normalizedRoles = (legacyResult.data || []).map((row: any) => ({
            id: row.id,
            name: row.role_name,
            is_system_default: Boolean(row.is_default),
            clinic_id: row.clinic_id,
          }));
        }
      } else {
        const modernResult = await fetchModernRoles();

        if (modernResult.error) {
          if (!isMissingTableError({ ...modernResult.error, status: modernResult.status }, 'roles')) {
            throw modernResult.error;
          }

          const legacyResult = await fetchLegacyRoles();
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
      }

      const sortedRoles = sortRoles(normalizedRoles);
      setRoles(sortedRoles);

      setSelectedRole((prev) => {
        if (!sortedRoles.length) return null;
        if (!prev) return sortedRoles[0];
        return sortedRoles.find((role) => role.id === prev.id) || prev || sortedRoles[0];
      });
    } catch (err: any) {
      toast.error('Failed to load roles: ' + err.message);
    } finally {
      setLoadingRoles(false);
    }
  };

  const fetchTeam = async () => {
    if (!profile) return;

    try {
      setTeamLoading(true);

      let query = supabase
        .from('users_profile')
        .select('id, name, email, role, is_active, clinic_id')
        .order('created_at', { ascending: false });

      if (effectiveClinicId) {
        query = query.eq('clinic_id', effectiveClinicId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const members = (data || []) as TeamMember[];
      setTeam(members);

      setSelectedMember((prev) => {
        if (!members.length) return null;
        if (!prev) return members[0];
        return members.find((member) => member.id === prev.id) || members[0];
      });
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
      if (isMissingTableError(modernResult.error, 'role_permissions')) {
        setPermissionSchemaMode('modern');
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

  useEffect(() => {
    if (profile) {
      void fetchClinics();
    }
  }, [profile?.id, profile?.role, profile?.clinic_id]);

  useEffect(() => {
    if (!profile) return;
    if (profile.role === 'admin' && hasMultipleClinics && !selectedClinicId) return;

    void fetchTeam();
    void fetchRoles();
  }, [profile?.id, profile?.role, profile?.clinic_id, selectedClinicId, hasMultipleClinics]);

  useEffect(() => {
    if (activeTab !== 'permissions') return;

    if (!selectedMember) {
      setSelectedRole(null);
      setPermissions({});
      return;
    }

    const matchedRole = findRoleByName(selectedMember.role);
    setSelectedRole(matchedRole);

    if (!matchedRole) {
      setPermissionSchemaMode('modern');
      setPermissions(buildPermissionState(selectedMember.role, getDefaultPermissionsForRole(selectedMember.role)));
    }
  }, [activeTab, selectedMember?.id, selectedMember?.role, roles, effectiveClinicId]);

  useEffect(() => {
    if (activeTab === 'permissions' && selectedRole) {
      void fetchPermissions(selectedRole.id, selectedRole.name);
    }
  }, [activeTab, selectedRole?.id]);

  const togglePermission = (key: PermissionKey) => {
    setPermissions((prev) => {
      const current = prev[key] || { permission_key: key, can_read: false, can_write: false };
      const nextState = !current.can_read;
      return {
        ...prev,
        [key]: {
          ...current,
          can_read: nextState,
          can_write: nextState,
        },
      };
    });
  };

  const savePermissions = async () => {
    if (!selectedRole) {
      toast.error('Select a role before saving permissions');
      return;
    }

    try {
      setSavingPermissions(true);

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
      setSavingPermissions(false);
    }
  };

  const handleAssignRoleToMember = async () => {
    if (!selectedMember || !selectedRole) {
      toast.error('Select a team member and a role first');
      return;
    }

    try {
      setAssigningRole(true);

      const { error } = await supabase.functions.invoke('create-user', {
        body: {
          action: 'update_profile',
          user_id: selectedMember.id,
          role: selectedRole.name,
          clinic_id: selectedMember.clinic_id ?? effectiveClinicId ?? null,
        },
      });

      if (error) throw new Error(error.message || 'Failed to update team member role');

      await fetchTeam();
      await refreshProfile();
      toast.success(`Updated ${selectedMember.name}'s role to ${normalizeRoleLabel(selectedRole.name)}`);
    } catch (err: any) {
      toast.error('Failed to update member role: ' + err.message);
    } finally {
      setAssigningRole(false);
    }
  };

  const handleAddRole = async () => {
    const roleName = newRoleName.trim().toLowerCase();
    if (!roleName) return;

    if (roles.some((role) => role.name === roleName && (role.clinic_id === effectiveClinicId || role.is_system_default))) {
      toast.error('This role already exists in the selected clinic');
      return;
    }

    if (profile?.role === 'admin' && hasMultipleClinics && !effectiveClinicId) {
      toast.error('Please select a clinic before adding a role');
      return;
    }

    if (roleSchemaMode === 'clinic_roles' && !effectiveClinicId) {
      toast.error('Please select a clinic before adding a role');
      return;
    }

    try {
      let createdRole: Role;

      if (roleSchemaMode === 'clinic_roles') {
        const { data, error } = await supabase
          .from('clinic_roles')
          .insert([
            {
              role_name: roleName,
              clinic_id: effectiveClinicId,
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
              name: roleName,
              clinic_id: effectiveClinicId,
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
      setSelectedRole(createdRole);
      setNewRoleName('');
      setIsAddingRole(false);
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
          <p className="text-sm text-gray-500 mt-1">Manage teams clinic-wise and control page permissions</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
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

          {hasMultipleClinics && (
            <select
              value={selectedClinicId}
              onChange={(e) => setSelectedClinicId(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.clinic_name}
                </option>
              ))}
            </select>
          )}

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
              <Users size={18} /> Team Members - {selectedClinicName}
            </h2>
            <span className="text-sm text-gray-500">{team.length} members</span>
          </div>

          <div className="p-4">
            {teamLoading ? (
              <p className="text-center text-sm text-gray-400 py-8">Loading team...</p>
            ) : team.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No team members found for this clinic</p>
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
        <div className="flex gap-6 h-[calc(100vh-13rem)] min-h-[520px]">
          <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                <Users size={18} /> Team of {selectedClinicName}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {teamLoading ? (
                <p className="text-center text-sm text-gray-400 py-4">Loading team...</p>
              ) : team.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-4">No team members in this clinic</p>
              ) : (
                team.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors border ${
                      selectedMember?.id === member.id
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-white border-transparent text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <p className="font-semibold truncate">{member.name}</p>
                    <p className="text-xs text-gray-500 truncate">{member.email}</p>
                    <p className="text-xs mt-1">{normalizeRoleLabel(member.role)}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            {selectedMember ? (
              <>
                <div className="p-6 border-b border-gray-100 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Permissions for: {selectedMember.name}</h2>
                      <p className="text-sm text-gray-500 mt-1">Toggle access to dashboard and all portal pages</p>
                    </div>

                    <button
                      onClick={() => void savePermissions()}
                      disabled={savingPermissions || !selectedRole}
                      className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50"
                    >
                      {savingPermissions ? 'Saving...' : 'Save Permissions'}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[240px]">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Existing Roles</label>
                      <select
                        value={selectedRole?.id || ''}
                        onChange={(e) => {
                          const role = roles.find((item) => item.id === e.target.value) || null;
                          setSelectedRole(role);
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Select role</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {normalizeRoleLabel(role.name)}{role.is_system_default ? ' (System)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => void handleAssignRoleToMember()}
                      disabled={assigningRole || !selectedRole}
                      className="mt-5 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 text-sm disabled:opacity-50"
                    >
                      {assigningRole ? 'Updating Role...' : 'Assign Role To Member'}
                    </button>

                    <button
                      onClick={() => setIsAddingRole((prev) => !prev)}
                      className="mt-5 flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-200 text-sm"
                    >
                      <Plus size={16} /> Add Role
                    </button>
                  </div>

                  {isAddingRole && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void handleAddRole()}
                        placeholder="e.g. senior_assistant"
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg min-w-[240px] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <button
                        onClick={() => void handleAddRole()}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm"
                      >
                        Save Role
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingRole(false);
                          setNewRoleName('');
                        }}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {loadingRoles ? (
                    <p className="text-center text-sm text-gray-400 py-10">Loading roles...</p>
                  ) : !selectedRole ? (
                    <p className="text-center text-sm text-gray-400 py-10">Select a role to view permissions</p>
                  ) : (
                    <div className="space-y-4 max-w-3xl">
                      <div className="flex items-center gap-3 pb-2">
                        <h3 className="font-semibold text-gray-900">Role: {normalizeRoleLabel(selectedRole.name)}</h3>
                        {selectedRole.is_system_default && (
                          <span className="text-xs font-normal bg-gray-100 text-gray-500 px-2 py-1 rounded-full flex items-center gap-1">
                            <Lock size={10} /> System Default
                          </span>
                        )}
                      </div>

                      {PERMISSION_DEFINITIONS.map((perm) => {
                        const isActive = permissions[perm.key]?.can_read || false;
                        return (
                          <div
                            key={perm.key}
                            className="flex items-center justify-between pb-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 p-2 rounded-lg transition-colors"
                          >
                            <div>
                              <h4 className="font-semibold text-gray-800">{perm.label}</h4>
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
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                Select a team member to manage permissions
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
