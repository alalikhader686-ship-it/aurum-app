import React, { useState, useEffect } from 'react';
import { 
  Store, 
  Plus, 
  Package, 
  Settings, 
  Sparkles,
  Loader2,
  FileText,
  Camera,
  Upload,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  MapPin,
  Pencil,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, updateDoc, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { deliveryService } from '../services/deliveryService';
import { Product, Order, Shop, CartItem, MerchantRequest } from '../types';
import { buildCustomerApprovalMessage, openWhatsApp } from '../services/whatsappService';
import { buildCustomerTelegramApprovalMessage, sendAutomatedTelegramServer } from '../services/telegramService';

interface MerchantDashboardProps {
  user: {
    uid: string;
    email: string | null;
  };
  onSwitchView: () => void;
}

export default function MerchantDashboard({ user, onSwitchView }: MerchantDashboardProps) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [pendingRequest, setPendingRequest] = useState<MerchantRequest | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders'>('inventory');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [sizeInput, setSizeInput] = useState('');
  const [colorNameInput, setColorNameInput] = useState('');
  const [colorHexInput, setColorHexInput] = useState('#000000');
  
  // Helper for cleaning up memory and handling file uploads
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // ~800KB limit for Base64 in Firestore
      alert("حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 800 كيلوبايت.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      callback(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus
      });
      
      // Add notification for user in the background safely
      const order = orders.find(o => o.id === orderId);
      if (order) {
        addDoc(collection(db, 'notifications'), {
          userId: order.userId,
          orderId: orderId,
          status: newStatus,
          message: `المتجر حدّث حالة طلبك إلى: ${
            newStatus === 'confirmed' ? 'تم الموافقة ⚜️' : 
            newStatus === 'rejected' ? 'تم الرفض ❌' :
            newStatus === 'shipping' ? 'قيد التوصيل 🛵' : 'تم التوصيل 🎉'
          }`,
          read: false,
          createdAt: new Date().toISOString()
        }).catch(err => {
          console.warn("AURUM LOGISTICS ⚠️: فشل إضافة إشعار للزبون من لوحة التاجر:", err);
        });

        // If approved, send the order to the delivery app & send WhatsApp message to customer
        if (newStatus === 'confirmed') {
          deliveryService.sendOrderToDeliveryApp({
            id: orderId,
            items: order.items || [],
            total: order.total || 0,
            userName: order.userName,
            phone: order.phone || '',
            city: order.city || '',
            area: order.area || '',
            coordinates: order.coordinates,
            paymentMethod: order.paymentMethod || 'CASH'
          }).then(() => {
            console.log("AURUM LOGISTICS 📦: تم إرسال الطلبية بنجاح لتطبيق الدليفري من لوحة التاجر");
          }).catch(e => {
            console.warn("AURUM LOGISTICS ⚠️: فشل إرسال الطلب إلى تطبيق الدليفري الخارجي من لوحة التاجر:", e);
          });

          // Send Automated Telegram Invoice & Approval to Customer via Backend
          try {
            getDoc(doc(db, 'settings', 'global')).then(snap => {
              if (snap.exists()) {
                const setts = snap.data();
                const custToken = setts.customerTelegramBotToken;
                const customerRecipient = order.telegramChatId || order.telegramUsername || (order.phone && order.phone.startsWith('@') ? order.phone : null);

                if (custToken && customerRecipient) {
                  const tgMsg = buildCustomerTelegramApprovalMessage(order);
                  sendAutomatedTelegramServer(custToken, customerRecipient, tgMsg).then(res => {
                    if (res.success) {
                      console.log(`AURUM MERCHANT TELEGRAM BOT 🤖: Customer invoice sent automatically to (${customerRecipient}) via Customer Bot!`);
                    } else {
                      console.warn("AURUM MERCHANT TELEGRAM BOT ⚠️ Customer Bot error:", res.error);
                    }
                  }).catch(console.warn);
                }
              }
            }).catch(console.warn);
          } catch (e) {
            console.warn("Telegram merchant approval error:", e);
          }

          if (order.phone) {
            const customerMsg = buildCustomerApprovalMessage(order);
            openWhatsApp(order.phone, customerMsg);
          }
        }
      }
      
      alert("تم تحديث حالة الطلب بنجاح ⚜️");
    } catch (err) {
      console.error("Error updating order:", err);
      alert("⚠️ فشل تحديث حالة الطلب: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Form states
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    category: 'عطور',
    description: '',
    image: 'https://picsum.photos/seed/product/800/1000',
    images: [] as string[],
    availableSizes: [] as string[],
    availableColors: [] as string[],
    currency: 'SYP' as 'SYP' | 'USD',
    newSypPrice: ''
  });

  const [newShop, setNewShop] = useState({
    name: '',
    description: '',
    category: 'عام',
    image: 'https://picsum.photos/seed/shop/800/1000',
    delivery: 'shop'
  });

  const [rentInvoice, setRentInvoice] = useState({
    amount: '',
    transactionId: '',
    method: 'Syriatel Cash'
  });
  const [showRentModal, setShowRentModal] = useState(false);
  const [showAddStory, setShowAddStory] = useState(false);
  const [newStory, setNewStory] = useState({
    image: 'https://picsum.photos/seed/moment/800/1200',
    text: ''
  });

  const LUXURY_IMAGES = [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1542491595-3015c178ce0a?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1583333222044-589c6e2e5a00?q=80&w=1000&auto=format&fit=crop'
  ];

  useEffect(() => {
    if (!user) return;
    
    // Fetch Shop
    const q = query(collection(db, 'shops'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const shopDoc = snapshot.docs[0];
        const shopData = { id: shopDoc.id, ...shopDoc.data() } as Shop;
        setShop(shopData);
        
        // Fetch Products
        const pq = query(collection(db, 'products'), where('shopId', '==', shopDoc.id));
        onSnapshot(pq, (pSnap) => {
          setProducts(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        });

        // Fetch Orders for this merchant (using merchantIds for efficient rule filtering)
        // We query without orderBy inside Firestore to avoid requiring a composite index, 
        // sorting them in memory instead for flawless real-time responsiveness.
        const oq = query(
          collection(db, 'orders'), 
          where('merchantIds', 'array-contains', user.uid)
        );
        onSnapshot(oq, (oSnap) => {
          const allOrders = oSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
          // Sort in-memory descending by createdAt
          allOrders.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
          // Filter locally for this specific shop if needed, but usually merchant wants all their orders here
          const shopOrders = allOrders.filter(o => o.shopIds?.includes(shopDoc.id));
          setOrders(shopOrders);
        }, (err) => {
          console.error("AURUM LOGISTICS ⚠️: Error fetching merchant orders snapshot:", err);
        });
      } else {
        // If no shop, check for pending merchant request
        const mq = query(collection(db, 'merchant_requests'), where('userId', '==', user.uid), where('status', '==', 'pending'));
        onSnapshot(mq, (mSnap) => {
          if (!mSnap.empty) {
            setPendingRequest({ id: mSnap.docs[0].id, ...mSnap.docs[0].data() } as MerchantRequest);
          } else {
            setPendingRequest(null);
          }
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'stories'), {
        ...newStory,
        userId: user.uid,
        userName: shop.name,
        userImage: shop.image,
        createdAt: new Date().toISOString()
      });
      setShowAddStory(false);
      setNewStory({
        image: 'https://picsum.photos/seed/moment/800/1200',
        text: ''
      });
      alert("تم نشر اللحظة في الواجهة الرئيسية ⚜️");
    } catch (err) {
      console.error("Error adding story:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'merchant_requests'), {
        userId: user.uid,
        userEmail: user.email,
        shopName: newShop.name,
        description: newShop.description,
        phone: '', // Can be added to form if needed
        delivery: newShop.delivery === 'aurum' ? 'aurum' : 'self',
        plan: 'plus',
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      alert("تم إرسال طلب فتح المتجر بنجاح ⚜️ سيتم المراجعة من قبل الإدارة.");
    } catch (err) {
      console.error("Error creating merchant request:", err);
      alert("حدث خطأ أثناء إرسال الطلب. يرجى المحاولة لاحقاً.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendRentInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'rent_invoices'), {
        merchantId: user.uid,
        merchantEmail: user.email,
        shopId: shop?.id,
        shopName: shop?.name,
        ...rentInvoice,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      alert("تم إرسال إيصال الدفع للإدارة بنجاح ⚜️ سيتم تأكيد اشتراكك قريباً.");
      setShowRentModal(false);
    } catch (err) {
      console.error("Error sending rent invoice:", err);
      alert("حدث خطأ أثناء إرسال الإيصال.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    setLoading(true);
    try {
      const allImages = [newProduct.image, ...newProduct.images].filter(img => !!img);
      
      let calculatedNewSyp = '';
      if (newProduct.currency === 'SYP') {
        const numericPrice = parseInt(newProduct.price.replace(/[^0-9]/g, '')) || 0;
        calculatedNewSyp = (numericPrice / 100).toLocaleString();
      }

      const productData = {
        ...newProduct,
        images: allImages,
        shopId: shop.id,
        shopName: shop.name,
        ownerId: user.uid,
        currency: newProduct.currency || 'SYP',
        newSypPrice: calculatedNewSyp,
        updatedAt: new Date().toISOString()
      };

      if (editingProductId) {
        await updateDoc(doc(db, 'products', editingProductId), productData);
        alert("تم تحديث المنتج بنجاح ⚜️");
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          section: 'mall',
          isFeatured: false,
          ratings: [],
          averageRating: 0,
          createdAt: new Date().toISOString()
        });
        alert("تم إضافة المنتج بنجاح ⚜️");
      }

      setShowAddProduct(false);
      setEditingProductId(null);
      setNewProduct({
        name: '',
        price: '',
        category: 'عطور',
        description: '',
        image: 'https://picsum.photos/seed/product/800/1000',
        images: [],
        availableSizes: [],
        availableColors: [],
        currency: 'SYP',
        newSypPrice: ''
      });
    } catch (err) {
      console.error("Error saving product:", err);
      alert("حدث خطأ أثناء حفظ المنتج");
    } finally {
      setLoading(false);
    }
  };

  const openEditProduct = (p: Product) => {
    const mainImg = p.image || p.images?.[0] || '';
    const otherImgs = (p.images || []).filter(img => img !== mainImg);
    
    setNewProduct({
      name: p.name,
      price: p.price,
      category: p.category || 'عطور',
      description: p.description || '',
      image: mainImg,
      images: otherImgs,
      availableSizes: p.availableSizes || [],
      availableColors: p.availableColors || [],
      currency: p.currency || 'SYP',
      newSypPrice: p.newSypPrice || ''
    });
    setEditingProductId(p.id);
    setShowAddProduct(true);
  };

  if (loading && !shop) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-[#D4AF37]" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32" dir="rtl">
      {/* Header */}
      <header className="glass-morphism sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-[#D4AF37]/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#D4AF37] rounded-xl flex items-center justify-center text-black shadow-lg">
            <Store size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider text-[#D4AF37]">لوحة التاجر</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase">AURUM MERCHANT</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onSwitchView}
            className="px-4 py-2 bg-white/5 hover:bg-[#D4AF37]/10 text-[#D4AF37] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-[#D4AF37]/20"
          >
            عرض كزبون ⚜️
          </button>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        {!shop ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#111] border border-[#D4AF37]/20 rounded-[40px] p-8 text-center shadow-2xl"
          >
            {pendingRequest ? (
              <div className="py-10">
                <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 mx-auto mb-6">
                  <Clock size={40} />
                </div>
                <h2 className="text-2xl font-black mb-4">في انتظار الموافقة ⚜️</h2>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                  تم استلام طلبك لفتح متجر باسم <span className="text-[#D4AF37] font-bold">"{pendingRequest.shopName}"</span> وهو قيد المراجعة حالياً من قبل الإدارة.
                </p>
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4 text-xs text-yellow-500/80">
                  سيتم إعلامك فور تفعيل متجرك لتبدأ بإضافة منتجاتك.
                </div>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 bg-[#D4AF37]/10 rounded-full flex items-center justify-center text-[#D4AF37] mx-auto mb-6">
                  <Sparkles size={40} />
                </div>
                <h2 className="text-2xl font-black mb-4">ابدأ رحلتك التجارية ⚜️</h2>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                  افتح متجرك الخاص في AURUM MALL واعرض منتجاتك الفاخرة لآلاف الزبائن.
                </p>
                
                <form onSubmit={handleCreateShop} className="space-y-4 text-right">
                  <div>
                    <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">اسم المتجر</label>
                    <input 
                      type="text" 
                      required
                      placeholder="مثلاً: لورينت للفخامة"
                      className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                      value={newShop.name}
                      onChange={(e) => setNewShop({...newShop, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">وصف المتجر</label>
                    <textarea 
                      required
                      placeholder="وصف مختصر لمتجرك وما يميزه..."
                      className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all h-32"
                      value={newShop.description}
                      onChange={(e) => setNewShop({...newShop, description: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">صورة المتجر</label>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-[#D4AF37]/30 flex items-center justify-center overflow-hidden">
                        {newShop.image ? (
                          <img src={newShop.image || null} className="w-full h-full object-cover" />
                        ) : (
                          <Camera className="text-gray-600" />
                        )}
                      </div>
                      <label className="flex-1 cursor-pointer bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-center hover:bg-[#D4AF37]/10 transition-all">
                        <span className="text-xs font-bold">تحميل صورة المتجر ⚜️</span>
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, (url) => setNewShop({...newShop, image: url}))}
                        />
                      </label>
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : "تقديم طلب فتح المتجر ⚜️"}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Shop Status Card */}
            <div className="bg-[#111] border border-[#D4AF37]/20 rounded-[35px] p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src={shop.image || null} className="w-16 h-16 rounded-2xl object-cover border border-[#D4AF37]/20" />
                <div>
                  <h2 className="text-xl font-black">{shop.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      "text-[10px] font-black px-2 py-0.5 rounded-full uppercase",
                      shop.status === 'active' ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-500"
                    )}>
                      {shop.status === 'active' ? "نشط" : "قيد المراجعة"}
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold">{shop.category}</span>
                  </div>
                </div>
              </div>
              <button className="p-3 bg-white/5 rounded-2xl text-gray-400 hover:text-[#D4AF37] transition-all">
                <Settings size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-[#111] p-1 rounded-2xl border border-white/5">
              <button 
                onClick={() => setActiveTab('inventory')}
                className={cn(
                  "flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2",
                  activeTab === 'inventory' ? "bg-[#D4AF37] text-black shadow-lg" : "text-gray-500"
                )}
              >
                <Package size={16} />
                المخزون
              </button>
              <button 
                onClick={() => setActiveTab('orders')}
                className={cn(
                  "flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2",
                  activeTab === 'orders' ? "bg-[#D4AF37] text-black shadow-lg" : "text-gray-500"
                )}
              >
                <ShoppingBag size={16} />
                الطلبات ({orders.length})
              </button>
            </div>

            {activeTab === 'inventory' ? (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#111] border border-white/5 rounded-[30px] p-6">
                    <p className="text-gray-500 text-[10px] font-bold uppercase mb-2">إجمالي المنتجات</p>
                    <h3 className="text-3xl font-black text-[#D4AF37]">{products.length}</h3>
                  </div>
                  <div className="bg-[#111] border border-white/5 rounded-[30px] p-6">
                    <p className="text-gray-500 text-[10px] font-bold uppercase mb-2">المبيعات</p>
                    <h3 className="text-3xl font-black text-[#D4AF37]">{orders.filter(o => o.status === 'delivered').length}</h3>
                  </div>
                </div>

                {/* Rent Payment Section */}
                <div className="bg-gradient-to-r from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/20 rounded-[35px] p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-right">
                    <h3 className="text-lg font-black text-white mb-2">اشتراك المتجر الملكي ⚜️</h3>
                    <p className="text-gray-400 text-xs">يرجى إرسال إيصال دفع الإيجار الشهري لتجنب إيقاف المتجر.</p>
                  </div>
                  <button 
                    onClick={() => setShowRentModal(true)}
                    className="px-8 py-4 bg-[#D4AF37] text-black font-black rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
                  >
                    <FileText size={20} />
                    إرسال إيصال الدفع
                  </button>
                </div>

                {/* Aurum Moments Section */}
                <div className="bg-[#111] border border-[#D4AF37]/20 rounded-[35px] p-8 text-right">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2 justify-end">
                        لحظات أوروم ⚜️
                        <Sparkles size={20} className="text-[#D4AF37]" />
                      </h3>
                      <p className="text-gray-400 text-xs">انشر صوراً حصرية لمنتجاتك تظهر في الصفحة الرئيسية.</p>
                    </div>
                    <button 
                      onClick={() => setShowAddStory(true)}
                      className="p-4 bg-[#D4AF37]/10 text-[#D4AF37] rounded-2xl hover:bg-[#D4AF37] hover:text-black transition-all"
                    >
                      <Camera size={24} />
                    </button>
                  </div>
                </div>

                {/* Products Section */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black">منتجاتك ⚜️</h3>
                    <button 
                      onClick={() => {
                        setEditingProductId(null);
                        setNewProduct({
                          name: '',
                          price: '',
                          category: 'عطور',
                          description: '',
                          image: 'https://picsum.photos/seed/product/800/1000',
                          images: [],
                          availableSizes: [],
                          availableColors: [],
                          currency: 'SYP',
                          newSypPrice: ''
                        });
                        setShowAddProduct(true);
                      }}
                      className="flex items-center gap-2 bg-[#D4AF37] text-black px-4 py-2 rounded-full font-black text-xs shadow-lg active:scale-95 transition-all"
                    >
                      <Plus size={16} />
                      إضافة منتج
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {products.length === 0 ? (
                      <div className="col-span-2 py-12 text-center text-gray-600">
                        <Package size={48} className="mx-auto mb-4 opacity-20" />
                        <p>لم تقم بإضافة أي منتجات بعد</p>
                      </div>
                    ) : (
                      products.map((p) => (
                        <div key={`merchant-prod-${p.id}`} className="bg-[#111] border border-white/5 rounded-[30px] p-4 group">
                          <div className="aspect-square rounded-[22px] overflow-hidden mb-4 relative">
                            <img src={p.image || null} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                              <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-[#D4AF37]">
                                {p.price} <span className="opacity-60">{p.currency === 'USD' ? '$' : 'ل.س'}</span>
                              </div>
                              {p.currency === 'SYP' && p.newSypPrice && (
                                <div className="bg-amber-500/80 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[8px] font-black text-black">
                                  {p.newSypPrice} ل.س جديد
                                </div>
                              )}
                            </div>
                          </div>
                          <h4 className="font-bold text-sm mb-1">{p.name}</h4>
                          <div className="flex justify-between items-center">
                            <p className="text-gray-500 text-[10px]">{p.category}</p>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditProduct(p);
                              }}
                              className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-[#D4AF37] transition-colors"
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </>
            ) : (
              <div className="space-y-6">
                <h3 className="text-xl font-black">طلبات الزبائن ⚜️</h3>
                {orders.length === 0 ? (
                  <div className="py-20 text-center text-gray-600 bg-[#111] rounded-[35px] border border-white/5">
                    <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                    <p>لا يوجد طلبات لمتجرك حالياً</p>
                  </div>
                ) : (
                  orders.map((order) => (
                    <motion.div 
                      key={`merchant-order-${order.id}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-[#111] border border-[#D4AF37]/20 rounded-[35px] p-6 space-y-4 shadow-xl text-right"
                    >
                      <div className="flex justify-between items-start">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                          order.status === 'delivered' ? "bg-green-500/20 text-green-500" :
                          order.status === 'rejected' ? "bg-red-500/20 text-red-500" :
                          "bg-[#D4AF37]/20 text-[#D4AF37]"
                        )}>
                          {order.status === 'pending' ? 'قيد المراجعة' : 
                           order.status === 'confirmed' ? 'تمت الموافقة' :
                           order.status === 'shipping' ? 'قيد التوصيل' :
                           order.status === 'delivered' ? 'تم التوصيل' : 'مرفوض'}
                        </span>
                        <div>
                          <p className="text-[#D4AF37] font-black text-lg">{order.total?.toLocaleString()} SP</p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{new Date(order.createdAt).toLocaleString('ar-SY')}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-black/40 p-4 rounded-2xl space-y-2 border border-white/5">
                          <p className="text-[#D4AF37] text-xs font-black flex items-center gap-2 justify-end">
                            تفاصيل الطلب:
                            <Package size={14} />
                          </p>
                          {order.items.filter((item: CartItem) => item.shopId === shop.id).map((item: CartItem, idx: number) => (
                            <div key={`order-item-${order.id}-${idx}`} className="border-b border-white/5 pb-2 last:border-0">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-[#D4AF37] font-bold">{item.price}</span>
                                <span className="text-gray-300">{item.name} x{item.quantity}</span>
                              </div>
                              <div className="flex gap-2 justify-end">
                                {item.selectedSize && (
                                  <span className="text-[8px] font-black bg-[#D4AF37]/10 text-[#D4AF37] px-1.5 py-0.5 rounded border border-[#D4AF37]/20 uppercase">
                                    ق: {item.selectedSize}
                                  </span>
                                )}
                                {item.selectedColor && (
                                  <span className="text-[8px] font-black bg-white/5 text-gray-400 px-1.5 py-0.5 rounded border border-white/10">
                                    ل: {item.selectedColor}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="bg-black/40 p-4 rounded-2xl space-y-2 border border-white/5 text-right">
                          <p className="text-[#D4AF37] text-xs font-black flex items-center gap-2 justify-end">
                            موقع الزبون:
                            <MapPin size={14} />
                          </p>
                          <p className="text-xs text-white">📍 {order.city} - {order.area}</p>
                          <p className="text-xs text-gray-400">👤 {order.userName || order.userEmail}</p>
                          <p className="text-xs text-gray-400">📞 {order.phone}</p>
                        </div>
                      </div>

                      {order.status === 'pending' && (
                        <div className="flex gap-3 pt-2">
                          <button 
                            onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')}
                            className="flex-1 bg-[#D4AF37] text-black font-black py-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                          >
                            <CheckCircle2 size={16} />
                            موافقة على الطلب
                          </button>
                          <button 
                            onClick={() => handleUpdateOrderStatus(order.id, 'rejected')}
                            className="flex-1 bg-red-500/10 text-red-500 font-black py-4 rounded-2xl text-xs flex items-center justify-center gap-2 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95"
                          >
                            <XCircle size={16} />
                            رفض الطلب
                          </button>
                        </div>
                      )}
                      
                      {order.status === 'confirmed' && (
                        <button 
                          onClick={() => handleUpdateOrderStatus(order.id, 'shipping')}
                          className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-2xl text-xs flex items-center justify-center gap-2"
                        >
                          <ShoppingBag size={16} />
                          تغيير الحالة إلى: قيد التوصيل
                        </button>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Rent Payment Modal */}
      <AnimatePresence>
        {showRentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRentModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-[40px] p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-[#D4AF37]">إرسال إيصال الدفع ⚜️</h3>
                <button onClick={() => setShowRentModal(false)} className="text-gray-500 hover:text-white">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSendRentInvoice} className="space-y-6 text-right">
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">المبلغ المحول</label>
                  <input 
                    type="text" required
                    placeholder="مثلاً: 310,000 ل.س"
                    className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                    value={rentInvoice.amount}
                    onChange={(e) => setRentInvoice({...rentInvoice, amount: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">رقم العملية / المرجع</label>
                  <input 
                    type="text" required
                    placeholder="الرقم الموجود في رسالة التحويل"
                    className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                    value={rentInvoice.transactionId}
                    onChange={(e) => setRentInvoice({...rentInvoice, transactionId: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">طريقة الدفع</label>
                  <select 
                    className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                    value={rentInvoice.method}
                    onChange={(e) => setRentInvoice({...rentInvoice, method: e.target.value})}
                  >
                    <option>Syriatel Cash</option>
                    <option>الهرم</option>
                    <option>Bank Bimo</option>
                  </select>
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : "تأكيد إرسال الإيصال ⚜️"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Story Modal */}
      <AnimatePresence>
        {showAddStory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddStory(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-[40px] p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-[#D4AF37]">نشر لحظة جديدة ⚜️</h3>
                <button onClick={() => setShowAddStory(false)} className="text-gray-500 hover:text-white">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddStory} className="space-y-6 text-right">
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">صورة اللحظة</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-32 rounded-2xl border-2 border-dashed border-[#D4AF37]/30 flex items-center justify-center overflow-hidden">
                      {newStory.image ? (
                        <img src={newStory.image || null} className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="text-gray-600" />
                      )}
                    </div>
                    <label className="flex-1 cursor-pointer bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-center hover:bg-[#D4AF37]/10 transition-all">
                      <div className="flex flex-col items-center gap-2">
                        <Upload size={20} className="text-[#D4AF37]" />
                        <span className="text-[10px] font-black uppercase tracking-wider">تحميل صورة ملكية ⚜️</span>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, (url) => setNewStory({...newStory, image: url}))}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">نص اللحظة (اختياري)</label>
                  <input 
                    type="text"
                    placeholder="مثلاً: تشكيلة جديدة وصلت الآن..."
                    className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                    value={newStory.text}
                    onChange={(e) => setNewStory({...newStory, text: e.target.value})}
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">أو اختر من المعرض الملكي:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {LUXURY_IMAGES.map((img, i) => (
                      <button
                        key={`luxury-story-${i}`}
                        type="button"
                        onClick={() => setNewStory({...newStory, image: img})}
                        className={cn(
                          "aspect-square rounded-xl overflow-hidden border-2 transition-all",
                          newStory.image === img ? "border-[#D4AF37]" : "border-transparent"
                        )}
                      >
                        <img src={img || null} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : "نشر اللحظة ⚜️"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddProduct(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-[40px] p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-[#D4AF37]">
                  {editingProductId ? 'تعديل بيانات المنتج ⚜️' : 'إضافة منتج جديد ⚜️'}
                </h3>
                <button onClick={() => setShowAddProduct(false)} className="text-gray-500 hover:text-white">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddProduct} className="space-y-6 text-right">
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">صور المنتج ⚜️</label>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Main Image */}
                    <div className="relative group aspect-square">
                      <div className="w-full h-full rounded-2xl border border-[#D4AF37]/30 flex items-center justify-center overflow-hidden bg-black/40">
                        {newProduct.image ? (
                          <img src={newProduct.image || null} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={24} className="text-gray-800" />
                        )}
                      </div>
                      <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                        <Upload size={20} className="text-[#D4AF37]" />
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, (url) => setNewProduct({...newProduct, image: url}))}
                        />
                      </label>
                      <div className="absolute top-1 right-1 bg-[#D4AF37] text-black text-[8px] font-bold px-1.5 rounded-full">الأساسية</div>
                    </div>

                    {/* Additional Images */}
                    {newProduct.images.map((img, idx) => (
                      <div key={`merchant-prod-gallery-${idx}`} className="relative group aspect-square">
                        <div className="w-full h-full rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden bg-black/40">
                          <img src={img || null} className="w-full h-full object-cover" />
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            const updated = [...newProduct.images];
                            updated.splice(idx, 1);
                            setNewProduct({...newProduct, images: updated});
                          }}
                          className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    ))}

                    {/* Add More */}
                    {newProduct.images.length < 5 && (
                      <label className="aspect-square rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-[#D4AF37]/20 transition-all">
                        <Plus size={20} className="text-gray-600 mb-1" />
                        <span className="text-[7px] text-gray-500 font-bold uppercase">إضافة صورة</span>
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, (url) => setNewProduct({
                            ...newProduct, 
                            images: [...newProduct.images, url]
                          }))}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">اسم المنتج</label>
                  <input 
                    type="text" required
                    className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">أو اختر من المعرض الملكي:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {LUXURY_IMAGES.map((img, i) => (
                      <button
                        key={`luxury-prod-${i}`}
                        type="button"
                        onClick={() => setNewProduct({...newProduct, image: img})}
                        className={cn(
                          "aspect-square rounded-xl overflow-hidden border-2 transition-all",
                          newProduct.image === img ? "border-[#D4AF37]" : "border-transparent"
                        )}
                      >
                        <img src={img || null} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">العملة 💵</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button" 
                      onClick={() => setNewProduct({...newProduct, currency: 'SYP'})}
                      className={cn(
                        "py-3 rounded-xl text-[10px] font-bold border transition-all",
                        newProduct.currency === 'SYP' ? "bg-[#D4AF37] text-black border-[#D4AF37]" : "bg-white/5 text-gray-500 border-white/10"
                      )}
                    >
                      ليرة سورية
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setNewProduct({...newProduct, currency: 'USD'})}
                      className={cn(
                        "py-3 rounded-xl text-[10px] font-bold border transition-all",
                        newProduct.currency === 'USD' ? "bg-[#D4AF37] text-black border-[#D4AF37]" : "bg-white/5 text-gray-500 border-white/10"
                      )}
                    >
                      دولار
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">السعر ({newProduct.currency === 'SYP' ? 'ليرة سورية' : 'دولار'})</label>
                    <input 
                      type="text" required
                      className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                      placeholder={newProduct.currency === 'SYP' ? "85,000" : "45"}
                    />
                    {newProduct.currency === 'SYP' && newProduct.price && (
                      <p className="text-[9px] text-amber-500/60 font-bold mt-2 pr-2">
                         سيظهر أيضاً: {(parseInt(newProduct.price.replace(/[^0-9]/g, '')) / 100 || 0).toLocaleString()} ليرة سورية (جديد)
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">الفئة</label>
                    <select 
                      className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                    >
                      <option>عطور</option>
                      <option>ساعات</option>
                      <option>ملابس رجالية</option>
                      <option>ملابس نسائية</option>
                      <option>ملابس أطفال</option>
                      <option>ألبسة أوروبية</option>
                      <option>إكسسوارات</option>
                      <option>شي ان</option>
                    </select>
                  </div>
                </div>
                {/* Sizes & Colors Input Section - Styled exactly as requested */}
                <div className="space-y-6 pt-4 border-t border-white/10">
                  {/* المقاسات المتاحة */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-[#D4AF37] text-right">المقاسات المتاحة</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="text" 
                        value={sizeInput}
                        onChange={(e) => setSizeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (sizeInput.trim()) {
                              const val = sizeInput.trim();
                              if (!newProduct.availableSizes?.includes(val)) {
                                setNewProduct({
                                  ...newProduct,
                                  availableSizes: [...(newProduct.availableSizes || []), val]
                                });
                              }
                              setSizeInput('');
                            }
                          }
                        }}
                        placeholder="مثال: S, M, L, XL, 42"
                        className="flex-1 bg-[#0f0f0f] border border-white/15 rounded-2xl py-3 px-4 text-white text-xs text-right focus:outline-none focus:border-[#D4AF37] transition-all"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (sizeInput.trim()) {
                            const val = sizeInput.trim();
                            if (!newProduct.availableSizes?.includes(val)) {
                              setNewProduct({
                                ...newProduct,
                                availableSizes: [...(newProduct.availableSizes || []), val]
                              });
                            }
                            setSizeInput('');
                          }
                        }}
                        className="bg-[#1f1f1f] text-[#D4AF37] border border-[#D4AF37]/40 px-5 py-3 rounded-2xl font-bold text-xs hover:bg-[#2a2a2a] active:scale-95 transition-all shrink-0"
                      >
                        إضافة مقاس
                      </button>
                    </div>

                    {/* Added Sizes Tags */}
                    {newProduct.availableSizes && newProduct.availableSizes.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1" dir="rtl">
                        {newProduct.availableSizes.map((size, idx) => (
                          <span 
                            key={`merchant-size-chip-${idx}`}
                            className="bg-[#111] border border-white/20 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
                          >
                            <button 
                              type="button" 
                              onClick={() => {
                                setNewProduct({
                                  ...newProduct,
                                  availableSizes: newProduct.availableSizes.filter(s => s !== size)
                                });
                              }}
                              className="text-gray-400 hover:text-red-400 transition-colors"
                            >
                              ✕
                            </button>
                            <span>{size}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* الألوان المتاحة */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-[#D4AF37] text-right">الألوان المتاحة</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="text" 
                        value={colorNameInput}
                        onChange={(e) => setColorNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (colorNameInput.trim()) {
                              const name = colorNameInput.trim();
                              const colorEntry = colorHexInput ? `${name}|${colorHexInput}` : name;
                              if (!newProduct.availableColors?.includes(colorEntry) && !newProduct.availableColors?.includes(name)) {
                                setNewProduct({
                                  ...newProduct,
                                  availableColors: [...(newProduct.availableColors || []), colorEntry]
                                });
                              }
                              setColorNameInput('');
                            }
                          }
                        }}
                        placeholder="اسم اللون (مثال: كحلي)"
                        className="flex-1 bg-[#0f0f0f] border border-white/15 rounded-2xl py-3 px-4 text-white text-xs text-right focus:outline-none focus:border-[#D4AF37] transition-all"
                      />
                      <input 
                        type="color"
                        value={colorHexInput}
                        onChange={(e) => setColorHexInput(e.target.value)}
                        className="w-10 h-10 rounded-xl border border-white/20 bg-transparent cursor-pointer p-0.5 shrink-0"
                        title="اختر لوناً"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (colorNameInput.trim()) {
                            const name = colorNameInput.trim();
                            const colorEntry = colorHexInput ? `${name}|${colorHexInput}` : name;
                            if (!newProduct.availableColors?.includes(colorEntry) && !newProduct.availableColors?.includes(name)) {
                              setNewProduct({
                                ...newProduct,
                                availableColors: [...(newProduct.availableColors || []), colorEntry]
                              });
                            }
                            setColorNameInput('');
                          }
                        }}
                        className="bg-[#1f1f1f] text-[#D4AF37] border border-[#D4AF37]/40 px-5 py-3 rounded-2xl font-bold text-xs hover:bg-[#2a2a2a] active:scale-95 transition-all shrink-0"
                      >
                        إضافة لون
                      </button>
                    </div>

                    {/* Added Colors Tags */}
                    {newProduct.availableColors && newProduct.availableColors.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1" dir="rtl">
                        {newProduct.availableColors.map((colorEntry, idx) => {
                          const parts = colorEntry.split('|');
                          const name = parts[0];
                          const hex = parts[1] || '#888888';
                          return (
                            <span 
                              key={`merchant-color-chip-${idx}`}
                              className="bg-[#111] border border-white/20 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
                            >
                              <button 
                                type="button" 
                                onClick={() => {
                                  setNewProduct({
                                    ...newProduct,
                                    availableColors: newProduct.availableColors.filter(c => c !== colorEntry)
                                  });
                                }}
                                className="text-gray-400 hover:text-red-400 transition-colors"
                              >
                                ✕
                              </button>
                              <span>{name}</span>
                              <span 
                                className="w-3.5 h-3.5 rounded-full inline-block border border-white/30 shrink-0" 
                                style={{ backgroundColor: hex }} 
                              />
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">الوصف</label>
                  <textarea 
                    required
                    className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all h-24"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : editingProductId ? <CheckCircle2 size={24} /> : <Plus size={24} />}
                  {editingProductId ? "حفظ التعديلات الملكية ⚜️" : "إضافة المنتج للمتجر ⚜️"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
