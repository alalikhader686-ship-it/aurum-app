import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { CartItem, Product } from "../types";

interface CartState {
    cart: CartItem[];
    city: string;
    coords: { lat: number; lng: number } | null;
}

const initialState: CartState = {
    cart: [],
    city: "طرطوس", 
    coords: null,
};

export const cartSlice = createSlice({
    name: "cart",
    initialState,
    reducers: {
        addToCart: (state, action: PayloadAction<Product>) => {
            const payload = action.payload as CartItem;
            const itemPresent = state.cart.find((item) => 
                item.id === payload.id && 
                item.selectedSize === payload.selectedSize && 
                item.selectedColor === payload.selectedColor
            );
            if (itemPresent) {
                itemPresent.quantity++;
            } else {
                state.cart.push({ ...payload, quantity: 1 });
            }
        },
        removeFromCart: (state, action: PayloadAction<{ id: string; selectedSize?: string; selectedColor?: string }>) => {
            state.cart = state.cart.filter((item) => 
                !(item.id === action.payload.id && 
                  item.selectedSize === action.payload.selectedSize && 
                  item.selectedColor === action.payload.selectedColor)
            );
        },
        incrementQuantity: (state, action: PayloadAction<{ id: string; selectedSize?: string; selectedColor?: string }>) => {
            const itemPresent = state.cart.find((item) => 
                item.id === action.payload.id && 
                item.selectedSize === action.payload.selectedSize && 
                item.selectedColor === action.payload.selectedColor
            );
            if (itemPresent) {
                itemPresent.quantity++;
            }
        },
        decrementQuantity: (state, action: PayloadAction<{ id: string; selectedSize?: string; selectedColor?: string }>) => {
            const itemPresent = state.cart.find((item) => 
                item.id === action.payload.id && 
                item.selectedSize === action.payload.selectedSize && 
                item.selectedColor === action.payload.selectedColor
            );
            if (itemPresent) {
                if (itemPresent.quantity === 1) {
                    state.cart = state.cart.filter((item) => 
                        !(item.id === action.payload.id && 
                          item.selectedSize === action.payload.selectedSize && 
                          item.selectedColor === action.payload.selectedColor)
                    );
                } else {
                    itemPresent.quantity--;
                }
            }
        },
        cleanCart: (state) => {
            state.cart = [];
        },
        setCart: (state, action: PayloadAction<CartItem[]>) => {
            state.cart = action.payload;
        },
        updateLocation: (state, action: PayloadAction<{ city: string; coords?: { lat: number; lng: number } }>) => {
            state.city = action.payload.city;
            if (action.payload.coords) {
                state.coords = action.payload.coords;
            }
        }
    }
});

export const { 
    addToCart, 
    removeFromCart, 
    incrementQuantity, 
    decrementQuantity, 
    cleanCart,
    setCart,
    updateLocation 
} = cartSlice.actions;

export default cartSlice.reducer;
