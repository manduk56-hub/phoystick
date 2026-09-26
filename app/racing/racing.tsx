'use client';
import { useResumeGame } from '@/lib/use-resume-game';
import { isGameShortcut, smoothControl } from '@/lib/game-input';
import { useGameInterruption } from '@/lib/use-game-interruption';
import HoldButton from '@/components/hold-button';
import { connectGame, savedSession } from '@/lib/game-session';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Link, type Packet } from '@/lib/link';
import { RacingScene } from '@/lib/racing-scene';
import {
  RacingModel,
  WheelControl,
  gravityFromOrientation,
  idleInput,
  TRACK_LENGTH,
  TOTAL_LAPS,
  RACE_DISTANCE,
  trackPoint,
  type DriveInput,
  type RaceState,
  type Gravity,
} from '@/lib/racing-model';

const initial = new RacingModel().state;
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
const mapPoint = (d: number) => {
  const p = trackPoint(d);
  return { x: 100 + p.x / 5.6, y: 100 + p.z / 5.6 };
};
const mapPath =
  Array.from({ length: 161 }, (_, i) => {
    const p = mapPoint((i / 160) * TRACK_LENGTH);
    return `${i ? 'L' : 'M'}${p.x},${p.y}`;
  }).join(' ') + ' Z';
function CircuitMap({ state }: { state: RaceState }) {
  return (
    <div className="race-circuit-map">
      <span>APEX INTERNATIONAL</span>
      <svg viewBox="0 0 200 200" aria-label="서킷과 선수 위치">
        <path d={mapPath} fill="none" stroke="#ffffff65" strokeWidth="5" />
        {state.standings.map((c) => {
          const p = mapPoint(c.distance);
          return (
            <circle
              key={c.name}
              cx={p.x}
              cy={p.y}
              r={c.player ? 5 : 3}
              fill={c.player ? '#f9e45b' : '#f4f5f6'}
            />
          );
        })}
      </svg>
      <small>2.4 KM · 3 LAPS · GT SPRINT</small>
    </div>
  );
}
function Classification({ state }: { state: RaceState }) {
  return (
    <ol className="race-classification">
      {state.standings.map((c, i) => (
        <li key={c.name} className={c.player ? 'is-player' : ''}>
          <b>{i + 1}</b>
          <span>{c.name}</span>
          <small>
            {c.time !== null
              ? clock(c.time)
              : c.player
                ? 'YOU'
                : `${Math.abs(c.distance - state.distance).toFixed(0)} m`}
          </small>
        </li>
      ))}
    </ol>
  );
}
type RacePacket = Packet & { drive?: DriveInput };
function DriveControls({
  onInput,
  disabled = false,
}: {
  onInput: (input: DriveInput) => void;
  disabled?: boolean;
}) {
  const held = useRef(new Set<string>());
  return (
    <div className="drive-touch-controls" aria-label="터치 운전">
      {[
        ['left', '←', '왼쪽 조향'],
        ['right', '→', '오른쪽 조향'],
        ['brake', '제동', '브레이크'],
        ['throttle', '가속', '액셀'],
      ].map(([key, text, label]) => (
        <HoldButton
          key={key}
          label={label}
          disabled={disabled}
          className={`drive-${key}`}
          onHold={(down) => {
            if (down) held.current.add(key);
            else held.current.delete(key);
            onInput({
              steer:
                Number(held.current.has('right')) -
                Number(held.current.has('left')),
              throttle: Number(held.current.has('throttle')),
              brake: Number(held.current.has('brake')),
            });
          }}
        >
          {text}
        </HoldButton>
      ))}
    </div>
  );
}
function Pedals({ input }: { input: DriveInput }) {
  return (
    <div className="race-pedals">
      <div>
        <span>브레이크</span>
        <i>
          <b style={{ width: input.brake * 100 + '%' }} />
        </i>
        <strong>{Math.round(input.brake * 100)}%</strong>
      </div>
      <div>
        <span>액셀</span>
        <i>
          <b style={{ width: input.throttle * 100 + '%' }} />
        </i>
        <strong>{Math.round(input.throttle * 100)}%</strong>
      </div>
    </div>
  );
}
export default function Racing() {
  const [phone, setPhone] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setPhone(
      (p.get('role') || savedSession()?.role) === 'phone' ||
        (!p.has('role') &&
          !savedSession() &&
          /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)),
    );
    setReady(true);
  }, []);
  return (
    <main className="race-app">
      <nav className="race-nav">
        <a href="/">DEAD SIGNAL</a>
        <a href="/fishing">STILLWATER</a>
        <b>APEX DRIVE</b>
        <button onClick={() => setPhone(!phone)}>
          {phone ? '직접 플레이' : '폰 컨트롤러'} ↗
        </button>
      </nav>
      {ready && (phone ? <Controller /> : <Host />)}
    </main>
  );
}
function Host() {
  const canvas = useRef<HTMLCanvasElement>(null),
    container = useRef<HTMLElement>(null),
    scene = useRef<RacingScene | null>(null),
    link = useRef<Link | null>(null),
    keys = useRef(new Set<string>()),
    touchInput = useRef(idleInput()),
    localSteer = useRef(0),
    remote = useRef(false),
    lastStamp = useRef(0),
    lastSeen = useRef(0),
    lastEvent = useRef(0);
  const [state, setState] = useState<RaceState>(initial),
    [setup, setSetup] = useState(false),
    [room, setRoom] = useState<{ code: string; token: string } | null>(null),
    [qr, setQr] = useState(''),
    [connection, setConnection] = useState('폰 연결 대기'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [active, setActive] = useState(false);
  useEffect(() => {
    let s: RacingScene;
    try {
      s = new RacingScene(canvas.current!, setState);
      scene.current = s;
    } catch {
      setError(
        '3D 화면을 열지 못했습니다. WebGL을 지원하는 브라우저에서 다시 열어 주세요.',
      );
      return;
    }
    const down = (e: KeyboardEvent) => {
      if (!isGameShortcut(e)) return;
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(
          e.code,
        )
      )
        e.preventDefault();
      keys.current.add(e.code);
      if (e.code === 'Space' && !e.repeat) {
        if (['ready', 'finished'].includes(s.model.state.phase)) {
          remote.current = false;
          s.model.start();
          setActive(true);
          setSetup(false);
        } else s.model.state.paused = !s.model.state.paused;
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const hide = () => {
      keys.current.clear();
      touchInput.current = idleInput();
      localSteer.current = 0;
      s.model.setInput(idleInput());
      if (['racing', 'countdown'].includes(s.model.state.phase))
        s.model.state.paused = true;
    };
    const visibility = () => {
      if (document.hidden) hide();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', visibility);
    const timer = setInterval(() => {
      if (remote.current) {
        if (Date.now() - lastSeen.current > 700)
          s.model.setInput({ steer: 0, throttle: 0, brake: 1 });
        if (
          Date.now() - lastSeen.current > 2500 &&
          ['racing', 'countdown'].includes(s.model.state.phase)
        ) {
          s.model.state.paused = true;
          setError(
            '폰 입력이 끊겨 멈췄습니다. 연결 상태를 확인하고 계속하세요.',
          );
        }
      } else {
        const k = keys.current;
        const target =
          (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) -
            (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0) ||
          touchInput.current.steer;
        localSteer.current = smoothControl(localSteer.current, target, 0.05);
        s.model.setInput({
          steer: localSteer.current,
          throttle:
            k.has('ArrowUp') || k.has('KeyW') ? 1 : touchInput.current.throttle,
          brake:
            k.has('ArrowDown') || k.has('KeyS') ? 1 : touchInput.current.brake,
        });
      }
      link.current?.send({ ...s.model.state, time: Date.now() });
    }, 50);
    return () => {
      s.dispose();
      link.current?.close();
      clearInterval(timer);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  function start() {
    if (!scene.current) return;
    remote.current = false;
    setError('');
    setSetup(false);
    setActive(true);
    scene.current.model.start();
  }
  function pause() {
    if (scene.current)
      scene.current.model.state.paused = !scene.current.model.state.paused;
  }
  async function create(fresh = false) {
    setBusy(true);
    setError('');
    try {
      const r = await connectGame('host', 'racing', '', fresh);
      link.current?.close();
      remote.current = false;
      lastStamp.current = 0;
      lastEvent.current = 0;
      setRoom(r);
      const l = (link.current = new Link(r, 'host'));
      l.onConnection = setConnection;
      l.onInput = (p: RacePacket) => {
        if (!Number.isFinite(p.time) || p.time === lastStamp.current) return;
        lastStamp.current = p.time;
        lastSeen.current = Date.now();
        remote.current = true;
        if (p.drive) scene.current?.model.setInput(p.drive);
        for (const e of p.events || []) {
          if (e.id <= lastEvent.current) continue;
          lastEvent.current = e.id;
          if (e.action === 'start') {
            scene.current?.model.start();
            setSetup(false);
            setActive(true);
            setError('');
          }
          if (e.action === 'pause') pause();
          if (e.action === 'hold' && scene.current)
            scene.current.model.state.paused = true;
        }
      };
      const url = new URL('/racing', location.origin);
      url.search = '?role=phone&code=' + r.code;
      setQr(
        await QRCode.toDataURL(url.href, {
          width: 160,
          margin: 1,
          color: { dark: '#142633', light: '#f3eee4' },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useResumeGame('host', create);
  useGameInterruption(() => {
    keys.current.clear();
    touchInput.current = idleInput();
    localSteer.current = 0;
    if (
      scene.current &&
      ['racing', 'countdown'].includes(scene.current.model.state.phase)
    ) {
      scene.current.model.setInput(idleInput());
      scene.current.model.state.paused = true;
    }
  });

  return (
    <section
      ref={container}
      className={'race-stage ' + (active ? 'race-active' : '')}
    >
      <canvas ref={canvas} />
      <div className="race-vignette" />
      <header className="race-top">
        <div>
          <span>GT SPRINT / ROUND 01</span>
          <b>
            APEX<span>DRIVE</span>
          </b>
        </div>
        <div className="race-top-actions">
          <button
            onClick={() => {
              if (scene.current && state.phase !== 'ready')
                scene.current.model.state.paused = true;
              setSetup(true);
            }}
          >
            폰 연결
          </button>
          {active && (
            <button onClick={pause}>
              {state.paused ? '계속' : '일시정지'}
            </button>
          )}
          <button
            aria-label="전체 화면"
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
            ⛶
          </button>
          {active && (
            <button
              onClick={() => {
                setActive(false);
                if (scene.current) scene.current.model.state.paused = true;
              }}
            >
              메뉴
            </button>
          )}
        </div>
      </header>
      {!active && (
        <div className="race-intro">
          <span className="race-eyebrow">
            RACE WEEKEND / APEX INTERNATIONAL
          </span>
          <h1>
            그리드에서,
            <br />
            <em>포디움까지.</em>
          </h1>
          <p>
            8대의 GT 레이스카, 2.4km 폐쇄형 서킷.
            <br />
            3랩 동안 경쟁하고 가장 먼저 체커기를 받으세요.
          </p>
          <div className="race-buttons">
            <button
              className="race-primary"
              onClick={() => {
                if (
                  scene.current &&
                  ['racing', 'countdown'].includes(state.phase)
                ) {
                  setActive(true);
                  setSetup(false);
                  scene.current.model.state.paused = false;
                } else start();
              }}
            >
              {['racing', 'countdown'].includes(state.phase)
                ? '이어서 달리기'
                : '레이스 시작'}
            </button>
            <button onClick={() => setSetup(true)}>폰 핸들 연결 ↗</button>
          </div>
          <p>WASD / 방향키로 운전 · 자동 변속 · 조향 보조</p>
          <div className="race-spec">
            <span>
              <b>3</b> LAPS
            </span>
            <span>
              <b>8</b> DRIVERS
            </span>
            <span>
              <b>GT</b> SPRINT
            </span>
          </div>
        </div>
      )}
      {active && (
        <>
          <div className="race-local-touch">
            <DriveControls
              disabled={state.paused || state.phase !== 'racing'}
              onInput={(input) => {
                touchInput.current = input;
                if (input.steer || input.throttle || input.brake)
                  remote.current = false;
              }}
            />
          </div>
          <div className="race-timing">
            <span>POSITION / LAP</span>
            <b>
              P{state.position} <small>/ 8</small>
            </b>
            <strong>
              LAP {state.lap} / {TOTAL_LAPS}
            </strong>
            <Classification state={state} />
          </div>
          <div className="race-lap-timing">
            <span>
              현재 랩 <b>{clock(state.lapTime)}</b>
            </span>
            <span>
              베스트{' '}
              <b>{state.bestLap === null ? '—' : clock(state.bestLap)}</b>
            </span>
            <span>
              이전 랩{' '}
              <b>
                {state.lastLap === null ? '—' : clock(state.lastLap)}
                {!state.lastLapValid ? ' *' : ''}
              </b>
            </span>
            <span>
              전체 시간 <b>{clock(state.elapsed)}</b>
            </span>
            {!state.lapValid && <em>코스 이탈 · 베스트 기록 제외</em>}
          </div>
          <CircuitMap state={state} />
          <div className="race-progress">
            <i
              style={{ width: (state.distance / RACE_DISTANCE) * 100 + '%' }}
            />
            <span>{(state.distance / 1000).toFixed(2)} / 7.20 KM</span>
          </div>
          <div className="race-dashboard">
            <div className="race-gear">
              <span>GEAR</span>
              <b>{state.gear}</b>
              <small>AUTO</small>
            </div>
            <div className="race-speed">
              <b>{Math.round(state.speed * 3.6)}</b>
              <span>KM/H</span>
            </div>
            <div
              className="race-wheel-mini"
              style={{ transform: `rotate(${state.input.steer * 55}deg)` }}
            >
              ⊕
            </div>
            <Pedals input={state.input} />
          </div>
          <div className="race-rev">
            <i style={{ width: `${(state.rpm / 7500) * 100}%` }} />
            <span>
              {state.rpm} RPM · 코너 권장 {state.cornerSpeed} KM/H
            </span>
          </div>
          <div className="race-key-hint">
            ↑ / W 가속 · ↓ / S 제동 · ← → 조향 · SPACE 일시정지
          </div>
          {state.offroad && state.phase === 'racing' && (
            <div className="race-warning">
              도로 밖입니다 · 속도가 줄어듭니다
            </div>
          )}
          {state.hit > 0 && <div className="race-impact" />}
          {state.phase === 'countdown' && !state.paused && (
            <div className="race-countdown">
              <div className="race-start-lights">
                {[0, 1, 2].map((n) => (
                  <i
                    key={n}
                    className={3 - state.countdown >= n ? 'lit' : ''}
                  />
                ))}
              </div>
              <small>신호가 꺼지면 출발 · {Math.ceil(state.countdown)}</small>
            </div>
          )}
          {state.paused && !setup && state.phase !== 'finished' && (
            <div className="race-modal">
              <span className="race-eyebrow">TAKE A BREATH</span>
              <h2>잠시 정차 중</h2>
              <p>{error || '준비되면 다시 달려보세요.'}</p>
              <button
                className="race-primary"
                onClick={() => {
                  setError('');
                  pause();
                }}
              >
                계속 달리기
              </button>
              <button onClick={start}>PC로 다시 시작</button>
            </div>
          )}
          {state.phase === 'finished' && (
            <div className="race-modal">
              <span className="race-eyebrow">CHEQUERED FLAG / GT SPRINT</span>
              <h2>
                {state.position === 1
                  ? '우승했습니다!'
                  : `${state.position}위로 완주했습니다.`}
              </h2>
              <strong className="race-result">{clock(state.elapsed)}</strong>
              <p>
                3 LAPS · 7.20 km · 충돌 {state.collisions}회<br />
                베스트 랩{' '}
                {state.bestLap === null
                  ? '유효 기록 없음'
                  : clock(state.bestLap)}
              </p>
              <Classification state={state} />
              <button
                className="race-primary"
                onClick={() => {
                  scene.current?.model.start();
                  setError('');
                }}
              >
                다시 달리기 ↗
              </button>
              <button onClick={() => setActive(false)}>메뉴로</button>
            </div>
          )}
        </>
      )}
      {setup && (
        <div className="race-modal race-setup">
          <button
            className="race-close"
            aria-label="연결 창 닫기"
            onClick={() => setSetup(false)}
          >
            ×
          </button>
          <span className="race-eyebrow">PAIR YOUR WHEEL</span>
          <h2>폰이 곧 핸들입니다.</h2>
          <p>폰에서 QR을 열거나 레이싱 화면에 코드를 입력하세요.</p>
          {room ? (
            <div className="race-pair">
              {qr && <img src={qr} alt="폰 컨트롤러 연결 QR" />}
              <div>
                <small>연결 코드</small>
                <strong>{room.code}</strong>
                <span>{connection}</span>
              </div>
            </div>
          ) : null}
          <button
            className="race-primary"
            disabled={busy}
            onClick={() => void create(true)}
          >
            {busy
              ? '코드 생성 중…'
              : room
                ? '새 연결 코드'
                : '연결 코드 만들기'}
          </button>
          <p>① 가로로 잡기　② 기준 자세 설정　③ 폰에서 출발</p>
          <small>앞으로 숙이면 가속 · 몸쪽으로 당기면 브레이크</small>
        </div>
      )}
      {error && !state.paused && (
        <p className="race-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
function Controller() {
  const link = useRef<Link | null>(null),
    wheel = useRef(new WheelControl()),
    gravity = useRef<Gravity | null>(null),
    sensorAt = useRef(0),
    enabled = useRef(false),
    drive = useRef<DriveInput>(idleInput()),
    events = useRef<Packet['events']>([]),
    eventId = useRef(0),
    lastStatus = useRef(0),
    lastStatusStamp = useRef(0);
  const touchMode = useRef(false),
    touchInput = useRef(idleInput());
  const [code, setCode] = useState(''),
    [joined, setJoined] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [connection, setConnection] = useState('연결 대기'),
    [state, setState] = useState<RaceState>(initial),
    [input, setInput] = useState(idleInput()),
    [sensor, setSensor] = useState(false),
    [calibrated, setCalibrated] = useState(false),
    [live, setLive] = useState(false),
    [landscape, setLandscape] = useState(false),
    [sample, setSample] = useState(false);
  const [touch, setTouch] = useState(false);
  const sendEvent = (action: string) => {
    events.current.push({ id: ++eventId.current, action, x: 0, y: 0 });
    events.current = events.current.slice(-12);
  };
  useEffect(() => {
    setCode(new URLSearchParams(location.search).get('code') || '');
    const media = window.matchMedia('(orientation: landscape)');
    const orientation = () => {
      setLandscape(media.matches);
      wheel.current.reset();
      setCalibrated(false);
      drive.current = idleInput();
      sendEvent('hold');
    };
    orientation();
    const change = () => orientation();
    const onSensor = (e: DeviceOrientationEvent) => {
      if (
        touchMode.current ||
        !enabled.current ||
        e.beta === null ||
        e.gamma === null ||
        !Number.isFinite(e.beta) ||
        !Number.isFinite(e.gamma)
      )
        return;
      const now = performance.now(),
        dt = sensorAt.current ? (now - sensorAt.current) / 1000 : 0.016;
      sensorAt.current = now;
      gravity.current = gravityFromOrientation(e.beta, e.gamma);
      drive.current = wheel.current.update(gravity.current, dt);
    };
    const hidden = () => {
      if (document.hidden) {
        drive.current = idleInput();
        sendEvent('hold');
      }
    };
    window.addEventListener('deviceorientation', onSensor);
    window.addEventListener('orientationchange', change);
    screen.orientation?.addEventListener('change', change);
    media.addEventListener('change', change);
    document.addEventListener('visibilitychange', hidden);
    const timer = setInterval(() => {
      const fresh =
        enabled.current &&
        performance.now() - sensorAt.current < 600 &&
        sensorAt.current > 0;
      setSample(fresh);
      if (touchMode.current) {
        drive.current = {
          ...touchInput.current,
          steer: smoothControl(
            drive.current.steer,
            touchInput.current.steer,
            0.04,
          ),
        };
      }
      if (
        (!touchMode.current && (!fresh || !wheel.current.baseline)) ||
        document.hidden
      )
        drive.current = { steer: 0, throttle: 0, brake: 1 };
      setInput({ ...drive.current });
      setLive(lastStatus.current > 0 && Date.now() - lastStatus.current < 3000);
      link.current?.send({
        x: 0,
        y: 0,
        drive: drive.current,
        events: events.current,
        time: Date.now(),
      });
    }, 40);
    return () => {
      clearInterval(timer);
      link.current?.close();
      window.removeEventListener('deviceorientation', onSensor);
      window.removeEventListener('orientationchange', change);
      screen.orientation?.removeEventListener('change', change);
      media.removeEventListener('change', change);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  async function join() {
    setBusy(true);
    setError('');
    try {
      const r = await connectGame('phone', 'racing', code);
      link.current?.close();
      const l = (link.current = new Link(r, 'phone'));
      l.onConnection = setConnection;
      l.onStatus = (s: RaceState & { time?: number }) => {
        if (s.game === 'racing' && s.phase) {
          setState(s);
          if (s.time && s.time !== lastStatusStamp.current) {
            lastStatusStamp.current = s.time;
            lastStatus.current = Date.now();
          }
        }
      };
      setJoined(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useResumeGame('phone', join);
  useGameInterruption(() => {
    touchInput.current = idleInput();
    drive.current = idleInput();
    if (joined) sendEvent('hold');
  });
  async function enable() {
    setError('');
    try {
      if (!window.isSecureContext)
        throw Error('모션 센서는 HTTPS 주소에서 열어야 합니다.');
      if (typeof DeviceOrientationEvent === 'undefined')
        throw Error('센서가 없는 기기입니다. 터치 운전을 선택해 주세요.');
      const O = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<string>;
      };
      if (O.requestPermission && (await O.requestPermission()) !== 'granted')
        throw Error('모션 센서 권한을 허용해 주세요.');
      enabled.current = true;
      setSensor(true);
      setLandscape(innerWidth > innerHeight);
    } catch (e) {
      setError(
        (e as Error).message ||
          '이 브라우저에서 모션 센서를 사용할 수 없습니다.',
      );
    }
  }
  function calibrate() {
    if (!gravity.current || !sample) {
      setError(
        '센서 신호를 기다리고 있습니다. 모션 권한과 브라우저를 확인해 주세요.',
      );
      return;
    }
    if (!landscape || !wheel.current.calibrate(gravity.current)) {
      setError('폰을 가로로 세워 화면을 바라보는 자세로 잡아 주세요.');
      return;
    }
    setCalibrated(true);
    setError('');
    sendEvent('hold');
  }
  return (
    <section className="race-controller">
      <header>
        <span className="race-eyebrow">APEX DRIVE / CONTROLLER</span>
        <span className={'race-connection ' + (live ? 'connected' : '')}>
          {joined
            ? live
              ? connection
              : 'PC 연결 확인 중'
            : '폰을 핸들로 연결'}
        </span>
      </header>
      {!joined ? (
        <div className="race-phone-join">
          <h1>
            두 손으로 잡고,
            <br />
            <em>드라이브.</em>
          </h1>
          <p>PC의 레이싱 화면에서 만든 6자리 코드를 입력하세요.</p>
          <input
            aria-label="6자리 연결 코드"
            placeholder="000000"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button
            className="race-primary"
            disabled={busy || code.length !== 6}
            onClick={join}
          >
            {busy ? '연결 중…' : '핸들 연결 ↗'}
          </button>
        </div>
      ) : (
        <>
          <div className="race-phone-grid">
            <div className="race-phone-controls">
              <fieldset className="drive-mode" aria-label="운전 방식">
                {[false, true].map((value) => (
                  <button
                    key={String(value)}
                    aria-pressed={touch === value}
                    onClick={() => {
                      touchMode.current = value;
                      setTouch(value);
                      touchInput.current = idleInput();
                      drive.current = idleInput();
                      sendEvent('hold');
                      setError('');
                    }}
                  >
                    {value ? '터치 운전' : '모션 운전'}
                  </button>
                ))}
              </fieldset>
              <h2>
                {touch
                  ? '편하게 누르고 달리세요'
                  : !sensor
                    ? '모션 조작 켜기'
                    : !calibrated
                      ? '기준 자세를 잡으세요'
                      : '당신의 손이 핸들입니다'}
              </h2>
              {touch ? (
                <p>
                  방향과 가속 버튼을 함께 누를 수 있어요. 손을 떼면 가속이
                  풀립니다.
                </p>
              ) : (
                <p>
                  폰을 가로로 세워 두 손으로 잡으세요.
                  <br />
                  편하게 잡은 각도가 가속·제동의 중심이 됩니다.
                </p>
              )}
              {!touch &&
                (!sensor ? (
                  <button className="race-primary" onClick={enable}>
                    모션 센서 허용
                  </button>
                ) : (
                  <button onClick={calibrate} disabled={!sample}>
                    {calibrated
                      ? '현재 자세로 다시 맞추기'
                      : sample
                        ? '이 자세를 기준으로 설정'
                        : '센서 신호 기다리는 중…'}
                  </button>
                ))}
              {!touch && sensor && !sample && (
                <small>
                  센서 신호가 없으면 Safari 또는 Chrome에서 열고 모션 권한을
                  확인하세요.
                </small>
              )}
              <div className="race-phone-actions">
                <button
                  className="race-primary"
                  disabled={
                    (!touch && (!calibrated || !sample || !landscape)) || !live
                  }
                  onClick={() => {
                    if (state.phase === 'ready' || state.phase === 'finished')
                      sendEvent('start');
                    else if (state.paused) sendEvent('pause');
                  }}
                >
                  {state.phase === 'ready' || state.phase === 'finished'
                    ? '출발'
                    : state.paused
                      ? '계속 달리기'
                      : '주행 중'}
                </button>
                <button disabled={!live} onClick={() => sendEvent('hold')}>
                  정차
                </button>
              </div>
            </div>
            <div className="race-wheel-panel">
              <div
                className="race-wheel"
                style={{ transform: `rotate(${input.steer * 65}deg)` }}
              >
                <i />
                <b>
                  APEX<small>DRIVE</small>
                </b>
              </div>
              <span className="race-phone-speed">
                {Math.round(state.speed * 3.6)} <small>KM/H</small>
              </span>
              <Pedals input={input} />
            </div>
          </div>
          {touch && (
            <DriveControls
              disabled={!live || state.paused || state.phase !== 'racing'}
              onInput={(value) => {
                touchInput.current = value;
              }}
            />
          )}
          {!touch && (
            <footer className="race-phone-guide">
              <span>↶ 좌우 회전 = 조향</span>
              <span>↗ 윗면 앞으로 = 가속</span>
              <span>↙ 몸쪽으로 = 브레이크</span>
              <small>중립 ±4° · 25°에서 최대 가속·제동 · 조향 최대 35°</small>
            </footer>
          )}
          {!touch && !landscape && (
            <p className="race-rotate">
              ↻ 폰을 가로로 돌려 주세요. 화면 회전 잠금도 해제해 주세요.
            </p>
          )}
        </>
      )}
      {error && (
        <p className="race-phone-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
