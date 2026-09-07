import React, { useState } from 'react';
import { ShoppingBag, Star, ShieldCheck, Flame, ArrowRight, CheckCircle2, Award, Zap, Info } from 'lucide-react';
import { Product } from '../data/products';

interface HeroProps {
  onQuickAdd: (product: Product) => void;
  featuredProduct: Product;
  onOpenCombo: () => void;
  onOpenCatalog: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onQuickAdd, featuredProduct, onOpenCombo, onOpenCatalog }) => {
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  const hotspots = [
    {
      id: 1,
      x: '30%',
      y: '25%',
      title: 'Hand-pounded Heirloom Clove Spices',
      desc: 'Infused with authentic MP Laung & Kali Mirch for distinct aromatic heat.'
    },
    {
      id: 2,
      x: '70%',
      y: '35%',
      title: '100% Cold-Pressed Peanut Oil',
      desc: 'Zero cheap palm oil or trans fat. Light, crisp, & easy on stomach.'
    },
    {
      id: 3,
      x: '45%',
      y: '75%',
      title: '3-Layer Zip-Lock Freshness Barrier',
      desc: 'Nitrogen flushed packaging ensures 9 months of ultra-crisp crunch.'
    }
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-orange-50/40 to-amber-100/60 pt-6 pb-16 lg:pt-12 lg:pb-24 border-b border-amber-200/50">
      {/* Decorative ambient background glows */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-amber-300/30 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-red-400/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Copy & High Conversion CTAs */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            
            {/* Top Pill Badge */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 text-white px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold shadow-md hover:scale-105 transition-transform duration-300 cursor-default">
              <span className="bg-yellow-300 text-amber-950 px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider">
                Ranked #1
              </span>
              <span className="flex items-center gap-1">
                India’s Favorite Fresh Namkeen <Flame className="w-4 h-4 text-yellow-300 fill-yellow-300" />
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-amber-950 tracking-tight leading-[1.15] font-serif-display">
              The Irresistible <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-amber-600 to-orange-500 underline decoration-amber-400 decoration-wavy decoration-2">Crunch</span> All India Is Craving.
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg text-amber-900/90 leading-relaxed font-normal max-w-2xl mx-auto lg:mx-0">
              Handcrafted in small artisanal batches with <strong>100% Pure Cold-Pressed Peanut Oil</strong> &amp; century-old Bikaneri &amp; Ratlami spice recipes. <strong>0% Palm Oil. 100% Zero Guilt.</strong>
            </p>

            {/* Key Feature Bullets */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 text-xs sm:text-sm font-semibold text-amber-950">
              <div className="flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-2 rounded-xl border border-amber-200/80 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>100% Peanut Oil</span>
              </div>
              <div className="flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-2 rounded-xl border border-amber-200/80 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>3-Layer Zip Lock</span>
              </div>
              <div className="flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-2 rounded-xl border border-amber-200/80 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>2-Day Express Delivery</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
              <button
                onClick={onOpenCatalog}
                className="w-full sm:w-auto bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 hover:from-red-700 hover:to-amber-600 text-white font-extrabold text-base px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group cursor-pointer"
              >
                <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Shop Best Sellers</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={onOpenCombo}
                className="w-full sm:w-auto bg-amber-900 hover:bg-amber-950 text-amber-100 font-extrabold text-base px-7 py-4 rounded-2xl border border-amber-700 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                <span>Build Combo (Flat ₹499)</span>
              </button>
            </div>

            {/* Social Proof Star Rating Bar */}
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs sm:text-sm text-amber-950">
              <div className="flex items-center -space-x-2">
                <img className="w-9 h-9 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" alt="Customer" />
                <img className="w-9 h-9 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" alt="Customer" />
                <img className="w-9 h-9 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" alt="Customer" />
                <img className="w-9 h-9 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80" alt="Customer" />
              </div>

              <div>
                <div className="flex items-center gap-1 text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="font-extrabold text-amber-950 ml-1">4.9/5</span>
                </div>
                <p className="text-amber-800 text-xs">
                  Trusted by <strong>50,000+ Namkeen Lovers</strong> across 18,000+ pincodes
                </p>
              </div>
            </div>

          </div>

          {/* Right Column: Interactive Product Visual with Hotspots & Quick Add */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              
              {/* Main Card Wrapper */}
              <div className="relative rounded-3xl p-2 bg-gradient-to-tr from-amber-200 via-amber-100 to-amber-300 shadow-2xl border border-amber-300/60 transform lg:rotate-1 hover:rotate-0 transition-transform duration-500">
                <div className="relative rounded-2xl overflow-hidden bg-amber-950 group">
                  <img
                    src={featuredProduct.image}
                    alt={featuredProduct.name}
                    className="w-full h-[380px] sm:h-[460px] object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  
                  {/* Dark gradient overlay for text clarity */}
                  <div className="absolute inset-0 bg-gradient-to-t from-amber-950 via-amber-950/30 to-transparent" />

                  {/* Hotspot Pulse Dots */}
                  {hotspots.map((hs) => (
                    <div
                      key={hs.id}
                      style={{ top: hs.y, left: hs.x }}
                      className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2"
                    >
                      <button
                        onClick={() => setActiveTooltip(activeTooltip === hs.id ? null : hs.id)}
                        className="relative flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-amber-950 border-2 border-white shadow-lg font-bold text-xs hover:scale-125 transition-transform cursor-pointer"
                        aria-label={`Hotspot info for ${hs.title}`}
                      >
                        <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
                        <Info className="w-4 h-4 relative z-10" />
                      </button>

                      {/* Tooltip Content */}
                      {activeTooltip === hs.id && (
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-amber-950/95 text-amber-100 text-xs p-3 rounded-xl shadow-2xl border border-amber-500/40 z-30 animate-in fade-in zoom-in-95 duration-200">
                          <p className="font-bold text-yellow-300 mb-1">{hs.title}</p>
                          <p className="text-amber-200 text-[11px] leading-snug">{hs.desc}</p>
                          <button
                            onClick={() => setActiveTooltip(null)}
                            className="mt-2 text-[10px] uppercase font-bold text-amber-400 hover:underline"
                          >
                            Close ✕
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Top Product Badges */}
                  <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
                    <span className="bg-red-600 text-white font-extrabold text-xs px-3 py-1 rounded-full shadow-md uppercase tracking-wider">
                      {featuredProduct.discountPercent}% OFF
                    </span>
                    <span className="bg-amber-500 text-amber-950 font-bold text-xs px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" /> Bestseller
                    </span>
                  </div>

                  {/* Bottom Card Banner & Quick Add */}
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-white z-10">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-amber-300 uppercase tracking-widest">
                          {featuredProduct.regionOrigin}
                        </div>
                        <h3 className="text-xl font-bold font-serif-display text-amber-100">
                          {featuredProduct.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-2xl font-black text-amber-400">
                            ₹{featuredProduct.price}
                          </span>
                          <span className="text-sm line-through text-amber-300/60">
                            ₹{featuredProduct.originalPrice}
                          </span>
                          <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold border border-emerald-500/30">
                            Save ₹{featuredProduct.originalPrice - featuredProduct.price}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => onQuickAdd(featuredProduct)}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-amber-950 font-black text-sm px-4 py-2.5 rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0 flex items-center gap-1.5 cursor-pointer"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>Add +</span>
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* Floating Urgency Tag */}
              <div className="absolute -bottom-5 -left-4 bg-white text-amber-950 font-bold text-xs px-4 py-2.5 rounded-2xl shadow-xl border border-amber-200 flex items-center gap-2 animate-bounce">
                <Flame className="w-4 h-4 text-red-500 fill-red-500" />
                <span>1,420 packs bought today in India!</span>
              </div>

              {/* Floating FSSAI / Pure Oil Tag */}
              <div className="absolute -top-4 -right-4 bg-amber-950 text-amber-100 text-xs px-3.5 py-2 rounded-2xl shadow-xl border border-amber-600/40 hidden sm:flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="font-bold text-amber-300 text-[11px]">100% PURE PEANUT OIL</div>
                  <div className="text-[10px] text-amber-400">0% Palm Oil • 0% Trans Fat</div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
