// Telegram Bot Notification Service for AURUM LUXURY MALL
import { Order, CartItem } from '../types';

export async function sendTelegramBotMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<boolean> {
  const cleanToken = (botToken || '').trim().replace(/^["']|["']$/g, '');
  const cleanChatId = (chatId || '').trim().replace(/^["']|["']$/g, '');

  if (!cleanToken || !cleanChatId) {
    console.warn('Telegram API ⚠️: Missing Telegram botToken or chatId');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await response.json();
    if (data.ok) {
      console.log('AURUM TELEGRAM BOT 🤖: Message sent successfully!');
      return true;
    } else {
      console.error('Telegram API error response:', data);
    }
  } catch (err) {
    console.warn('Failed POST to Telegram message API, trying GET fallback...', err);
  }

  // Fallback GET request if POST fetch fails or has CORS issues
  try {
    const getUrl = `https://api.telegram.org/bot${cleanToken}/sendMessage?chat_id=${encodeURIComponent(cleanChatId)}&text=${encodeURIComponent(text)}&parse_mode=HTML`;
    const res = await fetch(getUrl);
    const data = await res.json();
    return data.ok === true;
  } catch (fallbackErr) {
    console.error('Failed GET fallback to Telegram message API:', fallbackErr);
    return false;
  }
}

export function getTelegramUrl(usernameOrPhone: string, text: string): string {
  if (!usernameOrPhone) return '#';
  const clean = usernameOrPhone.replace('@', '').trim();
  return `https://t.me/${clean}?text=${encodeURIComponent(text)}`;
}

export function openTelegram(usernameOrPhone: string, text: string): boolean {
  const url = getTelegramUrl(usernameOrPhone, text);
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
    console.error('Failed to open Telegram URL:', err);
    try {
      window.location.href = url;
      return true;
    } catch {
      return false;
    }
  }
}

// Format message for Admin on Telegram
export function buildAdminTelegramMessage(order: Order): string {
  const itemsText = (order.items || []).map((item, i) => {
    const shopStr = item.shopName ? ` [<b>${item.shopName}</b>]` : '';
    const sizeStr = item.selectedSize ? ` (${item.selectedSize})` : '';
    const newSyp = item.newSypPrice ? ` - <i>${item.newSypPrice} ل.س جديد</i>` : '';
    return `${i + 1}. <b>${item.name}</b>${shopStr} × ${item.quantity || 1}${sizeStr}${newSyp}`;
  }).join('\n');

  const newSypTotal = ((order.total || 0) / 100).toLocaleString();

  return `👑 <b>إشعار طلب جديد للآدمن - AURUM MALL</b> 👑

🆔 <b>رقم الطلب:</b> #${order.id.slice(-6).toUpperCase()}
👤 <b>اسم الزبون:</b> ${order.userName || order.userEmail || 'زبون جديد'}
📱 <b>رقم الهاتف:</b> <code>${order.phone}</code>
📍 <b>العنوان:</b> ${order.city} - ${order.area}
💳 <b>طريقة الدفع:</b> ${order.paymentMethod}

🛍️ <b>المنتجات المطلوبة:</b>
${itemsText}

💰 <b>المجموع الكلي:</b> ${(order.total || 0).toLocaleString()} ل.س (<b>${newSypTotal}</b> بالليرة الجديدة)

⚜️ يرجى الدخول للوحة التحكم لمراجعة وقبول الطلب.`;
}

// Format message for Merchant on Telegram
export function buildMerchantTelegramMessage(order: Order, shopName?: string, shopItems?: CartItem[]): string {
  const itemsToReport = shopItems && shopItems.length > 0 ? shopItems : order.items;
  
  const itemsText = itemsToReport.map((item, i) => {
    const sizeStr = item.selectedSize ? ` (المقاس: ${item.selectedSize})` : '';
    const colorStr = item.selectedColor ? ` (اللون: ${item.selectedColor})` : '';
    const newSyp = item.newSypPrice ? ` - ${item.newSypPrice} ل.س جديد` : (item.price ? ` - ${item.price}` : '');
    return `${i + 1}. <b>${item.name}</b> × ${item.quantity || 1}${sizeStr}${colorStr}${newSyp}`;
  }).join('\n');

  const newSypTotal = ((order.total || 0) / 100).toLocaleString();

  return `🏪 <b>طلب شراء جديد - ${shopName || 'متجرك الكريـم'}</b> 🏪

🆔 <b>رقم الطلب:</b> #${order.id.slice(-6).toUpperCase()}
👤 <b>اسم الزبون:</b> ${order.userName || order.userEmail || 'زبون AURUM'}
📱 <b>رقم الزبون:</b> <code>${order.phone || 'غير محدد'}</code>
📍 <b>العنوان:</b> ${order.city || ''} - ${order.area || ''}

🛒 <b>المنتجات المطلوبة:</b>
${itemsText}

💵 <b>الإجمالي المطلوب:</b> ${(order.total || 0).toLocaleString()} ل.س (<b>${newSypTotal}</b> بالليرة الجديدة)

⚜️ يرجى تجهيز الطلب للمندوب.`;
}

// Format approval message for Customer on Telegram
export function buildCustomerTelegramApprovalMessage(order: Order): string {
  const itemsText = (order.items || []).map((item, i) => {
    const priceStr = item.price ? ` (${item.price})` : '';
    const qtyStr = item.quantity ? ` × ${item.quantity}` : '';
    const newSyp = item.newSypPrice ? ` [${item.newSypPrice} ل.س جديد]` : '';
    return `${i + 1}. <b>${item.name}</b>${qtyStr}${priceStr}${newSyp}`;
  }).join('\n');

  const newSypTotal = ((order.total || 0) / 100).toLocaleString();

  return `✨ <b>تم الموافقة على طلبك بنجاح من AURUM LUXURY MALL</b> ⚜️

أهلاً بك عزيزنا <b>${order.userName || ''}</b>، نود إعلامك بأنه تم قبول طلبك وتثبيت الفاتورة بنجاح.

🧾 <b>تفاصيل الفاتورة الخاصة بك:</b>
🆔 <b>رقم الطلب:</b> #${order.id.slice(-6).toUpperCase()}
🛍️ <b>المنتجات:</b>
${itemsText}

💵 <b>المجموع الكلي:</b> ${(order.total || 0).toLocaleString()} ل.س (<b>${newSypTotal}</b> بالليرة الجديدة)
💳 <b>طريقة الدفع:</b> ${order.paymentMethod}
📍 <b>عنوان التسليم:</b> ${order.city} - ${order.area}

🛵 <b>انتظر المندوب شكراً</b> ⚜️`;
}

export async function sendAutomatedTelegramServer(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken,
        chatId,
        text
      })
    });
    const data = await response.json();
    return { success: data.success === true, error: data.error };
  } catch (err: unknown) {
    console.error('Failed to call backend automated Telegram API:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
