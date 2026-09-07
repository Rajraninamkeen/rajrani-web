import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Search } from 'lucide-react';
import { FAQS } from '../data/products';

export const FAQ: React.FC = () => {
  const [openId, setOpenId] = useState<string>(FAQS[0].id);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFaqs = FAQS.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section className="py-16 bg-white border-t border-amber-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-950 px-3.5 py-1 rounded-full text-xs font-bold border border-amber-200">
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Got Questions? We Have Answers</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-amber-950 font-serif-display">
            Frequently Asked Questions
          </h2>
          <p className="text-sm sm:text-base text-amber-900/80 max-w-xl mx-auto">
            Everything you need to know about our oil purity, shelf life, shipping &amp; Cash on Delivery.
          </p>
        </div>

        {/* Search FAQ */}
        <div className="relative mb-8 max-w-md mx-auto">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions (e.g. oil, delivery, COD, freshness)..."
            className="w-full bg-amber-50/50 border border-amber-200 rounded-2xl pl-10 pr-4 py-3 text-xs sm:text-sm font-medium text-amber-950 outline-none focus:border-amber-500 focus:bg-white transition"
          />
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3">
          {filteredFaqs.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                className="bg-amber-50/60 rounded-2xl border border-amber-200/80 overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => setOpenId(isOpen ? '' : faq.id)}
                  className="w-full text-left p-4 sm:p-5 font-bold text-amber-950 text-sm sm:text-base flex items-center justify-between gap-4 hover:bg-amber-100/50 cursor-pointer"
                >
                  <span className="font-serif-display">{faq.question}</span>
                  <div className="p-1 rounded-full bg-amber-200/60 shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4 text-amber-900" /> : <ChevronDown className="w-4 h-4 text-amber-900" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="p-4 sm:p-5 pt-0 text-xs sm:text-sm text-amber-900/90 leading-relaxed border-t border-amber-200/40 bg-white/60 animate-in fade-in duration-200">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
