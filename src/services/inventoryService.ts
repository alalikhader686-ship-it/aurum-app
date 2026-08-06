
/**
 * Inventory Service
 * Handles communication with the external inventory management system ⚜️
 */

const WEBHOOK_URL = 'https://ais-dev-fwxqfrx7maxrv2qsvdli5l-790254206537.europe-west2.run.app/api/webhook/sale';

export const inventoryService = {
  /**
   * Notifies the external system about a new sale/order 📦
   */
  async notifySale(order: {
    id: string;
    items: { id: string; name: string; quantity: number; price: string | number; category?: string }[];
    total: number;
    userEmail?: string;
    customerName?: string;
    status: string;
  }) {
    try {
      console.log('AURUM LOGISTICS ⚜️: نخطِر نظام المخزون الخارجي بالطلبية...', order.id);
      
      // We use a timeout to prevent long hangs if the external system is down
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          appId: 'aurum-luxury-app',
          event: 'sale_confirmed',
          orderId: order.id,
          timestamp: new Date().toISOString(),
          data: {
            items: order.items.map(item => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              category: item.category
            })),
            totalPrice: order.total,
            email: order.userEmail,
            customer: order.customerName,
            finalStatus: order.status
          }
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('AURUM LOGISTICS ⚜️: النظام الخارجي غير متاح حالياً، سيتم المزامنة لاحقاً.');
        return null;
      }

      console.log('AURUM LOGISTICS ⚜️: تم تحديث المخزون الخارجي بنجاح.');
      return await response.json();
    } catch {
      // Graceful handling of fetch errors - Service potentially offline
      return null;
    }
  },

  /**
   * Fetches latest inventory status to check availability 🛰️
   */
  async checkStock() {
    try {
      // In a real scenario, we might have a GET endpoint
      return { available: true }; // Placeholder
    } catch {
      return { available: true };
    }
  }
};
