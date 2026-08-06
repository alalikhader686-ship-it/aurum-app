import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0099863297",
  appId: "1:492658278901:web:72118e696040f8cd32a0bc",
  apiKey: "AIzaSyBlmJ_1CNodk98cjOVkqsHmONREWptZl4U",
  authDomain: "gen-lang-client-0099863297.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-11201cb2-e443-4723-8377-62a7dc80d69e",
  storageBucket: "gen-lang-client-0099863297.firebasestorage.app",
  messagingSenderId: "492658278901"
};

// Initialize the app with a custom name to prevent collisions with the primary app
const appName = "deliveryApp";
const deliveryApp = getApps().find(app => app.name === appName) 
  ? getApp(appName) 
  : initializeApp(firebaseConfig, appName);

const deliveryDb = getFirestore(deliveryApp, "ai-studio-11201cb2-e443-4723-8377-62a7dc80d69e");

interface DeliveryOrderInput {
  id: string;
  items: { name: string; quantity: number; shopName?: string }[];
  total: number;
  userName?: string;
  name?: string;
  phone?: string;
  city?: string;
  area?: string;
  coordinates?: { lat: number; lng: number };
  paymentMethod?: string;
}

export const deliveryService = {
  /**
   * Sends the approved order to the external delivery application 📦🚚
   */
  async sendOrderToDeliveryApp(orderData: DeliveryOrderInput) {
    try {
      console.log("🚚 DELIVERY SERVICE: Sending order details to delivery app...", orderData.id);
      
      const productsList = orderData.items?.map((it: { name: string; quantity: number }) => `${it.name} (عدد: ${it.quantity})`) || [];
      const shopName = orderData.items?.[0]?.shopName || "متجري الإلكتروني";
      
      const docRef = await addDoc(collection(deliveryDb, 'orders'), {
        customerName: orderData.userName || orderData.name || "زبون مجهول",
        customerPhone: orderData.phone || "غير محدد",
        storeName: shopName,
        storeAddress: {
          address: "موقع المستودع أو المتجر الرئيسي",
          lat: 33.5138,
          lng: 36.2765
        },
        customerAddress: {
          address: `${orderData.city || ""} - ${orderData.area || ""}`,
          lat: orderData.coordinates?.lat || 33.5102,
          lng: orderData.coordinates?.lng || 36.2913
        },
        items: productsList,
        totalPrice: Number(orderData.total || 0),
        paymentMethod: orderData.paymentMethod || "CASH",
        status: 'PENDING',
        createdAt: serverTimestamp()
      });
      
      console.log("🚚 DELIVERY SERVICE: Order successfully sent to delivery app with ID:", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("🚚 DELIVERY SERVICE ERROR: Failed to send order to delivery app:", error);
      throw error;
    }
  }
};
