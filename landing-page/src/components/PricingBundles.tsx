import React from 'react';
import { BUNDLES, Bundle } from '../data/products';
import { ShoppingBag, CheckCircle2, Tag, Flame } from 'lucide-react';

interface PricingBundlesProps {
  onAddBundleToCart: (bundle: Bundle) => void;
}

export const PricingBundles: React.FC<PricingBundlesProps> = ({ onAddBundleToCart }) => {
  return (
    <section className="py-16 bg-gradient-to-b from-amber-100/50 via-white to-amber-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-amber-600 text-white px-3.5 py-1 rounded-full text-xs font-bold shadow-sm">
            <Tag className="w-3.5 h-3.5" />
            <span>Curated Value Saver Bundles</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-amber-950 font-serif-display">
            Best Value Bundles &amp; Festive Hampers
          </h2>
          <p className="text-sm sm:text-base text-amber-900/80 max-w-xl mx-auto">
            Save up to 30% on pre-assorted flavor packs. All bundles include <strong>Free Express Air Shipping</strong> &amp; <strong>Zero Palm Oil Guarantee</strong>.
          </p>
        </div>

        {/* Bundles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {BUNDLES.map((bundle) => (
            <div
              key={bundle.id}
              className={`rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between relative ${
                bundle.popular
                  ? 'bg-gradient-to-b from-amber-950 via-amber-900 to-red-950 text-amber-100 shadow-2xl border-2 border-amber-400 scale-102 lg:-translate-y-2'
                  : 'bg-white text-amber-950 shadow-lg border border-amber-200 hover:shadow-xl'
              }`}
            >
              {/* Popular Badge */}
              {bundle.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-yellow-400 text-amber-950 font-black text-xs px-4 py-1 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-wider">
                  <Flame className="w-3.5 h-3.5 text-red-600 fill-red-600" /> Most Popular Selection
                </div>
              )}

              <div className="space-y-4">
                {/* Image */}
                <div className="relative aspect-16/10 rounded-2xl overflow-hidden bg-amber-950">
                  <img src={bundle.image} alt={bundle.name} className="w-full h-full object-cover" />
                  <span className="absolute top-3 right-3 bg-red-600 text-white font-extrabold text-xs px-3 py-1 rounded-full shadow">
                    {bundle.badge}
                  </span>
                </div>

                {/* Title & Tagline */}
                <div>
                  <h3 className={`text-xl font-extrabold font-serif-display ${bundle.popular ? 'text-white' : 'text-amber-950'}`}>
                    {bundle.name}
                  </h3>
                  <p className={`text-xs mt-1 ${bundle.popular ? 'text-amber-200' : 'text-amber-800'}`}>
                    {bundle.tagline}
                  </p>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-2 pt-2 border-t border-amber-200/30">
                  <span className={`text-3xl font-black ${bundle.popular ? 'text-yellow-400' : 'text-amber-950'}`}>
                    ₹{bundle.price}
                  </span>
                  <span className={`text-sm line-through ${bundle.popular ? 'text-amber-400/60' : 'text-gray-400'}`}>
                    ₹{bundle.originalPrice}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded ml-auto">
                    Save ₹{bundle.savingAmount}
                  </span>
                </div>

                {/* Items Included */}
                <div className="space-y-2 pt-2">
                  <div className={`text-xs font-bold uppercase tracking-wider ${bundle.popular ? 'text-amber-300' : 'text-amber-900'}`}>
                    What's Inside This Pack:
                  </div>
                  <ul className="space-y-1.5 text-xs font-medium">
                    {bundle.items.map((item, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className={`w-4 h-4 shrink-0 ${bundle.popular ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-4">
                <button
                  onClick={() => onAddBundleToCart(bundle)}
                  className={`w-full py-3.5 rounded-2xl font-extrabold text-sm transition-transform active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    bundle.popular
                      ? 'bg-yellow-400 hover:bg-yellow-300 text-amber-950 font-black'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Order Bundle (₹{bundle.price})</span>
                </button>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
