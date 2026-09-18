import InventoryGrid from './InventoryGrid';
import { useAppSelector } from '../../store';
import { selectRightInventory } from '../../store/inventory';

// Bu tiplerde ust baslik (etiket/plaka + KG bari) gizlenir:
//  - trunk (bagaj): agirlik siniri pratikte yok, plaka+KG istenmiyor
//  - drop (yerdeki): "DROP #id + KG" istenmiyor (DropPanel kendi temiz basligini koyar)
// Torpido (glovebox) HARIC: 50 KG siniri oldugu icin agirlik bari GORUNUR kalir.
const HIDE_HEADER_TYPES = ['trunk', 'drop'];

/**
 * Loe: TRUNK (bagaj) ve GLOVEBOX (torpido) GORUNEN slot sayisi SABIT
 * (kullanici istegi 2026-09-10) — aracin/sunucunun GERCEK slot sayisi ne
 * olursa olsun arayuzde en fazla bu kadar gosterilir:
 *   - trunk    : 35 -> Envanter'in Backpack gridiyle (7x5) BIREBIR ayni
 *                (bkz. index.scss .bx-trunk -> panel yuksekligi de esitlendi).
 *   - glovebox : 7  -> Fast Access sirasiyla (7 sutun, TEK sira) BIREBIR ayni.
 * Diger tipler (stash/motel/otel/market) ETKILENMEZ -> eski sayfali (48'er)
 * davranislarini korurlar (maxSlots=undefined).
 */
const MAX_SLOTS_BY_TYPE: Record<string, number> = { trunk: 35, glovebox: 7 };

const RightInventory: React.FC = () => {
  const rightInventory = useAppSelector(selectRightInventory);

  return (
    <InventoryGrid
      inventory={rightInventory}
      hideHeader={HIDE_HEADER_TYPES.includes(rightInventory.type)}
      maxSlots={MAX_SLOTS_BY_TYPE[rightInventory.type]}
    />
  );
};

export default RightInventory;
