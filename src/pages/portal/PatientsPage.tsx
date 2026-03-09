import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Eye, Edit2, Trash2, User, FileUp,
  ChevronLeft, ChevronRight, X, FileText, Image, Download, RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Patient, Clinic, UserProfile, PatientFile } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { format } from 'date-fns';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import PatientProfileModal from '../../components/portal/PatientProfileModal';

const PAGE_SIZE = 10;

interface PatientFormData {
  name: string;
  age: string;
  gender: 'male' | 'female' | 'other';
  contact: string;
  email: string;
  address: string;
  medical_history: string;
  dental_history: string;
  notes: string;
  doctor_id: string;
  clinic_id: string;
}

const defaultForm: PatientFormData = {
  name: '', age: '', gender: 'other', contact: '', email: '',
  address: '', medical_history: '', dental_history: '', notes: '',
  doctor_id: '', clinic_id: '',
};

export default function PatientsPage() {
  const { profile } = useAuth();
  const toast = useToast();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClinic, setFilterClinic] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('');
  const [page, setPage] = useState(1);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [doctors, setDoctors] = useState<UserProfile[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [viewPatient, setViewPatient] = useState<Patient | null>(null);
  const [deletePatient, setDeletePatient] = useState<Patient | null>(null);
  const [form, setForm] = useState<PatientFormData>(defaultForm);
  const [saving, setSaving] = useState(false);

  const [filesPatient, setFilesPatient] = useState<Patient | null>(null);
  const [patientFiles, setPatientFiles] = useState<PatientFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [deleteFile, setDeleteFile] = useState<PatientFile | null>(null);

  const isAdmin = profile?.role === 'admin';
  const isClinicAdmin = profile?.role === 'clinic_admin';
  const isDoctor = profile?.role === 'doctor';
  const canWrite = isAdmin || isClinicAdmin || isDoctor;

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('patients')
      .select('*, doctor:users_profile!doctor_id(id,name,role), clinic:clinics(clinic_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (!isAdmin && profile?.clinic_id) query = query.eq('clinic_id', profile.clinic_id);
    if (search) query = query.ilike('name', `%${search}%`);
    if (filterClinic) query = query.eq('clinic_id', filterClinic);
    if (filterDoctor) query = query.eq('doctor_id', filterDoctor);

    const { data, count, error } = await query;
    if (error) toast.error('Failed to load patients.');
    setPatients((data || []) as unknown as Patient[]);
    setTotalCount(count || 0);
    setLoading(false);
  }, [search, filterClinic, filterDoctor, page, isAdmin, profile]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  useEffect(() => {
    const loadClinicsAndDoctors = async () => {
      const cid = !isAdmin && profile?.clinic_id ? profile.clinic_id : null;
      const dQ = cid ? supabase.from('users_profile').select('id, name, role, clinic_id').eq('role', 'doctor').eq('clinic_id', cid).order('name') : supabase.from('users_profile').select('id, name, role, clinic_id').eq('role', 'doctor').order('name');
      const [clinicRes, doctorRes] = await Promise.all([
        supabase.from('clinics').select('id, clinic_name').order('clinic_name'),
        dQ,
      ]);
      setClinics(clinicRes.data || []);
      setDoctors(doctorRes.data || []);
    };
    loadClinicsAndDoctors();
  }, [profile, isAdmin]);

  const openAdd = () => {
    setEditPatient(null);
    setForm({
      ...defaultForm,
      doctor_id: isDoctor ? profile!.id : '',
      clinic_id: profile?.clinic_id || '',
    });
    setShowForm(true);
  };

  const openEdit = (patient: Patient) => {
    setEditPatient(patient);
    setForm({
      name: patient.name,
      age: String(patient.age),
      gender: patient.gender,
      contact: patient.contact,
      email: patient.email,
      address: patient.address,
      medical_history: patient.medical_history,
      dental_history: patient.dental_history,
      notes: patient.notes,
      doctor_id: patient.doctor_id || '',
      clinic_id: patient.clinic_id || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      age: parseInt(form.age) || 0,
      doctor_id: form.doctor_id || null,
      clinic_id: form.clinic_id || null,
    };
    const { error } = editPatient
      ? await supabase.from('patients').update(payload).eq('id', editPatient.id)
      : await supabase.from('patients').insert(payload);

    setSaving(false);
    if (error) { toast.error('Failed to save: ' + error.message); return; }
    toast.success(editPatient ? 'Patient updated.' : 'Patient added.');
    setShowForm(false);
    fetchPatients();
  };

  const handleDelete = async () => {
    if (!deletePatient) return;
    const { error } = await supabase.from('patients').delete().eq('id', deletePatient.id);
    if (error) { toast.error('Failed to delete patient.'); return; }
    toast.success('Patient deleted.');
    setDeletePatient(null);
    fetchPatients();
  };

  const openFiles = async (patient: Patient) => {
    setFilesPatient(patient);
    setSignedUrls({});
    loadFilesForPatient(patient.id);
  };

  const loadFilesForPatient = async (patientId: string) => {
    setLoadingFiles(true);
    const { data, error } = await supabase
      .from('patient_files')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) { toast.error('Failed to load files.'); setLoadingFiles(false); return; }
    const files = (data || []) as PatientFile[];
    setPatientFiles(files);

    const urls: Record<string, string> = {};
    files.forEach(f => {
      const storagePath = extractStoragePath(f.file_url);
      if (storagePath) {
        urls[f.id] = supabase.storage.from('patient-files').getPublicUrl(storagePath).data.publicUrl;
      } else {
        urls[f.id] = f.file_url;
      }
    });
    setSignedUrls(urls);
    setLoadingFiles(false);
  };

  const extractStoragePath = (url: string): string | null => {
    try {
      if (!url.startsWith('http')) return url;
      const markers = [
        '/object/public/patient-files/',
        '/object/authenticated/patient-files/',
        '/object/sign/patient-files/',
      ];
      for (const m of markers) {
        if (url.includes(m)) return decodeURIComponent(url.split(m)[1].split('?')[0]);
      }
      if (url.includes('/storage/v1/object/')) {
        const parts = url.split('/storage/v1/object/')[1];
        return decodeURIComponent(parts.split('/').slice(1).join('/').split('?')[0]);
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !filesPatient) return;
    const file = e.target.files[0];
    if (!file) return;

    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) { toast.error('File too large. Maximum size is 50MB.'); return; }

    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${filesPatient.id}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('patient-files')
      .upload(path, file, { upsert: false });

    if (uploadError) {
      toast.error('Upload failed: ' + uploadError.message);
      setUploading(false);
      e.target.value = '';
      return;
    }

    const fileUrl = path;

    const fileType = file.type.startsWith('image/') ? 'image'
      : file.type === 'application/pdf' ? 'pdf'
      : 'document';

    const { error: dbError } = await supabase.from('patient_files').insert({
      patient_id: filesPatient.id,
      file_url: fileUrl,
      file_type: fileType,
      file_name: file.name,
      uploaded_by: profile?.id || null,
    });

    setUploading(false);
    e.target.value = '';

    if (dbError) { toast.error('File saved to storage but record failed: ' + dbError.message); return; }
    toast.success('File uploaded successfully.');
    loadFilesForPatient(filesPatient.id);
  };

  const handleDeleteFile = async () => {
    if (!deleteFile) return;
    const storagePath = extractStoragePath(deleteFile.file_url);
    if (storagePath) {
      await supabase.storage.from('patient-files').remove([storagePath]);
    }
    const { error } = await supabase.from('patient_files').delete().eq('id', deleteFile.id);
    if (error) { toast.error('Failed to delete file.'); return; }
    toast.success('File deleted.');
    setDeleteFile(null);
    if (filesPatient) loadFilesForPatient(filesPatient.id);
  };

  const filteredDoctors = profile?.clinic_id
    ? doctors.filter(d => d.clinic_id === profile.clinic_id || isAdmin)
    : doctors;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="p-6 space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search patients…"
              className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 w-56 bg-white"
            />
          </div>
          {isAdmin && (
            <select
              value={filterClinic}
              onChange={e => { setFilterClinic(e.target.value); setPage(1); }}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              <option value="">All Clinics</option>
              {clinics.map(c => <option key={c.id} value={c.id}>{c.clinic_name}</option>)}
            </select>
          )}
          {!isDoctor && (
            <select
              value={filterDoctor}
              onChange={e => { setFilterDoctor(e.target.value); setPage(1); }}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              <option value="">All Doctors</option>
              {filteredDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <button onClick={fetchPatients} className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors bg-white">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {canWrite && (
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium shadow-sm">
            <Plus className="w-4 h-4" /> Add Patient
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Contact</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Doctor</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Clinic</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Registered</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-20 text-gray-400">
                    <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">No patients found</p>
                    <p className="text-sm mt-1">Try adjusting your search or add a new patient.</p>
                  </td>
                </tr>
              ) : patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="border-b border-gray-50 hover:bg-gray-50/70 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {patient.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <button
                          onClick={() => setViewPatient(patient)}
                          className="font-medium text-gray-900 text-sm hover:text-sky-600 transition-colors text-left"
                        >
                          {patient.name}
                        </button>
                        <p className="text-gray-400 text-xs">{patient.age}y · {patient.gender}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <p className="text-sm text-gray-700">{patient.contact || '—'}</p>
                    <p className="text-xs text-gray-400">{patient.email || ''}</p>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-sm text-gray-700">
                    {(patient.doctor as unknown as { name: string })?.name || '—'}
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell text-sm text-gray-600">
                    {(patient.clinic as unknown as { clinic_name: string })?.clinic_name || '—'}
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell text-sm text-gray-400">
                    {format(new Date(patient.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setViewPatient(patient)}
                        title="View full patient profile"
                        className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canWrite && (
                        <>
                          <button
                            onClick={() => openEdit(patient)}
                            title="Edit patient"
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openFiles(patient)}
                            title="Manage files"
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <FileUp className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => setDeletePatient(patient)}
                          title="Delete patient"
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-700 px-1">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editPatient ? 'Edit Patient' : 'Add New Patient'} size="xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
              <input
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
                placeholder="Patient full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Age *</label>
              <input
                required
                type="number"
                min="0"
                max="150"
                value={form.age}
                onChange={e => setForm({ ...form, age: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
                placeholder="Age in years"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Gender</label>
              <select
                value={form.gender}
                onChange={e => setForm({ ...form, gender: e.target.value as 'male' | 'female' | 'other' })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Number</label>
              <input
                value={form.contact}
                onChange={e => setForm({ ...form, contact: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
                placeholder="patient@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
              <input
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
                placeholder="Patient address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Assigned Doctor</label>
              <select
                value={form.doctor_id}
                onChange={e => setForm({ ...form, doctor_id: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
                disabled={isDoctor}
              >
                <option value="">Select Doctor</option>
                {filteredDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Clinic</label>
              <select
                value={form.clinic_id}
                onChange={e => setForm({ ...form, clinic_id: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
                disabled={!isAdmin && !!profile?.clinic_id}
              >
                <option value="">Select Clinic</option>
                {clinics.map(c => <option key={c.id} value={c.id}>{c.clinic_name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Medical History</label>
            <textarea
              rows={3}
              value={form.medical_history}
              onChange={e => setForm({ ...form, medical_history: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm resize-none"
              placeholder="Allergies, existing conditions, current medications…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Dental History</label>
            <textarea
              rows={3}
              value={form.dental_history}
              onChange={e => setForm({ ...form, dental_history: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm resize-none"
              placeholder="Previous dental procedures, current issues…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm resize-none"
              placeholder="Additional notes…"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 text-sm font-medium disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editPatient ? 'Update Patient' : 'Add Patient'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <PatientProfileModal patient={viewPatient} onClose={() => setViewPatient(null)} />

      {/* Files Modal */}
      <Modal
        isOpen={!!filesPatient}
        onClose={() => { setFilesPatient(null); setPatientFiles([]); setSignedUrls({}); }}
        title={`Files — ${filesPatient?.name}`}
        size="lg"
      >
        <div className="space-y-4">
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-gray-200 hover:border-sky-400 rounded-xl p-6 text-center transition-colors group">
              <FileUp className="w-8 h-8 mx-auto text-gray-300 group-hover:text-sky-400 mb-2 transition-colors" />
              <p className="text-sm font-medium text-gray-600 group-hover:text-sky-600 transition-colors">
                {uploading ? 'Uploading…' : 'Click to upload file'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Images (JPG, PNG, GIF, WEBP) or PDF — up to 50MB</p>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>

          {uploading && (
            <div className="flex items-center gap-2 text-sky-600 text-sm bg-sky-50 rounded-xl px-4 py-3">
              <div className="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin shrink-0" />
              Uploading file, please wait…
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">Uploaded Files</h4>
              {filesPatient && (
                <button
                  onClick={() => loadFilesForPatient(filesPatient.id)}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              )}
            </div>

            {loadingFiles ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : patientFiles.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No files uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {patientFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <div className="shrink-0">
                      {file.file_type === 'image'
                        ? <Image className="w-5 h-5 text-sky-500" />
                        : <FileText className="w-5 h-5 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{file.file_name}</p>
                      <p className="text-xs text-gray-400 capitalize">{file.file_type} · {format(new Date(file.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {signedUrls[file.id] && (
                        <a
                          href={signedUrls[file.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open file"
                          className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => setDeleteFile(file)}
                        title="Delete file"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletePatient}
        onConfirm={handleDelete}
        onCancel={() => setDeletePatient(null)}
        title="Delete Patient"
        message={`Permanently delete ${deletePatient?.name}? All appointments, prescriptions and files will also be removed.`}
        confirmLabel="Delete"
        danger
      />

      <ConfirmDialog
        isOpen={!!deleteFile}
        onConfirm={handleDeleteFile}
        onCancel={() => setDeleteFile(null)}
        title="Delete File"
        message={`Delete "${deleteFile?.file_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
