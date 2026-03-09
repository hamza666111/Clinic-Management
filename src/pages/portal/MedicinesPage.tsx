import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Trash2, Pill, Edit2, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Medicine, MedicineType } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const MEDICINE_TYPES: MedicineType[] = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Suspension',
  'Mouthwash',
  'Gel',
  'Cream',
  'Drops',
  'Injection',
  'Powder',
  'Spray',
  'Ointment',
  'Other',
];

const TYPE_COLORS: Record<string, string> = {
  Tablet: 'bg-blue-50 text-blue-600',
  Capsule: 'bg-purple-50 text-purple-600',
  Syrup: 'bg-amber-50 text-amber-600',
  Suspension: 'bg-orange-50 text-orange-600',
  Mouthwash: 'bg-cyan-50 text-cyan-600',
  Gel: 'bg-emerald-50 text-emerald-600',
  Cream: 'bg-lime-50 text-lime-600',
  Drops: 'bg-sky-50 text-sky-600',
  Injection: 'bg-red-50 text-red-600',
  Powder: 'bg-yellow-50 text-yellow-600',
  Spray: 'bg-teal-50 text-teal-600',
  Ointment: 'bg-green-50 text-green-600',
  Other: 'bg-gray-50 text-gray-600',
};

export default function MedicinesPage() {
  const toast = useToast();
  const { session, profile } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editMed, setEditMed] = useState<Medicine | null>(null);
  const [deleteMed, setDeleteMed] = useState<Medicine | null>(null);
  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState({
    medicine_name: '',
    medicine_type: 'Tablet' as MedicineType,
    strength: '',
    form: '',
    default_dosage: '',
  });

  const [editForm, setEditForm] = useState({
    medicine_name: '',
    medicine_type: 'Tablet' as MedicineType,
    strength: '',
    form: '',
    default_dosage: '',
  });

  const fetchMeds = async () => {
    setLoading(true);
    let q = supabase.from('medicines').select('*').order('medicine_name');
    if (search) q = q.ilike('medicine_name', `%${search}%`);
    if (filterType) q = q.eq('medicine_type', filterType);
    const { data } = await q;
    setMedicines(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMeds();
  }, [search, filterType]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('medicines').insert({
      medicine_name: createForm.medicine_name.trim(),
      medicine_type: createForm.medicine_type,
      strength: createForm.strength.trim(),
      form: createForm.form.trim(),
      default_dosage: createForm.default_dosage.trim(),
      clinic_id: profile?.clinic_id || null,
      created_by: session?.user?.id || null,
    });
    setSaving(false);
    if (error) {
      toast.error('Medicine already exists or failed to add.');
      return;
    }
    toast.success('Medicine added successfully.');
    setShowCreate(false);
    setCreateForm({
      medicine_name: '',
      medicine_type: 'Tablet',
      strength: '',
      form: '',
      default_dosage: '',
    });
    fetchMeds();
  };

  const openEdit = (med: Medicine) => {
    setEditMed(med);
    setEditForm({
      medicine_name: med.medicine_name,
      medicine_type: med.medicine_type,
      strength: med.strength,
      form: med.form,
      default_dosage: med.default_dosage,
    });
    setShowEdit(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMed) return;
    setSaving(true);
    const { error } = await supabase
      .from('medicines')
      .update({
        medicine_name: editForm.medicine_name.trim(),
        medicine_type: editForm.medicine_type,
        strength: editForm.strength.trim(),
        form: editForm.form.trim(),
        default_dosage: editForm.default_dosage.trim(),
      })
      .eq('id', editMed.id);
    setSaving(false);
    if (error) {
      toast.error('Failed to update medicine.');
      return;
    }
    toast.success('Medicine updated successfully.');
    setShowEdit(false);
    fetchMeds();
  };

  const handleDelete = async () => {
    if (!deleteMed) return;
    await supabase.from('medicines').delete().eq('id', deleteMed.id);
    toast.success('Medicine deleted.');
    setDeleteMed(null);
    fetchMeds();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medicines..."
              className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 w-52 bg-white"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
          >
            <option value="">All Types</option>
            {MEDICINE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-500 px-2">{medicines.length} medicines</span>
        </div>
        <button
          onClick={() => {
            setCreateForm({
              medicine_name: '',
              medicine_type: 'Tablet',
              strength: '',
              form: '',
              default_dosage: '',
            });
            setShowCreate(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Medicine
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 p-5 h-40 animate-pulse"
            />
          ))
        ) : medicines.length === 0 ? (
          <div className="col-span-full text-center py-20 text-gray-400">
            <Pill className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No medicines found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          medicines.map((med, i) => (
            <motion.div
              key={med.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 bg-gradient-to-br from-sky-400 to-cyan-600 rounded-xl flex items-center justify-center text-white shrink-0">
                    <Pill className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">
                      {med.medicine_name}
                    </p>
                    {med.strength && (
                      <p className="text-xs text-gray-500 truncate">{med.strength}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => openEdit(med)}
                    title="Edit"
                    className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteMed(med)}
                    title="Delete"
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span
                  className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                    TYPE_COLORS[med.medicine_type] || 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {med.medicine_type}
                </span>
                {med.form && (
                  <p className="text-xs text-gray-500 line-clamp-1">{med.form}</p>
                )}
                {med.default_dosage && (
                  <p className="text-xs text-gray-600 font-medium line-clamp-2">
                    {med.default_dosage}
                  </p>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add New Medicine"
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Medicine Name *
            </label>
            <input
              required
              value={createForm.medicine_name}
              onChange={(e) =>
                setCreateForm({ ...createForm, medicine_name: e.target.value })
              }
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
              placeholder="e.g., Amoxicillin"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Type *
              </label>
              <select
                value={createForm.medicine_type}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    medicine_type: e.target.value as MedicineType,
                  })
                }
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
              >
                {MEDICINE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Strength
              </label>
              <input
                value={createForm.strength}
                onChange={(e) =>
                  setCreateForm({ ...createForm, strength: e.target.value })
                }
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
                placeholder="250mg, 5ml, etc."
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Form <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              value={createForm.form}
              onChange={(e) => setCreateForm({ ...createForm, form: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
              placeholder="Additional form notes"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Default Dosage <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={createForm.default_dosage}
              onChange={(e) =>
                setCreateForm({ ...createForm, default_dosage: e.target.value })
              }
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
              placeholder="e.g., Take 1 capsule twice daily after meals"
              rows={2}
            />
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
              {saving && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Add Medicine
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title={`Edit: ${editMed?.medicine_name}`}
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Medicine Name *
            </label>
            <input
              required
              value={editForm.medicine_name}
              onChange={(e) =>
                setEditForm({ ...editForm, medicine_name: e.target.value })
              }
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Type *
              </label>
              <select
                value={editForm.medicine_type}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    medicine_type: e.target.value as MedicineType,
                  })
                }
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
              >
                {MEDICINE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Strength
              </label>
              <input
                value={editForm.strength}
                onChange={(e) => setEditForm({ ...editForm, strength: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
                placeholder="250mg, 5ml, etc."
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Form <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              value={editForm.form}
              onChange={(e) => setEditForm({ ...editForm, form: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
              placeholder="Additional form notes"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Default Dosage <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={editForm.default_dosage}
              onChange={(e) =>
                setEditForm({ ...editForm, default_dosage: e.target.value })
              }
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
              placeholder="e.g., Take 1 capsule twice daily after meals"
              rows={2}
            />
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
              {saving && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteMed}
        onConfirm={handleDelete}
        onCancel={() => setDeleteMed(null)}
        title="Delete Medicine"
        message={`Delete "${deleteMed?.medicine_name}" from the medicines list? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
