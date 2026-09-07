import React, { useState, useEffect } from 'react';
import { Search, ShoppingBag, Menu, X, Flame, ShieldCheck, Sparkles, MessageSquare } from 'lucide-react';

interface NavbarProps {
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  onOpenSearch: () => void;
  onOpenPincodeModal: () => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  pincode: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  cartCount,
  cartTotal,
  onOpenCart,
  onOpenSearch,
  onOpenPincodeModal,
  activeCategory,
  setActiveCategory,
  pincode
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'bestseller', label: '🔥 Best Sellers' },
    { id: 'spicy', label: '🌶️ Ratlami & Spicy Sev' },
    { id: 'mixtures', label: '🌰 Royal Mixtures' },
    { id: 'healthy', label: '🍃 Guilt-Free Roasts' },
    { id: 'gifts', label: '🎁 Festive Hampers' },
    { id: 'combo', label: '✨ Build Combo (₹499)' },
  ];

  return (
    <header className={`sticky top-0 z-30 transition-all duration-300 ${
      isScrolled ? 'glass-panel shadow-lg border-b border-amber-200/60 py-2.5' : 'bg-amber-50/90 backdrop-blur-md border-b border-amber-100 py-3.5'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 sm:gap-6">
          
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-amber-950 hover:bg-amber-100 rounded-lg transition cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Brand Logo */}
          <a href="#" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-amber-600 via-red-600 to-amber-500 flex items-center justify-center text-white font-extrabold text-xl shadow-md group-hover:scale-105 transition-transform duration-300 border border-amber-300">
              <span className="font-serif-display tracking-tight">B</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-amber-950 font-serif-display flex items-center gap-1">
                BILOKAT <Flame className="w-4 h-4 text-red-500 fill-red-500 animate-bounce" />
              </span>
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-amber-700 -mt-1">
                Swaad Bharat Ka
              </span>
            </div>
          </a>

          {/* Amazon/Flipkart-style Quick Search Bar */}
          <div 
            onClick={onOpenSearch}
            className="hidden md:flex flex-1 max-w-md items-center gap-3 bg-white hover:bg-amber-50/50 border border-amber-300/80 rounded-full px-4 py-2 text-sm text-gray-500 cursor-pointer shadow-xs transition hover:border-amber-500 group"
          >
            <Search className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
            <span className="truncate">Search Ratlami Sev, Khatta Meetha, No-Palm Oil snacks...</span>
            <span className="ml-auto text-xs font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-medium">⌘K</span>
          </div>

          {/* Actions: Search (mobile), Pincode, WhatsApp, Cart */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Search Icon */}
            <button
              onClick={onOpenSearch}
              className="md:hidden p-2 text-amber-900 hover:bg-amber-100 rounded-full transition"
              aria-label="Search snacks"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* WhatsApp Direct Quick Order */}
            <a
              href="https://wa.me/?text=Hi%20Bilokat!%20I%20want%20to%20order%20fresh%20Namkeen%20combos."
              target="_blank"
              rel="noopener noreferrer"
              className="hidden xl:flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-full transition shadow-xs hover:shadow-md"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp Order</span>
            </a>

            {/* Cart Button */}
            <button
              onClick={onOpenCart}
              className="relative flex items-center gap-2 bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white font-bold px-3.5 py-2 rounded-full shadow-md hover:shadow-lg transition-all transform active:scale-95 cursor-pointer"
            >
              <div className="relative">
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-yellow-300 text-amber-950 font-black text-[11px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline text-sm">
                {cartTotal > 0 ? `₹${cartTotal}` : 'Cart'}
              </span>
            </button>
          </div>
        </div>

        {/* Category Navigation Bar */}
        <nav className="hidden lg:flex items-center justify-between pt-3 mt-2 border-t border-amber-200/50 text-xs sm:text-sm font-semibold text-amber-950">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {navLinks.map(link => (
              <button
                key={link.id}
                onClick={() => {
                  setActiveCategory(link.id);
                  const el = document.getElementById('catalog-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`px-3.5 py-1.5 rounded-full whitespace-nowrap transition cursor-pointer ${
                  activeCategory === link.id
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : 'text-amber-900 hover:bg-amber-200/50 hover:text-amber-950'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-amber-800 shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              100% Peanut Oil
            </span>
            <span className="text-amber-300">•</span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-amber-500" />
              FSSAI Certified
            </span>
          </div>
        </nav>
      </div>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-amber-50 border-b border-amber-200 px-4 py-4 space-y-3 shadow-xl animate-in slide-in-from-top duration-200">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-800 px-2">Explore Categories</div>
          <div className="grid grid-cols-2 gap-2">
            {navLinks.map(link => (
              <button
                key={link.id}
                onClick={() => {
                  setActiveCategory(link.id);
                  setIsMobileMenuOpen(false);
                  const el = document.getElementById('catalog-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                  activeCategory === link.id
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-white text-amber-950 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-amber-200 flex flex-col gap-2">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenPincodeModal();
              }}
              className="flex items-center justify-between text-xs font-medium bg-amber-100 text-amber-900 p-2.5 rounded-lg"
            >
              <span>Delivery Pincode: <strong>{pincode || 'Select Pincode'}</strong></span>
              <span className="text-amber-700 font-bold underline">Change</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
