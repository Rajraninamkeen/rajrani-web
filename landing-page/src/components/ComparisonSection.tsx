import React from 'react';
import { Check, X, ShieldCheck, Flame, Sparkles } from 'lucide-react';

export const ComparisonSection: React.FC = () => {
  const comparisonItems = [
    {
      feature: 'Cooking Oil Used',
      bilokat: '100% Pure Cold-Pressed Peanut Oil & Olive Spray',
      market: 'Cheap Refined Palm Oil & Palm Olein Fat',
      highlight: true
    },
    {
      feature: 'Spices & Flavors',
      bilokat: 'Authentic hand-pounded Laung, Hing & Kali Mirch',
      market: 'Synthetic flavorings & artificial MSG additives',
      highlight: true
    },
    {
      feature: 'Packaging Technology',
      bilokat: '3-Layer Nitrogen Zip-Lock Pouch (Stays crisp for 9 mo)',
      market: 'Thin clear plastic bag (Goes soggy in days)',
      highlight: false
    },
    {
      feature: 'Production Batch',
      bilokat: 'Fresh artisanal weekly small-batch frying',
      market: 'Mass factory batches sitting on shelves for months',
      highlight: false
    },
    {
      feature: 'Health Impact',
      bilokat: '0g Trans-Fat, Low Cholesterol, Zero Guilt Crunch',
      market: 'Greasy residue, high trans-fat, causes heartburn',
      highlight: true
    }
  ];

  return (
    <section className="py-16 bg-gradient-to-b from-amber-50/80 via-white to-amber-100/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center space-y-3 mb-12">
          <div className="inline-flex items-center gap-1.5 bg-amber-200 text-amber-950 px-3.5 py-1 rounded-full text-xs font-bold border border-amber-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>The Bilokat Quality Standard</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-amber-950 font-serif-display">
            Why Bilokat Tastes 10x Better Than Market Namkeens
          </h2>
          <p className="text-sm sm:text-base text-amber-900/80 max-w-xl mx-auto">
            We refused to compromise on oil or ingredients. Here is how Bilokat compares to standard mass-produced snack brands.
          </p>
        </div>

        {/* Comparison Table Card */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-amber-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-amber-950 text-amber-100 text-xs sm:text-sm font-bold uppercase tracking-wider">
                  <th className="p-4 sm:p-5 w-1/3">Feature</th>
                  <th className="p-4 sm:p-5 w-1/3 bg-amber-900 text-yellow-300 border-x border-amber-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-yellow-400" /> BILOKAT (Premium)
                  </th>
                  <th className="p-4 sm:p-5 w-1/3 text-amber-300/60">
                    Typical Mass Brands
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-amber-100 text-xs sm:text-sm font-medium">
                {comparisonItems.map((item, index) => (
                  <tr key={index} className={item.highlight ? 'bg-amber-50/60' : 'bg-white'}>
                    
                    {/* Feature Title */}
                    <td className="p-4 sm:p-5 font-bold text-amber-950">
                      {item.feature}
                    </td>

                    {/* Bilokat Column */}
                    <td className="p-4 sm:p-5 bg-amber-50/80 border-x border-amber-200 text-amber-950 font-bold">
                      <div className="flex items-start gap-2">
                        <div className="p-1 bg-emerald-100 text-emerald-700 rounded-full shrink-0 mt-0.5">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span>{item.bilokat}</span>
                      </div>
                    </td>

                    {/* Market Column */}
                    <td className="p-4 sm:p-5 text-gray-500">
                      <div className="flex items-start gap-2">
                        <div className="p-1 bg-red-100 text-red-600 rounded-full shrink-0 mt-0.5">
                          <X className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span>{item.market}</span>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="mt-8 bg-gradient-to-r from-amber-900 to-amber-950 text-white rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border border-amber-800">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="p-3 bg-amber-800 rounded-xl shrink-0">
              <Flame className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <div className="font-bold text-sm text-yellow-300">Taste The Pure Peanut Oil Difference Today</div>
              <div className="text-xs text-amber-200">100% Satisfaction or Money Back Freshness Guarantee</div>
            </div>
          </div>

          <a
            href="#catalog-section"
            className="bg-yellow-400 hover:bg-yellow-300 text-amber-950 font-extrabold text-xs px-6 py-3 rounded-xl transition shadow cursor-pointer shrink-0"
          >
            Taste Best Sellers →
          </a>
        </div>

      </div>
    </section>
  );
};
