// WhatsApp notification service for AURUM LUXURY MALL
import { Order, CartItem } from '../types';

export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Clean non-digits
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle Syrian local format (e.g. 0991234567 or 0933123456)
  if (cleaned.startsWith('09')) {
    cleaned = '963' + cleaned.substring(1);
  } else if (cleaned.startsWith('0') && cleaned.length >= 9) {
    cleaned = '963' + cleaned.substring(1);
  } else if (!cleaned.startsWith('963') && cleaned.length === 9) {
    // Missing leading zero or country code
    cleaned = '963' + cleaned;
  }
  return cleaned;
}

export function getWhatsAppUrl(phone: string, text: string): string {
  const formatted = formatPhoneNumber(phone);
  if (!formatted) return '#';
  return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
}

export function openWhatsApp(phone: string, text: string): boolean {
  const url = getWhatsAppUrl(phone, text);
  if (url === '#') return false;
  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    return true;
  } catch (err) {
    console.error('Failed to open WhatsApp URL:', err);
    try {
      window.location.href = url;
      return true;
    } catch {
      return false;
    }
  }
}

export function buildMerchantOrderMessage(order: Order, shopName?: string, shopItems?: CartItem[]): string {
  const itemsToReport = shopItems && shopItems.length > 0 ? shopItems : order.items;
  
  const itemsText = itemsToReport.map((item, i) => {
    const sizeStr = item.selectedSize ? ` (المقاس: ${item.selectedSize})` : '';
    const colorStr = item.selectedColor ? ` (اللون: ${item.selectedColor})` : '';
    const newSyp = item.newSypPrice ? ` - ${item.newSypPrice} ل.س جديد` : (item.price ? ` - ${item.price}` : '');
    return `${i + 1}. *${item.name}* × ${item.quantity || 1}${sizeStr}${colorStr}${newSyp}`;
  }).join('\n');

  const newSypTotal = ((order.total || 0) / 100).toLocaleString();

  return `🛍️ *طلب شراء جديد - ${shopName || 'متجرك الكريـم'}* 🛍️
  
📋 *رقم الطلب:* #${order.id.slice(-6).toUpperCase()}
👤 *اسم الزبون:* ${order.userName || order.userEmail || 'زبون AURUM'}
📱 *رقم الزبون:* ${order.phone || 'غير محدد'}
📍 *عنوان التسليم:* ${order.city || ''} - ${order.area || ''}

🛒 *المنتجات المطلوبة:*
${itemsText}

💰 *الإجمالي المطلوب:* ${(order.total || 0).toLocaleString()} ل.س (${newSypTotal} بالليرة الجديدة)

يرجى تجهيز المنتجات المطلوبة للمندوب ⚜️`;
}

export function buildAdminOrderMessage(order: Order): string {
  const itemsText = (order.items || []).map((item, i) => {
    const shopStr = item.shopName ? ` [${item.shopName}]` : '';
    const sizeStr = item.selectedSize ? ` (${item.selectedSize})` : '';
    const newSyp = item.newSypPrice ? ` - ${item.newSypPrice} ل.س جديد` : '';
    return `${i + 1}. *${item.name}*${shopStr} × ${item.quantity || 1}${sizeStr}${newSyp}`;
  }).join('\n');

  const newSypTotal = ((order.total || 0) / 100).toLocaleString();

  return `⚜️ *إشعار طلب شراء جديد للآدمن - AURUM MALL* ⚜️

📋 *رقم الفاتورة:* #${order.id.slice(-6).toUpperCase()}
👤 *اسم الزبون:* ${order.userName || order.userEmail || 'زبون جديد'}
📱 *رقم الهاتف:* ${order.phone}
📍 *العنوان:* ${order.city} - ${order.area}
💳 *طريقة الدفع:* ${order.paymentMethod}

🛍️ *قائمة المنتجات المطلوبة:*
${itemsText}

💵 *المجموع الكلي:* ${(order.total || 0).toLocaleString()} ل.س (${newSypTotal} بالليرة الجديدة)

يرجى الدخول للوحة الإدارة للمراجعة والموافقة على الطلب ⚜️`;
}

export function buildCustomerApprovalMessage(order: Order): string {
  const itemsText = (order.items || []).map((item, i) => {
    const priceStr = item.price ? ` (${item.price})` : '';
    const qtyStr = item.quantity ? ` × ${item.quantity}` : '';
    const newSyp = item.newSypPrice ? ` [${item.newSypPrice} ل.س جديد]` : '';
    return `${i + 1}. *${item.name}*${qtyStr}${priceStr}${newSyp}`;
  }).join('\n');

  const newSypTotal = ((order.total || 0) / 100).toLocaleString();

  return `✨ *تم الموافقة على طلبك بنجاح من AURUM LUXURY MALL* ⚜️

أهلاً بك عزيزنا ${order.userName || ''}، نود إعلامك بأنه تم قبول طلبك وتثبيت الفاتورة بنجاح.

🧾 *تفاصيل الفاتورة الخاصة بك:*
🆔 *رقم الطلب:* #${order.id.slice(-6).toUpperCase()}
🛍️ *المنتجات:*
${itemsText}
💵 *المجموع الكلي:* ${(order.total || 0).toLocaleString()} ل.س (${newSypTotal} بالليرة الجديدة)
💳 *طريقة الدفع:* ${order.paymentMethod}
📍 *العنوان:* ${order.city} - ${order.area}

انتظر المندوب شكراً 🛵`;
}
