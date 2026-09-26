'use client';
import { useEffect, useEffectEvent } from 'react';

export function useGameInterruption(onInterrupt: () => void) {
  const interrupt = useEffectEvent(onInterrupt);
  useEffect(() => {
    const stop = () => interrupt();
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('blur', stop);
    window.addEventListener('game-menu-open', stop);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', stop);
      window.removeEventListener('game-menu-open', stop);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
}
