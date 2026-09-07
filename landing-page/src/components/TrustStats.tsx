import React from 'react';
import { ShieldCheck, Truck, Award, HeartHandshake, Sparkles } from 'lucide-react';

export const TrustStats: React.FC = () => {
  const mediaLogos = [
    { name: 'Times of India', label: 'Snack Brand Of The Year' },
    { name: 'NDTV Food', label: 'Authentic Indian Flavors' },
    { name: 'MasterChef India', label: 'Artisanal Spicing Choice' },
    { name: 'Swiggy Instamart', label: 'Top-Rated Namkeen' },
    { name: 'Amazon Launchpad', label: 'Best Seller 2025' }
  ];

  const stats = [
    {
      value: '5M+',
      label: 'Packs Enjoyed',
      subtext: 'Across 28 States & UTs',
      icon: HeartHandshake,
      color: 'from-amber-500 to-amber-600'
    },
    {
      value: '4.9★',
      label: 'Customer Rating',
      subtext: 'Based on 18,400+ Reviews',
      icon: Award,
      color: 'from-red-500 to-amber-600'
    },
    {
      value: '100%',
      label: 'Peanut & Olive Oil',
      subtext: 'Zero Cheap Palm Oil',
      icon: ShieldCheck,
      color: 'from-emerald-500 to-teal-600'
    },
    {
      value: '18.5k+',
      label: 'Pincodes Delivered',
      subtext: 'Free Express Shipping > ₹399',
      icon: Truck,
      color: 'from-amber-600 to-red-600'
    }
  ];

  return (
    <section className="bg-amber-950 text-amber-100 py-12 px-4 sm:px-6 lg:px-8 border-y border-amber-800/60 relative overflow-hidden">
      {/* Background subtle noise/glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Stat Counters Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div 
                key={index}
                className="bg-amber-900/40 hover:bg-amber-900/70 border border-amber-800/60 p-5 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/50 group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${stat.color} text-white shadow-md group-hover:scale-110 transition-transform`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <Sparkles className="w-4 h-4 text-amber-500/40 group-hover:text-amber-400 transition-colors" />
                </div>
                <div className="text-2xl sm:text-4xl font-extrabold text-amber-100 font-serif-display tracking-tight">
                  {stat.value}
                </div>
                <div className="text-sm font-bold text-amber-300 mt-0.5">
                  {stat.label}
                </div>
                <div className="text-xs text-amber-400/80 mt-1 font-medium">
                  {stat.subtext}
                </div>
              </div>
            );
          })}
        </div>

        {/* Brand Guarantees & Media Badges */}
        <div className="pt-6 border-t border-amber-800/40 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-400/80 shrink-0 text-center md:text-left">
            AS FEATURED IN &amp; TRUSTED BY
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 opacity-80 hover:opacity-100 transition-opacity">
            {mediaLogos.map((item, i) => (
              <div key={i} className="flex flex-col items-center group cursor-default">
                <span className="font-serif-display font-extrabold text-base sm:text-lg text-amber-200 group-hover:text-yellow-400 transition-colors">
                  {item.name}
                </span>
                <span className="text-[10px] text-amber-400/70 uppercase tracking-wider font-semibold">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
