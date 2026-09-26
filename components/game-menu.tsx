'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/link';
import {
  forgetSession,
  gamePaths,
  savedSession,
  saveSession,
  sessionUrl,
  type GameSession,
} from '@/lib/game-session';

export default function GameMenu() {
  const [session, setSession] = useState<GameSession | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const menu = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const select = useCallback(async (game: string) => {
    if (pending.current) return;
    const saved = savedSession();
    if (!saved) return;
    if (saved.game === game) {
      setOpen(false);
      return;
    }
    pending.current = true;
    window.dispatchEvent(new Event('game-menu-open'));
    setBusy(true);
    setError('');
    try {
      const current = await api('navigate', { ...saved, game });
      saveSession({ ...saved, ...current });
      if (location.pathname !== gamePaths[current.game])
        location.assign(sessionUrl(current.game, saved.role));
      else setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new Event('game-menu-open'));
    menu.current
      ?.querySelector<HTMLButtonElement>('#paired-games button')
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);
  useEffect(() => {
    if (!Object.values(gamePaths).includes(location.pathname)) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => setSession(savedSession());
    const initial = setTimeout(refresh, 0);
    window.addEventListener('game-session', refresh);
    const sync = async () => {
      const saved = savedSession();
      if (saved) {
        try {
          const current = await api('menu', saved);
          if (stopped) return;
          const latest = savedSession();
          if (
            latest?.code === saved.code &&
            current.version >= latest.version &&
            (current.version !== latest.version ||
              location.pathname !== gamePaths[current.game])
          ) {
            saveSession({ ...saved, ...current });
            location.replace(sessionUrl(current.game, saved.role));
            return;
          }
        } catch (e) {
          if ([403, 404].includes((e as { status?: number }).status || 0))
            forgetSession();
        }
      }
      if (!stopped) timer = setTimeout(sync, 900);
    };
    void sync();
    // Existing game links also use the paired menu, including links on phones.
    const click = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element ? event.target.closest('a') : null;
      if (
        !anchor ||
        anchor.target === '_blank' ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0 ||
        anchor.hasAttribute('download')
      )
        return;
      const url = new URL(anchor.href);
      const game = Object.keys(gamePaths).find(
        (name) => gamePaths[name] === url.pathname,
      );
      if (savedSession() && url.origin === location.origin && game) {
        event.preventDefault();
        void select(game);
      }
    };
    document.addEventListener('click', click, true);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(initial);
      window.removeEventListener('game-session', refresh);
      document.removeEventListener('click', click, true);
    };
  }, [select]);
  if (!session) return null;
  return (
    <aside
      className="paired-menu"
      ref={menu}
      data-game-menu
      aria-label="연결된 게임 선택"
    >
      <button
        ref={trigger}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="paired-games"
      >
        ☰ 게임 메뉴
      </button>
      {open && (
        <div id="paired-games" className="paired-menu-panel" aria-busy={busy}>
          <strong>
            연결된 {session.role === 'phone' ? 'PC와 함께' : '폰과 함께'} 게임
            선택
          </strong>
          <p>코드 {session.code} · 다시 연결할 필요 없어요</p>
          {Object.entries({
            shooting: '좀비 슈팅',
            fishing: '낚시',
            racing: '레이싱',
          }).map(([game, label]) => (
            <button
              key={game}
              disabled={busy}
              aria-current={session.game === game ? 'page' : undefined}
              onClick={() => select(game)}
            >
              {label}
              {session.game === game ? ' · 현재 게임' : ' →'}
            </button>
          ))}
          <small>
            {busy
              ? '연결된 화면을 함께 전환하고 있어요…'
              : '게임은 잠시 멈췄어요. 다른 게임을 선택하면 현재 플레이가 종료됩니다.'}
          </small>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </aside>
  );
}
