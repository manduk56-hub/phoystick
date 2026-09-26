'use client';
import { useEffect } from 'react';

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
};

// The whole document stays fullscreen so the game menu remains accessible.
export function usePhoneLandscape(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const orientation = screen.orientation as LockableOrientation | undefined;
    if (!orientation?.lock) return;
    let stopped = false;
    let menuOpen = false;
    let pending = false;
    let locked = false;
    let ownsFullscreen = false;
    const wanted = () => !stopped && !menuOpen && !document.hidden;
    const restore = () => {
      if (locked) {
        orientation.unlock();
        locked = false;
      }
      if (ownsFullscreen) {
        ownsFullscreen = false;
        if (document.fullscreenElement === document.documentElement)
          void document.exitFullscreen().catch(() => {});
      }
    };
    const enter = async () => {
      if (!wanted() || pending || locked) return;
      pending = true;
      try {
        // Installed web apps may allow locking without fullscreen.
        try {
          await orientation.lock!('landscape');
          locked = true;
        } catch {
          if (!wanted()) return;
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
            ownsFullscreen = true;
          }
          if (!wanted()) return;
          await orientation.lock!('landscape');
          locked = true;
        }
      } catch {
        // A gesture may be required; retry on the next game interaction.
        restore();
      } finally {
        pending = false;
        if (!wanted()) restore();
      }
    };
    const open = () => {
      menuOpen = true;
      restore();
    };
    const close = () => {
      menuOpen = false;
      void enter();
    };
    const gesture = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[data-game-menu], a')) return;
      void enter();
    };
    const visibility = () => {
      if (document.hidden) restore();
      else void enter();
    };
    const fullscreen = () => {
      if (!document.fullscreenElement) {
        ownsFullscreen = false;
        if (locked) orientation.unlock();
        locked = false;
      }
    };
    window.addEventListener('game-menu-open', open);
    window.addEventListener('game-menu-close', close);
    document.addEventListener('click', gesture);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('fullscreenchange', fullscreen);
    window.addEventListener('pagehide', restore);
    void enter();
    return () => {
      stopped = true;
      restore();
      window.removeEventListener('game-menu-open', open);
      window.removeEventListener('game-menu-close', close);
      document.removeEventListener('click', gesture);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('fullscreenchange', fullscreen);
      window.removeEventListener('pagehide', restore);
    };
  }, [active]);
}
