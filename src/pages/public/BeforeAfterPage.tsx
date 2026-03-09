import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';

const cases = [
  {
    id: 1,
    category: 'Whitening',
    title: 'Professional Teeth Whitening',
    before: 'https://images.pexels.com/photos/3762453/pexels-photo-3762453.jpeg?auto=compress&cs=tinysrgb&w=600',
    after: 'https://images.pexels.com/photos/3779697/pexels-photo-3779697.jpeg?auto=compress&cs=tinysrgb&w=600',
    description: '6 shades whiter in a single 90-minute session.',
  },
  {
    id: 2,
    category: 'Veneers',
    title: 'Porcelain Veneers Transformation',
    before: 'https://images.pexels.com/photos/3845548/pexels-photo-3845548.jpeg?auto=compress&cs=tinysrgb&w=600',
    after: 'https://images.pexels.com/photos/3845625/pexels-photo-3845625.jpeg?auto=compress&cs=tinysrgb&w=600',
    description: 'Complete smile makeover with 8 porcelain veneers.',
  },
  {
    id: 3,
    category: 'Implants',
    title: 'Full Arch Restoration',
    before: 'https://images.pexels.com/photos/6627498/pexels-photo-6627498.jpeg?auto=compress&cs=tinysrgb&w=600',
    after: 'https://images.pexels.com/photos/3779709/pexels-photo-3779709.jpeg?auto=compress&cs=tinysrgb&w=600',
    description: 'Implant-supported full arch reconstruction.',
  },
  {
    id: 4,
    category: 'Orthodontics',
    title: 'Clear Aligner Results',
    before: 'https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg?auto=compress&cs=tinysrgb&w=600',
    after: 'https://images.pexels.com/photos/3762453/pexels-photo-3762453.jpeg?auto=compress&cs=tinysrgb&w=600',
    description: 'Perfect alignment achieved in 14 months.',
  },
  {
    id: 5,
    category: 'Whitening',
    title: 'Stain Removal & Whitening',
    before: 'https://images.pexels.com/photos/3779706/pexels-photo-3779706.jpeg?auto=compress&cs=tinysrgb&w=600',
    after: 'https://images.pexels.com/photos/3845625/pexels-photo-3845625.jpeg?auto=compress&cs=tinysrgb&w=600',
    description: 'Professional whitening with deep stain removal.',
  },
  {
    id: 6,
    category: 'Veneers',
    title: 'Smile Design with Veneers',
    before: 'https://images.pexels.com/photos/3845548/pexels-photo-3845548.jpeg?auto=compress&cs=tinysrgb&w=600',
    after: 'https://images.pexels.com/photos/3779709/pexels-photo-3779709.jpeg?auto=compress&cs=tinysrgb&w=600',
    description: 'Custom smile design using 10 ultra-thin veneers.',
  },
];

const categories = ['All', 'Whitening', 'Veneers', 'Implants', 'Orthodontics'];

function SliderComparison({ before, after }: { before: string; after: string }) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current || !isDragging.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pos);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-48 sm:h-56 overflow-hidden rounded-t-2xl cursor-ew-resize select-none"
      onMouseDown={() => { isDragging.current = true; }}
      onMouseUp={() => { isDragging.current = false; }}
      onMouseLeave={() => { isDragging.current = false; }}
      onMouseMove={(e) => handleMove(e.clientX)}
      onTouchStart={() => { isDragging.current = true; }}
      onTouchEnd={() => { isDragging.current = false; }}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
    >
      <img src={after} alt="After" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
        <img src={before} alt="Before" className="w-full h-full object-cover" style={{ width: `${10000 / sliderPos}%`, maxWidth: 'none' }} />
      </div>
      <div className="absolute top-0 bottom-0 flex flex-col items-center z-10" style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}>
        <div className="w-0.5 flex-1 bg-white/80" />
        <div className="w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center my-1">
          <ChevronLeft className="w-3 h-3 text-gray-700 -mr-0.5" />
          <ChevronRight className="w-3 h-3 text-gray-700 -ml-0.5" />
        </div>
        <div className="w-0.5 flex-1 bg-white/80" />
      </div>
      <div className="absolute top-2 left-3 bg-gray-900/70 text-white text-xs px-2 py-1 rounded-lg backdrop-blur-sm">Before</div>
      <div className="absolute top-2 right-3 bg-sky-600/90 text-white text-xs px-2 py-1 rounded-lg backdrop-blur-sm">After</div>
    </div>
  );
}

export default function BeforeAfterPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const filtered = activeCategory === 'All' ? cases : cases.filter(c => c.category === activeCategory);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative py-32 bg-gradient-to-br from-slate-900 via-sky-900 to-slate-900">
        <div className="absolute inset-0 opacity-20">
          <img src="https://images.pexels.com/photos/3779709/pexels-photo-3779709.jpeg?auto=compress&cs=tinysrgb&w=1920" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-sky-400 font-semibold text-sm uppercase tracking-widest">Real Results</span>
            <h1 className="text-5xl font-bold text-white mt-3 mb-5">Before & After</h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              See the transformative power of our dental treatments through real patient cases. Drag the slider to reveal the difference.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filter */}
          <div className="flex flex-wrap gap-2 justify-center mb-12">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeCategory === cat ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/25' : 'bg-white text-gray-700 hover:bg-sky-50 border border-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filtered.map((item, i) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group"
                >
                  <SliderComparison before={item.before} after={item.after} />
                  <div className="p-5 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-sky-600 font-semibold uppercase tracking-wide">{item.category}</span>
                      <h3 className="font-semibold text-gray-900 mt-1">{item.title}</h3>
                      <p className="text-gray-600 text-sm mt-1">{item.description}</p>
                    </div>
                    <button
                      onClick={() => setLightboxIndex(filtered.findIndex(f => f.id === item.id))}
                      className="ml-3 w-9 h-9 bg-sky-50 hover:bg-sky-100 rounded-lg flex items-center justify-center text-sky-600 transition-colors shrink-0"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative max-w-4xl w-full">
              <button onClick={() => setLightboxIndex(null)} className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white">
                <X className="w-5 h-5" />
              </button>
              <div className="grid grid-cols-2 gap-4 rounded-2xl overflow-hidden">
                <div className="relative">
                  <img src={filtered[lightboxIndex].before} alt="Before" className="w-full h-80 object-cover" />
                  <div className="absolute top-4 left-4 bg-gray-900/80 text-white text-sm px-3 py-1.5 rounded-lg">Before</div>
                </div>
                <div className="relative">
                  <img src={filtered[lightboxIndex].after} alt="After" className="w-full h-80 object-cover" />
                  <div className="absolute top-4 left-4 bg-sky-600/90 text-white text-sm px-3 py-1.5 rounded-lg">After</div>
                </div>
              </div>
              <div className="text-center mt-6">
                <h3 className="text-white text-xl font-semibold">{filtered[lightboxIndex].title}</h3>
                <p className="text-gray-400 mt-2">{filtered[lightboxIndex].description}</p>
              </div>
              <div className="flex justify-center gap-4 mt-6">
                <button onClick={() => setLightboxIndex((lightboxIndex - 1 + filtered.length) % filtered.length)} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => setLightboxIndex((lightboxIndex + 1) % filtered.length)} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
