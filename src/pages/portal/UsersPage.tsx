import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, UserCog, RefreshCw, Eye, EyeOff, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UserProfile, Clinic } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-rose-100 text-rose-700',
  clinic_admin: 'bg-amber-100 text-amber-700',
  doctor: 'bg-sky-100 text-sky-700',
  receptionist: 'bg-emerald-100 text-emerald-700',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  clinic_admin: 'Clinic Admin',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
};

const ALL_ROLES = ['admin', 'clinic_admin', 'doctor', 'receptionist'] as const;
const CLINIC_ROLES = ['clinic_admin', 'doctor', 'receptionist'] as const;

interface CreateFormData {
  name: string;
  email: string;
  password: string;
  role: string;
  clinic_id: string;
}

interface EditFormData {
  name: string;
  role: string;
  clinic_id: string;
  is_active: boolean;
}

const emptyCreate: CreateFormData = { name: '', email: '', password: '', role: 'doctor', clinic_id: '' };
const emptyEdit: EditFormData = { name: '', role: 'doctor', clinic_id: '', is_active: true };

async function callEdgeFunction(action: string, payload: Record<string, unknown>, accessToken: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const res = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': anonKey,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

export default function UsersPage() {
  const { profile: myProfile, session } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const [createForm, setCreateForm] = useState<CreateFormData>(emptyCreate);
  const [editForm, setEditForm] = useState<EditFormData>(emptyEdit);

  const isGlobalAdmin = myProfile?.role === 'admin';
  const isClinicAdmin = myProfile?.role === 'clinic_admin';

  const fetchUsers = useCallback(async () => {
    if (!session) {
      console.error('No session available');
      setLoading(false);
      return;
    }

    try {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !currentSession) {
        console.error('Session validation failed:', sessionError);
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      setLoading(true);
      let q = supabase
        .from('users_profile')
        .select('*, clinic:clinics(clinic_name)')
        .order('created_at', { ascending: false });

      if (!isGlobalAdmin && myProfile?.clinic_id) {
        q = q.eq('clinic_id', myProfile.clinic_id);
      }
      if (search) {
        q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      if (filterRole) {
        q = q.eq('role', filterRole);
      }

      const { data, error } = await q;

      if (error) {
        console.error('Error fetching users:', error);
        if (error.message?.includes('Invalid Refresh Token') || error.message?.includes('JWT')) {
          await supabase.auth.signOut();
          return;
        }
        toast.error('Failed to load users.');
      } else {
        setUsers((data as unknown as UserProfile[]) || []);
      }
    } catch (err) {
      console.error('Fetch users exception:', err);
      toast.error('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [search, filterRole, isGlobalAdmin, myProfile?.clinic_id, session]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    supabase
      .from('clinics')
      .select('id, clinic_name')
      .order('clinic_name')
      .then(({ data }) => setClinics(data || []));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!createForm.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!createForm.password || createForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    const assignedClinicId = isClinicAdmin ? myProfile?.clinic_id : (createForm.clinic_id || null);

    if (createForm.role !== 'admin' && !assignedClinicId) {
      toast.error('Please select a clinic for this user');
      return;
    }

    if (!session?.access_token) {
      toast.error('Session expired. Please log in again.');
      return;
    }

    setSaving(true);

    try {
      await callEdgeFunction('create', {
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
        clinic_id: assignedClinicId,
      }, session.access_token);

      toast.success(`User ${createForm.name} created successfully`);
      setShowCreate(false);
      setCreateForm(emptyCreate);
      fetchUsers();
    } catch (err) {
      console.error('User creation error:', err);
      const message = err instanceof Error ? err.message : 'Failed to create user';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (user: UserProfile) => {
    setEditTarget(user);
    setEditForm({
      name: user.name,
      role: user.role,
      clinic_id: user.clinic_id || '',
      is_active: user.is_active ?? true,
    });
    setShowEdit(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    if (!editForm.name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!session?.access_token) {
      toast.error('Session expired. Please log in again.');
      return;
    }

    setSaving(true);

    try {
      await callEdgeFunction('update_profile', {
        user_id: editTarget.id,
        name: editForm.name.trim(),
        role: editForm.role,
        clinic_id: editForm.clinic_id || null,
        is_active: editForm.is_active,
      }, session.access_token);

      toast.success('User updated successfully');
      setShowEdit(false);
      fetchUsers();
    } catch (err) {
      console.error('User update error:', err);
      const message = err instanceof Error ? err.message : 'Failed to update user';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const openPasswordModal = (user: UserProfile) => {
    setEditTarget(user);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (!session?.access_token) {
      toast.error('Session expired. Please log in again.');
      return;
    }

    setSaving(true);

    try {
      await callEdgeFunction('update_password', {
        user_id: editTarget.id,
        password: newPassword,
      }, session.access_token);

      toast.success('Password updated successfully');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (err) {
      console.error('Password update error:', err);
      const message = err instanceof Error ? err.message : 'Failed to update password';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    if (!session?.access_token) {
      toast.error('Session expired. Please log in again.');
      return;
    }

    setSaving(true);

    try {
      await callEdgeFunction('delete', {
        user_id: deleteTarget.id,
      }, session.access_token);

      toast.success('User deleted successfully');
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      console.error('User deletion error:', err);
      const message = err instanceof Error ? err.message : 'Failed to delete user';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const clinicName = (id: string | null) => clinics.find(c => c.id === id)?.clinic_name || '—';

  const allowedRoles = isGlobalAdmin ? ALL_ROLES : CLINIC_ROLES;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage staff accounts and permissions</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Add New User
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            <option value="">All Roles</option>
            {allowedRoles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <button
            onClick={fetchUsers}
            className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <UserCog className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No users found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {users.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-semibold text-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900">{user.name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                      {!user.is_active && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    {user.clinic_id && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {clinicName(user.clinic_id)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(isGlobalAdmin || (isClinicAdmin && user.clinic_id === myProfile?.clinic_id && user.id !== myProfile.id)) && (
                    <>
                      <button
                        onClick={() => openPasswordModal(user)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Change password"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(user)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit user"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(user)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete user"
                        disabled={user.id === myProfile?.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add New User">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
            <input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                required
              >
                {allowedRoles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
            {createForm.role !== 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign Clinic *
                </label>
                <select
                  value={createForm.clinic_id}
                  onChange={(e) => setCreateForm({ ...createForm, clinic_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  required={createForm.role !== 'admin'}
                  disabled={isClinicAdmin}
                >
                  <option value="">Select clinic</option>
                  {clinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.clinic_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 text-sm font-medium disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Create User
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit User">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                required
              >
                {allowedRoles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
            {editForm.role !== 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign Clinic *
                </label>
                <select
                  value={editForm.clinic_id}
                  onChange={(e) => setEditForm({ ...editForm, clinic_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  required={editForm.role !== 'admin'}
                  disabled={isClinicAdmin}
                >
                  <option value="">Select clinic</option>
                  {clinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.clinic_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={editForm.is_active}
              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
              className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              Active User
            </label>
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowEdit(false)}
              className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 text-sm font-medium disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Change Password">
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <p className="text-sm text-gray-600">
            Change password for <span className="font-medium">{editTarget?.name}</span>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                required
                minLength={6}
                placeholder="Minimum 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowPasswordModal(false)}
              className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 text-sm font-medium disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Update Password
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete User"
        message={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone and will permanently remove the user from the system.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
