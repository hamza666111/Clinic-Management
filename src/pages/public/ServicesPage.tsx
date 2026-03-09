import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPKR } from '../../lib/format';
import { DentalService } from '../../lib/types';

const CATEGORY_IMAGES: Record<string, string> = {
  'General Treatments': 'https://images.pexels.com/photos/3845625/pexels-photo-3845625.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Restorative Treatments': 'https://images.pexels.com/photos/3779709/pexels-photo-3779709.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Cosmetic Treatments': 'https://images.pexels.com/photos/3762453/pexels-photo-3762453.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Orthodontic Treatments': 'https://images.pexels.com/photos/3845548/pexels-photo-3845548.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Oral Surgery': 'https://images.pexels.com/photos/3779706/pexels-photo-3779706.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Implant Procedures': 'https://images.pexels.com/photos/6627498/pexels-photo-6627498.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Prosthetic Treatments': 'https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Children Treatments': 'https://images.pexels.com/photos/3779697/pexels-photo-3779697.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Gum Treatments': 'https://images.pexels.com/photos/3762453/pexels-photo-3762453.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Root Canal Procedures': 'https://images.pexels.com/photos/3779709/pexels-photo-3779709.jpeg?auto=compress&cs=tinysrgb&w=600',
};

const CATEGORY_COLORS: Record<string, string> = {
  'General Treatments': 'bg-sky-500',
  'Restorative Treatments': 'bg-teal-500',
  'Cosmetic Treatments': 'bg-rose-500',
  'Orthodontic Treatments': 'bg-amber-500',
  'Oral Surgery': 'bg-red-500',
  'Implant Procedures': 'bg-emerald-500',
  'Prosthetic Treatments': 'bg-blue-500',
  'Children Treatments': 'bg-pink-500',
  'Gum Treatments': 'bg-lime-600',
  'Root Canal Procedures': 'bg-orange-500',
};

export default function ServicesPage() {
  const [services, setServices] = useState<DentalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('dental_services')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('sort_order')
      .then(({ data }) => {
        setServices((data || []) as DentalService[]);
        setLoading(false);
      });
  }, []);

  const categories = ['All', ...Array.from(new Set(services.map(s => s.category)))];

  const grouped = services.reduce<Record<string, DentalService[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const visibleCategories = activeCategory === 'All'
    ? Object.keys(grouped)
    : Object.keys(grouped).filter(c => c === activeCategory);

  const openCategory = selectedCategory ? grouped[selectedCategory] || [] : [];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative py-32 bg-gradient-to-br from-slate-900 via-sky-900 to-slate-900">
        <div className="absolute inset-0 opacity-20">
          <img src="https://images.pexels.com/photos/3845625/pexels-photo-3845625.jpeg?auto=compress&cs=tinysrgb&w=1920" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-sky-400 font-semibold text-sm uppercase tracking-widest">Our Treatments</span>
            <h1 className="text-5xl font-bold text-white mt-3 mb-5">Dental Services</h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Comprehensive dental care across every specialty — from routine checkups to advanced restorative and cosmetic procedures.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 justify-center mb-12">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/25'
                    : 'bg-white text-gray-700 hover:bg-sky-50 border border-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                  <div className="h-44 bg-gray-200 animate-pulse" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence>
                {visibleCategories.map((category, i) => {
                  const catServices = grouped[category];
                  const img = CATEGORY_IMAGES[category] || CATEGORY_IMAGES['General Treatments'];
                  const color = CATEGORY_COLORS[category] || 'bg-sky-500';
                  const minPrice = Math.min(...catServices.map(s => s.default_price).filter(p => p > 0));
                  return (
                    <motion.div
                      key={category}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: i * 0.04 }}
                      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1"
                      onClick={() => setSelectedCategory(category)}
                    >
                      <div className="relative h-44 overflow-hidden">
                        <img src={img} alt={category} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute top-3 left-3">
                          <span className={`${color} text-white text-xs font-semibold px-2.5 py-1 rounded-full`}>
                            {catServices.length} services
                          </span>
                        </div>
                      </div>
                      <div className="p-5">
                        <h3 className="font-semibold text-gray-900 mb-1.5 text-base">{category}</h3>
                        <p className="text-gray-500 text-sm mb-3">{catServices.slice(0, 2).map(s => s.service_name).join(', ')}{catServices.length > 2 ? ` +${catServices.length - 2} more` : ''}</p>
                        {minPrice > 0 && isFinite(minPrice) && (
                          <p className="text-xs text-sky-600 font-semibold">From {formatPKR(minPrice)}</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {/* Category Detail Modal */}
      <AnimatePresence>
        {selectedCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedCategory(null)} />
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-hidden flex flex-col z-10"
            >
              <div className="relative h-48 shrink-0">
                <img src={CATEGORY_IMAGES[selectedCategory] || CATEGORY_IMAGES['General Treatments']} alt={selectedCategory} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <button onClick={() => setSelectedCategory(null)} className="absolute top-4 right-4 w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-colors">
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-4 left-6">
                  <span className={`${CATEGORY_COLORS[selectedCategory] || 'bg-sky-500'} text-white text-xs font-semibold px-3 py-1 rounded-full`}>{selectedCategory}</span>
                  <h2 className="text-2xl font-bold text-white mt-1.5">{openCategory.length} Services</h2>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 p-6">
                <div className="space-y-3">
                  {openCategory.map(svc => (
                    <div key={svc.id} className="flex items-start justify-between gap-4 bg-gray-50 rounded-xl px-4 py-3.5">
                      <div className="flex items-start gap-3 flex-1">
                        <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{svc.service_name}</p>
                          {svc.description && <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>}
                        </div>
                      </div>
                      {svc.default_price > 0 && (
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-sky-700">{formatPKR(svc.default_price)}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-3">
                  <Tag className="w-4 h-4 text-gray-400" />
                  <p className="text-sm text-gray-500">Prices shown are standard rates. Final prices may vary based on complexity and clinical assessment.</p>
                </div>

                <button
                  onClick={() => setSelectedCategory(null)}
                  className="mt-5 w-full py-3.5 bg-gradient-to-r from-sky-500 to-cyan-600 text-white font-semibold rounded-xl hover:from-sky-600 hover:to-cyan-700 transition-all"
                >
                  Book an Appointment
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
