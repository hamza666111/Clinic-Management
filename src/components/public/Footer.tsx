import { Link } from 'react-router-dom';
import { Smile, Phone, Mail, MapPin, Facebook, Instagram, Twitter, MessageCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-cyan-600 rounded-xl flex items-center justify-center">
                <Smile className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold text-white">PearlSmile</span>
                <p className="text-xs text-sky-400 leading-none">Dental Clinic</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-6">
              Delivering world-class dental care with compassion, precision, and the latest technology for beautiful, healthy smiles.
            </p>
            <div className="flex items-center gap-3">
              {[Facebook, Instagram, Twitter].map((Icon, i) => (
                <a key={i} href="#" className="w-9 h-9 bg-gray-800 hover:bg-sky-600 rounded-lg flex items-center justify-center transition-colors">
                  <Icon className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5">Quick Links</h4>
            <ul className="space-y-3">
              {[
                { label: 'Home', to: '/' },
                { label: 'Services', to: '/services' },
                { label: 'Before & After', to: '/before-after' },
                { label: 'Reviews', to: '/reviews' },
                { label: 'About Us', to: '/about' },
                { label: 'Contact', to: '/contact' },
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm hover:text-sky-400 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5">Services</h4>
            <ul className="space-y-3 text-sm">
              {['Teeth Whitening', 'Dental Implants', 'Orthodontics', 'Root Canal', 'Veneers', 'Preventive Care', 'Emergency Dentistry'].map((s) => (
                <li key={s} className="hover:text-sky-400 transition-colors cursor-pointer">{s}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5">Contact Info</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                <span className="text-sm">123 Healthcare Boulevard, Medical District, City 12345</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-sm">+1 (555) 123-4567</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-sm">info@pearlsmile.com</span>
              </li>
            </ul>
            <a
              href="https://wa.me/15551234567"
              target="_blank"
              rel="noreferrer"
              className="mt-6 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Book via WhatsApp
            </a>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm">© {new Date().getFullYear()} PearlSmile Dental Clinic. All rights reserved.</p>
          <p className="text-sm">Crafted with care for beautiful smiles</p>
        </div>
      </div>

      <a
        href="https://wa.me/15551234567"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-30 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/40 hover:scale-110 transition-all"
      >
        <MessageCircle className="w-7 h-7 text-white" />
      </a>
    </footer>
  );
}
