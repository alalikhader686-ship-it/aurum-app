import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface ToastProps {
  message: string;
  isVisible?: boolean;
  visible?: boolean;
  type?: 'success' | 'error';
  onClose: () => void;
}

export default function Toast({ message, isVisible, visible, type = 'success', onClose }: ToastProps) {
  const show = isVisible || visible;

  React.useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, message, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          className="fixed inset-0 z-[1000] flex items-center justify-center p-6 pointer-events-none"
        >
          <div className={cn(
            "bg-black/90 backdrop-blur-2xl border rounded-[35px] p-6 max-w-[280px] w-full flex flex-col items-center text-center shadow-[0_40px_100px_rgba(0,0,0,1)] pointer-events-auto",
            type === 'success' ? "border-[#D4AF37]/50" : "border-red-500/50 shadow-[0_40px_100px_rgba(239,68,68,0.2)]"
          )}>
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center text-black mb-4 shadow-lg",
              type === 'success' 
                ? "bg-gradient-to-br from-[#D4AF37] to-[#B8860B] shadow-[0_10px_30px_rgba(212,175,55,0.4)]" 
                : "bg-red-500 shadow-[0_10px_30px_rgba(239,68,68,0.4)]"
            )}>
              <CheckCircle2 size={32} />
            </div>
            <p className="text-white font-black text-sm mb-1 leading-relaxed">{message}</p>
            <p className={cn(
              "text-[10px] font-black uppercase tracking-[0.2em] opacity-80",
              type === 'success' ? "text-[#D4AF37]" : "text-red-500"
            )}>
              {type === 'success' ? 'تم تنفيذ طلبك بنجاح ⚜️' : 'حدث خطأ في طلبك ⚠️'}
            </p>
            
            <div className="mt-4 flex gap-1">
              <Sparkles size={12} className={cn("animate-pulse", type === 'success' ? "text-[#D4AF37]" : "text-red-500")} />
              <div className={cn("w-12 h-px self-center", type === 'success' ? "bg-[#D4AF37]/30" : "bg-red-500/30")} />
              <Sparkles size={12} className={cn("animate-pulse", type === 'success' ? "text-[#D4AF37]" : "text-red-500")} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
