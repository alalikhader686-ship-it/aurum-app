import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Lock, 
  ShieldCheck, 
  Chrome, 
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  sendEmailVerification
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
  onRegisterSuccess: () => void;
}

export default function RegisterScreen({ onNavigateToLogin, onRegisterSuccess }: RegisterScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !confirmPassword) {
      setError("تنبيه ⚜️: يرجى ملء كافة الحقول");
      return;
    }

    if (password !== confirmPassword) {
      setError("خطأ ⚠️: كلمات المرور غير متطابقة");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // OPTIONAL: Send verification email in background without blocking
      sendEmailVerification(user).catch(err => console.error("Verification email failed:", err));

      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        role: 'customer',
        isVIP: false,
        createdAt: new Date().toISOString()
      });

      onRegisterSuccess();
    } catch (err: unknown) {
      console.error("Register error:", err);
      const error = err as { code?: string };
      if (error.code === 'auth/email-already-in-use') {
        setError("⚠️ هذا البريد الإلكتروني مسجل مسبقاً. يرجى تسجيل الدخول أو استخدام بريد آخر.");
      } else if (error.code === 'auth/weak-password') {
        setError("⚠️ كلمة المرور ضعيفة جداً. يرجى اختيار كلمة مرور أقوى.");
      } else if (error.code === 'auth/invalid-email') {
        setError("⚠️ البريد الإلكتروني غير صالح.");
      } else {
        setError("حدث خطأ أثناء إنشاء الحساب الفاخر.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        role: 'customer',
        isVIP: false,
        createdAt: new Date().toISOString()
      }, { merge: true });

      onRegisterSuccess();
    } catch (err: unknown) {
      console.error("Google register error:", err);
      const fbError = err as { code?: string };
      if (fbError.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        setError(`⚠️ النطاق الرئيسي (${domain}) غير مصرح به. يرجى إضافته في Authorized domains داخل إعدادات مشروع Firebase (Authentication -> Settings -> Authorized domains).`);
      } else if (fbError.code === 'auth/popup-closed-by-user') {
        setError("تم إغلاق نافذة التسجيل.");
      } else {
        setError("فشل التسجيل عبر Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 selection:bg-[#D4AF37] selection:text-black relative overflow-hidden" dir="rtl">
      
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-[#D4AF37]/10 blur-[150px] rounded-full" 
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.05, 0.15, 0.05],
            rotate: [0, -90, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-[#D4AF37]/5 blur-[150px] rounded-full" 
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, rotateY: -30 }}
        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass-morphism rounded-[50px] p-10 md:p-12 shadow-[0_50px_100px_rgba(0,0,0,0.8)] border-[#D4AF37]/20">
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h1 className="text-6xl font-black text-[#D4AF37] tracking-[0.3em] mb-4 font-serif italic uppercase leading-none">AURUM</h1>
              <div className="h-px w-20 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto mb-4" />
              <p className="text-gray-400 text-sm font-medium tracking-wide">عالم من الفخامة والتميز ⚜️</p>
            </motion.div>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2 text-red-500 text-xs"
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </motion.div>
            )}

            <>
              {/* Email Input */}
              <div className="relative group">
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D4AF37] group-focus-within:scale-110 transition-transform">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  placeholder="البريد الإلكتروني" 
                  className="w-full bg-black border border-[#222] rounded-2xl py-4 pr-12 pl-4 text-white focus:outline-none focus:border-[#D4AF37] transition-all placeholder:text-gray-700"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Password Input */}
              <div className="relative group">
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D4AF37] group-focus-within:scale-110 transition-transform">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  placeholder="كلمة المرور" 
                  className="w-full bg-black border border-[#222] rounded-2xl py-4 pr-12 pl-4 text-white focus:outline-none focus:border-[#D4AF37] transition-all placeholder:text-gray-700"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {/* Confirm Password Input */}
              <div className="relative group">
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D4AF37] group-focus-within:scale-110 transition-transform">
                  <ShieldCheck size={18} />
                </div>
                <input 
                  type="password" 
                  placeholder="تأكيد كلمة المرور" 
                  className="w-full bg-black border border-[#222] rounded-2xl py-4 pr-12 pl-4 text-white focus:outline-none focus:border-[#D4AF37] transition-all placeholder:text-gray-700"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-black rounded-2xl flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(212,175,55,0.3)] active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <>
                  <span>إنشاء حساب ⚜️</span>
                  <Sparkles size={18} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="h-px flex-1 bg-[#222]" />
            <span className="text-gray-600 text-[10px] uppercase tracking-widest font-bold">أو سجل عبر</span>
            <div className="h-px flex-1 bg-[#222]" />
          </div>

          {/* Auth Buttons */}
          <div className="flex flex-col gap-4">
            <button 
              onClick={handleGoogleRegister}
              disabled={loading}
              className="w-full h-14 bg-[#0a0a0a] border border-[#222] text-white font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-[#111] transition-all active:scale-95"
            >
              <Chrome size={20} />
              <span className="text-xs">تسجيل الدخول عبر Google</span>
            </button>
          </div>

          {/* Login Link */}
          <div className="mt-10 text-center">
            <button 
              onClick={onNavigateToLogin}
              className="text-[#D4AF37] font-bold flex items-center justify-center gap-2 mx-auto group"
            >
              <span>لديك حساب؟ سجل دخول</span>
              <ArrowRight size={16} className="group-hover:translate-x-[-4px] transition-transform" />
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
