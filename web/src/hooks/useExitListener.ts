import { useEffect, useRef } from 'react';
import { noop } from '../utils/misc';
import { fetchNui } from '../utils/fetchNui';
import { closeTooltip } from '../store/tooltip';
import { useAppDispatch } from '../store';
import { closeContextMenu } from '../store/contextMenu';

type FrameVisibleSetter = (bool: boolean) => void;

const LISTENED_KEYS = ['Escape'];

// Loe: envanter TAB ile aciliyor ama NUI odaktayken TAB oyuna ulasmiyor; tarayici
// onu odak gezintisi icin kullaniyor (imlec X butonu vb. arasinda gidip geliyordu).
// TAB burada yakalanip envanter kapatilir. keydown dinlenir: acan basisin keyup'i
// NUI'ye dusse bile envanteri hemen geri kapatmaz. Basili tutunca (e.repeat) tekrar
// tetiklenmez. Ayni basis oyunun keybind'ine de ulasirsa client.lua'daki kapanis
// sonrasi bekleme envanterin yeniden acilmasini engeller.
const TOGGLE_KEYS = ['Tab'];

// Basic hook to listen for key presses in NUI in order to exit
export const useExitListener = (visibleSetter: FrameVisibleSetter) => {
  const setterRef = useRef<FrameVisibleSetter>(noop);
  const dispatch = useAppDispatch();

  useEffect(() => {
    setterRef.current = visibleSetter;
  }, [visibleSetter]);

  useEffect(() => {
    const close = () => {
      setterRef.current(false);
      dispatch(closeTooltip());
      dispatch(closeContextMenu());
      fetchNui('exit');
    };

    const keyHandler = (e: KeyboardEvent) => {
      if (LISTENED_KEYS.includes(e.code)) close();
    };

    const toggleHandler = (e: KeyboardEvent) => {
      if (!TOGGLE_KEYS.includes(e.code)) return;
      e.preventDefault();
      if (!e.repeat) close();
    };

    window.addEventListener('keyup', keyHandler);
    window.addEventListener('keydown', toggleHandler);

    return () => {
      window.removeEventListener('keyup', keyHandler);
      window.removeEventListener('keydown', toggleHandler);
    };
  }, []);
};
