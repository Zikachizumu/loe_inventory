import React, { useCallback } from 'react';
import { useAppSelector } from '../../store';
import { selectCash } from '../../store/cash';
import { selectVehicleGloveboxAvailable } from '../../store/vehicle';
import { selectRightInventory } from '../../store/inventory';
import { fetchNui } from '../../utils/fetchNui';
import { IconCash, IconClose } from './LoeIcons';

/**
 * Loe ust bari — Karakter/Torpido sekmesi (araclarda), tasinan nakit, kapat.
 *
 * Marka logosu/yazisi (kullanici istegi, 2026-09-10) KALDIRILDI; onun yerine
 * aractayken Karakter/Torpido gecis sekmesi gosterilir (bkz asagisi).
 *
 * Nakit qbx_core/account sisteminden gelir (GrandRP mantigi: nakit envanter
 * item'i DEGIL). Client Lua `setCash` ile yollar. 0 ise rozet gosterilmez.
 */
const LoeTopBar: React.FC = () => {
  const cash = useAppSelector(selectCash);
  const rightInventory = useAppSelector(selectRightInventory);
  const gloveboxAvailable = useAppSelector(selectVehicleGloveboxAvailable);

  // 'glovebox' -> su an torpido goruntuleniyor (kullanici istegi: sekme torpido
  // acikken de gorunsun ki Karaktere geri donulebilsin, gloveboxAvailable eski
  // olsa bile).
  const onGlovebox = rightInventory.type === 'glovebox';
  const showVehicleTabs = gloveboxAvailable || onGlovebox;

  // Envanter ONCE KAPANIP SONRA istenen taraf ACILIR (client.lua loe:switchPanel) --
  // ayni anda iki envanteri acik tutmanin guvenli bir yolu yok (kilit/kayit).
  const switchTo = useCallback(
    (target: 'character' | 'glovebox') => {
      if ((target === 'glovebox') === onGlovebox) return;
      fetchNui('loe:switchPanel', { target }).catch(() => {});
    },
    [onGlovebox]
  );

  return (
    <div className="bx-topbar">
      {showVehicleTabs && (
        <div className="bx-vehtabs">
          <button className={!onGlovebox ? 'active' : ''} onClick={() => switchTo('character')}>
            Karakter
          </button>
          <button className={onGlovebox ? 'active' : ''} onClick={() => switchTo('glovebox')}>
            Torpido
          </button>
        </div>
      )}

      <div className="bx-topbar-right">
        {cash > 0 && (
          <div className="bx-pill bx-pill-money">
            <IconCash size={16} />
            <span className="bx-pill-value">${cash.toLocaleString('tr-TR')}</span>
          </div>
        )}
        <button className="bx-close" onClick={() => fetchNui('exit')} title="Kapat (ESC)">
          <IconClose size={18} />
        </button>
      </div>
    </div>
  );
};

export default LoeTopBar;
