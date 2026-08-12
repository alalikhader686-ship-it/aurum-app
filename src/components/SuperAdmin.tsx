import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  ShoppingBag, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  UserPlus,
  Store,
  Clock,
  Package,
  Star,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Pencil,
  User,
  Loader2,
  Sparkles,
  Settings as SettingsIcon,
  Trash2,
  Upload,
  Camera,
  MapPin,
  Gift,
  Truck,
  Database,
  RefreshCw,
  LayoutDashboard,
  TrendingUp,
  CreditCard,
  Bell,
  Gem,
  Share2,
  Scissors,
  MessageCircle,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { buildCustomerApprovalMessage, openWhatsApp } from '../services/whatsappService';
import { sendTelegramBotMessage, buildCustomerTelegramApprovalMessage, openTelegram, sendAutomatedTelegramServer } from '../services/telegramService';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet default marker icons
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import Toast from './Toast';
import { 
  collection, 
  query, 
  doc, 
  updateDoc, 
  setDoc,
  addDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  orderBy,
  onSnapshot,
  getDoc,
  limit,
  where
} from 'firebase/firestore';
import { cn } from '../lib/utils';
import { inventoryService } from '../services/inventoryService';
import { deliveryService } from '../services/deliveryService';
import { handleImageUpload } from '../lib/imageUtils';
import { 
  Product, 
  Story, 
  RedeemableProduct, 
  WheelPrize, 
  Order, 
  MerchantRequest, 
  AurumUser, 
  Invoice,
  CartItem,
  CustomJewelryRequest,
  ClothingDesignRequest,
  Banner
} from '../types';

interface SheinLink {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  link: string;
  notes: string;
  status: 'pending' | 'reviewed' | 'ordered' | 'completed' | 'cancelled';
  createdAt: string;
}

interface SuperAdminProps {
  onBack: () => void;
}

type AdminTab = 'overview' | 'requests' | 'users' | 'orders' | 'invoices' | 'products' | 'stories' | 'settings' | 'vip' | 'rewards' | 'shein' | 'inventory' | 'shops' | 'jewelry_requests' | 'clothing_requests' | 'banners';

interface Shop {
  id: string;
  name: string;
  category: string;
  image: string;
  ownerEmail: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export default function SuperAdmin({ onBack }: SuperAdminProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [requests, setRequests] = useState<MerchantRequest[]>([]);
  const [users, setUsers] = useState<AurumUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pendingCancelOrders, setPendingCancelOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [redeemableProducts, setRedeemableProducts] = useState<RedeemableProduct[]>([]);
  const [wheelPrizes, setWheelPrizes] = useState<WheelPrize[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [sheinLinks, setSheinLinks] = useState<SheinLink[]>([]);
  const [jewelryRequests, setJewelryRequests] = useState<CustomJewelryRequest[]>([]);
  const [clothingRequests, setClothingRequests] = useState<ClothingDesignRequest[]>([]);
  const [sheinSubTab, setSheinSubTab] = useState<'products' | 'links'>('products');
  const [goldenHourMinutes, setGoldenHourMinutes] = useState('60');
  const [telegramSettings, setTelegramSettings] = useState({
    telegramBotToken: '',
    telegramAdminChatId: '',
    telegramBotUsername: '',
    customerTelegramBotToken: '',
    customerTelegramBotUsername: '',
    customerTelegramDefaultChatId: '',
    adminPhone: ''
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [settings, setSettings] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddSheinProduct, setShowAddSheinProduct] = useState(false);
  const [showAddStory, setShowAddStory] = useState(false);
  const [showAddRedeemable, setShowAddRedeemable] = useState(false);
  const [showAddPrize, setShowAddPrize] = useState(false);
  const [showAddShop, setShowAddShop] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [editingUserPoints, setEditingUserPoints] = useState<{ id: string, points: number } | null>(null);
  const [sizeInput, setSizeInput] = useState('');
  const [colorNameInput, setColorNameInput] = useState('');
  const [colorHexInput, setColorHexInput] = useState('#000000');
  const [selectedZoomImage, setSelectedZoomImage] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [orderLimit, setOrderLimit] = useState(50);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const tabs: { id: AdminTab, label: string, icon: React.ElementType }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
    { id: 'requests', label: 'طلبات الحجز', icon: UserPlus },
    { id: 'users', label: 'المستخدمين', icon: Users },
    { id: 'products', label: 'المنتجات', icon: Package },
    { id: 'shein', label: 'شي إن', icon: ShoppingBag },
    { id: 'stories', label: 'اللحظات', icon: Sparkles },
    { id: 'orders', label: 'الطلبات', icon: ShoppingBag },
    { id: 'rewards', label: 'المكافآت', icon: Gift },
    { id: 'vip', label: 'VIP', icon: Star },
    { id: 'invoices', label: 'الفواتير', icon: FileText },
    { id: 'settings', label: 'الإعدادات', icon: SettingsIcon },
    { id: 'inventory', label: 'المخزون', icon: Database },
    { id: 'shops', label: 'المتاجر', icon: Store },
    { id: 'jewelry_requests', label: 'طلبات التفصيل الخاصة', icon: Gem },
    { id: 'clothing_requests', label: 'طلبات تفصيل ألبسة', icon: Scissors },
    { id: 'banners', label: 'البانرات والإعلانات', icon: Camera },
  ];

  const [banners, setBanners] = useState<Banner[]>([]);
  const [showAddBanner, setShowAddBanner] = useState(false);
  const [newBanner, setNewBanner] = useState({
    image: '',
    title: '',
    subtitle: '',
    link: ''
  });

  const [newRedeemable, setNewRedeemable] = useState({
    name: '',
    image: '',
    pointsCost: 500,
    description: ''
  });

  const [newSheinProduct, setNewSheinProduct] = useState({
    name: '',
    price: '',
    image: '',
    images: [] as string[],
    description: '',
    brand: 'SHEIN',
    availableSizes: [] as string[],
    availableColors: [] as string[],
    shopId: 'admin',
    shopName: 'إدارة AURUM',
    isSale: false,
    oldPrice: '',
    salePrice: '',
    currency: 'SYP' as 'SYP' | 'USD',
    newSypPrice: '',
    isFeatured: false,
    isLimitedEdition: false,
    limitedUnits: 10,
    remainingUnits: 10
  });

  const [newPrize, setNewPrize] = useState({
    label: '',
    value: 50,
    color: '#D4AF37'
  });

  const [newShop, setNewShop] = useState({
    name: '',
    description: '',
    category: 'عام',
    image: 'https://picsum.photos/seed/shop/800/1000',
    ownerEmail: 'admin@aurum.com',
    ownerId: 'admin',
    plan: 'plus',
    delivery: 'aurum',
    status: 'active'
  });

  const handleAddSheinProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const selectedShop = shops.find(s => s.id === newSheinProduct.shopId);
      const allImages = [newSheinProduct.image, ...newSheinProduct.images].filter(img => !!img);
      
      let calculatedNewSyp = '';
      if (newSheinProduct.currency === 'SYP') {
        const numericPrice = parseInt(newSheinProduct.price.replace(/[^0-9]/g, '')) || 0;
        calculatedNewSyp = (numericPrice / 100).toLocaleString();
      }

      const productData = {
        ...newSheinProduct,
        images: allImages,
        category: 'شي ان',
        shopName: selectedShop ? selectedShop.name : 'إدارة AURUM',
        ownerId: 'admin',
        section: 'home',
        isFeatured: newSheinProduct.isFeatured,
        isVIPOnly: false,
        stock: 99,
        isSale: newSheinProduct.isSale || false,
        oldPrice: newSheinProduct.oldPrice || '',
        salePrice: newSheinProduct.salePrice || '',
        currency: newSheinProduct.currency || 'SYP',
        newSypPrice: calculatedNewSyp,
        isLimitedEdition: newSheinProduct.isLimitedEdition || false,
        limitedUnits: parseInt(newSheinProduct.limitedUnits?.toString() || '0') || 0,
        remainingUnits: parseInt(newSheinProduct.remainingUnits?.toString() || '0') || 0,
        updatedAt: new Date().toISOString()
      };

      if (editingProductId) {
        await updateDoc(doc(db, 'products', editingProductId), productData);
        alert("تم تحديث منتج شي إن بنجاح ⚜️");
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          rating: 4.8 + Math.random() * 0.2,
          type: 'Exclusive',
          createdAt: new Date().toISOString()
        });
        alert("تم إضافة منتج شي إن بنجاح ⚜️ سيظهر للزبائن مع إشعار التوصيل الدولي (15 يوم).");
      }

      setShowAddSheinProduct(false);
      setEditingProductId(null);
      setNewSheinProduct({
        name: '',
        price: '',
        image: '',
        images: [] as string[],
        description: '',
        brand: 'SHEIN',
        availableSizes: [] as string[],
        availableColors: [] as string[],
        shopId: 'admin',
        shopName: 'إدارة AURUM',
        isSale: false,
        oldPrice: '',
        salePrice: '',
        currency: 'SYP' as 'SYP' | 'USD',
        newSypPrice: '',
        isFeatured: false,
        isLimitedEdition: false,
        limitedUnits: 10,
        remainingUnits: 10
      });
    } catch (err) {
      console.error("Error saving Shein product:", err);
      alert("حدث خطأ أثناء حفظ المنتج");
    } finally {
      setLoading(false);
    }
  };

  const openEditProduct = (p: Product) => {
    if (p.category === 'شي ان') {
      const mainImg = p.image || p.images?.[0] || '';
      const otherImgs = (p.images || []).filter(img => img !== mainImg);
      setNewSheinProduct({
        name: p.name,
        price: p.price,
        image: mainImg,
        images: otherImgs,
        description: p.description || '',
        brand: p.brand || 'SHEIN',
        availableSizes: p.availableSizes || [],
        availableColors: p.availableColors || [],
        shopId: p.shopId || 'admin',
        shopName: p.shopName || 'إدارة AURUM',
        isSale: p.isSale || false,
        oldPrice: p.oldPrice || '',
        salePrice: p.salePrice || '',
        currency: p.currency || 'SYP',
        newSypPrice: p.newSypPrice || '',
        isFeatured: p.isFeatured || false,
        isLimitedEdition: p.isLimitedEdition || false,
        limitedUnits: p.limitedUnits || 0,
        remainingUnits: p.remainingUnits || 0
      });
      setEditingProductId(p.id);
      setShowAddSheinProduct(true);
    } else {
      const mainImg = p.image || p.images?.[0] || '';
      const otherImgs = (p.images || []).filter(img => img !== mainImg);
      setNewProduct({
        name: p.name,
        price: p.price,
        category: p.category || 'عطور',
        description: p.description || '',
        image: mainImg,
        images: otherImgs,
        section: p.section || 'home',
        isFeatured: p.isFeatured || false,
        availableSizes: p.availableSizes || [],
        availableColors: p.availableColors || [],
        stock: p.stock || 10,
        shopId: p.shopId || 'admin',
        isSale: p.isSale || false,
        oldPrice: p.oldPrice || '',
        salePrice: p.salePrice || '',
        currency: p.currency || 'SYP',
        newSypPrice: p.newSypPrice || '',
        isLimitedEdition: p.isLimitedEdition || false,
        limitedUnits: p.limitedUnits || 0,
        remainingUnits: p.remainingUnits || 0
      });
      setEditingProductId(p.id);
      setShowAddProduct(true);
    }
  };

  const handleApproveCancellation = async (orderId: string) => {
    if (!window.confirm("هل أنت متأكد من الموافقة على الحذف؟ سيتم مسح الطلب نهائياً من قاعدة البيانات ⚜️")) return;
    setDeletingId(orderId);
    setIsDeleting(true);
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      await deleteDoc(orderRef);

      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        await addDoc(collection(db, 'notifications'), {
          userId: orderData.userId,
          orderId: orderId,
          status: 'cancelled',
          message: "تمت الموافقة على طلبك بحذف الطلب، وتمت إزالته من النظام بنجاح ⚜️",
          read: false,
          createdAt: new Date().toISOString()
        });
      }
      setToast({ message: "تم تنفيذ الحذف بنجاح ⚜️", visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    } catch (err) {
      console.error("Error approving cancellation:", err);
      alert("فشل تنفيذ الحذف: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeletingId(null);
      setIsDeleting(false);
    }
  };

  const handleRejectCancellation = async (orderId: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      await updateDoc(orderRef, {
        cancellationStatus: 'rejected'
      });

      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        await addDoc(collection(db, 'notifications'), {
          userId: orderData.userId,
          orderId: orderId,
          status: 'rejected',
          message: "نعتذر، طلبك قيد التوصيل بالفعل ولا يمكن إلغاؤه حالياً 🛵",
          read: false,
          createdAt: new Date().toISOString()
        });
      }
      alert("تم رفض طلب الحذف بنجاح");
    } catch (err) {
      console.error("Error rejecting cancellation:", err);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus
      });

      // Execute side effects in safe background blocks to ensure status is updated and confirmed instantly
      getDoc(orderRef).then(async (orderSnap) => {
        if (orderSnap.exists()) {
          const orderData = orderSnap.data();

          // 1. Award points if delivered
          if (newStatus === 'delivered' && orderData.userId) {
            try {
              const userRef = doc(db, 'users', orderData.userId);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                const earnedPoints = Math.floor((orderData.total || 0) / 1000); // 1 point per 1000 SP
                await updateDoc(userRef, {
                  points: ((userData.points as number) || 0) + earnedPoints
                });
              }
            } catch (err) {
              console.warn("AURUM LOGISTICS ⚠️: فشل منح النقاط للمستخدم:", err);
            }
          }

          // 2. Notify external inventory system for tracking if confirmed
          if (newStatus === 'confirmed') {
            inventoryService.notifySale({
              id: orderId,
              items: orderData.items || [],
              total: orderData.total || 0,
              userEmail: orderData.userEmail,
              customerName: orderData.userName,
              status: newStatus
            }).catch(e => {
              console.warn("AURUM LOGISTICS ⚠️: فشل تحديث نظام المخزون الخارجي:", e);
            });

            // Send order to delivery app
            deliveryService.sendOrderToDeliveryApp({
              id: orderId,
              items: orderData.items || [],
              total: orderData.total || 0,
              userName: orderData.userName,
              phone: orderData.phone || '',
              city: orderData.city || '',
              area: orderData.area || '',
              coordinates: orderData.coordinates,
              paymentMethod: orderData.paymentMethod || 'CASH'
            }).then(() => {
              console.log("AURUM LOGISTICS 📦: تم إرسال الطلبية بنجاح لتطبيق الدليفري");
            }).catch(e => {
              console.warn("AURUM LOGISTICS ⚠️: فشل إرسال الطلب إلى تطبيق الدليفري الخارجي:", e);
            });

            // Send Automated Customer Telegram Bot Invoice & Approval from Server
            const fullOrder = { id: orderId, ...orderData } as Order;
            const customerTgMsg = buildCustomerTelegramApprovalMessage(fullOrder);
            
            // Dedicated Customer Telegram Bot Token
            const custBotToken = settings?.customerTelegramBotToken || telegramSettings.customerTelegramBotToken;
            // Customer Telegram recipient ONLY (do not fall back to admin chat ID)
            const customerRecipient = orderData.telegramChatId || orderData.telegramUsername || (orderData.phone && orderData.phone.startsWith('@') ? orderData.phone : null);

            if (custBotToken && customerRecipient) {
              sendAutomatedTelegramServer(custBotToken, customerRecipient, customerTgMsg).then(res => {
                if (res.success) {
                  console.log(`AURUM TELEGRAM BOT 🤖: Customer invoice sent automatically to customer (${customerRecipient}) via Customer Bot!`);
                } else {
                  console.warn("AURUM TELEGRAM BOT ⚠️ Customer Bot error:", res.error);
                }
              }).catch(err => console.warn("Telegram Customer Bot automated dispatch warning:", err));
            } else {
              console.log("AURUM TELEGRAM BOT ℹ️: Customer Telegram Username/ID was not provided by customer on this order.");
            }

            // WhatsApp link fallback
            if (orderData.phone) {
              const customerMsg = buildCustomerApprovalMessage(fullOrder);
              openWhatsApp(orderData.phone, customerMsg);
            }
          }

          // 3. Add Notification
          if (orderData.userId) {
            try {
              await addDoc(collection(db, 'notifications'), {
                userId: orderData.userId,
                orderId: orderId,
                status: newStatus,
                message: `تم تحديث حالة طلبك إلى: ${
                  newStatus === 'confirmed' ? 'تم التأكيد ⚜️' : 
                  newStatus === 'shipping' ? 'قيد التوصيل 🛵' : 
                  newStatus === 'delivered' ? 'تم التوصيل 🎉' : 'قيد المراجعة ⚜️'
                }`,
                read: false,
                createdAt: new Date().toISOString()
              });
            } catch (err) {
              console.warn("AURUM LOGISTICS ⚠️: فشل إضافة إشعار للزبون:", err);
            }
          }
        }
      }).catch(err => {
        console.warn("AURUM LOGISTICS ⚠️: فشل استعلام معلومات الطلب للتأثيرات الجانبية:", err);
      });

      alert("تم تحديث حالة الطلب بنجاح ⚜️");
    } catch (err) {
      console.error("Error updating order status:", err);
      alert("⚠️ فشل تحديث حالة الطلب: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm("⚠️ هل أنت متأكد من حذف هذا الطلب نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذه الخطوة ⚜️")) return;
    
    setDeletingId(orderId);
    setIsDeleting(true);
    console.log("Attempting to delete order:", orderId);
    try {
      const orderRef = doc(db, 'orders', orderId);
      await deleteDoc(orderRef);
      
      setSelectedOrderIds(prev => prev.filter(id => id !== orderId));
      setToast({ message: "تم حذف الطلب نهائياً من النظام ⚜️", visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    } catch (err) {
      console.error("Critical Error deleting order:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert("⚠️ فشل حذف الطلب. السبب: " + errorMessage);
    } finally {
      setDeletingId(null);
      setIsDeleting(false);
    }
  };

  const handleBulkDeleteOrders = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!window.confirm(`⚠️ هل أنت متأكد من حذف ${selectedOrderIds.length} طلبات نهائياً من قاعدة البيانات؟`)) return;

    setIsDeleting(true);
    console.log("Attempting bulk delete for ids:", selectedOrderIds);
    try {
      const results = await Promise.allSettled(
        selectedOrderIds.map(id => deleteDoc(doc(db, 'orders', id)))
      );
      
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        console.error("Some bulk deletes failed:", failed);
        alert(`⚠️ تم حذف البعض وفشل البعض الآخر. (نجح: ${selectedOrderIds.length - failed.length}, فشل: ${failed.length})`);
      } else {
        setToast({ message: "تم حذف كافة الطلبات المحددة بنجاح ⚜️", visible: true });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
      }
      
      setSelectedOrderIds([]);
    } catch (err) {
      console.error("Critical Bulk Delete Error:", err);
      alert("⚠️ فشلت عملية الحذف الجماعي بالكامل");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllOrders = async () => {
    if (orders.length === 0) return;
    if (!window.confirm(`⚠️ تحذير شديد: هل أنت متأكد من حذف كافة الطلبات (${orders.length}) من قاعدة البيانات نهائياً؟ لا يمكن التراجع عن هذه العملية ⚜️`)) return;

    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      orders.forEach(order => {
        batch.delete(doc(db, 'orders', order.id));
      });
      await batch.commit();
      
      setToast({ message: "تم حذف كافة الطلبات بنجاح ⚜️", visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
      setSelectedOrderIds([]);
    } catch (err) {
      console.error("Delete All Error:", err);
      alert("⚠️ فشلت عملية حذف كافة الطلبات");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleVIP = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isVIP: !currentStatus
      });
      alert(!currentStatus ? "تم تفعيل عضوية VIP للمستخدم ⚜️" : "تمت إزالة عضوية VIP");
    } catch (err) {
      console.error("Error toggling VIP:", err);
    }
  };

  const handleUpdateUserPoints = async () => {
    if (!editingUserPoints) return;
    try {
      await updateDoc(doc(db, 'users', editingUserPoints.id), {
        points: editingUserPoints.points
      });
      alert("تم تحديث نقاط المستخدم بنجاح ⚜️");
      setEditingUserPoints(null);
    } catch (err) {
      console.error("Error updating user points:", err);
    }
  };

  const handleUpdateBanner = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        ...bannerSettings,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert("تم تحديث إعدادات البانر بنجاح ⚜️");
    } catch (err) {
      console.error("Error updating banner:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!window.confirm("⚠️ هل أنت متأكد من حذف فاتورة الإيجار هذه؟")) return;
    setIsDeleting(true);
    setDeletingId(invoiceId);
    try {
      await deleteDoc(doc(db, 'rent_invoices', invoiceId));
      setToast({ message: "تم حذف فاتورة الإيجار ⚜️", visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    } catch (err) {
      console.error("Error deleting invoice:", err);
      alert("فشل حذف الفاتورة: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const handleDeleteProduct = (id: string) => {
    setProductToDelete(id);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'products', productToDelete));
      setToast({ message: "تم حذف المنتج بنجاح ⚜️", visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
      setProductToDelete(null);
    } catch (err) {
      console.error("Error deleting product:", err);
      alert("فشل حذف المنتج: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteNonAdminProducts = async () => {
    if (confirm("⚠️ تحذير: سيتم حذف جميع منتجات التجار والباعة وتبقى فقط منتجات الإدارة. هل تريد الاستمرار؟")) {
      setLoading(true);
      try {
        const nonAdmin = products.filter(p => p.shopId !== 'admin');
        const batch = nonAdmin.map(p => deleteDoc(doc(db, 'products', p.id)));
        await Promise.all(batch);
        alert(`تم حذف ${nonAdmin.length} منتج بنجاح ⚜️`);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleUpdateSheinLinkStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'shein_links', id), {
        status: newStatus
      });
      alert("تم تحديث حالة الرابط بنجاح ⚜️");
    } catch (err) {
      console.error("Error updating shein link status:", err);
    }
  };

  const handleDeleteSheinLink = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الرابط؟")) return;
    setDeletingId(id);
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'shein_links', id));
      setToast({ message: "تم حذف الرابط بنجاح ⚜️", visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    } catch (err) {
      console.error("Error deleting shein link:", err);
      alert("فشل حذف الرابط");
    } finally {
      setDeletingId(null);
      setIsDeleting(false);
    }
  };

  const [marqueeSettings, setMarqueeSettings] = useState({
    marqueeText: 'أهلاً بكم في عالم الفخامة.. AURUM يصحبكم في رحلة ملكية ⚜️',
    marqueeType: 'text' as 'text' | 'products',
    marqueeProductIds: [] as string[]
  });

  const [bannerSettings, setBannerSettings] = useState({
    bannerTitle: 'عروض AURUM الملكية ⚜️',
    bannerSubtitle: 'مجموعة حصرية ⚜️',
    bannerDuration: 5,
  });

  const handleUpdateMarquee = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        ...marqueeSettings,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert("تم تحديث شريط الإعلان بنجاح ⚜️");
    } catch (err) {
      console.error("Error updating marquee:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGoldenHour = async () => {
    setLoading(true);
    try {
      const minutes = parseInt(goldenHourMinutes) || 0;
      const endTime = new Date(Date.now() + minutes * 60000).toISOString();
      await setDoc(doc(db, 'settings', 'global'), {
        goldenHourEnd: endTime,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert("تم تحديث وقت الساعة الذهبية بنجاح ⚜️");
    } catch (err) {
      console.error("Error updating settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTelegramSettings = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        ...telegramSettings,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert("تم حفظ إعدادات التلجرام والبوت بنجاح ⚜️");
    } catch (err) {
      console.error("Error updating Telegram settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestTelegramBot = async () => {
    if (!telegramSettings.telegramBotToken || !telegramSettings.telegramAdminChatId) {
      alert("يرجى إدخال توكن البوت وآيدي المحادثة أولاً ⚠️");
      return;
    }
    setLoading(true);
    const testMsg = "🤖 <b>اختبار ربط بوت التلجرام - AURUM LUXURY MALL</b> ⚜️\n\nتهانينا! البوت متصل بنجاح وسيقوم بإرسال جميع فواتير الطلبات الجديدة والموافقات تلقائياً هنا.";
    const ok = await sendTelegramBotMessage(
      telegramSettings.telegramBotToken,
      telegramSettings.telegramAdminChatId,
      testMsg
    );
    setLoading(false);
    if (ok) {
      alert("✅ تم إرسال رسالة الاختبار بنجاح إلى حساب التلجرام! النظام متصل بنجاح 100%");
    } else {
      alert("❌ فشل إرسال الرسالة. يرجى التأكد من التوكن وآيدي المحادثة وأنك أرسلت /start للبوت في التلجرام.");
    }
  };

  const handleTestCustomerTelegramBot = async () => {
    const custToken = telegramSettings.customerTelegramBotToken;
    const targetChatId = telegramSettings.customerTelegramDefaultChatId || telegramSettings.telegramAdminChatId;

    if (!custToken) {
      alert("يرجى إدخال 'توكن بوت الزبائن' أولاً ⚠️");
      return;
    }
    if (!targetChatId) {
      alert("يرجى إدخال Chat ID للآدمن أو Chat ID تجريبي للزبون 📱");
      return;
    }

    setLoading(true);
    const testMsg = "🤖 <b>اختبار إرسال الفواتير التلقائي (بوت الزبائن بالسيرفر) - AURUM LUXURY MALL</b> ⚜️\n\nأهلاً بك! هذا البوت مخصص لإرسال الفواتير وتأكيد الموافقات تلقائياً من السيرفر للزبائن فور الضغط على 'موافق'.";

    const res = await sendAutomatedTelegramServer(custToken, targetChatId, testMsg);
    setLoading(false);

    if (res.success) {
      alert("✅ تم إرسال الرسالة عبر 'بوت الزبائن' آلياً من السيرفر بنجاح! الإعدادات تعمل 100%");
    } else {
      alert(`⚠️ نتيجة الاختبار عبر السيرفر:\n${res.error || 'فشل الاتصال بـ Telegram API. تأكد من توكن البوت والـ Chat ID وأنك بدأت المحادثة مع البوت (/start)'}`);
    }
  };

  const handleDeleteStory = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه اللحظة؟")) return;
    try {
      await deleteDoc(doc(db, 'stories', id));
      alert("تم حذف اللحظة بنجاح ⚜️");
    } catch (err) {
      console.error("Error deleting story:", err);
    }
  };

  const [newStory, setNewStory] = useState({
    image: 'https://picsum.photos/seed/moment/800/1200',
    text: '',
    userName: 'إدارة AURUM',
    isOfficial: true
  });

  const handleAddStory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'stories'), {
        ...newStory,
        userId: 'admin',
        createdAt: new Date().toISOString()
      });
      setShowAddStory(false);
      setNewStory({
        image: 'https://picsum.photos/seed/moment/800/1200',
        text: '',
        userName: 'إدارة AURUM',
        isOfficial: true
      });
      alert("تمت إضافة اللحظة بنجاح ⚜️");
    } catch (err) {
      console.error("Error adding story:", err);
    } finally {
      setLoading(false);
    }
  };

  const LUXURY_IMAGES = [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1542491595-3015c178ce0a?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1583333222044-589c6e2e5a00?q=80&w=1000&auto=format&fit=crop'
  ];

  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    category: 'عطور',
    description: '',
    image: 'https://picsum.photos/seed/admin/800/1000',
    images: [] as string[],
    section: 'home',
    availableSizes: [] as string[],
    availableColors: [] as string[],
    stock: 10,
    shopId: 'admin',
    isSale: false,
    oldPrice: '',
    salePrice: '',
    currency: 'SYP' as 'SYP' | 'USD',
    newSypPrice: '',
    isLimitedEdition: false,
    limitedUnits: 10,
    remainingUnits: 10,
    isFeatured: true
  });

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'banners'), {
        ...newBanner,
        createdAt: new Date().toISOString()
      });
      setShowAddBanner(false);
      setNewBanner({ image: '', title: '', subtitle: '', link: '' });
      alert("تم إضافة الإعلان بنجاح ⚜️");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm("حذف هذا الإعلان؟")) return;
    await deleteDoc(doc(db, 'banners', id));
  };

  const handleAddAdminProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const selectedShop = shops.find(s => s.id === newProduct.shopId);
      const allImages = [newProduct.image, ...newProduct.images].filter(img => !!img);
      
      let calculatedNewSyp = '';
      if (newProduct.currency === 'SYP') {
        const numericPrice = parseInt(newProduct.price.replace(/[^0-9]/g, '')) || 0;
        calculatedNewSyp = (numericPrice / 100).toLocaleString();
      }

      const productData = {
        ...newProduct,
        images: allImages,
        shopName: selectedShop ? selectedShop.name : 'إدارة AURUM',
        ownerId: 'admin',
        isSale: newProduct.isSale || false,
        oldPrice: newProduct.oldPrice || '',
        salePrice: newProduct.salePrice || '',
        currency: newProduct.currency || 'SYP',
        newSypPrice: calculatedNewSyp,
        isFeatured: newProduct.isFeatured,
        isLimitedEdition: newProduct.isLimitedEdition || false,
        limitedUnits: parseInt(newProduct.limitedUnits?.toString() || '0') || 0,
        remainingUnits: parseInt(newProduct.remainingUnits?.toString() || '0') || 0,
        updatedAt: new Date().toISOString()
      };

      if (editingProductId) {
        await updateDoc(doc(db, 'products', editingProductId), productData);
        alert("تم تحديث المنتج بنجاح ⚜️");
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          ratings: [],
          averageRating: 0,
          createdAt: new Date().toISOString()
        });
        alert("تم إضافة المنتج للواجهة الرئيسية بنجاح ⚜️");
      }

      setShowAddProduct(false);
      setEditingProductId(null);
      setNewProduct({
        name: '',
        price: '',
        category: 'عطور',
        description: '',
        image: 'https://picsum.photos/seed/admin/800/1000',
        images: [] as string[],
        section: 'home',
        isFeatured: true,
        availableSizes: [] as string[],
        availableColors: [] as string[],
        stock: 10,
        shopId: 'admin',
        isSale: false,
        oldPrice: '',
        salePrice: '',
        currency: 'SYP',
        newSypPrice: '',
        isLimitedEdition: false,
        limitedUnits: 10,
        remainingUnits: 10
      });
    } catch (err) {
      console.error("Error saving admin product:", err);
      alert("حدث خطأ أثناء حفظ المنتج");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    
    // Real-time listeners for admin data
    const unsubRequests = onSnapshot(collection(db, 'merchant_requests'), (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MerchantRequest)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AurumUser)));
    });
    
    // Optimized order fetching with limit and more efficient unique filtering
    const ordersQuery = query(
      collection(db, 'orders'), 
      orderBy('createdAt', 'desc'),
      limit(orderLimit + 1) // Fetch one more to see if there's more
    );

    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      // Efficient unique filter O(N)
      const seenIds = new Set();
      const uniqueOrders: Order[] = [];
      for (const order of allOrders) {
        if (!seenIds.has(order.id)) {
          seenIds.add(order.id);
          uniqueOrders.push(order);
        }
      }
      
      // Since we want to show only limited orders for performance
      const hasMore = uniqueOrders.length > orderLimit;
      const displayedOrders = uniqueOrders.slice(0, orderLimit);
      setOrders(displayedOrders);
      setHasMoreOrders(hasMore);
      setLoading(false);
    }, (err) => {
      console.error("Admin Orders Snapshot Error:", err);
      setToast({ message: `خطأ في جلب الطلبات: ${err.message}`, visible: true });
    });

    // Special listener for pending cancellations to ensure they are always visible
    const unsubPendingCancels = onSnapshot(
      query(collection(db, 'orders'), where('cancellationStatus', '==', 'pending')),
      (snapshot) => {
        setPendingCancelOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      }
    );

    const unsubInvoices = onSnapshot(collection(db, 'rent_invoices'), (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
    });

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const unsubStories = onSnapshot(collection(db, 'stories'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
      setStories(data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSettings(data);
        if (data.marqueeText) {
          setMarqueeSettings({
            marqueeText: data.marqueeText,
            marqueeType: data.marqueeType || 'text',
            marqueeProductIds: data.marqueeProductIds || []
          });
        }
        if (data.bannerTitle) {
          setBannerSettings({
            bannerTitle: data.bannerTitle,
            bannerSubtitle: data.bannerSubtitle || '',
            bannerDuration: data.bannerDuration || 5
          });
        }
        setTelegramSettings({
          telegramBotToken: data.telegramBotToken || '',
          telegramAdminChatId: data.telegramAdminChatId || '',
          telegramBotUsername: data.telegramBotUsername || '',
          customerTelegramBotToken: data.customerTelegramBotToken || '',
          customerTelegramBotUsername: data.customerTelegramBotUsername || '',
          customerTelegramDefaultChatId: data.customerTelegramDefaultChatId || '',
          adminPhone: data.adminPhone || ''
        });
      }
    });

    const unsubRedeemable = onSnapshot(collection(db, 'redeemable_products'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RedeemableProduct));
      setRedeemableProducts(data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'redeemable_products');
    });

    const unsubPrizes = onSnapshot(collection(db, 'wheel_prizes'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WheelPrize));
      setWheelPrizes(data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'wheel_prizes');
    });

    const unsubShops = onSnapshot(collection(db, 'shops'), (snapshot) => {
      setShops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop)));
    });

    onSnapshot(collection(db, 'shein_links'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SheinLink));
      setSheinLinks(data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'shein_links'));

    onSnapshot(collection(db, 'clothing_design_requests'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClothingDesignRequest));
      setClothingRequests(data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'clothing_design_requests'));

    onSnapshot(collection(db, 'custom_jewelry_requests'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomJewelryRequest));
      setJewelryRequests(data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'custom_jewelry_requests'));

    onSnapshot(collection(db, 'banners'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      setBanners(data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'banners'));

    setLoading(false);

    return () => {
      unsubRequests();
      unsubUsers();
      unsubOrders();
      unsubPendingCancels();
      unsubInvoices();
      unsubProducts();
      unsubStories();
      unsubSettings();
      unsubRedeemable();
      unsubPrizes();
      unsubShops();
      // Snapshots above are now handled by the outer cleanup if refactored or just let them be for now
    };
  }, [orderLimit]);

  const handleAddRedeemable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const rewardData = {
        ...newRedeemable,
        updatedAt: new Date().toISOString()
      };

      if (editingRewardId) {
        await updateDoc(doc(db, 'redeemable_products', editingRewardId), rewardData);
        alert("تم تحديث المكافأة بنجاح ⚜️");
      } else {
        await addDoc(collection(db, 'redeemable_products'), {
          ...rewardData,
          createdAt: new Date().toISOString()
        });
        alert("تم إضافة منتج الاستبدال بنجاح ⚜️");
      }
      setShowAddRedeemable(false);
      setEditingRewardId(null);
      setNewRedeemable({ name: '', image: '', pointsCost: 500, description: '' });
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ المكافأة");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrize = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const prizeData = {
        ...newPrize,
        updatedAt: new Date().toISOString()
      };

      if (editingPrizeId) {
        await updateDoc(doc(db, 'wheel_prizes', editingPrizeId), prizeData);
        alert("تم تحديث الجائزة بنجاح ⚜️");
      } else {
        if (wheelPrizes.length >= 8) {
          alert("لا يمكن إضافة أكثر من 8 جوائز للعجلة");
          return;
        }
        await addDoc(collection(db, 'wheel_prizes'), {
          ...prizeData,
          createdAt: new Date().toISOString()
        });
        alert("تم إضافة الجائزة بنجاح ⚜️");
      }
      setShowAddPrize(false);
      setEditingPrizeId(null);
      setNewPrize({ label: '', value: 50, color: '#D4AF37' });
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ الجائزة");
    } finally {
      setLoading(false);
    }
  };

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const shopData = {
        ...newShop,
        updatedAt: new Date().toISOString()
      };

      if (editingShopId) {
        await updateDoc(doc(db, 'shops', editingShopId), shopData);
        alert("تم تحديث المتجر بنجاح ⚜️");
      } else {
        await addDoc(collection(db, 'shops'), {
          ...shopData,
          createdAt: new Date().toISOString()
        });
        alert("تم إنشاء المتجر بنجاح ⚜️");
      }
      setShowAddShop(false);
      setEditingShopId(null);
      setNewShop({
        name: '',
        description: '',
        category: 'عام',
        image: 'https://picsum.photos/seed/shop/800/1000',
        ownerEmail: 'admin@aurum.com',
        ownerId: 'admin',
        plan: 'plus',
        delivery: 'aurum',
        status: 'active'
      });
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ المتجر");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMerchant = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المتجر؟ جميع منتجاته ستبقى منسوبة إليه لكن المتجر نفسه سيختفي ⚜️")) return;
    try {
      await deleteDoc(doc(db, 'shops', id));
      alert("تم حذف المتجر بنجاح ⚜️");
    } catch (err) {
      console.error(err);
    }
  };


  const openEditReward = (p: RedeemableProduct) => {
    setNewRedeemable({
      name: p.name,
      image: p.image || '',
      pointsCost: p.pointsCost || 0,
      description: p.description || ''
    });
    setEditingRewardId(p.id);
    setShowAddRedeemable(true);
  };
  
  const openEditPrize = (p: WheelPrize) => {
    setNewPrize({
      label: p.label,
      value: p.value || 0,
      color: p.color || '#D4AF37'
    });
    setEditingPrizeId(p.id);
    setShowAddPrize(true);
  };
  
  const openEditShop = (shop: Shop) => {
    setNewShop({
      name: shop.name || '',
      description: shop.description || '',
      category: shop.category || 'عام',
      image: shop.image || '',
      ownerEmail: shop.ownerEmail || '',
      ownerId: shop.ownerId || '',
      plan: shop.plan || 'plus',
      delivery: shop.delivery || 'aurum',
      status: shop.status || 'active'
    });
    setEditingShopId(shop.id);
    setShowAddShop(true);
  };

  const handleDeleteShop = async (shopId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المتجر؟ سيتم حذف بياناته بالكامل.")) return;
    try {
      await deleteDoc(doc(db, 'shops', shopId));
      alert("تم حذف المتجر بنجاح");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRedeemable = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'redeemable_products', id));
      try {
        localStorage.removeItem('aurum_cached_redeemable_products');
      } catch (e) {
        console.error(e);
      }
    } catch (err) {
      console.error("Failed to delete redeemable product:", err);
      alert("حدث خطأ أثناء حذف المكافأة");
    }
  };

  const handleDeleteAllRedeemables = async () => {
    try {
      const snap = await getDocs(collection(db, 'redeemable_products'));
      if (snap.empty) {
        alert("لا توجد مكافآت لحذفها");
        return;
      }
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      try {
        localStorage.removeItem('aurum_cached_redeemable_products');
      } catch (e) {
        console.error(e);
      }
      alert("تم حذف جميع مكافآت الاستبدال بنجاح ⚜️");
    } catch (err) {
      console.error("Failed to delete all redeemable products:", err);
      alert("حدث خطأ أثناء حذف جميع المكافآت");
    }
  };

  const handleDeletePrize = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'wheel_prizes', id));
      try {
        localStorage.removeItem('aurum_cached_wheel_prizes');
      } catch (e) {
        console.error(e);
      }
    } catch (err) {
      console.error("Failed to delete prize:", err);
      alert("حدث خطأ أثناء حذف الجائزة");
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleApproveMerchant = async (request: any) => {
    try {
      const requestId = request.id as string;
      const userId = request.userId as string;
      const shopName = request.shopName as string;

      // 1. Update request status
      await updateDoc(doc(db, 'merchant_requests', requestId), {
        status: 'approved'
      });

      // 2. Update user role to merchant
      await updateDoc(doc(db, 'users', userId), {
        role: 'merchant'
      });

      // 3. Create initial shop entry
      await setDoc(doc(db, 'shops', userId), {
        name: shopName,
        ownerId: request.userId,
        ownerEmail: request.userEmail,
        plan: request.plan,
        delivery: request.delivery,
        status: 'active',
        category: request.shopCategory || 'عام',
        description: request.shopDescription || '',
        image: 'https://picsum.photos/seed/shop/800/1000',
        createdAt: new Date().toISOString()
      });

      alert(`تمت ترقية ${request.userEmail} إلى تاجر وتفعيل متجره بنجاح ⚜️`);
    } catch (err) {
      console.error("Error approving merchant:", err);
      alert("حدث خطأ أثناء التفعيل.");
    }
  };

  const handlePromoteToMerchant = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: 'merchant'
      });
      alert("تمت ترقية المستخدم إلى تاجر بنجاح ⚜️");
    } catch (err) {
      console.error("Error promoting user:", err);
    }
  };

  const handleToggleFeatured = async (productId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'products', productId), {
        isFeatured: !currentStatus
      });
      alert(!currentStatus ? "تم نقل المنتج للواجهة الرئيسية ⚜️" : "تمت إزالة المنتج من الواجهة الرئيسية");
    } catch (err) {
      console.error("Error toggling featured:", err);
    }
  };

  const handleToggleVIPProduct = async (productId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'products', productId), {
        isVIPOnly: !currentStatus
      });
      alert(!currentStatus ? "تم تحديد المنتج كحصري لـ VIP ⚜️" : "تمت إزالة الحصرية");
    } catch (err) {
      console.error("Error toggling VIP product:", err);
    }
  };

  const handleRejectMerchant = async (requestId: string) => {
    if (!confirm("هل أنت متأكد من رفض هذا الطلب؟")) return;
    try {
      await updateDoc(doc(db, 'merchant_requests', requestId), {
        status: 'rejected'
      });
      alert("تم رفض الطلب بنجاح");
    } catch (err) {
      console.error("Error rejecting merchant:", err);
    }
  };

  const handleBackWithTransition = () => {
    // We can't easily trigger the transition in App.tsx from here without a prop
    // But we can add a local transition effect
    onBack();
  };

  const renderOverview = () => {
    const totalSales = orders.filter(o => o.status === 'delivered').reduce((acc, o) => acc + (o.total || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const activeMerchants = shops.filter(s => s.status === 'active').length;
    const vipCount = users.filter(u => u.isVIP).length;

    return (
      <motion.div 
        key="overview"
        initial={{ opacity: 0, scale: 0.98, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="bg-gradient-to-br from-[#D4AF37]/20 to-black p-10 rounded-[50px] border border-[#D4AF37]/20 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#D4AF37]/10 blur-3xl rounded-full"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-right">
              <h2 className="text-4xl font-black text-[#D4AF37] mb-2 leading-tight">مرحبا بكم في القصر الإداري ⚜️</h2>
              <p className="text-gray-400 font-medium">تحكم كامل في إمبراطورية AURUM LUXURY من مكان واحد.</p>
            </div>
            <div className="bg-black/40 backdrop-blur-xl p-6 rounded-[30px] border border-white/5 flex items-center gap-6">
              <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-2xl flex items-center justify-center text-[#D4AF37]">
                <TrendingUp size={32} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">إجمالي المبيعات الملكية</p>
                <p className="text-3xl font-black text-[#D4AF37]">{totalSales.toLocaleString()} SP</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'طلبات معلقة', value: pendingOrders, color: '#D4AF37', icon: Clock },
            { label: 'متاجر نشطة', value: activeMerchants, color: '#10b981', icon: Store },
            { label: 'أعضاء النخبة', value: vipCount, color: '#f59e0b', icon: Star },
            { label: 'إجمالي المنتجات', value: products.length, color: '#3b82f6', icon: Package },
          ].map((stat) => (
            <div key={`admin-stat-${stat.label}`} className="bg-[#111] p-8 rounded-[35px] border border-white/5 group hover:border-[#D4AF37]/30 transition-all duration-500 text-center relative overflow-hidden">
              <div className="relative z-10">
                <div 
                  className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${stat.color}10`, color: stat.color }}
                >
                  <stat.icon size={24} />
                </div>
                <h3 className="text-3xl font-black text-white mb-1">{stat.value}</h3>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions & Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-right">
           <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between px-4">
                <h3 className="text-xl font-black flex items-center gap-2">
                   آخر الطلبيات 📦
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                </h3>
                <button onClick={() => setActiveTab('orders')} className="text-[#D4AF37] text-xs font-bold hover:underline">عرض الكل ⚜️</button>
              </div>
              <div className="bg-[#111] rounded-[40px] border border-white/5 overflow-hidden">
                 {orders.slice(0, 5).map((order, idx) => (
                    <div key={order.id} className={cn(
                      "p-6 flex items-center justify-between hover:bg-white/5 transition-all",
                      idx !== 4 && "border-b border-white/5"
                    )}>
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-[#D4AF37] border border-white/5">
                             <CreditCard size={18} />
                          </div>
                          <div className="text-right">
                             <p className="text-xs font-black text-white">{order.userName || order.userEmail}</p>
                             <p className="text-[8px] text-gray-500 uppercase font-black">{new Date(order.createdAt).toLocaleDateString('ar-SY')}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-sm font-black text-[#D4AF37]">{order.total?.toLocaleString()} SP</p>
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded-full uppercase",
                            order.status === 'delivered' ? "bg-emerald-500/10 text-emerald-500" : "bg-[#D4AF37]/10 text-[#D4AF37]"
                          )}>
                             {order.status}
                          </span>
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <div className="space-y-6">
              <h3 className="text-xl font-black px-4">إجراءات سريعة 🚀</h3>
              <div className="grid grid-cols-1 gap-4 text-right">
                 {[
                   { label: 'إضافة منتج إداري', icon: Plus, action: () => setShowAddProduct(true), color: '#D4AF37' },
                   { label: 'إرسال تنبيه عام', icon: Bell, action: () => setActiveTab('settings'), color: '#3b82f6' },
                   { label: 'مراجعة المتاجر', icon: Store, action: () => setActiveTab('shops'), color: '#10b981' },
                   { label: 'تحديث المخزون', icon: Database, action: () => setActiveTab('inventory'), color: '#f59e0b' },
                 ].map((action) => (
                    <button 
                      key={`admin-action-${action.label}`}
                      onClick={action.action}
                      className="group bg-[#111] p-6 rounded-[30px] border border-white/5 hover:border-[#D4AF37]/30 transition-all flex items-center gap-4 text-right"
                    >
                       <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-gray-500 group-hover:text-[#D4AF37] transition-all">
                          <action.icon size={24} />
                       </div>
                       <span className="font-black text-xs group-hover:text-white transition-all">{action.label}</span>
                       <ChevronRight size={16} className="text-gray-700 mr-auto group-hover:text-[#D4AF37] transition-all" />
                    </button>
                 ))}
              </div>
           </div>
        </div>
      </motion.div>
    );
  };

  const renderUsersTab = () => (
    <motion.div 
      key="users"
      initial={{ opacity: 0, scale: 0.98, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.02, x: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
    >
      <h2 className="text-lg font-bold mb-4">إدارة المستخدمين:</h2>
      <div className="grid gap-3">
        {users.map((u) => (
          <div key={`user-row-${u.id}`} className="bg-[#111] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-bold">{u.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">{u.role || 'customer'}</p>
                  <div className="flex items-center gap-1 bg-[#D4AF37]/10 px-2 py-0.5 rounded text-[#D4AF37]">
                    <Sparkles size={8} />
                    <span className="text-[10px] font-bold">{(u.points as number) || 0} نقطة</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setEditingUserPoints({ id: u.id, points: (u.points as number) || 0 })}
                  className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black text-white hover:bg-[#D4AF37]/20 transition-all"
                >
                  تعديل النقاط
                </button>
                <button 
                  onClick={() => handleToggleVIP(u.id, u.isVIP)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1",
                    u.isVIP 
                      ? "bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]" 
                      : "bg-white/5 text-gray-500 border border-white/10"
                  )}
                >
                  <Star size={12} fill={u.isVIP ? "currentColor" : "none"} />
                  {u.isVIP ? "VIP نشط" : "ترقية VIP"}
                </button>
                {u.role !== 'merchant' && (
                  <button 
                    onClick={() => handlePromoteToMerchant(u.id)}
                    className="text-[#D4AF37] text-[10px] font-black border border-[#D4AF37]/30 px-3 py-1.5 rounded-lg hover:bg-[#D4AF37] hover:text-black transition-all"
                  >
                    ترقية لتاجر ⚜️
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );

  const renderOrdersTab = () => (
    <motion.div 
      key="orders"
      initial={{ opacity: 0, scale: 0.98, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.02, x: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-black flex items-center gap-2">
            <ShoppingBag className="text-[#D4AF37]" />
            فواتير طلبات الزبائن ⚜️
          </h2>
          {isDeleting && (
            <div className="flex items-center gap-2 bg-red-500/10 text-red-500 px-3 py-1 rounded-full text-[10px] font-black animate-pulse border border-red-500/20">
              <Loader2 size={12} className="animate-spin" />
              جاري الحذف...
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleDeleteAllOrders}
            disabled={isDeleting || orders.length === 0}
            className="bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl text-[10px] font-black text-red-500 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
          >
            حذف كافة الطلبات 🗑️
          </button>
          <button 
            onClick={async () => {
              const deliveredOrders = orders.filter(o => o.status === 'delivered');
              if (deliveredOrders.length === 0) {
                alert("لا يوجد طلبات مكتملة (تم التوصيل) لحذفها حالياً ⚜️");
                return;
              }
              if (!window.confirm(`⚠️ هل أنت متأكد من حذف ${deliveredOrders.length} طلبات مكتملة (تم التوصيل) نهائياً لتخفيف حجم البيانات؟`)) return;
              setIsDeleting(true);
              try {
                const batch = writeBatch(db);
                deliveredOrders.forEach(o => {
                  batch.delete(doc(db, 'orders', o.id));
                });
                await batch.commit();
                setToast({ message: "تم تنظيف الطلبات المكتملة بنجاح ⚜️", visible: true });
                setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
              } catch (err) {
                console.error("Batch cleanup failed:", err);
                alert("خطأ أثناء التنظيف الدوري");
              } finally {
                setIsDeleting(false);
              }
            }}
            disabled={isDeleting}
            className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-all disabled:opacity-50"
          >
            حذف كافة المكتملة 🧹
          </button>
          <button 
            onClick={() => {
              const allVisibleIds = orders.map(o => o.id);
              if (selectedOrderIds.length === allVisibleIds.length) {
                setSelectedOrderIds([]);
              } else {
                setSelectedOrderIds(allVisibleIds);
              }
            }}
            className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all"
          >
            {selectedOrderIds.length === orders.length && orders.length > 0 ? "إلغاء تحديد الكل" : "تحديد كافة الظاهرة"}
          </button>
        </div>
      </div>

      {selectedOrderIds.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#D4AF37] p-4 rounded-3xl flex items-center justify-between shadow-2xl border-2 border-black/10"
        >
          <div className="flex items-center gap-4">
            <div className="bg-black text-[#D4AF37] w-10 h-10 rounded-full flex items-center justify-center font-black text-sm">
              {selectedOrderIds.length}
            </div>
            <div>
              <p className="text-black font-black text-sm leading-none mb-1">تم تحديد {selectedOrderIds.length} طلبات</p>
              <p className="text-black/60 text-[10px] font-bold">يمكنك حذف كافة الطلبات المحددة بنقرة واحدة</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setSelectedOrderIds([])}
              className="px-5 py-2.5 bg-black/10 text-black font-bold text-xs rounded-xl border border-black/10 hover:bg-black/20"
            >
              إلغاء التحديد
            </button>
            <button 
              onClick={handleBulkDeleteOrders}
              disabled={isDeleting}
              className="px-5 py-2.5 bg-red-600 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg active:scale-95 transition-all hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              حذف المحدد نهائياً
            </button>
          </div>
        </motion.div>
      )}

      {pendingCancelOrders.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-[40px] p-8 mb-8 space-y-6">
          <div className="flex items-center gap-3 text-red-500">
            <Trash2 size={24} />
            <h3 className="text-lg font-black italic">طلبات الحذف المعلقة ({pendingCancelOrders.length})</h3>
          </div>
          <div className="grid gap-4">
            {pendingCancelOrders.map(order => (
              <div key={`cancel-req-${order.id}`} className="bg-black/40 border border-red-500/20 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-6">
                <div className="text-right">
                  <p className="font-mono text-xs text-red-400">#{order.id.slice(-8).toUpperCase()}</p>
                  <p className="font-bold text-sm text-white">{order.userName || order.userEmail}</p>
                  <p className="text-[10px] text-gray-500">{order.total?.toLocaleString()} SP - {order.status}</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => handleApproveCancellation(order.id)}
                    className="bg-emerald-500 text-black px-6 py-2.5 rounded-xl text-[10px] font-black shadow-lg hover:scale-105 transition-all"
                  >
                    موافقة على الحذف
                  </button>
                  <button 
                    onClick={() => handleRejectCancellation(order.id)}
                    className="bg-white/5 text-red-500 border border-red-500/20 px-6 py-2.5 rounded-xl text-[10px] font-black hover:bg-red-500 hover:text-white transition-all"
                  >
                    رفض الحذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-20 bg-[#111] rounded-[40px] border border-white/5">
          <ShoppingBag size={48} className="mx-auto text-gray-800 mb-4" />
          <p className="text-gray-500">لا يوجد طلبات حالياً</p>
        </div>
      ) : (
        orders.map((order) => (
          <motion.div 
            key={`admin-order-${order.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "bg-[#111] border rounded-[40px] overflow-hidden shadow-2xl transition-all duration-300",
              selectedOrderIds.includes(order.id) ? "border-[#D4AF37] shadow-[0_0_50px_rgba(212,175,55,0.15)] ring-2 ring-[#D4AF37]/20" : "border-[#D4AF37]/20"
            )}
          >
            <div className="bg-gradient-to-r from-[#D4AF37]/10 to-transparent p-6 border-b border-white/5 flex justify-between items-center group/order-header">
              <div className="flex items-center gap-4">
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleOrderSelection(order.id); }}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all",
                    selectedOrderIds.includes(order.id) 
                      ? "bg-[#D4AF37] border-[#D4AF37] text-black" 
                      : "border-white/20 hover:border-[#D4AF37]/50"
                  )}
                >
                  {selectedOrderIds.includes(order.id) && <CheckCircle2 size={16} />}
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">رقم الفاتورة</p>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono text-[#D4AF37] font-bold">#{order.id.slice(-8).toUpperCase()}</h3>
                    {order.cancellationStatus === 'pending' && (
                      <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[8px] font-black animate-pulse">
                        طلب حذف معلق ⚠️
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-left">
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">تاريخ الطلب</p>
                <p className="text-xs font-bold">{order.createdAt ? new Date(order.createdAt).toLocaleString('ar-SY') : '---'}</p>
              </div>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-[#D4AF37] uppercase tracking-wider flex items-center gap-2">
                    <Package size={14} />
                    القطع المطلوبة:
                  </h4>
                  <div className="space-y-3">
                    {order.items.map((item: CartItem, idx: number) => (
                      <div key={`invoice-item-${order.id}-${idx}`} className="bg-black/40 p-3 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-3 text-right">
                            <div>
                              <p className="text-xs font-bold text-white">{item.name}</p>
                              <p className="text-[10px] text-gray-500">{item.brand || 'AURUM LUXURY'}</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#D4AF37] text-[10px] font-black">
                              x{item.quantity}
                            </div>
                          </div>
                          <p className="text-[#D4AF37] text-xs font-black">{item.price}</p>
                        </div>
                        <div className="flex gap-2 justify-end pt-2 border-t border-white/5">
                          {item.selectedSize && (
                            <span className="text-[9px] font-black bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded border border-[#D4AF37]/20 uppercase">
                              المقاس: {item.selectedSize}
                            </span>
                          )}
                          {item.selectedColor && (
                            <span className="text-[9px] font-black bg-white/5 text-gray-500 px-2 py-0.5 rounded border border-white/10">
                              اللون: {item.selectedColor}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                    <p className="text-sm font-black text-white">الإجمالي الكلي:</p>
                    <p className="text-xl font-black text-[#D4AF37]">{order.total?.toLocaleString()} SP</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-black/40 p-6 rounded-[30px] border border-white/5 space-y-4">
                    <h4 className="text-xs font-black text-[#D4AF37] uppercase tracking-wider flex items-center gap-2">
                      <Users size={14} />
                      بيانات الزبون:
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-500">الاسم/الايميل:</span>
                        <span className="font-bold">{order.userName || order.userEmail}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-500">رقم الهاتف:</span>
                        <span className="font-bold font-mono">{order.phone}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-500">طريقة الدفع:</span>
                        <span className="px-2 py-1 bg-[#D4AF37]/10 text-[#D4AF37] rounded-lg font-black text-[10px]">{order.paymentMethod}</span>
                      </div>
                      {order.transactionId && (
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-red-500 font-black">رقم التحويل ⚜️:</span>
                          <span className="font-mono font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{order.transactionId}</span>
                        </div>
                      )}
                      {order.paymentReceipt && (
                        <div className="pt-2">
                          <p className="text-[10px] text-gray-500 mb-2 font-bold uppercase">إيصال الدفع البنكي 📥:</p>
                          <div className="relative group cursor-pointer overflow-hidden rounded-xl border border-[#D4AF37]/30" onClick={() => setSelectedZoomImage(order.paymentReceipt!)}>
                            <img src={order.paymentReceipt} className="w-full h-32 object-cover transition-transform group-hover:scale-105" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <span className="text-[10px] font-black text-white">تكبير الإيصال ⚜️</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-black/40 p-6 rounded-[30px] border border-white/5 space-y-4">
                    <h4 className="text-xs font-black text-[#D4AF37] uppercase tracking-wider flex items-center gap-2">
                      <MapPin size={14} />
                      عنوان التوصيل (الموقع):
                    </h4>
                    <p className="text-sm text-white font-bold leading-relaxed italic">
                      {order.city} - {order.area}
                    </p>
                    
                    {order.coordinates && (
                      <div className="h-48 w-full rounded-2xl overflow-hidden border border-[#D4AF37]/30 mt-4 relative z-0">
                        <MapContainer
                          center={[order.coordinates.lat, order.coordinates.lng]}
                          zoom={15}
                          style={{ height: '100%', width: '100%' }}
                          scrollWheelZoom={false}
                          dragging={false}
                          zoomControl={false}
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <Marker 
                            position={[order.coordinates.lat, order.coordinates.lng]} 
                            icon={defaultIcon}
                          />
                        </MapContainer>
                        <div className="absolute inset-0 z-10 bg-transparent flex items-center justify-center group">
                          <a 
                            href={`https://www.google.com/maps?q=${order.coordinates.lat},${order.coordinates.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="opacity-0 group-hover:opacity-100 bg-[#D4AF37] text-black px-4 py-2 rounded-xl text-[10px] font-black transition-opacity shadow-lg"
                          >
                            فتح في خرائط جوجل 🗺️
                          </a>
                          {order.coordinates && (
                            <button 
                              onClick={() => {
                                const locationUrl = `https://www.google.com/maps?q=${order.coordinates.lat},${order.coordinates.lng}`;
                                if (navigator.share) {
                                  navigator.share({
                                    title: `موقع توصيل الطلب #${order.id.slice(-6).toUpperCase()}`,
                                    text: `موقع الزبون ${order.userName || order.userEmail} لطلب التوصيل:`,
                                    url: locationUrl
                                  }).catch(err => console.error(err));
                                } else {
                                  navigator.clipboard.writeText(locationUrl);
                                  alert("تم نسخ رابط الموقع للمشاركة ⚜️");
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black transition-opacity shadow-lg flex items-center gap-2"
                            >
                              <Share2 size={12} />
                              مشاركة الموقع للتوصيل 🛵
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mx-8 p-4 bg-[#D4AF37]/5 border border-dashed border-[#D4AF37]/20 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37]">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[#D4AF37] uppercase">نظام الإشعارات الآلي (تلجرام وواتساب) 🤖</p>
                    <p className="text-[12px] text-gray-400">إرسال الفاتورة وإشعار القبول إلى رقم الزبون ({order.phone}) ⚜️</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {order.phone && (
                    <button
                      onClick={() => {
                        const msg = buildCustomerApprovalMessage(order);
                        openWhatsApp(order.phone, msg);
                      }}
                      className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all active:scale-95 shadow-lg"
                    >
                      <MessageCircle size={16} />
                      مراسلة واتساب 📱
                    </button>
                  )}
                  {order.phone && (
                    <button
                      onClick={() => {
                        const tgMsg = buildCustomerTelegramApprovalMessage(order);
                        openTelegram(order.phone, tgMsg);
                      }}
                      className="bg-sky-600/20 text-sky-400 border border-sky-500/30 hover:bg-sky-600 hover:text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all active:scale-95 shadow-lg"
                    >
                      <Send size={16} />
                      مراسلة تلجرام ✈️
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 flex flex-wrap gap-3">
                {order.status === 'pending' ? (
                  <>
                    <button 
                      onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')}
                      className="flex-1 bg-[#22C55E] text-black font-black py-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(34,197,94,0.2)] hover:scale-105 active:scale-95 transition-all"
                    >
                      <CheckCircle2 size={18} />
                      موافقة على الفاتورة
                    </button>
                    <button 
                      onClick={() => handleUpdateOrderStatus(order.id, 'rejected')}
                      className="flex-1 bg-red-500/10 text-red-500 font-black py-4 rounded-2xl text-xs flex items-center justify-center gap-2 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                    >
                      <XCircle size={18} />
                      رفض الطلب
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteOrder(order.id);
                      }}
                      disabled={isDeleting}
                      className="bg-red-500/20 text-red-500 font-black px-6 py-4 rounded-2xl text-xs flex items-center justify-center gap-2 border border-red-500/40 hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                    >
                      {deletingId === order.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                      حذف نهائي
                    </button>
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between bg-white/5 p-4 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-3 h-3 rounded-full animate-pulse",
                        order.status === 'delivered' ? "bg-green-500" : "bg-[#D4AF37]"
                      )} />
                      <p className="text-xs font-black text-gray-400">الحالة الحالية: <span className="text-white uppercase">{order.status}</span></p>
                    </div>
                    <div className="flex gap-2">
                      {['confirmed', 'shipping', 'delivered'].map((s) => (
                        <button
                          key={`status-btn-${order.id}-${s}`}
                          onClick={() => handleUpdateOrderStatus(order.id, s)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
                            order.status === s ? "bg-[#D4AF37] text-black" : "bg-white/5 text-gray-500 border border-white/5"
                          )}
                        >
                          {s === 'confirmed' ? 'تم الموافقة' : s === 'shipping' ? 'جاري الشحن' : 'تم التوصيل'}
                        </button>
                      ))}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteOrder(order.id);
                        }}
                        disabled={isDeleting}
                        className="px-4 py-2 rounded-xl bg-red-500/20 text-red-500 border border-red-500/40 hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center gap-2 text-[10px] font-black disabled:opacity-50"
                      >
                        {deletingId === order.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        حذف نهائي
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))
      )}

      {hasMoreOrders && (
        <div className="pt-8 text-center">
          <button 
            onClick={() => setOrderLimit(prev => prev + 50)}
            disabled={loading}
            className="bg-white/5 border border-white/10 px-10 py-4 rounded-2xl text-white font-black text-xs hover:bg-[#D4AF37] hover:text-black transition-all shadow-xl active:scale-95 flex items-center gap-2 mx-auto"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            تحميل المزيد من الطلبات ⚜️
          </button>
          <p className="text-[10px] text-gray-500 mt-4 leading-relaxed">
            يتم عرض أحدث {orderLimit} طلبات حالياً. يرجى حذف الطلبات القديمة أو المستلمة دورياً للحفاظ على سرعة النظام ⚜️
          </p>
        </div>
      )}
    </motion.div>
  );

  const renderRequestsTab = () => (
    <motion.div 
      key="requests"
      initial={{ opacity: 0, scale: 0.98, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.02, x: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
    >
      <h2 className="text-lg font-bold mb-4">طلبات حجز الأركان المعلقة:</h2>
      {requests.filter(r => r.status === 'pending').length === 0 ? (
        <p className="text-gray-600 text-center py-10">لا يوجد طلبات معلقة حالياً</p>
      ) : (
        requests.filter(r => r.status === 'pending').map((req) => (
          <div key={`pending-req-${req.id}`} className="bg-[#111] border border-[#D4AF37]/20 rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-black text-[#D4AF37]">{req.shopName}</h3>
                <p className="text-gray-400 text-sm">{req.userEmail}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded italic">
                    {req.shopCategory || 'تصنيف عام'}
                  </span>
                  <span className="text-[10px] text-gray-500 font-bold">
                    📱 {req.phone}
                  </span>
                </div>
              </div>
              <span className="bg-[#D4AF37]/10 text-[#D4AF37] px-3 py-1 rounded-full text-[10px] font-black uppercase">
                {req.plan === 'plus' ? 'PLATINUM' : 'GOLD'}
              </span>
            </div>
            
            {req.shopDescription && (
              <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                <p className="text-xs text-gray-400 leading-relaxed font-medium italic">"{req.shopDescription}"</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <Clock size={14} />
                {new Date(req.createdAt).toLocaleDateString('ar-SY')}
              </div>
              <div className="flex items-center gap-2">
                <Store size={14} />
                التوصيل: {req.delivery === 'aurum' ? 'عبر AURUM' : 'عبر المتجر'}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => handleApproveMerchant(req)}
                className="flex-1 bg-[#D4AF37] text-black font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                موافقة وتفعيل
              </button>
              <button 
                onClick={() => handleRejectMerchant(req.id)}
                className="flex-1 bg-red-500/10 text-red-500 font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                <XCircle size={18} />
                رفض
              </button>
            </div>
          </div>
        ))
      )}
    </motion.div>
  );

  const renderProductsTab = () => (
    <motion.div 
      key="products"
      initial={{ opacity: 0, scale: 0.98, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.02, x: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
    >
      <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
        <h2 className="text-lg font-bold">إدارة المنتجات:</h2>
        <div className="flex gap-2">
          <button 
            onClick={handleDeleteNonAdminProducts}
            className="bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-2 rounded-xl font-black text-[10px] flex items-center gap-2 hover:bg-red-500 hover:text-white transition-all"
          >
            <Trash2 size={14} />
            تنظيف المنتجات غير الرسمية
          </button>
          <button 
            onClick={() => {
              setEditingProductId(null);
              setNewProduct({
                name: '',
                price: '',
                category: 'عطور',
                description: '',
                image: 'https://picsum.photos/seed/admin/800/1000',
                images: [] as string[],
                section: 'home',
                isFeatured: true,
                availableSizes: [] as string[],
                availableColors: [] as string[],
                stock: 10,
                shopId: 'admin',
                isSale: false,
                oldPrice: '',
                salePrice: '',
                currency: 'SYP',
                newSypPrice: '',
                isLimitedEdition: false,
                limitedUnits: 10,
                remainingUnits: 10
              });
              setShowAddProduct(true);
            }}
            className="bg-[#D4AF37] text-black px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <Plus size={16} />
            إضافة منتج للواجهة
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {products.map((p, idx) => (
          <div key={`admin-list-${p.id}-${idx}`} className="bg-[#111] border border-white/5 rounded-3xl p-4 flex items-center gap-4">
            <img src={p.image || null} className="w-20 h-20 rounded-2xl object-cover" />
            <div className="flex-1">
              <h4 className="font-bold text-sm">{p.name}</h4>
              <div className="flex flex-col">
                <p className="text-[#D4AF37] text-xs font-bold">{p.price} <span className="opacity-60">{p.currency === 'USD' ? '$' : 'ل.س'}</span></p>
                {p.currency === 'SYP' && p.newSypPrice && (
                  <p className="text-[9px] text-amber-500/60 font-black">
                    {p.newSypPrice} <span className="text-[7px]">ل.س جديد</span>
                  </p>
                )}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">المتجر: {p.shopName || 'غير معروف'}</p>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <button 
                onClick={() => openEditProduct(p)}
                className="px-4 py-2 rounded-xl text-[10px] font-black bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all w-full flex items-center gap-2 justify-center"
              >
                <Pencil size={14} />
                تعديل البيانات
              </button>
              <button 
                onClick={() => handleToggleFeatured(p.id, p.isFeatured)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 w-full justify-center",
                  p.isFeatured 
                    ? "bg-red-500/10 text-red-500 border border-red-500/20" 
                    : "bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20"
                )}
              >
                {p.isFeatured ? <XCircle size={14} /> : <ArrowUpRight size={14} />}
                {p.isFeatured ? "إزالة من الواجهة" : "عرض في الواجهة"}
              </button>
              <button 
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, 'products', p.id), { isLimitedEdition: !p.isLimitedEdition });
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 w-full justify-center",
                  p.isLimitedEdition 
                    ? "bg-amber-600/20 text-amber-500 border border-amber-500/30" 
                    : "bg-white/5 text-gray-500 border border-white/10"
                )}
              >
                <Sparkles size={14} />
                {p.isLimitedEdition ? "إصدار محدود ✅" : "جعله محدود 🔥"}
              </button>
              <button 
                onClick={() => handleToggleVIPProduct(p.id, p.isVIPOnly)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 w-full justify-center",
                  p.isVIPOnly 
                    ? "bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]" 
                    : "bg-white/5 text-gray-500 border border-white/10"
                )}
              >
                <Star size={14} fill={p.isVIPOnly ? "currentColor" : "none"} />
                {p.isVIPOnly ? "منتج VIP" : "جعله VIP"}
              </button>
              <button 
                onClick={() => handleDeleteProduct(p.id)}
                className="px-4 py-2 rounded-xl text-[10px] font-black bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white transition-all w-full flex items-center gap-2 justify-center"
              >
                <Trash2 size={14} />
                حذف نهائي
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );

  const renderSheinTab = () => (
    <motion.div 
      key="shein"
      initial={{ opacity: 0, scale: 0.98, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.02, x: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setSheinSubTab('products')}
          className={cn(
            "px-6 py-3 rounded-2xl font-black text-sm transition-all border",
            sheinSubTab === 'products' ? "bg-amber-500 text-black border-amber-500 shadow-[0_10px_20px_rgba(245,158,11,0.2)]" : "bg-white/5 text-gray-500 border-white/10 hover:border-amber-500/30"
          )}
        >
          إدارة المنتجات 📦
        </button>
        <button 
          onClick={() => setSheinSubTab('links')}
          className={cn(
            "px-6 py-3 rounded-2xl font-black text-sm transition-all border flex items-center gap-2",
            sheinSubTab === 'links' ? "bg-amber-500 text-black border-amber-500 shadow-[0_10px_20px_rgba(245,158,11,0.2)]" : "bg-white/5 text-gray-500 border-white/10 hover:border-amber-500/30"
          )}
        >
          طلبات الروابط 🔗
          {sheinLinks.filter(l => l.status === 'pending').length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse border border-white/20 font-black">
              {sheinLinks.filter(l => l.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {sheinSubTab === 'products' ? (
        <>
          <div className="bg-gradient-to-br from-amber-500/10 to-transparent p-8 rounded-[40px] border border-amber-500/20 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-right">
              <h2 className="text-2xl font-black text-amber-500 mb-2 flex items-center gap-3">
                <ShoppingBag size={32} />
                مركز إدارة شي إن ⚜️ SHEIN Panel
              </h2>
              <p className="text-gray-400 text-sm">إدارة المنتجات الدولية ذات الشحن الخارجي (توصيل 15 يوم).</p>
            </div>
            <button 
              onClick={() => {
                setEditingProductId(null);
                setNewSheinProduct({
                  name: '',
                  price: '',
                  image: '',
                  images: [],
                  description: '',
                  brand: 'SHEIN',
                  availableSizes: [],
                  availableColors: [],
                  shopId: 'admin',
                  shopName: 'إدارة AURUM',
                  isSale: false,
                  oldPrice: '',
                  salePrice: '',
                  currency: 'SYP',
                  newSypPrice: '',
                  isFeatured: false,
                  isLimitedEdition: false,
                  limitedUnits: 10,
                  remainingUnits: 10
                });
                setShowAddSheinProduct(true);
              }}
              className="bg-amber-500 text-black px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-3 shadow-[0_10px_30px_rgba(245,158,11,0.3)] active:scale-95 transition-all"
            >
              <Plus size={20} />
              إضافة قطعة شي إن جديدة
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.filter(p => p.category === 'شي ان').length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white/5 rounded-[40px] border border-dashed border-white/10">
                <Package size={48} className="mx-auto text-gray-800 mb-4" />
                <p className="text-gray-500 font-bold">لا يوجد منتجات شي إن حالياً</p>
              </div>
            ) : (
              products.filter(p => p.category === 'شي ان').map((p, idx) => (
                <div key={`shein-list-${p.id}-${idx}`} className="bg-[#111] border border-white/5 rounded-[35px] overflow-hidden group hover:border-amber-500/30 transition-all">
                  <div className="aspect-[4/5] relative">
                    <img src={p.image || null} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" referrerPolicy="no-referrer" />
                    <div className="absolute top-4 right-4 bg-amber-500 text-black px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter">
                      15 Days Delivery
                    </div>
                  </div>
                  <div className="p-5 space-y-3">
                    <h4 className="font-bold text-sm text-white truncate">{p.name}</h4>
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-amber-500 font-black text-sm">{p.price} <span className="text-[10px] opacity-60">{p.currency === 'USD' ? '$' : 'ل.س'}</span></span>
                        {p.currency === 'SYP' && p.newSypPrice && (
                          <span className="text-[10px] text-amber-500/60 font-bold">
                            {p.newSypPrice} ل.س جديد
                          </span>
                        )}
                      </div>
                      {p.isLimitedEdition && (
                         <span className="bg-amber-500/20 text-amber-500 text-[8px] px-2 py-1 rounded-lg border border-amber-500/30 font-black">🔥 LIMITED</span>
                      )}
                      <span className="text-[10px] text-gray-600 font-bold uppercase">{p.brand}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button 
                        onClick={() => openEditProduct(p)}
                        className="bg-blue-500/10 text-blue-500 p-3 rounded-xl hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center"
                      >
                        <Pencil size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(p.id)}
                        className="bg-red-500/10 text-red-500 p-3 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleToggleFeatured(p.id, p.isFeatured)}
                        className={cn(
                          "p-3 rounded-xl transition-all flex items-center justify-center",
                          p.isFeatured ? "bg-amber-500 text-black" : "bg-white/5 text-gray-500 border border-white/10"
                        )}
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="bg-[#111] border border-white/5 rounded-[40px] overflow-hidden">
          <div className="p-8 border-b border-white/5 text-right">
            <h3 className="text-xl font-black text-white">طلبات الروابط الخارجية (Custom SHEIN Links) 🔗</h3>
            <p className="text-gray-500 text-xs mt-1 font-bold">مراجعة والرد على المستخدمين الذين أرسلوا روابط لطلبها بشكل خاص ⚜️</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right" dir="rtl">
              <thead className="bg-white/5 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="p-6">المستخدم</th>
                  <th className="p-6">الرابط</th>
                  <th className="p-6">الملاحظات</th>
                  <th className="p-6">التاريخ</th>
                  <th className="p-6">الحالة</th>
                  <th className="p-6">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sheinLinks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-20 text-center text-gray-700 italic font-bold">لا توجد طلبات روابط حالياً ⚜️</td>
                  </tr>
                ) : (
                  sheinLinks.map((link) => (
                    <tr key={link.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-6">
                        <p className="text-white font-bold text-sm">{link.userName || 'مستخدم غير معروف'}</p>
                        <p className="text-gray-600 text-[10px]">{link.userEmail}</p>
                      </td>
                      <td className="p-6 max-w-[200px]">
                        <a 
                          href={link.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-500 text-[10px] font-bold hover:underline break-all block"
                        >
                          {link.link}
                        </a>
                      </td>
                      <td className="p-6">
                        <p className="text-gray-400 text-xs line-clamp-2 max-w-[200px]">{link.notes || 'لا يوجد ملاحظات'}</p>
                      </td>
                      <td className="p-6">
                        <p className="text-gray-500 text-[10px] font-mono">
                          {new Date(link.createdAt).toLocaleDateString('ar-SY')}
                        </p>
                      </td>
                      <td className="p-6">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter border",
                          link.status === 'pending' ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
                          link.status === 'reviewed' ? "bg-blue-500/10 text-blue-500 border-blue-500/30" :
                          link.status === 'ordered' ? "bg-purple-500/10 text-purple-500 border-purple-500/30" :
                          link.status === 'completed' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" :
                          "bg-red-500/10 text-red-500 border-red-500/30"
                        )}>
                          {link.status === 'pending' ? 'قيد الانتظار' :
                           link.status === 'reviewed' ? 'تمت المراجعة' :
                           link.status === 'ordered' ? 'تم الطلب' :
                           link.status === 'completed' ? 'مكتمل' : 'ملغي'}
                        </span>
                      </td>
                      <td className="p-6">
                        <div className="flex gap-2">
                          <select 
                            className="bg-black/40 border border-white/10 rounded-lg text-[10px] font-bold py-1 px-2 text-[#D4AF37]"
                            value={link.status}
                            onChange={(e) => handleUpdateSheinLinkStatus(link.id, e.target.value)}
                          >
                            <option value="pending">قيد الانتظار</option>
                            <option value="reviewed">تمت المراجعة</option>
                            <option value="ordered">تم الطلب</option>
                            <option value="completed">مكتمل</option>
                            <option value="cancelled">ملغي</option>
                          </select>
                          <button 
                            onClick={() => handleDeleteSheinLink(link.id)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );

  const renderStoriesTab = () => (
    <motion.div 
      key="stories"
      initial={{ opacity: 0, scale: 0.98, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.02, x: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">إدارة لحظات أوروم:</h2>
        <button 
          onClick={() => setShowAddStory(true)}
          className="bg-[#D4AF37] text-black px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2"
        >
          <Plus size={16} />
          إضافة لحظة جديدة
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stories.map((story) => (
          <div key={`admin-story-${story.id}`} className="bg-[#111] border border-white/5 rounded-3xl overflow-hidden group">
            <div className="aspect-[9/16] relative">
              <img src={story.image || null} className="w-full h-full object-cover" />
              <button 
                onClick={() => handleDeleteStory(story.id)}
                className="absolute top-2 left-2 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <Trash2 size={16} />
              </button>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-4 flex flex-col justify-end">
                <p className="text-xs font-bold text-white line-clamp-2">{story.text}</p>
                <p className="text-[10px] text-[#D4AF37] mt-1">{story.userName}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );

  const renderVIPTab = () => (
    <motion.div 
      key="vip"
      initial={{ opacity: 0, scale: 0.98, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.02, x: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="bg-gradient-to-r from-amber-900/20 to-black p-8 rounded-[40px] border border-amber-500/20">
        <h2 className="text-2xl font-black text-amber-500 mb-2 flex items-center gap-3">
          <Star size={32} fill="currentColor" />
          نادي AURUM VIP ⚜️
        </h2>
        <p className="text-gray-400 text-sm">إدارة النخبة والمميزات الحصرية لأعضاء VIP.</p>
      </div>
      <div className="grid gap-4">
        {users.filter(u => u.isVIP).length === 0 ? (
          <div className="text-center py-20 bg-[#111] rounded-[30px] border border-white/5">
            <Star size={48} className="mx-auto text-gray-800 mb-4" />
            <p className="text-gray-500">لا يوجد أعضاء VIP حالياً</p>
          </div>
        ) : (
          users.filter(u => u.isVIP).map((u) => (
            <div key={`admin-vip-${u.id}`} className="bg-[#111] border border-amber-500/10 rounded-3xl p-6 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <p className="font-black text-white">{u.email}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">عضو ملكي نشط</p>
                    <span className="text-[10px] text-gray-500 border border-white/10 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <Sparkles size={10} />
                      {(u.points as number) || 0} نقطة
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleToggleVIP(u.id, true)}
                className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-xs font-black border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
              >
                إلغاء العضوية
              </button>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );

  const renderInventoryTab = () => (
    <motion.div 
      key="inventory"
      initial={{ opacity: 0, scale: 0.98, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-gradient-to-br from-indigo-900/20 to-black p-8 rounded-[40px] border border-indigo-500/20">
        <h2 className="text-2xl font-black text-indigo-400 mb-2 flex items-center gap-3">
          <Database size={32} />
          مزامنة المخزون الخارجي 🛰️
        </h2>
        <p className="text-gray-400 text-sm">إدارة الربط البرمجي مع نظام المستودع الخارجي (Webhook Sync).</p>
      </div>
      <div className="grid gap-6">
        <div className="bg-[#111] p-8 rounded-3xl border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 font-bold">حالة الربط البرمجي:</span>
            <span className="bg-emerald-500/10 text-emerald-500 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">متصل الآن 🌐 Connected</span>
          </div>
          <div className="pt-4 space-y-2">
            <p className="text-[10px] text-gray-600 font-bold uppercase">رابط الـ Webhook النشط:</p>
            <div className="bg-black p-4 rounded-xl border border-white/5 flex items-center justify-between">
              <code className="text-[#D4AF37] text-[10px] break-all">https://ais-dev-fwxqfrx7maxrv2qsvdli5l-790254206537.europe-west2.run.app/api/webhook/sale</code>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button 
            onClick={() => alert("AURUM LOGISTICS ⚜️: تم إرسال طلب مزامنة كامل للمخزون.. سيتم تحديث الكميات خلال ثوانٍ.")}
            className="bg-indigo-500 text-white p-10 rounded-[40px] flex flex-col items-center justify-center gap-4 hover:scale-105 transition-all shadow-xl"
          >
            <RefreshCw size={48} className="animate-spin-slow" />
            <span className="font-black">مزامنة الكميات الآن</span>
          </button>
          <div className="bg-[#111] p-8 rounded-[40px] border border-white/5 flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-4">
              <CheckCircle2 size={32} className="text-indigo-400" />
              <h4 className="font-bold">سجل العمليات الأخير</h4>
            </div>
            <ul className="space-y-3 text-[10px] font-bold text-gray-500">
              <li key="log-1" className="flex justify-between border-b border-white/5 pb-2">
                <span>تحديث مخزون (شي ان)</span>
                <span className="text-gray-400">منذ 5 دقائق</span>
              </li>
              <li key="log-2" className="flex justify-between border-b border-white/5 pb-2">
                <span>مزامنة طلبيات طرطوس</span>
                <span className="text-gray-400">منذ 12 دقيقة</span>
              </li>
              <li key="log-3" className="flex justify-between">
                <span>إرسال إشعار بيع Webhook</span>
                <span className="text-emerald-500">ناجح ✓</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderSettingsTab = () => (
    <motion.div 
      key="settings"
      initial={{ opacity: 0, scale: 0.98, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.02, x: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8"
    >
      <div className="bg-[#111] border border-[#D4AF37]/20 rounded-[35px] p-8">
        <h3 className="text-xl font-black text-[#D4AF37] mb-6 flex items-center gap-2">
          <ShoppingBag size={24} />
          إعدادات البانر الرئيسي ⚜️
        </h3>
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-400 mr-2">العنوان الصغير (فوق):</label>
            <input 
              type="text"
              value={bannerSettings.bannerSubtitle}
              onChange={(e) => setBannerSettings({...bannerSettings, bannerSubtitle: e.target.value})}
              className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
              placeholder="مثلاً: مجموعة حصرية ⚜️"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-400 mr-2">العنوان الرئيسي:</label>
            <textarea 
              value={bannerSettings.bannerTitle}
              onChange={(e) => setBannerSettings({...bannerSettings, bannerTitle: e.target.value})}
              className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white h-24 focus:border-[#D4AF37] outline-none transition-all"
              placeholder="مثلاً: عروض AURUM الملكية ⚜️"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-400 mr-2">مدة كل شريحة (بالثواني):</label>
            <input 
              type="number"
              value={bannerSettings.bannerDuration}
              onChange={(e) => setBannerSettings({...bannerSettings, bannerDuration: parseInt(e.target.value) || 5})}
              className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
              placeholder="مثلاً: 5"
            />
          </div>
          <button 
            onClick={handleUpdateBanner}
            disabled={loading}
            className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "تثبيت إعدادات البانر ⚜️"}
          </button>
        </div>
      </div>
      <div className="bg-[#111] border border-[#D4AF37]/20 rounded-[35px] p-8">
        <h3 className="text-xl font-black text-[#D4AF37] mb-6 flex items-center gap-2">
          <Sparkles size={24} />
          إعدادات شريط الإعلانات ⚜️
        </h3>
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-400 mr-2">نوع العرض:</label>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setMarqueeSettings({...marqueeSettings, marqueeType: 'text'})}
                className={cn(
                  "py-3 rounded-2xl font-bold text-xs transition-all",
                  marqueeSettings.marqueeType === 'text' ? "bg-[#D4AF37] text-black" : "bg-black border border-[#222] text-gray-500"
                )}
              >
                نص متحرك
              </button>
              <button 
                onClick={() => setMarqueeSettings({...marqueeSettings, marqueeType: 'products'})}
                className={cn(
                  "py-3 rounded-2xl font-bold text-xs transition-all",
                  marqueeSettings.marqueeType === 'products' ? "bg-[#D4AF37] text-black" : "bg-black border border-[#222] text-gray-500"
                )}
              >
                منتجات مختارة
              </button>
            </div>
          </div>
          {marqueeSettings.marqueeType === 'text' ? (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-400 mr-2">النص الإعلاني:</label>
              <textarea 
                value={marqueeSettings.marqueeText}
                onChange={(e) => setMarqueeSettings({...marqueeSettings, marqueeText: e.target.value})}
                className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white h-24 focus:border-[#D4AF37] outline-none"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-400 mr-2">اختر المنتجات:</label>
              <div className="flex flex-wrap gap-2">
                {products.map(p => (
                  <button 
                    key={`marquee-select-${p.id}`}
                    onClick={() => {
                      const current = marqueeSettings.marqueeProductIds;
                      const next = current.includes(p.id) 
                        ? current.filter(id => id !== p.id) 
                        : [...current, p.id];
                      setMarqueeSettings({...marqueeSettings, marqueeProductIds: next});
                    }}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-bold border transition-all",
                      marqueeSettings.marqueeProductIds.includes(p.id) 
                        ? "bg-[#D4AF37] text-black border-[#D4AF37]" 
                        : "bg-white/5 text-gray-500 border-white/10"
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button 
            onClick={handleUpdateMarquee}
            className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all"
          >
            تحديث شريط الإعلان الآن ⚜️
          </button>
        </div>
      </div>
      <div className="bg-[#111] border border-[#D4AF37]/20 rounded-[35px] p-8">
        <h3 className="text-xl font-black text-[#D4AF37] mb-6 flex items-center gap-2">
          <Clock size={24} />
          إعدادات الساعة الذهبية ⚜️
        </h3>
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-400 mr-2">مدة العرض القادم (بالدقائق):</label>
            <div className="flex gap-4">
              <input 
                type="number"
                value={goldenHourMinutes}
                onChange={(e) => setGoldenHourMinutes(e.target.value)}
                className="flex-1 bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                placeholder="مثلاً: 60"
              />
              <button 
                onClick={handleUpdateGoldenHour}
                disabled={loading}
                className="px-8 bg-[#D4AF37] text-black font-black rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : "تفعيل الآن ⚜️"}
              </button>
            </div>
          </div>
          {settings?.goldenHourEnd && (
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-xs text-gray-500 mb-1">العرض الحالي ينتهي في:</p>
              <p className="text-lg font-mono text-[#D4AF37]">
                {new Date(settings.goldenHourEnd).toLocaleString('ar-SY')}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="bg-[#111] border border-[#D4AF37]/20 rounded-[35px] p-8">
        <h3 className="text-xl font-black text-[#D4AF37] mb-6 flex items-center gap-2">
          <Send size={24} />
          إعدادات بوتات التليغرام والأتمتة التلقائية 🤖
        </h3>
        <p className="text-xs text-gray-400 mb-6">
          يمكنك ربط بوتين تليغرام: الأول للآدمن (استقبال إشعارات الطلبات الجديدة)، والثاني للزبائن (إرسال الفواتير والموافقات آلياً من السيرفر فور الضغط على "موافق").
        </p>
        
        <div className="space-y-8">
          {/* Section 1: Admin Bot */}
          <div className="p-6 bg-black/60 border border-sky-500/20 rounded-3xl space-y-4">
            <h4 className="text-sm font-black text-sky-400 flex items-center gap-2">
              1️⃣ بوت الأدمن (لاستقبال إشعارات الطلبات الجديدة عندك)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-400 mr-2">توكن بوت الأدمن (Bot Token):</label>
                <input 
                  type="text"
                  value={telegramSettings.telegramBotToken}
                  onChange={(e) => setTelegramSettings({...telegramSettings, telegramBotToken: e.target.value})}
                  className="w-full bg-[#111] border border-[#222] rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-sky-500 transition-all font-mono text-xs"
                  placeholder="123456789:ABCdef..."
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-400 mr-2">آيدي محادثة الأدمن (Admin Chat ID):</label>
                <input 
                  type="text"
                  value={telegramSettings.telegramAdminChatId}
                  onChange={(e) => setTelegramSettings({...telegramSettings, telegramAdminChatId: e.target.value})}
                  className="w-full bg-[#111] border border-[#222] rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-sky-500 transition-all font-mono text-xs"
                  placeholder="مثال: 987654321"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 mr-2">معرف بوت الأدمن (Bot Username):</label>
              <input 
                type="text"
                value={telegramSettings.telegramBotUsername}
                onChange={(e) => setTelegramSettings({...telegramSettings, telegramBotUsername: e.target.value})}
                className="w-full bg-[#111] border border-[#222] rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-sky-500 transition-all text-xs"
                placeholder="مثال: @AurumAdminBot"
              />
            </div>
          </div>

          {/* Section 2: Dedicated Customer Bot for Automatic Invoices */}
          <div className="p-6 bg-black/60 border border-emerald-500/20 rounded-3xl space-y-4">
            <h4 className="text-sm font-black text-emerald-400 flex items-center gap-2">
              2️⃣ بوت الزبائن المخصص (لإرسال الفواتير والموافقات آلياً من السيرفر) 🤖
            </h4>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              عند الضغط على زر &quot;موافق&quot; للطلبات، يتصل السيرفر مباشرة بهذا البوت ويرسل الفاتورة والموافقة إلى الزبون تلقائياً وبدون أي تدخل يدوي.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-emerald-400 mr-2">توكن بوت الزبائن (Customer Bot Token):</label>
                <input 
                  type="text"
                  value={telegramSettings.customerTelegramBotToken || ''}
                  onChange={(e) => setTelegramSettings({...telegramSettings, customerTelegramBotToken: e.target.value})}
                  className="w-full bg-[#111] border border-emerald-500/30 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 transition-all font-mono text-xs"
                  placeholder="مثال: 987654321:XYZabc..."
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-emerald-400 mr-2">معرف بوت الزبائن (Customer Bot Username):</label>
                <input 
                  type="text"
                  value={telegramSettings.customerTelegramBotUsername || ''}
                  onChange={(e) => setTelegramSettings({...telegramSettings, customerTelegramBotUsername: e.target.value})}
                  className="w-full bg-[#111] border border-emerald-500/30 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 transition-all text-xs"
                  placeholder="مثال: @AurumInvoiceBot"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400 mr-2">Chat ID افتراضي لاختبار بوت الزبائن (اختياري):</label>
              <input 
                type="text"
                value={telegramSettings.customerTelegramDefaultChatId || ''}
                onChange={(e) => setTelegramSettings({...telegramSettings, customerTelegramDefaultChatId: e.target.value})}
                className="w-full bg-[#111] border border-[#222] rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 transition-all font-mono text-xs"
                placeholder="أدخل Chat ID الخاص بك للتجربة إذا لم يقم الزبون بتزويد معرفه"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-400 mr-2">رقم هاتف الأدمن للواتساب (للمراسلة المباشرة):</label>
            <input 
              type="text"
              value={telegramSettings.adminPhone}
              onChange={(e) => setTelegramSettings({...telegramSettings, adminPhone: e.target.value})}
              className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all text-xs"
              placeholder="مثلاً: 0991234567"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={handleUpdateTelegramSettings}
              disabled={loading}
              className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "حفظ إعدادات البوتات ⚜️"}
            </button>
            <button 
              onClick={handleTestTelegramBot}
              disabled={loading}
              className="w-full bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#D4AF37] hover:text-black font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "تجربة بوت الأدمن ✈️"}
            </button>
            <button 
              onClick={handleTestCustomerTelegramBot}
              disabled={loading}
              className="w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-black font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "تجربة بوت الزبائن آلياً بالسيرفر 🤖"}
            </button>
          </div>
        </div>
      </div>
      <div className="bg-[#111] border border-white/5 rounded-[35px] p-8">
        <h3 className="text-xl font-black text-white mb-4">إحصائيات عامة ⚜️</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-6 bg-black border border-white/5 rounded-3xl">
            <p className="text-gray-500 text-[10px] font-bold uppercase mb-1">المستخدمين</p>
            <p className="text-2xl font-black text-[#D4AF37]">{users.length}</p>
          </div>
          <div className="p-6 bg-black border border-white/5 rounded-3xl">
            <p className="text-gray-500 text-[10px] font-bold uppercase mb-1">المنتجات</p>
            <p className="text-2xl font-black text-[#D4AF37]">{products.length}</p>
          </div>
          <div className="p-6 bg-black border border-white/5 rounded-3xl">
            <p className="text-gray-500 text-[10px] font-bold uppercase mb-1">الطلبات</p>
            <p className="text-2xl font-black text-[#D4AF37]">{orders.length}</p>
          </div>
          <div className="p-6 bg-black border border-white/5 rounded-3xl">
            <p className="text-gray-500 text-[10px] font-bold uppercase mb-1">اللحظات</p>
            <p className="text-2xl font-black text-[#D4AF37]">{stories.length}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderRewardsTab = () => (
    <motion.div 
      key="rewards"
      initial={{ opacity: 0, scale: 0.98, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.02, x: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-12"
    >
      <section>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-white">منتجات الاستبدال كـ مكافأة</h2>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Reward Redemption Center</p>
          </div>
          <div className="flex gap-2">
            {redeemableProducts.length > 0 && (
              <button 
                onClick={handleDeleteAllRedeemables}
                className="bg-red-500/20 text-red-400 border border-red-500/30 px-5 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-red-500 hover:text-white transition-all shadow-md active:scale-95"
              >
                <Trash2 size={18} />
                حذف جميع المكافآت
              </button>
            )}
            <button 
              onClick={() => {
                setEditingRewardId(null);
                setNewRedeemable({ name: '', image: '', pointsCost: 500, description: '' });
                setShowAddRedeemable(true);
              }}
              className="bg-[#D4AF37] text-black px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-[#b8962d] transition-all"
            >
              <Plus size={18} />
              إضافة جائزة ملكية
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {redeemableProducts.map((p: RedeemableProduct) => (
            <div key={`admin-reward-${p.id}`} className="bg-[#111] border border-[#D4AF37]/20 rounded-3xl p-6 flex gap-4 relative overflow-hidden group">
              <img src={p.image || null} className="w-24 h-24 rounded-2xl object-cover" />
              <div className="flex-1">
                <h4 className="font-black text-lg text-white mb-1">{p.name}</h4>
                <p className="text-[#D4AF37] font-black text-xs uppercase mb-3 leading-none italic">الملكية: {(p.pointsCost || 0).toLocaleString()} نقطة</p>
                <p className="text-gray-500 text-[10px] line-clamp-2">{p.description}</p>
              </div>
              <div className="absolute top-4 left-4 flex gap-2">
                <button 
                  onClick={() => openEditReward(p)}
                  className="p-2.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center"
                  title="تعديل المكافأة"
                >
                  <Pencil size={16} />
                </button>
                <button 
                  onClick={() => handleDeleteRedeemable(p.id)}
                  className="p-2.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center"
                  title="حذف المكافأة"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-white">إعدادات عجلة الحظ 🎡</h2>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Fortune Wheel Prizes</p>
          </div>
          <button 
            onClick={() => {
              setEditingPrizeId(null);
              setNewPrize({ label: '', value: 50, color: '#D4AF37' });
              setShowAddPrize(true);
            }}
            className="bg-[#D4AF37] text-black px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-[#b8962d] transition-all"
          >
            <Plus size={18} />
            إضافة شريحة فوز
          </button>
        </div>
        <div className="bg-black/40 border border-white/5 rounded-3xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {wheelPrizes.map((pz: WheelPrize) => (
              <div key={`admin-prize-${pz.id}`} className="p-4 rounded-2xl flex items-center justify-between group" style={{ backgroundColor: pz.color + '20', border: `1px solid ${pz.color}40` }}>
                <div>
                  <p className="font-black text-white text-sm">{pz.label}</p>
                  <p className="font-bold text-[10px]" style={{ color: pz.color }}>+{(pz.value || 0).toLocaleString()} نقطة</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditPrize(pz)}
                    className="text-blue-500 hover:scale-110 transition-transform p-1"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeletePrize(pz.id)}
                    className="text-red-500 hover:scale-110 transition-transform p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {wheelPrizes.length === 0 && (
            <p className="text-center text-gray-700 py-10 font-bold italic">لا توجد شرائح حالياً.. العجلة فارغة ⚜️</p>
          )}
        </div>
      </section>
    </motion.div>
  );

  const renderShopsTab = () => (
    <motion.div 
      key="shops"
      initial={{ opacity: 0, scale: 0.98, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.02, x: -20 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center bg-black/40 p-6 rounded-[35px] border border-white/5">
        <div>
          <h2 className="text-xl font-black text-amber-500">إدارة المتاجر ⚜️</h2>
          <p className="text-[10px] text-gray-500 font-bold">إضافة وحذف المتاجر في المول الذهبي</p>
        </div>
        <button 
          onClick={() => setShowAddShop(true)}
          className="bg-amber-500 text-black px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-amber-600 transition-all active:scale-95"
        >
          <Plus size={16} />
          إضافة متجر جديد
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shops.map((shop) => (
          <div key={`admin-shop-${shop.id}`} className="bg-[#111] border border-white/5 rounded-[35px] overflow-hidden group hover:border-[#D4AF37]/30 transition-all">
            <div className="aspect-video relative">
              <img src={shop.banner || 'https://picsum.photos/seed/shop/800/400'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute bottom-4 right-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 overflow-hidden">
                  <img src={shop.logo || 'https://picsum.photos/seed/logo/200/200'} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="font-black text-white text-sm">{shop.shopName}</h4>
                  <p className="text-[10px] text-gray-400 font-bold">{shop.category}</p>
                </div>
              </div>
            </div>
            <div className="p-5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">تاريخ الانضمام</span>
                <span className="text-xs font-bold text-white">{new Date(shop.createdAt).toLocaleDateString('ar-SY')}</span>
              </div>
              <button 
                onClick={() => handleDeleteMerchant(shop.id)}
                className="bg-red-500/10 text-red-500 p-3 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );

  const handleDeleteJewelryRequest = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الطلب؟")) return;
    try {
      await deleteDoc(doc(db, 'custom_jewelry_requests', id));
      setToast({ message: "تم حذف الطلب بنجاح ⚜️", visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  const handleUpdateJewelryRequest = async (req: CustomJewelryRequest, updates: Partial<CustomJewelryRequest>) => {
    try {
      await updateDoc(doc(db, 'custom_jewelry_requests', req.id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });

      // Create notification for user
      if (updates.status || updates.quotedPrice) {
        let message = '';
        if (updates.status === 'quoted') {
          message = `تم تقديم عرض سعر لتصميمك الخاص: ${updates.quotedPrice || req.quotedPrice} ⚜️`;
        } else if (updates.status === 'reviewed') {
          message = 'تمت مراجعة تصميمك الخاص من قبل الإدارة ⚜️';
        } else if (updates.status === 'accepted') {
          message = 'تم تأكيد قبولك لعرض السعر، سنبدأ العمل على التصميم ⚜️';
        } else if (updates.status === 'completed') {
          message = 'اكتمل تنفيذ تصميمك الخاص! سيتم التوصيل قريباً ⚜️';
        } else if (updates.status === 'rejected') {
          message = 'نعتذر، تم رفض طلب التصميم الخاص ⚜️';
        } else if (updates.quotedPrice && !updates.status) {
          message = `تحديث: السعر المقدر لتصميمك هو ${updates.quotedPrice} ⚜️`;
        }

        if (message) {
          await addDoc(collection(db, 'notifications'), {
            userId: req.userId,
            message,
            status: updates.status || req.status,
            type: 'CUSTOM_JEWELRY',
            createdAt: new Date().toISOString(),
            read: false
          });
        }
      }

      setToast({ message: "تم تحديث الطلب بنجاح ⚜️", visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء التحديث");
    }
  };

  const handleDeleteClothingRequest = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الطلب؟")) return;
    try {
      await deleteDoc(doc(db, 'clothing_design_requests', id));
      setToast({ message: "تم حذف الطلب بنجاح ⚜️", visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  const handleUpdateClothingRequest = async (req: ClothingDesignRequest, updates: Partial<ClothingDesignRequest>) => {
    try {
      await updateDoc(doc(db, 'clothing_design_requests', req.id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });

      // Create notification for user
      if (updates.status) {
        let message = '';
        if (updates.status === 'reviewed') {
          message = 'تمت مراجعة طلب تصميم ملابسك من قبل خبرائنا ⚜️';
        } else if (updates.status === 'ordered') {
          message = 'تم البدء في تنفيذ تصميم ملابسك الخاص! ✂️';
        } else if (updates.status === 'completed') {
          message = 'اكتمل تنفيذ تصميم ملابسك! سيتم التواصل معك للتسليم ⚜️';
        } else if (updates.status === 'cancelled') {
          message = 'نعتذر، تم إلغاء طلب تصميم ملابسك ⚜️';
        }

        if (message) {
          await addDoc(collection(db, 'notifications'), {
            userId: req.userId,
            message,
            status: updates.status || req.status,
            type: 'CLOTHING_DESIGN',
            createdAt: new Date().toISOString(),
            read: false
          });
        }
      }

      setToast({ message: "تم تحديث الطلب بنجاح ⚜️", visible: true });
      setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء التحديث");
    }
  };

  const renderClothingRequestsTab = () => (
    <motion.div 
      key="clothing_requests"
      initial={{ opacity: 0, scale: 0.98, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.02, x: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="bg-gradient-to-br from-amber-500/10 to-transparent p-8 rounded-[40px] border border-amber-500/20 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-right">
          <h2 className="text-2xl font-black text-amber-500 mb-2 flex items-center gap-3">
            <Scissors size={32} />
            طلبات تصميم الملابس ⚜️ Clothing Design
          </h2>
          <p className="text-gray-400 text-sm">مراجعة والرد على طلبات تصميم الملابس الخاصة بالزبائن.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {clothingRequests.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white/5 rounded-[40px] border border-dashed border-white/10">
            <Scissors size={48} className="mx-auto text-gray-800 mb-4" />
            <p className="text-gray-500 font-bold">لا يوجد طلبات تصميم ملابس حالياً ⚜️</p>
          </div>
        ) : (
          clothingRequests.map((req) => (
            <div key={req.id} className="bg-[#111] border border-white/5 rounded-[35px] overflow-hidden group hover:border-amber-500/30 transition-all">
               {req.imageUrl && (
                 <div className="aspect-video relative overflow-hidden">
                   <img src={req.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" onClick={() => setSelectedZoomImage(req.imageUrl)} />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                   <div className="absolute bottom-4 right-4 text-white font-black text-xs">صورة مرفقة للطلب ⚜️</div>
                 </div>
               )}
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="text-right">
                    <p className="text-white font-black text-lg">{req.userName || 'مستخدم مجهول'}</p>
                    <p className="text-gray-500 text-xs">{req.userEmail}</p>
                    <p className="text-amber-500 font-mono text-[10px] mt-1">{req.phone}</p>
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter border",
                    req.status === 'pending' ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
                    req.status === 'reviewed' ? "bg-blue-500/10 text-blue-500 border-blue-500/30" :
                    req.status === 'ordered' ? "bg-purple-500/10 text-purple-500 border-purple-500/30" :
                    req.status === 'completed' ? "bg-emerald-600 text-black border-emerald-600" :
                    "bg-red-500/10 text-red-500 border-red-500/30"
                  )}>
                    {req.status === 'pending' ? 'بانتظار المراجعة' :
                     req.status === 'reviewed' ? 'تمت المراجعة' :
                     req.status === 'ordered' ? 'قيد التنفيذ' :
                     req.status === 'completed' ? 'تم الانتهاء' : 'ملغي'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                    <p className="text-[8px] text-[#D4AF37] font-black uppercase mb-1">نوع القماش:</p>
                    <p className="text-xs text-white font-bold">{req.fabricType || 'غير محدد'}</p>
                  </div>
                  <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                    <p className="text-[8px] text-[#D4AF37] font-black uppercase mb-1">التاريخ:</p>
                    <p className="text-xs text-white font-bold">{new Date(req.createdAt).toLocaleDateString('ar-SY')}</p>
                  </div>
                </div>

                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                  <p className="text-xs text-gray-400 font-bold mb-2">الفكرة / الوصف:</p>
                  <p className="text-sm text-white leading-relaxed">{req.idea}</p>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                  <select 
                    className="bg-black/40 border border-white/10 rounded-lg text-[10px] font-bold py-2 px-3 text-amber-500 flex-1 outline-none focus:border-amber-500"
                    value={req.status}
                    onChange={(e) => handleUpdateClothingRequest(req, { status: e.target.value as ClothingDesignRequest['status'] })}
                  >
                    <option value="pending">بانتظار المراجعة</option>
                    <option value="reviewed">تمت المراجعة</option>
                    <option value="ordered">البدء في التنفيذ</option>
                    <option value="completed">تم الانتهاء والتسليم</option>
                    <option value="cancelled">إلغاء الطلب</option>
                  </select>
                  
                  <button 
                    onClick={() => handleDeleteClothingRequest(req.id)}
                    className="bg-red-500/10 text-red-500 border border-red-500/10 p-2 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );

  const renderJewelryRequestsTab = () => (
    <motion.div 
      key="jewelry_requests"
      initial={{ opacity: 0, scale: 0.98, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.02, x: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="bg-gradient-to-br from-[#D4AF37]/10 to-transparent p-8 rounded-[40px] border border-[#D4AF37]/20 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-right">
          <h2 className="text-2xl font-black text-[#D4AF37] mb-2 flex items-center gap-3">
            <Gem size={32} />
            طلبات التفصيل الخاصة ⚜️ Custom Designs
          </h2>
          <p className="text-gray-400 text-sm">مراجعة والرد على طلبات التصميم الخاص حسب الطلب (فضة، نحاس، إلخ).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {jewelryRequests.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white/5 rounded-[40px] border border-dashed border-white/10">
            <Gem size={48} className="mx-auto text-gray-800 mb-4" />
            <p className="text-gray-500 font-bold">لا يوجد طلبات تصميم خاص حالياً ⚜️</p>
          </div>
        ) : (
          jewelryRequests.map((req) => (
            <div key={req.id} className="bg-[#111] border border-white/5 rounded-[35px] overflow-hidden group hover:border-[#D4AF37]/30 transition-all">
               {req.imageUrl && (
                 <div className="aspect-video relative overflow-hidden">
                   <img src={req.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 cursor-zoom-in" onClick={() => setSelectedZoomImage(req.imageUrl!)} />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                   <div className="absolute bottom-4 right-4 text-white font-black text-xs">صورة مرفقة للطلب ⚜️</div>
                 </div>
               )}
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="text-right">
                    <p className="text-white font-black text-lg">{req.userName || 'مستخدم مجهول'}</p>
                    <p className="text-gray-500 text-xs">{req.userEmail}</p>
                    <p className="text-[#D4AF37] font-mono text-[10px] mt-1">{req.phone}</p>
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter border",
                    req.status === 'pending' ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
                    req.status === 'reviewed' ? "bg-blue-500/10 text-blue-500 border-blue-500/30" :
                    req.status === 'quoted' ? "bg-purple-500/10 text-purple-500 border-purple-500/30" :
                    req.status === 'accepted' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" :
                    req.status === 'completed' ? "bg-emerald-600 text-black border-emerald-600" :
                    "bg-red-500/10 text-red-500 border-red-500/30"
                  )}>
                    {req.status === 'pending' ? 'بانتظار المراجعة' :
                     req.status === 'reviewed' ? 'تمت المراجعة' :
                     req.status === 'quoted' ? 'تم تقديم عرض سعر' :
                     req.status === 'accepted' ? 'تم القبول' :
                     req.status === 'completed' ? 'مكتمل' : 'مرفوض'}
                  </span>
                </div>

                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                  <p className="text-xs text-gray-400 font-bold mb-2">وصف الطلب:</p>
                  <p className="text-sm text-white leading-relaxed">{req.description}</p>
                </div>

                {req.quotedPrice && (
                  <div className="bg-[#D4AF37]/5 p-3 rounded-xl border border-[#D4AF37]/20 flex justify-between items-center">
                    <span className="text-[10px] text-[#D4AF37] font-black">السعر المقدر:</span>
                    <span className="text-sm font-black text-white">{req.quotedPrice}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                  <select 
                    className="bg-black/40 border border-white/10 rounded-lg text-[10px] font-bold py-2 px-3 text-[#D4AF37] flex-1 outline-none focus:border-[#D4AF37]"
                    value={req.status}
                    onChange={(e) => handleUpdateJewelryRequest(req, { status: e.target.value as CustomJewelryRequest['status'] })}
                  >
                    <option value="pending">بانتظار المراجعة</option>
                    <option value="reviewed">تمت المراجعة</option>
                    <option value="quoted">تقديم عرض سعر</option>
                    <option value="accepted">تم القبول من الزبون</option>
                    <option value="completed">مكتمل</option>
                    <option value="rejected">رفض الطلب</option>
                  </select>
                  
                  <button 
                    onClick={() => {
                      const price = prompt("أدخل عرض السعر المقدر (مثلاً: 5,000,000 ل.س):", req.quotedPrice || "");
                      if (price !== null) handleUpdateJewelryRequest(req, { quotedPrice: price, status: 'quoted' });
                    }}
                    className="bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 p-2 rounded-lg hover:bg-[#D4AF37] hover:text-black transition-all"
                    title="تحديث السعر"
                  >
                    <CreditCard size={16} />
                  </button>

                  <button 
                    onClick={() => handleDeleteJewelryRequest(req.id)}
                    className="bg-red-500/10 text-red-500 border border-red-500/20 p-2 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                    title="حذف الطلب"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <p className="text-[8px] text-gray-600 text-left font-mono">{new Date(req.createdAt).toLocaleString('ar-SY')}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );

  const renderBannersTab = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center bg-[#D4AF37]/5 p-6 rounded-[30px] border border-[#D4AF37]/10">
        <div>
          <h2 className="text-2xl font-black text-white mb-1">إدارة البانرات والاعلانات ⚜️</h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">تحكم بالعروض التي تظهر في الواجهة الرئيسية</p>
        </div>
        <button 
          onClick={() => setShowAddBanner(true)}
          className="bg-[#D4AF37] text-black px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-amber-500/20"
        >
          <Camera size={18} />
          <span>إضافة إعلان جديد</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {banners.map((ban) => (
          <div key={ban.id} className="bg-[#111] border border-white/5 rounded-[35px] overflow-hidden group">
            <div className="aspect-[16/9] relative">
              <img src={ban.image} alt={ban.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <button 
                onClick={() => handleDeleteBanner(ban.id)}
                className="absolute top-4 left-4 p-3 bg-red-500 text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-black text-[#D4AF37] mb-1">{ban.title}</h3>
              <p className="text-gray-400 text-xs mb-3">{ban.subtitle}</p>
              {ban.link && <p className="text-[10px] text-gray-500 truncate">الرابط: {ban.link}</p>}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showAddBanner && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddBanner(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-lg bg-[#0a0a0a] border border-[#D4AF37]/30 p-10 rounded-[40px] shadow-2xl">
              <h3 className="text-2xl font-black text-[#D4AF37] mb-8 text-center uppercase tracking-widest">إضافة إعلان ملكي جديد ⚜️</h3>
              <form onSubmit={handleAddBanner} className="space-y-4">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#D4AF37]/30 rounded-[30px] p-8 bg-black/40 hover:bg-[#D4AF37]/5 transition-all group relative overflow-hidden">
                  {newBanner.image ? (
                    <div className="relative w-full aspect-video rounded-2xl overflow-hidden">
                      <img src={newBanner.image} className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setNewBanner({...newBanner, image: ''})}
                        className="absolute top-2 left-2 bg-red-500 text-white p-2 rounded-xl shadow-lg hover:bg-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer w-full py-6">
                      <Camera size={48} className="text-[#D4AF37] mb-4 group-hover:scale-110 transition-transform" />
                      <span className="text-[#D4AF37] font-black text-xs uppercase tracking-widest">اضغط لرفع صورة الإعلان ⚜️</span>
                      <p className="text-gray-500 text-[10px] mt-2">يفضل استخدام صورة بدقة عالية</p>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setNewBanner({...newBanner, image: reader.result as string});
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest block mb-1 px-2">العنوان ⚜️</label>
                  <input type="text" value={newBanner.title} onChange={(e) => setNewBanner({...newBanner, title: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl py-4 px-5 text-sm focus:border-[#D4AF37]" placeholder="مثلاً: عروض الشتاء" required />
                </div>
                <div>
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest block mb-1 px-2">العنوان الفرعي 💎</label>
                  <input type="text" value={newBanner.subtitle} onChange={(e) => setNewBanner({...newBanner, subtitle: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl py-4 px-5 text-sm focus:border-[#D4AF37]" placeholder="خصم 50%" />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-[#D4AF37] text-black font-black py-5 rounded-2xl shadow-xl mt-6">
                  {loading ? "جاري الحفظ..." : "تأكيد الإضافة"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'requests': return renderRequestsTab();
      case 'users': return renderUsersTab();
      case 'orders': return renderOrdersTab();
      case 'products': return renderProductsTab();
      case 'shein': return renderSheinTab();
      case 'stories': return renderStoriesTab();
      case 'vip': return renderVIPTab();
      case 'inventory': return renderInventoryTab();
      case 'settings': return renderSettingsTab();
      case 'rewards': return renderRewardsTab();
      case 'shops': return renderShopsTab();
      case 'jewelry_requests': return renderJewelryRequestsTab();
      case 'clothing_requests': return renderClothingRequestsTab();
      case 'banners': return renderBannersTab();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 liquid-bg" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-2xl border-b border-[#D4AF37]/20 px-6 py-6 flex items-center justify-between shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4">
          <button onClick={handleBackWithTransition} className="w-12 h-12 rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-all active:scale-90">
            <ChevronRight size={28} />
          </button>
          <div className="text-right">
            <h1 className="text-2xl font-black text-[#D4AF37] flex items-center gap-3 font-serif italic tracking-wider">
              <ShieldCheck size={28} className="animate-pulse" />
              <span className="text-reveal">لوحة التحكم العليا ⚜️</span>
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mt-1">Aurum Management System</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleBackWithTransition}
            className="hidden md:flex px-8 py-3 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_10px_20px_rgba(212,175,55,0.3)] hover:scale-105 active:scale-95 items-center gap-2"
          >
            <ArrowRight size={16} />
            <span>العودة للمتجر ⚜️</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex overflow-x-auto no-scrollbar bg-black/50 backdrop-blur-xl border-b border-white/5 p-3 sticky top-[89px] z-40">
        <div className="flex gap-2 max-w-7xl mx-auto px-4">
          {tabs.map((tab) => (
            <button
              key={`admin-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-3 px-8 py-4 rounded-2xl whitespace-nowrap transition-all font-black text-xs uppercase tracking-widest",
                activeTab === tab.id 
                  ? "bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black shadow-[0_10px_25px_rgba(212,175,55,0.3)] scale-105" 
                  : "text-gray-500 hover:text-white hover:bg-white/5"
              )}
            >
              <tab.icon size={20} className={cn(activeTab === tab.id ? "animate-bounce" : "")} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-6 max-w-7xl mx-auto min-h-[60vh] relative overflow-hidden">
        <AnimatePresence mode="wait">
          {renderTabContent()}
        </AnimatePresence>
      </main>



        {/* Add Redeemable Modal */}
        <AnimatePresence>
          {showAddRedeemable && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddRedeemable(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-[40px] p-8 w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-black text-[#D4AF37] mb-6">
                  {editingRewardId ? 'تعديل المكافأة الملكية ⚜️' : 'إضافة منتج للمكافآت ⚜️'}
                </h3>
                <form onSubmit={handleAddRedeemable} className="space-y-4 text-right">
                  <div className="flex justify-center mb-4">
                    <div className="w-32 h-32 rounded-3xl border-2 border-dashed border-[#D4AF37]/30 flex items-center justify-center overflow-hidden bg-black/40 relative group">
                      {newRedeemable.image ? <img src={newRedeemable.image || null} className="w-full h-full object-cover" /> : <Package size={48} className="text-gray-800" />}
                      <label className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/60 flex items-center justify-center cursor-pointer transition-opacity">
                        <Upload size={24} className="text-[#D4AF37]" />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, (u) => setNewRedeemable({...newRedeemable, image: u}))} />
                      </label>
                    </div>
                  </div>
                  <input type="text" placeholder="اسم الجائزة" required className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37]" value={newRedeemable.name} onChange={(e) => setNewRedeemable({...newRedeemable, name: e.target.value})} />
                  <input type="number" placeholder="قيمة النقاط (الاستحقاق)" required className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white" value={newRedeemable.pointsCost} onChange={(e) => setNewRedeemable({...newRedeemable, pointsCost: parseInt(e.target.value) || 0})} />
                  <textarea placeholder="وصف الجائزة" className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white h-24" value={newRedeemable.description} onChange={(e) => setNewRedeemable({...newRedeemable, description: e.target.value})} />
                  <button type="submit" disabled={loading} className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" /> : editingRewardId ? <CheckCircle2 size={20} /> : <Plus size={20} />}
                    {editingRewardId ? "حفظ التعديلات" : "إضافة المكافأة ⚜️"}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add Prize Modal */}
        <AnimatePresence>
          {showAddPrize && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddPrize(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-[40px] p-8 w-full max-w-sm shadow-2xl">
                <h3 className="text-xl font-black text-[#D4AF37] mb-6">
                  {editingPrizeId ? 'تعديل شريحة الفوز 🎡' : 'إضافة شريحة فوز 🎡'}
                </h3>
                <form onSubmit={handleAddPrize} className="space-y-4 text-right">
                  <input type="text" placeholder="العنوان (مثلاً: 100 نقطة)" required className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white" value={newPrize.label} onChange={(e) => setNewPrize({...newPrize, label: e.target.value})} />
                  <input type="number" placeholder="قيمة النقاط المضافة" required className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white" value={newPrize.value} onChange={(e) => setNewPrize({...newPrize, value: parseInt(e.target.value) || 0})} />
                  <div>
                    <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">لون الشريحة</label>
                    <div className="flex gap-2">
                       {['#D4AF37', '#B8860B', '#FFD700', '#DAA520', '#C0C0C0', '#ffffff'].map(c => (
                         <button key={c} type="button" onClick={() => setNewPrize({...newPrize, color: c})} className={cn("w-10 h-10 rounded-full border-2", newPrize.color === c ? "border-white" : "border-transparent")} style={{ backgroundColor: c }} />
                       ))}
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-2xl shadow-lg mt-4 flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" /> : editingPrizeId ? <CheckCircle2 size={20} /> : <Plus size={20} />}
                    {editingPrizeId ? "حفظ التعديلات" : "إضافة الشريحة ⚜️"}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

          {activeTab === 'shops' && (
            <motion.div 
              key="shops"
              initial={{ opacity: 0, scale: 0.98, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 1.02, x: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center bg-black/40 p-6 rounded-[35px] border border-white/5">
                <div>
                  <h2 className="text-xl font-black text-amber-500">إدارة المتاجر ⚜️</h2>
                  <p className="text-[10px] text-gray-500 font-bold">إضافة وحذف المتاجر في المول الذهبي</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingShopId(null);
                    setNewShop({
                      name: '',
                      description: '',
                      category: 'عام',
                      image: 'https://picsum.photos/seed/shop/800/1000',
                      ownerEmail: 'admin@aurum.com',
                      ownerId: 'admin',
                      plan: 'plus',
                      delivery: 'aurum',
                      status: 'active'
                    });
                    setShowAddShop(true);
                  }}
                  className="bg-amber-500 text-black px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  <Plus size={18} />
                  إضافة متجر جديد
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {shops.map((shop) => (
                  <div key={`admin-shop-${shop.id}`} className="bg-[#111] border border-white/5 rounded-[35px] overflow-hidden group shadow-2xl">
                    <div className="aspect-video relative overflow-hidden">
                      <img src={shop.image || null} alt={shop.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                      <div className="absolute top-4 left-4 flex gap-2">
                        <button 
                          onClick={() => openEditShop(shop)}
                          className="bg-blue-600/80 text-white p-3 rounded-2xl hover:bg-blue-700 transition-all shadow-xl"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteShop(shop.id)}
                          className="bg-red-500/80 text-white p-3 rounded-2xl hover:bg-red-600 transition-all shadow-xl"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-black text-white text-lg">{shop.name}</h3>
                        <span className="text-[10px] bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full font-bold">{shop.category}</span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed">{shop.description}</p>
                      <div className="flex items-center gap-3 pt-4 border-t border-white/5 text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                        <User size={14} />
                        {shop.ownerEmail}
                      </div>
                    </div>
                  </div>
                ))}
                {shops.length === 0 && (
                  <div className="col-span-full py-20 text-center space-y-4 bg-white/5 rounded-[40px] border border-dashed border-white/10">
                    <Store size={48} className="mx-auto text-gray-800" />
                    <p className="text-gray-500 font-bold">لا يوجد متاجر حالياً في المول</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'invoices' && (
            <motion.div 
              key="invoices"
              initial={{ opacity: 0, scale: 0.98, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 1.02, x: -20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
            <h2 className="text-lg font-bold mb-4">فواتير إيجار الأركان:</h2>
            {invoices.map((inv) => (
              <div key={`admin-inv-${inv.id}`} className="bg-[#111] border border-[#D4AF37]/20 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-white">{inv.shopName}</h3>
                  <span className="text-xs text-gray-500">{new Date(inv.createdAt).toLocaleDateString('ar-SY')}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#D4AF37]/10 rounded-2xl text-[#D4AF37]">
                    <FileText size={24} />
                  </div>
                  <div>
                    <p className="text-xl font-black text-[#D4AF37]">{inv.amount}</p>
                    <p className="text-xs text-gray-500">طريقة الدفع: {inv.method}</p>
                  </div>
                </div>
                <div className="bg-black/40 p-4 rounded-2xl">
                  <p className="text-xs text-gray-500 mb-1">رقم العملية / المرجع:</p>
                  <p className="font-mono text-[#D4AF37] font-bold">{inv.transactionId}</p>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <button className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black py-3 rounded-xl text-xs transition-all border border-white/10">
                    تأكيد الاستلام
                  </button>
                  <button 
                    onClick={() => handleDeleteInvoice(inv.id)}
                    disabled={isDeleting}
                    className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                  >
                    {deletingId === inv.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              </div>
            ))}
            </motion.div>
          )}
      {/* Add Story Modal */}
      <AnimatePresence>
        {showAddStory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddStory(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-[40px] p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-[#D4AF37]">إضافة لحظة جديدة ⚜️</h3>
                <button onClick={() => setShowAddStory(false)} className="text-gray-500 hover:text-white">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddStory} className="space-y-6 text-right">
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">صورة اللحظة الآدمن</label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-40 rounded-3xl border-2 border-dashed border-[#D4AF37]/30 flex items-center justify-center overflow-hidden bg-black/40">
                      {newStory.image ? (
                        <img src={newStory.image || null} className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="text-gray-700" size={32} />
                      )}
                    </div>
                    <label className="flex-1 cursor-pointer bg-white/5 border border-white/10 rounded-2xl py-6 px-6 text-center hover:bg-[#D4AF37]/10 transition-all border-dashed border-[#D4AF37]/20">
                      <Upload className="mx-auto mb-2 text-[#D4AF37]" size={24} />
                      <span className="text-[10px] font-black uppercase tracking-widest block text-white">تحميل ملف ⚜️</span>
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, (url) => setNewStory({...newStory, image: url}))}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">نص اللحظة (اختياري)</label>
                  <input 
                    type="text"
                    placeholder="مثلاً: تشكيلة جديدة وصلت الآن..."
                    className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                    value={newStory.text}
                    onChange={(e) => setNewStory({...newStory, text: e.target.value})}
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">أو اختر من المعرض الملكي:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {LUXURY_IMAGES.map((img, i) => (
                      <button
                        key={`story-img-${i}`}
                        type="button"
                        onClick={() => setNewStory({...newStory, image: img})}
                        className={cn(
                          "aspect-square rounded-xl overflow-hidden border-2 transition-all",
                          newStory.image === img ? "border-[#D4AF37]" : "border-transparent"
                        )}
                      >
                        <img src={img || null} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : "نشر اللحظة ⚜️"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Shein Product Modal */}
      <AnimatePresence>
        {showAddSheinProduct && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setShowAddSheinProduct(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#0a0a0a] border border-amber-500/30 rounded-[40px] p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-amber-500 flex items-center gap-3">
                  <ShoppingBag size={28} />
                  {editingProductId ? 'تعديل قطعة شي إن ⚜️' : 'إضافة قطعة شي إن ⚜️'}
                </h2>
                <button onClick={() => setShowAddSheinProduct(false)} className="text-gray-500 hover:text-white"><XCircle size={24} /></button>
              </div>

              <form onSubmit={handleAddSheinProduct} className="space-y-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">صور المنتج (يمكنك إضافة عدة صور) ⚜️</label>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Main Image Selection */}
                    <div className="relative group aspect-square">
                      <div className="w-full h-full rounded-2xl border border-amber-500/30 flex items-center justify-center overflow-hidden bg-black/40 shadow-xl">
                        {newSheinProduct.image ? (
                          <img src={newSheinProduct.image || null} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag size={32} className="text-gray-800" />
                        )}
                      </div>
                      <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                        <Upload size={20} className="text-amber-500" />
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, (url) => setNewSheinProduct({...newSheinProduct, image: url}))}
                        />
                      </label>
                      <div className="absolute -top-1 -right-1 bg-amber-500 text-black text-[8px] font-bold px-1.5 rounded-full">الأساسية</div>
                    </div>

                    {/* Additional Images */}
                    {newSheinProduct.images.map((img, idx) => (
                      <div key={`shein-img-${idx}`} className="relative group aspect-square">
                        <div className="w-full h-full rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden bg-black/40 transition-all group-hover:border-amber-500/40">
                          <img src={img || null} className="w-full h-full object-cover" />
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            const updated = [...newSheinProduct.images];
                            updated.splice(idx, 1);
                            setNewSheinProduct({...newSheinProduct, images: updated});
                          }}
                          className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    ))}

                    {/* Add More Button */}
                    {newSheinProduct.images.length < 5 && (
                      <label className="aspect-square rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-amber-500/20 transition-all">
                        <Plus size={20} className="text-gray-600 mb-1" />
                        <span className="text-[7px] text-gray-500 font-bold uppercase">إضافة صورة</span>
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, (url) => setNewSheinProduct({
                            ...newSheinProduct, 
                            images: [...newSheinProduct.images, url]
                          }))}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">اسم المنتج</label>
                  <input type="text" value={newSheinProduct.name} onChange={(e) => setNewSheinProduct({...newSheinProduct, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-amber-500 transition-all font-bold" placeholder="مثال: فستان مخمل أسود" required />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">العملة 💵</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        type="button" 
                        onClick={() => setNewSheinProduct({...newSheinProduct, currency: 'SYP'})}
                        className={cn(
                          "py-3 rounded-xl text-[10px] font-bold border transition-all",
                          newSheinProduct.currency === 'SYP' ? "bg-[#D4AF37] text-black border-[#D4AF37]" : "bg-white/5 text-gray-500 border-white/10"
                        )}
                      >
                        ليرة سورية
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setNewSheinProduct({...newSheinProduct, currency: 'USD'})}
                        className={cn(
                          "py-3 rounded-xl text-[10px] font-bold border transition-all",
                          newSheinProduct.currency === 'USD' ? "bg-[#D4AF37] text-black border-[#D4AF37]" : "bg-white/5 text-gray-500 border-white/10"
                        )}
                      >
                        دولار
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">تفعيل عرض (Sale) 🏷️</label>
                    <button 
                      type="button"
                      onClick={() => setNewSheinProduct({...newSheinProduct, isSale: !newSheinProduct.isSale})}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        newSheinProduct.isSale ? "bg-amber-500" : "bg-gray-700"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                        newSheinProduct.isSale ? "right-7" : "right-1"
                      )} />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {newSheinProduct.isSale ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-red-500 uppercase tracking-widest px-1">السعر القديم ({newSheinProduct.currency === 'SYP' ? 'ل.س' : '$'})</label>
                        <input type="text" value={newSheinProduct.oldPrice} onChange={(e) => setNewSheinProduct({...newSheinProduct, oldPrice: e.target.value})} className="w-full bg-red-500/5 border border-red-500/20 rounded-xl py-3 px-4 focus:border-red-500 transition-all text-center font-bold text-red-400 placeholder:text-red-900/30" placeholder="100,000" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest px-1">السعر الجديد ({newSheinProduct.currency === 'SYP' ? 'ل.س' : '$'})</label>
                        <input type="text" value={newSheinProduct.salePrice} onChange={(e) => setNewSheinProduct({...newSheinProduct, salePrice: e.target.value, price: e.target.value})} className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-xl py-3 px-4 focus:border-emerald-500 transition-all text-center font-black text-emerald-400 placeholder:text-emerald-900/30" placeholder="75,000" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 text-right">
                      <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">السعر الحالي ({newSheinProduct.currency === 'SYP' ? 'ليرة سورية' : 'دولار'})</label>
                      <input type="text" value={newSheinProduct.price} onChange={(e) => setNewSheinProduct({...newSheinProduct, price: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-6 focus:border-amber-500 transition-all text-center font-black" placeholder={newSheinProduct.currency === 'SYP' ? "85,000" : "45"} required />
                      
                      {newSheinProduct.currency === 'SYP' && newSheinProduct.price && (
                        <p className="text-[10px] text-amber-500/60 font-bold mt-2 pr-2">
                          ⚜️ سيظهر أيضاً: {(parseInt(newSheinProduct.price.replace(/[^0-9]/g, '')) / 100 || 0).toLocaleString()} ليرة سورية (جديد)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">إصدار محدود 🔥 Limited</label>
                    <button 
                      type="button"
                      onClick={() => setNewSheinProduct({...newSheinProduct, isLimitedEdition: !newSheinProduct.isLimitedEdition})}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        newSheinProduct.isLimitedEdition ? "bg-amber-500" : "bg-gray-700"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                        newSheinProduct.isLimitedEdition ? "right-7" : "right-1"
                      )} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">عرض في الواجهة ⚜️</label>
                    <button 
                      type="button"
                      onClick={() => setNewSheinProduct({...newSheinProduct, isFeatured: !newSheinProduct.isFeatured})}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        newSheinProduct.isFeatured ? "bg-amber-500" : "bg-gray-700"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                        newSheinProduct.isFeatured ? "right-7" : "right-1"
                      )} />
                    </button>
                  </div>
                </div>

                {newSheinProduct.isLimitedEdition && (
                  <div className="grid grid-cols-2 gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-amber-500 uppercase tracking-widest px-1">العدد الكلي للقطع</label>
                      <input type="number" value={newSheinProduct.limitedUnits} onChange={(e) => setNewSheinProduct({...newSheinProduct, limitedUnits: parseInt(e.target.value) || 0})} className="w-full bg-black border border-amber-500/20 rounded-xl py-3 px-4 text-center font-bold text-amber-400" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-amber-500 uppercase tracking-widest px-1">المتبقي حالياً</label>
                      <input type="number" value={newSheinProduct.remainingUnits} onChange={(e) => setNewSheinProduct({...newSheinProduct, remainingUnits: parseInt(e.target.value) || 0})} className="w-full bg-black border border-amber-500/20 rounded-xl py-3 px-4 text-center font-bold text-amber-400" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">المتجر التابع له ⚜️</label>
                    <select 
                      value={newSheinProduct.shopId} 
                      onChange={(e) => setNewSheinProduct({...newSheinProduct, shopId: e.target.value})} 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-amber-500 transition-all text-[10px] font-bold"
                    >
                      <option value="admin">إدارة AURUM (رئيسي)</option>
                      {shops.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">البراند</label>
                    <input type="text" value={newSheinProduct.brand} onChange={(e) => setNewSheinProduct({...newSheinProduct, brand: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-amber-500 transition-all text-center font-bold" placeholder="SHEIN" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">وصف المنتج</label>
                  <textarea value={newSheinProduct.description} onChange={(e) => setNewSheinProduct({...newSheinProduct, description: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 h-32 focus:border-amber-500 transition-all resize-none" placeholder="اكتب تفاصيل المنتج هنا..." required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">القياسات المتوفرة (فواصل بينها)</label>
                    <input 
                      type="text" 
                      value={newSheinProduct.availableSizes?.join(', ') || ''} 
                      onChange={(e) => setNewSheinProduct({...newSheinProduct, availableSizes: e.target.value.split(',').map(s => s.trim()).filter(s => !!s)})} 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-amber-500 transition-all text-center" 
                      placeholder="S, M, L, XL" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">الألوان (فواصل بينها)</label>
                    <input 
                      type="text" 
                      value={newSheinProduct.availableColors?.join(', ') || ''} 
                      onChange={(e) => setNewSheinProduct({...newSheinProduct, availableColors: e.target.value.split(',').map(s => s.trim()).filter(s => !!s)})} 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-amber-500 transition-all text-center" 
                      placeholder="أسود, أبيض, أحمر" 
                    />
                  </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-4 text-[10px] text-amber-500 font-bold">
                  <Truck size={20} />
                  سيتم إضافة وسم "توصيل خلال 15 يوم" تلقائياً لهذا المنتج ⚜️
                </div>

                <button type="submit" disabled={loading} className="w-full bg-amber-500 text-black py-5 rounded-[25px] font-black text-lg flex items-center justify-center gap-3 shadow-[0_15px_30px_rgba(245,158,11,0.3)] hover:scale-[1.02] active:scale-95 transition-all">
                  {loading ? <Loader2 className="animate-spin" /> : editingProductId ? <CheckCircle2 size={24} /> : <Plus size={24} />}
                  {editingProductId ? 'حفظ التعديلات الملكية' : 'نشر في واجهة شي إن الملكية'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddProduct(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-[40px] p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-[#D4AF37]">
                  {editingProductId ? 'تعديل بيانات المنتج ⚜️' : 'إضافة منتج للواجهة ⚜️'}
                </h3>
                <button onClick={() => setShowAddProduct(false)} className="text-gray-500 hover:text-white">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddAdminProduct} className="space-y-6 text-right">
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">صور المنتج ⚜️</label>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Main Image */}
                    <div className="relative group aspect-square">
                      <div className="w-full h-full rounded-2xl border border-[#D4AF37]/30 flex items-center justify-center overflow-hidden bg-black/40">
                        {newProduct.image ? (
                          <img src={newProduct.image || null} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={24} className="text-gray-800" />
                        )}
                      </div>
                      <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                        <Upload size={20} className="text-[#D4AF37]" />
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, (url) => setNewProduct({...newProduct, image: url}))}
                        />
                      </label>
                      <div className="absolute top-1 right-1 bg-[#D4AF37] text-black text-[8px] font-bold px-1.5 rounded-full">الأساسية</div>
                    </div>

                    {/* Additional Images */}
                    {newProduct.images.map((img, idx) => (
                      <div key={`prod-gallery-${idx}`} className="relative group aspect-square">
                        <div className="w-full h-full rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden bg-black/40">
                          <img src={img || null} className="w-full h-full object-cover" />
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            const updated = [...newProduct.images];
                            updated.splice(idx, 1);
                            setNewProduct({...newProduct, images: updated});
                          }}
                          className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    ))}

                    {/* Add More */}
                    {newProduct.images.length < 5 && (
                      <label className="aspect-square rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-[#D4AF37]/20 transition-all">
                        <Plus size={20} className="text-gray-600 mb-1" />
                        <span className="text-[7px] text-gray-500 font-bold uppercase">إضافة صورة</span>
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, (url) => setNewProduct({
                            ...newProduct, 
                            images: [...newProduct.images, url]
                          }))}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">اسم المنتج</label>
                  <input 
                    type="text" required
                    className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">أو اختر من المعرض الملكي:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {LUXURY_IMAGES.map((img, i) => (
                      <button
                        key={`prod-img-${i}`}
                        type="button"
                        onClick={() => setNewProduct({...newProduct, image: img})}
                        className={cn(
                          "aspect-square rounded-xl overflow-hidden border-2 transition-all",
                          newProduct.image === img ? "border-[#D4AF37]" : "border-transparent"
                        )}
                      >
                        <img src={img || null} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">العملة 💵</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        type="button" 
                        onClick={() => setNewProduct({...newProduct, currency: 'SYP'})}
                        className={cn(
                          "py-3 rounded-xl text-[10px] font-bold border transition-all",
                          newProduct.currency === 'SYP' ? "bg-[#D4AF37] text-black border-[#D4AF37]" : "bg-white/5 text-gray-500 border-white/10"
                        )}
                      >
                        ليرة سورية
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setNewProduct({...newProduct, currency: 'USD'})}
                        className={cn(
                          "py-3 rounded-xl text-[10px] font-bold border transition-all",
                          newProduct.currency === 'USD' ? "bg-[#D4AF37] text-black border-[#D4AF37]" : "bg-white/5 text-gray-500 border-white/10"
                        )}
                      >
                        دولار
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">تفعيل عرض (Sale) 🏷️</label>
                    <button 
                      type="button"
                      onClick={() => setNewProduct({...newProduct, isSale: !newProduct.isSale})}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        newProduct.isSale ? "bg-amber-500" : "bg-gray-700"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                        newProduct.isSale ? "right-7" : "right-1"
                      )} />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {newProduct.isSale ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-red-500 uppercase tracking-widest px-1">السعر القديم ({newProduct.currency === 'SYP' ? 'ل.س' : '$'})</label>
                        <input type="text" value={newProduct.oldPrice} onChange={(e) => setNewProduct({...newProduct, oldPrice: e.target.value})} className="w-full bg-red-500/5 border border-red-500/20 rounded-xl py-3 px-4 focus:border-red-500 transition-all text-center font-bold text-red-400 placeholder:text-red-900/30 text-xs" placeholder="100,000" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-emerald-500 uppercase tracking-widest px-1">السعر الجديد ({newProduct.currency === 'SYP' ? 'ل.س' : '$'})</label>
                        <input type="text" value={newProduct.salePrice} onChange={(e) => setNewProduct({...newProduct, salePrice: e.target.value, price: e.target.value})} className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-xl py-3 px-4 focus:border-emerald-500 transition-all text-center font-black text-emerald-400 placeholder:text-emerald-900/30 text-xs" placeholder="75,000" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">السعر الحالي ({newProduct.currency === 'SYP' ? 'ليرة سورية' : 'دولار'})</label>
                      <input type="text" value={newProduct.price} onChange={(e) => setNewProduct({...newProduct, price: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-6 focus:border-amber-500 transition-all text-center font-black text-xs" placeholder={newProduct.currency === 'SYP' ? "85,000" : "45"} required />
                      
                      {newProduct.currency === 'SYP' && newProduct.price && (
                        <p className="text-[10px] text-amber-500/60 font-bold mt-2 pr-2">
                          ⚜️ سيظهر أيضاً: {(parseInt(newProduct.price.replace(/[^0-9]/g, '')) / 100 || 0).toLocaleString()} ليرة سورية (جديد)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">إصدار محدود 🔥 Limited</label>
                    <button 
                      type="button"
                      onClick={() => setNewProduct({...newProduct, isLimitedEdition: !newProduct.isLimitedEdition})}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        newProduct.isLimitedEdition ? "bg-[#D4AF37]" : "bg-gray-700"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                        newProduct.isLimitedEdition ? "right-7" : "right-1"
                      )} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">عرض في التوب ⚜️</label>
                    <button 
                      type="button"
                      onClick={() => setNewProduct({...newProduct, isFeatured: !newProduct.isFeatured})}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        newProduct.isFeatured ? "bg-[#D4AF37]" : "bg-gray-700"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                        newProduct.isFeatured ? "right-7" : "right-1"
                      )} />
                    </button>
                  </div>
                </div>

                {newProduct.isLimitedEdition && (
                  <div className="grid grid-cols-2 gap-3 p-4 bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-2xl">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-[#D4AF37] uppercase tracking-widest px-1">العدد الكلي للقطع</label>
                      <input type="number" value={newProduct.limitedUnits} onChange={(e) => setNewProduct({...newProduct, limitedUnits: parseInt(e.target.value) || 0})} className="w-full bg-black border border-[#D4AF37]/20 rounded-xl py-3 px-4 text-center font-bold text-[#D4AF37]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-[#D4AF37] uppercase tracking-widest px-1">المتبقي حالياً</label>
                      <input type="number" value={newProduct.remainingUnits} onChange={(e) => setNewProduct({...newProduct, remainingUnits: parseInt(e.target.value) || 0})} className="w-full bg-black border border-[#D4AF37]/20 rounded-xl py-3 px-4 text-center font-bold text-[#D4AF37]" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">الفئة</label>
                    <select 
                      className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white text-[9px] focus:outline-none focus:border-[#D4AF37] transition-all"
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                    >
                      <option>عطور</option>
                      <option>ساعات</option>
                      <option>ملابس رجالية</option>
                      <option>ملابس نسائية</option>
                      <option>ملابس أطفال</option>
                      <option>ألبسة أوروبية</option>
                      <option>إكسسوارات</option>
                      <option>شي ان</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">المتجر ⚜️</label>
                    <select 
                      className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white text-[9px] focus:outline-none focus:border-[#D4AF37] transition-all"
                      value={newProduct.shopId}
                      onChange={(e) => setNewProduct({...newProduct, shopId: e.target.value})}
                    >
                      <option value="admin">إدارة أوروم</option>
                      {shops.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">القسم في الموقع</label>
                  <select 
                    className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                    value={newProduct.section}
                    onChange={(e) => setNewProduct({...newProduct, section: e.target.value})}
                  >
                      <option value="home">الرئيسية</option>
                      <option value="mall">المول الذهبي</option>
                      <option value="featured">العروض المميزة</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">المخزون المتوفر 📦</label>
                    <input 
                      type="number" required
                      className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})}
                    />
                  </div>

                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 mr-2">الوصف</label>
                  <textarea 
                    required
                    className="w-full bg-black border border-[#222] rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all h-24"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                  />
                </div>

                {/* Sizes & Colors Input Section - Styled exactly as requested */}
                <div className="space-y-6 pt-4 border-t border-white/10">
                  {/* المقاسات المتاحة */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-[#D4AF37] text-right">المقاسات المتاحة</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="text" 
                        value={sizeInput}
                        onChange={(e) => setSizeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (sizeInput.trim()) {
                              const val = sizeInput.trim();
                              if (!newProduct.availableSizes?.includes(val)) {
                                setNewProduct({
                                  ...newProduct,
                                  availableSizes: [...(newProduct.availableSizes || []), val]
                                });
                              }
                              setSizeInput('');
                            }
                          }
                        }}
                        placeholder="مثال: S, M, L, XL, 42"
                        className="flex-1 bg-[#0f0f0f] border border-white/15 rounded-2xl py-3 px-4 text-white text-xs text-right focus:outline-none focus:border-[#D4AF37] transition-all"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (sizeInput.trim()) {
                            const val = sizeInput.trim();
                            if (!newProduct.availableSizes?.includes(val)) {
                              setNewProduct({
                                ...newProduct,
                                availableSizes: [...(newProduct.availableSizes || []), val]
                              });
                            }
                            setSizeInput('');
                          }
                        }}
                        className="bg-[#1f1f1f] text-[#D4AF37] border border-[#D4AF37]/40 px-5 py-3 rounded-2xl font-bold text-xs hover:bg-[#2a2a2a] active:scale-95 transition-all shrink-0"
                      >
                        إضافة مقاس
                      </button>
                    </div>

                    {/* Added Sizes Tags */}
                    {newProduct.availableSizes && newProduct.availableSizes.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1" dir="rtl">
                        {newProduct.availableSizes.map((size, idx) => (
                          <span 
                            key={`size-chip-${idx}`}
                            className="bg-[#111] border border-white/20 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
                          >
                            <button 
                              type="button" 
                              onClick={() => {
                                setNewProduct({
                                  ...newProduct,
                                  availableSizes: newProduct.availableSizes.filter(s => s !== size)
                                });
                              }}
                              className="text-gray-400 hover:text-red-400 transition-colors"
                            >
                              ✕
                            </button>
                            <span>{size}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* الألوان المتاحة */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-[#D4AF37] text-right">الألوان المتاحة</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="text" 
                        value={colorNameInput}
                        onChange={(e) => setColorNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (colorNameInput.trim()) {
                              const name = colorNameInput.trim();
                              const colorEntry = colorHexInput ? `${name}|${colorHexInput}` : name;
                              if (!newProduct.availableColors?.includes(colorEntry) && !newProduct.availableColors?.includes(name)) {
                                setNewProduct({
                                  ...newProduct,
                                  availableColors: [...(newProduct.availableColors || []), colorEntry]
                                });
                              }
                              setColorNameInput('');
                            }
                          }
                        }}
                        placeholder="اسم اللون (مثال: كحلي)"
                        className="flex-1 bg-[#0f0f0f] border border-white/15 rounded-2xl py-3 px-4 text-white text-xs text-right focus:outline-none focus:border-[#D4AF37] transition-all"
                      />
                      <input 
                        type="color"
                        value={colorHexInput}
                        onChange={(e) => setColorHexInput(e.target.value)}
                        className="w-10 h-10 rounded-xl border border-white/20 bg-transparent cursor-pointer p-0.5 shrink-0"
                        title="اختر لوناً"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (colorNameInput.trim()) {
                            const name = colorNameInput.trim();
                            const colorEntry = colorHexInput ? `${name}|${colorHexInput}` : name;
                            if (!newProduct.availableColors?.includes(colorEntry) && !newProduct.availableColors?.includes(name)) {
                              setNewProduct({
                                ...newProduct,
                                availableColors: [...(newProduct.availableColors || []), colorEntry]
                              });
                            }
                            setColorNameInput('');
                          }
                        }}
                        className="bg-[#1f1f1f] text-[#D4AF37] border border-[#D4AF37]/40 px-5 py-3 rounded-2xl font-bold text-xs hover:bg-[#2a2a2a] active:scale-95 transition-all shrink-0"
                      >
                        إضافة لون
                      </button>
                    </div>

                    {/* Added Colors Tags */}
                    {newProduct.availableColors && newProduct.availableColors.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1" dir="rtl">
                        {newProduct.availableColors.map((colorEntry, idx) => {
                          const parts = colorEntry.split('|');
                          const name = parts[0];
                          const hex = parts[1] || '#888888';
                          return (
                            <span 
                              key={`color-chip-${idx}`}
                              className="bg-[#111] border border-white/20 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
                            >
                              <button 
                                type="button" 
                                onClick={() => {
                                  setNewProduct({
                                    ...newProduct,
                                    availableColors: newProduct.availableColors.filter(c => c !== colorEntry)
                                  });
                                }}
                                className="text-gray-400 hover:text-red-400 transition-colors"
                              >
                                ✕
                              </button>
                              <span>{name}</span>
                              <span 
                                className="w-3.5 h-3.5 rounded-full inline-block border border-white/30 shrink-0" 
                                style={{ backgroundColor: hex }} 
                              />
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : editingProductId ? <CheckCircle2 size={20} /> : "إضافة المنتج للواجهة ⚜️"}
                  {!loading && editingProductId && "حفظ التغييرات ⚜️"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddShop && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddShop(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative bg-[#0d0d0d] border border-amber-500/20 rounded-[40px] p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-amber-500 flex items-center gap-3">
                  <Store size={28} />
                  {editingShopId ? 'تعديل بيانات المتجر ⚜️' : 'إنشاء متجر جديد ⚜️'}
                </h3>
                <button onClick={() => setShowAddShop(false)} className="text-gray-500 hover:text-white"><XCircle size={24} /></button>
              </div>

              <form onSubmit={handleAddShop} className="space-y-6 text-right">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-1">واجهة المتجر ⚜️</label>
                  <div className="relative group aspect-video">
                    <div className="w-full h-full rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden bg-black/40 shadow-xl">
                      {newShop.image ? <img src={newShop.image || null} className="w-full h-full object-cover" /> : <Store size={48} className="text-gray-800" />}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                      <Upload size={24} className="text-amber-500" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, (u) => setNewShop({...newShop, image: u}))} />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-500 mb-2 mr-2">اسم المتجر</label>
                  <input type="text" required placeholder="مثلاً: لورينت للعطور" className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-amber-500 transition-all font-bold" value={newShop.name} onChange={(e) => setNewShop({...newShop, name: e.target.value})} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-500 mb-2 mr-2">التصنيف</label>
                  <input type="text" required placeholder="مثلاً: عطور نيش فاخرة" className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-amber-500 transition-all" value={newShop.category} onChange={(e) => setNewShop({...newShop, category: e.target.value})} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-500 mb-2 mr-2">وصف المتجر</label>
                  <textarea required placeholder="وصف موجز للمتجر..." className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-white h-24 focus:outline-none focus:border-amber-500 transition-all" value={newShop.description} onChange={(e) => setNewShop({...newShop, description: e.target.value})} />
                </div>

                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black py-5 rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95 transition-all text-sm uppercase tracking-widest mt-4 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="animate-spin" /> : editingShopId ? <CheckCircle2 size={24} /> : <Store size={24} />}
                  {editingShopId ? "حفظ بيانات المتجر ⚜️" : "تأكيد وبدء المتجر ⚜️"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Reward Modal */}
      <AnimatePresence>
        {showAddRedeemable && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 text-right" dir="rtl">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => {
                setShowAddRedeemable(false);
                setEditingRewardId(null);
              }} 
              className="absolute inset-0 bg-black/90 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-[#0d0d0d] border border-[#D4AF37]/30 rounded-[40px] p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-[#D4AF37] flex items-center gap-3">
                  <Gift size={28} />
                  {editingRewardId ? 'تعديل جائزة الاستبدال ⚜️' : 'إضافة جائزة جديدة ⚜️'}
                </h3>
                <button 
                  onClick={() => {
                    setShowAddRedeemable(false);
                    setEditingRewardId(null);
                  }} 
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleAddRedeemable} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2">صورة المكافأة ⚜️</label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-2xl border border-white/10 overflow-hidden bg-black/40 flex items-center justify-center">
                      {newRedeemable.image ? (
                        <img src={newRedeemable.image} className="w-full h-full object-cover" />
                      ) : (
                        <Gift size={32} className="text-gray-700" />
                      )}
                    </div>
                    <label className="flex-1 cursor-pointer bg-white/5 border border-white/10 rounded-2xl p-4 text-center hover:bg-[#D4AF37]/10 transition-all border-dashed border-[#D4AF37]/20">
                      <Upload className="mx-auto mb-1 text-[#D4AF37]" size={20} />
                      <span className="text-[10px] font-black uppercase tracking-widest block text-white">رفع صورة المكافأة</span>
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, (url) => setNewRedeemable({...newRedeemable, image: url}))}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2">اسم المكافأة / المنتج</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="مثلاً: قسيمة شراء بقيمة 50,000 ل.س" 
                    className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all font-bold" 
                    value={newRedeemable.name} 
                    onChange={(e) => setNewRedeemable({...newRedeemable, name: e.target.value})} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2">تكلفة النقاط للاستبدال 🪙</label>
                  <input 
                    type="number" 
                    required 
                    placeholder="500" 
                    className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all font-black text-amber-400" 
                    value={newRedeemable.pointsCost} 
                    onChange={(e) => setNewRedeemable({...newRedeemable, pointsCost: parseInt(e.target.value) || 0})} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2">وصف الجائزة</label>
                  <textarea 
                    placeholder="تفاصيل وشروط الحصول على المكافأة..." 
                    className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-white h-24 focus:outline-none focus:border-[#D4AF37] transition-all resize-none" 
                    value={newRedeemable.description} 
                    onChange={(e) => setNewRedeemable({...newRedeemable, description: e.target.value})} 
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full bg-[#D4AF37] text-[#000] font-black py-5 rounded-2xl shadow-xl hover:bg-[#b8962d] active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : editingRewardId ? <CheckCircle2 size={22} /> : <Gift size={22} />}
                  {editingRewardId ? 'حفظ التعديلات الملكية ⚜️' : 'إضافة جائزة جديدة ⚜️'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Wheel Prize Modal */}
      <AnimatePresence>
        {showAddPrize && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 text-right" dir="rtl">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => {
                setShowAddPrize(false);
                setEditingPrizeId(null);
              }} 
              className="absolute inset-0 bg-black/90 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-[#0d0d0d] border border-[#D4AF37]/30 rounded-[40px] p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-[#D4AF37] flex items-center gap-3">
                  <Sparkles size={28} />
                  {editingPrizeId ? 'تعديل شريحة العجلة 🎡' : 'إضافة شريحة فوز 🎡'}
                </h3>
                <button 
                  onClick={() => {
                    setShowAddPrize(false);
                    setEditingPrizeId(null);
                  }} 
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleAddPrize} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2">عنوان الشريحة / النتيجة</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="مثلاً: حظ أوفر أو +100 نقطة" 
                    className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all font-bold" 
                    value={newPrize.label} 
                    onChange={(e) => setNewPrize({...newPrize, label: e.target.value})} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2">قيمة النقاط (0 للـ حظ أوفر)</label>
                  <input 
                    type="number" 
                    required 
                    placeholder="0" 
                    className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#D4AF37] transition-all font-black text-amber-400" 
                    value={newPrize.value} 
                    onChange={(e) => setNewPrize({...newPrize, value: parseInt(e.target.value) || 0})} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2">لون الشريحة 🎨</label>
                  <div className="flex gap-3 items-center">
                    <input 
                      type="color" 
                      value={newPrize.color} 
                      onChange={(e) => setNewPrize({...newPrize, color: e.target.value})}
                      className="w-12 h-12 rounded-xl border border-white/20 bg-transparent cursor-pointer p-1 shrink-0" 
                    />
                    <input 
                      type="text" 
                      value={newPrize.color} 
                      onChange={(e) => setNewPrize({...newPrize, color: e.target.value})}
                      className="flex-1 bg-black border border-white/10 rounded-2xl py-4 px-6 text-white text-center font-mono focus:outline-none focus:border-[#D4AF37]" 
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full bg-[#D4AF37] text-black font-black py-5 rounded-2xl shadow-xl hover:bg-[#b8962d] active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : editingPrizeId ? <CheckCircle2 size={22} /> : <Plus size={22} />}
                  {editingPrizeId ? 'حفظ تعديل الشريحة ⚜️' : 'إضافة الشريحة للعجلة ⚜️'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {productToDelete && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 text-right" dir="rtl">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setProductToDelete(null)} 
              className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }} 
              animate={{ scale: 1, y: 0, opacity: 1 }} 
              exit={{ scale: 0.9, y: 20, opacity: 0 }} 
              className="relative bg-[#0a0a0a] border border-red-500/30 rounded-[45px] p-8 w-full max-w-[320px] text-center shadow-[0_25px_100px_rgba(239,68,68,0.2)]"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <Trash2 size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">تحذير الحذف ⚜️</h3>
              <p className="text-gray-500 text-[11px] font-bold leading-relaxed mb-10 px-2">
                هل أنت متأكد من حذف هذا المنتج نهائياً من المتجر؟ لا يمكن التراجع عن هذه الخطوة وسيختفي المنتج من كافة الأقسام.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={confirmDeleteProduct}
                  disabled={loading}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-red-500/20 transition-all flex items-center justify-center gap-3 active:scale-95 text-sm"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24} />}
                  نعم، احذف المنتج نهائياً
                </button>
                <button 
                  onClick={() => setProductToDelete(null)}
                  disabled={loading}
                  className="w-full bg-white/5 text-gray-500 font-bold py-4 rounded-2xl hover:bg-white/10 transition-all active:scale-95 text-sm"
                >
                  إلغاء وتراجع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast 
        message={toast.message} 
        isVisible={toast.visible} 
        onClose={() => setToast(prev => ({ ...prev, visible: false }))} 
      />

      {/* Edit Points Modal */}
      <AnimatePresence>
        {editingUserPoints && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingUserPoints(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-[40px] p-10 w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
              <h3 className="text-xl font-black text-[#D4AF37] mb-8 text-center">تعديل رصيد النقاط ⚜️</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-3 text-right">رصيد النقاط الجديد:</label>
                  <input 
                    type="number" 
                    className="w-full bg-black border border-white/10 rounded-2xl py-5 px-6 text-2xl font-black text-center text-[#D4AF37] focus:border-[#D4AF37] outline-none transition-all"
                    value={editingUserPoints.points}
                    onChange={(e) => setEditingUserPoints({...editingUserPoints, points: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={handleUpdateUserPoints}
                    className="flex-1 bg-[#D4AF37] text-black font-black py-4 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm"
                  >
                    تحديث الرصيد
                  </button>
                  <button 
                    onClick={() => setEditingUserPoints(null)}
                    className="flex-1 bg-white/5 text-gray-400 font-bold py-4 rounded-2xl text-sm"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Image Zoom Modal */}
      <AnimatePresence>
        {selectedZoomImage && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedZoomImage(null)}
              className="absolute inset-0 bg-black/98 backdrop-blur-2xl" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative z-10 max-w-[95vw] max-h-[90vh] flex flex-col items-center gap-6"
            >
              <div className="relative group overflow-hidden rounded-[2rem] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
                <img 
                  src={selectedZoomImage} 
                  className="max-w-full max-h-[75vh] object-contain" 
                  alt="Zoomed Payment Receipt"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => window.open(selectedZoomImage, '_blank')}
                  className="px-8 py-4 rounded-2xl bg-[#D4AF37] text-black font-black text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl"
                >
                  <Upload size={18} />
                  تحميل الصورة الأصلية
                </button>
                <button 
                  onClick={() => setSelectedZoomImage(null)}
                  className="px-8 py-4 rounded-2xl bg-white/10 text-white font-bold text-sm border border-white/10 hover:bg-white/20 transition-all active:scale-95"
                >
                  إغلاق نافذة العرض
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
