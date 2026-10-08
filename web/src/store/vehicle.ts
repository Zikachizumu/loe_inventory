import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '.';

/**
 * Loe — arac durumu (torpido erisilebilirligi + aracta miyiz).
 *
 * Envanter HER ACILISTA (canta ya da torpido farketmez) client Lua'dan gelir:
 *  - `setVehicleGlovebox` : oyuncu bir aractaysa VE o aracin torpidosu varsa true.
 *    Ust bardaki Karakter/Torpido sekmesi bunu okur (bkz. LoeTopBar.tsx).
 *  - `setInVehicle`       : oyuncu HERHANGI bir aractaysa true. (2026-09-10'da
 *    Karakter paneli bununla canli karakteri gizliyordu; 2026-10-09'da aracta da
 *    canli karakter geri geldi, panel artik bunu OKUMUYOR.)
 */
const initialState: { gloveboxAvailable: boolean; inVehicle: boolean } = {
  gloveboxAvailable: false,
  inVehicle: false,
};

export const vehicleSlice = createSlice({
  name: 'vehicle',
  initialState,
  reducers: {
    setVehicleGlovebox: (state, action: PayloadAction<boolean | null | undefined>) => {
      state.gloveboxAvailable = !!action.payload;
    },
    setInVehicle: (state, action: PayloadAction<boolean | null | undefined>) => {
      state.inVehicle = !!action.payload;
    },
  },
});

export const { setVehicleGlovebox, setInVehicle } = vehicleSlice.actions;
export const selectVehicleGloveboxAvailable = (state: RootState) => state.vehicle.gloveboxAvailable;
export const selectInVehicle = (state: RootState) => state.vehicle.inVehicle;

export default vehicleSlice.reducer;
