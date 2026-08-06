import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Product } from "../types";

interface FavoritesState {
  favorites: Product[];
}

const initialState: FavoritesState = {
  favorites: [],
};

export const favoritesSlice = createSlice({
  name: "favorites",
  initialState,
  reducers: {
    addToFavorites: (state, action: PayloadAction<Product>) => {
      if (!action.payload || !action.payload.id) return;

      const itemInFavorites = state.favorites.find((item) => item.id === action.payload.id);
      if (!itemInFavorites) {
        state.favorites.push(action.payload);
      }
    },
    removeFromFavorites: (state, action: PayloadAction<{ id: string }>) => {
      if (!action.payload || !action.payload.id) return;
      
      state.favorites = state.favorites.filter((item) => item.id !== action.payload.id);
    },
    setFavorites: (state, action: PayloadAction<Product[]>) => {
      state.favorites = action.payload;
    },
  },
});

export const { addToFavorites, removeFromFavorites, setFavorites } = favoritesSlice.actions;

export default favoritesSlice.reducer;
