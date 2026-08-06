import { Home, ShoppingCart, User, Store, Heart, LucideIcon, ShieldCheck, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface TabItem {
  id: 'home' | 'mall' | 'favorites' | 'cart' | 'profile';
  label: string;
  icon: LucideIcon;
}

interface MainTabNavigatorProps {
  activeTab: 'home' | 'mall' | 'favorites' | 'cart' | 'profile';
  onTabChange: (tab: 'home' | 'mall' | 'favorites' | 'cart' | 'profile') => void;
  isSuperAdmin?: boolean;
  onAdminClick?: () => void;
  cartCount?: number;
  isVIP?: boolean;
}

const tabs: TabItem[] = [
  { id: 'home', label: 'الرئيسية', icon: Home },
  { id: 'mall', label: 'المول ⚜️', icon: Store },
  { id: 'favorites', label: 'المفضلة', icon: Heart },
  { id: 'cart', label: 'السلة', icon: ShoppingCart },
  { id: 'profile', label: 'حسابي', icon: User },
];

export default function MainTabNavigator({ 
  activeTab, 
  onTabChange, 
  isSuperAdmin, 
  onAdminClick,
  cartCount = 0,
  isVIP = false
}: MainTabNavigatorProps) {
  return (
    <div className="fixed bottom-4 left-0 right-0 z-[100] flex items-end justify-center px-4 pointer-events-none md:bottom-8">
      <div className="flex items-center gap-3 w-full max-w-2xl justify-center pointer-events-auto">
        
        {/* Main Navigation Dock */}
        <div className="glass-morphism rounded-[32px] h-[64px] sm:h-[72px] flex items-center justify-around px-1 shadow-[0_25px_50px_-12px_rgba(212,175,55,0.25)] relative flex-1 max-w-md border border-white/5">
          {/* Liquid Background Indicator */}
          <div className="absolute inset-x-0 h-full flex items-center justify-around px-1 pointer-events-none">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <div key={`nav-indicator-${tab.id}`} className="w-12 sm:w-16 flex justify-center">
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        layoutId="navTabBackground"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute h-10 w-10 sm:h-12 sm:w-12 bg-[#D4AF37]/10 rounded-[18px] sm:rounded-[20px] luxury-glow border border-[#D4AF37]/20"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 28
                        }}
                      />
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={`nav-tab-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className="relative flex flex-col items-center justify-center w-12 sm:w-16 h-full outline-none group z-10"
              >
                <motion.div
                  animate={{
                    y: isActive ? -2 : 0,
                    scale: isActive ? 1.1 : 1,
                    color: isActive ? "#D4AF37" : "#888"
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25
                  }}
                  className={cn(
                    "p-2 rounded-[14px] transition-all duration-300 relative",
                    isActive ? "text-[#D4AF37]" : "hover:bg-white/5 text-gray-500"
                  )}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  {tab.id === 'cart' && cartCount > 0 && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-black shadow-lg z-20"
                    >
                      {cartCount > 9 ? '9+' : cartCount}
                    </motion.div>
                  )}
                  {tab.id === 'profile' && isVIP && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-black text-[8px] font-black rounded-full flex items-center justify-center border border-black shadow-lg z-20"
                    >
                      <Star size={8} fill="currentColor" />
                    </motion.div>
                  )}
                </motion.div>

                {isActive && (
                  <motion.div
                    layoutId="activeTabDot"
                    className="absolute bottom-1.5 w-1 h-1 bg-[#D4AF37] rounded-full shadow-[0_0_10px_#D4AF37]"
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30
                    }}
                  />
                )}
                
                <AnimatePresence>
                  {isActive && (
                    <motion.span 
                      initial={{ opacity: 0, scale: 0.5, y: 0 }}
                      animate={{ opacity: 1, scale: 1, y: 16 }}
                      exit={{ opacity: 0, scale: 0.5, y: 0 }}
                      className="text-[6.5px] font-black uppercase tracking-[0.1em] absolute text-[#D4AF37] whitespace-nowrap drop-shadow-sm pointer-events-none"
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>

        {/* Admin Button - Integrated (Conditional) */}
        {isSuperAdmin && (
          <div className="flex flex-col items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onAdminClick}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-black/60 backdrop-blur-xl border border-[#D4AF37]/30 text-[#D4AF37] flex items-center justify-center shadow-xl group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <ShieldCheck size={24} />
            </motion.button>
            <p className="text-[7px] font-black text-[#D4AF37] uppercase tracking-widest hidden sm:block">الإدارة</p>
          </div>
        )}
      </div>
    </div>
  );
}

