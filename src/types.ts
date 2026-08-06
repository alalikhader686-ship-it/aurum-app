export interface Review {
  userId: string;
  userEmail: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  brand?: string;
  price: string;
  image: string;
  images?: string[];
  category: string;
  type?: string;
  description?: string;
  rating?: number;
  reviewsCount?: number;
  variants?: string[];
  location?: string;
  reviews?: Review[];
  isFeatured?: boolean;
  section?: 'home' | 'mall' | 'featured';
  shopId?: string;
  shopName?: string;
  ownerId?: string;
  createdAt?: string;
  isVIPOnly?: boolean;
  isLimitedEdition?: boolean;
  limitedUnits?: number;
  remainingUnits?: number;
  averageRating?: number;
  subCategory?: string;
  availableSizes?: string[];
  availableColors?: string[];
  stock?: number;
  isSale?: boolean;
  oldPrice?: string;
  salePrice?: string;
  currency?: 'SYP' | 'USD';
  newSypPrice?: string;
}

export interface CartItem extends Product {
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  image: string;
  text?: string;
  createdAt: string;
  isOfficial?: boolean;
}

export interface RedeemableProduct {
  id: string;
  name: string;
  image: string;
  pointsCost: number;
  description?: string;
  createdAt?: string;
}

export interface WheelPrize {
  id: string;
  label: string;
  value: number;
  color: string;
  createdAt?: string;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'rejected' | 'cancelled';
  userEmail: string;
  userName?: string;
  phone: string;
  city: string;
  area: string;
  coordinates?: { lat: number; lng: number };
  paymentMethod: string;
  paymentReceipt?: string;
  transactionId?: string;
  telegramChatId?: string;
  telegramUsername?: string;
  cancellationStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  shopIds?: string[];
  merchantIds?: string[];
  createdAt: string;
}

export interface MerchantRequest {
  id: string;
  userId: string;
  shopName: string;
  shopDescription?: string;
  shopCategory?: string;
  userEmail: string;
  phone: string;
  delivery: 'aurum' | 'self';
  plan: 'basic' | 'plus';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface CustomJewelryRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  phone: string;
  description: string;
  imageUrl?: string;
  status: 'pending' | 'reviewed' | 'quoted' | 'rejected' | 'accepted' | 'completed';
  quotedPrice?: string;
  createdAt: string;
}

export interface ClothingDesignRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  phone: string;
  idea: string;
  imageUrl?: string;
  fabricType?: string;
  status: 'pending' | 'reviewed' | 'ordered' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface AurumUser {
  id: string;
  email: string;
  role?: 'admin' | 'merchant' | 'customer';
  points?: number;
  isVIP?: boolean;
  extraSpins?: number;
  lastDailyClaim?: string;
  lastDailySpin?: string;
}

export interface Invoice {
  id: string;
  shopName: string;
  amount: string;
  method: string;
  transactionId: string;
  createdAt: string;
}

export interface Shop {
  id: string;
  name: string;
  description?: string;
  category: string;
  image: string;
  ownerId: string;
  ownerEmail?: string;
  phone?: string;
  telegramChatId?: string;
  plan?: 'basic' | 'plus';
  delivery: 'shop' | 'aurum';
  status?: 'pending' | 'active' | 'rejected';
  createdAt: string;
}

export interface Banner {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  link?: string;
  createdAt: string;
}

export interface GlobalSettings {
  goldenHourEnd?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  bannerDuration?: number;
  adminPhone?: string;
  telegramBotToken?: string;
  telegramAdminChatId?: string;
  telegramBotUsername?: string;
  customerTelegramBotToken?: string;
  customerTelegramBotUsername?: string;
  customerTelegramDefaultChatId?: string;
  marqueeText?: string;
  marqueeType?: string;
  marqueeProductIds?: string[];
}
