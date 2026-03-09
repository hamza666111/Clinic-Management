import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Star, Shield, Award, Zap, Users, MessageCircle, CheckCircle, ArrowRight } from 'lucide-react';
import OptimizedImage from '../../components/ui/OptimizedImage';

const heroSlides = [
  {
    image: 'https://images.pexels.com/photos/3845625/pexels-photo-3845625.jpeg?auto=compress&cs=tinysrgb&w=1920',
    title: 'Your Perfect Smile Awaits',
    subtitle: 'World-class dental care delivered with precision, compassion, and artistry.',
  },
  {
    image: 'https://images.pexels.com/photos/3779709/pexels-photo-3779709.jpeg?auto=compress&cs=tinysrgb&w=1920',
    title: 'Advanced Dental Technology',
    subtitle: 'State-of-the-art equipment for comfortable, accurate, and lasting treatments.',
  },
  {
    image: 'https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg?auto=compress&cs=tinysrgb&w=1920',
    title: 'Trusted by Thousands',
    subtitle: 'Join a community of patients who trust us with their most important asset — their smile.',
  },
];

const stats = [
  { value: 1000, suffix: '+', label: 'Patients Treated', icon: Users },
  { value: 5, suffix: '+', label: 'Years Excellence', icon: Award },
  { value: 12, suffix: '', label: 'Certified Specialists', icon: Shield },
  { value: 98, suffix: '%', label: 'Patient Satisfaction', icon: Star },
];

const services = [
  {
    title: 'Teeth Whitening',
    description: 'Professional-grade whitening treatments for a brilliantly bright smile in just one session.',
    image: 'https://images.pexels.com/photos/3762453/pexels-photo-3762453.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: 'from-sky-400 to-cyan-500',
  },
  {
    title: 'Dental Implants',
    description: 'Permanent, natural-looking tooth replacements that restore full function and confidence.',
    image: 'https://images.pexels.com/photos/6627498/pexels-photo-6627498.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: 'from-blue-400 to-sky-500',
  },
  {
    title: 'Orthodontics',
    description: 'Clear aligners and traditional braces to straighten teeth for a perfect, healthy bite.',
    image: 'https://images.pexels.com/photos/3845548/pexels-photo-3845548.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: 'from-cyan-400 to-teal-500',
  },
  {
    title: 'Porcelain Veneers',
    description: 'Ultra-thin ceramic shells that transform the appearance of your teeth instantly.',
    image: 'https://images.pexels.com/photos/3779697/pexels-photo-3779697.jpeg?auto=compress&cs=tinysrgb&w=600',
    color: 'from-teal-400 to-emerald-500',
  },
];

const testimonials = [
  { name: 'Sarah Mitchell', role: 'Teacher', rating: 5, text: 'PearlSmile completely transformed my smile. The team is professional, gentle, and the results are breathtaking. I couldn\'t be happier!', avatar: 'SM' },
  { name: 'James Rodriguez', role: 'Marketing Director', rating: 5, text: 'Best dental experience I\'ve ever had. Modern facility, painless procedures, and the staff genuinely care about patient comfort.', avatar: 'JR' },
  { name: 'Emily Chen', role: 'Architect', rating: 5, text: 'The veneer treatment was flawless. Dr. Chen is an artist — my new smile looks completely natural and I receive compliments constantly.', avatar: 'EC' },
  { name: 'Michael Davis', role: 'Entrepreneur', rating: 5, text: 'After years of dental anxiety, PearlSmile made me look forward to my appointments. Their gentle approach changed everything for me.', avatar: 'MD' },
];

const whyUs = [
  { icon: Shield, title: 'Certified Specialists', text: 'Board-certified dentists with advanced training in cosmetic, restorative, and implant dentistry.' },
  { icon: Zap, title: 'Advanced Technology', text: 'Digital X-rays, 3D imaging, laser dentistry, and same-day crowns for faster, better results.' },
  { icon: Award, title: 'Award-Winning Care', text: 'Recognized as a top dental practice with multiple patient satisfaction and excellence awards.' },
  { icon: CheckCircle, title: 'Pain-Free Experience', text: 'Sedation options and gentle techniques ensure comfortable, anxiety-free dental visits.' },
];

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const step = value / 60;
    let current = 0;
    const timer = setInterval(() => {
      current += step;
      if (current >= value) { setCount(value); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, value]);

  return <div ref={ref}>{count}{suffix}</div>;
}

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % heroSlides.length), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTestimonial((prev) => (prev + 1) % testimonials.length), 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative h-screen min-h-[600px] overflow-hidden">
        {heroSlides.map((slide, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: i === currentSlide ? 1 : 0 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0"
          >
            <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/80" />
          </motion.div>
        ))}

        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-6">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-white/90 text-sm font-medium">5-Star Rated Dental Excellence</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-6 leading-tight max-w-5xl">
              {heroSlides[currentSlide].title}
            </h1>
            <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
              {heroSlides[currentSlide].subtitle}
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
              <Link
                to="/contact"
                className="px-8 py-4 bg-gradient-to-r from-sky-500 to-cyan-600 text-white font-semibold rounded-2xl hover:from-sky-600 hover:to-cyan-700 transition-all shadow-2xl shadow-sky-500/40 hover:scale-105 active:scale-95"
              >
                Book Appointment
              </Link>
              <a
                href="https://wa.me/15551234567"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-8 py-4 bg-emerald-500 text-white font-semibold rounded-2xl hover:bg-emerald-600 transition-all"
              >
                <MessageCircle className="w-5 h-5" />
                WhatsApp Us
              </a>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {heroSlides.map((_, i) => (
            <button key={i} onClick={() => setCurrentSlide(i)} className={`transition-all ${i === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/40'} h-2 rounded-full`} />
          ))}
        </div>

        <button onClick={() => setCurrentSlide((p) => (p - 1 + heroSlides.length) % heroSlides.length)} className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button onClick={() => setCurrentSlide((p) => (p + 1) % heroSlides.length)} className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Stats */}
      <div className="bg-gradient-to-r from-sky-600 to-cyan-700 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center text-white"
              >
                <stat.icon className="w-8 h-8 mx-auto mb-3 opacity-80" />
                <div className="text-4xl font-bold mb-1">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-sky-100 text-sm font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-sky-600 font-semibold text-sm uppercase tracking-widest">Our Expertise</span>
            <h2 className="text-4xl font-bold text-gray-900 mt-3 mb-4">Comprehensive Dental Services</h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">From routine cleanings to complete smile transformations, we offer the full spectrum of modern dental care.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="h-48 overflow-hidden relative">
                  <OptimizedImage src={service.image} alt={service.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
                  <div className={`absolute inset-0 bg-gradient-to-t ${service.color} opacity-30 group-hover:opacity-50 transition-opacity`} />
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-gray-900 mb-2">{service.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{service.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link to="/services" className="inline-flex items-center gap-2 text-sky-600 font-semibold hover:text-sky-700 transition-colors">
              View All Services <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Why Choose Us */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="text-sky-600 font-semibold text-sm uppercase tracking-widest">Why Choose Us</span>
              <h2 className="text-4xl font-bold text-gray-900 mt-3 mb-6">Excellence in Every Smile We Create</h2>
              <p className="text-gray-600 text-lg mb-10 leading-relaxed">
                At PearlSmile, we combine cutting-edge technology with genuine care to deliver dental experiences that exceed expectations every time.
              </p>
              <div className="grid sm:grid-cols-2 gap-6">
                {whyUs.map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }} className="flex gap-4">
                    <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-gray-600 text-sm leading-relaxed">{item.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <OptimizedImage src="https://images.pexels.com/photos/3845625/pexels-photo-3845625.jpeg?auto=compress&cs=tinysrgb&w=800" alt="Modern dental clinic" className="w-full h-[500px] object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-sky-900/30 to-transparent" />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl p-5 shadow-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {['SM', 'JR', 'EC'].map((init, i) => (
                      <div key={i} className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-cyan-600 flex items-center justify-center text-white text-xs font-bold border-2 border-white">
                        {init}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">1000+ happy patients</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="text-sky-600 font-semibold text-sm uppercase tracking-widest">Patient Stories</span>
            <h2 className="text-4xl font-bold text-gray-900 mt-3 mb-4">What Our Patients Say</h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className={`bg-white rounded-2xl p-6 shadow-sm border transition-all duration-300 ${i === currentTestimonial ? 'border-sky-200 shadow-lg' : 'border-gray-100'}`}
              >
                <div className="flex mb-3">
                  {[...Array(t.rating)].map((_, j) => <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-gray-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="py-24 bg-gradient-to-br from-sky-600 via-cyan-600 to-teal-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">Ready for Your Best Smile?</h2>
            <p className="text-xl text-sky-100 mb-10 max-w-2xl mx-auto">Take the first step toward a healthier, more confident smile today. Our team is ready to welcome you.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/contact" className="px-8 py-4 bg-white text-sky-700 font-bold rounded-2xl hover:bg-sky-50 transition-all shadow-2xl hover:scale-105 active:scale-95">
                Schedule Your Visit
              </Link>
              <a href="https://wa.me/15551234567" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 px-8 py-4 bg-emerald-500 text-white font-semibold rounded-2xl hover:bg-emerald-600 transition-all">
                <MessageCircle className="w-5 h-5" />
                Chat on WhatsApp
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
