import React, { useState, useEffect } from 'react';
import { Sparkles, Truck, MapPin, Tag } from 'lucide-react';

interface AnnouncementBarProps {
  onOpenPincodeModal: () => void;
  selectedPincode: string;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ onOpenPincodeModal, selectedPincode }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 4, minutes: 28, seconds: 45 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 4, minutes: 30, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-gradient-to-r from-amber-950 via-amber-900 to-red-950 text-amber-100 text-xs sm:text-sm py-2 px-3 sm:px-6 border-b border-amber-800/40 relative z-40">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Left message */}
        <div className="flex items-center gap-2 font-medium">
          <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full text-[11px] font-bold border border-amber-500/30 animate-pulse">
            <Sparkles className="w-3 h-3 text-amber-400" /> FLASH SALE
          </span>
          <span className="hidden md:inline">🔥 Flat 20% OFF + Free Gift Box on ₹499+ orders!</span>
          <span className="md:hidden">🔥 20% OFF code: <strong className="text-amber-300">BILOKAT20</strong></span>
        </div>

        {/* Center coupon & countdown */}
        <div className="hidden lg:flex items-center gap-3 bg-amber-900/50 px-3 py-0.5 rounded-full border border-amber-700/40">
          <div className="flex items-center gap-1 text-amber-200">
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            <span>Use Code:</span>
            <span className="font-mono font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/30">BILOKAT20</span>
          </div>
          <span className="text-amber-500">•</span>
          <div className="flex items-center gap-1 text-amber-300 text-xs font-mono font-bold">
            <span>Ends in:</span>
            <span className="bg-black/40 px-1.5 py-0.5 rounded">{String(timeLeft.hours).padStart(2, '0')}h</span>:
            <span className="bg-black/40 px-1.5 py-0.5 rounded">{String(timeLeft.minutes).padStart(2, '0')}m</span>:
            <span className="bg-black/40 px-1.5 py-0.5 rounded">{String(timeLeft.seconds).padStart(2, '0')}s</span>
          </div>
        </div>

        {/* Right Pincode & Express Delivery */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onOpenPincodeModal}
            className="flex items-center gap-1 text-amber-200 hover:text-white transition-colors cursor-pointer bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md border border-amber-600/30"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate max-w-[120px]">
              {selectedPincode ? `Deliver to ${selectedPincode}` : 'Check Delivery Pincode'}
            </span>
          </button>
          
          <div className="hidden sm:flex items-center gap-1 text-amber-300 text-xs">
            <Truck className="w-3.5 h-3.5" />
            <span>Free Delivery &gt; ₹399</span>
          </div>
        </div>
      </div>
    </div>
  );
};
