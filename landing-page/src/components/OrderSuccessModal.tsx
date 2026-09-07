import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Sparkles, Package, MapPin, ArrowRight } from 'lucide-react';

interface OrderSuccessModalProps {
  orderDetails: any;
  onClose: () => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({ orderDetails, onClose }) => {
  useEffect(() => {
    if (orderDetails) {
      // Trigger confetti celebration
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#dc2626', '#10b981', '#fbbf24']
      });
    }
  }, [orderDetails]);

  if (!orderDetails) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-amber-300 text-center space-y-6 animate-in zoom-in-95 duration-300">
        
        {/* Animated Badge */}
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner border-2 border-emerald-300 animate-bounce">
          <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
        </div>

        <div>
          <span className="bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1 rounded-full border border-amber-300">
            Order #{orderDetails.orderId} Placed!
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-amber-950 font-serif-display mt-2">
            Woohoo! Fresh Crunch Is On Its Way 🚚
          </h2>
          <p className="text-xs sm:text-sm text-amber-900/80 max-w-sm mx-auto mt-1">
            Thank you, <strong>{orderDetails.customer.fullName}</strong>! We have dispatched your fresh artisanal batch order to our express air courier team.
          </p>
        </div>

        {/* Order Details Summary Box */}
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-left text-xs space-y-2 text-amber-950">
          <div className="flex justify-between font-bold border-b border-amber-200 pb-2">
            <span>Total Paid Amount:</span>
            <span className="text-amber-600 font-extrabold text-sm">₹{orderDetails.totalAmount}</span>
          </div>

          <div className="flex items-center gap-1.5 text-gray-700">
            <Package className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Items: {orderDetails.items.length} snack pack(s)</span>
          </div>

          <div className="flex items-center gap-1.5 text-gray-700">
            <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Delivery To: {orderDetails.customer.city}, {orderDetails.customer.pincode}</span>
          </div>

          <div className="flex items-center gap-1.5 font-bold text-emerald-700 pt-1 border-t border-amber-200">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Estimated Delivery: {orderDetails.estimatedDelivery}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-amber-950 hover:bg-amber-900 text-yellow-300 font-extrabold text-sm py-3.5 rounded-xl shadow-lg transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Continue Munching &amp; Browsing</span>
          <ArrowRight className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
};
