import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  MapPin, 
  Heart, 
  Truck, 
  ChevronLeft, 
  MessageCircle,
  Edit3,
  CheckCircle2,
  ArrowRight,
  Map as MapIcon,
  Navigation,
  X,
  Store,
  ShieldCheck,
  Star,
  LucideIcon,
  Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '../lib/utils';

// Fix Leaflet icon issue
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function LocationMarker({ position, setPosition, onComplete }: { position: { lat: number, lng: number } | null, setPosition: (pos: { lat: number, lng: number }) => void, onComplete?: (lat: number, lng: number) => void }) {
  const markerRef = React.useRef<L.Marker>(null);
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
      if (onComplete) onComplete(e.latlng.lat, e.latlng.lng);
    },
  });

  const eventHandlers = React.useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latlng = marker.getLatLng();
          setPosition(latlng);
          if (onComplete) onComplete(latlng.lat, latlng.lng);
        }
      },
    }),
    [setPosition, onComplete],
  );

  return position === null ? null : (
    <Marker 
      draggable={true}
      eventHandlers={eventHandlers}
      position={position} 
      icon={DefaultIcon} 
      ref={markerRef}
    />
  );
}

function MapUpdater({ center }: { center: { lat: number, lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}
import { useDispatch, useSelector } from 'react-redux';
import { updateLocation } from '../store/cartSlice';
import { db, auth } from '../lib/firebase';
import { doc, onSnapshot, query, collection, where } from 'firebase/firestore';
import { RootState } from '../store';

interface AddressScreenProps {
  onBack: () => void;
  onNavigateToOrders: () => void;
  onLogout: () => void;
  role?: 'customer' | 'merchant';
  onSwitchToMerchant?: () => void;
  isSuperAdmin?: boolean;
  onOpenAdmin?: () => void;
  onTabChange?: (tab: string) => void;
}

const syrianCities = [
  { name: "طرطوس", available: true },
  { name: "دمشق", available: false },
  { name: "ريف دمشق", available: false },
  { name: "حلب", available: false },
  { name: "حمص", available: false },
  { name: "حماة", available: false },
  { name: "اللاذقية", available: false },
  { name: "درعا", available: false },
  { name: "السويداء", available: false }
];

export default function AddressScreen({ onBack, onNavigateToOrders, onLogout, role, onSwitchToMerchant, isSuperAdmin, onOpenAdmin, onTabChange }: AddressScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [userName, setUserName] = useState("عميل أوروم الملكي ⚜️");
  const [address, setAddress] = useState("لم يتم تحديد الموقع بعد ⚜️");
  const [showMap, setShowMap] = useState(false);
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [isVIP, setIsVIP] = useState(false);
  const [userPoints, setUserPoints] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  
  const dispatch = useDispatch();

  const handleReverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`);
      const data = await response.json();
      
      if (data && data.address) {
        const detectedCity = data.address.city || data.address.town || data.address.state || "";
        const detectedArea = data.address.suburb || data.address.neighbourhood || data.address.road || "";
        
        // Find if any of our predefined cities are in the detected address
        let finalCity = "";
        for (const cityObj of syrianCities) {
          if (detectedCity.includes(cityObj.name) || (data.address.state && data.address.state.includes(cityObj.name))) {
            if (cityObj.available) {
              finalCity = cityObj.name;
              dispatch(updateLocation({ city: finalCity }));
            }
            break;
          }
        }

        const newAddress = `${finalCity} - ${detectedArea || 'إحداثيات دقيقة'}`;
        setAddress(newAddress);
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    if (auth.currentUser.isAnonymous) {
      setUserName("زائر ملكي ⚜️");
      return;
    }

    // Fetch user profile
    const unsubUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setIsVIP(data.isVIP || false);
        setUserPoints(data.points || 0);
        if (data.email) setUserName(data.email.split('@')[0]);
      } else {
        setUserName(auth.currentUser.email?.split('@')[0] || "عميل أوروم");
      }
    }, (err) => {
      console.error("DEBUG: AddressScreen user snap error:", err);
    });

    // Fetch orders count
    const qOrders = query(collection(db, 'orders'), where('userId', '==', auth.currentUser.uid));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setOrdersCount(snapshot.size);
    }, (err) => {
      console.error("DEBUG: AddressScreen orders snap error:", err);
    });

    return () => {
      unsubUser();
      unsubOrders();
    };
  }, []);

  // Use selector for favorites count since it's in Redux
  const favoritesFromRedux = useSelector((state: RootState) => state.favorites.favorites);
  useEffect(() => {
    setFavoritesCount(favoritesFromRedux.length);
  }, [favoritesFromRedux]);

  // Request location on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCoords({ lat: latitude, lng: longitude });
          // Reverse geocoding will happen when they confirm or we can call it here but without hardcoding
          handleReverseGeocode(latitude, longitude);
        },
        (error) => {
          console.error("Error getting location:", error);
          setAddress("يرجى تحديد الموقع يدوياً ⚜️");
        }
      );
    }
  }, []);

  useEffect(() => {
    if (showMap && !coords) {
      setCoords({ lat: 34.889, lng: 35.886 });
    }
  }, [showMap, coords]);

  const handleSave = () => {
    setIsEditing(false);
    alert("تم الحفظ ⚜️: تم تحديث بياناتك بنجاح");
  };

  const handleConfirmLocation = () => {
    if (!coords) {
      alert("يرجى تحديد الموقع على الخريطة أولاً ⚜️");
      return;
    }
    setShowMap(false);
    const newAddress = `الموقع الملكي (إحداثيات دقيقة) ⚜️`;
    setAddress(newAddress);
    dispatch(updateLocation({ city: "طرطوس", coords }));
    alert("تم تأكيد الموقع الملكي بدقة ⚜️");
  };

  const handleGetAutoLoc = () => {
    if (!navigator.geolocation) {
      alert("عذراً ⚜️: متصفحك لا يدعم تحديد الموقع.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        alert("تم رصد موقعك بدقة ⚜️");
      },
      () => alert("فشل رصد الموقع، يرجى تفعيل الـ GPS"),
      { enableHighAccuracy: true }
    );
  };

  const ActionCard = ({ icon: Icon, title, subtitle, onClick }: { icon: LucideIcon, title: string, subtitle: string, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-4 bg-[#0a0a0a] p-5 rounded-[25px] border border-[#222] hover:border-[#D4AF37]/30 transition-all group active:scale-[0.98]"
    >
      <div className="w-12 h-12 bg-[#151515] rounded-xl flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform">
        <Icon size={24} />
      </div>
      <div className="flex-1 text-right">
        <h4 className="text-white font-bold">{title}</h4>
        <p className="text-gray-500 text-xs mt-1">{subtitle}</p>
      </div>
      <ChevronLeft size={18} className="text-gray-600 group-hover:translate-x-[-4px] transition-transform" />
    </button>
  );

  return (
    <div className="min-h-screen bg-black text-white pb-32 relative" dir="rtl">
      {/* Header / Identity Section */}
      <section className="bg-[#080808] pt-16 pb-12 px-6 flex flex-col items-center border-b border-[#1a1a1a]">
        <div className="relative mb-6">
          <div className="w-28 h-28 rounded-full border-2 border-[#D4AF37] flex items-center justify-center bg-black overflow-hidden shadow-[0_0_30px_rgba(212,175,55,0.15)]">
            <UserIcon size={56} className="text-[#D4AF37]" />
          </div>
          <div className="absolute bottom-0 right-0 w-8 h-8 bg-[#D4AF37] rounded-full flex items-center justify-center text-black border-4 border-[#080808]">
            <CheckCircle2 size={16} />
          </div>
          {isVIP && (
            <motion.div 
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              className="absolute -top-3 -right-3 bg-gradient-to-br from-amber-400 via-amber-600 to-amber-500 text-black px-4 py-1.5 rounded-full text-[11px] font-black shadow-[0_0_25px_rgba(245,158,11,0.6)] flex items-center gap-1.5 border-2 border-black z-10"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              >
                <Star size={12} fill="currentColor" />
              </motion.div>
              <span className="tracking-widest">AURUM VIP</span>
            </motion.div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div 
              key="editing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-xs"
            >
              <input 
                type="text" 
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-[#111] border border-[#D4AF37] rounded-2xl py-3 px-4 text-center text-white focus:outline-none shadow-[0_0_20px_rgba(212,175,55,0.1)]"
                autoFocus
              />
            </motion.div>
          ) : (
            <motion.div 
              key="display"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <h2 className={cn("text-2xl font-black", isVIP ? "text-[#D4AF37] bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-[#D4AF37] to-amber-200 animate-shine" : "text-white")}>
                  {userName}
                </h2>
                {isVIP && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <ShieldCheck className="text-amber-500" size={20} />
                  </motion.div>
                )}
              </div>
              <p className="text-gray-500 text-xs font-bold tracking-wide">
                {auth.currentUser?.isAnonymous ? "تصفح محدود - سجل لتفعيل كافة الميزات" : auth.currentUser?.email}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {isVIP ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 w-full max-w-[320px] bg-gradient-to-br from-amber-950/40 via-black to-black border border-amber-500/30 rounded-[30px] p-6 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[50px] -mr-16 -mt-16 rounded-full" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">بطاقة عضوية VIP الحصرية 🛡️</span>
                <Crown size={16} className="text-amber-500" />
              </div>
              <p className="text-white text-sm font-bold leading-relaxed mb-4">
                نرحب بك في النخبة ⚜️ بصفتك عضواً VIP، تتمتع بمزايا حصرية وتوصيل مجاني لطلباتك.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[8px] text-gray-500 font-bold uppercase">النقاط الملكية</span>
                  <span className="text-amber-500 font-black text-lg">{userPoints} ⚜️</span>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[8px] text-gray-500 font-bold uppercase">المكانة</span>
                  <span className="text-amber-200 font-black text-sm tracking-tighter italic">AURUM ELITE</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : !auth.currentUser?.isAnonymous && (
          <div className="mt-8 w-full max-w-[280px]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">مستوى عضوية VIP ⚜️</span>
              <span className="text-[10px] font-bold text-[#D4AF37]">{userPoints} / 2500</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((userPoints / 2500) * 100, 100)}%` }}
                className="h-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] rounded-full shadow-[0_0_10px_rgba(212,175,55,0.4)]"
              />
            </div>
            <p className="text-[9px] text-center text-gray-600 mt-2 italic font-bold">اجمع {Math.max(0, 2500 - userPoints)} نقطة لتحرير عالم VIP ⚜️</p>
          </div>
        )}

        <button 
          onClick={() => {
            if (auth.currentUser?.isAnonymous) {
              onLogout(); // This will take them back to login screen
              return;
            }
            if (isEditing) {
              handleSave();
            } else {
              setIsEditing(true);
            }
          }}
          className="mt-6 px-8 py-3 bg-[#D4AF37] text-black font-black rounded-full text-sm shadow-lg active:scale-95 transition-all flex items-center gap-2"
        >
          {auth.currentUser?.isAnonymous ? (
            <>
              <ShieldCheck size={16} />
              <span>إنشاء حساب رسمي ⚜️</span>
            </>
          ) : isEditing ? (
            <>
              <CheckCircle2 size={16} />
              <span>حفظ التغييرات</span>
            </>
          ) : (
            <>
              <Edit3 size={16} />
              <span>تعديل الملف الشخصي</span>
            </>
          )}
        </button>
      </section>

      {/* Delivery Location Section */}
      <section className="mt-10 px-6">
        <h3 className="text-[#D4AF37] font-bold mb-4 flex items-center gap-2">
          <MapIcon size={18} />
          <span>موقعي الحالي (خرائط AURUM)</span>
        </h3>
        <button 
          onClick={() => setShowMap(true)}
          className="w-full bg-[#0a0a0a] p-5 rounded-[25px] border border-[#1a1a1a] flex items-center gap-4 hover:border-[#D4AF37]/30 transition-all group"
        >
          <div className="text-[#D4AF37] group-hover:scale-110 transition-transform">
            <Navigation size={20} />
          </div>
          <span className="flex-1 text-gray-300 text-right truncate">{address}</span>
          <span className="text-[#D4AF37] text-xs font-bold">تغيير</span>
        </button>
      </section>

      {/* Activities Section */}
      <section className="mt-10 px-6">
        <h3 className="text-[#D4AF37] font-bold mb-4">نشاطاتي</h3>
        <div className="space-y-4">
          {isSuperAdmin && onOpenAdmin && (
            <button 
              onClick={onOpenAdmin}
              className="w-full flex items-center gap-4 bg-gradient-to-r from-[#D4AF37] to-black p-6 rounded-[30px] border-2 border-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-all group active:scale-[0.95] mb-6 shadow-[0_10px_30px_rgba(212,175,55,0.4)]"
            >
              <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-[#D4AF37] group-hover:bg-black group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(212,175,55,0.5)]">
                <ShieldCheck size={32} />
              </div>
              <div className="flex-1 text-right">
                <h4 className="text-white font-black text-lg group-hover:text-black transition-colors">لوحة تحكم المدير العام ⚜️</h4>
                <p className="text-[#D4AF37] group-hover:text-black/70 text-xs font-bold mt-1 uppercase tracking-widest transition-colors">دخول المسؤول الفائق - Super Admin</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-black/20">
                <ArrowRight size={20} className="text-[#D4AF37] group-hover:text-black" />
              </div>
            </button>
          )}

          {role === 'merchant' && onSwitchToMerchant && (
            <ActionCard 
              icon={Store} 
              title="لوحة التاجر" 
              subtitle="إدارة متجرك ومنتجاتك" 
              onClick={onSwitchToMerchant}
            />
          )}
          <ActionCard 
            icon={Heart} 
            title="قائمة المفضلة" 
            subtitle={`${favoritesCount} منتجات محفوظة`} 
            onClick={() => onTabChange && onTabChange('favorites')}
          />
          <ActionCard 
            icon={Truck} 
            title="طلباتي" 
            subtitle={ordersCount > 0 ? `لديك ${ordersCount} طلبات في الأرشيف` : "ليس لديك طلبات حالياً"} 
            onClick={onNavigateToOrders}
          />
        </div>
      </section>

      {/* Support Section */}
      <section className="mt-10 px-6">
        <div className="bg-[#0a0a0a] p-8 rounded-[35px] border border-[#1a1a1a] flex flex-col items-center text-center">
          <h4 className="text-white font-medium mb-6">هل لديك استفسار؟</h4>
          <button 
            onClick={() => window.open('https://wa.me/9647513324100', '_blank')}
            className="w-full bg-[#25D366] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"
          >
            <MessageCircle size={22} />
            <span>تحدث مع الدعم الفني مباشرة</span>
          </button>
        </div>
      </section>

      {/* Logout Button */}
      <section className="mt-8 px-6">
        <button 
          onClick={onLogout}
          className="w-full py-4 text-red-500 font-bold border border-red-500/20 rounded-2xl hover:bg-red-500/5 transition-all"
        >
          {auth.currentUser?.isAnonymous ? "الخروج من وضع الزائر ⚜️" : "تسجيل الخروج ⚜️"}
        </button>
      </section>

      {/* Back to Home */}
      <div className="mt-8 text-center">
        <button 
          onClick={onBack}
          className="text-gray-500 text-sm flex items-center justify-center gap-2 mx-auto group"
        >
          <span>العودة للرئيسية</span>
          <ArrowRight size={16} className="group-hover:translate-x-[-4px] transition-transform" />
        </button>
      </div>

      {/* Map Modal Overlay */}
      <AnimatePresence>
        {showMap && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col h-[100dvh]"
          >
            {/* Map Header */}
            <div className="p-4 flex justify-between items-center border-b border-[#222] bg-black/80 backdrop-blur-md shrink-0">
              <button onClick={() => setShowMap(false)} className="text-gray-400 p-2">
                <X size={20} />
              </button>
              <h3 className="text-[#D4AF37] font-bold text-sm">تحديد الموقع الملكي ⚜️</h3>
              <div className="w-10" />
            </div>

            {/* Real Map View */}
            <div className="flex-1 relative bg-[#111] z-0">
              <MapContainer 
                center={coords || { lat: 34.889, lng: 35.886 }} 
                zoom={coords ? 18 : 13} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationMarker position={coords} setPosition={setCoords} onComplete={handleReverseGeocode} />
                {coords && <MapUpdater center={coords} />}
              </MapContainer>

              {/* Float Controls */}
              <button 
                onClick={handleGetAutoLoc}
                className="absolute bottom-6 right-6 z-[1000] w-14 h-14 bg-[#D4AF37] text-black rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(212,175,55,0.4)] active:scale-90 transition-all border-4 border-black"
              >
                <Navigation size={24} />
              </button>
            </div>

            {/* Map Footer */}
            <div className="p-5 pb-8 bg-black border-t border-[#222] shadow-[0_-10px_30px_rgba(0,0,0,0.8)] shrink-0 relative z-[1010]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-[#D4AF37]/10 rounded-full flex items-center justify-center text-[#D4AF37] shrink-0">
                  <MapPin size={16} />
                </div>
                <div className="flex-1 text-right min-w-0">
                  <p className="text-[10px] text-gray-500">الموقع الملكي المختار</p>
                  <p className="text-xs font-bold text-white truncate">
                    {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "انقر لتحديد موقعك بالضبط"}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleConfirmLocation}
                className={`w-full h-14 font-black rounded-2xl active:scale-95 transition-all text-base flex items-center justify-center gap-2 ${
                  coords 
                    ? "bg-[#D4AF37] text-black shadow-[0_4px_20px_rgba(212,175,55,0.4)]" 
                    : "bg-[#222] text-gray-500 border border-white/5 cursor-not-allowed"
                }`}
              >
                <span>تأكيد الموقع الملكي ⚜️</span>
                <CheckCircle2 size={20} className={coords ? "text-black animate-bounce" : "text-gray-500"} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
