import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, Download, X, Zap, ShieldCheck, Sparkles } from 'lucide-react';

const APK_URL = "https://github.com/alalikhader686-ship-it/aurum-app/releases/download/v1.0.0/AURUM.apk";

export default function ApkDownloadBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    // Show banner after 1.5 seconds if user hasn't dismissed it in current session
    const dismissed = sessionStorage.getItem('aurum_apk_dismissed');
    if (!dismissed) {
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    } else {
      setIsMinimized(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    setIsMinimized(true);
    sessionStorage.setItem('aurum_apk_dismissed', 'true');
  };

  return (
    <>
      {/* Minimized floating button if closed or dismissed */}
      {isMinimized && !isOpen && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="fixed bottom-20 left-4 z-[999] dir-rtl"
        >
          <a
            href={APK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-black px-4 py-2.5 rounded-full font-black text-xs shadow-[0_10px_30px_rgba(212,175,55,0.4)] border border-yellow-200/50 hover:scale-105 active:scale-95 transition-all"
          >
            <Smartphone size={16} className="animate-bounce" />
            <span>تنزيل التطبيق APK 📱</span>
          </a>
        </motion.div>
      )}

      {/* Main Download Popup Modal / Bottom Sheet */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 dir-rtl">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleDismiss}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div 
              initial={{ y: 100, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 100, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative bg-gradient-to-b from-[#161616] via-[#0a0a0a] to-black border border-[#D4AF37]/40 rounded-[35px] p-6 sm:p-8 w-full max-w-md shadow-[0_20px_80px_rgba(212,175,55,0.25)] text-right space-y-5 overflow-hidden"
            >
              {/* Gold Top Light Effect */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-[#D4AF37]/20 rounded-full blur-2xl pointer-events-none" />

              {/* Close Button */}
              <button 
                onClick={handleDismiss}
                className="absolute top-5 left-5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-all"
              >
                <X size={18} />
              </button>

              {/* Header Icon */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#8A6508] p-0.5 shadow-lg shadow-[#D4AF37]/30 flex-shrink-0">
                  <div className="w-full h-full bg-black rounded-[14px] flex items-center justify-center text-[#D4AF37]">
                    <Smartphone size={32} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-[#D4AF37] font-black text-[10px] tracking-widest uppercase">
                    <Sparkles size={12} />
                    <span>AURUM MOBILE APP</span>
                  </div>
                  <h3 className="text-xl font-black text-white mt-0.5">
                    تطبيق AURUM الأسرع والأفضل! ⚜️
                  </h3>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-gray-300 leading-relaxed font-bold">
                احصل على تجربة تسوق أسرع وأسلس مع إشعارات فورية وتصفح بدون انقطاع عبر تنزيل تطبيق أندرويد الرسمي (APK).
              </p>

              {/* Features badges */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-2.5 rounded-xl text-gray-300">
                  <Zap size={14} className="text-[#D4AF37]" />
                  <span>سرعة فائقة بالأداء</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-2.5 rounded-xl text-gray-300">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>آمن ومباشر 100%</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <a
                  href={APK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsOpen(false)}
                  className="w-full bg-gradient-to-r from-[#D4AF37] via-[#f3e5ab] to-[#D4AF37] hover:brightness-110 text-black py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 shadow-[0_10px_30px_rgba(212,175,55,0.3)] transition-all active:scale-95"
                >
                  <Download size={20} className="animate-bounce" />
                  <span>تحميل التطبيق الآن (APK - v1.0.0) 🚀</span>
                </a>

                <button
                  onClick={handleDismiss}
                  className="w-full py-3 text-xs text-gray-400 hover:text-white font-bold transition-all text-center"
                >
                  المتابعة عبر المتصفح
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
