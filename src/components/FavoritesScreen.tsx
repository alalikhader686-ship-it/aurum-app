import React from 'react';
import { motion } from 'motion/react';
import { Heart, ShoppingCart, ArrowRight, Trash2 } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { removeFromFavorites } from '../store/favoritesSlice';
import { addToCart } from '../store/cartSlice';
import { Product } from '../types';

interface FavoritesScreenProps {
  onBack: () => void;
  onProductClick: (product: Product) => void;
}

export default function FavoritesScreen({ onBack, onProductClick }: FavoritesScreenProps) {
  const favorites = useSelector((state: RootState) => state.favorites.favorites);
  const dispatch = useDispatch();

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-32" dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-[#D4AF37]">المفضلة ⚜️</h1>
        <button 
          onClick={onBack}
          className="p-2 hover:bg-[#1a1a1a] rounded-full transition-colors"
        >
          <ArrowRight size={24} />
        </button>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
          <Heart size={80} strokeWidth={1} className="mb-4 opacity-20" />
          <p className="text-xl">قائمة المفضلة فارغة</p>
          <button 
            onClick={onBack}
            className="mt-6 text-[#D4AF37] border border-[#D4AF37] px-6 py-2 rounded-full hover:bg-[#D4AF37]/10 transition-colors"
          >
            استكشف المنتجات
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {favorites.map((item) => (
            <motion.div 
              key={`fav-${item.id}`}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-4 flex gap-4 group"
            >
              <div 
                className="w-24 h-24 rounded-xl overflow-hidden cursor-pointer"
                onClick={() => onProductClick(item)}
              >
                <img 
                  src={item.image || null} 
                  alt={item.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-lg mb-1">{item.name}</h3>
                  {item.isSale ? (
                    <div className="flex flex-col">
                      <span className="text-red-500 line-through text-[10px] opacity-60">
                        {item.oldPrice} {item.currency === 'USD' ? '$' : 'ل.س'}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <p className="text-[#D4AF37] font-bold text-lg">
                            {item.salePrice} <span className="text-xs font-normal opacity-60 uppercase">{item.currency === 'USD' ? '$' : 'ل.س'}</span>
                          </p>
                          {item.currency === 'SYP' && item.newSypPrice && (
                            <span className="text-[9px] text-amber-500/60 font-bold -mt-0.5">
                              {item.newSypPrice} ل.س جديد
                            </span>
                          )}
                        </div>
                        <span className="bg-amber-500/10 text-amber-500 text-[8px] px-1.5 py-0.5 rounded-md font-black border border-amber-500/20">عرض 🎁</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <p className="text-[#D4AF37] font-bold">
                        {item.price} <span className="text-xs font-normal opacity-60 uppercase">{item.currency === 'USD' ? '$' : 'ل.س'}</span>
                      </p>
                      {item.currency === 'SYP' && item.newSypPrice && (
                        <span className="text-[9px] text-amber-500/60 font-bold -mt-0.5">
                          {item.newSypPrice} ل.س جديد
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => dispatch(addToCart(item))}
                    className="flex-1 bg-[#D4AF37] text-black font-bold py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-[#b8962d] transition-colors"
                  >
                    <ShoppingCart size={18} />
                    <span>إضافة</span>
                  </button>
                  <button 
                    onClick={() => dispatch(removeFromFavorites({ id: item.id }))}
                    className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
