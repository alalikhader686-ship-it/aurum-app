import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Lock, 
  Chrome, 
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  User,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInAnonymously,
  sendEmailVerification
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onNavigateToRegister, onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  useEffect(() => {
    // Clear error 
    setError(null);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    setError(null);
    setUnverifiedEmail(null);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      if (!user.emailVerified) {
        // Optional: show a warning but don't block? 
        // User explicitly asked "why doesn't it let me login" so we should allow it.
        console.log("User email not verified, but allowing login as requested.");
      }

      setSuccess(true);
      setTimeout(() => {
        onLoginSuccess();
      }, 2000);
    } catch (err: unknown) {
      console.error("Login error:", err);
      const error = err as { code?: string };
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setError("خطأ في البيانات. يرجى التأكد من البريد الإلكتروني وكلمة المرور.");
      } else {
        setError("حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة لاحقاً.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
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

      setSuccess(true);
      setTimeout(() => {
        onLoginSuccess();
      }, 2000);
    } catch (err: unknown) {
      console.error("Google login error:", err);
      const fbError = err as { code?: string };
      if (fbError.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        setError(`⚠️ النطاق (${domain}) غير مصرح به. يرجى إضافته يدوياً في إعدادات Firebase 프로젝트 (Authentication -> Settings -> Authorized domains) ليتمكن التطبيق من تسجيل دخولك.`);
      } else if (fbError.code === 'auth/popup-closed-by-user') {
        setError("تم إغلاق نافذة تسجيل الدخول. نصيحة: إذا كنت تواجه مشكلة في تسجيل الدخول داخل المعاينة، جرب فتح التطبيق في علامة تبويب جديدة عبر الأيقونة في الزاوية العلوية اليمنى.");
      } else {
        setError("فشل تسجيل الدخول عبر Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("DEBUG: Attempting Anonymous Login...");
      const result = await signInAnonymously(auth);
      const user = result.user;
      console.log("DEBUG: Anonymous Login Success:", user.uid);

      try {
        await setDoc(doc(db, 'users', user.uid), {
          email: `guest_${user.uid.slice(0,5)}@aurum.com`,
          role: 'customer',
          isVIP: false,
          isGuest: true,
          createdAt: new Date().toISOString()
        }, { merge: true });
        console.log("DEBUG: Guest profile created in Firestore");
      } catch (fsErr) {
        console.warn("DEBUG: Firestore profile creation failed (Rules?), but continuing...", fsErr);
      }

      setSuccess(true);
      setTimeout(() => {
        onLoginSuccess();
      }, 1500);
    } catch (err: unknown) {
      console.error("Guest login error details:", err);
      const fbError = err as { code?: string; message?: string };
      
      if (fbError.code === 'auth/admin-restricted-operation') {
        setError("⚠️ ميزة 'الدخول كضيف' غير مفعلة تقنياً. يرجى التأكد من تفعيل Anonymous Sign-in في Firebase Console.");
      } else if (fbError.code === 'auth/operation-not-allowed') {
        setError("⚠️ طريقة الدخول هذه غير مفعلة في إعدادات الفايربيس (Anonymous login).");
      } else if (fbError.code === 'auth/network-request-failed') {
        setError("⚠️ خطأ في الاتصال بالسيرفر. قد يكون بسبب Ad-Blocker أو VPN أو ضعف الإنترنت. نصيحة: إذا كنت تواجه مشكلة مستمرة في تسجيل الدخول، جرب فتح التطبيق في 'علامة تبويب جديدة' عبر الأيقونة في الزاوية العلوية اليمنى.");
      } else {
        setError(`فشل تسجيل الدخول: ${fbError.message || 'خطأ مجهول'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 selection:bg-[#D4AF37] selection:text-black relative overflow-hidden" dir="rtl">
      
      {/* Success Animation */}
      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ y: -500, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 1000, opacity: 0 }}
            transition={{ type: "spring", damping: 15, stiffness: 100 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl"
          >
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-32 h-32 bg-[#D4AF37] rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(212,175,55,0.5)]"
              >
                <User size={64} className="text-black" />
              </motion.div>
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5 }}
                className="absolute -top-4 -right-4"
              >
                <Sparkles size={40} className="text-[#D4AF37]" />
              </motion.div>
            </div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-3xl font-black text-[#D4AF37] mt-8 tracking-widest"
            >
              أهلاً بك في النخبة ⚜️
            </motion.h2>
          </motion.div>
        )}
      </AnimatePresence>

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
        initial={{ opacity: 0, scale: 0.9, rotateY: 30 }}
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
              <h1 className="text-6xl font-black text-[#D4AF37] tracking-[0.3em] mb-4 font-serif italic">AURUM</h1>
              <div className="h-px w-20 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto mb-4" />
              <p className="text-gray-400 text-sm font-medium tracking-wide">عالم من الفخامة والتميز ⚜️</p>
            </motion.div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col gap-3 text-red-500 text-xs"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle size={18} />
                  <span className="font-bold">{error}</span>
                </div>
                {unverifiedEmail && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (auth.currentUser) {
                        try {
                          await sendEmailVerification(auth.currentUser);
                          setError("تم إرسال رابط التفعيل مجدداً بنجاح! ⚜️");
                        } catch {
                          setError("فشل إعادة الإرسال. يرجى المحاولة لاحقاً.");
                        }
                      }
                    }}
                    className="text-[#D4AF37] font-black underline mt-2 text-right"
                  >
                    إعادة إرسال رابط التفعيل ⚜️
                  </button>
                )}
              </motion.div>
            )}
            
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.1
                  }
                }
              }}
              className="space-y-4"
            >
              <>
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, x: 20 },
                    visible: { opacity: 1, x: 0 }
                  }}
                  className="relative group"
                >
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D4AF37]">
                    <Mail size={18} />
                  </div>
                  <input 
                    type="email" 
                    placeholder="البريد الإلكتروني" 
                    className="w-full bg-black border border-[#222] rounded-2xl py-4 pr-12 pl-4 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </motion.div>

                <motion.div 
                  variants={{
                    hidden: { opacity: 0, x: 20 },
                    visible: { opacity: 1, x: 0 }
                  }}
                  className="relative group"
                >
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D4AF37]">
                    <Lock size={18} />
                  </div>
                  <input 
                    type="password" 
                    placeholder="كلمة المرور" 
                    className="w-full bg-black border border-[#222] rounded-2xl py-4 pr-12 pl-4 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </motion.div>
              </>
            </motion.div>

            <motion.button 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              type="submit"
              disabled={loading}
              className="w-full h-16 bg-[#D4AF37] text-black font-black rounded-[25px] flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(212,175,55,0.3)] active:scale-95 transition-all hover:bg-[#B8860B] relative overflow-hidden group"
            >
              <div className="absolute inset-0 gold-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
              {loading ? (
                <Loader2 className="animate-spin" size={28} />
              ) : (
                <>
                  <span className="relative z-10">تسجيل الدخول الملكي ⚜️</span>
                  <Sparkles size={20} className="relative z-10" />
                </>
              )}
            </motion.button>
          </form>

          <div className="flex items-center gap-4 my-8">
            <div className="h-px flex-1 bg-[#222]" />
            <span className="text-gray-600 text-[10px] uppercase tracking-widest font-bold">أو سجل عبر</span>
            <div className="h-px flex-1 bg-[#222]" />
          </div>

          <div className="flex flex-col gap-4">
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-14 bg-[#0a0a0a] border border-[#222] text-white font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-[#111] transition-all active:scale-95"
            >
              <Chrome size={20} />
              <span className="text-xs">تسجيل الدخول عبر Google</span>
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button 
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full h-16 bg-white/[0.02] border border-[#D4AF37]/10 text-gray-400 font-medium rounded-2xl flex items-center justify-center gap-3 hover:bg-[#D4AF37]/5 hover:text-[#D4AF37] transition-all group"
            >
              <div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Compass size={16} className="text-[#D4AF37]" />
              </div>
              <span className="text-sm">تصفح AURUM كزائر</span>
            </button>
          </div>

          <div className="mt-12 text-center">
            <button 
              onClick={onNavigateToRegister}
              className="text-gray-500 hover:text-[#D4AF37] font-bold flex items-center justify-center gap-3 mx-auto transition-colors group"
            >
              <span className="text-sm">ليس لديك حساب؟ انضم إلى النخبة</span>
              <ArrowRight size={18} className="group-hover:translate-x-[-5px] transition-transform" />
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
