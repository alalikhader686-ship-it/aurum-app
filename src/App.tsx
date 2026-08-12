import React, { useEffect, useState, useMemo } from 'react';
import { ShoppingCart, X, Plus, Minus, Trash2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, AurumUser, RedeemableProduct, WheelPrize, Shop, GlobalSettings, Banner } from './types';
import { AURUM_PRODUCTS, SHOPS } from './constants';
import StackNavigator from './navigation/StackNavigator';
import MainTabNavigator from './components/MainTabNavigator';
import Toast from './components/Toast';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { slugify } from './lib/utils';

import { Suspense, lazy } from 'react';

const MerchantDashboard = lazy(() => import('./components/MerchantDashboard'));
const SuperAdmin = lazy(() => import('./components/SuperAdmin'));

import { useDispatch, useSelector } from 'react-redux';
import { RootState } from './store';
import { addToFavorites, removeFromFavorites, setFavorites } from './store/favoritesSlice';
import { 
  addToCart as addToCartAction, 
  removeFromCart as removeFromCartAction, 
  incrementQuantity, 
  decrementQuantity,
  setCart,
  cleanCart
} from './store/cartSlice';

import { seedDatabaseIfEmpty } from './services/seedService';
import ApkDownloadBanner from './components/ApkDownloadBanner';

// Fallback loader for lazy components
const AdminLoader = () => (
  <div className="min-h-screen bg-black flex flex-col items-center justify-center">
    <div className="w-12 h-12 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mb-4" />
    <p className="text-[#D4AF37] text-xs font-black uppercase tracking-widest">جاري تحميل النظام الملكي... ⚜️</p>
  </div>
);

// const AURUM_PRODUCTS: Product[] = []; // Removed shadowing

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'home' | 'mall' | 'favorites' | 'cart' | 'profile' | 'orders' | 'notifications' | 'details' | 'login' | 'register' | 'shop_details' | 'admin' | 'splash' | 'design'>('splash');
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
  const [role, setRole] = useState<'customer' | 'merchant'>('customer');
  const [viewMode, setViewMode] = useState<'customer' | 'merchant'>('merchant');
  const [dbProducts, setDbProducts] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem('aurum_cached_products');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [dbShops, setDbShops] = useState<Shop[]>(() => {
    try {
      const cached = localStorage.getItem('aurum_cached_shops');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [redeemableProducts, setRedeemableProducts] = useState<RedeemableProduct[]>(() => {
    try {
      const cached = localStorage.getItem('aurum_cached_redeemable_products');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [wheelPrizes, setWheelPrizes] = useState<WheelPrize[]>(() => {
    try {
      const cached = localStorage.getItem('aurum_cached_wheel_prizes');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(() => {
    try {
      const cached = localStorage.getItem('aurum_cached_settings');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [banners, setBanners] = useState<Banner[]>(() => {
    try {
      const cached = localStorage.getItem('aurum_cached_banners');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [userData, setUserData] = useState<AurumUser | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedShop, setSelectedShop] = useState<string>("AURUM SHOP");
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [error, setError] = useState<string | null>(null);
  
  const dispatch = useDispatch();
  const favorites = useSelector((state: RootState) => state.favorites.favorites);
  const cart = useSelector((state: RootState) => state.cart.cart);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isProductsLoaded, setIsProductsLoaded] = useState(() => {
    try {
      const cached = localStorage.getItem('aurum_cached_products');
      return cached ? JSON.parse(cached).length > 0 : false;
    } catch {
      return false;
    }
  });
  const favoriteIds = useMemo(() => favorites.map(f => f.id), [favorites]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('الكل');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bannerDuration, setBannerDuration] = useState(5);

  const allProducts = useMemo(() => {
    // Show products from DB and combine with hardcoded ones
    const productMap = new Map<string, Product>();
    
    // Add hardcoded products (if any)
    AURUM_PRODUCTS.forEach(p => {
      if (p && p.id) productMap.set(p.id, p);
    });
    
    // Add ALL DB products
    dbProducts.forEach(p => {
      if (p && p.id) productMap.set(p.id, p);
    });
    
    return Array.from(productMap.values());
  }, [dbProducts]);

  const allShops = useMemo(() => {
    const shopMap = new Map<string, Shop>();
    
    SHOPS.forEach(s => {
      if (s && s.id) shopMap.set(s.id, s);
    });
    
    dbShops.forEach(s => {
      if (s && s.id) shopMap.set(s.id, s);
    });
    
    return Array.from(shopMap.values());
  }, [dbShops]);

  const featuredProductsCount = useMemo(() => {
    return allProducts.filter(p => !p.type || p.type === 'normal').slice(0, 5).length || 1;
  }, [allProducts]);

  const bannerCount = useMemo(() => {
    return (banners.length > 0) ? banners.length : featuredProductsCount;
  }, [banners.length, featuredProductsCount]);

  // Handle deep linking and browser history (back/forward)
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const linkedProductId = params.get('productId');
      
      let productIdToFind = linkedProductId;
      if (path.startsWith('/products/')) {
        productIdToFind = path.split('/products/')[1];
      }

      const slugify = (text: string) => {
        return decodeURIComponent(text)
          .toLowerCase()
          .trim()
          .replace(/[^\u0600-\u06FF\w\s-]/g, '') // Keep Arabic and alphanumeric
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
      };

      if (productIdToFind && allProducts.length > 0) {
        const decodedId = decodeURIComponent(productIdToFind);
        const product = allProducts.find(p => p.id === decodedId || slugify(p.name) === slugify(productIdToFind));
        if (product) {
          setSelectedProduct(product);
          setCurrentScreen('details');
          return; // Stay on details
        }
      }

      // Only perform automatic screen routing if we're not currently busy resolving a product or on details
      if (currentScreen === 'details' && productIdToFind) return;

      if (path === '/' || path === '') {
        // Only set home/login if we're not on splash (which has its own timer)
        if (currentScreen !== 'splash') {
          setCurrentScreen(user ? 'home' : 'login');
        }
      } else {
        const screenKey = path.substring(1);
        const validScreens = ['mall', 'favorites', 'profile', 'orders', 'notifications', 'cart', 'login', 'register', 'design', 'admin'];
        if (validScreens.includes(screenKey)) {
          setCurrentScreen(screenKey as typeof currentScreen);
        }
      }
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [allProducts, user, currentScreen, isProductsLoaded]);

  // Auto-slider for banners
  useEffect(() => {
    if (currentScreen !== 'home') return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % bannerCount);
    }, bannerDuration * 1000);
    return () => clearInterval(interval);
  }, [currentScreen, bannerDuration, bannerCount]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentScreen]);

  // Primary Loading Logic
  useEffect(() => {
    let unsubUser: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (unsubUser) {
        unsubUser();
        unsubUser = undefined;
      }

      if (user) {
        setUser(user);
        // Use onSnapshot for the user document to handle offline/online transitions automatically
        unsubUser = onSnapshot(doc(db, 'users', user.uid), (userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setRole(userData.role || 'customer');
            if (userData.role === 'merchant') setViewMode('merchant');
            if (userData.persistedCart) dispatch(setCart(userData.persistedCart));
            if (userData.persistedFavorites) dispatch(setFavorites(userData.persistedFavorites));
          } else {
            // Document doesn't exist yet (newly registered or sync delay)
            setRole('customer');
          }
        }, (err) => {
          // If we are offline, it might throw "Failed to get document because the client is offline"
          // We handle it gracefully by keeping the default role or notifying the user
          if (err.message?.includes('offline')) {
            console.log("Working in offline mode - using cached/default role");
          } else {
            console.error("Auth role snapshot error:", err);
          }
        });
      } else {
        setUser(null);
        setRole('customer');
        setViewMode('customer');
      }
      setIsInitialLoad(false);
    });

    return () => {
      unsubscribe();
      if (unsubUser) unsubUser();
    };
  }, [dispatch]);

  // Handle splash screen exit
  useEffect(() => {
    if (!isInitialLoad) {
      // Exit splash immediately (10ms) if cached products are ready, otherwise wait max 150ms for a fast transition
      const delay = isProductsLoaded ? 10 : 150;
      const exitSplash = setTimeout(() => {
        if (currentScreen === 'splash') {
          const path = window.location.pathname;
          const isProductPath = path.startsWith('/products/');
          
          if (selectedProduct) {
            setCurrentScreen('details');
          } else if (isProductPath && !isProductsLoaded) {
            // Even on product paths, don't hang more than 1.5s total. Add a safety escape
            const safetyTimeout = setTimeout(() => {
              if (currentScreen === 'splash') {
                setCurrentScreen(user ? 'home' : 'login');
              }
            }, 1200);
            return () => clearTimeout(safetyTimeout);
          } else if (isProductPath && isProductsLoaded && !selectedProduct) {
            // If products are loaded but no matching product was found, transition to home immediately
            setCurrentScreen(user ? 'home' : 'login');
          } else {
            setCurrentScreen(user ? 'home' : 'login');
          }
        }
      }, delay);
      return () => clearTimeout(exitSplash);
    }
  }, [isInitialLoad, user, currentScreen, selectedProduct, isProductsLoaded]);

  useEffect(() => {
    // Optimized Snapshot Listeners with Local Storage Caching (limit 150 for comprehensive display)
    const qProducts = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(150));
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      const prods = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setDbProducts(prods);
      setIsProductsLoaded(true);
      try {
        // Create a compact version of products for splash screen preheating without exceeding local storage quotas
        const compactProds = prods.slice(0, 40).map(p => {
          const description = p.description && p.description.length > 80
            ? p.description.substring(0, 80) + '...'
            : p.description;

          return {
            id: p.id,
            name: p.name,
            brand: p.brand,
            price: p.price,
            image: p.image, // Main image
            category: p.category,
            type: p.type,
            description,
            rating: p.rating,
            averageRating: p.averageRating,
            reviewsCount: p.reviewsCount,
            shopId: p.shopId,
            shopName: p.shopName,
            isFeatured: p.isFeatured,
            section: p.section,
            isVIPOnly: p.isVIPOnly,
            isLimitedEdition: p.isLimitedEdition,
            limitedUnits: p.limitedUnits,
            remainingUnits: p.remainingUnits,
            availableSizes: p.availableSizes,
            availableColors: p.availableColors,
            isSale: p.isSale,
            oldPrice: p.oldPrice,
            salePrice: p.salePrice,
            currency: p.currency,
            createdAt: p.createdAt
          } as Product;
        });

        try {
          localStorage.setItem('aurum_cached_products', JSON.stringify(compactProds));
        } catch (storageError) {
          console.warn("AURUM LOGISTICS ⚠️: Compact products list exceeded quota, saving ultra-light weight list without base64 images", storageError);
          const ultraLightProds = compactProds.map(p => {
            const hasBase64 = p.image && (p.image.startsWith('data:') || p.image.length > 8000);
            return {
              ...p,
              image: hasBase64 ? '' : p.image
            };
          });
          localStorage.setItem('aurum_cached_products', JSON.stringify(ultraLightProds));
        }
      } catch (e) {
        console.error("Local storage product save error", e);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'products');
      setIsProductsLoaded(true);
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGlobalSettings(data);
        if (data.bannerDuration) setBannerDuration(data.bannerDuration);
        try {
          localStorage.setItem('aurum_cached_settings', JSON.stringify(data));
        } catch (e) {
          console.error(e);
        }
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'settings/global');
    });

    const unsubRewards = onSnapshot(collection(db, 'redeemable_products'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RedeemableProduct));
      const sorted = data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setRedeemableProducts(sorted);
      try {
        // Strip out heavy base64 images from local storage to stay within storage quotas
        const compactRewards = sorted.map(r => {
          const hasBase64 = r.image && (r.image.startsWith('data:') || r.image.length > 8000);
          return {
            ...r,
            image: hasBase64 ? '' : r.image
          };
        });
        localStorage.setItem('aurum_cached_redeemable_products', JSON.stringify(compactRewards));
      } catch (e) {
        console.warn("AURUM LOGISTICS ⚠️: Failed to save redeemable_products cache:", e);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'redeemable_products');
    });

    const unsubPrizes = onSnapshot(collection(db, 'wheel_prizes'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WheelPrize));
      const sorted = data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setWheelPrizes(sorted);
      try {
        localStorage.setItem('aurum_cached_wheel_prizes', JSON.stringify(sorted));
      } catch (e) {
        console.error(e);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'wheel_prizes');
    });

    const unsubShops = onSnapshot(collection(db, 'shops'), (snap) => {
      const shops = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
      setDbShops(shops);
      try {
        localStorage.setItem('aurum_cached_shops', JSON.stringify(shops));
      } catch (e) {
        console.error(e);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'shops');
    });

    const unsubBanners = onSnapshot(collection(db, 'banners'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      const sorted = data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setBanners(sorted);
      try {
        // Strip out heavy base64 images from local storage to stay within storage quotas
        const compactBanners = sorted.map(b => {
          const hasBase64 = b.image && (b.image.startsWith('data:') || b.image.length > 8000);
          return {
            ...b,
            image: hasBase64 ? '' : b.image
          };
        });
        localStorage.setItem('aurum_cached_banners', JSON.stringify(compactBanners));
      } catch (e) {
        console.warn("AURUM LOGISTICS ⚠️: Failed to save banners cache:", e);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'banners');
    });

    return () => {
      unsubProducts();
      unsubSettings();
      unsubRewards();
      unsubPrizes();
      unsubShops();
      unsubBanners();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUserData(null);
      return;
    }
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setUserData({ id: snap.id, ...snap.data() } as AurumUser);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });
  }, [user]);

  const filteredProducts = useMemo(() => {
    return allProducts.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const itemCat = item.category?.trim() || "";
      const itemType = item.type?.trim() || "";
      
      // Smart category matching: e.g. 'ملابس رجالية' should match 'ألبسة'
      const isClothing = (cat: string) => 
        ['ألبسة', 'ملابس رجالية', 'ملابس نسائية', 'ملابس أطفال', 'ألبسة أوروبية', 'لباس'].includes(cat);

      const isAccessories = (cat: string) => 
        ['إكسسوارات', 'مجوهرات', 'jewelry', 'accessories', 'jewelery'].includes(cat);

      let matchesTab = selectedTab === 'الكل';
      if (!matchesTab) {
        if (selectedTab === 'ألبسة') {
          matchesTab = isClothing(itemCat) || isClothing(itemType);
        } else if (selectedTab === 'إكسسوارات') {
          matchesTab = isAccessories(itemCat) || isAccessories(itemType);
        } else {
          matchesTab = itemCat === selectedTab || itemType === selectedTab;
        }
      }
      
      return matchesSearch && matchesTab;
    });
  }, [searchQuery, selectedTab, allProducts]);

  const addToCart = (product: Product) => {
    dispatch(addToCartAction(product));
    const isShein = product.category === 'شي ان';
    const message = isShein 
      ? `تمت إضافة ${product.name}. يرجى العلم أن مدة توصيل طلبات شي ان هي 15 يوماً ⚜️`
      : `تمت إضافة ${product.name} إلى سلتك`;
    setToast({ message, visible: true });
  };

  const toggleFavorite = (product: Product) => {
    if (favoriteIds.includes(product.id)) {
      dispatch(removeFromFavorites({ id: product.id }));
    } else {
      dispatch(addToFavorites(product));
    }
  };

  const removeFromCart = (productId: string, selectedSize?: string, selectedColor?: string) => {
    dispatch(removeFromCartAction({ id: productId, selectedSize, selectedColor }));
  };

  const updateQuantity = (productId: string, delta: number, selectedSize?: string, selectedColor?: string) => {
    if (delta > 0) {
      dispatch(incrementQuantity({ id: productId, selectedSize, selectedColor }));
    } else {
      dispatch(decrementQuantity({ id: productId, selectedSize, selectedColor }));
    }
  };

  const cartTotal = cart.reduce((sum, item) => {
    const price = parseInt(item.price.replace(/[^0-9]/g, '')) || 0;
    return sum + price * (item.quantity || 0);
  }, 0);
  
  const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const handleTabChange = (tab: string) => {
    if (tab === 'cart') {
      setIsCartOpen(true);
      return;
    }
    if (auth.currentUser?.isAnonymous && tab === 'favorites') {
      alert("عذراً ⚜️: ميزة المنتجات المفضلة حصرية للأعضاء المسجلين. يرجى تسجيل الدخول أو إنشاء حساب لحفظ اختياراتك الفاخرة.");
      setCurrentScreen('login');
      return;
    }
    const target = tab as 'home' | 'mall' | 'favorites' | 'cart' | 'profile' | 'orders' | 'notifications' | 'details' | 'login' | 'register' | 'shop_details' | 'admin' | 'splash' | 'design';
    setCurrentScreen(target);

    // Reset path when navigating to main screens
    if (target === 'home') {
      window.history.pushState({}, '', '/');
    } else if (['mall', 'favorites', 'profile', 'orders', 'notifications', 'design', 'cart'].includes(target)) {
      window.history.pushState({}, '', `/${target}`);
    }
  };

  const openProductDetails = (product: Product) => {
    setSelectedProduct(product);
    setCurrentScreen('details');
    window.history.pushState({}, '', `/products/${slugify(product.name)}`);
  };

  const openShopDetails = (shopName: string) => {
    setSelectedShop(shopName);
    setCurrentScreen('shop_details');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      dispatch(cleanCart()); // Clear Redux cart on logout
      setCurrentScreen('login');
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const isSuperAdmin = useMemo(() => {
    if (!user?.email) return false;
    const email = user.email.toLowerCase().trim();
    console.log("DEBUG: Checking SuperAdmin for email:", email);
    
    const adminEmails = [
      'alalikhader686@gmail.com',
      'alalikhader686@googlemail.com',
      'aurumapp7@gmail.com',
      'aurumapp7@googlemail.com',
      'alalisalam82@gmail.com',
      'alalisalam82@googlemail.com',
      'hamadasy604@gmail.com',
      'hamadasy604@googlemail.com',
      'alaa-khader@hotmail.com',
      'alalikhader686@hotmail.com',
      'alalikhader686@outlook.com',
      'alalikhader686@live.com'
    ];
    const isMatched = adminEmails.some(ae => ae.toLowerCase().trim() === email);
    console.log("DEBUG: SuperAdmin Match Result:", isMatched);
    return isMatched;
  }, [user]);

  useEffect(() => {
    if (isSuperAdmin) {
      const timer = setTimeout(seedDatabaseIfEmpty, 5000);
      return () => clearTimeout(timer);
    }
  }, [isSuperAdmin]);

  const navigateToAdmin = () => {
    console.log("DEBUG: Requesting navigation to Admin panel");
    if (isSuperAdmin) {
      setCurrentScreen('admin');
      window.history.pushState({}, '', '/admin');
    } else {
      console.warn("DEBUG: Access denied. User is not a SuperAdmin");
      alert("عذراً ⚜️: هذه المنطقة مخصصة للمدير العام فقط.");
    }
  };

  return (
    <div className="min-h-screen bg-black font-sans text-white selection:bg-[#D4AF37] selection:text-black relative overflow-x-hidden liquid-bg" dir="rtl">
      {/* Primary Loading/Splash Screen */}
      <AnimatePresence>
        {(isInitialLoad || (!isProductsLoaded && currentScreen === 'splash')) && (
          <motion.div 
            key="primary-splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="fixed inset-0 z-[2000] bg-black flex flex-col items-center justify-center p-6"
          >
            <motion.div 
              animate={{ 
                scale: [0.95, 1, 0.95],
                opacity: [0.6, 1, 0.6]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="flex flex-col items-center"
            >
              <div className="relative w-24 h-24 mb-8">
                 <div className="absolute inset-0 border-2 border-[#D4AF37]/20 rounded-full" />
                 <div className="absolute inset-0 border-t-2 border-[#D4AF37] rounded-full animate-spin" />
              </div>
              <h1 className="text-5xl font-serif italic text-reveal text-[#D4AF37] tracking-[0.3em] mb-2 drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]">AURUM</h1>
              <p className="text-[10px] text-[#D4AF37]/40 tracking-[1em] uppercase ml-[-1em]">Luxury Store</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={<AdminLoader />}>
        {currentScreen === 'admin' && isSuperAdmin ? (
          <SuperAdmin onBack={() => {
            setCurrentScreen('home');
            window.history.pushState({}, '', '/');
          }} />
        ) : role === 'merchant' && user && currentScreen === 'home' && viewMode === 'merchant' ? (
          <MerchantDashboard user={user} onSwitchView={() => setViewMode('customer')} />
        ) : (
          <StackNavigator 
            currentScreen={currentScreen}
            onNavigate={(screen) => {
              const target = screen as typeof currentScreen;
              setCurrentScreen(target);
              if (target === 'home') {
                window.history.pushState({}, '', '/');
              } else if (['mall', 'favorites', 'profile', 'orders', 'notifications', 'cart', 'design', 'admin', 'login', 'register'].includes(target)) {
                window.history.pushState({}, '', `/${target}`);
              }
            }}
            user={user}
            userData={userData}
            role={role}
            redeemableProducts={redeemableProducts}
            wheelPrizes={wheelPrizes}
            globalSettings={globalSettings}
            shops={allShops}
            onLogout={handleLogout}
            products={filteredProducts}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedTab={selectedTab}
            setSelectedTab={setSelectedTab}
            currentIndex={currentIndex}
            cartCount={cartCount}
            favoriteIds={favoriteIds}
            selectedProduct={selectedProduct}
            selectedShop={selectedShop}
            onAddToCart={addToCart}
            onToggleFavorite={toggleFavorite}
            onOpenCart={() => setIsCartOpen(true)}
            onOpenNotifications={() => setCurrentScreen('notifications')}
            onOpenShop={openShopDetails}
            onTabChange={handleTabChange}
            onBack={() => {
              window.history.pushState({}, '', '/');
              setCurrentScreen('home');
            }}
            onOpenProductDetails={openProductDetails}
            isSuperAdmin={isSuperAdmin}
            onOpenAdmin={() => setCurrentScreen('admin')}
            banners={banners}
            isProductsLoaded={isProductsLoaded}
          />
        )}
      </Suspense>

      {/* Clothing Type Modal */}
      <AnimatePresence>
        {modalVisible && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalVisible(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#1a1a1a] border border-[#D4AF37] rounded-[20px] p-8 w-full max-w-xs text-center shadow-2xl"
            >
              <h3 className="text-[#D4AF37] text-xl font-bold mb-6">نوع الألبسة</h3>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => { setSelectedTab('رجالي'); setModalVisible(false); }}
                  className="w-full py-4 text-lg hover:bg-[#D4AF37]/10 rounded-xl transition-colors border-b border-[#333]"
                >
                  رجالي
                </button>
                <button 
                  onClick={() => { setSelectedTab('نسائية'); setModalVisible(false); }}
                  className="w-full py-4 text-lg hover:bg-[#D4AF37]/10 rounded-xl transition-colors"
                >
                  نسائية
                </button>
              </div>
              <button 
                onClick={() => setModalVisible(false)}
                className="mt-6 text-red-500 font-medium hover:underline"
              >
                إلغاء
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Sidebar */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div 
            key="cart-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCartOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
          />
        )}
        {isCartOpen && (
          <motion.div 
            key="cart-sidebar"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#0a0a0a] z-[120] shadow-2xl flex flex-col border-l border-[#333]"
          >
              <div className="p-6 border-b border-[#333] flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[#D4AF37]">سلة التسوق ⚜️</h2>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-[#1a1a1a] rounded-full text-gray-400 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

               <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4">
                    <ShoppingCart size={80} strokeWidth={1} />
                    <p className="text-xl">سلتك فارغة حالياً</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div key={`cart-item-${item.id}-${item.selectedSize || 's'}-${item.selectedColor || 'c'}-${idx}`} className="flex gap-4 p-4 bg-[#1a1a1a] border border-[#333] rounded-2xl">
                       <img 
                        src={item.image || null} 
                        alt={item.name} 
                        className="w-20 h-20 object-cover rounded-xl"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate mb-1">{item.name}</h4>
                        <div className="flex items-center gap-2 mb-2">
                           <p className="text-[#D4AF37] font-bold text-sm">{item.price}</p>
                           {(item.selectedSize || item.selectedColor) && (
                             <div className="flex items-center gap-1">
                               {item.selectedSize && <span className="bg-white/5 px-1.5 py-0.5 rounded text-[8px] text-gray-500 border border-white/10 uppercase">{item.selectedSize}</span>}
                               {item.selectedColor && <span className="bg-white/5 px-1.5 py-0.5 rounded text-[8px] text-gray-500 border border-white/10">{item.selectedColor}</span>}
                             </div>
                           )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center bg-black border border-[#333] rounded-lg">
                            <button 
                              onClick={() => updateQuantity(item.id, -1, item.selectedSize, item.selectedColor)}
                              className="p-1 hover:text-[#D4AF37]"
                            >
                              <Minus size={16} />
                            </button>
                            <span className="px-3 text-sm font-bold">{item.quantity || 0}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, 1, item.selectedSize, item.selectedColor)}
                              className="p-1 hover:text-[#D4AF37]"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.id, item.selectedSize, item.selectedColor)}
                            className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-8 border-t border-[#333] bg-[#0a0a0a] space-y-6">
                  <div className="flex justify-between items-center text-xl">
                    <span className="text-gray-400">المجموع:</span>
                    <span className="font-bold text-[#D4AF37]">{cartTotal?.toLocaleString() ?? '0'} SP</span>
                  </div>
                  <button 
                    onClick={() => {
                      setIsCartOpen(false);
                      setCurrentScreen('cart');
                      window.history.pushState({}, '', '/cart');
                    }}
                    className="w-full bg-[#D4AF37] hover:bg-[#b8962d] text-black py-4 rounded-2xl font-bold text-lg shadow-lg transition-all active:scale-95"
                  >
                    إتمام الشراء الفاخر
                  </button>
                </div>
              )}
            </motion.div>
        )}
      </AnimatePresence>

      {user && ['home', 'mall', 'favorites', 'profile'].includes(currentScreen) && (
        <MainTabNavigator 
          activeTab={currentScreen as 'home' | 'mall' | 'favorites' | 'cart' | 'profile'} 
          onTabChange={handleTabChange} 
          isSuperAdmin={isSuperAdmin}
          onAdminClick={navigateToAdmin}
          cartCount={cartCount}
          isVIP={userData?.isVIP}
        />
      )}

      {currentScreen !== 'splash' && <ApkDownloadBanner />}

      <Toast 
        message={toast.message} 
        isVisible={toast.visible} 
        onClose={() => setToast(prev => ({ ...prev, visible: false }))} 
      />

      <AnimatePresence>
        {error && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 text-right" dir="rtl">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
              onClick={() => setError(null)}
            />
            <motion.div 
              initial={{ y: 20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.9 }}
              className="relative bg-[#0a0a0a] border border-red-500/30 p-8 rounded-[40px] flex flex-col items-center gap-6 w-full max-w-[320px] shadow-[0_30px_100px_rgba(239,68,68,0.2)]"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 border border-red-500/20">
                 <XCircle size={40} />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black text-white mb-2">تنبيه أمني من Firebase ⚜️</h3>
                <p className="text-gray-500 text-[10px] font-bold leading-relaxed">{error}</p>
              </div>
              <div className="bg-black/40 p-4 rounded-2xl w-full text-left space-y-1 font-mono text-[9px] text-gray-400 border border-white/5">
                 <p className="text-[#D4AF37] mb-1 font-sans font-black">خطوات تفعيل القواعد:</p>
                 <p>1. افتح Firebase Console</p>
                 <p>2. اختر Firestore Database {`->`} Rules</p>
                 <p>3. حدّث القواعد كما هو في الملف</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="w-full py-4 bg-red-500/20 text-red-500 border border-red-500/20 rounded-2xl hover:bg-red-500 hover:text-white transition-all font-black text-xs"
              >
                فهمت، سأقوم بالتحديث ⚜️
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Branding & Footer */}
      {['home', 'mall', 'favorites', 'profile', 'orders', 'notifications'].includes(currentScreen) && (
        <footer className="w-full py-12 px-6 text-center border-t border-white/5 bg-black">
          <div className="text-[#D4AF37] font-serif italic text-3xl tracking-[0.2em] mb-4">AURUM</div>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">حقوق النشر محفوظة © AURUM LUXURY ARBIL</p>
          <a href="mailto:aurumapp7@gmail.com" className="text-[#D4AF37]/40 text-[9px] font-black hover:text-[#D4AF37] transition-all tracking-[0.1em] uppercase">AURUMAPP7@GMAIL.COM</a>
          <div className="flex justify-center gap-6 mt-8">
            <div className="w-1 h-1 bg-[#D4AF37]/20 rounded-full" />
            <div className="w-1 h-1 bg-[#D4AF37]/40 rounded-full" />
            <div className="w-1 h-1 bg-[#D4AF37]/20 rounded-full" />
          </div>
        </footer>
      )}
    </div>
  );
}
