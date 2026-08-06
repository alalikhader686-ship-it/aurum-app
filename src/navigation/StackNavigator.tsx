import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import LoginScreen from '../components/LoginScreen';
import RegisterScreen from '../components/RegisterScreen';
import AurumMall from '../components/AurumMall';
import HomeScreen from '../components/HomeScreen';
import CartScreen from '../components/CartScreen';
import ProductInfo from '../components/ProductInfo';
import Notifications from '../components/Notifications';
import MyOrders from '../components/MyOrders';
import AddressScreen from '../components/AddressScreen';
import ShopDetails from '../components/ShopDetails';
import FavoritesScreen from '../components/FavoritesScreen';
import ClothingDesignScreen from '../components/ClothingDesignScreen';
import { Product, AurumUser, RedeemableProduct, WheelPrize, Shop, GlobalSettings, Banner } from '../types';

interface StackNavigatorProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
  user: { uid: string; email: string | null } | null;
  userData?: AurumUser | null;
  role: 'customer' | 'merchant';
  redeemableProducts?: RedeemableProduct[];
  wheelPrizes?: WheelPrize[];
  globalSettings?: GlobalSettings | null;
  shops?: Shop[];
  onLogout: () => void;
  // Props for screens
  products: Product[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
  currentIndex: number;
  cartCount: number;
  favoriteIds: string[];
  selectedProduct: Product | null;
  selectedShop: string;
  onAddToCart: (product: Product) => void;
  onToggleFavorite: (product: Product) => void;
  onOpenCart: () => void;
  onOpenNotifications: () => void;
  onOpenShop: (shop: string) => void;
  onTabChange: (tab: string) => void;
  onBack: () => void;
  onOpenProductDetails: (product: Product) => void;
  isSuperAdmin?: boolean;
  onOpenAdmin?: () => void;
  banners?: Banner[];
  isProductsLoaded?: boolean;
}

const StackNavigator: React.FC<StackNavigatorProps> = ({ 
  currentScreen, 
  onNavigate,
  user,
  userData,
  role,
  redeemableProducts,
  wheelPrizes,
  globalSettings,
  shops,
  onLogout,
  products,
  searchQuery,
  setSearchQuery,
  selectedTab,
  setSelectedTab,
  currentIndex,
  cartCount,
  favoriteIds,
  selectedProduct,
  selectedShop,
  onAddToCart,
  onToggleFavorite,
  onOpenCart,
  onOpenNotifications,
  onOpenShop,
  onTabChange,
  onBack,
  onOpenProductDetails,
  isSuperAdmin,
  onOpenAdmin,
  banners,
  isProductsLoaded = true
}) => {

  const renderScreen = () => {
    // Allow viewing product details and cart even if not logged in (Guest checkout preparation)
    if (!user && currentScreen !== 'details' && currentScreen !== 'cart') {
      switch (currentScreen) {
        case 'register':
          return (
            <RegisterScreen 
              onNavigateToLogin={() => onNavigate('login')} 
              onRegisterSuccess={() => onNavigate('home')} 
            />
          );
        default:
          return (
            <LoginScreen 
              onNavigateToRegister={() => onNavigate('register')} 
              onLoginSuccess={() => onNavigate('home')} 
            />
          );
      }
    }

    switch (currentScreen) {
      case 'login':
        return (
          <LoginScreen 
            onNavigateToRegister={() => onNavigate('register')} 
            onLoginSuccess={() => onNavigate('home')} 
          />
        );
      case 'home':
        return (
          <HomeScreen 
            products={products}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedTab={selectedTab}
            setSelectedTab={setSelectedTab}
            currentIndex={currentIndex}
            cartCount={cartCount}
            favoriteIds={favoriteIds}
            onProductClick={onOpenProductDetails}
            onAddToCart={onAddToCart}
            onToggleFavorite={onToggleFavorite}
            onOpenCart={onOpenCart}
            onOpenNotifications={onOpenNotifications}
            onOpenShop={onOpenShop}
            onTabChange={onTabChange}
            userDataProp={userData}
            redeemableProductsProp={redeemableProducts}
            wheelPrizesProp={wheelPrizes}
            globalSettingsProp={globalSettings}
            bannersProp={banners}
            isProductsLoadedProps={isProductsLoaded}
          />
        );
      case 'mall':
        return (
          <AurumMall 
            onBack={onBack} 
            onOpenProductDetails={onOpenProductDetails} 
            onAddToCart={onAddToCart}
            selectedCategory={selectedTab}
            setSelectedCategory={setSelectedTab}
            shopsProp={shops}
          />
        );
      case 'cart':
        return <CartScreen onBack={onBack} onNavigate={onNavigate} />;
      case 'details':
        if (!selectedProduct) {
          return (
            <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[#D4AF37] mt-4 font-bold">جاري تحميل المنتج... ⚜️</p>
            </div>
          );
        }
        return (
          <ProductInfo 
            item={selectedProduct} 
            allProducts={products}
            onBack={onBack} 
            onAddToCart={onAddToCart} 
            onNavigate={onNavigate}
            onProductClick={onOpenProductDetails}
          />
        );
      case 'shop_details':
        return (
          <ShopDetails 
            shopName={selectedShop} 
            products={products.slice(0, 3)} // Mocking shop products
            onBack={onBack} 
            onAddToCart={onAddToCart} 
          />
        );
      case 'notifications':
        return <Notifications onBack={onBack} />;
      case 'favorites':
        return (
          <FavoritesScreen 
            onBack={onBack} 
            onProductClick={onOpenProductDetails} 
          />
        );
      case 'orders':
        return <MyOrders onBack={onBack} />;
      case 'design':
        return <ClothingDesignScreen onBack={onBack} />;
      case 'profile':
        return (
          <AddressScreen 
            onBack={onBack} 
            onNavigateToOrders={() => onNavigate('orders')}
            onLogout={onLogout}
            role={role}
            onSwitchToMerchant={() => onNavigate('home')}
            isSuperAdmin={isSuperAdmin}
            onOpenAdmin={onOpenAdmin}
            onTabChange={onTabChange}
          />
        );
      default:
        return (
          <HomeScreen 
            products={products}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedTab={selectedTab}
            setSelectedTab={setSelectedTab}
            currentIndex={currentIndex}
            cartCount={cartCount}
            favoriteIds={favoriteIds}
            onProductClick={onOpenProductDetails}
            onAddToCart={onAddToCart}
            onToggleFavorite={onToggleFavorite}
            onOpenCart={onOpenCart}
            onOpenNotifications={onOpenNotifications}
            onOpenShop={onOpenShop}
            onTabChange={onTabChange}
            userDataProp={userData}
            redeemableProductsProp={redeemableProducts}
            wheelPrizesProp={wheelPrizes}
            globalSettingsProp={globalSettings}
            bannersProp={banners}
          />
        );
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-black">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScreen}
          initial={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.9, filter: 'blur(20px)' }}
          transition={{ 
            duration: 0.8, 
            ease: [0.16, 1, 0.3, 1] 
          }}
          className="w-full min-h-screen"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default StackNavigator;
