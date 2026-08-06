import { Product, Shop } from './types';

export const CATEGORIES = [
  { id: 'mall', name: 'المول (قريباً) ⚜️', icon: 'Store', isMall: true, isLocked: true },
  { id: 'لباس', name: 'ألبسة', icon: 'Shirt', isLocked: false },
  { id: 'perfume', name: 'عطور (قريباً)', icon: 'FlaskConical', isLocked: true },
  { id: 'watch', name: 'ساعات (قريباً)', icon: 'Watch', isLocked: true },
  { id: 'accessories', name: 'إكسسوارات (قريباً)', icon: 'Gem', isLocked: true },
];

export const SHOPS: Shop[] = [];

export const AURUM_PRODUCTS: Product[] = [];

