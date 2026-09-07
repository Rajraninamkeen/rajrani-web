import React, { useState } from 'react';
import { MapPin, Truck, Check, Clock, AlertCircle } from 'lucide-react';

interface PincodeCheckerProps {
  currentPincode: string;
  onSetPincode: (pin: string) => void;
}

export const PincodeChecker: React.FC<PincodeCheckerProps> = ({ currentPincode, onSetPincode }) => {
  const [pinInput, setPinInput] = useState(currentPincode || '');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [cityData, setCityData] = useState<{ city: string; days: string } | null>(null);

  const majorCities: Record<string, string> = {
    '1100': 'New Delhi (NCR)',
    '4000': 'Mumbai, MH',
    '5600': 'Bengaluru, KA',
    '7000': 'Kolkata, WB',
    '6000': 'Chennai, TN',
    '5000': 'Hyderabad, TS',
    '3020': 'Jaipur, RJ',
    '4520': 'Indore, MP',
    '3800': 'Ahmedabad, GJ',
    '1600': 'Chandigarh, PB'
  };

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length === 6 && /^\d+$/.test(pinInput)) {
      onSetPincode(pinInput);
      const prefix = pinInput.substring(0, 4);
      const city = majorCities[prefix] || 'Your Location';
      setCityData({
        city,
        days: '2 Business Days (Express Air)'
      });
      setStatus('success');
    } else {
      setStatus('error');
    }
  };

  return (
    <section className="py-12 bg-amber-900 text-amber-100 relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="bg-amber-950/90 rounded-3xl p-6 sm:p-8 border border-amber-700/60 shadow-2xl relative">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Info */}
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-yellow-400 bg-amber-900/60 px-3 py-1 rounded-full border border-amber-700">
                <Truck className="w-3.5 h-3.5" />
                <span>Pan-India 18,500+ Pincode Coverage</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold font-serif-display text-white">
                Check Express Delivery &amp; COD In Your City
              </h3>
              <p className="text-xs sm:text-sm text-amber-200/80">
                Type your 6-digit pincode to view instant courier speed &amp; Cash On Delivery availability.
              </p>
            </div>

            {/* Input Form */}
            <form onSubmit={handleCheck} className="w-full md:w-auto shrink-0 space-y-3">
              <div className="flex items-center bg-white rounded-2xl p-1.5 border-2 border-amber-500 shadow-md">
                <div className="flex items-center gap-2 px-3 text-amber-950">
                  <MapPin className="w-4 h-4 text-amber-600" />
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setStatus('idle');
                  }}
                  placeholder="Enter 6-digit Pincode (e.g. 110001)"
                  className="bg-transparent text-amber-950 font-bold text-sm outline-none w-44 placeholder:text-gray-400 font-mono"
                />
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer"
                >
                  Check
                </button>
              </div>

              {/* Status Results */}
              {status === 'success' && cityData && (
                <div className="bg-emerald-950/90 text-emerald-200 text-xs p-3 rounded-xl border border-emerald-500/50 space-y-1 animate-in fade-in duration-200">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Deliverable to {cityData.city} ({pinInput})</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-emerald-200/90 pt-1 border-t border-emerald-800">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Delivery: {cityData.days}</span>
                    <span className="font-bold text-yellow-300">✓ Cash on Delivery Available</span>
                  </div>
                </div>
              )}

              {status === 'error' && (
                <div className="bg-red-950/90 text-red-200 text-xs p-3 rounded-xl border border-red-500/50 flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Please enter a valid 6-digit Indian Pincode.</span>
                </div>
              )}
            </form>

          </div>

        </div>
      </div>
    </section>
  );
};
