import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, Plus, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

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

type RoleSchemaMode = 'roles' | 'clinic_roles';
type PermissionSchemaMode = 'modern' | 'legacy';

const AVAILABLE_PERMISSIONS = [
  { key: 'view_dashboard', label: 'Dashboard', desc: 'View basic dashboard metrics' },
  { key: 'view_revenue', label: 'Total Revenue', desc: 'Can see total revenue figures' },
  { key: 'manage_appointments', label: 'Appointments', desc: 'Book and manage calendar' },
  { key: 'manage_billing', label: 'Billing/Invoices', desc: 'Process transactions and checkouts' },
  { key: 'manage_patients', label: 'Patients/Clients', desc: 'Access and edit client profiles' },
  { key: 'manage_staff', label: 'Staff Management', desc: 'View staff directory and schedules' },
  { key: 'manage_services', label: 'Services', desc: 'Manage service categories and prices' }
];

const LEGACY_PERMISSION_KEY_MAP: Record<string, string[]> = {
  view_dashboard: ['view_dashboard', 'dashboard'],
  view_revenue: ['view_revenue', 'revenue'],
  manage_appointments: ['manage_appointments', 'appointments'],
  manage_billing: ['manage_billing', 'billing', 'invoices'],
  manage_patients: ['manage_patients', 'patients'],
  manage_staff: ['manage_staff', 'staff', 'staff_management'],
  manage_services: ['manage_services', 'services'],
};

const isMissingTableError = (message: string, table: string) => {
  const msg = message.toLowerCase();
  return msg.includes(`public.${table}`) || msg.includes(`relation "${table}"`) || msg.includes(`table '${table}'`);
};

const isMissingColumnError = (message: string, column: string) => {
  const msg = message.toLowerCase();
  return msg.includes(column.toLowerCase()) && (msg.includes('column') || msg.includes('does not exist'));
};

export default function StaffRolesPage() {
  const { profile } = useAuth();
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
      fetchRoles();
    }
  }, [profile?.clinic_id]);

  useEffect(() => {
    if (selectedRole) {
      fetchPermissions(selectedRole.id);
    }
  }, [selectedRole]);

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
        normalizedRoles = (legacyResult.data || []).map((r: any) => ({
          id: r.id,
          name: r.role_name,
          is_system_default: Boolean(r.is_default),
          clinic_id: r.clinic_id,
        }));
      } else {
        setRoleSchemaMode('roles');
        normalizedRoles = (modernResult.data || []) as Role[];
      }

      setRoles(normalizedRoles);
      setSelectedRole(prev => {
        if (!normalizedRoles.length) return null;
        if (!prev) return normalizedRoles[0];
        return normalizedRoles.find(r => r.id === prev.id) || normalizedRoles[0];
      });
    } catch (err: any) {
      toast.error('Failed to load roles: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async (roleId: string) => {
    try {
      const modernResult = await supabase
        .from('role_permissions')
        .select('permission_key, can_read, can_write')
        .eq('role_id', roleId);

      if (!modernResult.error) {
        const permMap: Record<string, Permission> = {};
        modernResult.data?.forEach((p: any) => {
          permMap[p.permission_key] = {
            permission_key: p.permission_key,
            can_read: Boolean(p.can_read),
            can_write: Boolean(p.can_write),
          };
        });
        setPermissionSchemaMode('modern');
        setPermissions(permMap);
        return;
      }

      const modernMessage = modernResult.error.message || '';
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

      const legacyRows = legacyResult.data || [];
      const permMap: Record<string, Permission> = {};

      AVAILABLE_PERMISSIONS.forEach((perm) => {
        const aliases = LEGACY_PERMISSION_KEY_MAP[perm.key] || [perm.key];
        const match = legacyRows.find((row: any) => aliases.includes(row.page_key));
        const enabled = Boolean(match && (match.can_view || match.can_edit || match.can_delete));
        permMap[perm.key] = {
          permission_key: perm.key,
          can_read: enabled,
          can_write: enabled,
        };
      });

      setPermissionSchemaMode('legacy');
      setPermissions(permMap);
    } catch (err: any) {
      toast.error('Failed to load permissions: ' + err.message);
    }
  };

  const togglePermission = (key: string) => {
    setPermissions(prev => {
      const current = prev[key] || { permission_key: key, can_read: false, can_write: false };
      const nextState = !current.can_read; // We treat read/write as just 'access' for this simple toggle
      return {
        ...prev,
        [key]: { ...current, can_read: nextState, can_write: nextState }
      };
    });
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    try {
      setSaving(true);

      if (permissionSchemaMode === 'legacy') {
        const legacyRows = Object.values(permissions).map(p => ({
          role_id: selectedRole.id,
          page_key: (LEGACY_PERMISSION_KEY_MAP[p.permission_key] || [p.permission_key])[0],
          can_view: p.can_read,
          can_edit: p.can_write,
          can_delete: p.can_write,
        }));

        const { error: deleteLegacyError } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', selectedRole.id);

        if (deleteLegacyError) throw deleteLegacyError;

        if (legacyRows.length > 0) {
          const { error: insertLegacyError } = await supabase
            .from('role_permissions')
            .insert(legacyRows);
          if (insertLegacyError) throw insertLegacyError;
        }
      } else {
        const permsToUpsert = Object.values(permissions).map(p => ({
          role_id: selectedRole.id,
          permission_key: p.permission_key,
          can_read: p.can_read,
          can_write: p.can_write,
        }));

        const { error: deleteModernError } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', selectedRole.id);

        if (deleteModernError) throw deleteModernError;

        if (permsToUpsert.length > 0) {
          const { error: insertModernError } = await supabase
            .from('role_permissions')
            .insert(permsToUpsert);
          if (insertModernError) throw insertModernError;
        }
      }
      
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
          .insert([{ 
            role_name: newRoleName.trim(),
            clinic_id: profile?.clinic_id,
            is_default: false,
          }])
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
          .insert([{ 
            name: newRoleName.trim(),
            clinic_id: profile?.clinic_id,
            is_system_default: false,
          }])
          .select('id, name, is_system_default, clinic_id')
          .single();

        if (error) throw error;
        createdRole = data as Role;
      }

      setRoles([...roles, createdRole]);
      setNewRoleName('');
      setIsAddingRole(false);
      setSelectedRole(createdRole);
      toast.success('Role created successfully');
    } catch (err: any) {
      toast.error('Failed to create role: ' + err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff & Roles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage team members and their access permissions</p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-medium">
            <button className="px-4 py-2 text-gray-500 rounded-md hover:text-gray-900">Team</button>
            <button className="px-4 py-2 bg-white text-indigo-600 shadow-sm rounded-md">Roles & Permissions</button>
          </div>
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus size={20} />
            <span>Add Staff</span>
          </button>
        </div>
      </div>

      <div className="flex gap-6 h-[calc(100vh-12rem)] min-h-[500px]">
        {/* Sidebar - Roles List */}
        <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
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
              roles.map(role => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors hover:bg-indigo-50 ${
                    selectedRole?.id === role.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="capitalize">{role.name.replace('_', ' ')}</span>
                    {role.is_system_default && (
                      <Lock size={12} className="text-gray-400" />
                    )}
                  </div>
                </button>
              ))
            )}
            
            {isAddingRole ? (
              <div className="pt-2 px-2 pb-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Role Name..."
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddRole()}
                  className="w-full text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 p-2 border"
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={handleAddRole} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">Save</button>
                  <button onClick={() => setIsAddingRole(false)} className="text-xs text-gray-500 px-2 py-1">Cancel</button>
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

        {/* Main Content - Permissions */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {selectedRole ? (
            <>
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 capitalize flex items-center gap-3">
                  Permissions for: {selectedRole.name.replace('_', ' ')}
                  {selectedRole.is_system_default && (
                    <span className="text-xs font-normal bg-gray-100 text-gray-500 px-2 py-1 rounded-full flex items-center gap-1">
                      <Lock size={10} /> System Default
                    </span>
                  )}
                </h2>
                <button 
                  onClick={savePermissions}
                  disabled={saving}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6 max-w-2xl">
                  {AVAILABLE_PERMISSIONS.map(perm => {
                    const isActive = permissions[perm.key]?.can_read || false;
                    return (
                      <div key={perm.key} className="flex items-center justify-between pb-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 p-2 rounded-lg transition-colors">
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
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Select a role to view permissions
            </div>
          )}
        </div>
      </div>
    </div>
  );
}