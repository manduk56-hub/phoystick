'use client';
import { useEffect, useEffectEvent } from 'react';
import { savedSession } from './game-session';

export function useResumeGame(
  role: 'host' | 'phone',
  connect: () => Promise<void>,
) {
  const resume = useEffectEvent(() => {
    void connect();
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = savedSession();
      const code = new URLSearchParams(location.search).get('code');
      if (
        saved?.role === role &&
        (role === 'host' || !code || code === saved.code)
      )
        resume();
    }, 0);
    return () => clearTimeout(timer);
  }, [role]);
}
