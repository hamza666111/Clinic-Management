import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Search, Eye, Trash2, Receipt, Printer, X, PlusCircle, UserPlus, ChevronDown, Pencil, DollarSign, CheckCircle2, Download, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Invoice, Patient, Clinic, InvoiceItem, Prescription } from '../../lib/types';
import { formatPKR } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { useServices } from '../../hooks/useServices';
import { format } from 'date-fns';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import PrintDocument from '../../components/portal/PrintDocument';
import { printDocument as printDoc, downloadAsPDF } from '../../lib/printUtils';

const STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-sky-100 text-sky-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid', paid: 'Paid', partial: 'Partial', cancelled: 'Cancelled',
};

export default function BillingPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string; clinic_id: string | null }>>([]);

  const [showForm, setShowForm] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [editPaymentInvoice, setEditPaymentInvoice] = useState<Invoice | null>(null);
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  const [paymentForm, setPaymentForm] = useState({ amount_paid: '', status: 'partial' as Invoice['status'] });

  const [form, setForm] = useState({
    patient_id: '',
    clinic_id: '',
    doctor_id: '',
    doctor_fee: '',
    amount_paid: '',
    status: 'unpaid' as Invoice['status'],
    items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }] as InvoiceItem[],
  });

  const [showNewPatient, setShowNewPatient] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({
    name: '',
    contact: '',
    gender: 'male' as 'male' | 'female' | 'other',
    age: '',
    doctor_id: profile?.role === 'doctor' ? profile.id : '',
    clinic_id: profile?.clinic_id || '',
  });

  const pricingClinicId = profile?.role === 'admin'
    ? (form.clinic_id || null)
    : (profile?.clinic_id || form.clinic_id || null);

  const { serviceNames, services, findByName } = useServices(pricingClinicId);

  const [linkedPrescription, setLinkedPrescription] = useState<Prescription | null>(null);
  const [showCombinedPrint, setShowCombinedPrint] = useState(false);

  const [patientPrescriptions, setPatientPrescriptions] = useState<Prescription[]>([]);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState('');
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [showPrintOptions, setShowPrintOptions] = useState(false);

  const handleQuickAddDoctorChange = (doctorId: string) => {
    setNewPatientForm(prev => {
      const selectedDoctor = doctors.find(d => d.id === doctorId);
      return {
        ...prev,
        doctor_id: doctorId,
        clinic_id: selectedDoctor?.clinic_id || prev.clinic_id,
      };
    });
  };

  const handleDoctorChange = (doctorId: string) => {
    setForm(prev => {
      const selectedDoctor = doctors.find(d => d.id === doctorId);
      return {
        ...prev,
        doctor_id: doctorId,
        clinic_id: selectedDoctor?.clinic_id || prev.clinic_id,
      };
    });
  };

  const handleAddPatient = async () => {
    if (!newPatientForm.name.trim()) { toast.error('Patient name is required.'); return; }

    const assignedDoctorId = newPatientForm.doctor_id
      || (profile?.role === 'doctor' ? profile.id : (form.doctor_id || null));

    const selectedDoctorClinicId = doctors.find(d => d.id === assignedDoctorId)?.clinic_id || null;

    const assignedClinicId = newPatientForm.clinic_id
      || selectedDoctorClinicId
      || (profile?.role === 'admin'
        ? (form.clinic_id || null)
        : (profile?.clinic_id || form.clinic_id || null));

    setSavingPatient(true);
    const { data, error } = await supabase.from('patients').insert({
      name: newPatientForm.name.trim(),
      contact: newPatientForm.contact.trim(),
      gender: newPatientForm.gender,
      age: newPatientForm.age ? Number(newPatientForm.age) : null,
      email: '', address: '', medical_history: '', dental_history: '', notes: '',
      clinic_id: assignedClinicId,
      doctor_id: assignedDoctorId,
    }).select('id, name, clinic_id, doctor_id').maybeSingle();
    setSavingPatient(false);
    if (error || !data) { toast.error('Failed to add patient.'); return; }
    const newP = data as Pick<Patient, 'id' | 'name' | 'clinic_id' | 'doctor_id'>;
    setPatients(prev => [newP as Patient, ...prev]);
    setForm(f => ({
      ...f,
      patient_id: newP.id,
      clinic_id: assignedClinicId || f.clinic_id,
      doctor_id: (assignedDoctorId || f.doctor_id || ''),
    }));
    setNewPatientForm({
      name: '',
      contact: '',
      gender: 'male',
      age: '',
      doctor_id: profile?.role === 'doctor' ? profile.id : '',
      clinic_id: profile?.clinic_id || '',
    });
    setShowNewPatient(false);
    toast.success(`Patient "${newP.name}" added and selected.`);
  };

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('invoices')
      .select('*, patient:patients(name, contact), doctor:users_profile!doctor_id(name), clinic:clinics(clinic_name, address, phone)')
      .order('created_at', { ascending: false });
    if (profile?.role === 'doctor') q = q.eq('doctor_id', profile.id);
    const { data } = await q;
    let filtered = (data || []) as unknown as Invoice[];
    if (search) filtered = filtered.filter(inv => (inv.patient as unknown as { name: string })?.name?.toLowerCase().includes(search.toLowerCase()));
    setInvoices(filtered);
    setLoading(false);
  }, [profile, search]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => {
    const cid = profile?.role !== 'admin' && profile?.clinic_id ? profile.clinic_id : null;
    const pQ = cid
      ? supabase.from('patients').select('id, name, clinic_id, doctor_id').eq('clinic_id', cid).order('name')
      : supabase.from('patients').select('id, name, clinic_id, doctor_id').order('name');
    const dQ = cid
      ? supabase.from('users_profile').select('id, name, clinic_id').eq('role', 'doctor').eq('clinic_id', cid).order('name')
      : supabase.from('users_profile').select('id, name, clinic_id').eq('role', 'doctor').order('name');
    pQ.then(({ data }) => setPatients(data || []));
    supabase.from('clinics').select('*').then(({ data }) => setClinics(data || []));
    dQ.then(({ data }) => setDoctors(data || []));
  }, [profile]);

  useEffect(() => {
    if (!form.patient_id) {
      setPatientPrescriptions([]);
      setSelectedPrescriptionId('');
      return;
    }
    supabase
      .from('prescriptions')
      .select('*, doctor:users_profile!doctor_id(name)')
      .eq('patient_id', form.patient_id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setPatientPrescriptions((data || []) as unknown as Prescription[]);
      });
  }, [form.patient_id]);

  const updateItem = (i: number, field: keyof InvoiceItem, value: string | number) => {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        items[i].total = (Number(field === 'quantity' ? value : items[i].quantity)) * (Number(field === 'unit_price' ? value : items[i].unit_price));
      }
      if (field === 'description') {
        const svc = findByName(String(value));
        if (svc) {
          items[i].unit_price = svc.effective_price;
          items[i].total = svc.effective_price * items[i].quantity;
        }
      }
      return { ...f, items };
    });
  };

  const subtotal = useMemo(() => form.items.reduce((a, item) => a + item.total, 0), [form.items]);
  const totalAmount = useMemo(() => subtotal + Number(form.doctor_fee || 0), [subtotal, form.doctor_fee]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient_id) { toast.error('Please select a patient.'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('invoices').insert({
      patient_id: form.patient_id,
      clinic_id: form.clinic_id || null,
      doctor_id: (profile?.role === 'admin' || profile?.role === 'clinic_admin') ? (form.doctor_id || profile?.id) : profile?.id,
      items: form.items.filter(i => i.description && i.description !== '__custom__'),
      doctor_fee: Number(form.doctor_fee || 0),
      total_amount: totalAmount,
      amount_paid: form.status === 'partial' ? Number(form.amount_paid || 0) : form.status === 'paid' ? totalAmount : 0,
      status: form.status,
    }).select('*, patient:patients(name, contact), doctor:users_profile!doctor_id(name), clinic:clinics(clinic_name, address, phone)').maybeSingle();
    setSaving(false);
    if (error || !data) { toast.error('Failed to save invoice.'); return; }
    toast.success('Invoice created.');
    setShowForm(false);
    setShowNewPatient(false);

    const newInvoice = data as unknown as Invoice;
    setCreatedInvoice(newInvoice);

    if (selectedPrescriptionId) {
      const { data: rxData } = await supabase
        .from('prescriptions')
        .select('*, patient:patients(name, contact), doctor:users_profile!doctor_id(name)')
        .eq('id', selectedPrescriptionId)
        .maybeSingle();
      setLinkedPrescription(rxData as unknown as Prescription || null);
    } else {
      setLinkedPrescription(null);
    }

    setShowPrintOptions(true);
    setForm({ patient_id: '', clinic_id: '', doctor_id: '', doctor_fee: '', amount_paid: '', status: 'unpaid', items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }] });
    setSelectedPrescriptionId('');
    fetchInvoices();
  };

  const handleDelete = async () => {
    if (!deleteInvoice) return;
    await supabase.from('invoices').delete().eq('id', deleteInvoice.id);
    toast.success('Invoice deleted.');
    setDeleteInvoice(null);
    fetchInvoices();
  };

  const openEditPayment = (inv: Invoice) => {
    setEditPaymentInvoice(inv);
    setPaymentForm({ amount_paid: String(inv.amount_paid ?? 0), status: inv.status });
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPaymentInvoice) return;
    setSavingPayment(true);
    const paid = Number(paymentForm.amount_paid || 0);
    const total = editPaymentInvoice.total_amount;
    let status = paymentForm.status;
    if (status === 'partial' && paid >= total) status = 'paid';
    const updates = { amount_paid: status === 'paid' ? total : status === 'unpaid' || status === 'cancelled' ? 0 : paid, status };
    const { error } = await supabase.from('invoices').update(updates).eq('id', editPaymentInvoice.id);
    setSavingPayment(false);
    if (error) { toast.error('Failed to update payment.'); return; }
    toast.success('Payment updated.');
    setEditPaymentInvoice(null);
    if (viewInvoice?.id === editPaymentInvoice.id) setViewInvoice(i => i ? { ...i, ...updates } : null);
    fetchInvoices();
  };

  const updateStatus = async (id: string, status: Invoice['status']) => {
    const inv = invoices.find(i => i.id === id);
    const updates: Partial<Invoice> = { status };
    if (status === 'paid' && inv) updates.amount_paid = inv.total_amount;
    if (status === 'unpaid' || status === 'cancelled') updates.amount_paid = 0;
    await supabase.from('invoices').update(updates).eq('id', id);
    fetchInvoices();
    if (viewInvoice?.id === id) setViewInvoice(i => i ? { ...i, ...updates } : null);
    toast.success('Status updated.');
  };

  const fetchLinkedPrescription = async (inv: Invoice) => {
    const { data } = await supabase
      .from('prescriptions')
      .select('*, patient:patients(name, contact), doctor:users_profile!doctor_id(name)')
      .eq('patient_id', inv.patient_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLinkedPrescription(data as unknown as Prescription || null);
  };

  const openView = async (inv: Invoice) => {
    setViewInvoice(inv);
    await fetchLinkedPrescription(inv);
  };

  const handlePrint = () => {
    printDoc(printRef.current, `Invoice-${viewInvoice?.id?.slice(0, 8)}`);
  };

  const handleDownloadPDF = () => {
    downloadAsPDF(printRef.current, `Invoice-${viewInvoice?.id?.slice(0, 8)}.pdf`);
  };

  const paymentBalance = useMemo(() =>
    editPaymentInvoice ? Math.max(0, editPaymentInvoice.total_amount - Number(paymentForm.amount_paid || 0)) : 0,
    [editPaymentInvoice, paymentForm.amount_paid]
  );

  const invoiceStats = useMemo(() => ({
    total: invoices.length,
    paid: invoices.filter(i => i.status === 'paid').length,
    unpaid: invoices.filter(i => i.status === 'unpaid').length,
    revenue: invoices.filter(i => i.status === 'paid').reduce((a, i) => a + i.total_amount, 0),
  }), [invoices]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 w-60 bg-white" />
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Invoices', value: invoiceStats.total, color: 'text-gray-900' },
          { label: 'Paid', value: invoiceStats.paid, color: 'text-emerald-700' },
          { label: 'Unpaid', value: invoiceStats.unpaid, color: 'text-amber-700' },
          { label: 'Total Revenue', value: formatPKR(invoiceStats.revenue), color: 'text-sky-700' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Doctor</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Amount</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Date</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50"><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : invoices.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-400"><Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No invoices found</p></td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-900 text-sm">{(inv.patient as unknown as { name: string })?.name}</p>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-sm text-gray-700">{(inv.doctor as unknown as { name: string })?.name || '—'}</td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <p className="text-sm font-semibold text-gray-900">{formatPKR(inv.total_amount)}</p>
                    {inv.status === 'partial' && (
                      <div className="mt-0.5 space-y-0.5">
                        <p className="text-xs text-emerald-600">Paid: {formatPKR(inv.amount_paid)}</p>
                        <p className="text-xs text-amber-600">Left: {formatPKR(Math.max(0, inv.total_amount - inv.amount_paid))}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <select value={inv.status} onChange={e => updateStatus(inv.id, e.target.value as Invoice['status'])} className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[inv.status]}`}>
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                      <option value="partial">Partial</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell text-sm text-gray-500">{format(new Date(inv.created_at), 'MMM d, yyyy')}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openView(inv)} className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" title="View Invoice"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openEditPayment(inv)} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit Payment"><Pencil className="w-4 h-4" /></button>
                      {profile?.role === 'admin' && (
                        <button onClick={() => setDeleteInvoice(inv)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Invoice"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Invoice Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Invoice" size="xl">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Patient *</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewPatient(v => !v);
                    setNewPatientForm(f => ({
                      ...f,
                      doctor_id: f.doctor_id || form.doctor_id || (profile?.role === 'doctor' ? profile.id : ''),
                      clinic_id: f.clinic_id || form.clinic_id || profile?.clinic_id || '',
                    }));
                  }}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${showNewPatient ? 'bg-sky-100 text-sky-700' : 'text-sky-600 hover:bg-sky-50'}`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  New Patient
                  <ChevronDown className={`w-3 h-3 transition-transform ${showNewPatient ? 'rotate-180' : ''}`} />
                </button>
              </div>
              <select
                required
                value={form.patient_id}
                onChange={e => {
                  const patientId = e.target.value;
                  const selectedPatient = patients.find(p => p.id === patientId);
                  setForm(prev => ({
                    ...prev,
                    patient_id: patientId,
                    clinic_id: selectedPatient?.clinic_id || prev.clinic_id,
                    doctor_id: selectedPatient?.doctor_id || prev.doctor_id,
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
                <select value={form.doctor_id} onChange={e => handleDoctorChange(e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm">
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
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Clinic</label>
              <select value={form.clinic_id} onChange={e => setForm({...form, clinic_id: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm">
                <option value="">Select Clinic</option>
                {clinics.map(c => <option key={c.id} value={c.id}>{c.clinic_name}</option>)}
              </select>
            </div>
            {form.patient_id && patientPrescriptions.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Link Prescription (Optional)</label>
                <select value={selectedPrescriptionId} onChange={e => setSelectedPrescriptionId(e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm">
                  <option value="">None</option>
                  {patientPrescriptions.map(rx => (
                    <option key={rx.id} value={rx.id}>
                      {format(new Date(rx.created_at), 'MMM d, yyyy')} - {(rx.doctor as unknown as { name: string })?.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <AnimatePresence>
            {showNewPatient && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <UserPlus className="w-4 h-4 text-sky-600" />
                    <p className="text-sm font-semibold text-sky-800">Quick Add Patient</p>
                    <p className="text-xs text-sky-500 ml-auto">Will be selected automatically</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <input type="text" placeholder="Full name *" value={newPatientForm.name} onChange={e => setNewPatientForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-sky-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white" />
                    </div>
                    <div>
                      <input type="tel" placeholder="Contact number" value={newPatientForm.contact} onChange={e => setNewPatientForm(f => ({ ...f, contact: e.target.value }))} className="w-full px-3 py-2 border border-sky-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white" />
                    </div>
                    <div>
                      <input type="number" placeholder="Age" min="0" max="120" value={newPatientForm.age} onChange={e => setNewPatientForm(f => ({ ...f, age: e.target.value }))} className="w-full px-3 py-2 border border-sky-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white" />
                    </div>
                    <div>
                      <select value={newPatientForm.gender} onChange={e => setNewPatientForm(f => ({ ...f, gender: e.target.value as 'male' | 'female' | 'other' }))} className="w-full px-3 py-2 border border-sky-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white">
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <select
                        value={newPatientForm.doctor_id}
                        onChange={e => handleQuickAddDoctorChange(e.target.value)}
                        disabled={profile?.role === 'doctor'}
                        className="w-full px-3 py-2 border border-sky-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white disabled:bg-sky-100/60"
                      >
                        <option value="">Assign Doctor (Optional)</option>
                        {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <select
                        value={newPatientForm.clinic_id}
                        onChange={e => setNewPatientForm(f => ({ ...f, clinic_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-sky-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                      >
                        <option value="">Assign Clinic (Optional)</option>
                        {clinics.map(c => <option key={c.id} value={c.id}>{c.clinic_name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1 flex items-end">
                      <button type="button" onClick={handleAddPatient} disabled={savingPatient} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium disabled:opacity-60">
                        {savingPatient ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                        Add & Select
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Invoice Items</label>
              <button type="button" onClick={() => setForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit_price: 0, total: 0 }] }))} className="flex items-center gap-1.5 text-sky-600 text-sm hover:text-sky-700">
                <PlusCircle className="w-4 h-4" /> Add Item
              </button>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide gap-2">
                <span className="col-span-5">Description</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Unit Price</span>
                <span className="col-span-2 text-right">Total</span>
                <span className="col-span-1" />
              </div>
              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 px-3 py-2 border-t border-gray-100 gap-2 items-center">
                  <div className="col-span-5">
                    {(() => {
                      const matchedService = serviceNames.find(
                        s => s.toLowerCase() === item.description.trim().toLowerCase()
                      ) || '';
                      const isCustomService = item.description === '__custom__' || (!!item.description && !matchedService);

                      return (
                        <div className="space-y-1.5">
                          <select
                            value={matchedService || (isCustomService ? '__custom__' : '')}
                            onChange={e => {
                              const selected = e.target.value;
                              if (selected === '__custom__') {
                                updateItem(i, 'description', '__custom__');
                                return;
                              }
                              updateItem(i, 'description', selected);
                            }}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-300 bg-white"
                          >
                            <option value="">Select service...</option>
                            {serviceNames.map(s => <option key={s} value={s}>{s}</option>)}
                            <option value="__custom__">Custom service...</option>
                          </select>
                          {isCustomService && (
                            <input
                              value={item.description === '__custom__' ? '' : item.description}
                              onChange={e => updateItem(i, 'description', e.target.value)}
                              placeholder="Type custom service..."
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-300"
                            />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-sky-300" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', Number(e.target.value))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-1 focus:ring-sky-300" />
                  </div>
                  <div className="col-span-2 text-right text-sm font-medium text-gray-900">{formatPKR(item.total)}</div>
                  <div className="col-span-1 flex justify-center">
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))} className="p-1 text-red-400 hover:text-red-600 rounded transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {services.some(s => s.category) && (
              <p className="text-xs text-gray-400 mt-1.5">Prices auto-fill from the service master list when a service is selected.</p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Doctor Fee (PKR)</label>
              <input type="number" min="0" step="0.01" value={form.doctor_fee} onChange={e => setForm({...form, doctor_fee: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value as Invoice['status']})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm">
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial Payment</option>
              </select>
            </div>
          </div>

          <AnimatePresence>
            {form.status === 'partial' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5">
                  <label className="block text-sm font-medium text-amber-800 mb-1.5">Amount Paid (PKR)</label>
                  <input type="number" min="0" step="0.01" value={form.amount_paid} onChange={e => setForm({...form, amount_paid: e.target.value})} className="w-full px-3.5 py-2.5 border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 text-sm bg-white" placeholder="0.00" />
                  {totalAmount > 0 && Number(form.amount_paid) > 0 && (
                    <p className="text-xs text-amber-700 mt-1.5">Balance remaining: {formatPKR(Math.max(0, totalAmount - Number(form.amount_paid)))}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatPKR(subtotal)}</span></div>
            <div className="flex justify-between text-sm text-gray-600"><span>Doctor Fee</span><span>{formatPKR(Number(form.doctor_fee || 0))}</span></div>
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2 mt-2"><span>Total</span><span>{formatPKR(totalAmount)}</span></div>
            {form.status === 'partial' && Number(form.amount_paid) > 0 && (
              <>
                <div className="flex justify-between text-sm text-emerald-600 font-medium"><span>Paid</span><span>{formatPKR(Number(form.amount_paid))}</span></div>
                <div className="flex justify-between text-sm text-amber-600 font-semibold"><span>Balance Due</span><span>{formatPKR(Math.max(0, totalAmount - Number(form.amount_paid)))}</span></div>
              </>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium disabled:opacity-60 flex items-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Create Invoice
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Payment Modal */}
      <Modal isOpen={!!editPaymentInvoice} onClose={() => setEditPaymentInvoice(null)} title="Edit Payment" size="sm">
        {editPaymentInvoice && (
          <form onSubmit={handleSavePayment} className="space-y-5">
            <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
              <p className="font-semibold text-gray-900 text-base">{(editPaymentInvoice.patient as unknown as { name: string })?.name}</p>
              <p className="text-xs text-gray-500">{format(new Date(editPaymentInvoice.created_at), 'MMMM d, yyyy')}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Total</p>
                <p className="font-bold text-gray-900 text-sm">{formatPKR(editPaymentInvoice.total_amount)}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-xs text-emerald-600 mb-1">Paid</p>
                <p className="font-bold text-emerald-700 text-sm">{formatPKR(editPaymentInvoice.amount_paid)}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-xs text-amber-600 mb-1">Left</p>
                <p className="font-bold text-amber-700 text-sm">{formatPKR(Math.max(0, editPaymentInvoice.total_amount - editPaymentInvoice.amount_paid))}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Status</label>
              <select
                value={paymentForm.status}
                onChange={e => {
                  const s = e.target.value as Invoice['status'];
                  setPaymentForm(f => ({ ...f, status: s, amount_paid: s === 'paid' ? String(editPaymentInvoice.total_amount) : s === 'unpaid' || s === 'cancelled' ? '0' : f.amount_paid }));
                }}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
              >
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial Payment</option>
                <option value="paid">Paid in Full</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <AnimatePresence>
              {(paymentForm.status === 'partial' || paymentForm.status === 'paid') && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Paid (PKR)</label>
                      <input type="number" min="0" max={editPaymentInvoice.total_amount} step="0.01" value={paymentForm.amount_paid} onChange={e => setPaymentForm(f => ({ ...f, amount_paid: e.target.value }))} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm" placeholder="0.00" readOnly={paymentForm.status === 'paid'} />
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3.5 space-y-2 text-sm">
                      <div className="flex justify-between text-gray-600"><span>Invoice Total</span><span className="font-medium">{formatPKR(editPaymentInvoice.total_amount)}</span></div>
                      <div className="flex justify-between text-emerald-600"><span>Amount Paid</span><span className="font-medium">{formatPKR(Number(paymentForm.amount_paid || 0))}</span></div>
                      <div className={`flex justify-between font-semibold border-t border-gray-200 pt-2 ${paymentBalance === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        <span className="flex items-center gap-1.5">
                          {paymentBalance === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                          Balance Due
                        </span>
                        <span>{formatPKR(paymentBalance)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => setEditPaymentInvoice(null)} className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm">Cancel</button>
              <button type="submit" disabled={savingPayment} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-60 flex items-center gap-2">
                {savingPayment ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Save Payment
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* View Invoice Modal */}
      <Modal isOpen={!!viewInvoice} onClose={() => { setViewInvoice(null); setLinkedPrescription(null); }} title="Invoice" size="lg">
        {viewInvoice && (
          <div className="space-y-5">
            <div ref={printRef} className="absolute -left-[9999px] opacity-0 pointer-events-none">
              <PrintDocument
                invoice={viewInvoice}
                prescription={showCombinedPrint ? linkedPrescription : undefined}
              />
            </div>

            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">INVOICE</h3>
                <p className="text-gray-500 text-sm">#{viewInvoice.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">{(viewInvoice.clinic as unknown as { clinic_name: string })?.clinic_name || 'PearlSmile Dental'}</p>
                <p className="text-xs text-gray-500">{(viewInvoice.clinic as unknown as { address: string })?.address}</p>
                <p className="text-xs text-gray-500">{(viewInvoice.clinic as unknown as { phone: string })?.phone}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 text-sm">
              <div><p className="text-xs text-gray-500 mb-1">Patient</p><p className="font-semibold">{(viewInvoice.patient as unknown as { name: string })?.name}</p></div>
              <div><p className="text-xs text-gray-500 mb-1">Doctor</p><p className="font-semibold">{(viewInvoice.doctor as unknown as { name: string })?.name || '—'}</p></div>
              <div><p className="text-xs text-gray-500 mb-1">Date</p><p className="font-semibold">{format(new Date(viewInvoice.created_at), 'MMMM d, yyyy')}</p></div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[viewInvoice.status]}`}>{STATUS_LABELS[viewInvoice.status]}</span>
              </div>
            </div>

            {viewInvoice.items?.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Service</th>
                      <th className="text-center px-4 py-2.5 font-medium text-gray-600">Qty</th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-600">Unit Price</th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewInvoice.items.map((item, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-4 py-2.5">{item.description}</td>
                        <td className="px-4 py-2.5 text-center">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right">{formatPKR(item.unit_price)}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatPKR(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatPKR(viewInvoice.total_amount - viewInvoice.doctor_fee)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Doctor Fee</span><span>{formatPKR(viewInvoice.doctor_fee)}</span></div>
              <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2"><span>Total Amount</span><span>{formatPKR(viewInvoice.total_amount)}</span></div>
              {viewInvoice.status === 'partial' && (
                <>
                  <div className="flex justify-between text-emerald-600 font-medium"><span>Amount Paid</span><span>{formatPKR(viewInvoice.amount_paid)}</span></div>
                  <div className="flex justify-between text-amber-600 font-semibold border-t border-amber-100 pt-2"><span>Balance Due</span><span>{formatPKR(Math.max(0, viewInvoice.total_amount - viewInvoice.amount_paid))}</span></div>
                </>
              )}
            </div>

            {linkedPrescription && (
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-sky-600" />
                  <p className="text-sm font-semibold text-sky-800">Latest Prescription Available</p>
                </div>
                <p className="text-xs text-sky-600">
                  Issued {format(new Date(linkedPrescription.created_at), 'MMM d, yyyy')}
                  {linkedPrescription.medicines?.length > 0 && ` · ${linkedPrescription.medicines.length} medicine(s)`}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-sky-700">
                    <input
                      type="checkbox"
                      checked={showCombinedPrint}
                      onChange={e => setShowCombinedPrint(e.target.checked)}
                      className="rounded border-sky-300 text-sky-600 focus:ring-sky-300"
                    />
                    Include prescription in printout
                  </label>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => { setViewInvoice(null); openEditPayment(viewInvoice); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium"
              >
                <Pencil className="w-4 h-4" /> Edit Payment
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium ml-auto"
              >
                <Printer className="w-4 h-4" />
                {showCombinedPrint ? 'Print Bill + Rx' : 'Print Invoice'}
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-700 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" /> Save PDF
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Print Options Modal */}
      <Modal isOpen={showPrintOptions} onClose={() => { setShowPrintOptions(false); setCreatedInvoice(null); setLinkedPrescription(null); }} title="Invoice Created" size="sm">
        {createdInvoice && (
          <div className="space-y-5">
            <div ref={printRef} className="absolute -left-[9999px] opacity-0 pointer-events-none">
              <PrintDocument
                invoice={createdInvoice}
                prescription={linkedPrescription || undefined}
              />
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="font-semibold text-emerald-900 mb-1">Invoice Created Successfully</p>
              <p className="text-sm text-emerald-700">#{createdInvoice.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-xs text-emerald-600 mt-2">{(createdInvoice.patient as unknown as { name: string })?.name}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 mb-3">Choose an option:</p>

              <button
                onClick={() => {
                  printDoc(printRef.current, `Invoice-${createdInvoice.id.slice(0, 8)}`);
                  setTimeout(() => { setShowPrintOptions(false); setCreatedInvoice(null); setLinkedPrescription(null); }, 300);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium"
              >
                <Printer className="w-4 h-4" />
                <span>{linkedPrescription ? 'Print Invoice + Prescription' : 'Print Invoice'}</span>
              </button>

              <button
                onClick={() => {
                  downloadAsPDF(printRef.current, `Invoice-${createdInvoice.id.slice(0, 8)}.pdf`);
                  setTimeout(() => { setShowPrintOptions(false); setCreatedInvoice(null); setLinkedPrescription(null); }, 300);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                <span>{linkedPrescription ? 'Save as PDF (Invoice + Prescription)' : 'Save Invoice as PDF'}</span>
              </button>

              <button
                onClick={() => { setShowPrintOptions(false); setCreatedInvoice(null); setLinkedPrescription(null); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors text-sm"
              >
                Done
              </button>
            </div>

            {linkedPrescription && (
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-xs text-sky-700">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Linked Prescription</p>
                    <p className="text-sky-600 mt-0.5">
                      Issued {format(new Date(linkedPrescription.created_at), 'MMM d, yyyy')}
                      {linkedPrescription.medicines?.length > 0 && ` · ${linkedPrescription.medicines.length} medicine(s)`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteInvoice}
        onConfirm={handleDelete}
        onCancel={() => setDeleteInvoice(null)}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice?"
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
