import React, { useState } from 'react';
import { Star, ShieldCheck, ThumbsUp, Sparkles } from 'lucide-react';
import { REVIEWS } from '../data/products';

export const ReviewsSection: React.FC = () => {
  const [filterRating] = useState<number | 'all'>('all');

  const filteredReviews = REVIEWS.filter(rev => {
    if (filterRating === 'all') return true;
    return rev.rating === filterRating;
  });

  return (
    <section className="py-16 bg-amber-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center space-y-3 mb-12">
          <div className="inline-flex items-center gap-1.5 bg-amber-200 text-amber-950 px-3.5 py-1 rounded-full text-xs font-bold border border-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>50,000+ Happy Tea-Time Moments</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-amber-950 font-serif-display">
            Loved By Namkeen Lovers All India
          </h2>
          <p className="text-sm sm:text-base text-amber-900/80 max-w-xl mx-auto">
            Real reviews from real buyers across Indore, Jaipur, Delhi, Mumbai, Kolkata, Bengaluru &amp; beyond.
          </p>
        </div>

        {/* Aggregate Stats Summary Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-lg border border-amber-200 mb-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="text-center md:text-left space-y-1 md:border-r border-amber-100 md:pr-6">
            <div className="text-4xl sm:text-5xl font-extrabold text-amber-950 font-serif-display">
              4.9 <span className="text-amber-500 text-2xl">/ 5.0</span>
            </div>
            <div className="flex justify-center md:justify-start text-amber-400 gap-1 my-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-amber-400" />
              ))}
            </div>
            <div className="text-xs text-amber-800 font-bold">
              Based on 18,400+ Verified Web &amp; Amazon Reviews
            </div>
          </div>

          {/* Breakdown bars */}
          <div className="space-y-1.5 text-xs font-bold text-amber-950">
            <div className="flex items-center gap-2">
              <span className="w-12">5 Star</span>
              <div className="flex-1 h-2 bg-amber-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 w-[94%]" />
              </div>
              <span className="w-10 text-right">94%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-12">4 Star</span>
              <div className="flex-1 h-2 bg-amber-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 w-[5%]" />
              </div>
              <span className="w-10 text-right">5%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-12">3 Star</span>
              <div className="flex-1 h-2 bg-amber-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-300 w-[1%]" />
              </div>
              <span className="w-10 text-right">1%</span>
            </div>
          </div>

          {/* Verified Seals */}
          <div className="flex flex-col items-center md:items-end space-y-2 text-center md:text-right md:border-l border-amber-100 md:pl-6">
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-900 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              100% Verified Buyer Reviews
            </div>
            <p className="text-[11px] text-gray-500 max-w-xs">
              Every review is verified via order ID matching before publishing.
            </p>
          </div>
        </div>

        {/* Reviews Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredReviews.map((rev) => (
            <div
              key={rev.id}
              className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-md border border-amber-200 transition space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header author info */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={rev.avatar}
                      alt={rev.name}
                      className="w-11 h-11 rounded-full object-cover border-2 border-amber-300"
                    />
                    <div>
                      <div className="font-extrabold text-amber-950 text-sm flex items-center gap-1.5">
                        <span>{rev.name}</span>
                        {rev.verifiedBuyer && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-amber-700">
                        📍 {rev.location} • <span className="text-gray-400">{rev.date}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stars */}
                  <div className="flex text-amber-400">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                </div>

                {/* Title & Comment */}
                <div>
                  <h4 className="font-bold text-amber-950 text-sm font-serif-display">
                    "{rev.title}"
                  </h4>
                  <p className="text-xs text-amber-900/80 leading-relaxed mt-1">
                    {rev.comment}
                  </p>
                </div>
              </div>

              {/* Product Bought Badge */}
              <div className="pt-3 border-t border-amber-100 flex items-center justify-between text-xs text-amber-800 font-medium">
                <span>Bought: <strong>{rev.productBought}</strong></span>
                <span className="flex items-center gap-1 text-emerald-700 text-[11px] font-bold">
                  <ThumbsUp className="w-3.5 h-3.5" /> Helpful (42)
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Customer Lifestyle Photo Reel */}
        <div className="mt-14 space-y-4">
          <div className="text-center text-xs font-extrabold uppercase tracking-widest text-amber-800">
            📸 Tag @BilokatNamkeen on Instagram to be featured!
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { img: '/images/bilokat-lifestyle.jpg', caption: 'Family Chai Time in Delhi' },
              { img: '/images/bilokat-hero-pack.jpg', caption: 'Ratlami Sev with Morning Poha' },
              { img: '/images/bilokat-assorted-box.jpg', caption: 'Festive Hamper Unboxing' },
              { img: 'https://images.pexels.com/photos/9557672/pexels-photo-9557672.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940', caption: 'Evening Snack Spread' }
            ].map((item, idx) => (
              <div key={idx} className="relative rounded-2xl overflow-hidden group aspect-square shadow-md">
                <img src={item.img} alt={item.caption} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex items-end">
                  <span className="text-white text-xs font-bold">{item.caption}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
