import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Tag, ShieldCheck, Sparkles } from 'lucide-react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  weight: string;
  image: string;
  quantity: number;
  isBundle?: boolean;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onOpenCheckout: () => void;
  appliedCoupon: string;
  onApplyCoupon: (code: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onOpenCheckout,
  appliedCoupon,
  onApplyCoupon
}) => {
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');

  if (!isOpen) return null;

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const FREE_SHIPPING_THRESHOLD = 399;
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : 40;

  // Coupon discount logic
  let discount = 0;
  if (appliedCoupon === 'BILOKAT20') {
    discount = Math.round(subtotal * 0.20);
  } else if (appliedCoupon === 'FIRST100') {
    discount = Math.min(100, subtotal);
  }

  const grandTotal = Math.max(0, subtotal - discount + shippingFee);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (code === 'BILOKAT20' || code === 'FIRST100') {
      onApplyCoupon(code);
      setCouponError('');
      setCouponInput('');
    } else {
      setCouponError('Invalid coupon code. Try "BILOKAT20"');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between border-l border-amber-200 animate-in slide-in-from-right duration-300">
          
          {/* Cart Header */}
          <div className="p-4 sm:p-6 bg-gradient-to-r from-amber-950 to-amber-900 text-white flex items-center justify-between border-b border-amber-800">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-bold font-serif-display text-white">Your Fresh Snack Basket</h2>
              <span className="bg-amber-800 text-amber-200 text-xs px-2.5 py-0.5 rounded-full font-mono">
                {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-amber-800 text-amber-200 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress Bar */}
          <div className="bg-amber-50 p-3.5 border-b border-amber-200 text-xs text-amber-950">
            {subtotal >= FREE_SHIPPING_THRESHOLD ? (
              <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>🎉 Unlocked FREE Express Shipping across India!</span>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Add ₹{FREE_SHIPPING_THRESHOLD - subtotal} more for FREE Delivery!</span>
                  <span>{Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-amber-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-600 transition-all duration-300"
                    style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {cartItems.length === 0 ? (
              <div className="text-center py-16 space-y-4 text-amber-950">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-700">
                  <ShoppingBag className="w-10 h-10" />
                </div>
                <div>
                  <p className="font-extrabold text-base">Your snack basket is empty!</p>
                  <p className="text-xs text-amber-800/80 mt-1">Explore our Ratlami Sev, Khatta Meetha &amp; Kaju Mixture.</p>
                </div>
                <button
                  onClick={onClose}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition cursor-pointer"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-amber-50/60 rounded-2xl p-3.5 border border-amber-200 flex items-center gap-3 relative"
                >
                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-extrabold text-amber-950 truncate">{item.name}</h4>
                    <p className="text-[10px] text-amber-700">{item.weight}</p>
                    <div className="text-xs font-black text-amber-950 mt-1">
                      ₹{item.price * item.quantity}
                    </div>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-amber-300 rounded-lg bg-white overflow-hidden">
                      <button
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="px-2 py-1 text-amber-950 font-bold hover:bg-amber-100 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 font-bold text-xs text-amber-950 min-w-[20px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="px-2 py-1 text-amber-950 font-bold hover:bg-amber-100 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Coupon Input & Summary */}
          {cartItems.length > 0 && (
            <div className="p-4 sm:p-6 bg-amber-50/80 border-t border-amber-200 space-y-4">
              
              {/* Coupon Form */}
              <div>
                <form onSubmit={handleApply} className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 text-amber-600 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Coupon Code (e.g. BILOKAT20)"
                      className="w-full bg-white border border-amber-300 rounded-xl pl-9 pr-3 py-2 text-xs font-bold font-mono text-amber-950 outline-none focus:border-amber-600"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-amber-950 hover:bg-amber-900 text-yellow-300 font-extrabold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                  >
                    Apply
                  </button>
                </form>

                {appliedCoupon && (
                  <div className="text-[11px] text-emerald-700 font-bold mt-1 flex items-center justify-between bg-emerald-50 p-1.5 rounded border border-emerald-200">
                    <span>Code '{appliedCoupon}' Applied (20% OFF)</span>
                    <button onClick={() => onApplyCoupon('')} className="text-red-600 hover:underline">
                      Remove
                    </button>
                  </div>
                )}

                {couponError && <p className="text-[11px] text-red-600 mt-1 font-semibold">{couponError}</p>}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-1.5 text-xs text-amber-900 border-t border-amber-200/60 pt-3 font-medium">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{subtotal}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Discount ({appliedCoupon})</span>
                    <span>-₹{discount}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>Express Air Shipping</span>
                  <span>{shippingFee === 0 ? <strong className="text-emerald-700">FREE</strong> : `₹${shippingFee}`}</span>
                </div>

                <div className="flex justify-between text-base font-black text-amber-950 border-t border-amber-200 pt-2">
                  <span>Total Amount</span>
                  <span>₹{grandTotal}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={() => {
                  onClose();
                  onOpenCheckout();
                }}
                className="w-full bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 hover:from-red-700 hover:to-amber-600 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-lg transition-transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-amber-800 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>100% Safe Payment • COD &amp; UPI Supported</span>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
