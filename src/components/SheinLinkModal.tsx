import React, { useState } from 'react';
import { X, Link as LinkIcon, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface SheinLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SheinLinkModal({ isOpen, onClose }: SheinLinkModalProps) {
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("يرجى تسجيل الدخول أولاً لإرسال طلبك ⚜️");
      return;
    }

    if (!link.includes('shein.com')) {
      alert("يرجى التأكد من أن الرابط من موقع شي إن العالمي ⚜️");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'shein_links'), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        userName: auth.currentUser.displayName,
        link,
        notes,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setLink('');
        setNotes('');
        onClose();
      }, 3000);
    } catch (error) {
      console.error("Error submitting shein link:", error);
      alert("حدث خطأ أثناء إرسال الطلب. يرجى المحاولة لاحقاً.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/95 backdrop-blur-xl"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-[#0a0a0a] border border-[#D4AF37]/30 rounded-[40px] w-full max-w-[340px] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
          >
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-[#D4AF37] font-black text-xl flex items-center gap-2">
                <LinkIcon size={20} />
                طلب خاص من شي إن ⚜️
              </h3>
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {success ? (
                <div className="text-center py-10 space-y-4">
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mx-auto">
                    <CheckCircle2 size={40} />
                  </div>
                  <h4 className="text-white text-xl font-bold">تم إرسال طلبك بنجاح!</h4>
                  <p className="text-gray-400 text-sm">سيقوم فريق العمل بمراجعة الرابط والتواصل معك قريباً لتحديد السعر وتأكيد الطلب ⚜️</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex gap-3">
                    <AlertCircle className="text-amber-500 shrink-0" size={18} />
                    <p className="text-[10px] text-amber-500/80 font-bold leading-relaxed">
                      انسخ رابط أي منتج من تطبيق أو موقع شي إن العالمي، وسنقوم نحن بطلبه لك وتوصيله لباب منزلك بكل سهولة وأمان ⚜️
                    </p>
                  </div>

                  <div className="space-y-2 text-right">
                    <label className="text-[#D4AF37] text-xs font-bold px-2">رابط المنتج (SHEIN URL):</label>
                    <input
                      required
                      type="url"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="https://ar.shein.com/..."
                      className="w-full bg-[#111] border border-white/5 rounded-2xl p-4 text-left text-sm focus:outline-none focus:border-[#D4AF37]/50 transition-all text-white"
                    />
                  </div>

                  <div className="space-y-2 text-right">
                    <label className="text-[#D4AF37] text-xs font-bold px-2">ملاحظات إضافية (القياس، اللون):</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="مثلاً: قياس M، لون أسود..."
                      className="w-full bg-[#111] border border-white/5 rounded-2xl p-4 text-right text-sm focus:outline-none focus:border-[#D4AF37]/50 transition-all text-white h-24 resize-none"
                    />
                  </div>

                  <button
                    disabled={loading}
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="animate-spin">⚜️</span>
                    ) : (
                      <>
                        <Send size={18} />
                        <span>إرسال الرابط للآدمن</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
