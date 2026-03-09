import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, Calendar, FileText, Image as ImageIcon, Pill,
  Phone, Mail, MapPin, Clock, ChevronRight, FileUp, AlertCircle,
  CalendarRange, CheckCircle2, AlertTriangle, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Patient, Appointment, Prescription, PatientFile } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import ConfirmDialog from '../ui/ConfirmDialog';

function rxStatus(start_date: string | null, end_date: string | null) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (!start_date && !end_date) return null;
  const start = start_date ? new Date(start_date) : null;
  const end = end_date ? new Date(end_date) : null;
  if (end && end < today) return 'expired';
  if (start && start > today) return 'upcoming';
  return 'active';
}

const RX_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  active: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  upcoming: { label: 'Upcoming', cls: 'bg-sky-100 text-sky-700', icon: <Clock className="w-3 h-3" /> },
  expired: { label: 'Expired', cls: 'bg-red-100 text-red-600', icon: <AlertTriangle className="w-3 h-3" /> },
};

interface Props {
  patient: Patient | null;
  onClose: () => void;
}

type Tab = 'info' | 'appointments' | 'prescriptions' | 'media';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-sky-100 text-sky-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
  'no-show': 'bg-amber-100 text-amber-700',
};

export default function PatientProfileModal({ patient, onClose }: Props) {
  const { profile } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('info');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [publicUrls, setPublicUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [deleteFile, setDeleteFile] = useState<PatientFile | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);

  const canManageFiles = profile?.role === 'admin' || profile?.role === 'clinic_admin' || profile?.role === 'doctor';

  useEffect(() => {
    if (!patient) return;
    setTab('info');
    setAppointments([]);
    setPrescriptions([]);
    setFiles([]);
    setPublicUrls({});
    setDeleteFile(null);
  }, [patient?.id]);

  useEffect(() => {
    if (!patient) return;
    if (tab === 'appointments') fetchAppointments();
    if (tab === 'prescriptions') fetchPrescriptions();
    if (tab === 'media') fetchFiles();
  }, [tab, patient?.id]);

  const fetchAppointments = async () => {
    if (!patient) return;
    setLoading(true);
    const { data } = await supabase
      .from('appointments')
      .select('*, doctor:users_profile!doctor_id(name)')
      .eq('patient_id', patient.id)
      .order('appointment_date', { ascending: false });
    setAppointments((data || []) as unknown as Appointment[]);
    setLoading(false);
  };

  const fetchPrescriptions = async () => {
    if (!patient) return;
    setLoading(true);
    const { data } = await supabase
      .from('prescriptions')
      .select('*, doctor:users_profile!doctor_id(name)')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false });
    setPrescriptions((data || []) as unknown as Prescription[]);
    setLoading(false);
  };

  const fetchFiles = async () => {
    if (!patient) return;
    setLoading(true);
    const { data } = await supabase
      .from('patient_files')
      .select('*')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false });

    const fileList = (data || []) as PatientFile[];
    setFiles(fileList);

    const urls: Record<string, string> = {};
    await Promise.all(fileList.map(async (f) => {
      const path = extractPath(f.file_url);

      if (!path) {
        urls[f.id] = f.file_url;
        return;
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from('patient-files')
        .createSignedUrl(path, 60 * 60);

      if (!signedError && signedData?.signedUrl) {
        urls[f.id] = signedData.signedUrl;
        return;
      }

      urls[f.id] = supabase.storage.from('patient-files').getPublicUrl(path).data.publicUrl;
    }));

    setPublicUrls(urls);
    setLoading(false);
  };

  const extractPath = (url: string): string | null => {
    try {
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
      if (!url.startsWith('http')) return url;
      return null;
    } catch { return null; }
  };

  const handleDeleteFile = async () => {
    if (!deleteFile) return;

    setDeletingFile(true);

    const storagePath = extractPath(deleteFile.file_url);
    if (storagePath) {
      await supabase.storage.from('patient-files').remove([storagePath]);
    }

    const { error } = await supabase
      .from('patient_files')
      .delete()
      .eq('id', deleteFile.id);

    setDeletingFile(false);

    if (error) {
      toast.error('Failed to delete file.');
      return;
    }

    if (lightbox && publicUrls[deleteFile.id] === lightbox) {
      setLightbox(null);
    }

    toast.success('File deleted.');
    setDeleteFile(null);
    await fetchFiles();
  };

  if (!patient) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'info', label: 'Overview', icon: <User className="w-4 h-4" /> },
    { id: 'appointments', label: 'Visits', icon: <Calendar className="w-4 h-4" /> },
    { id: 'prescriptions', label: 'Prescriptions', icon: <FileText className="w-4 h-4" /> },
    { id: 'media', label: 'Files & Media', icon: <ImageIcon className="w-4 h-4" /> },
  ];

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-500 to-cyan-600 px-6 py-5 flex items-center gap-4 shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold shrink-0">
                {patient.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white truncate">{patient.name}</h2>
                <p className="text-sky-100 text-sm capitalize">
                  {patient.age} years · {patient.gender}
                  {patient.contact ? ` · ${patient.contact}` : ''}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 shrink-0 px-2 bg-white">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all ${
                    tab === t.id
                      ? 'border-sky-500 text-sky-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                  }`}
                >
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="p-6"
                >
                  {tab === 'info' && <InfoTab patient={patient} />}
                  {tab === 'appointments' && (
                    <AppointmentsTab appointments={appointments} loading={loading} />
                  )}
                  {tab === 'prescriptions' && (
                    <PrescriptionsTab prescriptions={prescriptions} loading={loading} />
                  )}
                  {tab === 'media' && (
                    <MediaTab
                      files={files}
                      publicUrls={publicUrls}
                      loading={loading}
                      onLightbox={setLightbox}
                      canDelete={canManageFiles}
                      onDeleteFile={setDeleteFile}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <button
              className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white"
              onClick={() => setLightbox(null)}
            >
              <X className="w-5 h-5" />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              src={lightbox}
              alt="Patient media"
              className="max-w-full max-h-[85vh] rounded-xl object-contain"
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!deleteFile}
        onConfirm={handleDeleteFile}
        onCancel={() => setDeleteFile(null)}
        title="Delete File"
        message={`Delete "${deleteFile?.file_name || 'this file'}"? This cannot be undone.`}
        confirmLabel={deletingFile ? 'Deleting...' : 'Delete'}
        danger
      />
    </>
  );
}

function InfoTab({ patient }: { patient: Patient }) {
  const fields = [
    { label: 'Email', value: patient.email, icon: <Mail className="w-4 h-4" /> },
    { label: 'Phone', value: patient.contact, icon: <Phone className="w-4 h-4" /> },
    { label: 'Address', value: patient.address, icon: <MapPin className="w-4 h-4" /> },
  ].filter(f => f.value);

  return (
    <div className="space-y-5">
      {fields.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {fields.map(f => (
            <div key={f.label} className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-gray-400 mt-0.5 shrink-0">{f.icon}</span>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">{f.label}</p>
                <p className="text-sm text-gray-800">{f.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <HistoryCard
        title="Medical History"
        content={patient.medical_history}
        color="rose"
        icon={<AlertCircle className="w-4 h-4" />}
      />
      <HistoryCard
        title="Dental History"
        content={patient.dental_history}
        color="sky"
        icon={<FileText className="w-4 h-4" />}
      />
      {patient.notes && (
        <HistoryCard
          title="Notes"
          content={patient.notes}
          color="amber"
          icon={<FileText className="w-4 h-4" />}
        />
      )}
    </div>
  );
}

function HistoryCard({
  title, content, color, icon
}: {
  title: string;
  content: string;
  color: string;
  icon: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    rose: 'bg-rose-50 border-rose-100 text-rose-600',
    sky: 'bg-sky-50 border-sky-100 text-sky-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
        {content || <span className="text-gray-400 italic">None recorded</span>}
      </p>
    </div>
  );
}

function AppointmentsTab({ appointments, loading }: { appointments: Appointment[]; loading: boolean }) {
  if (loading) return <LoadingState rows={4} />;
  if (appointments.length === 0) return <EmptyState icon={<Calendar className="w-8 h-8" />} text="No appointments recorded" />;

  return (
    <div className="space-y-3">
      {appointments.map(appt => (
        <div key={appt.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {format(new Date(appt.appointment_date), 'EEEE, MMMM d, yyyy')}
                </p>
                <div className="flex items-center gap-2 text-gray-500 text-xs mt-0.5">
                  <Clock className="w-3 h-3" />
                  {appt.appointment_time?.slice(0, 5)}
                  {(appt.doctor as unknown as { name?: string })?.name && (
                    <>
                      <ChevronRight className="w-3 h-3" />
                      Dr. {(appt.doctor as unknown as { name: string }).name}
                    </>
                  )}
                </div>
              </div>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[appt.status] || 'bg-gray-100 text-gray-600'}`}>
              {appt.status}
            </span>
          </div>
          {appt.notes && (
            <p className="mt-3 text-sm text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100">{appt.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function PrescriptionsTab({ prescriptions, loading }: { prescriptions: Prescription[]; loading: boolean }) {
  if (loading) return <LoadingState rows={3} />;
  if (prescriptions.length === 0) return <EmptyState icon={<FileText className="w-8 h-8" />} text="No prescriptions recorded" />;

  return (
    <div className="space-y-4">
      {prescriptions.map(rx => (
        <div key={rx.id} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
          {(() => {
              const status = rxStatus(rx.start_date, rx.end_date);
              const badge = status ? RX_BADGE[status] : null;
              return (
                <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-500" />
                    <span className="text-sm font-semibold text-gray-800">
                      {format(new Date(rx.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(rx.start_date || rx.end_date) && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <CalendarRange className="w-3.5 h-3.5 text-gray-400" />
                        <span>{rx.start_date ? format(new Date(rx.start_date), 'MMM d') : '?'}</span>
                        <span className="text-gray-300">→</span>
                        <span>{rx.end_date ? format(new Date(rx.end_date), 'MMM d, yyyy') : 'ongoing'}</span>
                      </div>
                    )}
                    {badge && (
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.icon}{badge.label}
                      </span>
                    )}
                    {(rx.doctor as unknown as { name?: string })?.name && (
                      <span className="text-xs text-gray-500">
                        Dr. {(rx.doctor as unknown as { name: string }).name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

          <div className="px-4 py-3 space-y-3">
            {rx.treatments && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Treatments</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{rx.treatments}</p>
              </div>
            )}

            {Array.isArray(rx.medicines) && rx.medicines.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Medicines</p>
                <div className="space-y-1.5">
                  {rx.medicines.map((med, i) => (
                    <div key={i} className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                      <Pill className="w-3.5 h-3.5 text-sky-500 mt-0.5 shrink-0" />
                      <div className="text-xs flex-1">
                        <span className="font-semibold text-gray-800">{med.medicine_name}</span>
                        {med.medicine_type && <span className="text-sky-600"> ({med.medicine_type})</span>}
                        {med.strength && <span className="text-gray-500"> · {med.strength}</span>}
                        {med.dose_quantity && <span className="text-gray-500"> · {med.dose_quantity}</span>}
                        {med.frequency && <span className="text-gray-500"> · {med.frequency}</span>}
                        {med.duration && <span className="text-gray-500"> · {med.duration}</span>}
                        {med.special_instructions && <span className="text-emerald-600 italic"> · {med.special_instructions}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rx.notes && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-gray-600 italic">{rx.notes}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MediaTab({
  files,
  publicUrls,
  loading,
  onLightbox,
  canDelete,
  onDeleteFile,
}: {
  files: PatientFile[];
  publicUrls: Record<string, string>;
  loading: boolean;
  onLightbox: (url: string) => void;
  canDelete: boolean;
  onDeleteFile: (file: PatientFile) => void;
}) {
  if (loading) return <LoadingState rows={3} />;
  if (files.length === 0) return (
    <EmptyState icon={<FileUp className="w-8 h-8" />} text="No files uploaded yet" subtext="Upload files from the patient list using the file icon." />
  );

  const images = files.filter(f => f.file_type === 'image');
  const docs = files.filter(f => f.file_type !== 'image');

  return (
    <div className="space-y-6">
      {images.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Images & X-Rays</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map(f => (
              <div
                key={f.id}
                className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer border border-gray-200 hover:border-sky-400 transition-all hover:shadow-md"
                onClick={() => publicUrls[f.id] && onLightbox(publicUrls[f.id])}
              >
                {canDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile(f);
                    }}
                    className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-white/90 text-red-600 hover:bg-red-50"
                    title="Delete file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {publicUrls[f.id] ? (
                  <img
                    src={publicUrls[f.id]}
                    alt={f.file_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-gray-300" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate">{f.file_name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {docs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Documents & PDFs</p>
          <div className="space-y-3">
            {docs.map(f => (
              <div key={f.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <FileText className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-sm font-medium text-gray-700 flex-1 truncate">{f.file_name}</span>
                  <span className="text-xs text-gray-400">{format(new Date(f.created_at), 'MMM d, yyyy')}</span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDeleteFile(f)}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                      title="Delete file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {publicUrls[f.id] && f.file_type === 'pdf' ? (
                  <div className="bg-gray-100">
                    <iframe
                      src={`${publicUrls[f.id]}#toolbar=0&navpanes=0`}
                      className="w-full h-[500px] border-0"
                      title={f.file_name}
                    />
                  </div>
                ) : publicUrls[f.id] ? (
                  <div className="px-4 py-3">
                    <a
                      href={publicUrls[f.id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-sky-600 hover:underline"
                    >
                      Open file in new tab
                    </a>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingState({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ icon, text, subtext }: { icon: React.ReactNode; text: string; subtext?: string }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <p className="font-medium text-gray-500">{text}</p>
      {subtext && <p className="text-sm mt-1 text-gray-400 max-w-xs mx-auto">{subtext}</p>}
    </div>
  );
}
