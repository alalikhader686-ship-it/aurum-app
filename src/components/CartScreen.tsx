import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  Plus, 
  Minus, 
  MapPin, 
  CheckCircle2, 
  Circle,
  Truck,
  X,
  Map as MapIcon,
  Crown,
  Navigation,
  Copy,
  Clock,
  Camera,
  Upload,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet icon issue
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function LocationMarker({ position, setPosition, onComplete, icon }: { position: { lat: number, lng: number } | null, setPosition: (pos: { lat: number, lng: number }) => void, onComplete: (lat: number, lng: number) => void, icon: L.DivIcon }) {
  const markerRef = React.useRef<L.Marker>(null);
  const map = useMapEvents({
    click(e) {
      const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
      setPosition(pos);
      map.flyTo(e.latlng, map.getZoom());
      onComplete(pos.lat, pos.lng);
    },
  });

  const eventHandlers = React.useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latlng = marker.getLatLng();
          const pos = { lat: latlng.lat, lng: latlng.lng };
          setPosition(pos);
          onComplete(pos.lat, pos.lng);
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
      icon={icon} 
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
import { RootState } from '../store';
import { CartItem, Order } from '../types';
import { 
  incrementQuantity, 
  decrementQuantity, 
  cleanCart,
  updateLocation 
} from '../store/cartSlice';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, getDoc, increment } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { inventoryService } from '../services/inventoryService';
import { compressImage } from '../lib/imageCompression';
import { sendTelegramBotMessage, buildAdminTelegramMessage, buildMerchantTelegramMessage } from '../services/telegramService';

interface CartScreenProps {
  onBack: () => void;
  onNavigate: (screen: string) => void;
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

const cityAreaMapping: Record<string, string[]> = {
  "طرطوس": [
    "المشروع", "الغمقة", "المنطقة الصناعية", "الكورنيش", "الثورة", "الشيخ سعد", 
    "الرمال", "عمريت", "الصفصافة", "بانياس", "الشيخ بدر", "القدموس", "دريكيش", 
    "صافيتا", "المرتفع", "الحمرات", "بصيرة", "الخراب", "المنشية", "السكن الشبابي",
    "جمعة", "رادار", "جامعة طرطوس", "عقرب", "تل كاس"
  ],
  "دمشق": ["المزة", "المالكي", "القصاع", "الميدان", "برزة", "مهاجرين", "أبو رمانة", "كفرسوسة", "البرامكة", "جسر الأبيض"],
  "ريف دمشق": ["جرمانا", "صحنايا", "قدسيا", "السيدة زينب", "دوما"],
  "حلب": ["الجميلية", "الحمدانية", "الموكامبو", "الشعار", "صلاح الدين"],
  "اللاذقية": ["الرمل", "المشروع", "زراعة", "مشروع السابع", "مشروع الصليبة"],
  "حمص": ["الوعر", "الخالدية", "كرم الشامي", "باب السباع"],
  "حماة": ["الحاضر", "باب قبلي", "العاصي"]
};

export default function CartScreen({ onBack, onNavigate }: CartScreenProps) {
  const dispatch = useDispatch();
  const cartItems = useSelector((state: RootState) => state.cart.cart);
  const city = useSelector((state: RootState) => state.cart.city);

  const [method, setMethod] = useState<string | null>(null);
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [isShipping, setIsShipping] = useState(false);
  const [locationSelected, setLocationSelected] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [telegramInput, setTelegramInput] = useState("");
  const [customerBotUsername, setCustomerBotUsername] = useState("");

  useEffect(() => {
    getDoc(doc(db, 'settings', 'global')).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.customerTelegramBotUsername) {
          setCustomerBotUsername(data.customerTelegramBotUsername);
        }
      }
    }).catch(console.warn);
  }, []);

  // Custom SVG Icon to avoid external asset dependency issues
  const luxuryIcon = L.divIcon({
    html: `
      <div style="position: relative;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21C16 17 20 13.4183 20 9C20 4.58172 16.4183 1 12 1C7.58172 1 4 4.58172 4 9C4 13.4183 8 17 12 21Z" fill="#D4AF37" stroke="black" stroke-width="1"/>
          <circle cx="12" cy="9" r="3" fill="black"/>
        </svg>
        <div style="position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 20px; height: 4px; background: rgba(0,0,0,0.3); border-radius: 50%; filter: blur(2px);"></div>
      </div>
    `,
    className: 'custom-div-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });

  // Auto-detect city based on area typing
  useEffect(() => {
    if (!area) return;
    
    for (const [cityName, areas] of Object.entries(cityAreaMapping)) {
      if (areas.some(a => area.includes(a))) {
        if (city !== cityName) {
          dispatch(updateLocation({ city: cityName }));
        }
        break;
      }
    }
  }, [area, city, dispatch]);

  useEffect(() => {
    // When map modal opens, ensure we always have valid coordinates set based on selected city (or default to Tartus)
    if (showMapModal && !coords) {
      const cityCoords: Record<string, { lat: number, lng: number }> = {
        "طرطوس": { lat: 34.889, lng: 35.886 },
        "دمشق": { lat: 33.5138, lng: 36.2765 },
        "ريف دمشق": { lat: 33.5138, lng: 36.2765 },
        "حلب": { lat: 36.2021, lng: 37.1343 },
        "اللاذقية": { lat: 35.5312, lng: 35.7908 },
        "حمص": { lat: 34.7324, lng: 36.7137 },
        "حماة": { lat: 35.1318, lng: 36.7578 }
      };
      const defaultCoord = cityCoords[city] || { lat: 34.889, lng: 35.886 };
      setCoords(defaultCoord);
    }
  }, [showMapModal, coords, city]);

  const handleReverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`);
      const data = await response.json();
      
      if (data && data.address) {
        const detectedCity = data.address.city || data.address.town || data.address.state || "";
        const detectedArea = data.address.suburb || data.address.neighbourhood || data.address.road || data.address.village || "";
        // Find if any of our predefined cities are in the detected address
        for (const cityObj of syrianCities) {
          if (detectedCity.includes(cityObj.name) || (data.address.state && data.address.state.includes(cityObj.name))) {
            if (cityObj.available) {
              dispatch(updateLocation({ city: cityObj.name }));
            }
            break;
          }
        }

        if (detectedArea && !area) {
          setArea(detectedArea);
        }
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    }
  };

  const total = cartItems.reduce((sum, item) => {
    const priceNum = parseInt(item.price.replace(/[^0-9]/g, '')) || 0;
    return sum + (priceNum * (item.quantity || 0));
  }, 0) + 20000;

  const handleGetRealLocation = () => {
    setLocLoading(true);
    if (!navigator.geolocation) {
      alert("عذراً ⚜️: متصفحك لا يدعم تحديد الموقع الحقيقي.");
      setLocLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCoords(newCoords);
        setLocationSelected(true);
        setLocLoading(false);
        handleReverseGeocode(newCoords.lat, newCoords.lng);
        alert("تم رصد موقعك بدقة! ⚜️ يمكنك سحب الدبوس لتعديل مكانه بدقة متناهية.");
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocLoading(false);
        alert("فشل تحديد الموقع ⚜️: يرجى تفعيل الموقع (GPS) والسماح للمتصفح بالوصول إليه.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit initial file size for performance, but we will compress anyway
    if (file.size > 2000000) {
      alert("حجم الإيصال كبير جداً. يرجى اختيار صورة أقل من 2 ميغابايت.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      // Compress to ensure it's well under Firestore's 1MB limit per document
      // Targeting ~200-300KB
      const compressed = await compressImage(base64, 800, 800, 0.6);
      setReceiptImage(compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmOrder = async () => {
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      alert("عذراً ⚜️: للتمكن من إتمام الطلب وتثبيت عمليات الشراء وحفظ بياناتك الملكية، يرجى إنشاء حساب رسمي أو تسجيل الدخول.");
      onNavigate('login');
      return;
    }

    if (cartItems.length === 0) {
      alert("السلة فارغة 🛒");
      return;
    }
    if (!area || !phone || !method) {
      alert("تنبيه ⚜️: يرجى إدخال العنوان بالتفصيل، رقم الموبايل، واختيار طريقة الدفع للتمكن من إتمام الطلب.");
      return;
    }

    if (method !== "الدفع باليد" && !receiptImage) {
      alert("تنبيه ⚜️: يرجى تحميل صورة إيصال الدفع لإتمام الطلب.");
      return;
    }

    setIsShipping(true);

    try {
      // Extract unique shop IDs and merchant IDs from cart items
      const shopIds = Array.from(new Set(cartItems.map((item: CartItem & { shopId?: string }) => item.shopId).filter((id?: string) => !!id))) as string[];
      const merchantIds = Array.from(new Set(cartItems.map((item: CartItem & { ownerId?: string }) => item.ownerId).filter((id?: string) => !!id))) as string[];

      // Parse customer Telegram input
      const cleanTg = telegramInput.trim();
      const telegramUsername = cleanTg.startsWith('@') 
        ? cleanTg 
        : (cleanTg && isNaN(Number(cleanTg)) ? `@${cleanTg}` : null);
      const telegramChatId = cleanTg && !isNaN(Number(cleanTg)) ? cleanTg : null;

      // Save order to Firestore
      const orderRef = await addDoc(collection(db, 'orders'), {
        userId: auth.currentUser?.uid,
        userEmail: auth.currentUser?.email,
        userName: auth.currentUser?.displayName,
        items: cartItems,
        shopIds, // Link order to specific shops
        merchantIds, // Link order to merchants for dashboard access
        total,
        city,
        area,
        phone,
        telegramUsername: telegramUsername || (cleanTg ? cleanTg : null),
        telegramChatId: telegramChatId || (cleanTg ? cleanTg : null),
        paymentMethod: method,
        paymentReceipt: receiptImage,
        transactionId: transactionId || null,
        status: 'pending',
        coordinates: coords, // Real coordinates
        createdAt: new Date().toISOString()
      });

      // Fire off background operations immediately without awaiting them sequentially to speed up checkout
      
      // 1. Notify external inventory tracking system
      inventoryService.notifySale({
        id: orderRef.id,
        items: cartItems,
        total,
        userEmail: auth.currentUser?.email || undefined,
        customerName: auth.currentUser?.displayName || undefined,
        status: 'pending'
      }).catch(e => {
        console.warn("Secondary inventory notification failed", e);
      });
 
      // 2. Decrement inventory stock for all products in parallel
      Promise.all(cartItems.map(async (item: CartItem) => {
        try {
          const productRef = doc(db, 'products', item.id);
          await updateDoc(productRef, {
            stock: increment(-(item.quantity || 1))
          });
        } catch (err) {
          console.error("AURUM LOGISTICS ⚠️: فشل تحديث مخزون المنتج:", item.id, err);
        }
      })).catch(e => console.error("Stock dec error", e));
 
      // 3. Add Notification
      const needsTransaction = (method === "Syriatel Cash" || method === "Sham Cash") && !transactionId;
      addDoc(collection(db, 'notifications'), {
        userId: auth.currentUser?.uid,
        orderId: orderRef.id,
        status: 'pending',
        type: needsTransaction ? 'PAYMENT_PENDING' : 'ORDER_SUCCESS',
        message: needsTransaction 
          ? 'يجب إرسال رقم عملية التحويل هنا ⚜️' 
          : 'تم استلام طلبك الملكي بنجاح ⚜️ جاري المراجعة الآن.',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.error("Notification creation error", e));
 
      // 4. Award extra spin and points
      try {
        const userRef = doc(db, 'users', auth.currentUser!.uid);
        getDoc(userRef).then(async (userSnap) => {
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const earnedPoints = Math.floor(total / 1000); // 1 point per 1000 SP spent
            await updateDoc(userRef, {
              extraSpins: (userData.extraSpins || 0) + 1,
              points: (userData.points || 0) + earnedPoints
            });
          }
        }).catch(userErr => {
          console.warn("AURUM LOGISTICS ⚠️: فشل تحديث نقاط المستخدم:", userErr);
        });
      } catch (userErr) {
        console.warn("AURUM LOGISTICS ⚠️: فشل تحديث نقاط المستخدم:", userErr);
      }

      // 5. Create system notifications & send Telegram Bot notifications automatically to Admin & Merchants
      try {
        const customerName = auth.currentUser?.displayName || 'زبون AURUM';
        // Notification for Admin
        addDoc(collection(db, 'notifications'), {
          type: 'ADMIN_NEW_ORDER',
          orderId: orderRef.id,
          userName: customerName,
          total,
          message: `طلب جديد بقيمة ${total.toLocaleString()} ل.س (${(total / 100).toLocaleString()} بالليرة الجديدة) من ${customerName}`,
          read: false,
          createdAt: new Date().toISOString()
        }).catch(e => console.error(e));

        // Notifications for Merchants
        for (const mId of merchantIds) {
          if (mId) {
            addDoc(collection(db, 'notifications'), {
              recipientId: mId,
              orderId: orderRef.id,
              type: 'MERCHANT_NEW_ORDER',
              message: `لديك طلب جديد في متجرك! رقم الطلب #${orderRef.id.slice(-6).toUpperCase()}`,
              read: false,
              createdAt: new Date().toISOString()
            }).catch(e => console.error(e));
          }
        }

        // Automatic Telegram Bot notification dispatch
        const createdOrderObj: Order = {
          id: orderRef.id,
          userId: auth.currentUser?.uid || '',
          userEmail: auth.currentUser?.email || '',
          userName: customerName,
          items: cartItems,
          shopIds,
          merchantIds,
          total,
          city,
          area,
          phone,
          paymentMethod: method,
          paymentReceipt: receiptImage,
          transactionId: transactionId || null,
          status: 'pending',
          coordinates: coords,
          createdAt: new Date().toISOString()
        };

        const globalSnap = await getDoc(doc(db, 'settings', 'global'));
        if (globalSnap.exists()) {
          const settings = globalSnap.data();
          const botToken = settings.telegramBotToken;
          const adminChatId = settings.telegramAdminChatId;

          if (botToken && adminChatId) {
            const adminTgMsg = buildAdminTelegramMessage(createdOrderObj);
            sendTelegramBotMessage(botToken, adminChatId, adminTgMsg).catch(err => {
              console.warn("Telegram Bot Admin notification warning:", err);
            });
          }

          for (const sId of shopIds) {
            const shopSnap = await getDoc(doc(db, 'shops', sId));
            if (shopSnap.exists()) {
              const shopData = shopSnap.data();
              const shopTgChatId = shopData.telegramChatId || adminChatId;
              if (botToken && shopTgChatId) {
                const shopItems = cartItems.filter((i: CartItem & { shopId?: string }) => i.shopId === sId);
                const merchantTgMsg = buildMerchantTelegramMessage(createdOrderObj, shopData.name, shopItems);
                sendTelegramBotMessage(botToken, shopTgChatId, merchantTgMsg).catch(err => {
                  console.warn("Telegram Bot Merchant notification warning:", err);
                });
              }
            }
          }
        }
      } catch (waErr) {
        console.warn("AURUM LOGISTICS ⚠️: فشل إنشاء الإشعارات:", waErr);
      }

      // Respond instantly to client
      setTimeout(() => {
        setIsShipping(false);
        dispatch(cleanCart());
        const hasShein = cartItems.some((item: { category: string }) => item.category === 'شي ان');
        const defaultMsg = "AURUM ⚜️: تم إرسال طلبك بنجاح للآدمن ولصاحب المحل! تم تثبيت الطلب وسنتواصل معك قريباً.";
        const sheinMsg = "AURUM ⚜️: تم إرسال طلبك بنجاح للآدمن ولصاحب المحل! يرجى الملاحظة أن الطلب يحتوي على منتجات شي ان وسوف تستغرق حوالي 15 يوماً للوصول.";
        alert(hasShein ? sheinMsg : defaultMsg);
        onNavigate('orders');
      }, 600);
    } catch (err: unknown) {
      console.error("Error saving order:", err);
      setIsShipping(false);
      const errorMsg = err instanceof Error ? err.message : "حدث خطأ غير معروف";
      alert(`خطأ في تثبيت الطلب ⚜️: ${errorMsg}\nيرجى التأكد من اتصال الإنترنت ومن صلاحيات الحساب.`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-[#333] px-6 py-4 flex justify-between items-center">
        <button onClick={onBack} className="text-[#D4AF37] hover:scale-110 transition-transform">
          <ChevronRight size={28} />
        </button>
        <h1 className="text-[#D4AF37] font-bold text-xl">فاتورة الطلب ⚜️</h1>
        <div className="w-7" />
      </header>

      <div className="max-w-2xl mx-auto px-4 mt-8 space-y-8">
        {/* Shein Delivery Notice */}
        {cartItems.some((item: { category: string }) => item.category === 'شي ان') && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center gap-4"
          >
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-black shrink-0">
              <Truck size={20} />
            </div>
            <div>
              <p className="text-amber-500 text-xs font-black">ملاحظة التوصيل لمنتجات (شي ان) 📦</p>
              <p className="text-amber-500/80 text-[10px] font-bold">يرجى العلم أن هذه المنتجات تشحن من الخارج وتستغرق حوالي 15 يوماً للتسليم ⚜️</p>
            </div>
          </motion.div>
        )}

        {/* Products Review */}
        <section>
          <h3 className="text-[#D4AF37] font-bold mb-4">مراجعة المنتجات:</h3>
          <div className="space-y-3">
            {cartItems.map((item, idx) => (
              <div key={`cart-check-${item.id}-${item.selectedSize || 'none'}-${item.selectedColor || 'none'}-${idx}`} className="flex flex-col bg-[#0a0a0a] rounded-3xl border border-[#1a1a1a] overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <img src={item.image || null} alt={item.name} className="w-20 h-20 object-cover rounded-2xl" />
                  <div className="flex-1">
                    <h4 className="font-black text-sm text-white mb-1">{item.name}</h4>
                    <div className="flex flex-col mb-1">
                      {item.isSale ? (
                        <div className="flex flex-col items-start gap-0.5">
                          <div className="flex items-center gap-2">
                             <span className="text-[#D4AF37] text-xs font-black">
                               {item.salePrice} <span className="text-[10px] font-normal opacity-50 uppercase">{item.currency === 'USD' ? '$' : 'ل.س'}</span>
                             </span>
                             <span className="text-red-500 line-through text-[10px] font-bold opacity-60">
                               {item.oldPrice}
                             </span>
                          </div>
                          {item.currency === 'SYP' && item.newSypPrice && (
                            <span className="text-[9px] text-amber-500/60 font-bold">
                              {item.newSypPrice} <span className="text-[7px]">ل.س جديد</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-start gap-0.5">
                          <p className="text-[#D4AF37] text-xs font-bold">
                            {item.price} <span className="text-[10px] opacity-50 font-normal uppercase">{item.currency === 'USD' ? '$' : 'ل.س'}</span>
                          </p>
                          {item.currency === 'SYP' && item.newSypPrice && (
                            <span className="text-[9px] text-amber-500/60 font-bold">
                              {item.newSypPrice} <span className="text-[7px]">ل.س جديد</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                      {(item.selectedSize || item.selectedColor) && (
                        <div className="flex items-center gap-1">
                          {item.selectedSize && <span className="bg-white/5 px-1.5 py-0.5 rounded text-[8px] text-gray-400 border border-white/10">القياس: {item.selectedSize}</span>}
                          {item.selectedColor && <span className="bg-white/5 px-1.5 py-0.5 rounded text-[8px] text-gray-400 border border-white/10">اللون: {item.selectedColor}</span>}
                        </div>
                      )}
                    <div className="flex items-center gap-2 mt-2">
                       <span className={cn(
                         "text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter border",
                         item.category === 'شي ان' ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                       )}>
                         {item.category === 'شي ان' ? "تجهيز دولي" : "متوفر محلياً"}
                       </span>
                       <span className="text-[8px] text-gray-500 font-bold flex items-center gap-1">
                         <MapPin size={8} />
                         {item.category === 'شي ان' ? "مستودعات دبي/الصين" : "مستودع طرطوس المركز"}
                       </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-black border border-[#333] rounded-xl p-1.5">
                    <button onClick={() => dispatch(incrementQuantity({ id: item.id, selectedSize: item.selectedSize, selectedColor: item.selectedColor }))} className="text-[#D4AF37] hover:scale-110 transition-transform"><Plus size={18} /></button>
                    <span className="font-black min-w-[20px] text-center text-sm">{item.quantity || 0}</span>
                    <button onClick={() => dispatch(decrementQuantity({ id: item.id, selectedSize: item.selectedSize, selectedColor: item.selectedColor }))} className="text-gray-500 hover:scale-110 transition-transform"><Minus size={18} /></button>
                  </div>
                </div>
                {/* Real-time Tracking Line in Cart */}
                <div className="bg-white/5 py-2 px-4 flex items-center justify-between border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <Clock size={10} className="text-[#D4AF37]" />
                    <span className="text-[9px] text-gray-400 font-bold">الحالة: {item.category === 'شي ان' ? 'بانتظار التأهيب للشحن' : 'جاهز للتغليف 📦'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck size={10} className="text-gray-600" />
                    <span className="text-[9px] text-gray-600 font-bold">{item.category === 'شي ان' ? 'توصيل خلال 15 يوم' : 'توصيل فوري'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-[#111] p-6 rounded-2xl flex flex-col gap-2 border border-[#D4AF37]/20">
            <div className="flex justify-between items-center text-gray-400 text-sm">
              <span>قيمة المنتجات:</span>
              <span>{(total - 20000).toLocaleString()} SP</span>
            </div>
            <div className="flex justify-between items-center text-gray-400 text-sm">
              <span>أجور التوصيل (طرطوس):</span>
              <span>20,000 SP</span>
            </div>
            <div className="h-px bg-white/5 my-2" />
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold">المجموع النهائي:</span>
              <div className="flex flex-col items-end">
                <span className="text-xl font-bold text-[#D4AF37]">{total?.toLocaleString() ?? '0'} SP</span>
                {total > 0 && (
                  <span className="text-xs text-amber-500/60 font-bold mt-1">
                    {(total / 100).toLocaleString()} بالليرة الجديدة ⚜️
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-[#222]" />

        {/* Delivery Info */}
        <section className="space-y-4">
          <h3 className="text-[#D4AF37] font-bold">معلومات التوصيل والموقع 📍:</h3>
          
          <button 
            onClick={() => setShowMapModal(true)}
            className={cn(
              "w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all shadow-xl",
              locationSelected 
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                : "bg-[#0a0a0a] border-[#D4AF37]/50 text-[#D4AF37]/80 hover:border-[#D4AF37] border-dashed shadow-[#D4AF37]/5"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", locationSelected ? "bg-emerald-500/20" : "bg-[#D4AF37]/20")}>
                {locationSelected ? <CheckCircle2 size={20} /> : <Navigation size={20} />}
              </div>
              <div className="text-right">
                <p className="font-black text-sm">
                  {locationSelected ? "تم تثبيت الموقع بنجاح ⚜️" : "تحديد موقعك على الخريطة (اختياري) 📍"}
                </p>
                <p className="text-[10px] opacity-60">
                  {locationSelected ? "يمكنك التعديل بالضغط مجدداً" : "يساعد المندوب في الوصول إليك بشكل أسرع"}
                </p>
              </div>
            </div>
            <MapIcon size={24} />
          </button>

          <button 
            onClick={() => setShowCityPicker(true)}
            className="w-full flex items-center justify-between p-5 bg-[#0a0a0a] border border-[#333] rounded-2xl text-white"
          >
            <span className="font-medium">{city}</span>
            <MapPin size={24} className="text-[#D4AF37]" />
          </button>

          <input 
            type="text" 
            placeholder="العنوان بالتفصيل" 
            className="w-full bg-[#0a0a0a] border border-[#222] rounded-2xl p-5 focus:outline-none focus:border-[#D4AF37] transition-all text-right"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
          
          <input 
            type="tel" 
            placeholder="رقم الموبايل للتواصل" 
            className="w-full bg-[#0a0a0a] border border-[#222] rounded-2xl p-5 focus:outline-none focus:border-[#D4AF37] transition-all text-right"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div className="p-4 bg-sky-950/30 border border-sky-500/20 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <Send size={14} />
                <span>إرسال الفاتورة عبر التليغرام تلقائياً:</span>
              </label>
              {customerBotUsername && (
                <a 
                  href={`https://t.me/${customerBotUsername.replace('@', '')}?start=order`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] bg-sky-500 text-black font-black px-3 py-1 rounded-full hover:bg-sky-400 transition-all flex items-center gap-1 shadow-md shadow-sky-500/20"
                >
                  <span>تشغيل البوت (/start) 🤖</span>
                </a>
              )}
            </div>
            <input 
              type="text" 
              placeholder="معرّف التليغرام (@username) أو Chat ID" 
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 focus:outline-none focus:border-sky-500 transition-all text-right text-xs text-white dir-rtl"
              value={telegramInput}
              onChange={(e) => setTelegramInput(e.target.value)}
            />
            <p className="text-[10px] text-gray-400 leading-relaxed text-right">
              💡 أدخل اسم المستخدم الخاص بك بالتليغرام (مثال: <span className="text-sky-400 font-mono">@name</span>) واضغط على <b>&quot;تشغيل البوت&quot;</b> بالأن الأعلى حتى يتمكن البوت من إرسال إشعار الفاتورة والموافقة لك مباشرة فور تثبيت طلبك.
            </p>
          </div>
        </section>

        {/* Payment Methods */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[#D4AF37] font-bold">طريقة الدفع:</h3>
            {cartItems.some(item => item.category === 'شي ان') && (
              <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                ⚠️ طلبات شي ان: دفع مسبق حصراً
              </span>
            )}
          </div>
          <div className="space-y-2">
            {["Syriatel Cash", "Sham Cash", "الدفع باليد"].map((m) => {
              const hasShein = cartItems.some(item => item.category === 'شي ان');
              if (hasShein && m === "الدفع باليد") return null;

              return (
                <button 
                  key={`pay-method-${m}`} 
                  onClick={() => setMethod(m)}
                  className={cn(
                    "w-full flex items-center justify-between p-5 rounded-2xl border transition-all",
                    method === m ? "bg-[#D4AF37]/10 border-[#D4AF37]" : "bg-[#0a0a0a] border-[#222]"
                  )}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className={cn("font-bold text-sm", method === m ? "text-white" : "text-gray-500")}>
                      {m === "الدفع باليد" ? "دفع نقد عند الاستلام" : m}
                    </span>
                    {m === "الدفع باليد" && (
                      <span className="text-[10px] text-gray-500">متوفر فقط للمنتجات المحلية ⚜️</span>
                    )}
                  </div>
                  {method === m ? <CheckCircle2 size={24} className="text-[#D4AF37]" /> : <Circle size={24} className="text-[#333]" />}
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {method && method !== "الدفع باليد" && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#111] p-6 rounded-2xl border-r-4 border-[#D4AF37] space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div className="text-right flex-1">
                    <p className="text-gray-400 text-xs mb-1">
                      {method === "Sham Cash" ? "ادفع على هذا الكود:" : 
                       "ادفع على هذا الحساب:"}
                    </p>
                    <p className="text-[#D4AF37] text-xl font-bold break-all">
                      {method === "Sham Cash" ? "512c8105f7a22fc6a4b847c6c6c338e1" : "04644815"}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      const val = method === "Sham Cash" ? "512c8105f7a22fc6a4b847c6c6c338e1" : "04644815";
                      navigator.clipboard.writeText(val);
                      alert("تم النسخ ⚜️");
                    }}
                    className="p-2 bg-[#D4AF37]/10 rounded-lg text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors"
                  >
                    <Copy size={18} />
                  </button>
                </div>

                {/* Transaction ID Input */}
                <div className="pt-4 border-t border-white/5">
                   <p className="text-gray-400 text-[10px] font-bold mb-3 mr-1">أدخل رقم عملية التحويل ⚜️</p>
                   <input 
                    type="text"
                    placeholder="رقم العملية (مثلاً: 123456789)"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-4 text-[#D4AF37] font-bold text-center focus:border-[#D4AF37] transition-all"
                   />
                </div>

                {/* Receipt Upload */}
                <div className="pt-4 border-t border-white/5">
                  <p className="text-gray-400 text-[10px] font-bold mb-3 mr-1">تحميل صورة الإيصال (إلزامي) ⚜️</p>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-black border border-white/10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
                      {receiptImage ? (
                        <img src={receiptImage} className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="text-gray-600" />
                      )}
                    </div>
                    <label className="flex-1 cursor-pointer bg-white/5 border border-white/10 rounded-2xl py-4 flex flex-col items-center justify-center gap-2 hover:bg-[#D4AF37]/10 transition-all group">
                      <Upload size={20} className="text-[#D4AF37] group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase text-gray-300">اختر صورة الإيصال</span>
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        onChange={handleReceiptUpload}
                      />
                    </label>
                  </div>
                </div>

                <p className="text-[10px] text-gray-600 font-bold">⚠️ يرجى تصوير الإيصال وإرساله للآدمن</p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* Footer Confirm */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/80 backdrop-blur-md border-t border-[#333] z-[150] flex gap-3">
        <button 
          onClick={handleConfirmOrder}
          className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold py-5 rounded-2xl text-lg shadow-lg active:scale-95 transition-all text-center"
        >
          تثبيت الطلب ⚜️
        </button>
      </div>

      {/* Real Map Modal */}
      <AnimatePresence>
        {showMapModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-md"
              onClick={() => setShowMapModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-[#0a0a0a] border border-[#D4AF37]/50 rounded-none sm:rounded-[30px] w-full h-[100dvh] sm:h-[85vh] max-w-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 flex justify-between items-center border-b border-[#222] shrink-0">
                <button onClick={() => setShowMapModal(false)} className="text-gray-400 p-2">
                  <X size={20} />
                </button>
                <h3 className="text-[#D4AF37] font-black text-base">تحديد الموقع الملكي ⚜️</h3>
                <div className="w-10" />
              </div>

              {/* Map View */}
              <div className="flex-1 relative bg-[#111] z-0">
                <MapContainer 
                  center={coords || { lat: 34.889, lng: 35.886 }} // Fallback to Tartus center
                  zoom={coords ? 18 : 13} 
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <LocationMarker position={coords} setPosition={setCoords} onComplete={handleReverseGeocode} icon={luxuryIcon} />
                  {coords && <MapUpdater center={coords} />}
                </MapContainer>

                {/* Accuracy Info */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-[#D4AF37]/20 text-[10px] text-gray-300 pointer-events-none text-center min-w-[280px]">
                  انقر على مكانك الدقيق في الخريطة لتغيير الدبوس 📍
                </div>

                {/* Floating Auto-Location Button */}
                <button 
                  disabled={locLoading}
                  onClick={handleGetRealLocation}
                  className="absolute bottom-6 right-6 z-[1000] w-14 h-14 bg-[#D4AF37] text-black rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(212,175,55,0.4)] active:scale-90 transition-all border-4 border-black"
                >
                  {locLoading ? <span className="animate-spin text-xl font-bold">⚜️</span> : <Navigation size={24} />}
                </button>
              </div>

              {/* Instructions & Actions */}
              <div className="p-4 pb-8 space-y-3 bg-black border-t border-[#222] shadow-[0_-10px_30px_rgba(0,0,0,0.8)] shrink-0 relative z-[1010]">
                <div className="flex items-center gap-3 p-3 bg-[#111] rounded-2xl border border-[#D4AF37]/20">
                  <div className="w-8 h-8 bg-[#D4AF37]/10 rounded-full flex items-center justify-center text-[#D4AF37] shrink-0">
                    <MapPin size={16} />
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-white font-bold text-xs">حدد موقعك على الخريطة</p>
                    <p className="text-[9px] text-gray-400">
                      {coords ? `الإحداثيات المقررة: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "يستخدم مندوبينا هذا الموقع للوصول إليك بسرعة وسهولة ⚜️"}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if (!coords) {
                      alert("يرجى تحديد الموقع على الخريطة أولاً ⚜️");
                      return;
                    }
                    setLocationSelected(true);
                    setShowMapModal(false);
                    alert("تم حفظ إحداثيات موقعك الملكي بنجاح ⚜️");
                  }}
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
          </div>
        )}
      </AnimatePresence>

      {/* City Picker Modal */}
      <AnimatePresence>
        {showCityPicker && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCityPicker(false)}
              className="absolute inset-0 bg-black/80"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative bg-[#0a0a0a] w-full max-w-md rounded-t-[30px] p-8 max-h-[70vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[#D4AF37] text-xl font-bold">المحافظة ⚜️</h3>
                <button onClick={() => setShowCityPicker(false)} className="text-[#D4AF37]"><X size={24} /></button>
              </div>
              <div className="space-y-2">
                {syrianCities.map((c) => (
                  <button 
                    key={`city-picker-${c.name}`} 
                    disabled={!c.available}
                    onClick={() => { 
                      dispatch(updateLocation({ city: c.name }));
                      setShowCityPicker(false); 
                    }}
                    className={cn(
                      "w-full py-4 text-center text-lg border-b border-[#222] transition-colors flex justify-center items-center gap-4",
                      city === c.name ? "text-[#D4AF37] font-bold" : (c.available ? "text-white" : "text-gray-600 cursor-not-allowed")
                    )}
                  >
                    <span>{c.name}</span>
                    {!c.available && <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full border border-white/10 uppercase">قريباً ⚜️</span>}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shipping Animation Overlay */}
      <AnimatePresence>
        {isShipping && (
          <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                animate={{ 
                  y: [0, -10, 0],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="mb-8"
              >
                <Crown size={80} className="text-[#D4AF37] mx-auto luxury-glow" />
              </motion.div>
              
              <motion.h2 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[#D4AF37] text-3xl font-black mb-12 tracking-[0.2em] font-serif italic"
              >
                AURUM LOGISTICS ⚜️
              </motion.h2>
              
              <div className="relative w-full max-w-xs h-32 flex flex-col items-center justify-center">
                <motion.div
                  animate={{ 
                    x: [-10, 10, -10],
                  }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-[#D4AF37]"
                >
                  <Truck size={120} strokeWidth={1} />
                </motion.div>
                
                <div className="w-64 h-0.5 bg-white/10 mt-6 overflow-hidden relative rounded-full">
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"
                  />
                </div>
              </div>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-12 space-y-2"
              >
                <p className="text-white font-black text-xl">جاري تجهيز طلبك الملكي</p>
                <p className="text-gray-500 font-bold text-sm">سيصلك المندوب بأسرع وقت ممكن ⚜️</p>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
