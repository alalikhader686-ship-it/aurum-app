import React, { useState, useMemo } from 'react';
import { 
  ChevronRight, 
  Crown, 
  Sparkles, 
  Store,
  Loader2,
  Truck,
  ShoppingCart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Shop } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';

interface AurumMallProps {
  onBack: () => void;
  onOpenProductDetails: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  shopsProp?: Shop[];
}

export default function AurumMall({ onBack, onOpenProductDetails, onAddToCart, selectedCategory, setSelectedCategory, shopsProp }: AurumMallProps) {
  const [loading, setLoading] = useState(false);
  const [merchantShops, setMerchantShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [shopProducts, setShopProducts] = useState<Product[]>([]);
  const [viewingShop, setViewingShop] = useState<Shop | null>(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [rentalForm, setRentalForm] = useState({
    shopName: '',
    description: '',
    category: 'عام',
    phone: '',
    plan: 'plus' as 'basic' | 'plus',
    delivery: 'aurum' as 'aurum' | 'self'
  });

  // Smart category matching helper
  const isClothing = (cat: string) => 
    ['ألبسة', 'ملابس رجالية', 'ملابس نسائية', 'ملابس أطفال', 'ألبسة أوروبية', 'لباس'].includes(cat);

  React.useEffect(() => {
    if (shopsProp) {
        setMerchantShops(shopsProp.filter(s => s.status === 'active' || !s.status));
    }
  }, [shopsProp]);

  React.useEffect(() => {
    if (!selectedShopId) {
      setShopProducts([]);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'products'), where('shopId', '==', selectedShopId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setShopProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching shop products:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedShopId]);

  const handleViewShop = (shop: Shop) => {
    setViewingShop(shop);
    setSelectedShopId(shop.id);
  };

  const handleSendRentalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("يرجى تسجيل الدخول أولاً لإرسال الطلب ⚜️");
      return;
    }

    if (!rentalForm.phone || !rentalForm.shopName) {
      alert("يرجى ملء الحقول المطلوبة (اسم المتجر ورقم الهاتف) ⚠️");
      return;
    }

    setSubmittingRequest(true);
    try {
      await addDoc(collection(db, 'merchant_requests'), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        shopName: rentalForm.shopName,
        shopDescription: rentalForm.description,
        shopCategory: rentalForm.category,
        phone: rentalForm.phone,
        plan: rentalForm.plan,
        delivery: rentalForm.delivery,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      alert("تم إرسال طلبك بنجاح ⚜️ سنقوم بمراجعة تفاصيل متجرك والتواصل معك قريباً.");
      setShowRentalModal(false);
      setRentalForm({
        shopName: '',
        description: '',
        category: 'عام',
        phone: '',
        plan: 'plus',
        delivery: 'aurum'
      });
    } catch (err) {
      console.error("Error sending rental request:", err);
      alert("عذراً، حدث خطأ أثناء إرسال الطلب. يرجى المحاولة لاحقاً ⚜️");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const displayedShops = useMemo(() => {
    if (selectedCategory === 'الكل') return merchantShops;
    return merchantShops.filter(shop => {
      const shopCat = shop.category?.trim() || "";
      if (selectedCategory === 'ألبسة') {
        return isClothing(shopCat);
      }
      return shopCat === selectedCategory;
    });
  }, [selectedCategory, merchantShops]);

  const filteredShopProducts = useMemo(() => {
    return shopProducts.filter(p => {
      const pCat = p.category?.trim() || "";
      const pType = p.type?.trim() || "";
      
      if (selectedCategory === 'الكل') return true;
      if (selectedCategory === 'ألبسة') {
        return isClothing(pCat) || isClothing(pType);
      }
      return pCat === selectedCategory || pType === selectedCategory;
    });
  }, [shopProducts, selectedCategory]);

  return (
    <div className="min-h-screen bg-black text-white pb-32 selection:bg-[#D4AF37] selection:text-black relative overflow-hidden" dir="rtl">
      
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#D4AF37]/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-morphism border-b border-[#D4AF37]/10 px-6 py-5 flex justify-between items-center">
        <button 
          onClick={selectedShopId ? () => setSelectedShopId(null) : onBack} 
          className="w-10 h-10 flex items-center justify-center text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-full transition-all"
        >
          <ChevronRight size={28} />
        </button>
        <div className="text-center">
          <h1 className="text-gold font-serif italic text-2xl mb-1 tracking-tight">
            {selectedShopId ? viewingShop?.name : "AURUM LUXURY MALL"}
          </h1>
          <p className="text-[10px] text-gold/60 font-medium uppercase tracking-[0.3em]">
            {selectedShopId ? "منتجات المتجر الفاخرة" : "The Elite Shopping Experience"}
          </p>
        </div>
        <div className="w-10" />
      </header>

      <div className="max-w-4xl mx-auto px-6">
        {selectedShopId ? (
          <div className="mt-10 space-y-10">
            <div className="flex items-center gap-6 bg-[#111] p-8 rounded-[40px] border border-[#D4AF37]/20">
              <img src={viewingShop?.image || null} className="w-24 h-24 rounded-3xl object-cover border border-[#D4AF37]/20" />
              <div>
                <h2 className="text-3xl font-black text-white mb-2">{viewingShop?.name}</h2>
                <p className="text-gray-500 text-sm leading-relaxed">{viewingShop?.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-6">
              {filteredShopProducts.length === 0 ? (
                <p className="col-span-2 text-center py-20 text-gray-600">هذا المتجر لم يضف منتجات بهذا التصنيف بعد</p>
              ) : (
                filteredShopProducts.map((p) => (
                  <motion.div 
                    key={`mall-featured-${p.id}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#111] border border-white/5 rounded-[24px] sm:rounded-[35px] p-3 sm:p-4 group"
                  >
                    <div className="aspect-square rounded-[18px] sm:rounded-[25px] overflow-hidden mb-3 sm:mb-4 relative">
                      <img src={p.image || null} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      
                      <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                        {p.isSale ? (
                          <>
                            <div className="bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded-lg shadow-lg border border-white/20 animate-pulse">
                              SALE %
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black text-[#D4AF37] border border-[#D4AF37]/30">
                                {p.salePrice} <span className="text-[8px] opacity-60 uppercase">{p.currency === 'USD' ? '$' : 'ل.س'}</span>
                              </div>
                              {p.currency === 'SYP' && p.newSypPrice && (
                                <div className="bg-amber-500/10 backdrop-blur-sm px-2 py-0.5 rounded-lg text-[7px] font-black text-amber-500 border border-amber-500/20">
                                  {p.newSypPrice} ل.س جديد
                                </div>
                              )}
                            </div>
                            <div className="text-red-500 text-[8px] font-bold line-through bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">
                              {p.oldPrice}
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-black text-[#D4AF37] border border-[#D4AF37]/30">
                              {p.price} <span className="text-[8px] opacity-60 uppercase">{p.currency === 'USD' ? '$' : 'ل.س'}</span>
                            </div>
                            {p.currency === 'SYP' && p.newSypPrice && (
                              <div className="bg-amber-500/10 backdrop-blur-sm px-2 py-0.5 rounded-lg text-[7px] font-black text-amber-500 border border-amber-500/20">
                                {p.newSypPrice} ل.س جديد
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {p.category === 'شي ان' && (
                        <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md text-[#D4AF37] text-[8px] font-black px-2 py-1 rounded-lg border border-[#D4AF37]/20 flex items-center gap-1">
                          <Truck size={10} />
                          <span>15 يوم</span>
                        </div>
                      )}

                      {p.stock !== undefined && p.stock <= 0 && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/75 to-black/90 flex flex-col items-center justify-center p-3 z-10">
                          <div className="absolute top-2 left-2 bg-[#D4AF37]/20 backdrop-blur-md text-[#D4AF37] text-[7px] font-black px-2 py-1 rounded-full border border-[#D4AF37]/40 shadow-md">
                            مقتناة ⚜️
                          </div>
                          <div className="w-8 h-8 rounded-full border border-[#D4AF37]/30 bg-black/80 flex items-center justify-center mb-1 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                            <Sparkles size={14} className="text-[#D4AF37] animate-pulse" />
                          </div>
                          <p className="text-[#D4AF37] font-serif italic text-[10px] font-black tracking-wider text-center px-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            أيقونة تذكارية ملكية ⚜️
                          </p>
                          <p className="text-[7px] text-gray-400 font-bold mt-1 text-center bg-white/5 px-1.5 py-0.5 rounded-full border border-white/5">
                            محفوظة للأبد
                          </p>
                        </div>
                      )}
                    </div>
                    <h4 className="font-bold text-sm mb-1">{p.name}</h4>
                    <p className="text-gray-500 text-[10px] mb-4">{p.category}</p>
                    <div className="flex gap-2 font-black">
                      <button 
                        onClick={() => onOpenProductDetails(p)}
                        className="flex-1 bg-white/5 hover:bg-[#D4AF37] text-white hover:text-black py-3 rounded-2xl text-[10px] transition-all"
                      >
                        عرض التفاصيل ⚜️
                      </button>
                      <button 
                        onClick={() => {
                          if (p.stock !== undefined && p.stock <= 0) {
                            alert("عذراً ⚜️: هذا المنتج أصبح تحفة تذكارية ملكية مقتناة ومحفوظة بالكامل.");
                            return;
                          }
                          onAddToCart(p);
                        }}
                        className={cn(
                          "w-12 rounded-2xl flex items-center justify-center transition-all shadow-lg",
                          p.stock !== undefined && p.stock <= 0
                            ? "bg-[#D4AF37]/10 text-[#D4AF37]/40 cursor-not-allowed"
                            : "bg-[#D4AF37] text-black hover:bg-gold-light active:scale-90"
                        )}
                      >
                        <ShoppingCart size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Categories and Custom Tailored */}
            <div className="mt-16 mb-10 flex flex-col gap-8">
              <div className="flex items-center gap-6">
                <div className="h-px flex-1 bg-gradient-to-l from-gold/40 to-transparent" />
                <h2 className="text-3xl font-serif italic text-white">واجهات أوروم المعتمدة ⚜️</h2>
                <div className="h-px flex-1 bg-gradient-to-r from-gold/40 to-transparent" />
              </div>

              {/* Category Filter */}
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {['الكل', 'عطور', 'ألبسة', 'ساعات', 'مجوهرات', 'شي ان'].map((cat) => (
                  <button
                    key={`cat-filter-${cat}`}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-8 py-3 rounded-full text-sm font-medium transition-all border whitespace-nowrap",
                      selectedCategory === cat 
                        ? "bg-gold text-black border-gold shadow-[0_10px_30px_rgba(212,175,55,0.3)]" 
                        : "bg-white/5 text-gray-400 border-white/10 hover:border-gold/40"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Shop List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {displayedShops.map((shop, index) => (
                <motion.div 
                  key={`merchant-shop-${shop.id}`}
                  initial={{ opacity: 0, y: 50, rotateX: 20 }}
                  whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.8 }}
                  className="relative group cursor-pointer"
                  onClick={() => handleViewShop(shop)}
                >
                  <div className="absolute inset-0 bg-[#D4AF37] blur-[100px] opacity-0 group-hover:opacity-10 transition-opacity duration-700" />
                  <div className="relative glass-morphism rounded-[40px] overflow-hidden border border-white/5 group-hover:border-[#D4AF37]/40 transition-all duration-500">
                    <div className="aspect-[16/10] relative overflow-hidden">
                      <img src={shop.image || null} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2s]" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
                      
                      <div className="absolute top-6 left-6">
                        <div className="bg-black/60 backdrop-blur-md border border-[#D4AF37]/30 px-4 py-2 rounded-2xl flex items-center gap-2">
                          <Sparkles size={14} className="text-[#D4AF37]" />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">{shop.category}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-8">
                      <h3 className="text-2xl font-black text-white mb-3 group-hover:text-[#D4AF37] transition-colors">{shop.name}</h3>
                      <p className="text-gray-500 text-xs leading-relaxed mb-6 line-clamp-2">{shop.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-3 rtl:space-x-reverse">
                          {[1,2,3].map(i => (
                            <div key={`avatar-${shop.id}-${i}`} className="w-8 h-8 rounded-full border-2 border-black bg-[#1a1a1a] flex items-center justify-center overflow-hidden">
                              <img src={`https://picsum.photos/seed/user${i+index}/100/100`} className="w-full h-full object-cover" />
                            </div>
                          ))}
                          <div className="w-8 h-8 rounded-full border-2 border-black bg-[#D4AF37] flex items-center justify-center text-[10px] font-black text-black">
                            +1
                          </div>
                        </div>
                        <button className="w-12 h-12 bg-white/5 group-hover:bg-[#D4AF37] text-white group-hover:text-black rounded-2xl flex items-center justify-center transition-all duration-500 shadow-xl">
                          <ChevronRight size={24} className="rotate-180" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {displayedShops.length === 0 && (
                <div className="col-span-2 py-40 text-center space-y-6">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                    <Store className="text-gray-700" size={32} />
                  </div>
                  <p className="text-gray-500 font-bold">لا يوجد متاجر متاحة حالياً في تقييم الإدارة ⚜️</p>
                </div>
              )}
            </div>
            
            {/* Rental Offer Section */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-20 mb-10 overflow-hidden rounded-[40px] border border-[#D4AF37]/30 bg-gradient-to-br from-[#D4AF37]/20 via-black to-black p-10 text-center relative shadow-2xl"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/5 blur-[100px] pointer-events-none" />
              
              <div className="relative z-10 space-y-6">
                <div className="w-20 h-20 bg-[#D4AF37]/10 rounded-[25px] flex items-center justify-center mx-auto mb-4 border border-[#D4AF37]/20">
                  <Store className="text-[#D4AF37]" size={36} />
                </div>
                
                <h3 className="text-3xl font-serif italic text-[#D4AF37]">انضم إلينا في AURUM MALL ⚜️</h3>
                <p className="text-white text-xl md:text-2xl font-black max-w-lg mx-auto leading-relaxed drop-shadow-2xl">
                  هل تمتلك علامة تجارية فاخرة؟ استأجر متجرك الآن ضمن المول الأرقى في AURUM MALL 💎
                </p>
                
                <div className="bg-black/40 border border-white/10 py-6 px-10 rounded-3xl inline-block backdrop-blur-md">
                  <p className="text-[#D4AF37] text-[10px] font-black uppercase tracking-widest mb-1">سعر الإيجار الشهري 🛡️</p>
                  <p className="text-3xl font-black text-white">150,000 <span className="text-sm">ل.س</span></p>
                </div>
                
                <div className="pt-4">
                  <button 
                    onClick={() => setShowRentalModal(true)}
                    disabled={submittingRequest}
                    className="px-12 py-5 bg-[#D4AF37] text-black font-black rounded-2xl shadow-[0_15px_40px_rgba(212,175,55,0.3)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all text-sm uppercase tracking-widest flex items-center gap-3 mx-auto"
                  >
                    <span>إرسال طلب استئجار متجر 📩</span>
                  </button>
                </div>

                <AnimatePresence>
                  {showRentalModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowRentalModal(false)}
                        className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                      />
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-xl bg-[#0a0a0a] border border-[#D4AF37]/30 rounded-[40px] p-8 md:p-10 overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)]"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 blur-3xl rounded-full" />
                        
                        <div className="relative z-10">
                          <div className="flex justify-between items-center mb-8">
                            <div className="text-right">
                              <h3 className="text-2xl font-black text-[#D4AF37] mb-1">طلب انضمام لأسطولنا ⚜️</h3>
                              <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">مستقبل تجارتك يبدأ هنا</p>
                            </div>
                            <button onClick={() => setShowRentalModal(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-all">
                              <ChevronRight size={24} />
                            </button>
                          </div>

                          <form onSubmit={handleSendRentalRequest} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-2">اسم المتجر 💎</label>
                                <input 
                                  required
                                  type="text" 
                                  value={rentalForm.shopName}
                                  onChange={(e) => setRentalForm({...rentalForm, shopName: e.target.value})}
                                  placeholder="مثلاً: لورانس للأناقة"
                                  className="w-full bg-black border border-white/10 rounded-2xl py-4 px-5 text-sm focus:border-[#D4AF37] transition-all placeholder:text-gray-800" 
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-2">رقم التواصل (واتساب) 📱</label>
                                <input 
                                  required
                                  type="tel" 
                                  value={rentalForm.phone}
                                  onChange={(e) => setRentalForm({...rentalForm, phone: e.target.value})}
                                  placeholder="09xx xxx xxx"
                                  className="w-full bg-black border border-white/10 rounded-2xl py-4 px-5 text-sm focus:border-[#D4AF37] transition-all placeholder:text-gray-800" 
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-2">وصف قصير عن نشاطك ⚜️</label>
                              <textarea 
                                value={rentalForm.description}
                                onChange={(e) => setRentalForm({...rentalForm, description: e.target.value})}
                                placeholder="ماذا ستقدم لعملاء AURUM؟"
                                className="w-full bg-black border border-white/10 rounded-2xl py-4 px-5 text-sm focus:border-[#D4AF37] transition-all h-24 no-scrollbar placeholder:text-gray-800"
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-2">التصنيف الرئيسي</label>
                                <select 
                                  value={rentalForm.category}
                                  onChange={(e) => setRentalForm({...rentalForm, category: e.target.value})}
                                  className="w-full bg-black border border-white/10 rounded-2xl py-4 px-5 text-sm focus:border-[#D4AF37]"
                                >
                                  <option value="عطور">عطور</option>
                                  <option value="ألبسة">ألبسة</option>
                                  <option value="ساعات">ساعات</option>
                                  <option value="مجوهرات">مجوهرات</option>
                                  <option value="إكسسوارات">إكسسوارات</option>
                                  <option value="عام">آخر</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-2">خطة الاشتراك</label>
                                <select 
                                  value={rentalForm.plan}
                                  onChange={(e) => setRentalForm({...rentalForm, plan: e.target.value as 'basic' | 'plus'})}
                                  className="w-full bg-black border border-white/10 rounded-2xl py-4 px-5 text-sm focus:border-[#D4AF37]"
                                >
                                  <option value="plus">PLATINUM (150k)</option>
                                  <option value="basic">GOLD (100k)</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-2">نظام التوصيل</label>
                                <select 
                                  value={rentalForm.delivery}
                                  onChange={(e) => setRentalForm({...rentalForm, delivery: e.target.value as 'aurum' | 'self'})}
                                  className="w-full bg-black border border-white/10 rounded-2xl py-4 px-5 text-sm focus:border-[#D4AF37]"
                                >
                                  <option value="aurum">عبر أسطول AURUM</option>
                                  <option value="self">توصيل ذاتي للمحل</option>
                                </select>
                              </div>
                            </div>

                            <button 
                              type="submit"
                              disabled={submittingRequest}
                              className="w-full bg-[#D4AF37] text-black font-black py-5 rounded-2xl shadow-[0_15px_30px_rgba(212,175,55,0.2)] mt-6 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                              {submittingRequest ? "جاري المعالجة..." : "تأكيد الطلب وإرساله للإدارة ⚜️"}
                            </button>
                          </form>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
                
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] pt-4">© 2026 AURUM LUXURY ARBIL & TARTUS</p>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center">
          <div className="relative">
            <Loader2 size={80} className="text-[#D4AF37] animate-spin" />
            <Crown size={30} className="text-[#D4AF37] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        </div>
      )}
    </div>
  );
}
