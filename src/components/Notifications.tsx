import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  Bell, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Inbox,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';

interface Notification {
  id: string;
  orderId: string;
  message: string;
  status: string;
  type?: 'PAYMENT_PENDING' | 'ORDER_SUCCESS' | string;
  createdAt: string;
  read: boolean;
  userId: string;
}

interface NotificationsProps {
  onBack: () => void;
}

export default function Notifications({ onBack }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderToCancel, setOrderToCancel] = useState<{ notifId: string, orderId: string } | null>(null);
  const [orderToPay, setOrderToPay] = useState<{ notifId: string, orderId: string } | null>(null);
  const [tempTransactionId, setTempTransactionId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      
      // Client-side sorting to avoid index errors
      const sortedNotifs = notifs.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      
      setNotifications(sortedNotifs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notifications:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const handleRequestCancellation = async () => {
    if (!orderToCancel) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'orders', orderToCancel.orderId), {
        cancellationStatus: 'pending'
      });
      await deleteNotification(orderToCancel.notifId);
      alert("تم إرسال طلب الحذف للإدارة بنجاح ⚜️");
      setOrderToCancel(null);
    } catch (err) {
      console.error("Error requesting cancellation from notif:", err);
      alert("حدث خطأ أثناء معالجة الطلب.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateTransaction = async () => {
    if (!orderToPay || !tempTransactionId) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'orders', orderToPay.orderId), {
        transactionId: tempTransactionId
      });
      await updateDoc(doc(db, 'notifications', orderToPay.notifId), {
        message: 'تم تحديث رقم التحويل ⚜️ جاري المراجعة الآن.',
        type: 'ORDER_SUCCESS',
        read: true
      });
      alert("تم تحديث معلومات الدفع بنجاح ⚜️");
      setOrderToPay(null);
      setTempTransactionId("");
    } catch (err) {
      console.error("Error updating transaction from notif:", err);
      alert("حدث خطأ أثناء تحديث معلومات الدفع.");
    } finally {
      setIsProcessing(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), {
        read: true
      });
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "confirmed" || status === "تمت الموافقة") return "text-emerald-500";
    if (status === "rejected" || status === "تم الرفض") return "text-red-500";
    if (status === "shipping") return "text-blue-500";
    return "text-[#D4AF37]";
  };

  const getStatusIcon = (status: string) => {
    if (status === "confirmed" || status === "تمت الموافقة") return <CheckCircle2 size={18} className="text-emerald-500" />;
    if (status === "rejected" || status === "تم الرفض") return <XCircle size={18} className="text-red-500" />;
    return <Clock size={18} className="text-[#D4AF37]" />;
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-[#333] px-6 py-4 flex justify-between items-center">
        <button onClick={onBack} className="text-[#D4AF37] hover:scale-110 transition-transform">
          <ChevronRight size={28} />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-[#D4AF37] font-bold text-xl">التنبيهات</h1>
          <Sparkles size={16} className="text-[#D4AF37] animate-pulse" />
        </div>
        <div className="w-7" />
      </header>

      <div className="max-w-2xl mx-auto px-4 mt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center mt-20 space-y-4">
            <div className="w-12 h-12 border-4 border-[#D4AF37]/20 border-t-[#D4AF37] rounded-full animate-spin" />
            <p className="text-gray-500">جاري تحميل تنبيهات AURUM...</p>
          </div>
        ) : notifications.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-20 space-y-6"
          >
            <div className="w-24 h-24 bg-[#111] rounded-full flex items-center justify-center mx-auto border border-[#222]">
              <Inbox size={48} className="text-gray-700" />
            </div>
            <p className="text-gray-500 text-lg">صندوق التنبيهات فارغ حالياً</p>
            <button 
              onClick={onBack}
              className="text-[#D4AF37] font-bold hover:underline"
            >
              العودة للتسوق ⚜️
            </button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {notifications.map((notif, index) => (
                <motion.div
                  key={`notif-${notif.id}`}
                  layout
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "bg-[#0a0a0a] border border-[#222] rounded-2xl p-5 relative group overflow-hidden",
                    !notif.read && "border-[#D4AF37]/30 bg-[#D4AF37]/5"
                  )}
                >
                  {/* Unread indicator */}
                  {!notif.read && (
                    <div className="absolute top-0 right-0 w-1 h-full bg-[#D4AF37]" />
                  )}

                  <div 
                    className="flex justify-between items-start mb-4 cursor-pointer"
                    onClick={() => {
                      if (notif.type === 'PAYMENT_PENDING') {
                        setOrderToPay({ notifId: notif.id, orderId: notif.orderId });
                      } else if (!notif.read) {
                        markAsRead(notif.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 bg-black rounded-lg border border-[#333]",
                        notif.type === 'PAYMENT_PENDING' && "border-amber-500/50 bg-amber-500/10"
                      )}>
                        <Bell size={20} className={cn("text-[#D4AF37]", notif.type === 'PAYMENT_PENDING' && "text-amber-500")} />
                      </div>
                      <div>
                        <h4 className={cn(
                          "font-bold text-white",
                          notif.type === 'PAYMENT_PENDING' && "text-amber-500"
                        )}>{notif.message || 'تحديث حالة الطلب'}</h4>
                        <p className="text-xs text-gray-500">طلب # {notif.orderId?.slice(-6).toUpperCase()}</p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (notif.orderId && (notif.status === 'pending' || notif.status === 'confirmed')) {
                          setOrderToCancel({ notifId: notif.id, orderId: notif.orderId });
                        } else {
                          deleteNotification(notif.id);
                        }
                      }}
                      className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* Payment Pending Action Hint */}
                  {notif.type === 'PAYMENT_PENDING' && (
                    <div className="mb-4 mr-10 p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                      <p className="text-[10px] text-amber-500 font-bold">⚜️ انقر هنا لإضافة رقم عملية التحويل الآن</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(notif.status)}
                      <span className={cn("font-bold text-sm", getStatusColor(notif.status))}>
                        {notif.status === 'pending' && 'قيد المراجعة'}
                        {notif.status === 'confirmed' && 'تم التأكيد'}
                        {notif.status === 'shipping' && 'قيد التوصيل'}
                        {notif.status === 'delivered' && 'تم التوصيل'}
                        {notif.status === 'rejected' && 'تم الرفض'}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-600">
                      {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '---'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Cancellation Confirmation Modal */}
      <AnimatePresence>
        {orderToCancel && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isProcessing && setOrderToCancel(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#0a0a0a] border border-red-500/30 rounded-[45px] p-8 w-full max-w-[320px] relative z-10 text-center shadow-[0_25px_100px_rgba(239,68,68,0.2)]"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500 border border-red-500/20 mb-6">
                <Trash2 size={32} />
              </div>
              <div className="mb-10 text-right" dir="rtl">
                <h3 className="text-xl font-black text-white mb-2 text-center">تأكيد طلب الإلغاء؟ ⚜️</h3>
                <p className="text-gray-500 text-[11px] font-bold leading-relaxed px-2 text-center">
                  هل أنت متأكد من رغبتك في حذف هذا الطلب؟ سيتم إرساله للإدارة للموافقة عليه ولا يمكن التراجع.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  disabled={isProcessing}
                  onClick={handleRequestCancellation}
                  className="w-full py-4 rounded-2xl bg-red-500 text-white font-black hover:bg-red-600 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      نعم، المتابعة بالحذف
                    </>
                  )}
                </button>
                <button 
                  onClick={() => !isProcessing && setOrderToCancel(null)}
                  className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-gray-400 font-bold hover:bg-white/10 transition-all text-sm"
                >
                  إلغاء التراجع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Update Modal */}
      <AnimatePresence>
        {orderToPay && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isProcessing && setOrderToPay(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#0a0a0a] border border-[#D4AF37]/30 rounded-[45px] p-8 w-full max-w-[320px] relative z-10 text-center shadow-[0_25px_100px_rgba(212,175,55,0.1)]"
            >
              <div className="w-20 h-20 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto text-[#D4AF37] border border-[#D4AF37]/20 mb-6">
                <CheckCircle2 size={32} />
              </div>
              <div className="mb-10 text-right" dir="rtl">
                <h3 className="text-xl font-black text-white mb-2 text-center">تأكيد عملية التحويل ⚜️</h3>
                <p className="text-gray-500 text-[11px] font-bold leading-relaxed px-2 text-center mb-6">
                  يرجى لصق رقم عملية التحويل التي قمت بها لإتمام تثبيت طلبك في AURUM.
                </p>
                <input 
                  type="text"
                  placeholder="رقم العملية (مثلاً: 123456789)"
                  value={tempTransactionId}
                  onChange={(e) => setTempTransactionId(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-2xl p-5 text-[#D4AF37] font-bold text-center focus:border-[#D4AF37] transition-all"
                />
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  disabled={isProcessing || !tempTransactionId}
                  onClick={handleUpdateTransaction}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-black hover:opacity-90 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      تثبيت رقم التحويل ⚜️
                    </>
                  )}
                </button>
                <button 
                  onClick={() => !isProcessing && setOrderToPay(null)}
                  className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-gray-400 font-bold hover:bg-white/10 transition-all text-sm"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
