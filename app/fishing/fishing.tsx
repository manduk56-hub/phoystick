'use client';
import { useResumeGame } from '@/lib/use-resume-game';
import HoldButton from '@/components/hold-button';
import { isGameShortcut } from '@/lib/game-input';
import { useGameInterruption } from '@/lib/use-game-interruption';
import { connectGame, savedSession } from '@/lib/game-session';
import { useEffect, useRef, useState } from 'react';
import {
  Home,
  Smartphone,
  Monitor,
  RotateCcw,
  Pause,
  Play,
  Maximize2,
  ArrowUpRight,
  Fish,
  Anchor,
  Radio,
  Link2,
} from 'lucide-react';
import QRCode from 'qrcode';
import Tackle, { FishingRigControls } from './tackle';
import { spots, rigs, baits, equipment, leaders } from '@/lib/fishing-model';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Progress } from '@/components/ui/progress';
import { Link, type Packet } from '@/lib/link';
import { FishingScene } from '@/lib/fishing-scene';
import {
  FishingModel,
  CastGesture,
  reelDelta,
  phaseText,
  type FishingState,
} from '@/lib/fishing-model';
const initial = new FishingModel().state;
type EventPacket = Packet & {
  events: {
    id: number;
    action: string;
    x: number;
    y: number;
    value?: number;
  }[];
};
function Meter({ state }: { state: FishingState }) {
  return (
    <div className={'fish-meter ' + (state.tension > 0.8 ? 'danger' : '')}>
      <div>
        <span>줄 장력</span>
        <b>{Math.round(state.tension * 100)}%</b>
      </div>
      <Progress
        value={Math.min(100, state.tension * 100)}
        aria-label="낚싯줄 장력"
      />
      <small>
        {state.tension > 0.8
          ? '잠깐 멈추세요 · 줄이 끊어질 수 있어요'
          : state.tension < 0.16
            ? '릴을 감아 줄을 팽팽하게'
            : '초록 구간을 유지하세요'}
      </small>
    </div>
  );
}
function Reel({
  onReel,
  disabled = false,
}: {
  onReel: (turns: number) => void;
  disabled?: boolean;
}) {
  const dragging = useRef(false),
    last = useRef(0),
    accum = useRef(0);
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    if (disabled) {
      dragging.current = false;
      accum.current = 0;
    }
  }, [disabled]);
  const angle = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.atan2(
      e.clientY - r.top - r.height / 2,
      e.clientX - r.left - r.width / 2,
    );
  };
  return (
    <div className="reel-area">
      <button
        className="reel-wheel"
        disabled={disabled}
        aria-label="시계 방향으로 돌려 줄 감기. 키보드에서는 방향키 또는 Enter"
        onPointerDown={(e) => {
          if (e.button !== 0 || dragging.current) return;
          e.preventDefault();
          dragging.current = true;
          last.current = angle(e);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging.current || disabled) return;
          const bounds = e.currentTarget.getBoundingClientRect();
          if (
            Math.hypot(
              e.clientX - bounds.left - bounds.width / 2,
              e.clientY - bounds.top - bounds.height / 2,
            ) <
            bounds.width * 0.16
          ) {
            last.current = angle(e);
            return;
          }
          const a = angle(e),
            delta = reelDelta(last.current, a);
          last.current = a;
          if (delta) {
            accum.current += delta;
            setRotation((v) => v + delta * 360);
            if (accum.current >= 0.035) {
              onReel(accum.current);
              accum.current = 0;
            }
          }
        }}
        onPointerUp={() => {
          dragging.current = false;
          if (accum.current > 0) {
            onReel(accum.current);
            accum.current = 0;
          }
        }}
        onPointerCancel={() => {
          dragging.current = false;
          accum.current = 0;
        }}
        onLostPointerCapture={() => {
          dragging.current = false;
          accum.current = 0;
        }}
        onKeyDown={(e) => {
          if (['ArrowRight', 'Enter', ' '].includes(e.key)) {
            e.preventDefault();
            onReel(0.25);
            setRotation((v) => v + 90);
          }
        }}
      >
        <span
          className="reel-spokes"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
        <span className="reel-hub">
          <RotateCcw size={26} />
          <b>REEL</b>
        </span>
        <span
          className="reel-knob"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      </button>
      <p>시계 방향으로 돌려 줄 감기</p>
    </div>
  );
}
export default function Fishing() {
  const [role, setRole] = useState<'host' | 'phone'>('host'),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setRole(
      (p.get('role') || savedSession()?.role) === 'phone' ||
        (!p.has('role') &&
          !savedSession() &&
          /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
        ? 'phone'
        : 'host',
    );
    setReady(true);
  }, []);
  return (
    <main className={'fish-app ' + (role === 'phone' ? 'fish-mobile' : '')}>
      <header className="fish-header">
        <a href="/">← 메인화면</a>
        <b>STILLWATER</b>
        <a href="/racing">레이싱 ↗</a>
        <button
          className="quiet"
          onClick={() => setRole((v) => (v === 'host' ? 'phone' : 'host'))}
        >
          {role === 'host' ? <Smartphone size={16} /> : <Monitor size={16} />}{' '}
          {role === 'host' ? '폰 컨트롤러' : '직접 플레이'}
        </button>
      </header>
      {ready && (role === 'host' ? <FishingHost /> : <FishingController />)}
    </main>
  );
}
function FishingHost() {
  const canvas = useRef<HTMLCanvasElement>(null),
    scene = useRef<FishingScene | null>(null),
    container = useRef<HTMLElement>(null),
    link = useRef<Link | null>(null),
    lastEvent = useRef(0),
    remote = useRef(false);
  const [state, setState] = useState<FishingState>(initial),
    [room, setRoom] = useState<{ code: string; token: string } | null>(null),
    [qr, setQr] = useState(''),
    [connection, setConnection] = useState('폰 연결 대기'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [setup, setSetup] = useState(false),
    [notebook, setNotebook] = useState(false),
    [active, setActive] = useState(true);
  useEffect(() => {
    let s: FishingScene;
    try {
      s = new FishingScene(canvas.current!, setState);
      scene.current = s;
      try {
        const saved = localStorage.getItem('stillwater-save-v1');
        if (saved) s.model.restore(saved);
      } catch {
        /* Storage can be unavailable. */
      }
    } catch {
      setError('3D 화면을 열지 못했습니다. 다른 브라우저로 열어 주세요.');
      return;
    }
    const key = (e: KeyboardEvent) => {
      if (!isGameShortcut(e)) return;
      if (e.code === 'Space') {
        if ((e.target as HTMLElement).closest('button') || e.repeat) return;
        e.preventDefault();
        if (['ready', 'caught', 'escaped'].includes(s.model.state.phase)) {
          s.action('cast', 0.65);
          setActive(true);
          setSetup(false);
          setNotebook(false);
        } else s.action('hook');
      }
      if (e.code === 'KeyR') s.action('reelStart');
      if (e.code === 'BracketLeft') s.action('drag', s.model.state.drag - 0.05);
      if (e.code === 'BracketRight')
        s.action('drag', s.model.state.drag + 0.05);
      if (e.code === 'KeyQ') s.action('rod', s.model.state.rod + 0.1);
      if (e.code === 'KeyE') s.action('rod', s.model.state.rod - 0.1);
      if (e.code === 'Escape' && !e.repeat) s.action('pause');
    };
    window.addEventListener('keydown', key);
    const releaseReel = () => s.action('reelStop');
    const keyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') releaseReel();
    };
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', releaseReel);
    let savedRevision = -1;
    const timer = setInterval(() => {
      if (s.model.state.revision !== savedRevision) {
        try {
          localStorage.setItem('stillwater-save-v1', s.model.save());
          savedRevision = s.model.state.revision;
        } catch {
          /* Continue without device storage. */
        }
      }
      link.current?.send({ ...s.model.state, time: Date.now() });
      if (
        remote.current &&
        link.current &&
        Date.now() - link.current.lastReceive > 6000 &&
        !s.model.state.paused &&
        ['casting', 'waiting', 'bite', 'fighting'].includes(s.model.state.phase)
      ) {
        s.action('pause');
        setError('폰 연결이 끊겨 잠시 멈췄습니다. 연결 후 계속하세요.');
      }
    }, 150);
    const lifecycle = new AbortController(),
      mc = (document as any).modelContext;
    if (mc?.registerTool)
      Promise.resolve(
        mc.registerTool(
          {
            name: 'control_fishing_game',
            description: 'Cast, hook, reel or pause the visible fishing game.',
            inputSchema: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: ['cast', 'hook', 'reel', 'pause'],
                },
                amount: { type: 'number', minimum: 0, maximum: 1 },
              },
              required: ['action'],
              additionalProperties: false,
            },
            execute: (v: any) => {
              if (
                !['cast', 'hook', 'reel', 'pause'].includes(v.action) ||
                (v.amount !== undefined &&
                  (!Number.isFinite(v.amount) || v.amount < 0 || v.amount > 1))
              )
                throw Error('Invalid fishing input');
              s.action(v.action, v.amount ?? 0.5);
              setActive(true);
              setSetup(false);
              return { ...s.model.state };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    return () => {
      try {
        localStorage.setItem('stillwater-save-v1', s.model.save());
      } catch {
        /* Continue without device storage. */
      }
      s.dispose();
      link.current?.close();
      clearInterval(timer);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', releaseReel);
      lifecycle.abort();
    };
  }, []);
  function action(a: string, v = 0.5) {
    if (a === 'cast') {
      setActive(true);
      setSetup(false);
    }
    scene.current?.action(a, v);
  }
  useGameInterruption(() => {
    const s = scene.current;
    if (s && !['ready', 'caught', 'escaped'].includes(s.model.state.phase))
      s.action('hold');
  });
  async function create(fresh = false) {
    setBusy(true);
    setError('');
    try {
      const r = await connectGame('host', 'fishing', '', fresh);
      link.current?.close();
      lastEvent.current = 0;
      remote.current = false;
      setRoom(r);
      const l = (link.current = new Link(r, 'host'));
      l.onConnection = setConnection;
      l.onInput = (p: EventPacket) => {
        remote.current = true;
        scene.current!.model.configure('rod', p.y);
        for (const e of p.events || []) {
          if (e.id <= lastEvent.current) continue;
          lastEvent.current = e.id;
          if (
            [
              'cast',
              'hook',
              'reel',
              'flick',
              'pause',
              'hold',
              'drag',
              'speed',
              'rod',
              'recall',
            ].includes(e.action)
          ) {
            if (e.action === 'cast') {
              setSetup(false);
              setActive(true);
              setNotebook(false);
            }
            scene.current?.action(
              e.action,
              Number.isFinite(e.value) ? e.value : 0.5,
            );
          }
        }
      };
      const url = new URL('/fishing', location.origin);
      url.search = '?role=phone&code=' + r.code;
      setQr(
        await QRCode.toDataURL(url.href, {
          width: 140,
          margin: 1,
          color: { dark: '#16383d', light: '#e7f3dd' },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useResumeGame('host', create);

  return (
    <section
      ref={container}
      className={
        'fish-scene ' +
        (active ? 'fishing-active ' : '') +
        (state.paused ? 'is-paused' : '')
      }
    >
      <canvas ref={canvas} className="fish-canvas" />
      <div
        className="fish-shade"
        style={{
          backgroundColor: `rgba(5, 18, 35, ${state.hour < 5 || state.hour > 20 ? 0.62 : state.weather === 2 ? 0.28 : state.weather === 1 ? 0.15 : 0})`,
        }}
      />
      <div className="fish-top">
        <div>
          <span>STILLWATER / LAKE 01</span>
          <b>{spots[state.spot].name}</b>
        </div>
        <div className="catch-count">
          <Fish size={18} />
          <b>{state.catches}</b>
          <span>마리 · {state.totalWeight.toFixed(2)} kg</span>
        </div>
        <div className="fish-top-actions">
          <button
            className="quiet"
            aria-expanded={notebook}
            onClick={() => {
              if (
                !notebook &&
                ['casting', 'waiting', 'bite', 'fighting'].includes(state.phase)
              )
                action('hold');
              setNotebook((v) => !v);
              setSetup(false);
            }}
          >
            채비 · 수첩
          </button>
          <button
            className="quiet"
            onClick={() => {
              window.location.assign('/');
            }}
            aria-label="메인화면으로 돌아가기"
          >
            <Home size={17} /> 메인화면
          </button>
          <button
            className="quiet"
            onClick={() => {
              if (
                !state.paused &&
                ['casting', 'waiting', 'bite', 'fighting'].includes(state.phase)
              )
                action('pause');
              setSetup((v) => !v);
              setNotebook(false);
            }}
          >
            <Smartphone size={17} /> 연결
          </button>
          <button
            className="quiet"
            aria-label="일시정지 또는 계속"
            onClick={() => action('pause')}
          >
            {state.paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button
            className="quiet"
            aria-label="전체화면"
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else if (container.current?.requestFullscreen)
                  await container.current.requestFullscreen();
                else
                  setError(
                    '브라우저에서 전체화면을 지원하지 않습니다. 현재 화면에서 계속 즐길 수 있어요.',
                  );
              } catch {
                setError(
                  '전체화면을 열지 못했습니다. 현재 화면에서 계속 즐길 수 있어요.',
                );
              }
            }}
          >
            <Maximize2 size={18} />
          </button>
        </div>
      </div>
      <div className="fish-weather">
        <b>
          {String(Math.floor(state.hour)).padStart(2, '0')}:
          {String(Math.floor((state.hour % 1) * 60)).padStart(2, '0')}
        </b>
        <span>
          {['맑음', '흐림', '비'][state.weather]} ·{' '}
          {state.temperature.toFixed(0)}°C
        </span>
        <span>바람 {state.wind.toFixed(1)} m/s</span>
        <span>
          {spots[state.spot].bottom} · 최대 {spots[state.spot].depth} m
        </span>
      </div>
      {notebook && (
        <Tackle
          state={state}
          action={action}
          close={() => setNotebook(false)}
        />
      )}
      {state.phase === 'ready' && !active && (
        <div className="fish-welcome">
          <span>MOTION FISHING / STILLWATER</span>
          <h1>
            물결 너머,
            <br />
            당신의 첫 입질.
          </h1>
          <p>
            폰이 낚싯대가 됩니다.
            <br />
            뒤로 준비하고, 앞으로 던지고, 천천히 감으세요.
          </p>
          <button onClick={() => action('cast', 0.65)}>
            PC로 먼저 낚시하기 <ArrowUpRight size={18} />
          </button>
          <button
            className="quiet"
            onClick={() => {
              setSetup(true);
              if (!room) void create();
            }}
          >
            <Smartphone size={17} /> 폰 연결하기
          </button>
        </div>
      )}
      {setup && (
        <aside className="fish-link-panel">
          <div className="fish-panel-title">
            <Radio size={17} /> PHONE LINK
            <button
              className="quiet"
              aria-label="연결 안내 닫기"
              onClick={() => setSetup(false)}
            >
              ×
            </button>
          </div>
          <h2>
            폰으로 던지고,
            <br />
            손끝으로 감으세요.
          </h2>
          {room ? (
            <>
              <div className="fish-code">
                <strong>
                  {room.code.slice(0, 3)} {room.code.slice(3)}
                </strong>
                {qr && (
                  <img
                    src={qr}
                    width={96}
                    height={96}
                    alt="낚시 컨트롤러 연결 QR"
                  />
                )}
              </div>
              <p className="fish-status">{connection}</p>
              <button
                className="quiet"
                disabled={busy}
                onClick={() => void create(true)}
              >
                새 코드 만들기
              </button>
            </>
          ) : (
            <button disabled={busy} onClick={() => void create(true)}>
              <Link2 size={17} />
              {busy ? '코드 생성 중…' : '연결 코드 만들기'}
            </button>
          )}
          <ol>
            <li>폰으로 QR을 스캔하세요.</li>
            <li>폰을 세로로 잡고 센서를 허용하세요.</li>
            <li>뒤로 준비한 후 앞으로 휘두르세요.</li>
          </ol>
          <small>폰은 손에서 놓지 마세요.</small>
          <a href="/">좀비 슈팅으로 돌아가기 →</a>
        </aside>
      )}
      {active && (
        <>
          <div
            className={
              'fish-phase ' +
              (notebook ? 'with-notebook ' : '') +
              (state.phase === 'bite' ? 'bite' : '')
            }
          >
            <span>
              {state.phase === 'bite'
                ? 'BITE!'
                : state.phase === 'caught'
                  ? 'NICE CATCH'
                  : state.paused
                    ? 'PAUSED'
                    : 'STILLWATER'}
            </span>
            <h2>{state.paused ? '잠시 쉬어가세요' : phaseText[state.phase]}</h2>
            <p>{state.message}</p>
            {state.phase === 'ready' && !state.paused && (
              <button
                onClick={() => {
                  action('cast', 0.65);
                  setNotebook(false);
                }}
              >
                캐스팅하기 ↗
              </button>
            )}
            {state.phase === 'waiting' && (
              <div className="bite-observation">
                {state.rig === 2
                  ? '루어를 감아 유인하세요'
                  : state.nibble > 0.1
                    ? '예신 · 조금 더 기다리세요'
                    : state.rig === 1
                      ? '초릿대 관찰 중'
                      : '찌 관찰 중'}
                {state.groundbait > 0
                  ? ` · 밑밥 ${Math.ceil(state.groundbait)}초`
                  : ''}
              </div>
            )}
            {state.phase === 'caught' && (
              <div className="catch-details">
                <strong>
                  {state.trophy ? '★ TROPHY' : 'CATCH RECORD'} ·{' '}
                  {state.weight.toFixed(2)} kg
                </strong>
                <span>
                  {state.length} cm · 경험치 +
                  {Math.round(12 + state.weight * 8)}
                </span>
                <button
                  disabled={
                    !state.keepnet.some((f) => f.id === state.catches) ||
                    state.paused
                  }
                  onClick={() => action('release')}
                >
                  방생 · 경험치 +5
                </button>
              </div>
            )}
            {state.paused && (
              <button
                onClick={() => {
                  action('pause');
                  setSetup(false);
                }}
              >
                계속 낚시하기
              </button>
            )}
            {['caught', 'escaped'].includes(state.phase) && !state.paused && (
              <button onClick={() => action('cast', 0.65)}>
                다시 캐스팅 <ArrowUpRight size={17} />
              </button>
            )}
          </div>
          <div className={'fish-bottom ' + (notebook ? 'with-notebook' : '')}>
            <div className="fish-distance">
              <span>남은 거리</span>
              <b>
                {state.distance.toFixed(1)}
                <small> m</small>
              </b>
              <span>캐스팅 {state.castDistance.toFixed(0)} m</span>
              <span>
                {rigs[state.rig]} · {baits[state.bait]} ·{' '}
                {state.rig === 1 ? spots[state.spot].depth : state.depth} m
              </span>
            </div>
            {state.phase === 'fighting' && (
              <div className="fight-instruments">
                <Meter state={state} />
                <div className="fight-stamina">
                  <span>물고기 체력 {Math.round(state.stamina * 100)}%</span>
                  <Progress
                    value={state.stamina * 100}
                    aria-label="물고기 체력"
                  />
                  <small>
                    하중 {state.load.toFixed(2)} /{' '}
                    {(
                      equipment[state.gear].line *
                      leaders[state.leader].strength *
                      (0.6 + state.condition * 0.4)
                    ).toFixed(1)}{' '}
                    kg · {state.slipping ? '드랙 풀림' : '드랙 유지'}
                  </small>
                </div>
                <FishingRigControls state={state} action={action} />
              </div>
            )}
            <div className="fish-pc-controls">
              {state.phase === 'bite' ? (
                <button onClick={() => action('hook')}>
                  챔질! <Anchor size={18} />
                </button>
              ) : (
                <button
                  disabled={
                    (state.phase !== 'fighting' &&
                      !(state.phase === 'waiting' && state.rig === 2)) ||
                    state.paused
                  }
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    action('reelStart');
                  }}
                  onPointerUp={() => action('reelStop')}
                  onPointerCancel={() => action('reelStop')}
                  onLostPointerCapture={() => action('reelStop')}
                  onClick={(e) => {
                    if (e.detail === 0) action('reel', 0.35);
                  }}
                  onWheel={(e) => {
                    if (
                      state.phase === 'fighting' ||
                      (state.phase === 'waiting' && state.rig === 2)
                    )
                      action('reel', Math.min(0.4, Math.abs(e.deltaY) / 300));
                  }}
                >
                  누르고 줄 감기 <RotateCcw size={18} />
                </button>
              )}
              <small>SPACE 챔질 / R 길게·휠 감기 / [ ] 드랙 / Q·E 각도</small>
              {['waiting', 'bite', 'fighting'].includes(state.phase) && (
                <button
                  className="quiet"
                  disabled={state.paused}
                  onClick={() => action('recall')}
                >
                  채비 회수
                </button>
              )}
            </div>
          </div>
        </>
      )}
      {error && (
        <div className="fish-error" role="alert">
          {error}
          <button
            onClick={() => {
              setError('');
              remote.current = false;
            }}
          >
            PC로 계속
          </button>
        </div>
      )}
    </section>
  );
}
function FishingController() {
  const [code, setCode] = useState(''),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState('PC의 코드를 입력하세요'),
    [sensor, setSensor] = useState(false),
    [gestureStage, setGestureStage] = useState('idle'),
    [state, setState] = useState<FishingState>(initial);
  const link = useRef<Link | null>(null),
    packet = useRef<EventPacket>({ x: 0.5, y: 0.5, events: [], time: 0 }),
    sequence = useRef(0),
    stateRef = useRef(state),
    cleanup = useRef<() => void>(() => {}),
    cast = useRef(new CastGesture()),
    lastFlick = useRef(0),
    latestMotion = useRef(0),
    sensorOn = useRef(false);
  const reeling = useRef(false);
  useGameInterruption(() => {
    reeling.current = false;
    if (connected) send('hold');
  });
  stateRef.current = state;
  useEffect(() => {
    setCode(new URLSearchParams(location.search).get('code') || '');
    const timer = setInterval(() => {
      packet.current.time = Date.now();
      if (reeling.current && !document.hidden && !stateRef.current.paused)
        send('reel', 0.034);
      link.current?.send(packet.current);
      if (
        sensorOn.current &&
        latestMotion.current &&
        performance.now() - latestMotion.current > 4000
      ) {
        setStatus('센서 입력 중단 · 버튼으로 조작할 수 있습니다.');
      }
    }, 40);
    return () => {
      clearInterval(timer);
      link.current?.close();
      cleanup.current();
    };
  }, []);
  function send(action: string, value = 0.5) {
    if (action === 'rod') packet.current.y = value;
    packet.current.events.push({
      id: ++sequence.current,
      action,
      value,
      x: 0.5,
      y: packet.current.y,
    });
    packet.current.events = packet.current.events.slice(-32);
    packet.current.time = Date.now();
    link.current?.send(packet.current);
  }
  async function join() {
    setBusy(true);
    setError('');
    try {
      const r = await connectGame('phone', 'fishing', code);
      link.current?.close();
      const l = (link.current = new Link(r, 'phone'));
      l.onConnection = setStatus;
      l.onStatus = (s: FishingState) => {
        if (s.game !== 'fishing' || !s.phase) return;
        if (s.phase !== stateRef.current.phase) {
          if (s.phase === 'bite') navigator.vibrate?.([80, 40, 80]);
          if (s.phase === 'caught') navigator.vibrate?.([40, 40, 120]);
        }
        setState(s);
      };
      setConnected(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useResumeGame('phone', join);
  async function enable() {
    setError('');
    try {
      if (!window.isSecureContext)
        throw Error(
          '센서는 HTTPS에서 사용할 수 있습니다. 배포된 주소로 열어 주세요.',
        );
      if (typeof DeviceMotionEvent === 'undefined')
        throw Error(
          '동작 센서가 없는 브라우저입니다. 아래 버튼으로 조작해 주세요.',
        );
      const M = DeviceMotionEvent as any;
      if (M.requestPermission && (await M.requestPermission()) !== 'granted')
        throw Error('동작 센서 권한을 허용해야 합니다.');
      cleanup.current();
      cast.current.reset();
      latestMotion.current = 0;
      let rotation = 0;
      let last = 0;
      const onMotion = (e: DeviceMotionEvent) => {
        const rate = e.rotationRate?.beta;
        if (rate == null || !Number.isFinite(rate)) return;
        const now = performance.now();
        latestMotion.current = now;
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
        last = now;
        rotation = Math.max(-50, Math.min(50, rotation + rate * dt));
        packet.current.y = 0.5 + rotation / 100;
        const phase = stateRef.current.phase;
        if (stateRef.current.paused) return;
        if (['ready', 'caught', 'escaped'].includes(phase)) {
          const result = cast.current.update(rate, now);
          setGestureStage(result.stage);
          if (result.cast !== null) {
            send('cast', result.cast);
            navigator.vibrate?.(35);
            rotation = 0;
          }
        } else if (
          ['bite', 'fighting'].includes(phase) &&
          rate > 110 &&
          now - lastFlick.current > 600
        ) {
          lastFlick.current = now;
          send('flick');
          navigator.vibrate?.(25);
        }
      };
      window.addEventListener('devicemotion', onMotion);
      const timer = setTimeout(() => {
        if (!latestMotion.current) {
          setError(
            '센서 값을 받지 못했습니다. 외부 브라우저로 열거나 버튼을 사용하세요.',
          );
          setSensor(false);
          sensorOn.current = false;
        }
      }, 4000);
      cleanup.current = () => {
        window.removeEventListener('devicemotion', onMotion);
        clearTimeout(timer);
      };
      setSensor(true);
      sensorOn.current = true;
      setStatus('모션 준비 완료');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="fish-controller">
      <div className="fish-controller-title">
        <span>PERSONAL FISHING ROD</span>
        <small>{status}</small>
      </div>
      {!connected ? (
        <div className="fish-join">
          <Anchor size={48} />
          <h1>호수에 연결하세요.</h1>
          <p>PC 낚시 화면의 6자리 코드</p>
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label="낚시 연결 코드"
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} className="otp-slot" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <button disabled={busy || code.length !== 6} onClick={join}>
            {busy ? '연결 중…' : '낚시 시작하기'} <ArrowUpRight size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="fish-phone-summary">
            <span>{state.catches} 마리</span>
            <b>{state.distance.toFixed(1)} m</b>
            <span>{state.totalWeight.toFixed(2)} kg</span>
          </div>
          <div
            className={
              'fish-phone-phase ' + (state.phase === 'bite' ? 'bite' : '')
            }
          >
            <span>{phaseText[state.phase]}</span>
            <h2>
              {state.paused
                ? '잠시 멈춤'
                : state.phase === 'ready' ||
                    state.phase === 'caught' ||
                    state.phase === 'escaped'
                  ? gestureStage === 'armed'
                    ? '이제 앞으로 휘두르세요!'
                    : gestureStage === 'back'
                      ? '뒤로 조금 더 들어 올리세요'
                      : sensor
                        ? '뒤로 준비 → 앞으로 캐스팅'
                        : '아래 캐스팅 버튼을 누르세요'
                  : state.phase === 'bite'
                    ? sensor
                      ? '지금 위로 튕겨 챔질!'
                      : '지금 챔질 버튼을 누르세요!'
                    : state.phase === 'fighting'
                      ? '릴을 돌려 끌어올리세요'
                      : state.message}
            </h2>
          </div>
          {!sensor ? (
            <button className="fish-enable" onClick={enable}>
              <Smartphone size={18} /> 모션 센서 허용
            </button>
          ) : (
            <div className="cast-steps">
              <span
                className={
                  gestureStage === 'back' || gestureStage === 'armed'
                    ? 'lit'
                    : ''
                }
              >
                ① 뒤로 준비
              </span>
              <span className={gestureStage === 'armed' ? 'lit' : ''}>
                ② 앞으로 휘두르기
              </span>
            </div>
          )}
          {state.phase === 'fighting' && <Meter state={state} />}
          <FishingRigControls state={state} action={send} />
          <Reel
            disabled={
              (state.phase !== 'fighting' &&
                !(state.phase === 'waiting' && state.rig === 2)) ||
              state.paused
            }
            onReel={(n) => send('reel', n)}
          />
          <HoldButton
            className="fish-hold-reel"
            disabled={
              state.paused ||
              (state.phase !== 'fighting' &&
                !(state.phase === 'waiting' && state.rig === 2))
            }
            onHold={(held) => {
              reeling.current = held;
            }}
          >
            <RotateCcw size={20} /> 누르고 줄 감기
          </HoldButton>
          <div className="fish-phone-buttons">
            <button
              disabled={
                !['ready', 'caught', 'escaped'].includes(state.phase) ||
                state.paused
              }
              onClick={() => send('cast', 0.65)}
            >
              캐스팅 <ArrowUpRight size={18} />
            </button>
            <button
              disabled={
                (state.phase !== 'bite' && state.phase !== 'fighting') ||
                state.paused
              }
              onClick={() => send('flick')}
            >
              챔질 · 당기기 <Anchor size={18} />
            </button>
          </div>
          <div className="fish-phone-tools">
            <button className="quiet" onClick={() => send('pause')}>
              {state.paused ? '계속하기' : '일시정지'}
            </button>
            <button className="quiet" onClick={enable} disabled={!sensor}>
              기본 자세 재설정
            </button>
          </div>
          <p className="fish-phone-note">
            폰은 세로로 잡고 손에서 놓지 마세요.
            <br />
            입질 때 짧게 위로 튕겨 챔질 · 낚는 동안 튕기면 줄 당기기
            <br />
            진동은 지원 기기에서만 작동합니다.
          </p>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
