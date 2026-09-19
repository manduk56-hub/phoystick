'use client';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api, Link, type Packet } from '@/lib/link';
import { RacingScene } from '@/lib/racing-scene';
import {
  RacingModel,
  WheelControl,
  gravityFromOrientation,
  idleInput,
  TRACK_LENGTH,
  type DriveInput,
  type RaceState,
  type Gravity,
} from '@/lib/racing-model';

const initial = new RacingModel().state;
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
type RacePacket = Packet & { drive?: DriveInput };
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
      p.get('role') === 'phone' ||
        (!p.has('role') &&
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
          {phone ? 'PC 화면' : '폰 컨트롤러'} ↗
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
      if (
        ['INPUT', 'TEXTAREA'].includes(
          (e.target as HTMLElement).tagName,
        )
      )
        return;
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
        s.model.setInput({
          steer:
            (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) -
            (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0),
          throttle: k.has('ArrowUp') || k.has('KeyW') ? 1 : 0,
          brake: k.has('ArrowDown') || k.has('KeyS') ? 1 : 0,
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
  async function create() {
    setBusy(true);
    setError('');
    try {
      const r = await api('create', { game: 'racing' });
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
  return (
    <section
      ref={container}
      className={'race-stage ' + (active ? 'race-active' : '')}
    >
      <canvas ref={canvas} />
      <div className="race-vignette" />
      <header className="race-top">
        <div>
          <span>01 / CANYON RUN</span>
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
            onClick={() => {
              if (document.fullscreenElement)
                document.exitFullscreen().catch(() => {});
              else
                container.current
                  ?.requestFullscreen()
                  .catch(() =>
                    setError('브라우저의 전체화면 기능을 사용해 주세요.'),
                  );
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
          <span className="race-eyebrow">YOUR PHONE. YOUR STEERING WHEEL.</span>
          <h1>
            손끝의 기울기,
            <br />
            <em>질주가 되다.</em>
          </h1>
          <p>
            붉은 협곡을 가로지르는 3km의 도로.
            <br />
            폰을 핸들처럼 잡고, 다음 코너로.
          </p>
          <div className="race-buttons">
            <button className="race-primary" onClick={() => setSetup(true)}>
              폰으로 드라이브 ↗
            </button>
            <button onClick={start}>PC로 먼저 달리기</button>
          </div>
          <div className="race-spec">
            <span>
              <b>3.0</b> KM COURSE
            </span>
            <span>
              <b>220</b> KM/H MAX
            </span>
            <span>
              <b>모션</b> STEERING
            </span>
          </div>
        </div>
      )}
      {active && (
        <>
          <div className="race-timing">
            <span>TIME</span>
            <b>{clock(state.elapsed)}</b>
            <span>충돌 {state.collisions}회</span>
          </div>
          <div className="race-progress">
            <i style={{ width: (state.distance / TRACK_LENGTH) * 100 + '%' }} />
            <span>{(state.distance / 1000).toFixed(2)} / 3.00 KM</span>
          </div>
          <div className="race-dashboard">
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
              {Math.ceil(state.countdown)}
              <small>핸들을 잡고 준비하세요</small>
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
              <span className="race-eyebrow">FINISH / CANYON RUN</span>
              <h2>완주했습니다.</h2>
              <strong className="race-result">{clock(state.elapsed)}</strong>
              <p>3.00 km · 충돌 {state.collisions}회</p>
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
          <button className="race-primary" disabled={busy} onClick={create}>
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
      if (!fresh || !wheel.current.baseline || document.hidden)
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
      const r = await api('join', { code, game: 'racing' });
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
  async function enable() {
    setError('');
    try {
      if (!window.isSecureContext)
        throw Error('모션 센서는 HTTPS 주소에서 열어야 합니다.');
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
              <h2>
                {!sensor
                  ? '모션 조작 켜기'
                  : !calibrated
                    ? '기준 자세를 잡으세요'
                    : '당신의 손이 핸들입니다'}
              </h2>
              <p>
                폰을 가로로 세워 두 손으로 잡으세요.
                <br />
                편하게 잡은 각도가 가속·제동의 중심이 됩니다.
              </p>
              {!sensor ? (
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
              )}
              {sensor && !sample && (
                <small>
                  센서 신호가 없으면 Safari 또는 Chrome에서 열고 모션 권한을
                  확인하세요.
                </small>
              )}
              <div className="race-phone-actions">
                <button
                  className="race-primary"
                  disabled={!calibrated || !sample || !landscape || !live}
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
          <footer className="race-phone-guide">
            <span>↶ 좌우 회전 = 조향</span>
            <span>↗ 윗면 앞으로 = 가속</span>
            <span>↙ 몸쪽으로 = 브레이크</span>
            <small>중립 ±4° · 25°에서 최대 가속·제동 · 조향 최대 35°</small>
          </footer>
          {!landscape && (
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
