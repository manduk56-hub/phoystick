'use client';
import { useEffect, useRef, useState } from 'react';
import {
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Progress } from '@/components/ui/progress';
import { api, Link, type Packet } from '@/lib/link';
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
          e.preventDefault();
          dragging.current = true;
          last.current = angle(e);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging.current || disabled) return;
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
      p.get('role') === 'phone' ||
        (!p.has('role') &&
          /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
        ? 'phone'
        : 'host',
    );
    setReady(true);
  }, []);
  return (
    <main className={'fish-app ' + (role === 'phone' ? 'fish-mobile' : '')}>
      <header className="fish-header">
        <a href="/">← 좀비 슈팅</a>
        <b>STILLWATER</b>
        <a href="/racing">레이싱 ↗</a>
        <button
          className="quiet"
          onClick={() => setRole((v) => (v === 'host' ? 'phone' : 'host'))}
        >
          {role === 'host' ? <Smartphone size={16} /> : <Monitor size={16} />}{' '}
          {role === 'host' ? '폰 컨트롤러' : 'PC 화면'}
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
    stateRef = useRef<FishingState>(initial),
    remote = useRef(false);
  const [state, setState] = useState<FishingState>(initial),
    [room, setRoom] = useState<{ code: string; token: string } | null>(null),
    [qr, setQr] = useState(''),
    [connection, setConnection] = useState('폰 연결 대기'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [setup, setSetup] = useState(true),
    [active, setActive] = useState(false);
  stateRef.current = state;
  useEffect(() => {
    let s: FishingScene;
    try {
      s = new FishingScene(canvas.current!, setState);
      scene.current = s;
    } catch {
      setError('3D 화면을 열지 못했습니다. 다른 브라우저로 열어 주세요.');
      return;
    }
    const key = (e: KeyboardEvent) => {
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (e.target as HTMLElement).tagName,
        )
      )
        return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (['ready', 'caught', 'escaped'].includes(s.model.state.phase)) {
          s.action('cast', 0.65);
          setActive(true);
          setSetup(false);
        } else s.action('hook');
      }
      if (e.code === 'KeyR' && !e.repeat) s.action('reel', 0.35);
      if (e.code === 'Escape') s.action('pause');
    };
    window.addEventListener('keydown', key);
    const timer = setInterval(() => {
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
      s.dispose();
      link.current?.close();
      clearInterval(timer);
      window.removeEventListener('keydown', key);
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
  async function create() {
    setBusy(true);
    setError('');
    try {
      const r = await api('create', { game: 'fishing' });
      link.current?.close();
      lastEvent.current = 0;
      remote.current = false;
      setRoom(r);
      const l = (link.current = new Link(r, 'host'));
      l.onConnection = setConnection;
      l.onInput = (p: EventPacket) => {
        remote.current = true;
        scene.current!.model.state.rod = Math.max(0, Math.min(1, p.y));
        for (const e of p.events || []) {
          if (e.id <= lastEvent.current) continue;
          lastEvent.current = e.id;
          if (['cast', 'hook', 'reel', 'flick', 'pause'].includes(e.action)) {
            if (e.action === 'cast') {
              setSetup(false);
              setActive(true);
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
  return (
    <section
      ref={container}
      className={'fish-scene ' + (active ? 'fishing-active' : '')}
    >
      <canvas ref={canvas} className="fish-canvas" />
      <div className="fish-shade" />
      <div className="fish-top">
        <div>
          <span>LAKE 01</span>
          <b>아침의 호수</b>
        </div>
        <div className="catch-count">
          <Fish size={18} />
          <b>{state.catches}</b>
          <span>마리 · {state.totalWeight.toFixed(2)} kg</span>
        </div>
        <div className="fish-top-actions">
          <button
            className="quiet"
            onClick={() => {
              if (
                !state.paused &&
                ['casting', 'waiting', 'bite', 'fighting'].includes(state.phase)
              )
                action('pause');
              setSetup((v) => !v);
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
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else
                void container.current
                  ?.requestFullscreen?.()
                  .catch(() =>
                    setError('브라우저에서 전체화면을 지원하지 않습니다.'),
                  );
            }}
          >
            <Maximize2 size={18} />
          </button>
        </div>
      </div>
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
              <button className="quiet" disabled={busy} onClick={create}>
                새 코드 만들기
              </button>
            </>
          ) : (
            <button disabled={busy} onClick={create}>
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
            className={'fish-phase ' + (state.phase === 'bite' ? 'bite' : '')}
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
          <div className="fish-bottom">
            <div className="fish-distance">
              <span>남은 거리</span>
              <b>
                {state.distance.toFixed(1)}
                <small> m</small>
              </b>
              <span>캐스팅 {state.castDistance.toFixed(0)} m</span>
            </div>
            {state.phase === 'fighting' && <Meter state={state} />}
            <div className="fish-pc-controls">
              {state.phase === 'bite' ? (
                <button onClick={() => action('hook')}>
                  챔질! <Anchor size={18} />
                </button>
              ) : (
                <button
                  disabled={state.phase !== 'fighting' || state.paused}
                  onClick={() => action('reel', 0.35)}
                  onWheel={(e) => {
                    if (state.phase === 'fighting')
                      action('reel', Math.min(0.4, Math.abs(e.deltaY) / 300));
                  }}
                >
                  줄 감기 <RotateCcw size={18} />
                </button>
              )}
              <small>SPACE 캐스팅·챔질 / R·휠 줄 감기</small>
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
  stateRef.current = state;
  useEffect(() => {
    setCode(new URLSearchParams(location.search).get('code') || '');
    const timer = setInterval(() => {
      packet.current.time = Date.now();
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
      const r = await api('join', { code, game: 'fishing' });
      const l = (link.current = new Link(r, 'phone'));
      l.onConnection = setStatus;
      l.onStatus = (s: FishingState) => {
        if (s.game !== 'fishing') return;
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
                      : '뒤로 준비 → 앞으로 캐스팅'
                  : state.phase === 'bite'
                    ? '지금 위로 튕겨 챔질!'
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
          <Reel
            disabled={state.phase !== 'fighting' || state.paused}
            onReel={(n) => send('reel', n)}
          />
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
            <button className="quiet" onClick={enable}>
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
