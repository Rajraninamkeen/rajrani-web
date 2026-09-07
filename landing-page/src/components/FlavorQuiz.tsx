import React, { useState } from 'react';
import { Sparkles, ArrowRight, RotateCcw, Check, ShoppingBag } from 'lucide-react';
import { PRODUCTS, Product } from '../data/products';

interface FlavorQuizProps {
  onAddProduct: (product: Product) => void;
  onOpenQuickView: (product: Product) => void;
}

export const FlavorQuiz: React.FC<FlavorQuizProps> = ({ onAddProduct, onOpenQuickView }) => {
  const [step, setStep] = useState(1);
  const [spicePref, setSpicePref] = useState<string>('');
  const [occasion, setOccasion] = useState<string>('');
  const [recommendedProduct, setRecommendedProduct] = useState<Product | null>(null);

  const handleCalculateMatch = (selectedTexture: string) => {
    
    // Logic to select best match based on inputs
    let match = PRODUCTS[0]; // default Ratlami Sev
    if (spicePref === 'fiery') {
      match = PRODUCTS.find(p => p.id === 'ratlami-sev') || PRODUCTS[0];
    } else if (spicePref === 'tangy') {
      match = PRODUCTS.find(p => p.id === 'khatta-meetha-delight') || PRODUCTS[2];
    } else if (spicePref === 'healthy') {
      match = PRODUCTS.find(p => p.id === 'roasted-peri-makhana') || PRODUCTS[4];
    } else if (occasion === 'party') {
      match = PRODUCTS.find(p => p.id === 'shahi-kaju-mixture') || PRODUCTS[1];
    } else if (selectedTexture === 'crisp') {
      match = PRODUCTS.find(p => p.id === 'bikaneri-aloo-bhujia') || PRODUCTS[3];
    }
    
    setRecommendedProduct(match);
    setStep(4);
  };

  const handleReset = () => {
    setStep(1);
    setSpicePref('');
    setOccasion('');
    setRecommendedProduct(null);
  };

  return (
    <section className="py-16 bg-gradient-to-b from-amber-100/60 via-amber-50 to-orange-50/50 relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-900 px-3 py-1 rounded-full text-xs font-bold border border-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Interactive Namkeen Matchmaker</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-amber-950 font-serif-display">
            Find Your Ultimate Namkeen Match in 15 Seconds
          </h2>
          <p className="text-sm sm:text-base text-amber-900/80 max-w-xl mx-auto">
            Not sure which variety to order? Answer 3 quick taste questions &amp; let our Master Halwai recommendation engine pick your match.
          </p>
        </div>

        {/* Quiz Container Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-amber-200/80 relative">
          
          {/* Progress Indicator */}
          {step <= 3 && (
            <div className="mb-8">
              <div className="flex justify-between text-xs font-extrabold text-amber-800 uppercase tracking-wider mb-2">
                <span>Step {step} of 3</span>
                <span>{step === 1 ? 'Spice Tolerance' : step === 2 ? 'Snack Occasion' : 'Texture Preference'}</span>
              </div>
              <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-red-600 transition-all duration-300"
                  style={{ width: `${(step / 3) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* STEP 1: Spice Preference */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h3 className="text-lg sm:text-xl font-bold text-amber-950 text-center">
                1. What is your preferred spice level?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'fiery', label: '🌶️🌶️ Fiery & Bold', desc: 'Love clove heat, black pepper & authentic Ratlami zing' },
                  { id: 'tangy', label: '🥭 Sweet, Tangy & Mild', desc: 'Prefer Khatta Meetha sweet raisins & dry mango twist' },
                  { id: 'savory', label: '🥔 Savory & Medium Spicy', desc: 'Classic Bikaneri potato crunch with hing & cumin' },
                  { id: 'healthy', label: '🍃 Mild & Roasted', desc: 'Minimal salt & spice, high protein roasted nuts/makhana' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSpicePref(item.id);
                      setStep(2);
                    }}
                    className="text-left p-4 rounded-2xl border-2 border-amber-200 hover:border-amber-500 hover:bg-amber-50/80 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="font-extrabold text-amber-950 text-base group-hover:text-amber-700 transition-colors">
                        {item.label}
                      </div>
                      <div className="text-xs text-amber-800/80 mt-1">{item.desc}</div>
                    </div>
                    <div className="mt-3 text-xs font-bold text-amber-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Select option <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Occasion */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h3 className="text-lg sm:text-xl font-bold text-amber-950 text-center">
                2. When do you crave your Namkeen the most?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'chai', label: '☕ 4 PM Masala Chai Ritual', desc: 'Nothing beats crispy sev dipped in hot adrak chai' },
                  { id: 'party', label: '🍷 Weekend Party & Drinks', desc: 'Shahi dry fruit mixtures for hosting friends & family' },
                  { id: 'work', label: '💻 Work Desk Munching', desc: 'Light, non-greasy snacks that keep you focused' },
                  { id: 'chaat', label: '🥗 Home Street Food & Chaats', desc: 'Fine nylon sev & crisp chivda for topping Bhel Puri' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setOccasion(item.id);
                      setStep(3);
                    }}
                    className="text-left p-4 rounded-2xl border-2 border-amber-200 hover:border-amber-500 hover:bg-amber-50/80 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="font-extrabold text-amber-950 text-base group-hover:text-amber-700">
                        {item.label}
                      </div>
                      <div className="text-xs text-amber-800/80 mt-1">{item.desc}</div>
                    </div>
                    <div className="mt-3 text-xs font-bold text-amber-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Select option <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
              <div className="text-center pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="text-xs font-bold text-amber-800 hover:underline cursor-pointer"
                >
                  ← Back to previous question
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Texture */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h3 className="text-lg sm:text-xl font-bold text-amber-950 text-center">
                3. What texture satisfy you the most?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'melt', label: '✨ Melt-In-Mouth Delicate', desc: 'Soft yet spicy gram flour sev with aromatic clove' },
                  { id: 'crisp', label: '⚡ Loud Ultra-Crisp Crunch', desc: 'Thick potato bhujia or double-fried crunchy bites' },
                  { id: 'nuts', label: '🥜 Rich Nutty & Flaky', desc: 'Whole cashews, almonds, raisins & rice flakes' },
                  { id: 'airy', label: '☁️ Light & Airy Puff', desc: 'Roasted makhana or light nylon sev' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleCalculateMatch(item.id)}
                    className="text-left p-4 rounded-2xl border-2 border-amber-200 hover:border-amber-500 hover:bg-amber-50/80 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="font-extrabold text-amber-950 text-base group-hover:text-amber-700">
                        {item.label}
                      </div>
                      <div className="text-xs text-amber-800/80 mt-1">{item.desc}</div>
                    </div>
                    <div className="mt-3 text-xs font-bold text-amber-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      See My Perfect Match ✨
                    </div>
                  </button>
                ))}
              </div>
              <div className="text-center pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="text-xs font-bold text-amber-800 hover:underline cursor-pointer"
                >
                  ← Back to previous question
                </button>
              </div>
            </div>
          )}

          {/* RESULT: Recommended Match */}
          {step === 4 && recommendedProduct && (
            <div className="space-y-6 animate-in zoom-in-95 duration-300 text-center">
              <div className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold border border-emerald-300">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>99.8% Match Found For Your Taste Profile!</span>
              </div>

              <div className="bg-amber-50/80 rounded-2xl p-6 border border-amber-200 flex flex-col sm:flex-row items-center gap-6 text-left">
                <img
                  src={recommendedProduct.image}
                  alt={recommendedProduct.name}
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl object-cover shadow-md shrink-0"
                />

                <div className="space-y-2 flex-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    Recommended Variety • {recommendedProduct.regionOrigin}
                  </div>
                  <h4 className="text-xl sm:text-2xl font-bold font-serif-display text-amber-950">
                    {recommendedProduct.name}
                  </h4>
                  <p className="text-xs sm:text-sm text-amber-900/90 leading-relaxed">
                    {recommendedProduct.description}
                  </p>
                  
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-2xl font-black text-amber-950">
                      ₹{recommendedProduct.price}
                    </span>
                    <span className="text-sm line-through text-amber-700">
                      ₹{recommendedProduct.originalPrice}
                    </span>
                    <span className="text-xs font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                      {recommendedProduct.weight}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => onAddProduct(recommendedProduct)}
                  className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-extrabold text-sm px-8 py-3.5 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add Match To Cart (₹{recommendedProduct.price})</span>
                </button>

                <button
                  onClick={() => onOpenQuickView(recommendedProduct)}
                  className="w-full sm:w-auto bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-sm px-6 py-3.5 rounded-xl transition cursor-pointer"
                >
                  View Details &amp; Ingredients
                </button>

                <button
                  onClick={handleReset}
                  className="text-xs font-bold text-amber-800 hover:text-amber-950 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retake Quiz
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </section>
  );
};
