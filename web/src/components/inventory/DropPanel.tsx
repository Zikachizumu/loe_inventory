import React from 'react';
import RightInventory from './RightInventory';

/**
 * Loe — yere dusen item (drop) paneli.
 *
 * CAN/ZIRH/AÇLIK/SUSUZLUK statlari ARTIK burada DEGIL — alt-sol hucrede
 * (Sürükle & Ver kutusuyla AYNI satirda) gosteriliyor (bkz. index.tsx), boylece
 * drop acikken de statlar Ver kutusunun DIKEY ORTASINA hizali kalir (kullanici
 * istegi 2026-09-10; onceki hali panelin KENDI icinde ayri bir blok olarak
 * duruyordu ve Ver kutusuyla hicbir zaman hizali OLMUYORDU). Grid 7 sutun
 * `.bx-drop` CSS'iyle; drop slot sayisi sunucuda init.lua -> shared.dropslots.
 */
const DropPanel: React.FC = () => (
  <div className="bx-panel bx-drop">
    {/* Baslik yazisi ("Yere Atılanlar") kaldirildi (kullanici istegi 2026-09-10). */}
    <RightInventory />
  </div>
);

export default DropPanel;
