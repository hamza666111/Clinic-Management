import { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, MapPin, Clock, MessageCircle, Send } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    await new Promise(r => setTimeout(r, 1500));
    setSending(false);
    toast.success('Message sent! We\'ll be in touch within 24 hours.');
    setForm({ name: '', email: '', phone: '', subject: '', message: '' });
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative py-32 bg-gradient-to-br from-slate-900 via-sky-900 to-slate-900">
        <div className="absolute inset-0 opacity-20">
          <img src="https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg?auto=compress&cs=tinysrgb&w=1920" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-sky-400 font-semibold text-sm uppercase tracking-widest">Get In Touch</span>
            <h1 className="text-5xl font-bold text-white mt-3 mb-5">Contact Us</h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Ready to start your smile journey? Reach out to schedule a consultation or ask any questions.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-10">
            {/* Contact Info */}
            <div className="space-y-6">
              <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Visit Us</h2>
                <div className="space-y-4">
                  {[
                    { icon: MapPin, label: 'Address', value: '123 Healthcare Boulevard\nMedical District, City 12345' },
                    { icon: Phone, label: 'Phone', value: '+1 (555) 123-4567' },
                    { icon: Mail, label: 'Email', value: 'info@pearlsmile.com' },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center shrink-0">
                        <item.icon className="w-5 h-5 text-sky-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium mb-0.5">{item.label}</p>
                        <p className="text-gray-900 font-medium whitespace-pre-line text-sm">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex gap-3 mb-3">
                    <Clock className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 mb-2">Office Hours</p>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex justify-between"><span>Mon – Fri</span><span className="font-medium">8:00 AM – 6:00 PM</span></div>
                        <div className="flex justify-between"><span>Saturday</span><span className="font-medium">9:00 AM – 4:00 PM</span></div>
                        <div className="flex justify-between"><span>Sunday</span><span className="text-gray-400">Closed</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                <a
                  href="https://wa.me/15551234567"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-4 rounded-2xl font-medium transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  <div>
                    <div className="font-semibold">Book via WhatsApp</div>
                    <div className="text-xs text-emerald-100">Fastest response guaranteed</div>
                  </div>
                </a>
              </motion.div>
            </div>

            {/* Contact Form + Map */}
            <div className="lg:col-span-2 space-y-6">
              <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Send a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                      <input
                        required
                        type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300 transition-all"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                      <input
                        required
                        type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300 transition-all"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300 transition-all"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                      <select
                        value={form.subject}
                        onChange={e => setForm({ ...form, subject: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300 transition-all"
                      >
                        <option value="">Select subject</option>
                        <option value="appointment">Book Appointment</option>
                        <option value="general">General Inquiry</option>
                        <option value="emergency">Dental Emergency</option>
                        <option value="billing">Billing Question</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                    <textarea
                      required
                      rows={5}
                      value={form.message}
                      onChange={e => setForm({ ...form, message: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300 transition-all resize-none"
                      placeholder="Tell us about your dental needs..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-sky-500 to-cyan-600 text-white font-semibold rounded-xl hover:from-sky-600 hover:to-cyan-700 transition-all disabled:opacity-60"
                  >
                    {sending ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    {sending ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              </motion.div>

              {/* Map */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 h-64">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.9476519598093!2d-73.98784368459253!3d40.74881797932681!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c259a9b30eac9f%3A0xaca05ca48ab9c3c5!2sEmpire%20State%20Building!5e0!3m2!1sen!2sus!4v1620000000000!5m2!1sen!2sus"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="PearlSmile Clinic Location"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
