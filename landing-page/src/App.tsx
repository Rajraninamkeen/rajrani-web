import { useState, useEffect } from 'react';
import { AnnouncementBar } from './components/AnnouncementBar';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { TrustStats } from './components/TrustStats';
import { FlavorQuiz } from './components/FlavorQuiz';
import { ProductCatalog } from './components/ProductCatalog';
import { ProductDetailModal } from './components/ProductDetailModal';
import { ComboBuilder } from './components/ComboBuilder';
import { ComparisonSection } from './components/ComparisonSection';
import { PincodeChecker } from './components/PincodeChecker';
import { ReviewsSection } from './components/ReviewsSection';
import { PricingBundles } from './components/PricingBundles';
import { FAQ } from './components/FAQ';
import { CTABanner } from './components/CTABanner';
import { Footer } from './components/Footer';
import { CartDrawer, CartItem } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderSuccessModal } from './components/OrderSuccessModal';
import { SearchModal } from './components/SearchModal';
import { PRODUCTS, Product, Bundle } from './data/products';
import { Check, Sparkles } from 'lucide-react';

export function App() {
  // App State
  const [activeCategory, setActiveCategory] = useState('all');
  const [pincode, setPincode] = useState('452001'); // Default Indore/Central
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      id: PRODUCTS[0].id,
      name: PRODUCTS[0].name,
      price: PRODUCTS[0].price,
      weight: PRODUCTS[0].weight,
      image: PRODUCTS[0].image,
      quantity: 2
    }
  ]);
  const [appliedCoupon, setAppliedCoupon] = useState('BILOKAT20');
  
  // Modals & Drawers
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [showPincodeModal, setShowPincodeModal] = useState(false);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Listen for Cmd+K keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cart Operations
  const handleAddToCart = (product: Product, quantity = 1) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          weight: product.weight,
          image: product.image,
          quantity
        }
      ];
    });
    showToast(`Added "${product.name}" to cart!`);
    setIsCartOpen(true);
  };

  const handleAddBundleToCart = (bundle: Bundle) => {
    setCartItems(prev => [
      ...prev,
      {
        id: bundle.id,
        name: bundle.name,
        price: bundle.price,
        weight: 'Combo Saver Bundle',
        image: bundle.image,
        quantity: 1,
        isBundle: true
      }
    ]);
    showToast(`Added "${bundle.name}" to cart!`);
    setIsCartOpen(true);
  };

  const handleAddComboToCart = (comboTitle: string, price: number, items: Product[]) => {
    setCartItems(prev => [
      ...prev,
      {
        id: `custom-combo-${Date.now()}`,
        name: comboTitle,
        price,
        weight: '4 Packs Custom Snack Box',
        image: items[0].image,
        quantity: 1,
        isBundle: true
      }
    ]);
    showToast(`Added "${comboTitle}" to cart!`);
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setCartItems(prev =>
      prev
        .map(item => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
        .filter(item => item.quantity > 0)
    );
  };

  const handleRemoveItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-amber-50/40 text-amber-950 font-sans antialiased selection:bg-amber-500 selection:text-amber-950">
      
      {/* Toast Floating Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-950 text-white px-4 py-3 rounded-2xl shadow-2xl border border-amber-500/50 flex items-center gap-2 text-xs sm:text-sm font-bold animate-in slide-in-from-bottom duration-200">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <span>{toastMessage}</span>
          <Check className="w-4 h-4 text-emerald-400 ml-2" />
        </div>
      )}

      {/* 1. Top Urgency & Coupon Announcement Bar */}
      <AnnouncementBar
        onOpenPincodeModal={() => setShowPincodeModal(true)}
        selectedPincode={pincode}
      />

      {/* 2. Multi-Level E-Commerce Header Navbar */}
      <Navbar
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenPincodeModal={() => setShowPincodeModal(true)}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        pincode={pincode}
      />

      {/* Main Content */}
      <main>
        {/* 3. Modern D2C High Conversion Hero */}
        <Hero
          featuredProduct={PRODUCTS[0]}
          onQuickAdd={(p) => handleAddToCart(p, 1)}
          onOpenCombo={() => {
            const el = document.getElementById('combo-builder');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          onOpenCatalog={() => {
            const el = document.getElementById('catalog-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* 4. Social Proof & Trust Stats Bar */}
        <TrustStats />

        {/* 5. Interactive Flavor Quiz / Snack Finder */}
        <FlavorQuiz
          onAddProduct={(p) => handleAddToCart(p, 1)}
          onOpenQuickView={(p) => setSelectedProduct(p)}
        />

        {/* 6. Product Showcase & Category Catalog Grid */}
        <ProductCatalog
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          onAddProduct={(p) => handleAddToCart(p, 1)}
          onOpenQuickView={(p) => setSelectedProduct(p)}
        />

        {/* 7. Interactive Custom Snack Box Maker (₹499 Combo Builder) */}
        <ComboBuilder onAddComboToCart={handleAddComboToCart} />

        {/* 8. Brand Benefits Comparison Table (Bilokat vs Market Namkeens) */}
        <ComparisonSection />

        {/* 9. Express Delivery & Pincode Checker Widget */}
        <PincodeChecker
          currentPincode={pincode}
          onSetPincode={(pin) => setPincode(pin)}
        />

        {/* 10. Verified Customer Reviews & Lifestyle Wall */}
        <ReviewsSection />

        {/* 11. Curated Pricing Bundles & Festive Hampers */}
        <PricingBundles onAddBundleToCart={handleAddBundleToCart} />

        {/* 12. Frequently Asked Questions (Accordion) */}
        <FAQ />

        {/* 13. High Conversion Final CTA Banner */}
        <CTABanner
          onOpenCatalog={() => {
            const el = document.getElementById('catalog-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </main>

      {/* 14. Rich Brand Footer */}
      <Footer />

      {/* Modals & Overlays */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onOpenCheckout={() => setIsCheckoutOpen(true)}
        appliedCoupon={appliedCoupon}
        onApplyCoupon={(code) => setAppliedCoupon(code)}
      />

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        appliedCoupon={appliedCoupon}
        pincode={pincode}
        onOrderSuccess={(details) => {
          setIsCheckoutOpen(false);
          setCartItems([]);
          setOrderDetails(details);
        }}
      />

      <OrderSuccessModal
        orderDetails={orderDetails}
        onClose={() => setOrderDetails(null)}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectProduct={(p) => setSelectedProduct(p)}
      />

      {/* Modal for Pincode selection trigger */}
      {showPincodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-amber-300">
            <h3 className="font-bold text-amber-950 text-base font-serif-display">Set Delivery Pincode</h3>
            <p className="text-xs text-amber-800">
              Enter your 6-digit Indian pincode to check express air courier availability &amp; COD option.
            </p>
            <input
              type="text"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="e.g. 110001"
              className="w-full bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 text-sm font-bold font-mono text-amber-950 outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowPincodeModal(false)}
                className="w-full bg-amber-600 text-white font-extrabold text-xs py-2.5 rounded-xl cursor-pointer"
              >
                Save Pincode
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
