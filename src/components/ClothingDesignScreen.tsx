import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  Scissors, 
  Shirt, 
  Upload, 
  MessageSquare, 
  Phone, 
  CheckCircle2, 
  X,
  Sparkles,
  Palette
} from 'lucide-react';
import { cn } from '../lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface ClothingDesignScreenProps {
  onBack: () => void;
}

export default function ClothingDesignScreen({ onBack }: ClothingDesignScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [idea, setIdea] = useState('');
  const [fabricType, setFabricType] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("يرجى تسجيل الدخول لتقديم طلب تصميم ⚜️");
      return;
    }

    if (!phoneNumber || !idea) {
      alert("يرجى إكمال الحقول المطلوبة (رقم الهاتف وفكرة التصميم) ⚜️");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create request object
      const requestData = {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email || 'anonymous',
        userName: auth.currentUser.displayName || 'Guest',
        phone: phoneNumber,
        idea: idea,
        fabricType: fabricType || 'غير محدد',
        imageUrl: imagePreview || null, // In a real app, upload to storage first
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'clothing_design_requests'), requestData);
      setIsSuccess(true);
    } catch (error) {
      console.error("Error submitting design request:", error);
      handleFirestoreError(error, OperationType.WRITE, 'clothing_design_requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <button 
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <ChevronRight size={24} className="text-gray-400" />
        </button>
        <div className="text-center">
          <h1 className="text-lg font-black tracking-tight flex items-center gap-2 justify-center">
            <Shirt className="text-[#D4AF37]" size={20} />
            تصميم الملابس الحصري
          </h1>
          <p className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-[0.2em]">Clothing Design Atelier ⚜️</p>
        </div>
        <div className="w-10" />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-[#D4AF37] to-[#B8860B] rounded-[30px] flex items-center justify-center mx-auto mb-4 rotate-3 shadow-[0_20px_40px_rgba(212,175,55,0.2)]">
                  <Scissors className="text-black" size={32} />
                </div>
                <h2 className="text-2xl font-serif italic mb-2">حول خيالك <span className="text-gold">إلى واقع</span></h2>
                <p className="text-gray-500 text-sm">قدم فكرتك الخاصة، وسيقوم خبراؤنا بتنفيذها لك بأعلى معايير الجودة ⚜️</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Phone Number */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Phone size={14} className="text-[#D4AF37]" />
                    رقم الهاتف للتواصل
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="مثال: 0912345678"
                    dir="rtl"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                    required
                  />
                </div>

                {/* Design Idea */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={14} className="text-[#D4AF37]" />
                    اشرح لنا فكرة التصميم
                  </label>
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="صف لنا القطعة التي ترغب بتصميمها، الألوان، التفاصيل، وأي ميزة خاصة..."
                    dir="rtl"
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#D4AF37]/50 transition-colors resize-none"
                    required
                  />
                </div>

                {/* Fabric Type */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Palette size={14} className="text-[#D4AF37]" />
                    نوع القماش المفضل (اختياري)
                  </label>
                  <input
                    type="text"
                    value={fabricType}
                    onChange={(e) => setFabricType(e.target.value)}
                    placeholder="مثال: قطن، حرير، صوف..."
                    dir="rtl"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                  />
                </div>

                {/* Image Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Upload size={14} className="text-[#D4AF37]" />
                    أرفق صورة للفكرة (اختياري)
                  </label>
                  
                  <div className="relative group">
                    <input
                      type="file"
                      id="design-image"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    
                    {!imagePreview ? (
                      <label 
                        htmlFor="design-image"
                        className="cursor-pointer block w-full aspect-video bg-white/5 border-2 border-dashed border-white/10 rounded-[30px] flex flex-col items-center justify-center gap-3 group-hover:bg-white/10 group-hover:border-[#D4AF37]/30 transition-all"
                      >
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-[#D4AF37] group-hover:scale-110 transition-all">
                          <Upload size={24} />
                        </div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">اختر صورة أو ارسم فكرتك</p>
                      </label>
                    ) : (
                      <div className="relative aspect-video rounded-[30px] overflow-hidden border border-white/10">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            setImagePreview(null);
                          }}
                          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center hover:bg-red-500/80 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Card */}
                <div className="bg-gradient-to-br from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/20 rounded-3xl p-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-[#D4AF37]/20 rounded-xl flex items-center justify-center text-[#D4AF37] shrink-0">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#D4AF37] mb-1">ماذا يحدث بعد التقديم؟</h4>
                      <p className="text-gray-400 text-xs leading-relaxed">سيقوم فريق التصميم بمراجعة فكرتك والتواصل معك عبر الواتساب لمناقشة التفاصيل وتحديد السعر النهائي وموعد التوصيل.</p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    "w-full py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3",
                    isSubmitting 
                      ? "bg-gray-800 text-gray-500 cursor-not-allowed" 
                      : "bg-[#D4AF37] text-black shadow-[0_20px_40px_rgba(212,175,55,0.2)] hover:scale-[1.02] hover:bg-[#B8860B]"
                  )}
                >
                  {isSubmitting ? "جاري التقديم..." : "تقديم الفكرة ⚜️"}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20"
            >
              <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                <CheckCircle2 size={48} />
              </div>
              <h2 className="text-3xl font-serif italic mb-4">تم استلام فكرتك <br/><span className="text-green-500">بنجاح ⚜️</span></h2>
              <p className="text-gray-500 text-sm max-w-sm mx-auto mb-10 leading-relaxed">
                شكراً لثقتك بـ AURUM. سيقوم فريقنا بمراجعة طلبك والتواصل معك قريباً عبر رقم الهاتف المقدم.
              </p>
              <button
                onClick={onBack}
                className="bg-white/5 border border-white/10 px-10 py-4 rounded-xl font-bold text-sm hover:bg-white/10 transition-colors"
              >
                العودة للرئيسية
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
