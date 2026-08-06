import { db } from '../lib/firebase';
import { collection, doc, getDocs, writeBatch, query, limit } from 'firebase/firestore';
import { AURUM_PRODUCTS, SHOPS } from '../constants';

export async function seedDatabaseIfEmpty() {
  try {
    // Check if products collection is empty - optimized with limit(1)
    const productSnap = await getDocs(query(collection(db, 'products'), limit(1)));
    if (!productSnap.empty) {
      console.log('Database already has products, skipping seed.');
      return;
    }

    console.log('Seeding database with initial luxury content...');
    const batch = writeBatch(db);

    // 1. Seed Global Settings
    const settingsRef = doc(db, 'settings', 'global');
    batch.set(settingsRef, {
      bannerTitle: 'عروض AURUM الملكية ⚜️\nمجموعات الشتاء الفاخرة',
      bannerSubtitle: 'مجموعة حصرية ⚜️ إصدار محدود',
      bannerDuration: 5,
      marqueeText: 'مرحباً بكم في عالم الفخامة.. AURUM يصحبكم في رحلة ملكية ⚜️ قطعتك الفريدة بانتظارك الآن..',
      marqueeType: 'text',
      goldenHourEnd: new Date(Date.now() + 3600000 * 2).toISOString() // 2 hours from now
    });

    // 2. Seed Admin as a basic user profile (if needed for the check)
    // (Usually handles via Auth, but we can set roles)

    // 3. Seed initial Shops
    SHOPS.forEach(shop => {
      const shopRef = doc(db, 'shops', shop.id);
      batch.set(shopRef, {
        ...shop,
        ownerId: 'admin',
        status: 'active',
        createdAt: new Date().toISOString()
      });
    });

    // 4. Seed initial Products
    AURUM_PRODUCTS.forEach(product => {
      const prodRef = doc(collection(db, 'products'));
      batch.set(prodRef, {
        ...product,
        shopId: 'admin',
        shopName: 'AURUM SHOP',
        id: prodRef.id, // Overwrite with generated ID
        createdAt: new Date().toISOString()
      });
    });

    // 5. Seed initial Wheel Prizes
    const prizes = [
      { id: 'p1', label: 'حظ أوفر', value: 0, color: '#141414' },
      { id: 'p2', label: 'حظ أوفر', value: 0, color: '#241f12' },
      { id: 'p3', label: 'حظ أوفر', value: 0, color: '#101010' },
      { id: 'p4', label: 'حظ أوفر', value: 0, color: '#1a1810' },
      { id: 'p5', label: 'حظ أوفر', value: 0, color: '#141414' },
      { id: 'p6', label: 'حظ أوفر', value: 0, color: '#241f12' },
    ];
    
    prizes.forEach(prize => {
      const prizeRef = doc(collection(db, 'wheel_prizes'));
      batch.set(prizeRef, { ...prize, id: prizeRef.id, createdAt: new Date().toISOString() });
    });

    await batch.commit();
    console.log('Seeding completed successfully! ⚜️');
  } catch (err) {
    console.error('Seeding failed:', err);
  }
}
