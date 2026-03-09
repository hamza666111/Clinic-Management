import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const reviews = [
  { name: 'Sarah Mitchell', role: 'Elementary School Teacher', rating: 5, date: 'January 2024', text: 'PearlSmile completely transformed my smile and my confidence. The team is incredibly professional, and every appointment is a genuinely pleasant experience. The whitening results were beyond what I hoped for!', avatar: 'SM', treatment: 'Teeth Whitening' },
  { name: 'James Rodriguez', role: 'Marketing Director', rating: 5, date: 'December 2023', text: 'Best dental experience I\'ve ever had, hands down. Modern facility, completely painless procedures, and the staff genuinely cares about patient comfort. My implants look completely natural.', avatar: 'JR', treatment: 'Dental Implants' },
  { name: 'Emily Chen', role: 'Architect', rating: 5, date: 'February 2024', text: 'The veneer treatment was absolutely flawless. Dr. Chen is an artist — my new smile looks completely natural and I receive compliments everywhere I go. Worth every penny.', avatar: 'EC', treatment: 'Porcelain Veneers' },
  { name: 'Michael Davis', role: 'Entrepreneur', rating: 5, date: 'November 2023', text: 'After years of dental anxiety, PearlSmile made me actually look forward to my appointments. Their gentle approach and thoughtful communication changed everything for me.', avatar: 'MD', treatment: 'Preventive Care' },
  { name: 'Amanda Foster', role: 'Nurse', rating: 5, date: 'March 2024', text: 'As a healthcare professional, I appreciate the attention to sterilization protocols and the clinical excellence. The Invisalign treatment was faster than expected and the results are perfect.', avatar: 'AF', treatment: 'Orthodontics' },
  { name: 'Robert Kim', role: 'Software Engineer', rating: 5, date: 'October 2023', text: 'The CEREC same-day crown was amazing — no temporary crown, no waiting weeks. The technology here is impressive and the crown fits and looks perfect.', avatar: 'RK', treatment: 'Dental Crowns' },
  { name: 'Linda Thompson', role: 'Retired Teacher', rating: 5, date: 'January 2024', text: 'I\'ve been coming here for years and the quality never wavers. Every hygienist is thorough and gentle, and Dr. Smith always explains everything clearly. Truly a five-star practice.', avatar: 'LT', treatment: 'Preventive Care' },
  { name: 'David Park', role: 'Restaurant Owner', rating: 5, date: 'February 2024', text: 'Had an emergency with a cracked tooth and they saw me the same day. The root canal was completely pain-free and they fitted a crown two days later. Exceptional service.', avatar: 'DP', treatment: 'Emergency + Crown' },
];

export default function ReviewsPage() {
  const avgRating = (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1);

  return (
    <div className="min-h-screen">
      <div className="relative py-32 bg-gradient-to-br from-slate-900 via-sky-900 to-slate-900">
        <div className="absolute inset-0 opacity-20">
          <img src="https://images.pexels.com/photos/3779697/pexels-photo-3779697.jpeg?auto=compress&cs=tinysrgb&w=1920" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-sky-400 font-semibold text-sm uppercase tracking-widest">Patient Feedback</span>
            <h1 className="text-5xl font-bold text-white mt-3 mb-5">Patient Reviews</h1>
            <div className="flex items-center justify-center gap-3 mb-5">
              <div className="flex">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-7 h-7 text-amber-400 fill-amber-400" />)}
              </div>
              <span className="text-4xl font-bold text-white">{avgRating}</span>
              <span className="text-slate-300">({reviews.length} reviews)</span>
            </div>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">Real experiences from our valued patients. We are proud of every smile we create.</p>
          </motion.div>
        </div>
      </div>

      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-6 mb-16">
            {[
              { label: 'Average Rating', value: avgRating, suffix: '/5' },
              { label: 'Total Reviews', value: reviews.length.toString(), suffix: '+' },
              { label: 'Recommend Us', value: '98', suffix: '%' },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }} className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-sky-700 mb-1">{stat.value}<span className="text-lg text-gray-500">{stat.suffix}</span></div>
                <div className="text-gray-600 text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
            {reviews.map((review, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                viewport={{ once: true }}
                className="break-inside-avoid bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <Quote className="w-8 h-8 text-sky-100 mb-3" />
                <div className="flex mb-3">
                  {[...Array(review.rating)].map((_, j) => <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-4">"{review.text}"</p>
                <div className="pt-4 border-t border-gray-100">
                  <span className="inline-block bg-sky-50 text-sky-700 text-xs font-medium px-2.5 py-1 rounded-full mb-3">
                    {review.treatment}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-cyan-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {review.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{review.name}</p>
                      <p className="text-gray-500 text-xs">{review.role} · {review.date}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
