import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Smile, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

export default function StaffLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (user) {
      navigate('/portal');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error('Invalid email or password. Please try again.');
    } else {
      toast.success('Welcome back!');
      navigate('/portal');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-sky-900 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.pexels.com/photos/3845625/pexels-photo-3845625.jpeg?auto=compress&cs=tinysrgb&w=1200"
            alt="Dental clinic"
            className="w-full h-full object-cover opacity-25"
          />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-cyan-600 rounded-xl flex items-center justify-center">
              <Smile className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-white">PearlSmile</span>
              <p className="text-xs text-sky-300 leading-none">Dental Clinic</p>
            </div>
          </Link>

          <div>
            <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
              Staff Management Portal
            </h2>
            <p className="text-slate-300 text-lg leading-relaxed mb-8">
              Access patient records, manage appointments, create prescriptions, and streamline your entire clinical workflow.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Patient Records', desc: 'Complete medical & dental history' },
                { label: 'Appointments', desc: 'Schedule & manage bookings' },
                { label: 'Prescriptions', desc: 'Digital prescription system' },
                { label: 'Billing', desc: 'POS-style invoice management' },
              ].map((item, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <p className="text-white font-semibold text-sm mb-1">{item.label}</p>
                  <p className="text-slate-400 text-xs">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-slate-500 text-sm">© {new Date().getFullYear()} PearlSmile. All rights reserved.</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center justify-between mb-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-cyan-600 rounded-xl flex items-center justify-center">
                <Smile className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-gray-900">PearlSmile</span>
            </Link>
          </div>

          <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Website
          </Link>

          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Staff Login</h1>
              <p className="text-gray-600">Sign in to access the clinic management portal.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300 transition-all bg-gray-50"
                    placeholder="your@clinic.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300 transition-all bg-gray-50"
                    placeholder="Enter your password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-sky-500 to-cyan-600 text-white font-bold rounded-xl hover:from-sky-600 hover:to-cyan-700 transition-all shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 p-4 bg-sky-50 rounded-xl border border-sky-100">
              <p className="text-sm text-sky-800 font-medium mb-1">Demo Access</p>
              <p className="text-xs text-sky-600">Contact your system administrator for login credentials or to create your staff account.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
