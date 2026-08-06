import React, { useMemo } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Bell,
  Heart,
  Plus,
  X,
  Sparkles,
  Star,
  ArrowUpRight,
  Menu,
  ShieldCheck,
  Check,
  Loader2,
  Truck,
  Gem,
  Pencil,
  Camera,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useSpring } from 'motion/react';
import { Product, RedeemableProduct, WheelPrize, AurumUser, GlobalSettings, CustomJewelryRequest, Banner } from '../types';
import { cn } from '../lib/utils';
import { db, auth } from '../lib/firebase';
import { collection, doc, updateDoc, addDoc } from 'firebase/firestore';

import AnnouncementBar from './AnnouncementBar';
import Toast from './Toast';

// Reusable LazyImage Component for Instant Rendering & Seamless Fade-In Transition
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
      {/* Dynamic Golden Shimmer/Crown Placeholder */}
      <div 
        className={cn(
          "absolute inset-0 bg-gradient-to-b from-[#111] via-[#090909] to-[#111] flex items-center justify-center transition-opacity duration-500 pointer-events-none",
          isLoaded ? "opacity-0" : "opacity-100"
        )}
      >
        <Sparkles className="text-[#D4AF37]/15 animate-pulse" size={24} />
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

interface HomeScreenProps {
  products: Product[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
  currentIndex: number;
  cartCount: number;
  favoriteIds: string[];
  onProductClick: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleFavorite: (product: Product) => void;
  onOpenCart: () => void;
  onOpenNotifications: () => void;
  onOpenShop: (shopId: string) => void;
  onTabChange: (tab: string) => void;
  userDataProp?: AurumUser | null;
  redeemableProductsProp?: RedeemableProduct[];
  wheelPrizesProp?: WheelPrize[];
  bannersProp?: Banner[];
  globalSettingsProp?: GlobalSettings | null;
  isProductsLoadedProps?: boolean;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  products,
  searchQuery,
  setSearchQuery,
  selectedTab,
  setSelectedTab,
  currentIndex,
  cartCount,
  favoriteIds,
  onProductClick,
  onAddToCart,
  onToggleFavorite,
  onOpenCart,
  onOpenNotifications,
  onTabChange,
  userDataProp,
  redeemableProductsProp,
  wheelPrizesProp,
  globalSettingsProp,
  bannersProp,
  isProductsLoadedProps = true
}) => {
  const [showFilters, setShowFilters] = React.useState(false);
  const [quickViewProduct, setQuickViewProduct] = React.useState<Product | null>(null);
  const [isGridLoading, setIsGridLoading] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState(0);
  const [goldenHourEnd, setGoldenHourEnd] = React.useState<string | null>(null);
  const [isVIP, setIsVIP] = React.useState(false);
  const [userPoints, setUserPoints] = React.useState(0);
  const [userData, setUserData] = React.useState<AurumUser | null>(null);
  
  React.useEffect(() => {
    if (userDataProp) {
        setUserData(userDataProp);
        setIsVIP(userDataProp.isVIP || false);
        setUserPoints(userDataProp.points || 0);
    }
  }, [userDataProp]);

  const [redeemableProducts, setRedeemableProducts] = React.useState<RedeemableProduct[]>([]);
  
  React.useEffect(() => {
    if (redeemableProductsProp) setRedeemableProducts(redeemableProductsProp);
  }, [redeemableProductsProp]);

  const [wheelPrizes, setWheelPrizes] = React.useState<WheelPrize[]>([]);
  
  React.useEffect(() => {
    if (wheelPrizesProp) setWheelPrizes(wheelPrizesProp);
  }, [wheelPrizesProp]);

  const [bannerConfig, setBannerConfig] = React.useState({
    title: 'عروض AURUM الملكية ⚜️',
    subtitle: 'مجموعة حصرية ⚜️',
    duration: 5
  });

  React.useEffect(() => {
    if (globalSettingsProp) {
        if (globalSettingsProp.goldenHourEnd) setGoldenHourEnd(globalSettingsProp.goldenHourEnd);
        setBannerConfig({
            title: globalSettingsProp.bannerTitle || 'عروض AURUM الملكية ⚜️',
            subtitle: globalSettingsProp.bannerSubtitle || 'مجموعة حصرية ⚜️',
            duration: globalSettingsProp.bannerDuration || 5
        });
    }
  }, [globalSettingsProp]);
  const [showWheel, setShowWheel] = React.useState(false);
  const [showRewards, setShowRewards] = React.useState(false);
  const [isSpinning, setIsSpinning] = React.useState(false);
  const [spinResult, setSpinResult] = React.useState<WheelPrize | null>(null);
  const [rotation, setRotation] = React.useState(0);
  const [dailyClaimed, setDailyClaimed] = React.useState(false);
  const [justAddedId, setJustAddedId] = React.useState<string | null>(null);
  const [clothingSubTab, setClothingSubTab] = React.useState('الكل');
  const [showCustomModal, setShowCustomModal] = React.useState(false);
  const [customDescription, setCustomDescription] = React.useState('');
  const [customPhone, setCustomPhone] = React.useState('');
  const [customImage, setCustomImage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleCustomRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      setToast({ message: 'يرجى تسجيل الدخول لتقديم طلب ⚜️', type: 'error' });
      return;
    }
    if (!customDescription.trim() || !customPhone.trim()) {
      setToast({ message: 'يرجى تعبئة كافة الحقول ⚜️', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const requestData: Omit<CustomJewelryRequest, 'id'> = {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email || '',
        phone: customPhone,
        description: customDescription,
        imageUrl: customImage || null,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'custom_jewelry_requests'), requestData);
      setToast({ message: 'تم إرسال طلبك بنجاح! سنتواصل معك قريباً ⚜️', type: 'success' });
      setShowCustomModal(false);
      setCustomDescription('');
      setCustomPhone('');
      setCustomImage(null);
    } catch (err) {
      console.error("Error submitting custom request:", err);
      setToast({ message: 'حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً ⚜️', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddToCartClick = (product: Product) => {
    onAddToCart(product);
    setJustAddedId(product.id);
    setTimeout(() => setJustAddedId(null), 2000);
  };

  React.useEffect(() => {
    if (userData?.lastDailyClaim) {
      const last = new Date(userData.lastDailyClaim as string);
      const now = new Date();
      if (last.toDateString() === now.toDateString()) {
        setDailyClaimed(true);
      }
    }
  }, [userData]);

  const handleDailyClaim = async () => {
    if (dailyClaimed || !auth.currentUser) return;
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        points: (userPoints || 0) + 50,
        lastDailyClaim: new Date().toISOString()
      });
      await addDoc(collection(db, 'notifications'), {
        userId: auth.currentUser.uid,
        message: '⚜️ حصلت على 50 نقطة هدية يومية من أوروم! استمر في التفاعل لجمع المزيد.',
        read: false,
        createdAt: new Date().toISOString()
      });
      setDailyClaimed(true);
      alert("مبارك لك! ⚜️ حصلت على 50 نقطة ملكية إضافية.");
    } catch (err) {
      console.error("Error claiming daily reward:", err);
    }
  };

  React.useEffect(() => {
    if (userData) {
      setIsVIP(userData.isVIP || false);
      setUserPoints(userData.points || 0);
    }
  }, [userData]);

  React.useEffect(() => {
    if (!goldenHourEnd) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const end = new Date(goldenHourEnd).getTime();
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(timer);
  }, [goldenHourEnd]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* Removed artificial delay for performance */
  React.useEffect(() => {
    setIsGridLoading(false);
  }, [selectedTab]);

  React.useEffect(() => {
    if (selectedTab !== 'ألبسة') {
      setClothingSubTab('الكل');
    }
  }, [selectedTab]);

  const [logoTaps, setLogoTaps] = React.useState(0);

  const filteredProducts = useMemo(() => {
    return products.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesTab = selectedTab === 'الكل' || item.category === selectedTab || item.type === selectedTab;
      
      // Specialized filtering for Clothing Sub-categories
      if (selectedTab === 'ألبسة' && clothingSubTab !== 'الكل') {
        const itemCat = item.category?.trim() || "";
        const itemType = item.type?.trim() || "";
        const itemName = item.name || "";
        
        matchesTab = itemCat.includes(clothingSubTab) || 
                    itemType.includes(clothingSubTab) || 
                    itemName.includes(clothingSubTab);
      } else if (selectedTab === 'ألبسة' && clothingSubTab === 'الكل') {
        const itemCat = item.category?.trim() || "";
        matchesTab = itemCat === 'ألبسة' || 
                    itemCat === 'ملابس رجالية' || 
                    itemCat === 'ملابس نسائية' || 
                    itemCat === 'ملابس أطفال';
      }
      
      // Admin controlled sections - Allow all sections if filtering specifically, otherwise restrict to home/featured
      const isFiltering = searchQuery || (selectedTab !== 'الكل');
      const matchesSection = isFiltering ? true : (!item.section || item.section === 'home' || item.section === 'featured');
      
      return matchesSearch && matchesTab && matchesSection;
    });
  }, [products, searchQuery, selectedTab, clothingSubTab]);

  const handleLogoClick = () => {
    setLogoTaps(prev => prev + 1);
    if (logoTaps + 1 >= 5) {
      const email = auth.currentUser?.email?.toLowerCase();
      if (email === 'aurumapp7@gmail.com' || email === 'alalikhader686@gmail.com') {
        onTabChange('admin');
      }
      setLogoTaps(0);
    }
  };

  const DEFAULT_WHEEL_PRIZES: WheelPrize[] = React.useMemo(() => [
    { id: 'wp-1', label: 'حظ أوفر', value: 0, color: '#141414' },
    { id: 'wp-2', label: 'حظ أوفر', value: 0, color: '#241f12' },
    { id: 'wp-3', label: 'حظ أوفر', value: 0, color: '#101010' },
    { id: 'wp-4', label: 'حظ أوفر', value: 0, color: '#1a1810' },
    { id: 'wp-5', label: 'حظ أوفر', value: 0, color: '#141414' },
    { id: 'wp-6', label: 'حظ أوفر', value: 0, color: '#241f12' },
    { id: 'wp-7', label: 'حظ أوفر', value: 0, color: '#101010' },
    { id: 'wp-8', label: 'حظ أوفر', value: 0, color: '#1a1810' },
  ], []);

  const activeWheelPrizes = React.useMemo(() => {
    if (wheelPrizes && wheelPrizes.length > 0) {
      return wheelPrizes.map(p => ({ ...p, label: 'حظ أوفر', value: 0 }));
    }
    return DEFAULT_WHEEL_PRIZES;
  }, [wheelPrizes, DEFAULT_WHEEL_PRIZES]);

  const canSpin = useMemo(() => {
    if (!userData) return false;
    const lastSpin = userData.lastDailySpin ? new Date(userData.lastDailySpin as string) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dailyAvailable = !lastSpin || lastSpin < today;
    return dailyAvailable || ((userData.extraSpins as number) > 0);
  }, [userData]);

  const handleSpin = async () => {
    if (isSpinning || !canSpin || activeWheelPrizes.length === 0) return;

    setIsSpinning(true);

    // Identify "حظ أوفر" / 0 points vs winning prizes
    const noPrizeIndexes: number[] = [];
    const winIndexes: number[] = [];

    activeWheelPrizes.forEach((p, idx) => {
      if (p.value === 0 || p.label.includes('حظ') || p.label.includes('أوفر')) {
        noPrizeIndexes.push(idx);
      } else {
        winIndexes.push(idx);
      }
    });

    let selectedIndex: number;
    // ~5% chance (1 in 20) to win a prize, 95% chance for "حظ أوفر"
    const isWinner = Math.random() < 0.05;

    if (isWinner && winIndexes.length > 0) {
      selectedIndex = winIndexes[Math.floor(Math.random() * winIndexes.length)];
    } else if (noPrizeIndexes.length > 0) {
      selectedIndex = noPrizeIndexes[Math.floor(Math.random() * noPrizeIndexes.length)];
    } else {
      selectedIndex = Math.floor(Math.random() * activeWheelPrizes.length);
    }

    const prize = activeWheelPrizes[selectedIndex];
    
    const sliceAngle = 360 / activeWheelPrizes.length;
    // Align center of selected slice with pointer at top (0 deg)
    const targetSliceAngle = 360 - (selectedIndex * sliceAngle) - (sliceAngle / 2);
    const fullRotations = 360 * 6; // 6 smooth spins
    const baseRotation = Math.ceil(rotation / 360) * 360;
    const newRotation = baseRotation + fullRotations + targetSliceAngle;

    setRotation(newRotation);

    setTimeout(async () => {
      setIsSpinning(false);
      setSpinResult(prize);
      
      if (!auth.currentUser || !userData) return;
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const isDailySpin = !userData.lastDailySpin || new Date(userData.lastDailySpin as string) < new Date(new Date().setHours(0,0,0,0));
      
      const updateData: Record<string, unknown> = {
        points: (userData.points as number || 0) + (prize.value as number || 0),
      };

      if (isDailySpin) {
        updateData.lastDailySpin = new Date().toISOString();
      } else if ((userData.extraSpins as number) > 0) {
        updateData.extraSpins = (userData.extraSpins as number) - 1;
      }

      await updateDoc(userRef, updateData);
    }, 4200);
  };

  const handleRedeem = async (product: RedeemableProduct) => {
    if (!auth.currentUser || ((userData?.points as number) || 0) < product.pointsCost) {
      alert("عذراً ⚜️: نقاطك غير كافية لعملية الاستبدال.");
      return;
    }

    if (!confirm(`هل أنت متأكد من استبدال ${product.pointsCost} نقطة مقابل ${product.name}؟`)) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const currentPoints = (userData?.points as number) || 0;
      const pointsToDeduct = product.pointsCost;
      
      await updateDoc(userRef, {
        points: Math.max(0, currentPoints - pointsToDeduct)
      });

      await addDoc(collection(db, 'notifications'), {
        userId: auth.currentUser.uid,
        message: `تهانينا! ⚜️ لقد قمت باستبدال نقاطك بـ ${product.name}. سيتواصل معك فريقنا لتسليم هديتك.`,
        read: false,
        createdAt: new Date().toISOString()
      });

      alert("تمت عملية الاستبدال بنجاح ⚜️ مبارك لك هديتك الملكية.");
    } catch (err) {
      console.error(err);
    }
  };

  const featuredProducts = useMemo(() => {
    const featured = products.filter(p => p.isFeatured);
    return featured.length > 0 ? featured : products.slice(0, 5); // Fallback to first 5 if none featured
  }, [products]);

  const bannerItems = useMemo(() => {
    if (bannersProp && bannersProp.length > 0) return bannersProp;
    return featuredProducts.slice(0, 5).map(p => ({
      id: p.id,
      image: p.image,
      title: p.name,
      subtitle: p.price,
      link: p.id
    }));
  }, [bannersProp, featuredProducts]);

  const currentBanner = useMemo(() => 
    bannerItems[currentIndex % (bannerItems.length || 1)],
    [bannerItems, currentIndex]
  );

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <div className="min-h-screen bg-black font-sans text-white selection:bg-[#D4AF37] selection:text-black pb-32 liquid-bg" dir="rtl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Scroll Progress */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D4AF37] via-amber-200 to-[#D4AF37] z-[1000] origin-left"
        style={{ scaleX }}
      />
      
      <AnnouncementBar allProducts={products} onProductClick={onProductClick} />

      {/* Header */}
      <header className={cn(
        "sticky top-0 z-50 transition-all duration-700",
        scrolled ? "glass-morphism py-3 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-b border-[#D4AF37]/10" : "bg-transparent py-6"
      )}>
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-6">
          {/* Logo/Brand */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="hidden md:block cursor-pointer"
            onClick={handleLogoClick}
          >
            <h1 className="text-4xl font-serif italic text-reveal tracking-tight">AURUM</h1>
          </motion.div>

          {/* Search Bar */}
          <div className="flex-1 relative group flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D4AF37] group-focus-within:scale-110 transition-transform" size={18} />
              <input 
                type="text" 
                placeholder="ابحث عن الفخامة..." 
                className="w-full bg-black/40 border border-[#D4AF37]/10 rounded-2xl py-3.5 pr-12 pl-12 focus:outline-none focus:border-[#D4AF37] transition-all text-right placeholder:text-gray-600 font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#D4AF37] transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Search Overlay */}
            <AnimatePresence>
              {isSearchFocused && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex flex-col p-6 pt-32"
                >
                  <button 
                    onClick={() => setIsSearchFocused(false)}
                    className="absolute top-10 left-6 text-[#D4AF37] flex items-center gap-2 font-black text-sm"
                  >
                    إغلاق <X size={20} />
                  </button>
                  
                  <div className="max-w-2xl mx-auto w-full">
                    <h3 className="text-[#D4AF37] font-black text-xs tracking-widest uppercase mb-8">عمليات البحث الشائعة ⚜️</h3>
                    <div className="flex flex-wrap gap-3">
                      {['عطور ملكية', 'ساعات ذهبية', 'أطقم VIP', 'إصدارات محدودة'].map((tag, i) => (
                        <button 
                          key={`tag-${i}`}
                          onClick={() => {
                            setSearchQuery(tag);
                            setIsSearchFocused(false);
                          }}
                          className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-sm hover:bg-[#D4AF37] hover:text-black transition-all"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="relative">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "h-full px-4 rounded-2xl border transition-all flex items-center justify-center gap-2",
                  showFilters ? "bg-[#D4AF37] text-black border-[#D4AF37]" : "bg-black/40 border-[#D4AF37]/10 text-[#D4AF37]"
                )}
              >
                <Menu size={18} />
                <span className="hidden md:block text-xs font-bold">تصفية</span>
              </button>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute left-0 top-full mt-2 w-48 bg-[#111] border border-[#D4AF37]/20 rounded-2xl shadow-2xl overflow-hidden z-[60]"
                  >
                    <div className="p-2 space-y-1">
                      {['الكل', 'ألبسة', 'عطور (قريباً)', 'ساعات (قريباً)', 'إكسسوارات (قريباً)', 'أمازون (قريباً)'].map((cat) => (
                        <button
                          key={`main-cat-${cat}`}
                          onClick={() => {
                            if (cat.includes('قريباً')) {
                              setToast({ message: 'هذا القسم مقفل حالياً - قريباً تفتح 🔒⚜️', type: 'error' });
                            }
                            setSelectedTab(cat);
                            setShowFilters(false);
                          }}
                          className={cn(
                            "w-full text-right px-4 py-2.5 rounded-xl text-sm transition-all flex items-center justify-between",
                            selectedTab === cat ? "bg-[#D4AF37] text-black font-bold" : "text-gray-400 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <span>{cat}</span>
                          {cat.includes('قريباً') && <span className="text-[10px] opacity-70">🔒</span>}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button 
              onClick={onOpenNotifications}
              className="p-3 text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-2xl transition-all relative group"
            >
              <Bell size={24} className="group-hover:rotate-12 transition-transform" />
              <span className="absolute top-3 right-3 w-2 h-2 bg-[#D4AF37] rounded-full luxury-glow"></span>
            </button>

            {/* Cart Trigger */}
            <button 
              onClick={onOpenCart}
              className="p-3 text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-2xl transition-all relative group"
            >
              <motion.div
                key={cartCount}
                animate={cartCount > 0 ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <ShoppingCart size={24} className="group-hover:-translate-y-1 transition-transform" />
              </motion.div>
              {cartCount > 0 && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -left-1 bg-[#D4AF37] text-black text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-lg"
                >
                  {cartCount}
                </motion.span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto pb-24">
        {/* Main Home Content (Only visible when no filters are active) */}
        {selectedTab === 'الكل' && !searchQuery && (
          <>
            {/* Personalized Greeting */}
            <section className="px-6 mt-10">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
              >
                <div className="text-right">
                  <h2 className="text-3xl font-serif italic leading-tight">مرحبا بك <br/><span className="text-gold">في عالمنا</span> ⚜️</h2>
                  <div className="flex items-center gap-2 mt-2">
                    {isVIP && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1 bg-gradient-to-r from-amber-500 to-amber-600 text-black px-2.5 py-0.5 rounded-full border border-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                      >
                        <Star size={10} fill="currentColor" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">VIP ELITE</span>
                      </motion.div>
                    )}
                    <p className="text-gold/40 text-[10px] font-bold uppercase tracking-[0.2em]">Exclusively Curated for You</p>
                    <div className="h-4 w-px bg-gold/20 mx-1" />
                    <div className="flex items-center gap-1 bg-[#D4AF37]/10 px-2 py-0.5 rounded-full border border-[#D4AF37]/20 cursor-pointer" onClick={() => {
                      if (auth.currentUser?.isAnonymous) {
                        alert("عذراً ⚜️: متجر المكافآت متاح فقط للأعضاء الرسميين. انضم إلينا الآن لتفعيل نقاطك!");
                        onTabChange('login');
                        return;
                      }
                      setShowRewards(true);
                    }}>
                      <Star size={10} className="text-[#D4AF37]" />
                      <span className="text-[10px] font-bold text-[#D4AF37]">{(userPoints || 0)} نقطة ملكية</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 360 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        if (auth.currentUser?.isAnonymous) {
                          alert("عذراً ⚜️: عجلة الحظ حصرية للأعضاء المسجلين. سجل الآن لتجرب حظك وتربح نقاط ملكية!");
                          onTabChange('login');
                          return;
                        }
                        setShowWheel(true);
                      }}
                      className="relative w-16 h-16 rounded-full bg-[#0a0a0a] border-2 border-[#D4AF37] flex items-center justify-center text-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.2)] overflow-hidden group"
                    >
                      {/* Wheel Segments Visual Effect */}
                      <div 
                        className="absolute inset-0 opacity-20 transition-opacity group-hover:opacity-40" 
                        style={{ 
                          backgroundImage: 'conic-gradient(from 0deg, #D4AF37 0deg 45deg, transparent 45deg 90deg, #D4AF37 90deg 135deg, transparent 135deg 180deg, #D4AF37 180deg 225deg, transparent 225deg 270deg, #D4AF37 270deg 315deg, transparent 315deg 360deg)' 
                        }} 
                      />
                      
                      {/* Wheel Center Point */}
                      <div className="absolute w-2 h-2 bg-[#D4AF37] rounded-full z-20 shadow-[0_0_10px_#D4AF37]" />
                      
                      <Sparkles size={24} className={cn("relative z-10", canSpin ? "animate-pulse" : "")} />
                      
                      {canSpin && (
                        <div className="absolute -top-1 -right-1 z-30">
                          <span className="relative flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-black"></span>
                          </span>
                        </div>
                      )}
                    </motion.button>
                    <span className="text-[9px] font-black text-[#D4AF37] mt-1 tracking-widest uppercase">دوران الحظ</span>
                  </div>
                </div>
              </motion.div>
            </section>

            {/* Banner Slider */}
            <section className="px-6 mt-8">
              <div className="relative h-[400px] md:h-[600px] rounded-[45px] overflow-hidden group shadow-[0_40px_80px_rgba(0,0,0,0.9)] border border-white/5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, scale: 1.05, filter: 'blur(20px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full h-full relative"
                  >
                    <motion.img 
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 10, ease: "linear" }}
                      src={currentBanner?.image || null} 
                      alt="Banner" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      loading="eager"
                      onClick={() => {
                        if (!currentBanner) return;
                        if (bannersProp && bannersProp.length > 0) {
                          const linkedProduct = products.find(p => p.id === currentBanner.link);
                          if (linkedProduct) onProductClick(linkedProduct);
                        } else {
                          const product = featuredProducts.find(p => p.id === currentBanner.id);
                          if (product) onProductClick(product);
                        }
                      }}
                    />
                    
                    {/* Master Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
                    
                    <div className="absolute inset-x-0 bottom-0 p-10 md:p-16">
                      <motion.div 
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                        className="max-w-2xl"
                      >
                        <motion.span 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.7 }}
                          className="text-[#D4AF37] font-black tracking-[0.5em] text-[10px] md:text-xs mb-4 block uppercase flex items-center gap-2"
                        >
                          <Sparkles size={14} />
                          {currentBanner?.subtitle || bannerConfig.subtitle}
                        </motion.span>
                        
                        <h2 className="text-4xl md:text-8xl font-black text-white leading-[1.1] mb-8 font-serif italic drop-shadow-2xl">
                          {currentBanner?.title || bannerConfig.title}
                        </h2>
                        
                        <div className="flex items-center gap-6">
                          <motion.button 
                            whileHover={{ scale: 1.05, backgroundColor: '#B8860B' }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              if (!currentBanner) return;
                              if (bannersProp && bannersProp.length > 0) {
                                const linkedProduct = products.find(p => p.id === currentBanner.link);
                                if (linkedProduct) onProductClick(linkedProduct);
                              } else {
                                const product = featuredProducts.find(p => p.id === currentBanner.id);
                                if (product) onProductClick(product);
                              }
                            }}
                            className="bg-[#D4AF37] text-black px-12 py-5 rounded-[22px] font-black text-sm transition-all shadow-[0_20px_40px_rgba(212,175,55,0.4)] flex items-center gap-3 group"
                          >
                            <span>اكتشف الحصري ⚜️</span>
                            <ArrowUpRight size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                          </motion.button>
                          
                          <div className="hidden md:flex flex-col">
                            <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">القطع المتوفرة</span>
                            <span className="text-white font-mono text-lg">{bannerItems.length} عروض ملكية</span>
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {/* Slide Indicators */}
                    <div className="absolute right-10 bottom-1/2 translate-y-1/2 flex flex-col gap-4">
                      {bannerItems.map((_, idx) => (
                        <div 
                          key={`banner-dot-${idx}`}
                          className={cn(
                            "w-1 transition-all duration-700 rounded-full",
                            (currentIndex % (bannerItems.length || 1)) === idx ? "h-12 bg-[#D4AF37] shadow-[0_0_15px_#D4AF37]" : "h-4 bg-white/20"
                          )}
                        />
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </section>



            {/* Golden Hour Flash Sale */}
            {timeLeft > 0 && (
              <section className="mt-10 px-6">
                <div className="bg-gradient-to-br from-[#D4AF37] to-[#B8860B] rounded-[35px] p-6 relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
                  </div>
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
                        <span className="text-black font-black text-[10px] uppercase tracking-tighter">الساعة الذهبية ⚜️ GOLDEN HOUR</span>
                      </div>
                      <h3 className="text-2xl font-black text-black mb-1">خصومات VIP حصرية</h3>
                      <p className="text-black/70 text-[10px] font-bold">تنتهي العروض خلال:</p>
                    </div>
                    <div className="bg-black text-[#D4AF37] px-6 py-3 rounded-2xl font-mono text-2xl font-black shadow-2xl border border-white/10">
                      {formatTime(timeLeft)}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}




        {/* Clothing Sub-tabs */}
        {selectedTab === 'ألبسة' && (
          <section className="mt-8 px-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide no-scrollbar"
            >
              {[
                { id: 'الكل', name: 'الكل' },
                { id: 'رجالية', name: 'ملابس رجالية 👔' },
                { id: 'نسائية', name: 'ملابس نسائية 👗' }
              ].map((sub) => (
                <button
                  key={`sub-cat-${sub.id}`}
                  onClick={() => {
                    setClothingSubTab(sub.id);
                    setIsGridLoading(false);
                  }}
                  className={cn(
                    "whitespace-nowrap px-6 py-3 rounded-2xl text-xs font-black transition-all border",
                    clothingSubTab === sub.id 
                      ? "bg-[#D4AF37] text-black border-[#D4AF37] shadow-[0_10px_20px_rgba(212,175,55,0.3)]" 
                      : "bg-white/5 text-gray-400 border-white/10 hover:border-[#D4AF37]/30"
                  )}
                >
                  {sub.name}
                </button>
              ))}
            </motion.div>
          </section>
        )}

        {/* Products Grid */}
        <section className="mt-6 px-4">
          {/* Custom Tailored Accessories Banner */}
          {selectedTab === 'إكسسوارات' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative group overflow-hidden rounded-[40px] border border-gold/30 bg-gradient-to-br from-gold/20 via-black to-black p-8 text-center mb-10"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 blur-3xl -mr-16 -mt-16 rounded-full" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gold/10 blur-3xl -ml-16 -mb-16 rounded-full" />
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mb-6 border border-gold/20 group-hover:scale-110 transition-transform">
                  <Gem className="text-gold" size={32} />
                </div>
                <h3 className="text-2xl font-serif italic text-gold mb-3">تفصيل إكسسوارات (فضة ونحاس مطلي) ⚜️</h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                  نحول تصاميمكم من الفضة والنحاس المطلي إلى قطع فنية فريدة بأيدي أمهر حرفيي طرطوس بمواصفات عالمية ودقة متناهية.
                </p>
                <button 
                  onClick={() => setShowCustomModal(true)}
                  className="bg-gold text-black px-10 py-4 rounded-2xl font-black text-sm hover:bg-gold-light transition-all shadow-[0_10px_30px_rgba(212,175,55,0.2)] flex items-center gap-2 group/btn"
                >
                  <Pencil size={18} />
                  اطلب تصميمك الخاص الآن
                </button>
              </div>
            </motion.div>
          )}

          {selectedTab === 'ألبسة' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative group overflow-hidden rounded-[40px] border border-amber-500/30 bg-gradient-to-br from-amber-500/20 via-black to-black p-10 text-center mb-10"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 blur-[100px] -mr-24 -mt-24 rounded-full" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/5 blur-[100px] -ml-24 -mb-24 rounded-full" />
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 bg-amber-500/10 rounded-[25px] flex items-center justify-center mb-6 border border-amber-500/20 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                  <Pencil className="text-amber-500" size={36} />
                </div>
                <h3 className="text-3xl font-serif italic text-amber-500 mb-4 tracking-wide">تصميم ملابس ⚜️ CLOTHING DESIGN</h3>
                <div className="max-w-xl mx-auto space-y-6">
                  <p className="text-white text-xl md:text-2xl font-black leading-relaxed drop-shadow-2xl">
                    حول فكرتك إلى واقع ملكي ⚜️ صمم ملابسك الخاصة الآن بأيدي خبرائنا
                  </p>
                  <button 
                    onClick={() => onTabChange('design')}
                    className="bg-amber-500 text-black px-12 py-5 rounded-2xl font-black text-sm hover:bg-amber-600 transition-all shadow-[0_20px_40px_rgba(245,158,11,0.2)] flex items-center justify-center gap-3 group/btn mx-auto"
                  >
                    <Pencil size={20} />
                    اطلب تصميمك الخاص الآن
                  </button>
                  <div className="flex items-center justify-center gap-4">
                    <div className="h-px w-12 bg-white/10" />
                    <span className="text-gray-500 font-black text-[10px] uppercase tracking-widest">خدمة حصرية من AURUM ⚜️</span>
                    <div className="h-px w-12 bg-white/10" />
                  </div>
                </div>
              </div>

              {/* Decorative Background Elements */}
              <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-amber-500 to-transparent -rotate-45" />
                <div className="absolute top-1/2 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-amber-500 to-transparent -rotate-45" />
              </div>
            </motion.div>
          )}

          {selectedTab === 'أمازون' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative group overflow-hidden rounded-[40px] border border-orange-500/30 bg-gradient-to-br from-orange-500/20 via-black to-black p-10 text-center mb-10"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/5 blur-[100px] -mr-24 -mt-24 rounded-full" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/5 blur-[100px] -ml-24 -mb-24 rounded-full" />
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 bg-orange-500/10 rounded-[25px] flex items-center justify-center mb-6 border border-orange-500/20 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                  <ShoppingCart className="text-orange-500" size={36} />
                </div>
                <h3 className="text-3xl font-serif italic text-orange-500 mb-4 tracking-wide">أمازون ⚜️ AMAZON HUB</h3>
                <div className="max-w-xl mx-auto space-y-6">
                  <p className="text-white text-xl md:text-2xl font-black leading-relaxed drop-shadow-2xl">
                    قريباً... ستتمكن من طلب كافة منتجات أمازون وبأفضل الأسعار العالمية عبر أوروم ⚜️
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <div className="h-px w-12 bg-orange-500/30" />
                    <div className="flex items-center gap-2 px-6 py-2 bg-orange-500/10 rounded-full border border-orange-500/20">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                      <span className="text-orange-500 font-black text-xs uppercase tracking-[0.2em]">قريباً ⚜️ SOON</span>
                    </div>
                    <div className="h-px w-12 bg-orange-500/30" />
                  </div>
                </div>
              </div>

              {/* Decorative Background Elements */}
              <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-orange-500 to-transparent -rotate-45" />
                <div className="absolute top-1/2 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-orange-500 to-transparent -rotate-45" />
              </div>
            </motion.div>
          )}

          <h3 className="px-2 text-xl font-bold mb-6">
            {selectedTab === 'الكل' ? 'أحدث المنتجات' : selectedTab}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            <AnimatePresence mode="popLayout">
              {(isGridLoading || (!isProductsLoadedProps && filteredProducts.length === 0)) ? (
                // Super High-Quality Luxury Skeleton Loader
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={`home-skeleton-${i}`} className="bg-[#070707] rounded-[24px] sm:rounded-[30px] p-3 sm:p-4 border border-[#D4AF37]/10 animate-pulse relative overflow-hidden shadow-2xl flex flex-col">
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#D4AF37]/5 to-transparent opacity-30 pointer-events-none" />
                    
                    {/* Image Placeholder */}
                    <div className="aspect-[4/5] bg-gradient-to-b from-[#111] via-[#0d0d0d] to-[#111] border border-white/5 rounded-[18px] sm:rounded-[22px] mb-3 sm:mb-4 flex items-center justify-center relative overflow-hidden">
                      <Sparkles className="text-[#D4AF37]/10 animate-pulse" size={24} />
                    </div>
                    
                    {/* Title and subtitle */}
                    <div className="h-4 bg-white/5 rounded-full w-3/4 mb-2.5" />
                    <div className="h-3 bg-white/5 rounded-full w-1/2 mb-4" />
                    
                    <div className="flex justify-between items-center mt-auto">
                      <div className="h-5 bg-[#D4AF37]/10 rounded-full w-1/3 border border-[#D4AF37]/5" />
                      <div className="w-9 h-9 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full flex items-center justify-center">
                        <Plus className="text-[#D4AF37]/20" size={14} />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                selectedTab.includes('قريباً') ? (
                  <motion.div
                    key="locked-section-banner"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="col-span-full py-16 text-center bg-[#0d0d0d] rounded-[35px] border border-[#D4AF37]/20 p-8 shadow-2xl my-4"
                  >
                    <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#D4AF37]/30">
                      <Sparkles className="text-[#D4AF37]" size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 font-serif">هذا القسم مقفل حالياً 🔒</h3>
                    <p className="text-[#D4AF37] text-xs font-black uppercase tracking-widest">قريباً تفتح ⚜️ Coming Soon</p>
                  </motion.div>
                ) : (
                  filteredProducts.map((item, index) => {
                  const isFavorite = favoriteIds.includes(item.id);
                  return (
                    <motion.div 
                      key={`main-prod-${item.id}`} 
                      layout
                      initial={{ opacity: 0, y: 40, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ 
                        duration: 0.6, 
                        delay: index * 0.05,
                        ease: [0.16, 1, 0.3, 1]
                      }}
                      whileHover={{ y: -10 }}
                      className={cn(
                        "bg-[#0a0a0a] rounded-[24px] sm:rounded-[30px] p-3 sm:p-4 border transition-all group flex flex-col cursor-pointer shadow-xl relative overflow-hidden",
                        item.isLimitedEdition 
                          ? "border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/10" 
                          : "border-[#D4AF37]/5 hover:border-[#D4AF37]/40"
                      )}
                      onClick={() => onProductClick(item)}
                    >
                      {/* Shimmer Effect on Hover */}
                      <div className="absolute inset-0 gold-shimmer opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                      <div className="relative aspect-[4/5] rounded-[18px] sm:rounded-[22px] overflow-hidden mb-3 sm:mb-4">
                        <LazyImage 
                          src={item.image || null} 
                          alt={item.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(item);
                          }}
                          className="absolute top-3 left-3 p-2.5 bg-black/60 backdrop-blur-md rounded-full hover:bg-[#D4AF37] hover:text-black transition-all active:scale-90"
                        >
                          <Heart 
                            size={18} 
                            className={isFavorite ? "fill-current text-current" : "text-white"} 
                          />
                        </button>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickViewProduct(item);
                          }}
                          className="absolute bottom-3 left-3 p-2.5 bg-black/60 backdrop-blur-md rounded-full hover:bg-[#D4AF37] hover:text-black transition-all opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 active:scale-90"
                        >
                          <Search size={18} className="text-white group-hover:text-black" />
                        </button>

                        {item.type === 'VIP' && (
                          <div className="absolute top-3 right-3 bg-[#D4AF37] text-black text-[10px] font-black px-3 py-1 rounded-full shadow-lg">
                            VIP
                          </div>
                        )}

                        {item.isSale && (
                          <div className="absolute top-3 left-3 bg-red-600 text-white text-[9px] font-black px-3 py-1.5 rounded-full shadow-lg animate-pulse border border-white/20">
                            SALE %
                          </div>
                        )}

                        {item.category === 'شي ان' && (
                          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-[#D4AF37] text-[8px] font-black px-3 py-1.5 rounded-full border border-[#D4AF37]/30 shadow-lg flex items-center gap-1">
                            <Truck size={10} />
                            <span>توصيل خلال 15 يوم</span>
                          </div>
                        )}

                        {item.isLimitedEdition && (
                          <div className="absolute top-3 right-3 bg-gradient-to-r from-red-600 to-amber-600 text-white text-[8px] font-black px-3 py-1.5 rounded-full border border-white/20 shadow-lg animate-pulse">
                            إصدار محدود 🔥 LIMITED
                          </div>
                        )}

                        {item.stock !== undefined && item.stock <= 0 && (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/75 to-black/90 flex flex-col items-center justify-center p-3 z-10">
                            <div className="absolute top-2 left-2 bg-[#D4AF37]/20 backdrop-blur-md text-[#D4AF37] text-[7px] font-black px-2 py-1 rounded-full border border-[#D4AF37]/40 shadow-md">
                              مقتناة ⚜️
                            </div>
                            <div className="w-8 h-8 rounded-full border border-[#D4AF37]/30 bg-black/80 flex items-center justify-center mb-1.5 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                              <Sparkles size={14} className="text-[#D4AF37] animate-pulse" />
                            </div>
                            <p className="text-[#D4AF37] font-serif italic text-[10px] sm:text-[11px] font-black tracking-wider text-center px-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                              أيقونة تذكارية ملكية ⚜️
                            </p>
                            <p className="text-[7px] text-gray-400 font-bold mt-1 text-center bg-white/5 px-1.5 py-0.5 rounded-full border border-white/5">
                              محفوظة لمالكها للأبد
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="px-1">
                        <h4 className="text-sm font-bold line-clamp-1 mb-1 group-hover:text-[#D4AF37] transition-colors">{item.name}</h4>
                        <p className="text-gray-500 text-[10px] mb-2">{item.brand || 'AURUM LUXURY'}</p>
                        
                        {/* Display Sizes and Colors on Product Card */}
                        {((item.availableSizes && item.availableSizes.length > 0) || (item.availableColors && item.availableColors.length > 0)) && (
                          <div className="flex flex-col gap-1.5 my-2 pt-2 border-t border-white/10 text-right">
                            {/* Available Sizes */}
                            {item.availableSizes && item.availableSizes.length > 0 && (
                              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                                <span className="text-gray-400 font-bold text-[9px] shrink-0">المقاسات:</span>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {item.availableSizes.map((sz, sIdx) => (
                                    <span 
                                      key={`card-size-${sIdx}`}
                                      className="bg-white/10 text-white font-black text-[9px] px-2 py-0.5 rounded-md border border-white/15 shadow-sm"
                                    >
                                      {sz}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Available Colors */}
                            {item.availableColors && item.availableColors.length > 0 && (
                              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                                <span className="text-gray-400 font-bold text-[9px] shrink-0">الألوان:</span>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {item.availableColors.map((colorEntry, cIdx) => {
                                    const parts = colorEntry.split('|');
                                    const name = parts[0];
                                    const hex = parts[1];
                                    return (
                                      <span 
                                        key={`card-color-${cIdx}`}
                                        className="bg-white/10 text-white font-bold text-[9px] px-2 py-0.5 rounded-md border border-white/15 flex items-center gap-1 shadow-sm"
                                      >
                                        {hex && (
                                          <span 
                                            className="w-2.5 h-2.5 rounded-full border border-white/40 shrink-0 shadow-inner" 
                                            style={{ backgroundColor: hex }} 
                                          />
                                        )}
                                        <span>{name}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="flex flex-col mt-auto h-12 justify-end">
                          {item.isSale && (
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-red-500 line-through text-[10px] font-bold opacity-80">{item.oldPrice}</span>
                              <span className="bg-amber-500/10 text-amber-500 text-[8px] px-1.5 py-0.5 rounded-md font-black border border-amber-500/20">عرض 🏷️</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <p className="text-[#D4AF37] font-black text-[15px]">
                                {item.isSale ? item.salePrice : item.price} 
                                <span className="text-[10px] mr-1 opacity-50 font-normal uppercase">{item.currency === 'USD' ? '$' : 'ل.س'}</span>
                              </p>
                              {item.currency === 'SYP' && item.newSypPrice && (
                                <p className="text-[9px] text-amber-500/60 font-bold -mt-0.5">
                                   {item.newSypPrice} <span className="text-[7px]">ل.س جديد</span>
                                 </p>
                              )}
                            </div>
                            {item.isLimitedEdition && (
                              <div className="text-right">
                                <div className="text-[7px] text-gray-500 font-bold mb-1 uppercase">متبقي: {item.remainingUnits}</div>
                                <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-amber-500" 
                                    style={{ width: `${(item.remainingUnits / (item.limitedUnits || 1)) * 100}%` }}
                                  />
                                </div>
                              </div>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.stock !== undefined && item.stock <= 0) {
                                  alert("عذراً ⚜️: هذا المنتج أصبح تحفة تذكارية ملكية مقتناة ومحفوظة بالكامل.");
                                  return;
                                }
                                if (item.isVIPOnly && !isVIP) {
                                  alert("هذا المنتج حصري لأعضاء VIP ⚜️");
                                  return;
                                }
                                handleAddToCartClick(item);
                              }}
                              className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 overflow-hidden",
                                item.isVIPOnly && !isVIP 
                                  ? "bg-gray-800 text-gray-500 cursor-not-allowed" 
                                  : item.stock !== undefined && item.stock <= 0
                                    ? "bg-[#D4AF37]/10 text-[#D4AF37]/40 cursor-not-allowed"
                                    : justAddedId === item.id
                                      ? "bg-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.5)]"
                                      : "bg-[#D4AF37]/10 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-black"
                              )}
                            >
                              <AnimatePresence mode="wait">
                                {justAddedId === item.id ? (
                                  <motion.div
                                    key="check"
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -20, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <Check size={20} />
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    key="icon"
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -20, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    {item.isVIPOnly && !isVIP ? <ShieldCheck size={20} /> : <Plus size={20} />}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                }))
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Custom Accessories Modal */}
      <AnimatePresence>
        {showCustomModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCustomModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl" 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#0A0A0A] border border-gold/20 rounded-[40px] p-8 overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 blur-3xl -mr-16 -mt-16 rounded-full" />
              
              <div className="flex justify-between items-center mb-8 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center border border-gold/20">
                    <Pencil className="text-gold" size={20} />
                  </div>
                  <h3 className="text-xl font-serif italic text-white">طلب تفصيل خاص ⚜️</h3>
                </div>
                <button 
                  onClick={() => setShowCustomModal(false)}
                  className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCustomRequestSubmit} className="space-y-6 relative z-10">
                <div className="space-y-2">
                  <label className="text-[10px] text-gold uppercase tracking-widest font-black mr-2">وصف التصميم ⚜️</label>
                  <div className="relative">
                    <FileText className="absolute top-4 right-4 text-gold/40" size={18} />
                    <textarea 
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      placeholder="صف لنا الخاتم، السوار، أو أي قطعة إكسسوار ترغب بتفصيلها... (مثلاً: فضة 925، نحاس مطلي ذهب، نوع الحجر)"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 text-sm text-white placeholder:text-gray-600 focus:border-gold/40 focus:ring-1 focus:ring-gold/40 transition-all min-h-[150px] resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-gold uppercase tracking-widest font-black mr-2">رقم التواصل (واتساب) ⚜️</label>
                  <div className="relative">
                    <div className="absolute top-1/2 -translate-y-1/2 right-4 text-gold/40 text-sm font-black">
                      +964
                    </div>
                    <input 
                      type="tel"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="رقم الموبايل"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-16 pl-4 text-sm text-white placeholder:text-gray-600 focus:border-gold/40 focus:ring-1 focus:ring-gold/40 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-gold uppercase tracking-widest font-black mr-2">صورة التصميم (اختياري) ⚜️</label>
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      id="custom-jewelry-image"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setCustomImage(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {!customImage ? (
                      <label 
                        htmlFor="custom-jewelry-image"
                        className="cursor-pointer block w-full aspect-video bg-white/5 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 group-hover:bg-white/10 transition-all"
                      >
                        <Camera size={32} className="text-gold/40 group-hover:text-gold transition-colors" />
                        <span className="text-[10px] text-gray-500 font-bold">اضغط لإضافة صورة أو سكيتش ⚜️</span>
                      </label>
                    ) : (
                      <div className="relative aspect-video rounded-2xl overflow-hidden shadow-lg border border-gold/20">
                        <img src={customImage} className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setCustomImage(null)}
                          className="absolute top-2 left-2 bg-red-500/80 p-2 rounded-xl text-white hover:bg-red-500 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gold/5 p-4 rounded-2xl border border-gold/10 flex items-start gap-3">
                  <Camera className="text-gold shrink-0 mt-0.5" size={16} />
                  <p className="text-[10px] text-gold/80 leading-relaxed font-medium">
                    ملاحظة: يمكنك إرسال صور مرجعية أو سكيتش للتصميم عبر الواتساب بعد تقديم الطلب وسيقوم الفريق بتقدير التكلفة والرد عليك.
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    "w-full py-5 rounded-2xl font-black text-sm transition-all shadow-xl flex items-center justify-center gap-3",
                    isSubmitting 
                      ? "bg-gray-800 text-gray-500 cursor-not-allowed" 
                      : "bg-gold text-black hover:bg-gold-light active:scale-95 shadow-gold/20"
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <span>إرسال الطلب للمراجعة ⚜️</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

 

      {/* Rewards Center Modal */}
      <AnimatePresence>
        {showRewards && (
          <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRewards(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border-t sm:border border-[#D4AF37]/30 rounded-t-[40px] sm:rounded-[40px] overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-[#D4AF37] leading-none mb-2 text-gold">متجر المكافآت الملكي ⚜️</h2>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Exchange Your Points</p>
                </div>
                <button onClick={() => setShowRewards(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="bg-gradient-to-r from-[#D4AF37]/10 to-transparent p-6 rounded-3xl border border-[#D4AF37]/20 flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-bold mb-1">رصيدك الحالي:</p>
                    <p className="text-3xl font-black text-white">{userPoints.toLocaleString()} <span className="text-[#D4AF37] text-xl">نقطة ملكية</span></p>
                  </div>
                  {!dailyClaimed && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleDailyClaim}
                      className="bg-[#D4AF37] text-black px-4 py-2 rounded-xl text-[10px] font-black shadow-lg"
                    >
                      طالب بهديتك اليومية 🎁
                    </motion.button>
                  )}
                  {dailyClaimed && (
                    <div className="bg-white/5 px-4 py-2 rounded-xl text-[10px] font-bold text-gray-500 border border-white/5">
                      تم استلام هدية اليوم ✅
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {redeemableProducts.map((p) => (
                    <div key={`home-redeem-${p.id}`} className="bg-[#111] border border-white/5 rounded-3xl p-5 flex flex-col h-full group hover:border-[#D4AF37]/30 transition-all">
                      <div className="relative aspect-square rounded-2xl overflow-hidden mb-4">
                        <LazyImage 
                          src={p.image || null} 
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        />
                        <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#D4AF37]/30">
                           <p className="text-[#D4AF37] text-xs font-black">{(p.pointsCost || 0).toLocaleString()} نقطة</p>
                        </div>
                      </div>
                      <h4 className="font-bold text-white mb-2">{p.name}</h4>
                      <p className="text-gray-500 text-[10px] mb-6 line-clamp-2 h-8">{p.description}</p>
                      <button 
                        onClick={() => handleRedeem(p)}
                        disabled={userPoints < p.pointsCost}
                        className={cn(
                          "w-full py-3.5 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 disabled:opacity-30 disabled:grayscale",
                          userPoints >= p.pointsCost ? "bg-[#D4AF37] text-black" : "bg-white/5 text-gray-500"
                        )}
                      >
                        {userPoints >= p.pointsCost ? "استبدال ملكي الآن ⚜️" : "نقاطك غير كافية"}
                      </button>
                    </div>
                  ))}
                  {redeemableProducts.length === 0 && (
                    <div className="col-span-full py-12 text-center">
                      <p className="text-gray-600 font-bold italic">لا توجد منتجات متاحة للاستبدال حالياً.. ترقبوا القادم ⚜️</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Wheel of Fortune Modal */}
      <AnimatePresence>
        {showWheel && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isSpinning && setShowWheel(false)} className="absolute inset-0 bg-black/90 backdrop-blur-2xl" />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="relative bg-[#090909] border border-[#D4AF37]/30 rounded-[36px] p-6 sm:p-8 w-full max-w-sm text-center shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden"
             >
               {/* Close button */}
               <button 
                 onClick={() => !isSpinning && setShowWheel(false)}
                 className="absolute top-4 left-4 z-50 text-gray-400 hover:text-[#D4AF37] transition-colors"
               >
                 <X size={20} />
               </button>

               {/* Royal Header */}
               <div className="relative mb-6">
                 <div className="inline-block px-3 py-1 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37] text-[10px] font-bold tracking-widest uppercase mb-2">
                   حدث ملكي حصري ⚜️
                 </div>
                 <h2 className="text-2xl font-black text-white font-serif italic tracking-tight">عجلة الحظ الملكية</h2>
                 <p className="text-gray-400 text-xs mt-1">أدر العجلة واختبر حظك الملكي اليوم</p>
               </div>

               {/* The Wheel */}
               <div className="relative aspect-square w-full max-w-[270px] mx-auto mb-6 flex items-center justify-center">
                 {/* Top Pointer Needle */}
                 <motion.div 
                   animate={isSpinning ? { rotate: [0, -10, 0] } : {}}
                   transition={{ repeat: isSpinning ? Infinity : 0, duration: 0.12 }}
                   className="absolute -top-3 left-1/2 -translate-x-1/2 z-40 w-8 h-10 flex flex-col items-center drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
                 >
                   <div className="w-6 h-7 bg-gradient-to-b from-[#FFF] via-[#D4AF37] to-[#8d6e13] rounded-b-md border border-white/40 shadow-lg" style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />
                 </motion.div>

                 {/* Rotation Container */}
                 <motion.div 
                   className="w-full h-full rounded-full border-4 border-[#D4AF37]/80 relative shadow-[0_0_40px_rgba(212,175,55,0.25)] overflow-hidden"
                   animate={{ rotate: rotation }}
                   transition={{ duration: 4.2, ease: [0.15, 0, 0.05, 1] }}
                   style={{ 
                    background: activeWheelPrizes.length > 0 
                      ? `conic-gradient(${activeWheelPrizes.map((p: WheelPrize, i: number) => `${p.color || (i % 2 === 0 ? '#161616' : '#282214')} ${i * (360/activeWheelPrizes.length)}deg ${(i+1)*(360/activeWheelPrizes.length)}deg`).join(', ')})`
                      : '#111'
                   }}
                 >
                    {/* Divider Lines */}
                    {activeWheelPrizes.map((_: WheelPrize, i: number) => (
                      <div 
                        key={`divider-${i}`}
                        className="absolute top-0 left-1/2 w-[1px] h-1/2 bg-[#D4AF37]/30 origin-bottom z-10"
                        style={{ 
                          transform: `translateX(-50%) rotate(${i * (360 / (activeWheelPrizes.length || 1))}deg)` 
                        }}
                      />
                    ))}

                    {/* Prizes & Labels */}
                    {activeWheelPrizes.map((p: WheelPrize, idx: number) => {
                      const angle = 360 / (activeWheelPrizes.length || 1);
                      const isGoldBg = p.color === '#D4AF37' || p.value > 100;
                      return (
                        <div 
                          key={`label-${idx}`}
                          className="absolute inset-0 flex justify-center pt-5 z-20 pointer-events-none"
                          style={{ 
                            transform: `rotate(${idx * angle + angle / 2}deg)`
                          }}
                        >
                          <div className="flex flex-col items-center gap-1">
                             <span className={cn(
                               "font-black text-[11px] tracking-tight leading-tight",
                               isGoldBg ? "text-black" : "text-[#D4AF37]"
                             )}>
                               {p.label as string}
                             </span>
                          </div>
                        </div>
                      );
                    })}
                 </motion.div>

                 {/* Center Deco - Golden Hub */}
                 <div className="absolute inset-0 m-auto w-14 h-14 bg-[#090909] rounded-full border-2 border-[#D4AF37] z-30 flex items-center justify-center shadow-xl">
                   <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#111] via-[#1f1b0e] to-[#2a220f] border border-[#D4AF37]/40 flex items-center justify-center">
                     <span className="text-[#D4AF37] font-serif text-xs font-black">⚜️</span>
                   </div>
                 </div>
               </div>

               {/* Attempts & Spin Action */}
               <div className="space-y-4">
                 <div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-400">
                    <span>المحاولات المتاحة:</span>
                    <span className="text-[#D4AF37] text-base font-black">{((userData?.extraSpins || 0) + (canSpin ? 1 : 0)) || 0}</span>
                 </div>

                 <button 
                   onClick={handleSpin}
                   disabled={isSpinning || !canSpin || activeWheelPrizes.length === 0}
                   className={cn(
                    "w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg",
                    canSpin 
                      ? "bg-gradient-to-r from-[#B8860B] via-[#D4AF37] to-[#F3E5AB] text-black hover:brightness-110 shadow-[#D4AF37]/20" 
                      : "bg-white/5 text-gray-500 border border-white/10"
                   )}
                 >
                   {isSpinning ? (
                     <div className="flex items-center gap-2">
                       <Loader2 className="animate-spin text-black" size={20} />
                       <span>جاري الدوران...</span>
                     </div>
                   ) : (
                     <>
                       <Sparkles size={18} />
                       <span>{canSpin ? "أدر العجلة الملكية ⚜️" : "نفدت المحاولات اليوم"}</span>
                     </>
                   )}
                 </button>
               </div>

               {/* Spin Result Overlay */}
               <AnimatePresence>
                 {spinResult && !isSpinning && (
                   <motion.div 
                     initial={{ opacity: 0, scale: 0.8 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0 }}
                     className="absolute inset-0 bg-[#090909]/95 backdrop-blur-xl flex flex-col items-center justify-center z-50 p-6 text-center"
                   >
                     {spinResult.value > 0 ? (
                       <>
                         <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/40 flex items-center justify-center mb-4 text-[#D4AF37]">
                           <Sparkles size={32} />
                         </div>
                         <h3 className="text-2xl font-black text-[#D4AF37] mb-1 font-serif italic">تهانينا الملكية! ⚜️</h3>
                         <p className="text-gray-300 font-bold text-sm mb-6">
                           لقد حصلت على: <br />
                           <span className="text-white text-2xl font-black mt-1 inline-block">{spinResult.label}</span>
                         </p>
                         <button 
                           onClick={() => { setSpinResult(null); setShowWheel(false); }}
                           className="bg-[#D4AF37] text-black font-black px-8 py-3 rounded-xl shadow-lg hover:bg-amber-300 active:scale-95 text-xs"
                         >
                           استلام النقاط ⚜️
                         </button>
                       </>
                     ) : (
                       <>
                         <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-gray-400">
                           <span className="text-2xl">⚜️</span>
                         </div>
                         <h3 className="text-2xl font-black text-white mb-2 font-serif italic">حظ أوفر! ⚜️</h3>
                         <p className="text-gray-400 font-bold text-xs mb-6 max-w-[220px]">
                           تمنياتنا لك بالتوفيق في المحاولة القادمة، شكراً لتفاعلك معنا!
                         </p>
                         <button 
                           onClick={() => { setSpinResult(null); setShowWheel(false); }}
                           className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold px-8 py-3 rounded-xl text-xs active:scale-95 transition-all"
                         >
                           إغلاق ⚜️
                         </button>
                       </>
                     )}
                   </motion.div>
                 )}
               </AnimatePresence>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
 
      {/* Quick View Modal */}
      <AnimatePresence>
        {quickViewProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQuickViewProduct(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="relative bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-[40px] w-full max-w-md overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.9)]"
            >
              <button 
                onClick={() => setQuickViewProduct(null)}
                className="absolute top-4 left-4 z-10 w-10 h-10 bg-black/60 rounded-full flex items-center justify-center text-[#D4AF37]"
              >
                <X size={20} />
              </button>
              
              <div className="aspect-[4/5] relative">
                <LazyImage 
                  src={quickViewProduct.image} 
                  alt={quickViewProduct.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
              </div>

              <div className="p-8">
                <span className="text-[#D4AF37] text-[10px] font-black uppercase tracking-widest mb-2 block">{quickViewProduct.brand || 'AURUM LUXURY'}</span>
                <h3 className="text-2xl font-black text-white mb-4 font-serif italic">{quickViewProduct.name}</h3>
                <p className="text-gray-500 text-sm mb-6 line-clamp-2">{quickViewProduct.description || 'تجربة فريدة من نوعها تجمع بين الفخامة والأناقة في منتج واحد.'}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-2xl font-black text-[#D4AF37]">
                      {quickViewProduct.price} 
                      <span className="text-xs mr-1 opacity-60 font-normal">{quickViewProduct.currency === 'USD' ? '$' : 'ل.س'}</span>
                    </span>
                    {quickViewProduct.currency === 'SYP' && quickViewProduct.newSypPrice && (
                      <span className="text-xs text-amber-500/60 font-bold">
                        {quickViewProduct.newSypPrice} <span className="text-[10px]">ليرة سورية (جديد)</span>
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      if (quickViewProduct.isVIPOnly && !isVIP) {
                        alert("هذا المنتج حصري لأعضاء VIP ⚜️");
                        return;
                      }
                      onAddToCart(quickViewProduct);
                      setQuickViewProduct(null);
                    }}
                    className={cn(
                      "px-8 py-3 rounded-full font-black text-sm active:scale-95 transition-all",
                      quickViewProduct.isVIPOnly && !isVIP
                        ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                        : "bg-[#D4AF37] text-black"
                    )}
                  >
                    {quickViewProduct.isVIPOnly && !isVIP ? "حصري لـ VIP" : "إضافة للسلة"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HomeScreen;
