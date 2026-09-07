import React from 'react';
import { ShoppingBag, Flame, Sparkles, MessageSquare, Tag } from 'lucide-react';

interface CTABannerProps {
  onOpenCatalog: () => void;
}

export const CTABanner: React.FC<CTABannerProps> = ({ onOpenCatalog }) => {
  return (
    <section className="py-16 bg-gradient-to-r from-amber-950 via-red-950 to-amber-950 text-white relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
        
        <div className="inline-flex items-center gap-2 bg-yellow-400 text-amber-950 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg">
          <Flame className="w-4 h-4 text-red-600 fill-red-600" /> All-India Flash Offer
        </div>

        <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold font-serif-display tracking-tight text-amber-100 max-w-3xl mx-auto">
          Ready To Upgrade Your Daily Chai-Nashta Ritual?
        </h2>

        <p className="text-sm sm:text-lg text-amber-200/90 max-w-2xl mx-auto leading-relaxed">
          Get <strong>20% OFF</strong> your first order + <strong>Free Express Delivery</strong> anywhere in India. Use coupon code <strong className="text-yellow-300 font-mono bg-amber-900 px-2 py-0.5 rounded border border-amber-500/40">BILOKAT20</strong> at checkout.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={onOpenCatalog}
            className="w-full sm:w-auto bg-gradient-to-r from-yellow-400 via-amber-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-amber-950 font-black text-base px-8 py-4 rounded-2xl shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>Order Fresh Namkeen Now</span>
          </button>

          <a
            href="https://wa.me/?text=Hi%20Bilokat!%20I%20want%20to%20order%20fresh%20Namkeen%20combos."
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base px-7 py-4 rounded-2xl transition shadow-lg flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-5 h-5" />
            <span>Order On WhatsApp</span>
          </a>
        </div>

        <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-amber-300 font-semibold">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-yellow-400" /> 100% Pure Peanut Oil
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-yellow-400" /> Cash On Delivery Available
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-yellow-400" /> 2-Day Air Courier Delivery
          </span>
        </div>

      </div>
    </section>
  );
};
