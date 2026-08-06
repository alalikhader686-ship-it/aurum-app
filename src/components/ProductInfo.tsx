import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowRight,
  Heart, 
  Star, 
  ShoppingCart, 
  MapPin, 
  Sparkles,
  User,
  ShieldCheck,
  Loader2,
  Home,
  X,
  Share2,
  Copy,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { addToFavorites, removeFromFavorites } from '../store/favoritesSlice';
import { Product, Review } from '../types';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import { cn, slugify } from '../lib/utils';

interface LazyImageProps {
  src: string | null;
  alt: string;
  className?: string;
  referrerPolicy?: 'no-referrer' | 'origin' | 'unsafe-url';
}

const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className, referrerPolicy }) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const isMounted = React.useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-neutral-950 overflow-hidden flex items-center justify-center">
      <div 
        className={cn(
          "absolute inset-0 bg-gradient-to-b from-[#111] via-[#090909] to-[#111] flex items-center justify-center transition-opacity duration-500 pointer-events-none",
          isLoaded ? "opacity-0" : "opacity-100"
        )}
      >
        <Sparkles className="text-[#D4AF37]/15 animate-pulse" size={20} />
      </div>
      
      {src && (
        <img
          src={src}
          alt={alt}
          onLoad={() => {
            if (isMounted.current) {
              setIsLoaded(true);
            }
          }}
          className={cn(
            className,
            "transition-opacity duration-700 ease-out",
            isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105"
          )}
          referrerPolicy={referrerPolicy}
          loading="lazy"
        />
      )}
    </div>
  );
};

interface ProductInfoProps {
  item: Product;
  allProducts: Product[];
  onBack: () => void;
  onAddToCart: (product: Product) => void;
  onNavigate: (screen: string) => void;
  onProductClick: (product: Product) => void;
}

export default function ProductInfo({ item, allProducts, onBack, onAddToCart, onNavigate, onProductClick }: ProductInfoProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [userRating, setUserRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [productData, setProductData] = useState<Product>(item);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  
  const [isVIP, setIsVIP] = useState(false);
  
  const dispatch = useDispatch();
  const favorites = useSelector((state: RootState) => state.favorites.favorites);
  const isFavorite = favorites.some(f => f.id === item.id);

  useEffect(() => {
    // Scroll to top when product ID changes
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Use onSnapshot for real-time updates and better offline handling
    const unsubProduct = onSnapshot(doc(db, 'products', item.id), (docSnap) => {
      if (docSnap.exists()) {
        setProductData({ id: docSnap.id, ...docSnap.data() } as Product);
      }
    }, (err) => {
      console.error("Error fetching product data snapshot:", err);
    });

    let unsubUser: (() => void) | undefined;
    if (auth.currentUser) {
      unsubUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (userDoc) => {
        if (userDoc.exists()) {
          setIsVIP(userDoc.data().isVIP || false);
        }
      }, (err) => {
        console.error("Error fetching VIP status snapshot:", err);
      });
    }

    return () => {
      unsubProduct();
      if (unsubUser) unsubUser();
    };
  }, [item.id, auth.currentUser]);

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("يرجى تسجيل الدخول لترك تقييم ⚜️");
      return;
    }
    if (!comment.trim()) return;

    setSubmitting(true);
    try {
      const docRef = doc(db, 'products', item.id);
      
      // Get current reviews to calculate new average
      const currentReviews = productData.reviews || [];
      const newReviewObj: Review = {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email || "Elite Member",
        rating: userRating,
        comment: comment.trim(),
        createdAt: new Date().toISOString()
      };
      
      const newReviews = [...currentReviews, newReviewObj];
      const newAvg = newReviews.reduce((acc, curr) => acc + curr.rating, 0) / newReviews.length;

      await updateDoc(docRef, {
        reviews: arrayUnion(newReviewObj),
        averageRating: newAvg
      });

      setComment("");
      setUserRating(5);
      alert("تمت إضافة تقييمك بنجاح ⚜️");
    } catch (err) {
      console.error("Error adding review:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFavorite = () => {
    if (isFavorite) {
      dispatch(removeFromFavorites({ id: item.id }));
    } else {
      dispatch(addToFavorites(item));
    }
  };

  const images = productData.images || [productData.image];
  const reviews = useMemo(() => {
    return [...(productData.reviews || [])].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [productData.reviews]);
  const displayRating = productData.averageRating || productData.rating || 5.0;

  const relatedProducts = useMemo(() => {
    return allProducts
      .filter(p => p.id !== item.id && (p.category === item.category || p.brand === item.brand))
      .slice(0, 4);
  }, [allProducts, item.id, item.category, item.brand]);

  const renderStars = (rating: number = 5) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star 
            key={`rating-star-${s}`} 
            size={14} 
            className={cn(s <= Math.floor(rating) ? "fill-[#D4AF37] text-[#D4AF37]" : "text-gray-700")} 
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32 selection:bg-[#D4AF37] selection:text-black relative" dir="rtl">
      {/* 1. معرض الصور المتعددة (Slider) */}
      <div className="relative h-[500px] w-full overflow-hidden group bg-[#070707] flex items-center justify-center">
        {/* Ambient Background Shimmer / Crown */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#111] via-[#090909] to-black flex items-center justify-center pointer-events-none">
          <Sparkles className="text-[#D4AF37]/15 animate-pulse" size={32} />
        </div>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.img 
            key={activeImage}
            initial={{ opacity: 0, scale: 1.1, x: 100 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: -100 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x > 50 && activeImage > 0) {
                setActiveImage(activeImage - 1);
              } else if (info.offset.x < -50 && activeImage < images.length - 1) {
                setActiveImage(activeImage + 1);
              }
            }}
            src={images[activeImage] || null} 
            alt={item.name} 
            className="w-full h-full object-cover cursor-grab active:cursor-grabbing"
            referrerPolicy="no-referrer"
          />
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none" />

        {/* أزرار الرجوع والمفضلة فوق الصورة */}
        <div className="absolute top-10 left-0 right-0 px-6 flex justify-between items-center z-10" dir="ltr">
          <div className="flex gap-3">
            <button 
              onClick={toggleFavorite}
              className={cn(
                "w-12 h-12 glass-morphism rounded-full flex items-center justify-center border transition-all active:scale-90",
                isFavorite 
                  ? "bg-[#D4AF37] text-black border-[#D4AF37]" 
                  : "text-[#D4AF37] border-[#D4AF37]/20 hover:bg-[#D4AF37]/10"
              )}
            >
              <Heart size={24} className={isFavorite ? "fill-black" : ""} />
            </button>

            <button 
              onClick={() => onNavigate('home')}
              className="w-12 h-12 glass-morphism rounded-full flex items-center justify-center text-[#D4AF37] border border-[#D4AF37]/20 hover:bg-[#D4AF37] hover:text-black transition-all active:scale-90"
              title="الرئيسية"
            >
              <Home size={24} />
            </button>
          </div>

          <button 
            onClick={onBack}
            className="w-12 h-12 glass-morphism rounded-full flex items-center justify-center text-[#D4AF37] border border-[#D4AF37]/20 hover:bg-[#D4AF37] hover:text-black transition-all active:scale-90"
            title="رجوع"
          >
            <ArrowRight size={24} />
          </button>
        </div>

        {/* المصغرات (Thumbnails) لتبديل أسهل */}
        {images.length > 1 && (
          <div className="absolute bottom-20 left-0 right-0 px-6 flex justify-center gap-2 z-10">
            {images.map((img, i) => (
              <button
                key={`img-thumb-${i}`}
                onClick={() => setActiveImage(i)}
                className={cn(
                  "w-12 h-16 rounded-lg overflow-hidden border-2 transition-all duration-300 transform",
                  activeImage === i 
                    ? "border-[#D4AF37] scale-110 shadow-lg shadow-[#D4AF37]/20" 
                    : "border-white/10 opacity-60 hover:opacity-100 hover:scale-105"
                )}
              >
                <img src={img || null} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        )}

        {/* مؤشر النقاط للصور */}
        <div className="absolute bottom-12 w-full flex justify-center gap-2">
          {images.map((_, i) => (
            <button
              key={`img-dot-${i}`}
              onClick={() => setActiveImage(i)}
              className={cn(
                "h-1 rounded-full transition-all duration-500",
                activeImage === i ? "bg-[#D4AF37] w-8" : "bg-white/30 w-1.5"
              )}
            />
          ))}
        </div>
      </div>

      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="relative -mt-12 bg-black rounded-t-[50px] px-8 pt-10 pb-20 border-t border-[#D4AF37]/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
      >
        <div className="max-w-3xl mx-auto">
          {/* 2. اسم المنتج والسعر */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <motion.span 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="text-[#D4AF37] text-[10px] font-black uppercase tracking-[0.4em] mb-2 block"
              >
                {productData.brand || productData.shopName || "AURUM LUXURY"} ⚜️
              </motion.span>
              <h1 className="text-3xl font-black mb-2 font-serif italic">{productData.name}</h1>
            </div>
            <div className="text-left">
              {item.isSale ? (
                <div className="flex flex-col items-end">
                  <p className="text-red-500 text-xl font-bold line-through opacity-60 mb-1">
                    {item.oldPrice} <span className="text-xs">{item.currency === 'USD' ? '$' : 'ل.س'}</span>
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="bg-amber-500 text-black text-[10px] px-2 py-1 rounded-lg font-black uppercase shadow-[0_0_15px_rgba(251,191,36,0.3)]">عرض حصري 🔥</span>
                    <div className="flex flex-col items-end">
                      <p className="text-[#D4AF37] text-4xl font-black tracking-tighter">
                        {item.salePrice} <span className="text-xs font-medium">{item.currency === 'USD' ? '$' : 'ل.س'}</span>
                      </p>
                      {item.currency === 'SYP' && item.newSypPrice && (
                        <p className="text-sm text-amber-500/60 font-black -mt-1">
                          {item.newSypPrice} <span className="text-[10px]">ليرة سورية (جديد)</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-end text-left">
                  <p className="text-[#D4AF37] text-3xl font-black tracking-tighter">
                    {productData.price} <span className="text-xs font-medium">{productData.currency === 'USD' ? '$' : 'ل.س'}</span>
                  </p>
                  {productData.currency === 'SYP' && productData.newSypPrice && (
                    <p className="text-sm text-amber-500/60 font-black -mt-1">
                      {productData.newSypPrice} <span className="text-[10px]">ليرة سورية (جديد)</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. التقييم والموقع */}
          <div className="flex flex-wrap items-center gap-4 mb-10">
            <div className="flex items-center gap-3 bg-[#1a1a1a] px-4 py-2 rounded-full border border-[#333]">
              {renderStars(displayRating)}
              <span className="text-sm font-black text-white">{displayRating.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <MapPin size={18} className="text-[#D4AF37]" />
              <span className="text-xs font-medium">{productData.location || "الموقع غير محدد ⚜️"}</span>
            </div>
            {/* Luxury Badges */}
            <div className="flex gap-2">
              <div className="px-3 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full text-[8px] font-black text-[#D4AF37] uppercase tracking-widest">أصلي 100%</div>
              <div className="px-3 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full text-[8px] font-black text-[#D4AF37] uppercase tracking-widest">إصدار محدود</div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent w-full mb-10" />

          {/* 4. الوصف */}
          <div className="mb-12">
            <h3 className="text-white font-black mb-4 text-xl flex items-center gap-3">
              <Sparkles size={20} className="text-[#D4AF37]" />
              التفاصيل الملكية
            </h3>
            <p className="text-gray-400 leading-[1.8] text-base font-medium mb-8">
              {item.description || `هذا المنتج الفاخر من مجموعة ${item.category} في AURUM يمثل قمة الحرفية والفخامة. صُمم خصيصاً لأولئك الذين لا يقبلون بأقل من الكمال في كل تفاصيل حياتهم.`}
            </p>

            {/* Size Selection */}
            {((productData.availableSizes?.length ?? 0) > 0 || (productData.variants?.length ?? 0) > 0) && (
              <div className="mb-10">
                <h3 className="text-white font-black mb-4 text-sm flex items-center gap-3">
                  <Sparkles size={16} className="text-[#D4AF37]" />
                  القياس المختار ⚜️ Choose Your Size
                </h3>
                <div className="flex flex-wrap gap-3">
                  {(productData.availableSizes && productData.availableSizes.length > 0 ? productData.availableSizes : productData.variants)?.map((size) => (
                    <button
                      key={`size-${size}`}
                      id={`size-btn-${size}`}
                      onClick={() => setSelectedSize(size)}
                      className={cn(
                        "min-w-[60px] h-14 px-5 rounded-2xl font-black text-sm transition-all border-2 flex items-center justify-center shadow-lg",
                        selectedSize === size 
                          ? "bg-[#D4AF37] text-black border-[#D4AF37] shadow-[0_10px_25px_rgba(212,175,55,0.4)] scale-105" 
                          : "bg-[#0c0c0c] text-gray-400 border-[#1a1a1a] hover:border-[#D4AF37]/50 hover:text-white"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color Selection */}
            {(productData.availableColors?.length ?? 0) > 0 && (
              <div className="mb-10">
                <h3 className="text-white font-black mb-4 text-sm flex items-center gap-3">
                  <Sparkles size={16} className="text-[#D4AF37]" />
                  اللون المختار ⚜️
                </h3>
                <div className="flex flex-wrap gap-3">
                  {productData.availableColors?.map((colorEntry) => {
                    const parts = colorEntry.split('|');
                    const colorName = parts[0];
                    const hex = parts[1];
                    const isSelected = selectedColor === colorName || selectedColor === colorEntry;
                    return (
                      <button
                        key={`color-${colorEntry}`}
                        onClick={() => setSelectedColor(colorName)}
                        className={cn(
                          "px-6 py-3 rounded-xl font-black text-xs transition-all border flex items-center gap-2",
                          isSelected 
                            ? "bg-[#D4AF37] text-black border-[#D4AF37] shadow-[0_5px_15px_rgba(212,175,55,0.4)]" 
                            : "bg-white/5 text-gray-400 border-white/10 hover:border-[#D4AF37]/30"
                        )}
                      >
                        <span>{colorName}</span>
                        {hex && (
                          <span 
                            className="w-3.5 h-3.5 rounded-full border border-white/30 inline-block shrink-0" 
                            style={{ backgroundColor: hex }} 
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Luxury Guarantee */}
            <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-[30px] p-6 flex items-center gap-6">
              <div className="w-16 h-16 bg-[#D4AF37] rounded-full flex items-center justify-center text-black shrink-0 shadow-[0_10px_30px_rgba(212,175,55,0.3)]">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h4 className="text-[#D4AF37] font-black text-sm mb-1">ضمان AURUM الملكي</h4>
                <p className="text-gray-500 text-[10px] font-bold leading-relaxed">نحن نضمن أصالة وجودة كل قطعة في مجموعتنا. استمتع بتجربة تسوق آمنة وفاخرة مع خدمة عملاء مخصصة للنخبة.</p>
              </div>
            </div>
          </div>

          {/* 5. قسم التعليقات (Reviews) */}
          <div className="mb-12">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-white font-black text-xl">أحدث آراء النخبة ({reviews.length})</h3>
            </div>

            {/* Add Review Form */}
            <div className="bg-[#0a0a0a] p-8 rounded-[40px] border border-[#D4AF37]/20 mb-10">
              <h4 className="text-[#D4AF37] font-black text-sm mb-6">اترك بصمتك الملكية ⚜️</h4>
              <form onSubmit={handleAddReview} className="space-y-6">
                <div className="flex gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button 
                      key={`rating-star-${s}`} 
                      type="button"
                      onClick={() => setUserRating(s)}
                      className="transition-transform active:scale-90"
                    >
                      <Star 
                        size={24} 
                        className={cn(s <= userRating ? "fill-[#D4AF37] text-[#D4AF37]" : "text-gray-700")} 
                      />
                    </button>
                  ))}
                </div>
                <textarea 
                  className="w-full bg-black border border-[#222] rounded-2xl p-6 text-white text-sm focus:outline-none focus:border-[#D4AF37] transition-all h-32"
                  placeholder="اكتب تعليقك هنا..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : "إرسال التقييم ⚜️"}
                </button>
              </form>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.length === 0 ? (
                <p className="text-gray-600 text-center col-span-2 py-10">كن أول من يترك تقييماً لهذا المنتج الفاخر</p>
              ) : (
                reviews.map((rev: Review, index: number) => (
                  <motion.div 
                    key={`review-${index}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-[#0a0a0a] p-6 rounded-[30px] border border-[#D4AF37]/5 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-[#D4AF37]/5 blur-2xl rounded-full" />
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] border border-[#D4AF37]/20">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">{rev.userEmail?.split('@')[0] || "عضو AURUM"}</p>
                          <div className="flex gap-0.5 mt-1">
                            {[1, 2, 3, 4, 5].map(s => <Star key={s} size={10} className={cn(s <= rev.rating ? "fill-[#D4AF37] text-[#D4AF37]" : "text-gray-700")} />)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-[10px] text-gray-500 font-bold mb-1">
                          {new Date(rev.createdAt).toLocaleDateString('ar-SY')}
                        </span>
                        <div className="flex items-center gap-1 bg-[#D4AF37]/10 px-2 py-0.5 rounded-full border border-[#D4AF37]/20">
                           <ShieldCheck size={8} className="text-[#D4AF37]" />
                           <span className="text-[8px] text-[#D4AF37] font-black uppercase">عضو موثق</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-500 text-sm italic leading-relaxed relative z-10">"{rev.comment}"</p>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Share Section */}
          <div className="mb-12 bg-[#0a0a0a] border border-[#D4AF37]/10 p-6 rounded-[35px] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#D4AF37]/5 blur-3xl rounded-full" />
            <h3 className="text-white font-black mb-6 text-sm flex items-center gap-3 relative z-10">
              <Share2 size={16} className="text-[#D4AF37]" />
              شارك الفخامة ⚜️
            </h3>
            <div className="grid grid-cols-2 gap-4 relative z-10">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const shareUrl = `${window.location.origin}/products/${slugify(item.name)}`;
                  const text = `اكتشف هذا المنتج الفاخر في AURUM ⚜️: ${item.name}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + shareUrl)}`, '_blank');
                }}
                className="flex items-center justify-center gap-3 bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white py-4 rounded-2xl shadow-[0_10px_30px_rgba(37,211,102,0.2)] hover:shadow-[0_15px_40px_rgba(37,211,102,0.3)] transition-all font-bold text-sm"
              >
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <MessageCircle size={18} />
                </div>
                <span>واتساب</span>
              </motion.button>
              
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const shareUrl = `${window.location.origin}/products/${slugify(item.name)}`;
                  navigator.clipboard.writeText(shareUrl);
                  alert("تم نسخ الرابط بنجاح ⚜️");
                }}
                className="flex items-center justify-center gap-3 bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-black py-4 rounded-2xl shadow-[0_10px_30px_rgba(212,175,55,0.2)] hover:shadow-[0_15px_40px_rgba(212,175,55,0.3)] transition-all font-bold text-sm"
              >
                <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Copy size={18} />
                </div>
                <span>نسخ الرابط</span>
              </motion.button>
            </div>
          </div>

          {/* 6. منتجات مقترحة (Related Products) */}
          {relatedProducts.length > 0 && (
            <div className="mb-12">
              <h3 className="text-white font-black text-xl mb-8 flex items-center gap-3">
                <Sparkles size={20} className="text-[#D4AF37]" />
                قطع فاخرة قد تنال إعجابك ⚜️
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {relatedProducts.map((p) => (
                  <motion.div
                    key={`related-${p.id}`}
                    whileHover={{ y: -5 }}
                    onClick={() => onProductClick(p)}
                    className="bg-[#0a0a0a] rounded-3xl p-3 border border-[#D4AF37]/5 hover:border-[#D4AF37]/30 transition-all cursor-pointer group"
                  >
                    <div className="aspect-square rounded-2xl overflow-hidden mb-3 relative">
                      <LazyImage 
                        src={p.image || null} 
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                    </div>
                    <div className="px-1">
                      <h4 className="text-[10px] font-black line-clamp-1 mb-1">{p.name}</h4>
                      <p className="text-[#D4AF37] text-xs font-black">
                        {p.price} {p.currency === 'USD' ? '$' : 'ل.س'}
                        {p.currency === 'SYP' && p.newSypPrice && (
                          <span className="block text-[8px] text-amber-500/60 mt-0.5">{p.newSypPrice} ل.س جديد</span>
                        )}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* 6. زر الإضافة للسلة الثابت */}
      <div className="fixed bottom-8 left-0 right-0 px-8 z-50">
        <div className="max-w-3xl mx-auto">
          <button 
            onClick={() => {
              if (productData.stock !== undefined && productData.stock <= 0) {
                alert("عذراً ⚜️: هذا المنتج أصبح تحفة تذكارية ملكية مقتناة ومحفوظة بالكامل.");
                return;
              }
              if (productData.isVIPOnly && !isVIP) {
                alert("هذا المنتج حصري لأعضاء VIP ⚜️");
                return;
              }

              if (((productData.availableSizes?.length ?? 0) > 0 || (productData.variants?.length ?? 0) > 0) && !selectedSize) {
                alert("يرجى اختيار القياس أولاً ⚜️");
                return;
              }

              if ((productData.availableColors?.length ?? 0) > 0 && !selectedColor) {
                alert("يرجى اختيار اللون أولاً ⚜️");
                return;
              }

              onAddToCart({
                ...productData,
                selectedSize,
                selectedColor
              } as Product);
              setShowSuccessModal(true);
            }}
            className={cn(
              "w-full h-18 text-black font-black rounded-[25px] flex items-center justify-center gap-4 active:scale-95 transition-all group relative overflow-hidden",
              (productData.isVIPOnly && !isVIP) ? "bg-gray-800 text-gray-500 cursor-not-allowed" :
              (productData.stock !== undefined && productData.stock <= 0)
                ? "bg-black text-[#D4AF37] border-2 border-dashed border-[#D4AF37]/50 shadow-[0_0_25px_rgba(212,175,55,0.15)] cursor-not-allowed"
                : "bg-[#D4AF37] hover:bg-[#B8860B] shadow-[0_20px_50px_rgba(212,175,55,0.3)]"
            )}
          >
            <div className="absolute inset-0 gold-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
            {productData.isVIPOnly && !isVIP ? (
              <ShieldCheck size={26} className="relative z-10" />
            ) : (productData.stock !== undefined && productData.stock <= 0) ? (
              <Sparkles size={26} className="relative z-10 text-[#D4AF37] animate-pulse" />
            ) : (
              <ShoppingCart size={26} className="relative z-10" />
            )}
            <span className="text-sm sm:text-lg tracking-[0.05em] relative z-10 pr-2">
              {productData.stock !== undefined && productData.stock <= 0 
                ? "تحفة تذكارية ملكية مقتناة ⚜️" 
                : (productData.isVIPOnly && !isVIP ? "حصري لـ VIP ⚜️" : "اقتناء الآن ⚜️")}
            </span>
          </button>
        </div>
      </div>

      {/* Success Choice Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-black/80 border border-[#D4AF37]/30 rounded-[40px] p-8 w-full max-w-[320px] shadow-[0_50px_100px_rgba(0,0,0,0.9)] text-center overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 gold-shimmer" />
              
              <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-5 border border-[#D4AF37]/20">
                <Sparkles size={32} className="text-[#D4AF37] animate-pulse" />
              </div>
              
              <h3 className="text-xl font-black text-white mb-2 font-serif italic text-reveal">اختيارك الملكي ⚜️</h3>
              <p className="text-gray-500 text-[11px] mb-8 font-bold leading-relaxed px-2">تمت إضافة المنتج بنجاح. كيف ترغب في المتابعة؟</p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    setShowSuccessModal(false);
                    onNavigate('cart');
                  }}
                  className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg text-[13px] uppercase tracking-tighter"
                >
                  <ShoppingCart size={16} />
                  الذهاب إلى السلة ⚜️
                </button>
                <button 
                  onClick={() => {
                    setShowSuccessModal(false);
                    onBack();
                  }}
                  className="w-full bg-white/5 border border-white/10 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-white/10 text-[13px] uppercase tracking-tighter"
                >
                  <Home size={16} />
                  العودة للرئيسية
                </button>
              </div>

              <button 
                onClick={() => setShowSuccessModal(false)}
                className="mt-6 text-gray-700 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors flex items-center justify-center gap-1 mx-auto"
              >
                <X size={12} />
                إغلاق النافذة
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
