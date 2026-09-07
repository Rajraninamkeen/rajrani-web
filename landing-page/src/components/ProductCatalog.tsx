import React, { useState } from 'react';
import { ShoppingBag, Star, Eye, Flame, ShieldCheck, Filter, ArrowUpDown } from 'lucide-react';
import { PRODUCTS, Product } from '../data/products';

interface ProductCatalogProps {
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  onAddProduct: (product: Product) => void;
  onOpenQuickView: (product: Product) => void;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  activeCategory,
  setActiveCategory,
  onAddProduct,
  onOpenQuickView
}) => {
  const [selectedSpiceFilter, setSelectedSpiceFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'bestseller' | 'price-low' | 'price-high' | 'rating'>('bestseller');

  const categories = [
    { id: 'all', label: 'All Varieties' },
    { id: 'bestseller', label: '🔥 Best Sellers' },
    { id: 'spicy', label: '🌶️ Spicy & Ratlami' },
    { id: 'mixtures', label: '🌰 Royal Mixtures' },
    { id: 'healthy', label: '🍃 Healthy Roasts' },
    { id: 'gifts', label: '🎁 Gift Hampers' }
  ];

  // Filter products
  let filteredProducts = PRODUCTS.filter(product => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'bestseller') return product.isBestseller;
    return product.category === activeCategory;
  });

  if (selectedSpiceFilter !== 'all') {
    filteredProducts = filteredProducts.filter(p => p.spiceLevel === selectedSpiceFilter);
  }

  // Sort products
  filteredProducts.sort((a, b) => {
    if (sortBy === 'price-low') return a.price - b.price;
    if (sortBy === 'price-high') return b.price - a.price;
    if (sortBy === 'rating') return b.rating - a.rating;
    return (b.reviewCount || 0) - (a.reviewCount || 0);
  });

  const renderSpiceMeter = (level: number) => {
    return (
      <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-900" title={`Spice Level: ${level}/4`}>
        <span>Spice:</span>
        <div className="flex items-center">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={i <= level ? 'opacity-100' : 'opacity-25'}>
              🌶️
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <section id="catalog-section" className="py-16 bg-gradient-to-b from-amber-50/50 via-white to-amber-50/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-widest text-amber-700">
              Artisanal Batch Production • 100% Peanut Oil
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-amber-950 font-serif-display mt-1">
              Explore Fresh Namkeen Collection
            </h2>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-2 bg-amber-100 text-amber-900 px-4 py-2 rounded-2xl text-xs font-bold border border-amber-200 shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>0% Cheap Palm Oil • 9 Months Zip-Lock Freshness</span>
          </div>
        </div>

        {/* Category Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-200 pb-4 mb-8">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-amber-950 text-amber-100 shadow-md scale-105'
                    : 'bg-white text-amber-900 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Filter & Sort Controls */}
          <div className="flex items-center gap-3 text-xs">
            {/* Spice Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-amber-200 px-3 py-1.5 rounded-xl text-amber-950 font-medium">
              <Filter className="w-3.5 h-3.5 text-amber-600" />
              <select
                value={selectedSpiceFilter}
                onChange={(e) => setSelectedSpiceFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-transparent font-bold cursor-pointer outline-none"
              >
                <option value="all">All Spice Levels</option>
                <option value={1}>🌶️ Mild</option>
                <option value={2}>🌶️🌶️ Medium</option>
                <option value={3}>🌶️🌶️🌶️ Spicy</option>
                <option value={4}>🌶️🌶️🌶️🌶️ Fiery Hot</option>
              </select>
            </div>

            {/* Sort Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-amber-200 px-3 py-1.5 rounded-xl text-amber-950 font-medium">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-600" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent font-bold cursor-pointer outline-none"
              >
                <option value="bestseller">Sort: Popularity</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-amber-200">
            <p className="text-lg font-bold text-amber-950">No snacks found for this filter selection.</p>
            <p className="text-xs text-amber-800 mt-1">Try resetting your spice level or category filter.</p>
            <button
              onClick={() => {
                setActiveCategory('all');
                setSelectedSpiceFilter('all');
              }}
              className="mt-4 bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="group bg-white rounded-3xl overflow-hidden border border-amber-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between relative"
              >
                {/* Product Image Section */}
                <div className="relative aspect-4/3 overflow-hidden bg-amber-950">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                  />

                  {/* Top Discount & Bestseller Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                    <span className="bg-red-600 text-white font-extrabold text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full shadow">
                      {product.discountPercent}% OFF
                    </span>
                    {product.isBestseller && (
                      <span className="bg-amber-400 text-amber-950 font-black text-[10px] px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                        <Flame className="w-3 h-3 text-red-600 fill-red-600" /> BESTSELLER
                      </span>
                    )}
                  </div>

                  {/* Region Badge */}
                  <div className="absolute top-3 right-3 bg-amber-950/80 backdrop-blur-md text-amber-200 font-semibold text-[10px] px-2.5 py-1 rounded-lg border border-amber-700/50">
                    {product.regionOrigin}
                  </div>

                  {/* Hover Quick View Overlay Button */}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => onOpenQuickView(product)}
                      className="bg-white/95 text-amber-950 font-extrabold text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-1.5 hover:bg-white transform hover:scale-105 transition cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-amber-600" />
                      <span>Quick Details</span>
                    </button>
                  </div>
                </div>

                {/* Product Body */}
                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Rating & Spice Meter */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-amber-950">{product.rating}</span>
                        <span className="text-gray-400 text-[11px]">({product.reviewCount})</span>
                      </div>
                      {renderSpiceMeter(product.spiceLevel)}
                    </div>

                    {/* Title & Tagline */}
                    <h3 
                      onClick={() => onOpenQuickView(product)}
                      className="text-base font-extrabold text-amber-950 font-serif-display group-hover:text-amber-600 transition-colors line-clamp-1 cursor-pointer"
                    >
                      {product.name}
                    </h3>
                    <p className="text-xs text-amber-900/70 line-clamp-2 mt-0.5">
                      {product.tagline}
                    </p>
                  </div>

                  {/* Stock Left Urgency */}
                  <div className="text-[11px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100 flex items-center justify-between">
                    <span>⚡ Only {product.stockLeft} packs left at this price</span>
                    <span className="text-amber-800 font-normal">{product.weight}</span>
                  </div>

                  {/* Price & Add To Cart Button */}
                  <div className="pt-2 border-t border-amber-100 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-extrabold text-amber-950">
                          ₹{product.price}
                        </span>
                        <span className="text-xs line-through text-gray-400">
                          ₹{product.originalPrice}
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-700 font-bold">
                        Taxes Included • Free Del &gt; ₹399
                      </div>
                    </div>

                    <button
                      onClick={() => onAddProduct(product)}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>ADD +</span>
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
};
