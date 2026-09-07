import React, { useState } from 'react';
import { Flame, ShieldCheck, Send, Check } from 'lucide-react';

export const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="bg-amber-950 text-amber-100 pt-16 pb-8 border-t border-amber-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-red-600 to-amber-500 flex items-center justify-center text-white font-serif-display font-extrabold text-xl shadow-md">
                B
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-white font-serif-display flex items-center gap-1">
                BILOKAT <Flame className="w-4 h-4 text-red-500 fill-red-500" />
              </span>
            </div>

            <p className="text-xs text-amber-200/80 leading-relaxed max-w-sm">
              Bilokat is India’s premier artisanal Namkeen &amp; snack brand. Crafted in small weekly batches with 100% pure cold-pressed Peanut Oil &amp; heirloom regional recipes. Zero Palm Oil. 100% Crisp Perfection.
            </p>

            <div className="flex items-center gap-3 text-xs text-amber-300">
              <div className="bg-amber-900/80 px-3 py-1.5 rounded-xl border border-amber-700/60 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>FSSAI Lic. No: 11422850000392</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3 text-xs">
            <div className="font-extrabold text-white uppercase tracking-wider text-sm font-serif-display">
              Popular Namkeens
            </div>
            <ul className="space-y-2 text-amber-300/80">
              <li><a href="#catalog-section" className="hover:text-yellow-400 transition">Royal Ratlami Sev</a></li>
              <li><a href="#catalog-section" className="hover:text-yellow-400 transition">Shahi Rajwadi Kaju Blend</a></li>
              <li><a href="#catalog-section" className="hover:text-yellow-400 transition">Malwa Khatta Meetha Mixture</a></li>
              <li><a href="#catalog-section" className="hover:text-yellow-400 transition">Bikaneri Aloo Bhujia</a></li>
              <li><a href="#catalog-section" className="hover:text-yellow-400 transition">Roasted Peri Peri Makhana</a></li>
            </ul>
          </div>

          {/* Regional Roots */}
          <div className="space-y-3 text-xs">
            <div className="font-extrabold text-white uppercase tracking-wider text-sm font-serif-display">
              Regional Specialties
            </div>
            <ul className="space-y-2 text-amber-300/80">
              <li><span>🌶️ Ratlam Clove Sev</span></li>
              <li><span>🥔 Bikaner Moth Bhujia</span></li>
              <li><span>🌰 Jodhpur Shahi Dry Fruit</span></li>
              <li><span>🥭 Indore Malwa Mixture</span></li>
              <li><span>🍃 Surat Silk Nylon Sev</span></li>
            </ul>
          </div>

          {/* Newsletter Box */}
          <div className="space-y-3 text-xs">
            <div className="font-extrabold text-white uppercase tracking-wider text-sm font-serif-display">
              Free Sample Alerts
            </div>
            <p className="text-amber-200/80">
              Subscribe to get secret discount codes &amp; free new snack sample boxes!
            </p>

            {subscribed ? (
              <div className="bg-emerald-950 text-emerald-300 p-3 rounded-xl border border-emerald-500/40 flex items-center gap-2 font-bold">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Subscribed! Check your inbox for 20% coupon.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-2">
                <div className="flex bg-amber-900 border border-amber-700 rounded-xl overflow-hidden p-1">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="bg-transparent px-3 text-xs text-white outline-none w-full placeholder:text-amber-500"
                  />
                  <button
                    type="submit"
                    className="bg-yellow-400 hover:bg-yellow-300 text-amber-950 font-black p-2 rounded-lg cursor-pointer transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

        {/* Payment & Security Badges */}
        <div className="pt-8 border-t border-amber-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-amber-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-amber-200">100% Safe Checkout:</span>
            <span className="bg-amber-900/60 px-2.5 py-1 rounded text-amber-200 border border-amber-800">UPI (GPay / PhonePe)</span>
            <span className="bg-amber-900/60 px-2.5 py-1 rounded text-amber-200 border border-amber-800">Cash On Delivery</span>
            <span className="bg-amber-900/60 px-2.5 py-1 rounded text-amber-200 border border-amber-800">Credit / Debit Cards</span>
          </div>

          <p className="text-amber-400/60 text-[11px] text-center sm:text-right">
            © {new Date().getFullYear()} Bilokat Foods India Pvt. Ltd. All rights reserved. Handcrafted with ❤️ in India.
          </p>
        </div>

      </div>
    </footer>
  );
};
