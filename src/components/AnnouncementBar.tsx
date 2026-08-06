import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Product } from '../types';
import { Sparkles, ArrowLeft } from 'lucide-react';

interface MarqueeSettings {
  marqueeText?: string;
  marqueeType?: 'text' | 'products';
  marqueeProductIds?: string[];
}

interface AnnouncementBarProps {
  allProducts: Product[];
  onProductClick: (product: Product) => void;
}

export default function AnnouncementBar({ allProducts, onProductClick }: AnnouncementBarProps) {
  const [settings, setSettings] = useState<MarqueeSettings | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as MarqueeSettings);
      }
    });
    return () => unsub();
  }, []);

  if (!settings) return null;

  const displayProducts = settings.marqueeType === 'products' 
    ? allProducts.filter(p => settings.marqueeProductIds?.includes(p.id))
    : [];

  return (
    <div className="bg-[#D4AF37] text-black h-10 flex items-center overflow-hidden border-y border-white/20">
      <div className="whitespace-nowrap flex animate-marquee items-center gap-10 min-w-full">
        {settings.marqueeType === 'text' ? (
          <>
            {Array.from({ length: 5 }).map((_, groupIdx) => (
              <div key={`marquee-text-grp-${groupIdx}`} className="flex items-center gap-4 px-10">
                <Sparkles size={16} fill="currentColor" />
                <span className="text-xs font-black uppercase tracking-widest leading-none pt-1">
                  {settings.marqueeText || 'مرحباً بكم في عالم الفخامة.. AURUM يصحبكم في رحلة ملكية ⚜️'}
                </span>
                <Sparkles size={16} fill="currentColor" />
              </div>
            ))}
          </>
        ) : (
          <>
            {Array.from({ length: 5 }).map((_, groupIdx) => (
              <div key={`marquee-prod-grp-${groupIdx}`} className="flex items-center gap-8 px-10">
                {displayProducts.map((product, pIdx) => (
                  <button 
                    key={`marquee-item-${groupIdx}-${product.id}-${pIdx}`}
                    onClick={() => onProductClick(product)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <img src={product.image || null} className="w-6 h-6 rounded-full object-cover border border-black/20" />
                    <span className="text-[10px] font-black uppercase tracking-tight">{product.name} - {product.price}</span>
                    <ArrowLeft size={12} />
                  </button>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
      
      {/* Reverse loop for smooth transition if needed or just double it inside */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
