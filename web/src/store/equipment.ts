import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '.';

/**
 * Loe — ekipman durumu (TEK KAYNAK).
 *
 * İki parça:
 *  - `equippedSlot`: o an kuşanılı SİLAH slotu (client Lua getCurrentWeapon'i
 *    izleyip `setEquippedSlot` gönderir). Sağ tık menüsünde "Use" yerine
 *    "Unequip" yazmak için kullanılır.
 *  - `equipment`: karakter panelindeki GİYİLİ kıyafet/ekipman slotları
 *    (slot -> { drawable, texture }). Server (equipment_server.lua) DB'den
 *    üretir, client `setEquipment` ile gönderir. Bu veri hem paneli doldurur
 *    hem ileride 3D önizlemeyi besleyecek — dünya karakteri ile AYNI kaynak.
 */

export interface EquipWear {
  slot?: string;
  drawable?: number;
  texture?: number;
  male?: { drawable: number; texture: number };
  female?: { drawable: number; texture: number };
}

export interface EquipItem {
  item?: string; // base item adı ('apparel' veya legacy named item)
  label?: string; // metadata.label — panelde gösterilen ad
  image?: string; // metadata.image — web/images/<image>.png
  // metadata.imageurl — TAM URL (ör. loe_clothing mağazasının ürettiği
  // nui://loe_clothing/web/images/<anahtar>.png). Varsa `image`'e tercih
  // edilir; ox'un kendi görsel klasörüne bağlı kalmadan ikon gösterir.
  imageurl?: string;
  // Görünüm client Lua'da cinsiyete göre çözülür; panel `wear`'ı kullanmaz.
  wear?: EquipWear;
}

export type EquipmentMap = Record<string, EquipItem>;

// Kuşanılı silah (client Lua getCurrentWeapon'dan). Karakter panelindeki SİLAH
// slotunda gösterilir. `false`/null = silah yok (kılıçta/holstered).
export interface EquippedWeapon {
  name?: string;
  label?: string;
  slot?: number;
  // Silahın MERMİ item adı (ör. 'ammo-9'). Mermi slotu (16) envanterdeki bu
  // yığını gösterir. Atılabilir silahlarda envanterde karşılığı olmayabilir.
  ammo?: string;
  // Şarjördeki (yüklü) mermi = weapon.metadata.ammo. Mermi slotu (16) bunu
  // envanterdeki yedek yığınla toplayıp "toplam mermi" gösterir. Silah kuşanınca
  // yedek mermi otomatik şarjöre yüklenir (client.lua), yani genelde mermi burada
  // durur ve envanterde yedek kalmaz.
  mag?: number;
}

// Legacy named kıyafet item'i -> hedef slot haritası (itemName -> slotKey). apparel
// item'leri slotu metadata.wear.slot'ta taşır; legacy item'ler (ör. 'armour') taşımaz,
// bu yüzden sürükle-giy highlight'ı için client Lua (data.loe_clothing) bunu yollar.
export type ClothingMap = Record<string, string>;

interface EquipmentState {
  equippedSlot: number | null;
  equippedWeapon: EquippedWeapon | null;
  equipment: EquipmentMap;
  clothingMap: ClothingMap;
  // Envanterde giyilebilir bir item'e tiklaninca (tooltip acilinca) o item'in HEDEF
  // karakter slotu -> panelde parlar ("bu item buraya giyilir" ipucu). null = yok.
  highlightSlot: string | null;
}

const initialState: EquipmentState = {
  equippedSlot: null,
  equippedWeapon: null,
  equipment: {},
  clothingMap: {},
  highlightSlot: null,
};

export const equipmentSlice = createSlice({
  name: 'equipment',
  initialState,
  reducers: {
    setEquippedSlot: (state, action: PayloadAction<number | null>) => {
      state.equippedSlot = action.payload ?? null;
    },
    setEquippedWeapon: (state, action: PayloadAction<EquippedWeapon | false | null | undefined>) => {
      state.equippedWeapon = action.payload || null;
    },
    setEquipment: (state, action: PayloadAction<EquipmentMap | null | undefined>) => {
      state.equipment = action.payload ?? {};
    },
    setClothingMap: (state, action: PayloadAction<ClothingMap | null | undefined>) => {
      state.clothingMap = action.payload ?? {};
    },
    setHighlightSlot: (state, action: PayloadAction<string | null | undefined>) => {
      state.highlightSlot = action.payload ?? null;
    },
  },
});

export const { setEquippedSlot, setEquippedWeapon, setEquipment, setClothingMap, setHighlightSlot } =
  equipmentSlice.actions;
export const selectEquippedSlot = (state: RootState) => state.equipment.equippedSlot;
export const selectEquippedWeapon = (state: RootState) => state.equipment.equippedWeapon;
export const selectEquipment = (state: RootState) => state.equipment.equipment;
export const selectClothingMap = (state: RootState) => state.equipment.clothingMap;
export const selectHighlightSlot = (state: RootState) => state.equipment.highlightSlot;

/**
 * KUŞANILI MERMİ — envanterdeki, kuşanılı silahın mermi tipine karşılık gelen yığın.
 * Kaynak silahın `ammo` alanı (client Lua -> Weapon.Equip'teki `ammoname`).
 * Silah yoksa / bu tip mermi çantada yoksa null (mermi slotu boş görünür).
 */
export const selectEquippedAmmo = createSelector(
  [(state: RootState) => state.equipment.equippedWeapon?.ammo, (state: RootState) => state.inventory.leftInventory.items],
  (ammoName, items): { slot: number; name: string; count: number } | null => {
    if (!ammoName || !items) return null;
    const found = items.find((entry) => entry?.name === ammoName);
    if (!found?.name) return null;
    return { slot: found.slot, name: found.name, count: found.count ?? 0 };
  }
);

/**
 * MERMİ SLOTU (16) GÖSTERİMİ — "bu silaha ait toplam mermi".
 *
 *   total = şarjördeki yüklü mermi (weapon.mag) + envanterdeki yedek yığın (count)
 *
 * Silah kuşanınca yedek mermi otomatik şarjöre yüklendiği için (client.lua) yedek
 * yığın genelde 0'a iner ve envanterden kaybolur; mermi o an şarjörde durur, bu
 * yüzden 16'da mag üzerinden görünmeye devam eder ("kuşanınca mermim kayboldu"
 * yanılgısını önler). Ateş edince mag azalır; hem mag hem yedek 0 olunca slot boş.
 *
 * `name`  : mermi item adı (ikon için). `total`: gösterilecek sayı.
 * `spareSlot`: envanterdeki yedek yığının slotu (tıkla-doldur için; yedek yoksa nil).
 * Silah mermi kullanmıyorsa (ammoName yok) null.
 */
export const selectEquipAmmoDisplay = createSelector(
  [(state: RootState) => state.equipment.equippedWeapon, selectEquippedAmmo],
  (weapon, spare): { name: string; total: number; spareSlot?: number } | null => {
    const ammoName = weapon?.ammo;
    if (!ammoName) return null;
    const mag = weapon?.mag ?? 0;
    const spareCount = spare?.count ?? 0;
    return { name: ammoName, total: mag + spareCount, spareSlot: spare?.slot };
  }
);

/**
 * OYUNCU ENVANTERİNDE GİZLENECEK slot numaraları: kuşanılı silahın slotu + o
 * silahın mermi yığınının slotu. Silah kuşanılınca ikisi de gridden/makro
 * satırından kaybolur, karakter panelindeki 15 ve 16 numaralı slotlarda görünür;
 * kılıfa alınınca ikisi de kendi yerlerine geri gelir.
 *
 * Item ENVANTERDEN SİLİNMEZ, yalnızca gizlenir: ox'un silah akışı (mermi sayacı,
 * dayanıklılık, parçalar, şarjör doldurma) o slottaki item üzerinden yürür.
 */
export const selectEquipHiddenSlots = createSelector(
  [(state: RootState) => state.equipment.equippedWeapon?.slot ?? null, selectEquippedAmmo],
  (weaponSlot, ammo): ReadonlySet<number> => {
    const hidden = new Set<number>();
    if (weaponSlot) hidden.add(weaponSlot);
    if (ammo) hidden.add(ammo.slot);
    return hidden;
  }
);

export default equipmentSlice.reducer;
