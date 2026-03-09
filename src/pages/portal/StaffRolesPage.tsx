import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Plus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  LEGACY_PERMISSION_KEY_MAP,
  PERMISSION_DEFINITIONS,
  PermissionKey,
  getDefaultPermissionsForRole,
  mergePermissionsWithDefaults,
  resolvePermissionKeys,
} from '../../lib/portalPermissions';
import { supabase } from '../../lib/supabase';

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

interface LegacyRoleRow {
  id: string;
  role_name: string;
  is_default: boolean | null;
  clinic_id: string | null;
}

interface ModernPermissionRow {
  permission_key: string | null;
  can_read: boolean | null;
  can_write: boolean | null;
}

interface LegacyPermissionRow {
  page_key: string | null;
  can_view: boolean | null;
  can_edit: boolean | null;
  can_delete: boolean | null;
}

type StaffTab = 'team' | 'permissions';
type RoleSchemaMode = 'roles' | 'clinic_roles';
type PermissionSchemaMode = 'modern' | 'legacy';

const ROLE_PRIORITY = ['admin', 'manager', 'doctor', 'assistant', 'receptionist', 'barber', 'clinic_admin'];

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
      msg.includes(`table "public.${tableName}"`) ||
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

const normalizeRoleLabel = (role: string) => role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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

const getErrorMessage = (error: unknown) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }

  return 'Unknown error';
};

export default function StaffRolesPage() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<StaffTab>('permissions');

  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [loadingClinics, setLoadingClinics] = useState(true);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleSchemaMode, setRoleSchemaMode] = useState<RoleSchemaMode>('roles');
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [permissions, setPermissions] = useState<Record<string, Permission>>({});
  const [permissionSchemaMode, setPermissionSchemaMode] = useState<PermissionSchemaMode>('modern');
  const [savingPermissions, setSavingPermissions] = useState(false);

  const [newRoleName, setNewRoleName] = useState('');
  const [isAddingRole, setIsAddingRole] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const hasMultipleClinics = clinics.length > 1;
  const requiresClinicSelection = isAdmin && hasMultipleClinics && !selectedClinicId;

  const effectiveClinicId = useMemo(() => {
    if (!profile?.role) return null;
    if (profile.role === 'admin') return selectedClinicId || null;
    return profile.clinic_id || null;
  }, [profile?.role, profile?.clinic_id, selectedClinicId]);

  const selectedClinicName = useMemo(() => {
    if (!selectedClinicId) {
      if (isAdmin && hasMultipleClinics) return 'No Clinic Selected';
      return clinics[0]?.clinic_name || 'My Clinic';
    }

    return clinics.find((clinic) => clinic.id === selectedClinicId)?.clinic_name || 'Selected Clinic';
  }, [selectedClinicId, clinics, isAdmin, hasMultipleClinics]);

  const enabledPermissionCount = useMemo(() => {
    return PERMISSION_DEFINITIONS.filter((perm) => permissions[perm.key]?.can_read).length;
  }, [permissions]);

  const fetchClinics = useCallback(async () => {
    if (!profile) return;

    try {
      setLoadingClinics(true);

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

        if (clinicRows.length === 1) {
          return clinicRows[0].id;
        }

        return '';
      });
    } catch (err: unknown) {
      if (profile.clinic_id) {
        setClinics([{ id: profile.clinic_id, clinic_name: 'My Clinic' }]);
        setSelectedClinicId(profile.clinic_id);
      }
      toast.error('Failed to load clinics: ' + getErrorMessage(err));
    } finally {
      setLoadingClinics(false);
    }
  }, [profile]);

  const fetchRoles = useCallback(async () => {
    if (!profile) return;
    if (requiresClinicSelection) return;

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
          normalizedRoles = ((legacyResult.data || []) as LegacyRoleRow[]).map((row) => ({
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
          normalizedRoles = ((legacyResult.data || []) as LegacyRoleRow[]).map((row) => ({
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

      if (!sortedRoles.length) {
        setSelectedRole(null);
        setPermissions({});
        return;
      }

      setSelectedRole((prev) => {
        if (!prev) return sortedRoles[0];
        return sortedRoles.find((role) => role.id === prev.id) || sortedRoles[0];
      });
    } catch (err: unknown) {
      toast.error('Failed to load roles: ' + getErrorMessage(err));
    } finally {
      setLoadingRoles(false);
    }
  }, [profile, requiresClinicSelection, effectiveClinicId, roleSchemaMode]);

  const fetchTeam = useCallback(async () => {
    if (!profile) return;
    if (requiresClinicSelection) return;

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

      setTeam((data || []) as TeamMember[]);
    } catch (err: unknown) {
      toast.error('Failed to load team: ' + getErrorMessage(err));
    } finally {
      setTeamLoading(false);
    }
  }, [profile, requiresClinicSelection, effectiveClinicId]);

  const fetchPermissions = useCallback(async (roleId: string, roleName: string) => {
    try {
      const modernResult = await supabase
        .from('role_permissions')
        .select('permission_key, can_read, can_write')
        .eq('role_id', roleId);

      if (!modernResult.error) {
        const overrides: Record<string, boolean> = {};
        const modernRows = (modernResult.data || []) as ModernPermissionRow[];

        modernRows.forEach((row) => {
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
      const legacyRows = (legacyResult.data || []) as LegacyPermissionRow[];

      legacyRows.forEach((row) => {
        const enabled = Boolean(row.can_view || row.can_edit || row.can_delete);
        const keys = resolvePermissionKeys(String(row.page_key || ''));
        keys.forEach((key) => {
          overrides[key] = enabled;
        });
      });

      setPermissionSchemaMode('legacy');
      setPermissions(buildPermissionState(roleName, overrides));
    } catch (err: unknown) {
      toast.error('Failed to load permissions: ' + getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (!profile) {
      setClinics([]);
      setSelectedClinicId('');
      setLoadingClinics(false);
      return;
    }

    void fetchClinics();
  }, [profile, fetchClinics]);

  useEffect(() => {
    if (!profile || loadingClinics) return;

    if (requiresClinicSelection) {
      setTeam([]);
      setRoles([]);
      setSelectedRole(null);
      setPermissions({});
      return;
    }

    void fetchTeam();
    void fetchRoles();
  }, [profile, loadingClinics, selectedClinicId, requiresClinicSelection, fetchRoles, fetchTeam]);

  useEffect(() => {
    if (activeTab !== 'permissions') return;

    if (!selectedRole) {
      setPermissions({});
      return;
    }

    void fetchPermissions(selectedRole.id, selectedRole.name);
  }, [activeTab, selectedRole, fetchPermissions]);

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

        const { error: insertLegacyError } = await supabase.from('role_permissions').insert(legacyRows);

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

        const { error: insertModernError } = await supabase.from('role_permissions').insert(rows);

        if (insertModernError) throw insertModernError;
      }

      await refreshProfile();
      await fetchPermissions(selectedRole.id, selectedRole.name);
      toast.success('Permissions saved successfully');
    } catch (err: unknown) {
      toast.error('Failed to save permissions: ' + getErrorMessage(err));
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleAddRole = async () => {
    const roleName = newRoleName.trim().toLowerCase();
    if (!roleName) return;

    if (roles.some((role) => role.name === roleName && (role.clinic_id === effectiveClinicId || role.is_system_default))) {
      toast.error('This role already exists in the selected clinic');
      return;
    }

    if (requiresClinicSelection || (roleSchemaMode === 'clinic_roles' && !effectiveClinicId)) {
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
    } catch (err: unknown) {
      toast.error('Failed to create role: ' + getErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="min-h-[calc(100vh-8.5rem)] rounded-3xl border border-[#1a2438] bg-[#050913] text-slate-100 shadow-[0_24px_70px_rgba(2,6,23,0.5)]">
        <div className="space-y-6 p-5 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">Staff & Roles</h1>
              <p className="mt-1 text-sm text-slate-400">
                {teamLoading ? 'Loading team members...' : `${team.length} team members`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl border border-[#25304a] bg-[#0c1322] p-1 text-sm font-medium">
                <button
                  onClick={() => setActiveTab('team')}
                  className={`rounded-lg px-5 py-2.5 transition-colors ${
                    activeTab === 'team' ? 'bg-[#2563eb] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Team
                </button>
                <button
                  onClick={() => setActiveTab('permissions')}
                  className={`rounded-lg px-5 py-2.5 transition-colors ${
                    activeTab === 'permissions' ? 'bg-[#2563eb] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Roles & Permissions
                </button>
              </div>

              <button
                onClick={() => navigate('/portal/users')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8]"
              >
                <Plus size={16} />
                Add Staff
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#1f2a41] bg-[#0a1120] p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[240px] flex-1 max-w-sm">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Select Clinic First
                </label>
                <select
                  value={selectedClinicId}
                  onChange={(e) => setSelectedClinicId(e.target.value)}
                  disabled={loadingClinics || !isAdmin || !hasMultipleClinics}
                  className="w-full rounded-xl border border-[#2a3755] bg-[#10192d] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAdmin && hasMultipleClinics && <option value="">Choose a clinic</option>}
                  {clinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.clinic_name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="pb-1 text-sm text-slate-300">
                Managing: <span className="font-semibold text-white">{selectedClinicName}</span>
              </p>
            </div>
          </div>

          {loadingClinics ? (
            <div className="rounded-2xl border border-[#1f2a41] bg-[#0a1120] p-10 text-center text-slate-400">Loading clinics...</div>
          ) : requiresClinicSelection ? (
            <div className="rounded-2xl border border-[#1f2a41] bg-[#0a1120] p-10 text-center">
              <h2 className="text-xl font-semibold text-white">Select a clinic to continue</h2>
              <p className="mt-2 text-sm text-slate-400">
                Choose a clinic from the dropdown above, then manage staff and role permissions.
              </p>
            </div>
          ) : activeTab === 'team' ? (
            <div className="overflow-hidden rounded-2xl border border-[#1f2a41] bg-[#0a1120]">
              <div className="flex items-center justify-between border-b border-[#1f2a41] px-5 py-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                  <Users size={18} />
                  Team - {selectedClinicName}
                </h2>
                <span className="text-sm text-slate-400">{team.length} members</span>
              </div>

              {teamLoading ? (
                <p className="py-10 text-center text-sm text-slate-400">Loading team...</p>
              ) : team.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No team members found for this clinic.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400">
                        <th className="px-5 py-3 font-medium">Name</th>
                        <th className="px-5 py-3 font-medium">Email</th>
                        <th className="px-5 py-3 font-medium">Role</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.map((member) => (
                        <tr key={member.id} className="border-t border-[#1f2a41]">
                          <td className="px-5 py-3 font-medium text-white">{member.name}</td>
                          <td className="px-5 py-3 text-slate-300">{member.email}</td>
                          <td className="px-5 py-3 text-slate-200">{normalizeRoleLabel(member.role)}</td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                member.is_active
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-slate-500/20 text-slate-300'
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
          ) : (
            <div className="grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
              <aside className="overflow-hidden rounded-2xl border border-[#1f2a41] bg-[#0a1120]">
                <div className="flex items-center justify-between border-b border-[#1f2a41] px-4 py-4">
                  <h2 className="text-lg font-semibold text-white">Roles</h2>
                  <button
                    onClick={() => setIsAddingRole((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#2a3a5e] bg-[#10192d] px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-[#3b82f6]"
                  >
                    <Plus size={14} />
                    Role
                  </button>
                </div>

                <div className="max-h-[580px] space-y-2 overflow-y-auto p-3">
                  {loadingRoles ? (
                    <p className="px-2 py-3 text-sm text-slate-400">Loading roles...</p>
                  ) : roles.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-slate-400">No roles found for this clinic.</p>
                  ) : (
                    roles.map((role) => (
                      <button
                        key={role.id}
                        onClick={() => setSelectedRole(role)}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                          selectedRole?.id === role.id
                            ? 'border-[#2f5fcc] bg-[#13213f] text-blue-100'
                            : 'border-transparent bg-[#0f182a] text-slate-200 hover:border-[#2a3a5e]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{normalizeRoleLabel(role.name)}</span>
                          {role.is_system_default && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                              <Lock size={10} />
                              System
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {isAddingRole && (
                  <div className="space-y-2 border-t border-[#1f2a41] p-3">
                    <input
                      type="text"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void handleAddRole()}
                      placeholder="e.g. manager"
                      className="w-full rounded-lg border border-[#2a3a5e] bg-[#10192d] px-3 py-2 text-sm text-white outline-none transition focus:border-[#3b82f6]"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void handleAddRole()}
                        className="rounded-lg bg-[#2563eb] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1d4ed8]"
                      >
                        Save Role
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingRole(false);
                          setNewRoleName('');
                        }}
                        className="rounded-lg border border-[#2a3a5e] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </aside>

              <section className="overflow-hidden rounded-2xl border border-[#1f2a41] bg-[#0a1120]">
                {loadingRoles ? (
                  <p className="py-16 text-center text-sm text-slate-400">Loading permissions...</p>
                ) : !selectedRole ? (
                  <p className="py-16 text-center text-sm text-slate-400">Select a role to manage permissions.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1f2a41] px-5 py-5">
                      <div>
                        <h2 className="text-2xl font-semibold text-white">
                          Permissions for: {normalizeRoleLabel(selectedRole.name)}
                        </h2>
                        <p className="mt-1 text-sm text-slate-400">
                          {enabledPermissionCount} of {PERMISSION_DEFINITIONS.length} permissions enabled
                        </p>
                      </div>

                      <button
                        onClick={() => void savePermissions()}
                        disabled={savingPermissions}
                        className="rounded-xl bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingPermissions ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>

                    <div className="divide-y divide-[#1f2a41] px-5">
                      {PERMISSION_DEFINITIONS.map((perm) => {
                        const isActive = permissions[perm.key]?.can_read || false;
                        return (
                          <div key={perm.key} className="flex items-center justify-between gap-4 py-4">
                            <div>
                              <h3 className="text-lg font-semibold text-white">{perm.label}</h3>
                              <p className="text-sm text-slate-400">{perm.desc}</p>
                            </div>

                            <button
                              role="switch"
                              aria-checked={isActive}
                              onClick={() => togglePermission(perm.key)}
                              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:ring-offset-2 focus:ring-offset-[#0a1120] ${
                                isActive ? 'bg-[#2563eb]' : 'bg-[#25324f]'
                              }`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                  isActive ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}