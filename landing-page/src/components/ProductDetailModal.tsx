import React, { useState } from 'react';
import { X, Star, ShoppingBag, ShieldCheck, Sparkles, Flame } from 'lucide-react';
import { Product } from '../data/products';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart
}) => {
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const handleAdd = () => {
    onAddToCart(product, quantity);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-amber-200 relative max-h-[90vh] flex flex-col md:flex-row animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 bg-black/50 hover:bg-black text-white p-2 rounded-full transition cursor-pointer"
          aria-label="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Side: Product Image */}
        <div className="md:w-1/2 relative bg-amber-950 shrink-0 h-64 md:h-auto">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-amber-950/80 via-transparent to-transparent" />
          
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <span className="bg-amber-500 text-amber-950 font-bold text-xs px-3 py-1 rounded-full">
              {product.regionOrigin}
            </span>
            <div className="mt-2 text-xs text-amber-200 font-medium">
              Packaging: {product.weight}
            </div>
          </div>
        </div>

        {/* Right Side: Detailed Content */}
        <div className="md:w-1/2 p-6 overflow-y-auto space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            
            {/* Rating */}
            <div className="flex items-center gap-2">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <span className="text-xs font-bold text-amber-950">{product.rating} / 5</span>
              <span className="text-xs text-gray-500">({product.reviewCount} reviews)</span>
            </div>

            {/* Title & Tagline */}
            <div>
              <h2 className="text-2xl font-extrabold text-amber-950 font-serif-display">
                {product.name}
              </h2>
              <p className="text-xs text-amber-800 font-medium mt-1">
                {product.tagline}
              </p>
            </div>

            {/* Description */}
            <p className="text-xs text-gray-700 leading-relaxed">
              {product.description}
            </p>

            {/* Pure Peanut Oil Guarantee */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2 text-xs text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">100% Cold-Pressed Oil Guarantee:</strong> Cooked only in fresh peanut/olive oil. Zero palm oil, 0g trans-fats &amp; zero artificial preservatives.
              </div>
            </div>

            {/* Ingredients Pills */}
            <div>
              <div className="text-xs font-bold text-amber-950 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Authentic Ingredients
              </div>
              <div className="flex flex-wrap gap-1.5">
                {product.ingredients.map((ing, i) => (
                  <span key={i} className="text-[11px] bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg font-medium">
                    {ing}
                  </span>
                ))}
              </div>
            </div>

            {/* Nutritional Info Grid */}
            <div className="bg-amber-50/80 rounded-xl p-3 border border-amber-200 text-xs">
              <div className="font-bold text-amber-950 mb-2">Nutritional Values (Per 30g serving)</div>
              <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                <div className="bg-white p-1.5 rounded border border-amber-200">
                  <div className="text-amber-600 font-bold">{product.nutritionalInfo.calories}</div>
                  <div className="text-gray-500 text-[10px]">Energy</div>
                </div>
                <div className="bg-white p-1.5 rounded border border-amber-200">
                  <div className="text-amber-600 font-bold">{product.nutritionalInfo.protein}</div>
                  <div className="text-gray-500 text-[10px]">Protein</div>
                </div>
                <div className="bg-white p-1.5 rounded border border-amber-200">
                  <div className="text-amber-600 font-bold">{product.nutritionalInfo.fat}</div>
                  <div className="text-gray-500 text-[10px]">Fat</div>
                </div>
                <div className="bg-white p-1.5 rounded border border-amber-200">
                  <div className="text-amber-600 font-bold">{product.nutritionalInfo.carbs}</div>
                  <div className="text-gray-500 text-[10px]">Carbs</div>
                </div>
              </div>
            </div>

            {/* Serving / Pairing Suggestion */}
            <div className="text-xs bg-orange-50 text-orange-950 p-2.5 rounded-xl border border-orange-200 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-600 shrink-0" />
              <span><strong>Halwai Tip:</strong> {product.pairingSuggestion}</span>
            </div>

          </div>

          {/* Bottom Actions */}
          <div className="pt-4 border-t border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-black text-amber-950">
                  ₹{product.price * quantity}
                </div>
                <div className="text-[11px] text-gray-500">
                  ₹{product.price} / pack
                </div>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center border-2 border-amber-200 rounded-xl overflow-hidden bg-amber-50">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-1 text-amber-950 font-bold hover:bg-amber-200 cursor-pointer"
                >
                  -
                </button>
                <span className="px-3 py-1 font-bold text-sm text-amber-950 min-w-[32px] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-1 text-amber-950 font-bold hover:bg-amber-200 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={handleAdd}
              className="w-full bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 hover:from-red-700 hover:to-amber-600 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-lg transition-transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Add {quantity} to Cart • ₹{product.price * quantity}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
