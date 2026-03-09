import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Pencil, Trash2, Tag, ChevronDown, CheckCircle2, DollarSign, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DentalService, ClinicServicePrice, Clinic } from '../../lib/types';
import { formatPKR } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const CATEGORIES = [
  'General Treatments',
  'Restorative Treatments',
  'Cosmetic Treatments',
  'Orthodontic Treatments',
  'Oral Surgery',
  'Implant Procedures',
  'Prosthetic Treatments',
  'Children Treatments',
  'Gum Treatments',
  'Root Canal Procedures',
];

const CATEGORY_COLORS: Record<string, string> = {
  'General Treatments': 'bg-sky-100 text-sky-700',
  'Restorative Treatments': 'bg-teal-100 text-teal-700',
  'Cosmetic Treatments': 'bg-rose-100 text-rose-700',
  'Orthodontic Treatments': 'bg-amber-100 text-amber-700',
  'Oral Surgery': 'bg-red-100 text-red-700',
  'Implant Procedures': 'bg-emerald-100 text-emerald-700',
  'Prosthetic Treatments': 'bg-blue-100 text-blue-700',
  'Children Treatments': 'bg-pink-100 text-pink-700',
  'Gum Treatments': 'bg-lime-100 text-lime-700',
  'Root Canal Procedures': 'bg-orange-100 text-orange-700',
};

const emptyForm = () => ({
  service_name: '',
  category: CATEGORIES[0],
  default_price: '',
  description: '',
});

export default function DentalServicesPage() {
  const { profile } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<'services' | 'clinic_prices'>('services');
  const [services, setServices] = useState<DentalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editService, setEditService] = useState<DentalService | null>(null);
  const [deleteService, setDeleteService] = useState<DentalService | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const [clinicPrices, setClinicPrices] = useState<ClinicServicePrice[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const isClinicAdmin = profile?.role === 'clinic_admin';
  const canManageServices = isAdmin || isClinicAdmin;
  const canManageClinicPrices = isAdmin || isClinicAdmin;

  const fetchServices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('dental_services')
      .select('*')
      .order('category')
      .order('sort_order');
    setServices((data || []) as DentalService[]);
    setLoading(false);
  }, []);

  const fetchClinicPrices = useCallback(async (clinicId: string) => {
    if (!clinicId) return;
    const { data } = await supabase
      .from('clinic_service_prices')
      .select('*')
      .eq('clinic_id', clinicId);
    setClinicPrices((data || []) as ClinicServicePrice[]);
    const edits: Record<string, string> = {};
    (data || []).forEach((p: ClinicServicePrice) => {
      edits[p.service_id] = String(p.price);
    });
    setPriceEdits(edits);
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  useEffect(() => {
    if (!canManageClinicPrices) return;
    if (isAdmin) {
      supabase.from('clinics').select('*').order('clinic_name').then(({ data }) => {
        setClinics(data || []);
      });
    } else if (isClinicAdmin && profile?.clinic_id) {
      supabase.from('clinics').select('*').eq('id', profile.clinic_id).then(({ data }) => {
        setClinics(data || []);
        if (data && data.length > 0) {
          setSelectedClinicId(data[0].id);
        }
      });
    }
  }, [canManageClinicPrices, isAdmin, isClinicAdmin, profile]);

  useEffect(() => {
    if (selectedClinicId) {
      fetchClinicPrices(selectedClinicId);
    }
  }, [selectedClinicId, fetchClinicPrices]);

  const openAdd = () => {
    setEditService(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (svc: DentalService) => {
    setEditService(svc);
    setForm({
      service_name: svc.service_name,
      category: svc.category,
      default_price: String(svc.default_price),
      description: svc.description,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.service_name.trim()) { toast.error('Service name is required.'); return; }
    setSaving(true);
    const payload = {
      service_name: form.service_name.trim(),
      category: form.category,
      default_price: Number(form.default_price || 0),
      description: form.description.trim(),
    };
    if (editService) {
      const { error } = await supabase.from('dental_services').update(payload).eq('id', editService.id);
      if (error) { toast.error('Failed to update service.'); setSaving(false); return; }
      toast.success('Service updated.');
    } else {
      const { error } = await supabase.from('dental_services').insert({ ...payload, is_active: true });
      if (error) { toast.error('Failed to add service.'); setSaving(false); return; }
      toast.success('Service added.');
    }
    setSaving(false);
    setShowForm(false);
    fetchServices();
  };

  const handleDelete = async () => {
    if (!deleteService) return;
    await supabase.from('dental_services').delete().eq('id', deleteService.id);
    toast.success('Service removed.');
    setDeleteService(null);
    fetchServices();
  };

  const toggleActive = async (svc: DentalService) => {
    await supabase.from('dental_services').update({ is_active: !svc.is_active }).eq('id', svc.id);
    toast.success(svc.is_active ? 'Service hidden.' : 'Service restored.');
    fetchServices();
  };

  const handleSaveClinicPrices = async () => {
    if (!selectedClinicId) { toast.error('Select a clinic first.'); return; }
    setSavingPrices(true);
    const upserts = Object.entries(priceEdits)
      .filter(([, v]) => v !== '' && !isNaN(Number(v)))
      .map(([service_id, price]) => ({
        clinic_id: selectedClinicId,
        service_id,
        price: Number(price),
      }));
    if (upserts.length === 0) { setSavingPrices(false); toast.success('No changes to save.'); return; }
    const { error } = await supabase.from('clinic_service_prices').upsert(upserts, { onConflict: 'clinic_id,service_id' });
    setSavingPrices(false);
    if (error) { toast.error('Failed to save prices.'); return; }
    toast.success('Clinic prices saved.');
    fetchClinicPrices(selectedClinicId);
  };

  const handleClearClinicPrice = async (serviceId: string) => {
    await supabase.from('clinic_service_prices').delete().eq('clinic_id', selectedClinicId).eq('service_id', serviceId);
    setPriceEdits(prev => { const n = { ...prev }; delete n[serviceId]; return n; });
    setClinicPrices(prev => prev.filter(p => p.service_id !== serviceId));
    toast.success('Custom price cleared.');
  };

  const filtered = services.filter(s => {
    const matchSearch = !search || s.service_name.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCategory || s.category === filterCategory;
    return matchSearch && matchCat;
  });

  const grouped = filtered.reduce<Record<string, DentalService[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search services..."
              className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 w-52 bg-white"
            />
          </div>
          <div className="relative">
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManageClinicPrices && (
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button onClick={() => setTab('services')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'services' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}>
                <Tag className="w-4 h-4" /> Services
              </button>
              <button onClick={() => setTab('clinic_prices')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'clinic_prices' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}>
                <DollarSign className="w-4 h-4" /> Clinic Prices
              </button>
            </div>
          )}
          {canManageServices && tab === 'services' && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Service
            </button>
          )}
        </div>
      </div>

      {tab === 'services' ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{services.filter(s => s.is_active).length}</p>
              <p className="text-sm text-gray-500 mt-0.5">Active Services</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-2xl font-bold text-sky-700">{CATEGORIES.length}</p>
              <p className="text-sm text-gray-500 mt-0.5">Categories</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-2xl font-bold text-emerald-700">{formatPKR(Math.min(...services.filter(s => s.default_price > 0).map(s => s.default_price)))}</p>
              <p className="text-sm text-gray-500 mt-0.5">Lowest Price</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-2xl font-bold text-amber-700">{formatPKR(Math.max(...services.map(s => s.default_price)))}</p>
              <p className="text-sm text-gray-500 mt-0.5">Highest Price</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="h-4 bg-gray-100 rounded w-40 mb-4 animate-pulse" />
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="h-12 bg-gray-50 rounded-xl mb-2 animate-pulse" />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([category, svcs]) => (
                <div key={category} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
                    <Tag className="w-4 h-4 text-gray-400" />
                    <h3 className="font-semibold text-gray-800">{category}</h3>
                    <span className="text-xs text-gray-400 ml-auto">{svcs.length} service{svcs.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {svcs.map((svc, i) => (
                      <motion.div
                        key={svc.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors ${!svc.is_active ? 'opacity-50' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900 text-sm">{svc.service_name}</p>
                            {!svc.is_active && (
                              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Hidden</span>
                            )}
                          </div>
                          {svc.description && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-md">{svc.description}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-900">{formatPKR(svc.default_price)}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[svc.category] || 'bg-gray-100 text-gray-600'}`}>
                            {svc.category}
                          </span>
                        </div>
                        {canManageServices && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => toggleActive(svc)}
                              title={svc.is_active ? 'Hide service' : 'Show service'}
                              className={`p-2 rounded-lg transition-colors ${svc.is_active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEdit(svc)}
                              className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => setDeleteService(svc)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <DollarSign className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-700">Set custom prices for a specific clinic. These override the default prices shown on invoices for that clinic. Leave blank to use the default price.</p>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={selectedClinicId}
                onChange={e => setSelectedClinicId(e.target.value)}
                className="px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm bg-white w-64"
              >
                <option value="">Select a clinic to edit prices</option>
                {clinics.map(c => <option key={c.id} value={c.id}>{c.clinic_name}</option>)}
              </select>
            </div>
          )}

          {selectedClinicId && (
            <>
              <div className="space-y-4">
                {Object.entries(
                  services
                    .filter(s => s.is_active)
                    .reduce<Record<string, DentalService[]>>((acc, s) => {
                      if (!acc[s.category]) acc[s.category] = [];
                      acc[s.category].push(s);
                      return acc;
                    }, {})
                ).map(([category, svcs]) => (
                  <div key={category} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-600'}`}>{category}</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {svcs.map(svc => {
                        const hasCustom = clinicPrices.some(p => p.service_id === svc.id);
                        return (
                          <div key={svc.id} className="flex items-center gap-4 px-5 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{svc.service_name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">Default: {formatPKR(svc.default_price)}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">PKR</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={priceEdits[svc.id] ?? ''}
                                  onChange={e => setPriceEdits(prev => ({ ...prev, [svc.id]: e.target.value }))}
                                  placeholder={String(svc.default_price)}
                                  className="pl-10 pr-3 py-2 w-36 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
                                />
                              </div>
                              {hasCustom && (
                                <button
                                  onClick={() => handleClearClinicPrice(svc.id)}
                                  title="Reset to default"
                                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {hasCustom && (
                                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Custom</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveClinicPrices}
                  disabled={savingPrices}
                  className="flex items-center gap-2 px-6 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium disabled:opacity-60"
                >
                  {savingPrices && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Save Clinic Prices
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editService ? 'Edit Service' : 'Add Service'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Service Name *</label>
            <input
              required
              type="text"
              value={form.service_name}
              onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))}
              placeholder="e.g. Root Canal Treatment"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category *</label>
            <div className="relative">
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full appearance-none px-3.5 py-2.5 pr-9 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm bg-white"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Price (PKR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.default_price}
              onChange={e => setForm(f => ({ ...f, default_price: e.target.value }))}
              placeholder="0.00"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (optional)</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description shown on the public services page..."
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm resize-none"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-medium disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editService ? 'Save Changes' : 'Add Service'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteService}
        onConfirm={handleDelete}
        onCancel={() => setDeleteService(null)}
        title="Remove Service"
        message={`Remove "${deleteService?.service_name}" from the master list? This will not affect existing invoices.`}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}
