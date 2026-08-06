import React, { useState, useEffect } from 'react';
import { ChevronRight, Package, Clock, CheckCircle2, History, Truck, ShieldCheck, MapPin, CreditCard, Trash2, XCircle, Gem } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';

// Leaflet icons
const CourierIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/854/854866.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

const UserIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

interface OrderItem {
  name: string;
  price: string;
  quantity: number;
}

interface Order {
  id: string;
  status: 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'rejected' | 'cancelled';
  cancellationStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  createdAt: string | number | Date;
  items: OrderItem[];
  total: number;
  city: string;
  area: string;
  phone: string;
  paymentMethod: string;
  coordinates?: { lat: number, lng: number };
}

interface CustomJewelryRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  phone: string;
  description: string;
  image?: string;
  status: 'pending' | 'reviewed' | 'quoted' | 'rejected' | 'accepted' | 'completed';
  quotedPrice?: string;
  createdAt: string;
}

interface MyOrdersProps {
  onBack: () => void;
}

const StatusTracker = ({ status }: { status: Order['status'] }) => {
  const steps = [
    { id: 'pending', label: 'قيد المراجعة', icon: Clock },
    { id: 'confirmed', label: 'تم التأكيد', icon: ShieldCheck },
    { id: 'shipping', label: 'قيد التوصيل', icon: Truck },
    { id: 'delivered', label: 'تم التوصيل', icon: CheckCircle2 },
  ];

  if (status === 'cancelled' || status === 'rejected') {
    return (
      <div className="mt-8 mb-10 px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
        <XCircle className="text-red-500" size={24} />
        <div>
          <p className="text-red-500 font-black text-sm">الطلب {status === 'cancelled' ? 'ملغي' : 'مرفوض'}</p>
          <p className="text-[10px] text-gray-400">عذراً، هذا الطلب غير نشط حالياً ⚜️</p>
        </div>
      </div>
    );
  }

  const currentStepIndex = steps.findIndex(s => s.id === status);
  const activeIndex = currentStepIndex;

  return (
    <div className="mt-8 mb-10 px-2">
      <div className="flex justify-between relative">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 right-0 h-[2px] bg-white/5 z-0" />
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${(activeIndex / (steps.length - 1)) * 100}%` }}
          className="absolute top-5 left-0 h-[2px] bg-gradient-to-r from-[#D4AF37] to-[#B8860B] z-0 shadow-[0_0_10px_rgba(212,175,55,0.5)]"
        />

        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isCompleted = idx <= activeIndex;
          const isCurrent = idx === activeIndex;

          return (
            <div key={`status-step-${step.id}`} className="flex flex-col items-center gap-3 z-10">
              <motion.div 
                animate={{ 
                  scale: isCurrent ? 1.25 : 1,
                  backgroundColor: isCompleted ? '#D4AF37' : '#0a0a0a',
                  color: isCompleted ? '#000' : '#444',
                  boxShadow: isCurrent ? '0 0 20px rgba(212,175,55,0.4)' : 'none'
                }}
                className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-500 overflow-hidden relative",
                  isCompleted ? "border-[#D4AF37]" : "border-white/5"
                )}
              >
                {isCurrent && (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                    className="absolute inset-0 opacity-20 bg-gradient-to-r from-transparent via-white to-transparent"
                  />
                )}
                <Icon size={18} strokeWidth={isCurrent ? 2.5 : 2} />
              </motion.div>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-tighter text-center max-w-[60px]",
                isCompleted ? "text-[#D4AF37]" : "text-gray-700"
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function MyOrders({ onBack }: MyOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [jewelryRequests, setJewelryRequests] = useState<CustomJewelryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'jewelry'>('orders');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const requestCancellation = async (orderId: string) => {
    setIsCancelling(true);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        cancellationStatus: 'pending'
      });
      setOrderToCancel(null);
      alert("تم إرسال طلب الحذف للإدارة. طلبك الآن قيد المراجعة ⚜️");
    } catch (err) {
      console.error("Error requesting cancellation:", err);
      alert("عذراً، حدث خطأ أثناء إرسال طلب الحذف.");
    } finally {
      setIsCancelling(false);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      const sorted = data.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      
      setOrders(sorted);
    }, (error) => {
      console.error("Error fetching orders:", error);
    });

    const qJewelry = query(
      collection(db, 'custom_jewelry_requests'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribeJewelry = onSnapshot(qJewelry, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CustomJewelryRequest[];
      
      const sorted = data.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      
      setJewelryRequests(sorted);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching jewelry requests:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeJewelry();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 px-6 py-5 flex justify-between items-center">
        <button onClick={onBack} className="text-[#D4AF37] p-2 hover:bg-white/5 rounded-full transition-all">
          <ChevronRight size={28} />
        </button>
        <div className="text-center">
          <h1 className="text-[#D4AF37] font-black text-xl tracking-tight">تتبع مشترياتي ⚜️</h1>
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Order Tracking System</p>
        </div>
        <div className="w-12" />
      </header>

      <div className="max-w-2xl mx-auto px-6 mt-8">
        {/* Tabs */}
        <div className="flex bg-[#111] p-1.5 rounded-2xl mb-8">
          <button 
            onClick={() => setActiveTab('orders')}
            className={cn(
              "flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2",
              activeTab === 'orders' ? "bg-[#D4AF37] text-black shadow-lg" : "text-gray-500 hover:text-gray-300"
            )}
          >
            <Package size={16} />
            مشترياتي 🛍️
          </button>
          <button 
            onClick={() => setActiveTab('jewelry')}
            className={cn(
              "flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2",
              activeTab === 'jewelry' ? "bg-[#D4AF37] text-black shadow-lg" : "text-gray-500 hover:text-gray-300"
            )}
          >
            <Gem size={16} />
            طلبات التفصيل 💎
          </button>
        </div>

        {/* Real-time Status Banner */}
        {!loading && activeTab === 'orders' && orders.length > 0 && orders.some(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'rejected') && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-4 bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping absolute inset-0" />
                <div className="w-3 h-3 bg-emerald-500 rounded-full relative" />
              </div>
              <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em]">تتبع حي ومباشر ⚜️ Live Tracking</p>
            </div>
            <div className="text-[9px] text-gray-500 font-bold">
              آخر تحديث: {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center mt-32 space-y-6">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="w-16 h-16 border-2 border-[#D4AF37]/20 border-t-[#D4AF37] rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center text-[#D4AF37]">
                <History size={24} />
              </div>
            </div>
            <p className="text-gray-500 font-black text-sm uppercase tracking-widest animate-pulse">جاري جلب سجلاتك الفاخرة...</p>
          </div>
        ) : activeTab === 'orders' ? (
          orders.length === 0 ? (
            <div className="text-center mt-32 space-y-6">
              <div className="w-24 h-24 bg-white/5 rounded-[40px] flex items-center justify-center mx-auto text-gray-800 border border-white/5">
                <Package size={48} strokeWidth={1} />
              </div>
              <div>
                <p className="text-white text-xl font-black mb-2">لا توجد طلبات سابقة</p>
                <p className="text-gray-500 text-sm">ابدأ رحلة التسوق الفاخرة الآن ⚜️</p>
              </div>
              <button 
                onClick={onBack}
                className="px-8 py-4 bg-[#D4AF37] text-black font-black rounded-2xl shadow-xl active:scale-95 transition-all"
              >
                تسوق الآن
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {orders.map((order, index) => (
                <motion.div
                  key={`my-order-${order.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-[#0a0a0a] rounded-[35px] border border-white/5 shadow-2xl relative overflow-hidden group"
                >
                  {/* Status Header */}
                  <div className="p-6 pb-0 flex justify-between items-start">
                    <div>
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">رقم الطلب: #{order.id.slice(-6).toUpperCase()}</p>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full animate-pulse",
                          order.status === 'delivered' ? "bg-emerald-500" : "bg-[#D4AF37]"
                        )} />
                        <h3 className="text-lg font-black text-white">
                          {order.status === 'pending' && 'قيد المراجعة'}
                          {order.status === 'confirmed' && 'تم التأكيد بنجاح'}
                          {order.status === 'shipping' && 'في الطريق إليك'}
                          {order.status === 'delivered' && 'تم الاستلام بنجاح'}
                          {order.status === 'cancelled' && 'ملغي'}
                          {order.status === 'rejected' && 'تم الرفض'}
                        </h3>
                        {order.cancellationStatus === 'pending' && (
                          <div className="mr-2 bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-[9px] font-black animate-pulse border border-amber-500/20">
                            قيد انتظار موافقة الحذف ⏳
                          </div>
                        )}
                        {order.cancellationStatus === 'rejected' && (
                          <div className="mr-2 bg-red-500/10 text-red-500 px-3 py-1 rounded-full text-[9px] font-black border border-red-500/20">
                            نعتذر، طلبك قيد التوصيل 🛵
                          </div>
                        )}
                        {order.cancellationStatus === 'approved' && (
                          <div className="mr-2 bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[9px] font-black border border-emerald-500/20">
                            تمت الموافقة على الحذف ✅
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-gray-400 font-bold">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('ar-SY') : '---'}
                      </p>
                    </div>
                  </div>

                  <StatusTracker status={order.status} />

                  {/* Order Details Toggle */}
                  <div className="px-6 pb-6">
                    <button 
                      onClick={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
                      className="w-full bg-white/5 hover:bg-white/10 border border-white/5 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all group"
                    >
                      <span className="text-xs font-black text-gray-300">
                        {selectedOrderId === order.id ? 'إخفاء التفاصيل' : 'عرض تفاصيل الطلب'}
                      </span>
                      <motion.div
                        animate={{ rotate: selectedOrderId === order.id ? 180 : 0 }}
                      >
                        <ChevronRight size={16} className="rotate-90 text-[#D4AF37]" />
                      </motion.div>
                    </button>

                    <AnimatePresence>
                      {selectedOrderId === order.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-6 space-y-6">
                            {/* Tracking Map if shipping */}
                            {order.status === 'shipping' && order.coordinates && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">تتبع المندوب اللحظي ⚜️ Live Map</p>
                                  <span className="text-[10px] text-emerald-500 font-bold animate-pulse">متصل الآن 🛰️</span>
                                </div>
                                <div className="h-64 bg-[#111] rounded-[30px] overflow-hidden border border-[#D4AF37]/20 relative z-0">
                                  <MapContainer 
                                    center={order.coordinates} 
                                    zoom={15} 
                                    style={{ height: '100%', width: '100%' }}
                                    dragging={false}
                                    zoomControl={false}
                                    scrollWheelZoom={false}
                                  >
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                    <Marker position={order.coordinates} icon={UserIcon} />
                                    {/* Mock Courier Position slightly offset */}
                                    <Marker position={{ lat: order.coordinates.lat + 0.005, lng: order.coordinates.lng + 0.003 }} icon={CourierIcon} />
                                    <Polyline 
                                      positions={[
                                        [order.coordinates.lat, order.coordinates.lng],
                                        [order.coordinates.lat + 0.005, order.coordinates.lng + 0.003]
                                      ]} 
                                      color="#D4AF37" 
                                      dashArray="10, 10" 
                                    />
                                  </MapContainer>
                                  <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] text-white">
                                    المندوب يقترب من موقعك ✨
                                  </div>
                                </div>
                                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                    <p className="text-[10px] font-bold text-gray-400">03:45 م - المندوب استلم الطلبية من المركز الرئيسي</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    <p className="text-[10px] font-bold text-white tracking-wide italic underline decoration-[#D4AF37]">الآن - جاري توصيل شحنتك الملكية بالدراجة الكهربائية</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Items */}
                            <div className="space-y-4">
                              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">المنتجات المختارة</p>
                              {order.items.map((item, idx) => (
                                <div key={`order-item-${order.id}-${idx}`} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-[#D4AF37]/10 rounded-xl flex items-center justify-center text-[#D4AF37] font-black text-xs">
                                      {item.quantity}x
                                    </div>
                                    <span className="text-sm font-bold text-white">{item.name}</span>
                                  </div>
                                  <span className="text-sm font-black text-[#D4AF37]">{item.price}</span>
                                </div>
                              ))}
                            </div>

                            {/* Shipping Info */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-2 text-[#D4AF37] mb-2">
                                  <MapPin size={14} />
                                  <span className="text-[10px] font-black uppercase">العنوان</span>
                                </div>
                                <p className="text-xs text-gray-300 font-bold">{order.city} - {order.area}</p>
                              </div>
                              <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-2 text-[#D4AF37] mb-2">
                                  <CreditCard size={14} />
                                  <span className="text-[10px] font-black uppercase">الدفع</span>
                                </div>
                                <p className="text-xs text-gray-300 font-bold">{order.paymentMethod}</p>
                              </div>
                            </div>

                            {/* Total */}
                            <div className="bg-gradient-to-r from-[#D4AF37]/10 to-transparent p-6 rounded-[30px] border border-[#D4AF37]/20 flex justify-between items-center">
                              <div>
                                <p className="text-[10px] text-gray-500 font-black uppercase mb-1">المجموع النهائي</p>
                                <p className="text-2xl font-black text-[#D4AF37]">{order.total?.toLocaleString()} <span className="text-xs">ل.س</span></p>
                              </div>
                              <div className="bg-[#D4AF37] text-black px-4 py-2 rounded-xl text-[10px] font-black">
                                PAID ⚜️
                              </div>
                            </div>

                            {/* Cancellation Button */}
                            {(order.status === 'pending' || order.status === 'confirmed') && (!order.cancellationStatus || order.cancellationStatus === 'none' || order.cancellationStatus === 'rejected') && (
                              <button
                                onClick={() => setOrderToCancel(order.id)}
                                className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all font-black text-xs"
                              >
                                <Trash2 size={18} />
                                طلب حذف الطلب 🗑️
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          jewelryRequests.length === 0 ? (
            <div className="text-center mt-32 space-y-6">
              <div className="w-24 h-24 bg-white/5 rounded-[40px] flex items-center justify-center mx-auto text-gray-800 border border-white/5">
                <Gem size={48} strokeWidth={1} />
              </div>
              <div>
                <p className="text-white text-xl font-black mb-2">لا توجد طلبات تفصيل</p>
                <p className="text-gray-500 text-sm">صمم قطعة مجوهراتك الخاصة الآن عبر الشاشة الرئيسية ⚜️</p>
              </div>
              <button 
                onClick={onBack}
                className="px-8 py-4 bg-[#D4AF37] text-black font-black rounded-2xl shadow-xl active:scale-95 transition-all"
              >
                اطلب الآن
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {jewelryRequests.map((req, index) => (
                <motion.div
                  key={`jewelry-req-${req.id}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-[35px] p-6 space-y-4 shadow-xl"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-500 font-mono tracking-tighter">#{req.id.slice(-8).toUpperCase()}</p>
                      <span className={cn(
                        "inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase border",
                        req.status === 'pending' ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
                        req.status === 'reviewed' ? "bg-blue-500/10 text-blue-500 border-blue-500/30" :
                        req.status === 'quoted' ? "bg-purple-500/10 text-purple-500 border-purple-500/30" :
                        req.status === 'accepted' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" :
                        req.status === 'completed' ? "bg-emerald-600 text-black border-emerald-600" :
                        "bg-red-500/10 text-red-500 border-red-500/30"
                      )}>
                        {req.status === 'pending' ? 'بانتظار المراجعة' :
                         req.status === 'reviewed' ? 'تمت المراجعة' :
                         req.status === 'quoted' ? 'تم تقديم عرض سعر' :
                         req.status === 'accepted' ? 'تم القبول' :
                         req.status === 'completed' ? 'مكتمل' : 'مرفوض'}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-gray-500 font-bold">تاريخ الطلب</p>
                      <p className="text-[10px] text-white font-mono">{new Date(req.createdAt).toLocaleDateString('ar-SY')}</p>
                    </div>
                  </div>

                  <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-[#D4AF37] font-black mb-2 uppercase tracking-widest flex items-center gap-2">
                       <History size={12} />
                       وصف التصميم الخاص بك:
                    </p>
                    <p className="text-sm text-gray-300 leading-relaxed font-bold">{req.description}</p>
                  </div>

                  {req.quotedPrice && (
                    <div className="bg-[#D4AF37]/5 p-5 rounded-2xl border border-[#D4AF37]/20 space-y-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-widest mb-1">السعر المقدر للطلب ⚜️</p>
                          <p className="text-2xl font-black text-white">{req.quotedPrice}</p>
                        </div>
                        <Gem className="text-[#D4AF37] opacity-20" size={40} />
                      </div>
                      
                      {req.status === 'quoted' && (
                        <button 
                          onClick={async () => {
                            if(confirm("هل أنت متأكد من قبول عرض السعر وبدء التنفيذ؟ سنقوم بالتواصل معك قريباً لتأكيد الموعد ⚜️")) {
                              try {
                                await updateDoc(doc(db, 'custom_jewelry_requests', req.id), { status: 'accepted' });
                                alert("تم قبول عرض السعر! سنبدأ العمل فوراً ⚜️");
                              } catch (err) {
                                console.error("Error accepting quote:", err);
                              }
                            }
                          }}
                          className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={18} />
                          قبول السعر وبدء التنفيذ
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )
        )}

        {/* Cancellation Confirmation Modal */}
        <AnimatePresence>
          {orderToCancel && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !isCancelling && setOrderToCancel(null)}
                className="absolute inset-0 bg-black/90 backdrop-blur-xl" 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-[#111] border border-[#D4AF37]/30 rounded-[40px] p-8 w-full max-w-md relative z-10 text-center space-y-6"
              >
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
                  <Trash2 size={40} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white mb-2">تأكيد طلب الحذف؟ ⚜️</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    هل أنت متأكد من رغبتك في طلب إلغاء هذا الطلب؟ سيتم إرسال الطلب للإدارة للمراجعة والموافقة.
                  </p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => !isCancelling && setOrderToCancel(null)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-gray-400 font-bold hover:bg-white/10 transition-all"
                  >
                    تراجع
                  </button>
                  <button 
                    disabled={isCancelling}
                    onClick={() => orderToCancel && requestCancellation(orderToCancel)}
                    className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-black hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                  >
                    {isCancelling ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        نعم، حذف
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
