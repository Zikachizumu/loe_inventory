import React, { useCallback, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useAppDispatch, useAppSelector } from '../../store';
import { selectBagLevel } from '../../store/backpack';
import {
  selectEquipment,
  selectEquippedWeapon,
  selectEquipAmmoDisplay,
  selectClothingMap,
  selectHighlightSlot,
  EquipItem,
} from '../../store/equipment';
import { selectLeftInventory } from '../../store/inventory';
import { openContextMenu } from '../../store/contextMenu';
import { Items } from '../../store/items';
import { fetchNui } from '../../utils/fetchNui';
import { getItemUrl } from '../../helpers';
import { DragSource, Slot } from '../../typings';
import {
  IconAmmo,
  IconBackpack,
  IconCap,
  IconGlasses,
  IconGloves,
  IconHeadphones,
  IconJacket,
  IconMask,
  IconNecklace,
  IconPants,
  IconPistol,
  IconRing,
  IconShoes,
  IconTshirt,
  IconVest,
  IconWatch,
} from './LoeIcons';

/**
 * Loe karakter paneli.
 *
 * Slotlar NUMARALI (sag ustte kucuk rozet) — karisiklik olmasin diye.
 * ÇANTA slotu (key='bag') GERCEK: takili canta seviyesine gore bag_lvN.png
 * gorselini gosterir; seviye degisince (use ile giyme/yukseltme) otomatik
 * guncellenir. Diger slotlar su an GORSEL (illenium-appearance koprusu ileride).
 */

type SlotDef = { key: string; label: string; Icon: React.FC<{ size?: number }> };

// Mockup duzeni: karakterin SOLUNDA ve SAGINDA dikey slot sutunlari, ortada
// canli karakter. Slotlarin islevi (equip/unequip/drag/sag-tik) korunur.
// Slotlar 8-8: SOL sutun 1-8 (giysiler), SAG sutun 9-16 (aksesuar + techizat).
const LEFT_SLOTS: SlotDef[] = [
  { key: 'hat', label: 'Şapka', Icon: IconCap },
  { key: 'glasses', label: 'Gözlük', Icon: IconGlasses },
  { key: 'mask', label: 'Maske', Icon: IconMask },
  { key: 'jacket', label: 'Ceket', Icon: IconJacket },
  { key: 'tshirt', label: 'Tişört', Icon: IconTshirt },
  { key: 'gloves', label: 'Eldiven', Icon: IconGloves },
  { key: 'pants', label: 'Pantolon', Icon: IconPants },
  { key: 'shoes', label: 'Ayakkabı', Icon: IconShoes },
];

const RIGHT_SLOTS: SlotDef[] = [
  { key: 'ears', label: 'Kulaklık', Icon: IconHeadphones },
  { key: 'ring', label: 'Yüzük', Icon: IconRing },
  { key: 'necklace', label: 'Kolye', Icon: IconNecklace },
  { key: 'watch', label: 'Saat', Icon: IconWatch },
  { key: 'bag', label: 'Çanta', Icon: IconBackpack },
  { key: 'armour', label: 'Zırh', Icon: IconVest },
  { key: 'weapon', label: 'Silah', Icon: IconPistol },
  { key: 'ammo', label: 'Mermi', Icon: IconAmmo },
];

// Kiyafet olmayan slotlar: canta (ayri seviye sistemi), silah/mermi (ox weapon).
// Bunlarda surukle-giy/cikar YOK.
const NON_CLOTHING = new Set(['bag', 'weapon', 'ammo']);

interface EquipSlotProps {
  slotKey: string;
  label: string;
  Icon: React.FC<{ size?: number }>;
  slotNo: number;
  equipped?: EquipItem;
  highlighted?: boolean;
  onUnequip: (slot: string) => void;
  onContext: (slotKey: string, event: React.MouseEvent<HTMLDivElement>) => void;
  canEquipHere: (slotKey: string, source: DragSource) => boolean;
  onEquipDrop: (slotKey: string, source: DragSource) => void;
}

/**
 * Tek ekipman slotu. Kiyafet slotlari icin:
 *  - DROP hedefi (envanterden 'SLOT' surukle): dogru slota birakilinca giydirir.
 *  - DRAG kaynagi ('EQUIP'): giyili parcayi envantere surukleyip cikarmak icin
 *    (InventorySlot 'EQUIP' drop'unu unequip'e baglar).
 *  - Tik: giyiliyse cikar.
 */
const EquipSlot: React.FC<EquipSlotProps> = ({
  slotKey,
  label,
  Icon,
  slotNo,
  equipped,
  highlighted,
  onUnequip,
  onContext,
  canEquipHere,
  onEquipDrop,
}) => {
  const isClothingSlot = !NON_CLOTHING.has(slotKey);

  const equippedName = equipped?.item;
  // Gorsel: apparel'da metadata BASE-adi (equipped.image, or. 'mask_ski') -> getItemUrl
  // .png ekler; legacy named item'da (or. 'armour') item ADINDAN coz -> getItemUrl,
  // Items[name].image'i (ox'un cozdugu tam nui:// yolu) dogrudan doner. (Onceki kod
  // Items[name].image'i TEKRAR getItemUrl'e verip yolu bozuyordu -> slotta gorsel yoktu.)
  // imageurl TAM bir URL'dir (loe_clothing magazasi boyle veriyor) -> oldugu
  // gibi kullanilir; getItemUrl'e verilirse basina imagepath eklenip bozulur.
  const equipUrl = equipped?.imageurl
    ? equipped.imageurl
    : equipped?.image
      ? getItemUrl(equipped.image)
      : equippedName
        ? getItemUrl(equippedName)
        : undefined;
  const equipLabel = equipped?.label || (equippedName ? Items[equippedName]?.label || equippedName : undefined);

  // DRAG kaynagi ('EQUIP'): unequip icin `slot`; DragPreview icin `item`+`image`
  // (imlecte giyili parca kutusu gorunur, envanter surukleme ile ayni his).
  const [{ isDragging }, drag] = useDrag<
    { slot: string; item: { name?: string; slot: string }; image?: string },
    void,
    { isDragging: boolean }
  >(
    () => ({
      type: 'EQUIP',
      item: {
        slot: slotKey,
        item: { name: equippedName, slot: slotKey },
        image: equipUrl ? `url(${equipUrl})` : undefined,
      },
      canDrag: () => isClothingSlot && !!equipped,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [slotKey, equipped, equippedName, equipUrl, isClothingSlot]
  );

  // DROP hedefi ('SLOT'): uyumlu kiyafet suruklenirken `canDrop` true olur (bu slot
  // ustunde OLMASA bile) -> uygun slot vurgulanir. `isOver` uzerine gelince guclenir.
  const [{ isOver, canDrop }, drop] = useDrop<DragSource, void, { isOver: boolean; canDrop: boolean }>(
    () => ({
      accept: 'SLOT',
      canDrop: (source) => isClothingSlot && canEquipHere(slotKey, source),
      drop: (source) => onEquipDrop(slotKey, source),
      collect: (monitor) => ({ isOver: monitor.isOver(), canDrop: monitor.canDrop() }),
    }),
    [slotKey, isClothingSlot, canEquipHere, onEquipDrop]
  );

  const connectRef = (el: HTMLDivElement | null) => {
    drag(drop(el));
  };

  const title = equipped
    ? `${equipLabel ?? label} — çıkarmak için tıkla veya envantere sürükle`
    : isClothingSlot
      ? `${label} — envanterden sürükleyip bırak`
      : `${label} — boş`;

  return (
    <div
      ref={connectRef}
      className={
        'bx-eq-slot' +
        (equipped ? ' has-item' : '') +
        (highlighted ? ' bx-eq-highlight' : '') +
        (canDrop ? ' bx-eq-droppable' : '') +
        (isOver && canDrop ? ' bx-eq-dropover' : '')
      }
      title={title}
      onClick={equipped ? () => onUnequip(slotKey) : undefined}
      onContextMenu={equipped ? (e) => onContext(slotKey, e) : undefined}
      style={{
        ...(equipUrl ? { backgroundImage: `url(${equipUrl})` } : undefined),
        cursor: equipped ? 'pointer' : undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <span className="bx-eq-num">{slotNo}</span>
      {!equipUrl && <Icon size={32} />}
    </div>
  );
};

// ox'ta silah item adlari her zaman WEAPON_ ile baslar (data/weapons.lua). SILAH
// slotuna surukle-birak icin "bu bir silah mi" testi bu kadar.
const isWeaponName = (name?: string) => !!name && name.startsWith('WEAPON_');

/**
 * SILAH slotu (15) — kusanili silahi gosterir.
 *
 * Silah item'i envanterden SILINMEZ: ox'un silah akisi (mermi sayaci, dayaniklilik,
 * parcalar, sarjor doldurma) o envanter slotundaki item uzerinden yurur. Bunun
 * yerine item gridde ve makro satirinda GIZLENIR (store/equipment.ts ->
 * selectEquipHiddenSlots), oyuncuya "silah slota gecti" gorunur. Kilifa alinca
 * item kendi yerinde tekrar gorunur.
 *
 * Kusan   : envanterden silahi bu slota surukle-birak.
 * Kilifa  : slota tikla ya da slottan envantere surukle.
 * Ikisi de ox'un `useItem` yolundan gecer — ayni slotu tekrar use etmek ox'ta
 * silahi kilifa alir (client.lua useSlot, `weaponSlot == data.slot` dali).
 */
const WeaponSlot: React.FC<{ slotNo: number; Icon: React.FC<{ size?: number }> }> = ({ slotNo, Icon }) => {
  const equippedWeapon = useAppSelector(selectEquippedWeapon);
  const wName = equippedWeapon?.name;
  const wSlot = equippedWeapon?.slot;
  const wUrl = wName ? getItemUrl(wName) : undefined;

  const toggleWeapon = useCallback(() => {
    if (typeof wSlot === 'number') fetchNui('useItem', wSlot).catch(() => {});
  }, [wSlot]);

  const [{ canDrop, isOver }, drop] = useDrop<DragSource, void, { canDrop: boolean; isOver: boolean }>(
    () => ({
      accept: 'SLOT',
      collect: (monitor) => ({ canDrop: monitor.canDrop(), isOver: monitor.isOver() }),
      canDrop: (source) => source.inventory === 'player' && isWeaponName(source.item.name),
      drop: (source) => {
        fetchNui('useItem', source.item.slot).catch(() => {});
      },
    }),
    []
  );

  // Slottan envantere surukle = kilifa al. InventorySlot'un EQUIP dali
  // `slot === 'weapon'` payload'ini taniyip use'a cevirir.
  const [{ isDragging }, drag] = useDrag<any, void, { isDragging: boolean }>(
    () => ({
      type: 'EQUIP',
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
      // `item` + `image` SART: DragPreview (imlecte akan gorsel) yalniz `data.item`
      // doluyken cizer ve `data.image`'i arka plan yapar. Bunlar olmadan kusanili
      // silah/bicak surukleyince gorsel imleci takip etmiyordu ve birakinca item
      // "sicriyordu". Cantadaki normal item ve kiyafet slotu bunlari zaten veriyor.
      item: () =>
        typeof wSlot === 'number'
          ? {
              slot: 'weapon',
              weaponSlot: wSlot,
              weaponName: wName,
              item: { name: wName, slot: wSlot },
              image: wUrl ? `url(${wUrl})` : undefined,
            }
          : null,
      canDrag: () => typeof wSlot === 'number',
    }),
    [wSlot]
  );

  return (
    <div
      ref={(element) => {
        if (element) drag(drop(element));
      }}
      className={
        'bx-eq-slot' +
        (wUrl ? ' has-item' : '') +
        (canDrop ? ' bx-eq-droppable' : '') +
        (isOver && canDrop ? ' bx-eq-dropover' : '')
      }
      title={equippedWeapon?.label ? `Silah — ${equippedWeapon.label} (çıkarmak için tıkla)` : 'Silah — boş'}
      onClick={wUrl ? toggleWeapon : undefined}
      style={{
        ...(wUrl ? { backgroundImage: `url(${wUrl})` } : undefined),
        cursor: wUrl ? 'pointer' : undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <span className="bx-eq-num">{slotNo}</span>
      {!wUrl && <Icon size={32} />}
    </div>
  );
};

/**
 * MERMI slotu (16) — kusanili silahin mermi yigini (adet rozetiyle).
 *
 * Silah slotu gibi: yigin envanterde durur ama gridde gizlenir; silah kilifa
 * alininca kendi yerinde geri gorunur.
 *
 * SLOTA TIKLAMAK SARJORU DOLDURUR. Bu SART: yigin gridde gizlendigi icin artik
 * cift tiklanamiyor (gizli slotlarda kullanma kapali), yani sarjoru doldurmanin
 * baska yolu kalmiyordu — oyuncu cantasinda mermi olmasina ragmen ates
 * edemiyordu. Doldurma ox'un kendi `useItem` yolundan gecer.
 */
const AmmoSlot: React.FC<{ slotNo: number; Icon: React.FC<{ size?: number }> }> = ({ slotNo, Icon }) => {
  const ammo = useAppSelector(selectEquipAmmoDisplay);
  const hasAmmo = !!ammo && ammo.total > 0;
  const url = hasAmmo ? getItemUrl(ammo!.name) : undefined;
  const label = ammo ? Items[ammo.name]?.label ?? ammo.name : undefined;

  // Yedek yığın varsa tıklama şarjöre doldurur. Kuşanınca otomatik dolum
  // yaptığımız için genelde yedek olmaz (mermi zaten şarjörde) -> tıklama pasif.
  const reload = useCallback(() => {
    if (ammo?.spareSlot !== undefined) fetchNui('useItem', ammo.spareSlot).catch(() => {});
  }, [ammo?.spareSlot]);

  const canReload = ammo?.spareSlot !== undefined;

  return (
    <div
      className={url ? 'bx-eq-slot has-item' : 'bx-eq-slot'}
      title={
        hasAmmo
          ? `Mermi — ${label} (${ammo!.total})${canReload ? ' — şarjöre basmak için tıkla' : ''}`
          : 'Mermi — boş'
      }
      onClick={canReload ? reload : undefined}
      style={{
        ...(url ? { backgroundImage: `url(${url})` } : undefined),
        cursor: canReload ? 'pointer' : undefined,
      }}
    >
      <span className="bx-eq-num">{slotNo}</span>
      {hasAmmo ? <span className="bx-eq-count">{ammo!.total}</span> : <Icon size={32} />}
    </div>
  );
};

const CharacterPanel: React.FC = () => {
  const bagLevel = useAppSelector(selectBagLevel);
  const equipment = useAppSelector(selectEquipment);
  const clothingMap = useAppSelector(selectClothingMap);
  const highlightSlot = useAppSelector(selectHighlightSlot);
  const leftInventory = useAppSelector(selectLeftInventory);
  const dispatch = useAppDispatch();
  let slotNo = 0; // tum slotlara sirali numara (1..N)

  // Dolu bir ekipman slotuna tiklayinca (veya envantere surukleyince) cikar.
  const handleUnequip = useCallback((slot: string) => {
    fetchNui('loe:unequip', { slot }).catch(() => {});
  }, []);

  // Giyili slota SAG TIK -> baglam menusu (Unequip). InventoryContext gosterir.
  const handleContext = useCallback(
    (slot: string, event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      dispatch(openContextMenu({ equipSlot: slot, coords: { x: event.clientX, y: event.clientY } }));
    },
    [dispatch]
  );

  // Suruklenen envanter item'ini Redux'tan bul (slot 1-indexli -> items[slot-1]).
  const sourceItem = useCallback(
    (source: DragSource): Slot | undefined => leftInventory.items?.[source.item.slot - 1],
    [leftInventory]
  );

  // Suruklenen item'in hedef kiyafet slotu: apparel -> metadata.wear.slot; legacy
  // named item (or. 'armour') -> clothingMap[item.name] (client Lua'dan gelen harita).
  const targetSlotOf = useCallback(
    (src: any): string | undefined => src?.metadata?.wear?.slot ?? (src?.name ? clothingMap[src.name] : undefined),
    [clothingMap]
  );

  // Bu slota birakilabilir mi? Yalniz OYUNCU envanterinden gelen, hedef slotu bu slota
  // esit kiyafet item'i. Sadece dogru slot vurgulanir.
  const canEquipHere = useCallback(
    (slotKey: string, source: DragSource) => {
      if (source.inventory !== 'player') return false;
      return targetSlotOf(sourceItem(source)) === slotKey;
    },
    [sourceItem, targetSlotOf]
  );

  // Birak -> giydir. HIZLI equip yolu (ox useItem gecikmesini atlar); sunucu item'i
  // dogru slota takar. Yalniz hedef slotu bu slota esitse.
  const onEquipDrop = useCallback(
    (slotKey: string, source: DragSource) => {
      if (source.inventory !== 'player') return;
      const src = sourceItem(source);
      if (src && targetSlotOf(src) === slotKey) {
        fetchNui('loe:equip', { slot: src.slot }).catch(() => {});
      }
    },
    [sourceItem, targetSlotOf]
  );

  // Orta pencerede fareyle surukle-dondur.
  const dragX = useRef<number | null>(null);
  const onViewDown = (e: React.MouseEvent) => {
    dragX.current = e.clientX;
  };
  const onViewMove = (e: React.MouseEvent) => {
    if (dragX.current === null) return;
    const dx = e.clientX - dragX.current;
    if (dx !== 0) {
      dragX.current = e.clientX;
      fetchNui('loe:charRotate', { mode: 'drag', value: dx }).catch(() => {});
    }
  };
  const onViewUp = () => {
    dragX.current = null;
  };

  // Tek slot render (canta + silah = ayri gorsel sistem, digerleri EquipSlot).
  const renderSlot = ({ key, label, Icon }: SlotDef) => {
    slotNo += 1;
    // SILAH (15) ve MERMI (16): kusanilinca ikisi de envanterden gizlenip burada
    // gorunur. Kendi bilesenleri var (surukle-birak/tikla kancalari icin).
    if (key === 'weapon') return <WeaponSlot key={key} slotNo={slotNo} Icon={Icon} />;
    if (key === 'ammo') return <AmmoSlot key={key} slotNo={slotNo} Icon={Icon} />;
    if (key === 'bag') {
      const bagUrl = bagLevel > 0 ? getItemUrl(`bag_lv${bagLevel}`) : undefined;
      return (
        <div
          className={bagUrl ? 'bx-eq-slot has-item' : 'bx-eq-slot'}
          key={key}
          title={bagLevel > 0 ? `Çanta — Seviye ${bagLevel}` : 'Çanta — boş'}
          style={bagUrl ? { backgroundImage: `url(${bagUrl})` } : undefined}
        >
          <span className="bx-eq-num">{slotNo}</span>
          {!bagUrl && <Icon size={32} />}
        </div>
      );
    }
    return (
      <EquipSlot
        key={key}
        slotKey={key}
        label={label}
        Icon={Icon}
        slotNo={slotNo}
        equipped={equipment[key]}
        highlighted={highlightSlot === key}
        onUnequip={handleUnequip}
        onContext={handleContext}
        canEquipHere={canEquipHere}
        onEquipDrop={onEquipDrop}
      />
    );
  };

  return (
    <div className="bx-panel bx-character">
      {/* Baslik yazisi ("Karakter") kaldirildi (kullanici istegi 2026-09-10). */}

      {/* 3 sutun (sol slotlar | canli karakter seffaf | sag slotlar) -- yayan ve
          aracta AYNI (2026-10-09: aracta da canli karakter geri geldi; klon aracin
          yaninda durur, bkz. preview_manager.lua). */}
      <div className="bx-char-body">
        <div className="bx-eq-col">{LEFT_SLOTS.map(renderSlot)}</div>

        {/* Orta: ped OYUN tarafinda arkada render edilir; burasi SEFFAF penceredir.
            Dondurme: fareyle surukle (butonlar kaldirildi). */}
        <div
          className="bx-char-view"
          onMouseDown={onViewDown}
          onMouseMove={onViewMove}
          onMouseUp={onViewUp}
          onMouseLeave={onViewUp}
        />

        <div className="bx-eq-col">{RIGHT_SLOTS.map(renderSlot)}</div>
      </div>
    </div>
  );
};

export default CharacterPanel;
