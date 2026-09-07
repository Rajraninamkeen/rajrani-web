import React, { useState } from 'react';
import { Sparkles, Plus, Trash2, Gift, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { PRODUCTS, Product } from '../data/products';

interface ComboBuilderProps {
  onAddComboToCart: (comboTitle: string, price: number, items: Product[]) => void;
}

export const ComboBuilder: React.FC<ComboBuilderProps> = ({ onAddComboToCart }) => {
  const [selectedItems, setSelectedItems] = useState<Product[]>([]);
  const MAX_ITEMS = 4;
  const COMBO_PRICE = 499;
  const REGULAR_TOTAL = selectedItems.reduce((sum, item) => sum + item.originalPrice, 0) || 699;

  const handleSelectItem = (product: Product) => {
    if (selectedItems.length < MAX_ITEMS) {
      setSelectedItems([...selectedItems, product]);
    }
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...selectedItems];
    updated.splice(index, 1);
    setSelectedItems(updated);
  };

  const handleAddToCart = () => {
    if (selectedItems.length === MAX_ITEMS) {
      const title = `Custom 4-Pack Snack Box (${selectedItems.map(i => i.name.split(' ')[1] || i.name).join(', ')})`;
      onAddComboToCart(title, COMBO_PRICE, selectedItems);
    }
  };

  return (
    <section id="combo-builder" className="py-16 bg-gradient-to-br from-amber-950 via-amber-900 to-red-950 text-amber-100 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Title */}
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 text-yellow-300 px-3.5 py-1 rounded-full text-xs font-bold border border-amber-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Box Builder</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold font-serif-display tracking-tight text-white">
            Build Your Custom 4-Pack Box <span className="text-yellow-400">@ Flat ₹499</span>
          </h2>
          <p className="text-sm sm:text-base text-amber-200/80 max-w-xl mx-auto">
            Select any 4 delicious Namkeens from our menu below. Save up to ₹200 + get <strong>Free Express Shipping</strong> &amp; <strong>Free Royal Kulhad Cup</strong>!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Selectable Snack Cards */}
          <div className="lg:col-span-7 space-y-4">
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
              Click to add to your box ({selectedItems.length}/{MAX_ITEMS} selected):
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {PRODUCTS.map(product => {
                const isSelectedCount = selectedItems.filter(p => p.id === product.id).length;
                const isFull = selectedItems.length >= MAX_ITEMS;

                return (
                  <div
                    key={product.id}
                    onClick={() => !isFull && handleSelectItem(product)}
                    className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-3 relative ${
                      isSelectedCount > 0
                        ? 'bg-amber-900/80 border-amber-400 shadow-lg'
                        : 'bg-amber-950/60 border-amber-800/60 hover:border-amber-500/60 hover:bg-amber-900/40'
                    } ${isFull && isSelectedCount === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-extrabold text-white truncate">
                        {product.name}
                      </div>
                      <div className="text-[10px] text-amber-300 mt-0.5 truncate">
                        {product.weight} • {product.regionOrigin}
                      </div>
                      <div className="text-xs font-black text-yellow-400 mt-1">
                        ₹{product.price}
                      </div>
                    </div>

                    <button
                      disabled={isFull && isSelectedCount === 0}
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-transform ${
                        isSelectedCount > 0
                          ? 'bg-yellow-400 text-amber-950 scale-110'
                          : 'bg-amber-800 text-amber-200 hover:bg-amber-700'
                      }`}
                    >
                      {isSelectedCount > 0 ? `x${isSelectedCount}` : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Live Visual Box Preview */}
          <div className="lg:col-span-5 bg-gradient-to-b from-amber-900/90 to-amber-950/90 rounded-3xl p-6 border border-amber-600/40 shadow-2xl relative">
            <div className="space-y-5">
              
              <div className="flex items-center justify-between border-b border-amber-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-yellow-400" />
                  <span className="font-serif-display text-lg font-bold text-white">Your Custom Box</span>
                </div>
                <span className="text-xs font-bold bg-yellow-400 text-amber-950 px-2.5 py-1 rounded-full">
                  {selectedItems.length}/{MAX_ITEMS} Items Filled
                </span>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-amber-300 mb-1.5 font-semibold">
                  <span>
                    {selectedItems.length === MAX_ITEMS ? '🎉 Box Complete!' : `Add ${MAX_ITEMS - selectedItems.length} more item${MAX_ITEMS - selectedItems.length > 1 ? 's' : ''}`}
                  </span>
                  <span>{Math.round((selectedItems.length / MAX_ITEMS) * 100)}%</span>
                </div>
                <div className="w-full h-2.5 bg-amber-950 rounded-full overflow-hidden border border-amber-800">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all duration-300"
                    style={{ width: `${(selectedItems.length / MAX_ITEMS) * 100}%` }}
                  />
                </div>
              </div>

              {/* 4 Box Slots */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[0, 1, 2, 3].map(index => {
                  const item = selectedItems[index];
                  return (
                    <div
                      key={index}
                      className={`h-24 rounded-2xl border-2 border-dashed flex items-center justify-center p-2 relative transition-all ${
                        item
                          ? 'bg-amber-950/80 border-amber-400/80 border-solid shadow-inner'
                          : 'border-amber-700/60 bg-amber-950/30 text-amber-500/60'
                      }`}
                    >
                      {item ? (
                        <div className="flex items-center gap-2 w-full">
                          <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-amber-100 truncate">{item.name}</p>
                            <p className="text-[10px] text-amber-300">{item.weight}</p>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="text-xs font-bold text-amber-500">Slot {index + 1}</span>
                          <p className="text-[10px] text-amber-600">Select snack</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Perks Checklist */}
              <div className="bg-amber-950/80 rounded-xl p-3.5 border border-amber-800/60 space-y-1.5 text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Free Express Air Courier Shipping across India</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Includes Free Handcrafted Clay Chai Kulhad Cup</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Guaranteed Fresh 3-Layer Nitrogen Zip-Lock Bags</span>
                </div>
              </div>

              {/* Total & Action Button */}
              <div className="pt-2 border-t border-amber-800/60 space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-amber-300">Bundle Price:</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-yellow-400">₹{COMBO_PRICE}</span>
                      <span className="text-sm line-through text-amber-500">₹{REGULAR_TOTAL}</span>
                    </div>
                  </div>
                  <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2.5 py-1 rounded border border-emerald-500/40">
                    Save ₹{REGULAR_TOTAL - COMBO_PRICE}
                  </span>
                </div>

                <button
                  disabled={selectedItems.length < MAX_ITEMS}
                  onClick={handleAddToCart}
                  className={`w-full py-4 rounded-2xl font-extrabold text-sm transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
                    selectedItems.length === MAX_ITEMS
                      ? 'bg-gradient-to-r from-yellow-400 via-amber-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-amber-950 shadow-yellow-500/20 active:scale-98'
                      : 'bg-amber-900/60 text-amber-500/80 cursor-not-allowed border border-amber-800'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>
                    {selectedItems.length === MAX_ITEMS
                      ? 'Add Custom Box to Cart (₹499)'
                      : `Select ${MAX_ITEMS - selectedItems.length} More Items To Order`}
                  </span>
                </button>
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
