import React, { useState } from 'react';
import { X, ShieldCheck, MapPin, CreditCard } from 'lucide-react';
import { CartItem } from './CartDrawer';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  appliedCoupon: string;
  pincode: string;
  onOrderSuccess: (orderDetails: any) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  appliedCoupon,
  pincode,
  onOrderSuccess
}) => {
  const [formData, setFormData] = useState({
    fullName: 'Ananya Sharma',
    mobile: '9876543210',
    street: 'Flat 402, Royal Palms Towers, MG Road',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: pincode || '452001',
    paymentMethod: 'upi' as 'upi' | 'cod' | 'card'
  });

  if (!isOpen) return null;

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const FREE_SHIPPING_THRESHOLD = 399;
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 40;

  let discount = 0;
  if (appliedCoupon === 'BILOKAT20') {
    discount = Math.round(subtotal * 0.20);
  } else if (appliedCoupon === 'FIRST100') {
    discount = Math.min(100, subtotal);
  }

  const grandTotal = Math.max(0, subtotal - discount + shippingFee);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const orderId = `BIL-${Math.floor(100000 + Math.random() * 900000)}`;
    const details = {
      orderId,
      items: cartItems,
      totalAmount: grandTotal,
      customer: formData,
      estimatedDelivery: 'Thursday, 2 Business Days'
    };
    onOrderSuccess(details);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-amber-200 relative max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-950 to-amber-900 text-white flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest">
              Express Air Shipping
            </span>
            <h3 className="text-xl font-extrabold font-serif-display text-white">
              Complete Your Bilokat Order
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-amber-800 text-amber-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Address Section */}
          <div className="space-y-3">
            <div className="text-xs font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-600" />
              1. Delivery Shipping Address
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-amber-900 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full bg-amber-50/50 border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-amber-950 outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-amber-900 block mb-1">Mobile Number (For Courier Updates)</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full bg-amber-50/50 border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-amber-950 outline-none focus:border-amber-600 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-amber-900 block mb-1">Street / House No. / Area</label>
                <input
                  type="text"
                  required
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className="w-full bg-amber-50/50 border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-amber-950 outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-amber-900 block mb-1">City / Town</label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full bg-amber-50/50 border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-amber-950 outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-amber-900 block mb-1">Pincode</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  className="w-full bg-amber-50/50 border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-amber-950 outline-none focus:border-amber-600 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Payment Method Section */}
          <div className="space-y-3 pt-3 border-t border-amber-200">
            <div className="text-xs font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-amber-600" />
              2. Choose Payment Option
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'upi', title: '⚡ Instant UPI', desc: 'GPay / PhonePe / Paytm' },
                { id: 'cod', title: '💵 Cash On Delivery', desc: 'Pay cash at doorstep' },
                { id: 'card', title: '💳 Card / NetBanking', desc: 'All Cards Supported' }
              ].map(method => (
                <button
                  type="button"
                  key={method.id}
                  onClick={() => setFormData({ ...formData, paymentMethod: method.id as any })}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    formData.paymentMethod === method.id
                      ? 'bg-amber-100 border-amber-600 text-amber-950 shadow-xs'
                      : 'bg-white border-amber-200 text-amber-900 hover:bg-amber-50'
                  }`}
                >
                  <div className="font-bold text-xs">{method.title}</div>
                  <div className="text-[10px] text-gray-500 mt-1">{method.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Order Total Summary Box */}
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-2 text-xs font-bold text-amber-950">
            <div className="flex justify-between text-gray-600 font-medium">
              <span>Items Subtotal</span>
              <span>₹{subtotal}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Coupon Discount ({appliedCoupon})</span>
                <span>-₹{discount}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600 font-medium">
              <span>Express Delivery Fee</span>
              <span>{shippingFee === 0 ? 'FREE' : `₹${shippingFee}`}</span>
            </div>
            <div className="flex justify-between text-base font-black text-amber-950 border-t border-amber-300 pt-2">
              <span>Final Payable</span>
              <span>₹{grandTotal}</span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 hover:from-red-700 hover:to-amber-600 text-white font-extrabold text-base py-4 rounded-2xl shadow-xl transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-5 h-5 text-yellow-300" />
            <span>Place Order Now • ₹{grandTotal}</span>
          </button>

        </form>

      </div>
    </div>
  );
};
