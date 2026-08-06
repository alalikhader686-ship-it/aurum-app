import React, { useState, useRef } from 'react';
import { 
  ChevronLeft, 
  ShoppingCart, 
  Share2, 
  Heart,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product } from '../types';
import { cn } from '../lib/utils';

interface ShopDetailsProps {
  shopName: string;
  products: Product[];
  onBack: () => void;
  onAddToCart: (product: Product) => void;
}

export default function ShopDetails({ shopName, products, onBack, onAddToCart }: ShopDetailsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState<Record<string, boolean>>({});

  // Handle scroll to update active index
  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollY = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    const index = Math.round(scrollY / height);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const handleShare = async (product: Product) => {
    const symbol = product.currency === 'USD' ? '$' : 'ل.س';
    const shareData = {
      title: `AURUM - ${product.name}`,
      text: `اكتشف الفخامة في متجر ${shopName} ⚜️\nالمنتج: ${product.name}\nالسعر: ${product.price} ${symbol}${product.currency === 'SYP' ? ` (${product.newSypPrice} ل.س جديد)` : ''}\nحمل تطبيق AURUM الآن!`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        alert("تم نسخ رابط المنتج لمشاركته ⚜️");
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  const toggleFavorite = (id: string) => {
    setIsFavorite(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="fixed inset-0 bg-black z-[60] overflow-hidden flex flex-col" dir="rtl">
      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-[70] pointer-events-none">
        <button 
          onClick={onBack}
          className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-[#D4AF37] border border-[#D4AF37]/20 pointer-events-auto active:scale-90 transition-transform"
        >
          <ChevronLeft size={28} />
        </button>
        <h2 className="text-[#D4AF37] text-xl font-black tracking-[0.1em] pointer-events-auto">{shopName}</h2>
        <div className="w-12" />
      </div>

      {/* Background Layer (Animated based on activeIndex) */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            <img 
              src={products[activeIndex]?.image || null} 
              className="w-full h-full object-cover blur-2xl scale-110"
              alt="background"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Vertical Paging Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto snap-y snap-mandatory scroll-smooth z-10 no-scrollbar"
      >
        {products.map((product) => (
          <div 
            key={`shop-item-${product.id}`}
            className="h-full w-full flex items-center justify-center snap-start px-6"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-md bg-white/[0.03] backdrop-blur-xl border border-[#D4AF37]/20 rounded-[40px] p-6 shadow-2xl overflow-hidden relative"
            >
              {/* Product Image */}
              <div className="relative aspect-[4/5] rounded-[30px] overflow-hidden mb-6 group">
                <img 
                  src={product.image || null} 
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Product Info */}
              <div className="text-center space-y-2 mb-8">
                <h3 className="text-white text-3xl font-bold">{product.name}</h3>
                {product.isSale ? (
                  <div className="flex flex-col items-center">
                    <span className="text-red-500 line-through text-base font-bold opacity-70 mb-1">
                      {product.oldPrice} <span className="text-sm">{product.currency === 'USD' ? '$' : 'ل.س'}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="bg-amber-500 text-black text-[10px] px-2 py-1 rounded-lg font-black uppercase">عروض AURUM</span>
                      <div className="flex flex-col items-center">
                        <p className="text-[#D4AF37] text-3xl font-black">
                          {product.salePrice} <span className="text-sm font-medium">{product.currency === 'USD' ? '$' : 'ل.س'}</span>
                        </p>
                        {product.currency === 'SYP' && product.newSypPrice && (
                          <span className="text-sm text-amber-500/60 font-black">
                            {product.newSypPrice} <span className="text-[10px]">ليرة سورية (جديد)</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <p className="text-[#D4AF37] text-2xl font-light tracking-wider">
                      {product.price} {product.currency === 'USD' ? '$' : 'ل.س'}
                    </p>
                    {product.currency === 'SYP' && product.newSypPrice && (
                      <span className="text-sm text-amber-500/60 font-black">
                        {product.newSypPrice} <span className="text-[10px]">ليرة سورية (جديد)</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => onAddToCart(product)}
                  className="flex-1 h-16 bg-[#D4AF37] text-black rounded-2xl flex items-center justify-center gap-3 font-black text-lg shadow-[0_10px_30px_rgba(212,175,55,0.3)] active:scale-95 transition-all"
                >
                  <ShoppingCart size={24} />
                  <span>أضف للسلة</span>
                </button>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => handleShare(product)}
                    className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-[#D4AF37] border border-white/5 hover:bg-white/20 transition-all active:scale-90"
                  >
                    <Share2 size={24} />
                  </button>
                  <button 
                    onClick={() => toggleFavorite(product.id)}
                    className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/5 hover:bg-white/20 transition-all active:scale-90"
                  >
                    <Heart 
                      size={24} 
                      className={cn(isFavorite[product.id] ? "fill-red-500 text-red-500" : "text-white")} 
                    />
                  </button>
                </div>
              </div>

              {/* Decorative Sparkle */}
              <div className="absolute top-4 right-4 text-[#D4AF37]/30">
                <Sparkles size={24} />
              </div>
            </motion.div>
          </div>
        ))}
      </div>

      {/* Scroll Indicator */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
        {products.map((_, i) => (
          <div 
            key={`scroll-indicator-${i}`}
            className={cn(
              "w-1.5 rounded-full transition-all duration-300",
              activeIndex === i ? "h-8 bg-[#D4AF37]" : "h-1.5 bg-gray-600"
            )}
          />
        ))}
      </div>
    </div>
  );
}
