import { api } from './link';

export const gamePaths: Record<string, string> = {
  shooting: '/',
  fishing: '/fishing',
  racing: '/racing',
};
export type GameSession = {
  code: string;
  token: string;
  role: 'host' | 'phone';
  version: number;
  game: string;
  relayOnly?: boolean;
};
const key = 'game-controller-session';
export function savedSession(): GameSession | null {
  for (const storage of [() => sessionStorage, () => localStorage]) {
    try {
      const raw = storage().getItem(key);
      if (raw) {
        const value = JSON.parse(raw);
        if (value?.code && value?.token && value?.role) return value;
      }
    } catch {
      /* Try the other storage when one is unavailable or corrupted. */
    }
  }
  return null;
}
export function saveSession(value: GameSession) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Keep the connection in this page when tab storage is unavailable. */
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Pairing still works when persistent storage is unavailable. */
  }
  window.dispatchEvent(new Event('game-session'));
}
export function forgetSession() {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Private browsing can deny tab storage. */
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* Private browsing can deny persistent storage. */
  }
  window.dispatchEvent(new Event('game-session'));
}
export function sessionUrl(game: string, role: string) {
  return `${gamePaths[game] || '/'}?role=${role}`;
}
export async function connectGame(
  role: 'host' | 'phone',
  game: string,
  code = '',
  fresh = false,
) {
  const saved = savedSession();
  if (!fresh && saved?.role === role && (!code || code === saved.code)) {
    try {
      const current = await api('resume', saved);
      if (current.game !== game) {
        window.location.replace(sessionUrl(current.game, role));
        throw new Error('선택한 게임으로 이동 중입니다.');
      }
      const session = { ...saved, ...current, relayOnly: true };
      saveSession(session);
      return session;
    } catch (error) {
      if (
        ![403, 404].includes((error as Error & { status?: number }).status || 0)
      )
        throw error;
      forgetSession();
    }
  }
  const room = await api(role === 'host' ? 'create' : 'join', { game, code });
  const session = { ...room, role, game, version: room.version || 0 };
  saveSession(session);
  return session;
}
