import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Calendar, FileText, Receipt, TrendingUp, Clock, CheckCircle, AlertCircle, CalendarRange, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfWeek, addDays } from 'date-fns';
import { formatPKR } from '../../lib/format';

interface ActivePrescription {
  id: string;
  start_date: string | null;
  end_date: string | null;
  treatments: string;
  patient: { name: string } | null;
  doctor: { name: string } | null;
}

function rxStatusDash(start_date: string | null, end_date: string | null) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (!start_date && !end_date) return 'no-date';
  const start = start_date ? new Date(start_date) : null;
  const end = end_date ? new Date(end_date) : null;
  if (end && end < today) return 'expired';
  if (start && start > today) return 'upcoming';
  return 'active';
}

interface DashboardStats {
  totalPatients: number;
  todayAppointments: number;
  upcomingAppointments: number;
  totalInvoices: number;
  totalRevenue: number;
  activePrescriptionsCount: number;
  unpaidInvoicesCount: number;
  recentPatients: Array<{ id: string; name: string; created_at: string; contact: string }>;
  todayAppointmentsList: Array<{ id: string; appointment_time: string; status: string; patient?: { name: string } }>;
  activePrescriptions: ActivePrescription[];
}

const weekDays = Array.from({ length: 7 }, (_, i) => {
  const d = addDays(startOfWeek(new Date()), i);
  return { day: format(d, 'EEE'), date: format(d, 'yyyy-MM-dd') };
});

const revenueData = [
  { month: 'Sep', revenue: 4200 },
  { month: 'Oct', revenue: 5800 },
  { month: 'Nov', revenue: 4900 },
  { month: 'Dec', revenue: 7200 },
  { month: 'Jan', revenue: 6100 },
  { month: 'Feb', revenue: 8400 },
];

const appointmentsData = weekDays.map(d => ({ day: d.day, count: Math.floor(Math.random() * 8 + 2) }));

const isGlobalAdmin = (role: string | undefined) => role === 'admin';

export default function DashboardPage() {
  const { profile, permissions } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    todayAppointments: 0,
    upcomingAppointments: 0,
    totalInvoices: 0,
    totalRevenue: 0,
    activePrescriptionsCount: 0,
    unpaidInvoicesCount: 0,
    recentPatients: [],
    todayAppointmentsList: [],
    activePrescriptions: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const today = format(new Date(), 'yyyy-MM-dd');
        const cid = !isGlobalAdmin(profile?.role) && profile?.clinic_id ? profile.clinic_id : null;

      const pQ = cid ? supabase.from('patients').select('*', { count: 'exact', head: true }).eq('clinic_id', cid) : supabase.from('patients').select('*', { count: 'exact', head: true });
      const aQ1 = cid ? supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', today).eq('clinic_id', cid) : supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', today);
      const aQ2 = cid ? supabase.from('appointments').select('*', { count: 'exact', head: true }).gt('appointment_date', today).eq('status', 'scheduled').eq('clinic_id', cid) : supabase.from('appointments').select('*', { count: 'exact', head: true }).gt('appointment_date', today).eq('status', 'scheduled');
      const iQ = cid ? supabase.from('invoices').select('total_amount, status').eq('clinic_id', cid) : supabase.from('invoices').select('total_amount, status');
      const rpQ = cid ? supabase.from('patients').select('id, name, created_at, contact').eq('clinic_id', cid).order('created_at', { ascending: false }).limit(5) : supabase.from('patients').select('id, name, created_at, contact').order('created_at', { ascending: false }).limit(5);
      const aQ3 = cid ? supabase.from('appointments').select('id, appointment_time, status, patient:patients(name)').eq('appointment_date', today).eq('clinic_id', cid).order('appointment_time') : supabase.from('appointments').select('id, appointment_time, status, patient:patients(name)').eq('appointment_date', today).order('appointment_time');

      const [
        { count: pCount },
        { count: todayCount },
        { count: upcomingCount },
        { data: invoiceData },
        { data: recentPatients },
        { data: todayAppts },
        { data: rxData },
      ] = await Promise.all([
        pQ,
        aQ1,
        aQ2,
        iQ,
        rpQ,
        aQ3,
        supabase.from('prescriptions')
          .select('id, start_date, end_date, treatments, patient:patients(name), doctor:users_profile!doctor_id(name)')
          .or(`end_date.gte.${today},end_date.is.null`)
          .order('start_date', { ascending: false })
          .limit(10),
      ]);

      const revenue = (invoiceData || []).filter(i => i.status === 'paid').reduce((acc: number, inv: { total_amount: number }) => acc + inv.total_amount, 0);
      const unpaidCount = (invoiceData || []).filter(i => i.status === 'unpaid').length;

      const prescriptions = (rxData || []) as unknown as ActivePrescription[];
      const activePrescriptions = prescriptions.filter(rx => {
        const s = rxStatusDash(rx.start_date, rx.end_date);
        return s === 'active' || s === 'upcoming' || s === 'no-date';
      });

      setStats({
          totalPatients: pCount || 0,
          todayAppointments: todayCount || 0,
          upcomingAppointments: upcomingCount || 0,
          totalInvoices: (invoiceData || []).length,
          totalRevenue: revenue,
          activePrescriptionsCount: activePrescriptions.length,
          unpaidInvoicesCount: unpaidCount,
          recentPatients: (recentPatients || []) as DashboardStats['recentPatients'],
          todayAppointmentsList: (todayAppts || []) as DashboardStats['todayAppointmentsList'],
          activePrescriptions,
        });
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [profile]);

  const canViewRevenue = permissions['view_revenue'] !== false; // default true for admins in context fallback

  const statCards: Array<{ label: string; value: string | number; icon: any; color: string; change: string }> = [
    { label: 'Total Patients', value: stats.totalPatients, icon: Users, color: 'bg-sky-500', change: '+12%' },
    { label: "Today's Appointments", value: stats.todayAppointments, icon: Calendar, color: 'bg-emerald-500', change: '+5%' },
    { label: 'Upcoming', value: stats.upcomingAppointments, icon: Clock, color: 'bg-amber-500', change: '+8%' },
  ];

  if (canViewRevenue) {
    statCards.push({ label: 'Revenue (Paid)', value: formatPKR(stats.totalRevenue), icon: TrendingUp, color: 'bg-rose-500', change: '+18%' });
  }

  const statusColor: Record<string, string> = {
    scheduled: 'bg-sky-100 text-sky-700',
    confirmed: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
    'no-show': 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {profile?.name?.split(' ')[0]}
          </h2>
          <p className="text-gray-500 mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{stat.change}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-0.5">{loading ? '—' : stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className={`grid gap-6 ${canViewRevenue ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
        {canViewRevenue && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-5">Revenue Overview (6 months)</h3>
            <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => formatPKR(v)} />
              <Tooltip formatter={(v: number) => [formatPKR(v), 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>        )}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-5">Appointments This Week</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={appointmentsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} name="Appointments" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Bottom Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-gray-900">Today's Appointments</h3>
            <span className="text-xs text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full">{stats.todayAppointments} total</span>
          </div>
          {stats.todayAppointmentsList.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No appointments today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.todayAppointmentsList.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center text-sky-700 text-xs font-bold">
                      {appt.appointment_time?.slice(0, 5)}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{appt.patient?.name || 'Unknown Patient'}</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[appt.status] || 'bg-gray-100 text-gray-700'}`}>
                    {appt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent Patients */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-gray-900">Recent Patients</h3>
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Latest 5</span>
          </div>
          {stats.recentPatients.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No patients yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentPatients.map((patient) => (
                <div key={patient.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-cyan-500 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {patient.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{patient.name}</p>
                    <p className="text-xs text-gray-500">{patient.contact}</p>
                  </div>
                  <span className="text-xs text-gray-400">{format(new Date(patient.created_at), 'MMM d')}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: CheckCircle, label: 'Completed Today', value: loading ? '—' : stats.todayAppointmentsList.filter(a => a.status === 'completed').length, color: 'text-emerald-600 bg-emerald-50' },
          { icon: AlertCircle, label: 'Pending Review', value: loading ? '—' : stats.todayAppointmentsList.filter(a => a.status === 'scheduled').length, color: 'text-amber-600 bg-amber-50' },
          { icon: FileText, label: 'Active Prescriptions', value: loading ? '—' : stats.activePrescriptionsCount, color: 'text-sky-600 bg-sky-50' },
          { icon: Receipt, label: 'Unpaid Invoices', value: loading ? '—' : stats.unpaidInvoicesCount, color: 'text-rose-600 bg-rose-50' },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className={`w-9 h-9 ${item.color} rounded-xl flex items-center justify-center`}>
              <item.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{item.value}</p>
              <p className="text-xs text-gray-500">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Active Prescriptions Widget */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-sky-500" />
            <h3 className="font-semibold text-gray-900">Active Prescriptions</h3>
          </div>
          <span className="text-xs text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full">
            {loading ? '…' : `${stats.activePrescriptionsCount} active`}
          </span>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : stats.activePrescriptions.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No active prescriptions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.activePrescriptions.map(rx => {
              const s = rxStatusDash(rx.start_date, rx.end_date);
              const badgeMap: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
                active: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-3 h-3" /> },
                upcoming: { label: 'Upcoming', cls: 'bg-sky-100 text-sky-700', icon: <Clock className="w-3 h-3" /> },
                'no-date': { label: 'No dates', cls: 'bg-gray-100 text-gray-500', icon: <AlertCircle className="w-3 h-3" /> },
              };
              const badge = s && badgeMap[s] ? badgeMap[s] : badgeMap['no-date'];
              return (
                <div key={rx.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-50">
                  <div className="w-9 h-9 bg-sky-50 rounded-xl flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{rx.patient?.name || 'Unknown'}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      {rx.doctor?.name && <span>Dr. {rx.doctor.name}</span>}
                      {(rx.start_date || rx.end_date) && (
                        <>
                          {rx.doctor?.name && <span className="text-gray-200">·</span>}
                          <CalendarRange className="w-3 h-3" />
                          <span>
                            {rx.start_date ? format(new Date(rx.start_date), 'MMM d') : '?'}
                            {' → '}
                            {rx.end_date ? format(new Date(rx.end_date), 'MMM d, yyyy') : 'ongoing'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${badge.cls}`}>
                    {badge.icon}{badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
