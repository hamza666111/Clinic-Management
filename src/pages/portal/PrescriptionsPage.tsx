import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Eye, Trash2, FileText, PlusCircle, CalendarRange, CheckCircle2, Clock, AlertTriangle, Printer, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Prescription, Patient, Medicine, PrescriptionMedicine } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { addDays, format } from 'date-fns';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import MedicineRow from '../../components/portal/MedicineRow';
import { useServices } from '../../hooks/useServices';
import { useMedicineTypes } from '../../hooks/useMedicineTypes';
import { printDocument, downloadAsPDF } from '../../lib/printUtils';
import PrintDocument from '../../components/portal/PrintDocument';

const emptyMed = (): PrescriptionMedicine => ({
  medicine_name: '',
  medicine_type: '',
  strength: '',
  dose_quantity: '',
  frequency: '',
  duration: '',
  special_instructions: '',
});

const getTodayIsoDate = () => format(new Date(), 'yyyy-MM-dd');

const extractDurationDays = (duration: string) => {
  const match = duration.trim().match(/^(\d+)\s*days?/i);
  if (!match) return null;
  const days = Number(match[1]);
  return Number.isFinite(days) && days > 0 ? days : null;
};

const derivePrescriptionDatesFromMedicines = (medicines: PrescriptionMedicine[]) => {
  const startDate = getTodayIsoDate();
  const durationDays = medicines
    .map((medicine) => extractDurationDays(medicine.duration))
    .filter((days): days is number => days !== null);

  if (durationDays.length === 0) {
    return { startDate, endDate: '' };
  }

  const maxDays = Math.max(...durationDays);
  return {
    startDate,
    endDate: format(addDays(new Date(startDate), maxDays), 'yyyy-MM-dd'),
  };
};

function rxStatus(start_date: string | null, end_date: string | null) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (!start_date && !end_date) return null;
  const start = start_date ? new Date(start_date) : null;
  const end = end_date ? new Date(end_date) : null;
  if (end && end < today) return 'expired';
  if (start && start > today) return 'upcoming';
  return 'active';
}

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  active: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  upcoming: { label: 'Upcoming', cls: 'bg-sky-100 text-sky-700', icon: <Clock className="w-3 h-3" /> },
  expired: { label: 'Expired', cls: 'bg-red-100 text-red-600', icon: <AlertTriangle className="w-3 h-3" /> },
};

export default function PrescriptionsPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const { serviceNames } = useServices(profile?.clinic_id);
  const printRef = useRef<HTMLDivElement>(null);

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const { medicineTypes, addMedicineType } = useMedicineTypes(
    medicines.map((medicine) => medicine.medicine_type)
  );
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [showAddType, setShowAddType] = useState(false);
  const [viewPrescription, setViewPrescription] = useState<Prescription | null>(null);
  const [deletePrescription, setDeletePrescription] = useState<Prescription | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingType, setSavingType] = useState(false);
  const [newMedicineType, setNewMedicineType] = useState('');

  const buildInitialPrescriptionForm = () => ({
    patient_id: '',
    doctor_id: '',
    treatments: '',
    notes: '',
    start_date: getTodayIsoDate(),
    end_date: '',
    medicines: [emptyMed()],
  });

  const [form, setForm] = useState(buildInitialPrescriptionForm);

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('prescriptions')
      .select('*, patient:patients(name, contact), doctor:users_profile!doctor_id(name)')
      .order('created_at', { ascending: false });
    if (profile?.role === 'doctor') q = q.eq('doctor_id', profile.id);
    if (search) q = q.ilike('treatments', `%${search}%`);
    const { data } = await q;
    setPrescriptions((data || []) as unknown as Prescription[]);
    setLoading(false);
  }, [profile, search]);

  useEffect(() => { fetchPrescriptions(); }, [fetchPrescriptions]);

  useEffect(() => {
    const cid = profile?.role !== 'admin' && profile?.clinic_id ? profile.clinic_id : null;
    const pQ = cid
      ? supabase.from('patients').select('id, name, clinic_id, doctor_id').eq('clinic_id', cid).order('name')
      : supabase.from('patients').select('id, name, clinic_id, doctor_id').order('name');
    const dQ = cid ? supabase.from('users_profile').select('id, name').eq('role', 'doctor').eq('clinic_id', cid).order('name') : supabase.from('users_profile').select('id, name').eq('role', 'doctor').order('name');
    pQ.then(({ data }) => setPatients(data || []));
    supabase.from('medicines').select('*').order('medicine_name').then(({ data }) => setMedicines(data || []));
    dQ.then(({ data }) => setDoctors(data || []));
  }, [profile]);

  const addMedicineRow = () => setForm(f => {
    const medicines = [...f.medicines, emptyMed()];
    const { startDate, endDate } = derivePrescriptionDatesFromMedicines(medicines);
    return { ...f, medicines, start_date: startDate, end_date: endDate };
  });

  const removeMedicineRow = (i: number) => setForm(f => {
    const medicines = f.medicines.filter((_, idx) => idx !== i);
    const { startDate, endDate } = derivePrescriptionDatesFromMedicines(medicines);
    return { ...f, medicines, start_date: startDate, end_date: endDate };
  });

  const updateMedicine = (i: number, field: keyof PrescriptionMedicine, value: string) => {
    setForm(f => {
      const meds = [...f.medicines];
      meds[i] = { ...meds[i], [field]: value };
      const { startDate, endDate } = derivePrescriptionDatesFromMedicines(meds);
      return { ...f, medicines: meds, start_date: startDate, end_date: endDate };
    });
  };

  const handleSelectMedicine = (i: number, medicine: Medicine) => {
    setForm(f => {
      const meds = [...f.medicines];
      meds[i] = {
        medicine_name: medicine.medicine_name,
        medicine_type: medicine.medicine_type,
        strength: medicine.strength,
        dose_quantity: meds[i].dose_quantity || '',
        frequency: meds[i].frequency || '',
        duration: meds[i].duration || '',
        special_instructions: medicine.default_dosage || meds[i].special_instructions || '',
      };
      const { startDate, endDate } = derivePrescriptionDatesFromMedicines(meds);
      return { ...f, medicines: meds, start_date: startDate, end_date: endDate };
    });
  };

  const handleMedicineNameChange = (i: number, value: string) => {
    updateMedicine(i, 'medicine_name', value);

    if (!value.trim() || value === '__custom__') return;

    const normalized = value.trim().toLowerCase();
    const exactMatch = medicines.find(m =>
      m.medicine_name.toLowerCase() === normalized ||
      `${m.medicine_name} (${m.strength}) - ${m.medicine_type}`.toLowerCase() === normalized
    );

    if (exactMatch) {
      handleSelectMedicine(i, exactMatch);
    }
  };

  const treatmentMatch = serviceNames.find(
    service => service.toLowerCase() === form.treatments.trim().toLowerCase()
  ) || '';
  const isCustomTreatment = form.treatments === '__custom__' || (!!form.treatments && !treatmentMatch);

  const handleTreatmentSelect = (selected: string) => {
    if (selected === '__custom__') {
      setForm(prev => ({ ...prev, treatments: '__custom__' }));
      return;
    }
    setForm(prev => ({ ...prev, treatments: selected }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient_id) { toast.error('Please select a patient.'); return; }
    setSaving(true);
    const cleanedMeds = form.medicines
      .filter(m => m.medicine_name.trim())
      .map(m => ({
        ...m,
        dose_quantity: m.dose_quantity === '__custom__' ? '' : m.dose_quantity,
        duration: m.duration === '__custom__' ? '' : m.duration,
        special_instructions: m.special_instructions === '__custom__' ? '' : m.special_instructions,
      }));
    const { error } = await supabase.from('prescriptions').insert({
      patient_id: form.patient_id,
      doctor_id: (profile?.role === 'admin' || profile?.role === 'clinic_admin') ? (form.doctor_id || profile?.id) : profile?.id,
      treatments: form.treatments,
      medicines: cleanedMeds,
      notes: form.notes,
      start_date: form.start_date || getTodayIsoDate(),
      end_date: form.end_date || null,
    });
    setSaving(false);
    if (error) { toast.error('Failed to save prescription.'); return; }
    toast.success('Prescription saved.');
    setShowForm(false);
    setForm(buildInitialPrescriptionForm());
    fetchPrescriptions();
  };

  const handleDelete = async () => {
    if (!deletePrescription) return;
    await supabase.from('prescriptions').delete().eq('id', deletePrescription.id);
    toast.success('Prescription deleted.');
    setDeletePrescription(null);
    fetchPrescriptions();
  };

  const handleAddType = async () => {
    setSavingType(true);
    const result = await addMedicineType(newMedicineType, profile?.id || null);
    setSavingType(false);

    if (!result.ok) {
      if (result.reason === 'empty') {
        toast.error('Medicine type is required.');
        return;
      }

      if (result.reason === 'exists') {
        toast.error('Medicine type already exists.');
        return;
      }

      toast.error('Failed to add medicine type.');
      return;
    }

    const addedType = result.type || newMedicineType.trim();
    setForm((prev) => ({
      ...prev,
      medicines: prev.medicines.map((medicine, index) =>
        index === prev.medicines.length - 1 && !medicine.medicine_type
          ? { ...medicine, medicine_type: addedType }
          : medicine
      ),
    }));
    setNewMedicineType('');
    setShowAddType(false);
    toast.success('Medicine type added.');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search prescriptions..." className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 w-60 bg-white" />
        </div>
        <button
          onClick={() => {
            setForm(buildInitialPrescriptionForm());
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Prescription
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Treatments</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Doctor</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Period</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">Status</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50"><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : prescriptions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-400"><FileText className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No prescriptions found</p></td></tr>
              ) : prescriptions.map((rx, i) => {
                const status = rxStatus(rx.start_date, rx.end_date);
                const badge = status ? STATUS_BADGE[status] : null;
                return (
                  <motion.tr key={rx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 text-sm">{(rx.patient as unknown as { name: string })?.name}</p>
                      <p className="text-xs text-gray-500">{(rx.patient as unknown as { contact: string })?.contact}</p>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell text-sm text-gray-700 max-w-xs truncate">{rx.treatments || '—'}</td>
                    <td className="px-5 py-4 hidden sm:table-cell text-sm text-gray-700">{(rx.doctor as unknown as { name: string })?.name || '—'}</td>
                    <td className="px-5 py-4 hidden lg:table-cell text-sm text-gray-500">
                      <div className="flex items-center gap-1 text-xs">
                        <CalendarRange className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{rx.start_date ? format(new Date(rx.start_date), 'MMM d') : '—'}</span>
                        <span className="text-gray-300">→</span>
                        <span>{rx.end_date ? format(new Date(rx.end_date), 'MMM d, yyyy') : '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden xl:table-cell">
                      {badge ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
                          {badge.icon}{badge.label}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setViewPrescription(rx)} className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                        {profile?.role !== 'receptionist' && (
                          <button onClick={() => setDeletePrescription(rx)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Prescription Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Prescription" size="xl">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Patient *</label>
              <select
                required
                value={form.patient_id}
                onChange={e => {
                  const patientId = e.target.value;
                  const selectedPatient = patients.find(p => p.id === patientId);
                  setForm(prev => ({
                    ...prev,
                    patient_id: patientId,
                    doctor_id: selectedPatient?.doctor_id || '',
                  }));
                }}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
              >
                <option value="">Select Patient</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {(profile?.role === 'admin' || profile?.role === 'clinic_admin') ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Doctor</label>
                <select value={form.doctor_id} onChange={e => setForm({...form, doctor_id: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm">
                  <option value="">Select Doctor</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Doctor</label>
                <div className="w-full px-3.5 py-2.5 border border-gray-100 rounded-xl bg-gray-50 text-sm text-gray-700 font-medium">
                  {profile?.name || '—'}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Treatments / Services</label>
            <div className="space-y-2">
              <select
                value={treatmentMatch || (isCustomTreatment ? '__custom__' : '')}
                onChange={e => handleTreatmentSelect(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm bg-white"
              >
                <option value="">Select treatment...</option>
                {serviceNames.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="__custom__">Custom treatment...</option>
              </select>
              {isCustomTreatment && (
                <input
                  value={form.treatments === '__custom__' ? '' : form.treatments}
                  onChange={e => setForm({ ...form, treatments: e.target.value })}
                  placeholder="Type custom treatment..."
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
                />
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Medicines</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddType(true)}
                  className="flex items-center gap-1.5 text-sky-600 text-sm hover:text-sky-700 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" /> Add Type
                </button>
                <button
                  type="button"
                  onClick={addMedicineRow}
                  className="flex items-center gap-1.5 text-sky-600 text-sm hover:text-sky-700 transition-colors font-medium"
                >
                  <PlusCircle className="w-4 h-4" /> Add Medicine
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {form.medicines.map((med, i) => (
                <MedicineRow
                  key={i}
                  index={i}
                  med={med}
                  medicines={medicines}
                  medicineTypes={medicineTypes}
                  showRemove={form.medicines.length > 1}
                  onChange={(field, value) => {
                    if (field === 'medicine_name') {
                      handleMedicineNameChange(i, value);
                    } else {
                      updateMedicine(i, field, value);
                    }
                  }}
                  onRemove={() => removeMedicineRow(i)}
                  onSelectMedicine={medicine => handleSelectMedicine(i, medicine)}
                />
              ))}
            </div>
          </div>

          <Modal
            isOpen={showAddType}
            onClose={() => setShowAddType(false)}
            title="Add Medicine Type"
            size="md"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Type Name *</label>
                <input
                  required
                  value={newMedicineType}
                  onChange={(e) => setNewMedicineType(e.target.value)}
                  placeholder="e.g., Lozenge"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddType(false)}
                  className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { void handleAddType(); }}
                  disabled={savingType}
                  className="px-6 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium disabled:opacity-60 flex items-center gap-2"
                >
                  {savingType && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Add Type
                </button>
              </div>
            </div>
          </Modal>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date (Auto)</label>
              <input type="date" value={form.start_date} readOnly className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-700 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date (Auto)</label>
              <input type="date" value={form.end_date} readOnly className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-700 cursor-not-allowed" />
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Start date is always today. End date is calculated from selected medicine duration days.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm resize-none" placeholder="Additional instructions or notes..." />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium disabled:opacity-60 flex items-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Save Prescription
            </button>
          </div>
        </form>
      </Modal>

      {/* View Prescription Modal */}
      <Modal isOpen={!!viewPrescription} onClose={() => setViewPrescription(null)} title="Prescription Details" size="lg">
        {viewPrescription && (
          <>
            <div ref={printRef} className="absolute -left-[9999px] opacity-0 pointer-events-none">
              <PrintDocument prescription={viewPrescription} />
            </div>
            <div className="space-y-5">
            {(() => {
              const status = rxStatus(viewPrescription.start_date, viewPrescription.end_date);
              const badge = status ? STATUS_BADGE[status] : null;
              return (
                <div className="bg-sky-50 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap justify-between gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Patient</p>
                      <p className="font-semibold text-gray-900">{(viewPrescription.patient as unknown as { name: string })?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Doctor</p>
                      <p className="font-semibold text-gray-900">{(viewPrescription.doctor as unknown as { name: string })?.name || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Issued</p>
                      <p className="font-semibold text-gray-900">{format(new Date(viewPrescription.created_at), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  {(viewPrescription.start_date || viewPrescription.end_date) && (
                    <div className="flex items-center gap-3 pt-2 border-t border-sky-100">
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarRange className="w-4 h-4 text-sky-500" />
                        <span className="text-gray-700">
                          <span className="font-medium">{viewPrescription.start_date ? format(new Date(viewPrescription.start_date), 'MMM d, yyyy') : 'No start'}</span>
                          <span className="text-gray-400 mx-2">→</span>
                          <span className="font-medium">{viewPrescription.end_date ? format(new Date(viewPrescription.end_date), 'MMM d, yyyy') : 'No end'}</span>
                        </span>
                      </div>
                      {badge && (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ml-auto ${badge.cls}`}>
                          {badge.icon}{badge.label}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {viewPrescription.treatments && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Treatments</p>
                <p className="text-sm text-gray-800 bg-gray-50 rounded-xl px-4 py-3 whitespace-pre-wrap">{viewPrescription.treatments}</p>
              </div>
            )}

            {viewPrescription.medicines?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Medicines</p>
                <div className="space-y-3">
                  {viewPrescription.medicines.map((med, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{med.medicine_name}</p>
                          {med.strength && <p className="text-xs text-gray-500 mt-0.5">{med.strength}</p>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {med.medicine_type && (
                            <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">{med.medicine_type}</span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mt-3">
                        {med.dose_quantity && (
                          <div className="flex gap-2">
                            <span className="text-xs text-gray-400 w-20 shrink-0">Dose</span>
                            <span className="text-xs text-gray-800 font-medium">{med.dose_quantity}</span>
                          </div>
                        )}
                        {med.frequency && (
                          <div className="flex gap-2">
                            <span className="text-xs text-gray-400 w-20 shrink-0">Frequency</span>
                            <span className="text-xs text-gray-800 font-medium">{med.frequency}</span>
                          </div>
                        )}
                        {med.duration && (
                          <div className="flex gap-2">
                            <span className="text-xs text-gray-400 w-20 shrink-0">Duration</span>
                            <span className="text-xs text-gray-800 font-medium">{med.duration}</span>
                          </div>
                        )}
                        {med.special_instructions && (
                          <div className="flex gap-2">
                            <span className="text-xs text-gray-400 w-20 shrink-0">Instructions</span>
                            <span className="text-xs text-emerald-700 font-medium">{med.special_instructions}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewPrescription.notes && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</p>
                <p className="text-sm text-gray-800 bg-gray-50 rounded-xl px-4 py-3">{viewPrescription.notes}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
              <button
                onClick={() => printDocument(printRef.current, `Prescription-${viewPrescription.id.slice(0, 8)}`)}
                className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
              <button
                onClick={() => downloadAsPDF(printRef.current, `Prescription-${viewPrescription.id.slice(0, 8)}.pdf`)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-700 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" /> Save PDF
              </button>
            </div>
          </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deletePrescription}
        onConfirm={handleDelete}
        onCancel={() => setDeletePrescription(null)}
        title="Delete Prescription"
        message="Are you sure you want to delete this prescription?"
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
