import React, { useEffect, useState } from 'react';
import {
  Mail,
  Lock,
  Chrome,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  User,
  Compass,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

import {
  auth,
  db,
} from '../lib/firebase';

import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInAnonymously,
  sendEmailVerification,
} from 'firebase/auth';

import { doc, setDoc } from 'firebase/firestore';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onLoginSuccess: () => void;
}

const GOOGLE_WEB_CLIENT_ID =
  '101782449543-dsdrh76sgt49ku3st8vhhpii5i77d71r.apps.googleusercontent.com';

export default function LoginScreen({
  onNavigateToRegister,
  onLoginSuccess,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  /*
   * Initialize native Google Sign-In only on Android/iOS.
   * Web keeps using Firebase signInWithPopup().
   */
  useEffect(() => {
    const initializeGoogleLogin = async () => {
      try {
        if (!Capacitor.isNativePlatform()) {
          console.log('AURUM: Web platform detected - native Google disabled.');
          return;
        }

        console.log('AURUM: Initializing native Google Sign-In...');

        await SocialLogin.initialize({
          google: {
            webClientId: GOOGLE_WEB_CLIENT_ID,
            provider: 'google',
          },
        });

        console.log('AURUM: Native Google Sign-In initialized successfully.');
      } catch (err) {
        console.error(
          'AURUM: Failed to initialize native Google Sign-In:',
          err
        );
      }
    };

    initializeGoogleLogin();
  }, []);

  useEffect(() => {
    setError(null);
  }, []);

  /*
   * Email / Password Login
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setLoading(true);
    setError(null);
    setUnverifiedEmail(null);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      if (!user.emailVerified) {
        console.log(
          'AURUM: User email is not verified, but login is allowed.'
        );
      }

      setSuccess(true);

      setTimeout(() => {
        onLoginSuccess();
      }, 2000);
    } catch (err: unknown) {
      console.error('AURUM: Login error:', err);

      const firebaseError = err as {
        code?: string;
        message?: string;
      };

      if (
        firebaseError.code === 'auth/invalid-credential' ||
        firebaseError.code === 'auth/user-not-found' ||
        firebaseError.code === 'auth/wrong-password'
      ) {
        setError(
          'خطأ في البيانات. يرجى التأكد من البريد الإلكتروني وكلمة المرور.'
        );
      } else if (firebaseError.code === 'auth/too-many-requests') {
        setError(
          'تمت محاولات تسجيل دخول كثيرة. يرجى الانتظار قليلاً ثم المحاولة مجدداً.'
        );
      } else {
        setError(
          'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة لاحقاً.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  /*
   * Save / update user profile in Firestore
   */
  const saveGoogleUser = async (
    uid: string,
    userEmail: string | null,
    displayName?: string | null,
    photoURL?: string | null
  ) => {
    await setDoc(
      doc(db, 'users', uid),
      {
        email: userEmail,
        displayName: displayName || '',
        photoURL: photoURL || '',
        role: 'customer',
        isVIP: false,
        isGuest: false,
        provider: 'google',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  };

  /*
   * Google Login
   *
   * Android/iOS:
   *   @capgo/capacitor-social-login
   *
   * Web:
   *   Firebase signInWithPopup
   */
  const handleGoogleLogin = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);
    setUnverifiedEmail(null);

    try {
      /*
       * NATIVE ANDROID / IOS
       */
      if (Capacitor.isNativePlatform()) {
        console.log('AURUM: Starting native Google login...');

        const result = await SocialLogin.login({
          provider: 'google',
        });

        console.log('AURUM: Native Google login result received.');

        const googleResult = result.result;

        const idToken =
          'idToken' in googleResult
            ? googleResult.idToken
            : null;

        if (!idToken) {
          throw new Error(
            'Google did not return an ID token.'
          );
        }

        console.log(
          'AURUM: Google ID token received. Connecting to Firebase...'
        );

        const credential =
          GoogleAuthProvider.credential(idToken);

        const userCredential = await signInWithCredential(
          auth,
          credential
        );

        const user = userCredential.user;

        console.log(
          'AURUM: Firebase Google authentication successful:',
          user.uid
        );

        try {
          await saveGoogleUser(
            user.uid,
            user.email,
            user.displayName,
            user.photoURL
          );

          console.log(
            'AURUM: Google user profile saved to Firestore.'
          );
        } catch (firestoreError) {
          console.warn(
            'AURUM: Firestore profile save failed, continuing login:',
            firestoreError
          );
        }

        setSuccess(true);

        setTimeout(() => {
          onLoginSuccess();
        }, 2000);

        return;
      }

      /*
       * WEB
       */
      console.log(
        'AURUM: Web platform detected. Using Firebase popup...'
      );

      const provider = new GoogleAuthProvider();

      provider.setCustomParameters({
        prompt: 'select_account',
      });

      const result = await signInWithPopup(
        auth,
        provider
      );

      const user = result.user;

      console.log(
        'AURUM: Web Google login successful:',
        user.uid
      );

      try {
        await saveGoogleUser(
          user.uid,
          user.email,
          user.displayName,
          user.photoURL
        );
      } catch (firestoreError) {
        console.warn(
          'AURUM: Firestore profile save failed, continuing login:',
          firestoreError
        );
      }

      setSuccess(true);

      setTimeout(() => {
        onLoginSuccess();
      }, 2000);
    } catch (err: unknown) {
      console.error(
        'AURUM: Google login error:',
        err
      );

      const firebaseError = err as {
        code?: string;
        message?: string;
      };

      /*
       * Native Google errors
       */
      if (
        firebaseError.message?.includes(
          'Developer console is not set up correctly'
        )
      ) {
        setError(
          '⚠️ إعداد Google غير مكتمل. تأكد من إضافة package name com.aurum.app وSHA-1 الخاص بالـAPK في Google Cloud Console.'
        );
      } else if (
        firebaseError.message?.includes(
          'No credentials available'
        )
      ) {
        setError(
          '⚠️ لم يتم العثور على حساب Google على الجهاز. أضف حساب Google إلى الجهاز ثم حاول مجدداً.'
        );
      } else if (
        firebaseError.code ===
        'auth/invalid-credential'
      ) {
        setError(
          '⚠️ بيانات Google غير صالحة. تأكد من إعداد OAuth Client IDs بشكل صحيح.'
        );
      }

      /*
       * Firebase Web errors
       */
      else if (
        firebaseError.code ===
        'auth/unauthorized-domain'
      ) {
        const domain = window.location.hostname;

        setError(
          `⚠️ النطاق (${domain}) غير مصرح به في Firebase. أضفه من Authentication → Settings → Authorized domains.`
        );
      } else if (
        firebaseError.code ===
        'auth/popup-closed-by-user'
      ) {
        setError(
          'تم إغلاق نافذة تسجيل الدخول. حاول مرة أخرى.'
        );
      } else if (
        firebaseError.code ===
        'auth/popup-blocked'
      ) {
        setError(
          '⚠️ المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة ثم حاول مجدداً.'
        );
      } else if (
        firebaseError.code ===
        'auth/network-request-failed'
      ) {
        setError(
          '⚠️ حدث خطأ في الاتصال بالسيرفر. تحقق من الإنترنت ثم حاول مجدداً.'
        );
      } else {
        setError(
          `فشل تسجيل الدخول عبر Google: ${
            firebaseError.message ||
            'خطأ غير معروف'
          }`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  /*
   * Guest Login
   */
  const handleGuestLogin = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      console.log(
        'AURUM: Attempting Anonymous Login...'
      );

      const result = await signInAnonymously(auth);
      const user = result.user;

      console.log(
        'AURUM: Anonymous Login Success:',
        user.uid
      );

      try {
        await setDoc(
          doc(db, 'users', user.uid),
          {
            email: `guest_${user.uid.slice(
              0,
              5
            )}@aurum.com`,
            role: 'customer',
            isVIP: false,
            isGuest: true,
            provider: 'anonymous',
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );

        console.log(
          'AURUM: Guest profile created in Firestore.'
        );
      } catch (firestoreError) {
        console.warn(
          'AURUM: Guest Firestore profile failed, continuing:',
          firestoreError
        );
      }

      setSuccess(true);

      setTimeout(() => {
        onLoginSuccess();
      }, 1500);
    } catch (err: unknown) {
      console.error(
        'AURUM: Guest login error:',
        err
      );

      const firebaseError = err as {
        code?: string;
        message?: string;
      };

      if (
        firebaseError.code ===
        'auth/admin-restricted-operation'
      ) {
        setError(
          "⚠️ ميزة 'الدخول كضيف' غير مفعلة. فعّل Anonymous Sign-in من Firebase Console."
        );
      } else if (
        firebaseError.code ===
        'auth/operation-not-allowed'
      ) {
        setError(
          '⚠️ Anonymous Login غير مفعّل في Firebase Authentication.'
        );
      } else if (
        firebaseError.code ===
        'auth/network-request-failed'
      ) {
        setError(
          '⚠️ خطأ في الاتصال بالسيرفر. تحقق من الإنترنت ثم حاول مجدداً.'
        );
      } else {
        setError(
          `فشل تسجيل الدخول: ${
            firebaseError.message ||
            'خطأ مجهول'
          }`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black relative overflow-hidden px-4 py-8">

      {/* Success Animation */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{
              y: -500,
              opacity: 0,
            }}
            animate={{
              y: 0,
              opacity: 1,
            }}
            exit={{
              y: 1000,
              opacity: 0,
            }}
            transition={{
              type: 'spring',
              damping: 15,
              stiffness: 100,
            }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl"
          >
            <div className="relative">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                }}
                className="w-32 h-32 bg-[#D4AF37] rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(212,175,55,0.5)]"
              >
                <User
                  size={64}
                  className="text-black"
                />
              </motion.div>

              <motion.div
                initial={{
                  scale: 0,
                }}
                animate={{
                  scale: 1,
                }}
                transition={{
                  delay: 0.5,
                }}
                className="absolute -top-4 -right-4"
              >
                <Sparkles
                  size={40}
                  className="text-[#D4AF37]"
                />
              </motion.div>
            </div>

            <motion.h2
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: 0.8,
              }}
              className="text-3xl font-black text-[#D4AF37] mt-8 tracking-widest"
            >
              أهلاً بك في النخبة ⚜️
            </motion.h2>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-[#D4AF37]/10 blur-[150px] rounded-full"
        />

        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.05, 0.15, 0.05],
            rotate: [0, -90, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-[#D4AF37]/5 blur-[150px] rounded-full"
        />
      </div>

      {/* Main Card */}
      <motion.div
        initial={{
          opacity: 0,
          scale: 0.9,
          rotateY: 30,
        }}
        animate={{
          opacity: 1,
          scale: 1,
          rotateY: 0,
        }}
        transition={{
          duration: 1,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass-morphism rounded-[50px] p-10 md:p-12 shadow-[0_50px_100px_rgba(0,0,0,0.8)] border border-[#D4AF37]/20">

          {/* Logo */}
          <div className="text-center mb-12">
            <motion.div
              initial={{
                opacity: 0,
                y: -20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: 0.5,
              }}
            >
              <h1 className="text-6xl font-black text-[#D4AF37] tracking-[0.3em] mb-4 font-serif italic">
                AURUM
              </h1>

              <div className="h-px w-20 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto mb-4" />

              <p className="text-gray-400 text-sm font-medium tracking-wide">
                عالم من الفخامة والتميز ⚜️
              </p>
            </motion.div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleLogin}
            className="space-y-6"
          >

            {/* Error */}
            {error && (
              <motion.div
                initial={{
                  opacity: 0,
                  x: 20,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col gap-3 text-red-500 text-xs"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle size={18} />
                  <span className="font-bold">
                    {error}
                  </span>
                </div>

                {unverifiedEmail && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (auth.currentUser) {
                        try {
                          await sendEmailVerification(
                            auth.currentUser
                          );

                          setError(
                            'تم إرسال رابط التفعيل مجدداً بنجاح! ⚜️'
                          );
                        } catch {
                          setError(
                            'فشل إعادة الإرسال. يرجى المحاولة لاحقاً.'
                          );
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

            {/* Inputs */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {
                  opacity: 0,
                },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.1,
                  },
                },
              }}
              className="space-y-4"
            >

              {/* Email */}
              <motion.div
                variants={{
                  hidden: {
                    opacity: 0,
                    x: 20,
                  },
                  visible: {
                    opacity: 1,
                    x: 0,
                  },
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
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                />
              </motion.div>

              {/* Password */}
              <motion.div
                variants={{
                  hidden: {
                    opacity: 0,
                    x: 20,
                  },
                  visible: {
                    opacity: 1,
                    x: 0,
                  },
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
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                />
              </motion.div>
            </motion.div>

            {/* Login */}
            <motion.button
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: 0.5,
              }}
              type="submit"
              disabled={loading}
              className="w-full h-16 bg-[#D4AF37] text-black font-black rounded-[25px] flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(212,175,55,0.3)] active:scale-95 transition-all hover:bg-[#B8860B] relative overflow-hidden group disabled:opacity-60"
            >
              <div className="absolute inset-0 gold-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />

              {loading ? (
                <Loader2
                  className="animate-spin"
                  size={28}
                />
              ) : (
                <>
                  <span className="relative z-10">
                    تسجيل الدخول الملكي ⚜️
                  </span>

                  <Sparkles
                    size={20}
                    className="relative z-10"
                  />
                </>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="h-px flex-1 bg-[#222]" />

            <span className="text-gray-600 text-[10px] uppercase tracking-widest font-bold">
              أو سجل عبر
            </span>

            <div className="h-px flex-1 bg-[#222]" />
          </div>

          {/* Google */}
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-14 bg-[#0a0a0a] border border-[#222] text-white font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-[#111] transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <Loader2
                  className="animate-spin"
                  size={20}
                />
              ) : (
                <Chrome size={20} />
              )}

              <span className="text-xs">
                تسجيل الدخول عبر Google
              </span>
            </button>
          </div>

          {/* Guest */}
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full h-16 bg-white/[0.02] border border-[#D4AF37]/10 text-gray-400 font-medium rounded-2xl flex items-center justify-center gap-3 hover:bg-[#D4AF37]/5 hover:text-[#D4AF37] transition-all group disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Compass
                  size={16}
                  className="text-[#D4AF37]"
                />
              </div>

              <span className="text-sm">
                تصفح AURUM كزائر
              </span>
            </button>
          </div>

          {/* Register */}
          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="text-gray-500 hover:text-[#D4AF37] font-bold flex items-center justify-center gap-3 mx-auto transition-colors group"
            >
              <span className="text-sm">
                ليس لديك حساب؟ انضم إلى النخبة
              </span>

              <ArrowRight
                size={18}
                className="group-hover:translate-x-[-5px] transition-transform"
              />
            </button>
          </div>

        </div>
      </motion.div>
    </div>
  );
}