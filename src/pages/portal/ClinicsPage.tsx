import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Building2, Phone, Mail, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Clinic } from '../../lib/types';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

export default function ClinicsPage() {
  const toast = useToast();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editClinic, setEditClinic] = useState<Clinic | null>(null);
  const [deleteClinic, setDeleteClinic] = useState<Clinic | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ clinic_name: '', address: '', phone: '', email: '' });

  const fetchClinics = async () => {
    setLoading(true);
    const { data } = await supabase.from('clinics').select('*').order('clinic_name');
    setClinics(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchClinics(); }, []);

  const openAdd = () => { setEditClinic(null); setForm({ clinic_name: '', address: '', phone: '', email: '' }); setShowForm(true); };
  const openEdit = (clinic: Clinic) => { setEditClinic(clinic); setForm({ clinic_name: clinic.clinic_name, address: clinic.address, phone: clinic.phone, email: clinic.email }); setShowForm(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = editClinic
      ? await supabase.from('clinics').update(form).eq('id', editClinic.id)
      : await supabase.from('clinics').insert(form);
    setSaving(false);
    if (error) { toast.error('Failed to save clinic.'); return; }
    toast.success(editClinic ? 'Clinic updated.' : 'Clinic added.');
    setShowForm(false);
    fetchClinics();
  };

  const handleDelete = async () => {
    if (!deleteClinic) return;
    await supabase.from('clinics').delete().eq('id', deleteClinic.id);
    toast.success('Clinic deleted.');
    setDeleteClinic(null);
    fetchClinics();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-end">
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Clinic
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 h-40 animate-pulse" />)}
        </div>
      ) : clinics.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Building2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p>No clinics added yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clinics.map((clinic, i) => (
            <motion.div
              key={clinic.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-sky-400 to-cyan-600 rounded-2xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(clinic)} className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteClinic(clinic)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 text-lg mb-3">{clinic.clinic_name}</h3>
              <div className="space-y-2">
                {clinic.address && <div className="flex items-start gap-2 text-sm text-gray-600"><MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><span>{clinic.address}</span></div>}
                {clinic.phone && <div className="flex items-center gap-2 text-sm text-gray-600"><Phone className="w-4 h-4 text-gray-400 shrink-0" /><span>{clinic.phone}</span></div>}
                {clinic.email && <div className="flex items-center gap-2 text-sm text-gray-600"><Mail className="w-4 h-4 text-gray-400 shrink-0" /><span>{clinic.email}</span></div>}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editClinic ? 'Edit Clinic' : 'Add Clinic'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Clinic Name *</label>
            <input required value={form.clinic_name} onChange={e => setForm({...form, clinic_name: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm" placeholder="e.g. PearlSmile Main Branch" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
            <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm" placeholder="Full clinic address" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm" placeholder="+1 (555) 000-0000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm" placeholder="clinic@email.com" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 text-sm font-medium disabled:opacity-60">
              {editClinic ? 'Update Clinic' : 'Add Clinic'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteClinic}
        onConfirm={handleDelete}
        onCancel={() => setDeleteClinic(null)}
        title="Delete Clinic"
        message={`Delete ${deleteClinic?.clinic_name}? This may affect associated patients and appointments.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
