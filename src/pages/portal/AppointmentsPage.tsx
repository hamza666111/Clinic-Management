import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Calendar, ChevronLeft, ChevronRight, UserPlus, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Appointment, Patient, Clinic, UserProfile } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-sky-100 text-sky-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  'no-show': 'bg-amber-100 text-amber-700',
};

export default function AppointmentsPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [calMonth, setCalMonth] = useState(new Date());

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [doctors, setDoctors] = useState<UserProfile[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [deleteAppt, setDeleteAppt] = useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({
    name: '',
    contact: '',
    gender: 'male' as 'male' | 'female' | 'other',
    age: '',
  });

  const [form, setForm] = useState({
    patient_id: '',
    doctor_id: '',
    clinic_id: '',
    appointment_date: format(new Date(), 'yyyy-MM-dd'),
    appointment_time: '09:00',
    status: 'scheduled' as Appointment['status'],
    notes: '',
  });

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('appointments')
      .select('*, patient:patients(name, contact), doctor:users_profile!doctor_id(name), clinic:clinics(clinic_name)')
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: true });
    if (profile?.role === 'doctor') q = q.eq('doctor_id', profile.id);
    else if (profile?.role !== 'admin' && profile?.clinic_id) q = q.eq('clinic_id', profile.clinic_id);
    const { data } = await q;
    let filtered = (data || []) as unknown as Appointment[];
    if (search) filtered = filtered.filter(a => (a.patient as unknown as { name: string })?.name?.toLowerCase().includes(search.toLowerCase()));
    setAppointments(filtered);
    setLoading(false);
  }, [profile, search]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);
  useEffect(() => {
    const cid = profile?.role !== 'admin' && profile?.clinic_id ? profile.clinic_id : null;
    const pQ = cid ? supabase.from('patients').select('id, name').eq('clinic_id', cid).order('name') : supabase.from('patients').select('id, name').order('name');
    const dQ = cid ? supabase.from('users_profile').select('*').eq('role', 'doctor').eq('clinic_id', cid) : supabase.from('users_profile').select('*').eq('role', 'doctor');
    pQ.then(({ data }) => setPatients(data || []));
    supabase.from('clinics').select('*').then(({ data }) => setClinics(data || []));
    dQ.then(({ data }) => setDoctors(data || []));
  }, [profile]);

  const openAdd = () => {
    setEditAppt(null);
    setShowNewPatient(false);
    setNewPatientForm({ name: '', contact: '', gender: 'male', age: '' });
    setForm({ patient_id: '', doctor_id: profile?.role === 'doctor' ? profile.id : '', clinic_id: profile?.clinic_id || '', appointment_date: format(new Date(), 'yyyy-MM-dd'), appointment_time: '09:00', status: 'scheduled', notes: '' });
    setShowForm(true);
  };

  const openEdit = (appt: Appointment) => {
    setEditAppt(appt);
    setShowNewPatient(false);
    setNewPatientForm({ name: '', contact: '', gender: 'male', age: '' });
    setForm({ patient_id: appt.patient_id, doctor_id: appt.doctor_id || '', clinic_id: appt.clinic_id || '', appointment_date: appt.appointment_date, appointment_time: appt.appointment_time?.slice(0, 5) || '09:00', status: appt.status, notes: appt.notes || '' });
    setShowForm(true);
  };

  const handleAddPatient = async () => {
    if (!newPatientForm.name.trim()) {
      toast.error('Patient name is required.');
      return;
    }

    setSavingPatient(true);

    const assignedClinicId = profile?.role === 'admin'
      ? (form.clinic_id || null)
      : (profile?.clinic_id || form.clinic_id || null);

    const assignedDoctorId = profile?.role === 'doctor'
      ? profile.id
      : (form.doctor_id || null);

    const { data, error } = await supabase
      .from('patients')
      .insert({
        name: newPatientForm.name.trim(),
        contact: newPatientForm.contact.trim(),
        gender: newPatientForm.gender,
        age: newPatientForm.age ? Number(newPatientForm.age) : 0,
        email: '',
        address: '',
        medical_history: '',
        dental_history: '',
        notes: '',
        clinic_id: assignedClinicId,
        doctor_id: assignedDoctorId,
      })
      .select('id, name, clinic_id, doctor_id')
      .maybeSingle();

    setSavingPatient(false);

    if (error || !data) {
      toast.error('Failed to add patient.');
      return;
    }

    const created = data as Patient;
    setPatients(prev => [created, ...prev.filter(p => p.id !== created.id)]);
    setForm(f => ({
      ...f,
      patient_id: created.id,
      clinic_id: f.clinic_id || (created.clinic_id || ''),
      doctor_id: f.doctor_id || (created.doctor_id || ''),
    }));
    setNewPatientForm({ name: '', contact: '', gender: 'male', age: '' });
    setShowNewPatient(false);
    toast.success(`Patient "${created.name}" added and selected.`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient_id) { toast.error('Please select a patient.'); return; }
    setSaving(true);
    const payload = { ...form, doctor_id: form.doctor_id || null, clinic_id: form.clinic_id || null };
    const { error } = editAppt
      ? await supabase.from('appointments').update(payload).eq('id', editAppt.id)
      : await supabase.from('appointments').insert(payload);
    setSaving(false);
    if (error) { toast.error('Failed to save appointment.'); return; }
    toast.success(editAppt ? 'Appointment updated.' : 'Appointment scheduled.');
    setShowForm(false);
    fetchAppointments();
  };

  const handleDelete = async () => {
    if (!deleteAppt) return;
    await supabase.from('appointments').delete().eq('id', deleteAppt.id);
    toast.success('Appointment deleted.');
    setDeleteAppt(null);
    fetchAppointments();
  };

  const monthDays = useMemo(() =>
    eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) }),
    [calMonth]
  );
  const firstDayOfWeek = useMemo(() => startOfMonth(calMonth).getDay(), [calMonth]);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach(a => {
      const key = a.appointment_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [appointments]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search appointments..." className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 w-56 bg-white" />
          </div>
          <div className="flex bg-gray-100 rounded-xl p-1">
            {(['list', 'calendar'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${view === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}>{v}</button>
            ))}
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" /> Schedule Appointment
        </button>
      </div>

      {view === 'calendar' ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setCalMonth(m => subMonths(m, 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
            <h3 className="text-lg font-semibold text-gray-900">{format(calMonth, 'MMMM yyyy')}</h3>
            <button onClick={() => setCalMonth(m => addMonths(m, 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
          </div>
          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {[...Array(firstDayOfWeek)].map((_, i) => <div key={`empty-${i}`} />)}
            {monthDays.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayAppts = appointmentsByDate.get(dateKey) || [];
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className={`min-h-[70px] p-1.5 rounded-xl border transition-colors ${isToday ? 'border-sky-300 bg-sky-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <p className={`text-xs font-semibold mb-1 ${isToday ? 'text-sky-700' : 'text-gray-600'}`}>{format(day, 'd')}</p>
                  <div className="space-y-0.5">
                    {dayAppts.slice(0, 2).map(a => (
                      <div key={a.id} className="text-xs bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded truncate cursor-pointer hover:bg-sky-200 transition-colors" onClick={() => openEdit(a)}>
                        {a.appointment_time?.slice(0, 5)} {(a.patient as unknown as { name: string })?.name?.split(' ')[0]}
                      </div>
                    ))}
                    {dayAppts.length > 2 && <div className="text-xs text-gray-400">+{dayAppts.length - 2} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Date & Time</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Doctor</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(4)].map((_, i) => <tr key={i} className="border-b border-gray-50"><td colSpan={5} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>)
                ) : appointments.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-gray-400"><Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No appointments found</p></td></tr>
                ) : appointments.map((appt) => (
                  <tr key={appt.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 text-sm">{(appt.patient as unknown as { name: string })?.name}</p>
                      <p className="text-xs text-gray-500">{(appt.patient as unknown as { contact: string })?.contact}</p>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <p className="text-sm text-gray-900">{format(new Date(appt.appointment_date), 'MMM d, yyyy')}</p>
                      <p className="text-xs text-gray-500">{appt.appointment_time?.slice(0, 5)}</p>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell text-sm text-gray-700">{(appt.doctor as unknown as { name: string })?.name || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[appt.status]}`}>{appt.status}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(appt)} className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteAppt(appt)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editAppt ? 'Edit Appointment' : 'Schedule Appointment'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Patient *</label>
              <button
                type="button"
                onClick={() => setShowNewPatient(v => !v)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${showNewPatient ? 'bg-sky-100 text-sky-700' : 'text-sky-600 hover:bg-sky-50'}`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Quick Add
                <ChevronDown className={`w-3 h-3 transition-transform ${showNewPatient ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <select required value={form.patient_id} onChange={e => setForm({...form, patient_id: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm">
              <option value="">Select Patient</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            {showNewPatient && (
              <div className="mt-3 bg-sky-50 border border-sky-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-sky-600" />
                  <p className="text-sm font-semibold text-sky-800">Quick Add Patient</p>
                  <p className="text-xs text-sky-500 ml-auto">Will be selected automatically</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Full name *"
                      value={newPatientForm.name}
                      onChange={e => setNewPatientForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-sky-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      placeholder="Contact number"
                      value={newPatientForm.contact}
                      onChange={e => setNewPatientForm(f => ({ ...f, contact: e.target.value }))}
                      className="w-full px-3 py-2 border border-sky-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Age"
                      min="0"
                      max="120"
                      value={newPatientForm.age}
                      onChange={e => setNewPatientForm(f => ({ ...f, age: e.target.value }))}
                      className="w-full px-3 py-2 border border-sky-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                    />
                  </div>
                  <div>
                    <select
                      value={newPatientForm.gender}
                      onChange={e => setNewPatientForm(f => ({ ...f, gender: e.target.value as 'male' | 'female' | 'other' }))}
                      className="w-full px-3 py-2 border border-sky-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddPatient}
                      disabled={savingPatient}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium disabled:opacity-60"
                    >
                      {savingPatient ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                      Add & Select
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date *</label>
              <input required type="date" value={form.appointment_date} onChange={e => setForm({...form, appointment_date: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Time *</label>
              <input required type="time" value={form.appointment_time} onChange={e => setForm({...form, appointment_time: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Doctor</label>
            <select value={form.doctor_id} onChange={e => setForm({...form, doctor_id: e.target.value})} disabled={profile?.role === 'doctor'} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm">
              <option value="">Select Doctor</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Clinic</label>
            <select value={form.clinic_id} onChange={e => setForm({...form, clinic_id: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm">
              <option value="">Select Clinic</option>
              {clinics.map(c => <option key={c.id} value={c.id}>{c.clinic_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value as Appointment['status']})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm">
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no-show">No Show</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm resize-none" placeholder="Reason for visit, notes..." />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium disabled:opacity-60 flex items-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editAppt ? 'Update' : 'Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteAppt}
        onConfirm={handleDelete}
        onCancel={() => setDeleteAppt(null)}
        title="Delete Appointment"
        message="Are you sure you want to delete this appointment?"
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
