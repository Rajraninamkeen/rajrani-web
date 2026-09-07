import React, { useState } from 'react';
import { Search, X, Star, Flame } from 'lucide-react';
import { PRODUCTS, Product } from '../data/products';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onSelectProduct }) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filtered = PRODUCTS.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.tagline.toLowerCase().includes(query.toLowerCase()) ||
    p.ingredients.some(ing => ing.toLowerCase().includes(query.toLowerCase())) ||
    p.regionOrigin.toLowerCase().includes(query.toLowerCase())
  );

  const hotSearches = ['Ratlami Sev', 'Khatta Meetha', 'Aloo Bhujia', 'No Palm Oil', 'Makhana', 'Gift Box'];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-amber-200 overflow-hidden relative animate-in zoom-in-95 duration-200">
        
        {/* Search Header */}
        <div className="p-4 border-b border-amber-200 flex items-center gap-3 bg-amber-50">
          <Search className="w-5 h-5 text-amber-600 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Ratlami Sev, Khatta Meetha, No Palm Oil, Makhana..."
            className="w-full bg-transparent text-amber-950 font-bold text-sm outline-none placeholder:text-gray-400"
          />
          <button onClick={onClose} className="p-1 rounded-full hover:bg-amber-200 text-amber-900 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hot Suggestions */}
        <div className="px-4 py-2 bg-white border-b border-amber-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-amber-800 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500" /> Hot:
          </span>
          {hotSearches.map((tag, i) => (
            <button
              key={i}
              onClick={() => setQuery(tag)}
              className="bg-amber-100/70 hover:bg-amber-200 text-amber-950 font-semibold px-2.5 py-1 rounded-full cursor-pointer text-[11px]"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-amber-900 text-xs">
              No snacks matching "{query}". Try searching for "Ratlami" or "Peanut Oil".
            </div>
          ) : (
            filtered.map((product) => (
              <div
                key={product.id}
                onClick={() => {
                  onSelectProduct(product);
                  onClose();
                }}
                className="p-3 rounded-2xl hover:bg-amber-50/80 transition cursor-pointer flex items-center justify-between gap-3 border border-transparent hover:border-amber-200"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img src={product.image} alt={product.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  <div className="min-w-0">
                    <div className="font-extrabold text-xs text-amber-950 truncate">{product.name}</div>
                    <div className="text-[10px] text-amber-700 truncate">{product.tagline}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                      <span className="text-amber-500 font-bold flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400" /> {product.rating}
                      </span>
                      <span className="text-gray-400">• {product.regionOrigin}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-extrabold text-amber-950">₹{product.price}</div>
                  <div className="text-[10px] text-emerald-700 font-bold">In Stock</div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
