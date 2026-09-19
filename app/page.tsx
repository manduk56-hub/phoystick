'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  Smartphone,
  Monitor,
  ArrowUpRight,
  RotateCcw,
  Volume2,
  Shield,
  Pause,
  ChevronRight,
  Link2,
  ScanLine,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Game, type HUD } from '@/lib/game';
import { AimStabilizer } from '@/lib/aim-stabilizer';
import {
  CALIBRATION_TARGETS,
  mapAim,
  validCalibration,
  type Angle,
} from '@/lib/aim';
import { api, Link, type Packet } from '@/lib/link';
import * as T from 'three';
import { RELOAD_NAMES, reloadPose } from '@/lib/reload-motion';
import { Progress } from '@/components/ui/progress';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
const empty: HUD = {
  health: 100,
  ammo: 11,
  chamber: true,
  reload: 0,
  score: 0,
  kills: 0,
  wave: 1,
  state: 'ready',
  hit: '',
};
const reloadLabels = ['탄창 빼기', '새 탄창 삽입', '슬라이드 당기기'];
function Weapon({
  reload,
  flash,
  motion = 0,
  progress = 0,
  chamber = true,
}: {
  reload: number;
  flash: boolean;
  motion?: number;
  progress?: number;
  chamber?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef({ reload, flash, motion, progress, chamber });
  state.current = { reload, flash, motion, progress, chamber };
  useEffect(() => {
    const c = ref.current!;
    let r: T.WebGLRenderer;
    try {
      r = new T.WebGLRenderer({ canvas: c, alpha: true, antialias: true });
    } catch {
      return;
    }
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new T.Scene(),
      cam = new T.PerspectiveCamera(35, 2, 0.1, 30);
    cam.position.set(0, 0.1, 3);
    scene.add(new T.HemisphereLight(0xe2f4ff, 0x25343a, 3));
    const light = new T.DirectionalLight(0xffffff, 4);
    light.position.set(-2, 4, 4);
    scene.add(light);
    const gun = new T.Group();
    scene.add(gun);
    const box = (
      x: number,
      y: number,
      w: number,
      h: number,
      d: number,
      color: number,
    ) => {
      const m = new T.Mesh(
        new T.BoxGeometry(w, h, d),
        new T.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 }),
      );
      m.position.set(x, y, 0);
      gun.add(m);
      return m;
    };
    const slide = box(-0.1, 0.2, 1.25, 0.25, 0.22, 0x65727b);
    box(-0.08, 0.05, 1.23, 0.12, 0.2, 0x242d32);
    const grip = box(0.34, -0.23, 0.25, 0.52, 0.23, 0x1a2328);
    grip.rotation.z = 0.22;
    const mag = box(0.34, -0.3, 0.2, 0.46, 0.19, 0x8b9293);
    box(-0.58, 0.36, 0.07, 0.055, 0.06, 0xd9fd62);
    box(0.32, 0.36, 0.12, 0.05, 0.08, 0x89968d);
    for (let i = 0; i < 7; i++)
      box(0.08 + i * 0.055, 0.2, 0.018, 0.19, 0.225, 0x27333a);
    const guard = new T.Mesh(
      new T.TorusGeometry(0.15, 0.018, 6, 20, Math.PI * 1.6),
      new T.MeshStandardMaterial({ color: 0x71808a }),
    );
    guard.position.set(0.02, -0.13, 0);
    gun.add(guard);
    const hand = new T.Group();
    const glove = new T.Mesh(
      new T.BoxGeometry(0.28, 0.2, 0.3),
      new T.MeshStandardMaterial({ color: 0x54666b, roughness: 0.8 }),
    );
    hand.add(glove);
    for (let i = 0; i < 3; i++) {
      const finger = new T.Mesh(
        new T.BoxGeometry(0.06, 0.08, 0.32),
        new T.MeshStandardMaterial({ color: 0x90a29a, roughness: 0.8 }),
      );
      finger.position.set(-0.09 + i * 0.09, 0.12, 0);
      hand.add(finger);
    }
    gun.add(hand);
    gun.rotation.y = -0.18;
    let id = 0;
    const ro = new ResizeObserver(() => {
      r.setSize(c.clientWidth, c.clientHeight, false);
      cam.aspect = c.clientWidth / c.clientHeight;
      cam.updateProjectionMatrix();
    });
    ro.observe(c);
    const loop = () => {
      const s = state.current;
      const pose = reloadPose(s.reload, s.motion, s.progress);
      slide.position.x = T.MathUtils.lerp(
        slide.position.x,
        -0.1 +
          Math.max(
            pose.pull * 0.27,
            s.flash || (!s.chamber && s.motion !== 3) ? 0.12 : 0,
          ),
        0.35,
      );
      mag.position.y = T.MathUtils.lerp(
        mag.position.y,
        -0.3 - pose.drop * 0.65,
        0.3,
      );
      mag.position.x = 0.34 + pose.drop * 0.12;
      mag.rotation.z = 0.22 + pose.drop * 0.15;
      gun.rotation.z = (s.flash ? -0.07 : 0) + pose.tilt * -0.1;
      gun.position.y = pose.tilt * 0.13;
      hand.visible = pose.hand > 0;
      hand.scale.setScalar(pose.hand);
      hand.position.set(
        pose.rack ? 0.15 + pose.pull * 0.27 : mag.position.x + 0.05,
        pose.rack ? 0.36 : mag.position.y - 0.05,
        0.06,
      );
      r.render(scene, cam);
      id = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.geometry.dispose();
          (o.material as T.Material).dispose();
        }
      });
      r.dispose();
    };
  }, []);
  return (
    <canvas
      className="weapon-canvas"
      ref={ref}
      aria-label="권총의 탄창과 슬라이드 작동 모습"
    />
  );
}
export default function Home() {
  const [role, setRole] = useState<'host' | 'phone'>('host');
  const [ready, setReady] = useState(false);
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
    <main className={'shell ' + (role === 'phone' ? 'phone-shell' : '')}>
      <header>
        <a className="brand" href="/">
          ◈ <b>DEAD SIGNAL</b>
        </a>
        <a className="quiet" href="/fishing">
          낚시 · STILLWATER ↗
        </a>
        <a className="quiet" href="/racing">
          레이싱 · APEX DRIVE ↗
        </a>
        <button
          className="quiet role-toggle"
          onClick={() => setRole(role === 'host' ? 'phone' : 'host')}
        >
          {role === 'host' ? <Smartphone size={16} /> : <Monitor size={16} />}{' '}
          {role === 'host' ? '폰 컨트롤러' : 'PC 게임 화면'}
        </button>
      </header>
      {ready && (role === 'host' ? <Host /> : <Controller />)}
      <footer>
        <span>
          DEAD SIGNAL <i>/</i> PROTOTYPE 01
        </span>
        <span>살아남는 건, 당신의 손에.</span>
      </footer>
    </main>
  );
}
function Host() {
  const [hud, setHud] = useState<HUD>(empty),
    [room, setRoom] = useState<any>(null),
    [connection, setConnection] = useState('폰 연결 대기'),
    [error, setError] = useState(''),
    [qr, setQr] = useState(''),
    [busy, setBusy] = useState(false),
    [showSetup, setShowSetup] = useState(false),
    [calibrationStep, setCalibrationStep] = useState<number | null>(null),
    [fullscreen, setFullscreen] = useState(false),
    [mode, setMode] = useState<'mouse' | 'phone'>('mouse');
  const arena = useRef<HTMLElement>(null);
  const calibrating = mode === 'phone' && calibrationStep !== null;
  const expanded = calibrating || (hud.state !== 'ready' && !showSetup);
  const canvas = useRef<HTMLCanvasElement>(null),
    game = useRef<Game | null>(null),
    link = useRef<Link | null>(null),
    cross = useRef<HTMLDivElement>(null),
    lastEvent = useRef(0),
    hudRef = useRef(hud),
    modeRef = useRef(mode);
  hudRef.current = hud;
  modeRef.current = mode;
  useEffect(() => {
    if (hud.state === 'playing') setShowSetup(false);
  }, [hud.state]);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);
  useEffect(() => {
    const update = () =>
      setFullscreen(document.fullscreenElement === arena.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (arena.current?.requestFullscreen)
        await arena.current.requestFullscreen();
      else
        setError(
          '이 브라우저에서는 전체화면을 지원하지 않습니다. 브라우저 창을 최대화해 주세요.',
        );
    } catch {
      setError('전체화면을 열지 못했습니다. 브라우저 창을 최대화해 주세요.');
    }
  }
  useEffect(() => {
    let g: Game;
    try {
      g = new Game(canvas.current!, setHud);
      game.current = g;
    } catch {
      setError(
        '3D 화면을 열 수 없습니다. 하드웨어 가속이 가능한 브라우저로 접속하세요.',
      );
      return;
    }
    g.onShot = (hit) => {
      if (cross.current) {
        cross.current.classList.add(hit ? 'hit' : 'shot');
        setTimeout(() => cross.current?.classList.remove('hit', 'shot'), 120);
      }
    };
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'KeyR') g.action('reload');
      if (e.code === 'Escape' || e.code === 'KeyP') g.pause();
      if (e.code === 'Space') {
        e.preventDefault();
        g.action('fire');
      }
    };
    window.addEventListener('keydown', key);
    const timer = setInterval(() => {
      link.current?.send({ ...hudRef.current, time: Date.now() });
      if (
        modeRef.current === 'phone' &&
        link.current &&
        Date.now() - link.current.lastReceive > 6000 &&
        g.hud.state === 'playing'
      ) {
        g.pause();
        setError('폰 연결이 끊겨 일시정지했습니다. 다시 연결되면 계속하세요.');
      }
    }, 250);
    const context = (document as any).modelContext,
      lifecycle = new AbortController();
    if (context?.registerTool)
      Promise.resolve(
        context.registerTool(
          {
            name: 'control_survival_game',
            description: 'Start or pause the visible zombie survival game.',
            inputSchema: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['start', 'pause'] },
              },
              required: ['action'],
              additionalProperties: false,
            },
            execute: (v: any) => {
              if (!['start', 'pause'].includes(v.action))
                throw Error('Invalid action');
              g.action(v.action);
              return { ...g.hud };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    return () => {
      g.dispose();
      link.current?.close();
      clearInterval(timer);
      window.removeEventListener('keydown', key);
      lifecycle.abort();
    };
  }, []);
  async function create() {
    setBusy(true);
    setError('');
    try {
      const r = await api('create');
      link.current?.close();
      setRoom(r);
      lastEvent.current = 0;
      const l = (link.current = new Link(r, 'host'));
      l.onConnection = setConnection;
      l.onInput = (p: Packet) => {
        if (modeRef.current !== 'phone') return;
        const calibrating =
          Number.isInteger(p.calibration) &&
          p.calibration! >= 0 &&
          p.calibration! < 5;
        setCalibrationStep(calibrating ? p.calibration! : null);
        if (calibrating && game.current?.hud.state === 'playing')
          game.current.pause();
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
        game.current?.setAim(p.x, p.y);
        position(p.x, p.y);
        for (const e of p.events || []) {
          if (e.id > lastEvent.current) {
            lastEvent.current = e.id;
            if (!calibrating) game.current?.action(e.action, e.x, e.y);
          }
        }
      };
      const url = new URL(location.href);
      url.search = '?role=phone&code=' + r.code;
      setQr(
        await QRCode.toDataURL(url.href, {
          margin: 1,
          width: 144,
          color: { dark: '#101b20', light: '#edf6e5' },
        }),
      );
      setConnection('폰 연결 대기');
      setMode('phone');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function position(x: number, y: number) {
    if (cross.current) {
      cross.current.style.left = x * 100 + '%';
      cross.current.style.top = y * 100 + '%';
    }
  }
  function mouse(e: React.PointerEvent) {
    if (mode !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width,
      y = (e.clientY - r.top) / r.height;
    game.current?.setAim(x, y);
    position(x, y);
  }
  return (
    <>
      <div className="topline">
        <div>
          <span className="eyebrow">SURVIVAL / 격리 구역 07</span>
          <h1 className="game-title">
            LAST LINE<span>마지막 방어선</span>
          </h1>
        </div>
        <div className="live">
          <span
            className={'dot ' + (connection.includes('직접') ? 'online' : '')}
          />
          {mode === 'mouse' ? '마우스 모드' : connection}
        </div>
      </div>
      <div className="host-grid">
        <section
          ref={arena}
          className={'arena' + (expanded ? ' play-expanded' : '')}
          onPointerMove={mouse}
          onPointerDown={(e) => {
            if (
              mode === 'mouse' &&
              (e.target === canvas.current || e.target === e.currentTarget)
            )
              game.current?.action('fire');
          }}
        >
          <canvas ref={canvas} className="game-canvas" />
          {calibrating && (
            <div className="screen-calibration" role="status">
              <div
                className="calibration-instructions"
                style={{
                  top: calibrationStep === 0 ? '60%' : '50%',
                  transform:
                    calibrationStep === 0
                      ? 'translateX(-50%)'
                      : 'translate(-50%,-50%)',
                }}
              >
                <span>조준 보정 {calibrationStep! + 1} / 5</span>
                <h2>{CALIBRATION_TARGETS[calibrationStep!].name}</h2>
                <p>파란 원의 중심을 가리키고 폰에서 저장하세요.</p>
                <button
                  className="quiet"
                  onClick={() => {
                    setCalibrationStep(null);
                    setMode('mouse');
                  }}
                >
                  보정 닫기 · 마우스로 전환
                </button>
              </div>
              {CALIBRATION_TARGETS.map((target, i) => (
                <div
                  key={i}
                  className={
                    'calibration-target ' +
                    (i === calibrationStep
                      ? 'active'
                      : i < calibrationStep!
                        ? 'done'
                        : '')
                  }
                  style={{
                    left: target.x * 100 + '%',
                    top: target.y * 100 + '%',
                  }}
                >
                  <span>{i === 0 ? '＋' : i}</span>
                </div>
              ))}
            </div>
          )}
          <div className="vignette" />
          <div className="hud-top">
            <div>
              <span className="eyebrow">WAVE</span>
              <strong>{String(hud.wave).padStart(2, '0')}</strong>
            </div>
            <div className="health">
              <span>
                <Shield size={14} /> 체력 <b>{hud.health}</b>
              </span>
              <div className="health-track">
                <div style={{ width: hud.health + '%' }} />
              </div>
            </div>
            <div className="score">
              <span className="eyebrow">SCORE</span>
              <strong>{String(hud.score).padStart(6, '0')}</strong>
            </div>
          </div>
          <div ref={cross} className="crosshair">
            <Crosshair size={38} />
          </div>
          {hud.state !== 'playing' && !calibrating && (
            <div className="overlay">
              <span className="eyebrow">
                {hud.state === 'over'
                  ? 'SIGNAL LOST'
                  : hud.state === 'paused'
                    ? 'HOLD POSITION'
                    : 'THEY ARE GETTING CLOSER'}
              </span>
              <h2>
                {hud.state === 'over'
                  ? '방어선이 무너졌다.'
                  : hud.state === 'paused'
                    ? '잠시 숨을 고르세요.'
                    : '다가오기 전에, 쏴라.'}
              </h2>
              <p>
                {hud.state === 'over'
                  ? `${hud.kills}마리 처치 · ${hud.wave} 웨이브 · ${hud.score}점`
                  : hud.state === 'paused'
                    ? '준비되면 전투를 이어가세요.'
                    : '폰으로 조준하거나 마우스로 바로 시작하세요.\n몬스터가 도착하면 체력이 20씩 줄어듭니다.'}
              </p>
              <button
                disabled={
                  (mode === 'phone' && !connection.includes('연결')) ||
                  (mode === 'phone' && connection === '폰 연결 대기')
                }
                onClick={() =>
                  hud.state === 'paused'
                    ? game.current?.pause()
                    : game.current?.start()
                }
              >
                {hud.state === 'paused'
                  ? '전투 계속'
                  : hud.state === 'over'
                    ? '다시 도전'
                    : '전투 시작'}{' '}
                <ArrowUpRight size={18} />
              </button>
              {mode === 'phone' && (
                <button
                  className="text-button"
                  onClick={() => setMode('mouse')}
                >
                  마우스로 먼저 플레이
                </button>
              )}
              {hud.state !== 'ready' && !showSetup && (
                <button
                  className="text-button"
                  onClick={async () => {
                    if (document.fullscreenElement)
                      await document.exitFullscreen().catch(() => {});
                    setShowSetup(true);
                  }}
                >
                  폰 연결 · 조작 설정
                </button>
              )}
            </div>
          )}
          <div className="hud-bottom">
            <div className="weapon-label">
              <span className="eyebrow">SIDEARM / SEMI-AUTO</span>
              <b>P-12 SERVICE PISTOL</b>
              <span>
                {hud.reloadMotion
                  ? RELOAD_NAMES[hud.reloadMotion]
                  : hud.reload
                    ? reloadLabels[hud.reload]
                    : hud.chamber
                      ? '약실 장전됨'
                      : '약실 비어 있음 · 장전 필요'}
              </span>
            </div>
            <div className="ammo">
              <strong>
                {String(hud.ammo + (hud.chamber ? 1 : 0)).padStart(2, '0')}
              </strong>
              <span>
                / 12+1
                <br />
                AMMO
              </span>
            </div>
          </div>
          <div className="hit-text">{hud.hit}</div>
          <button
            className="fullscreen-button quiet"
            aria-label={fullscreen ? '전체화면 종료' : '전체화면'}
            title={fullscreen ? '전체화면 종료' : '브라우저 전체화면'}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          {expanded && (
            <div className="play-shortcuts">
              클릭 / 폰 동작 : 발사 <span>R : 장전</span>
              <span>ESC : 일시정지</span>
            </div>
          )}
          {expanded && error && (
            <div className="play-error" role="alert">
              {error}
            </div>
          )}
          {!!hud.reloadMotion && (
            <div className="reload-status">
              <span>
                {RELOAD_NAMES[hud.reloadMotion]} <b>{hud.reloadMotion} / 3</b>
              </span>
              <Progress
                value={(hud.reloadProgress || 0) * 100}
                aria-label="장전 동작 진행률"
              />
            </div>
          )}
          {hud.state === 'playing' && (
            <button
              className="pause quiet"
              aria-label="일시정지"
              onClick={() => game.current?.pause()}
            >
              <Pause size={18} />
            </button>
          )}
        </section>
        <aside className="console">
          <div className="section-label">
            <Smartphone size={19} />
            <span>CONTROLLER LINK</span>
            <span className="tiny-tag">01</span>
          </div>
          <h2>
            당신의 폰이
            <br />
            컨트롤러가 됩니다.
          </h2>
          <p>
            같은 사이트를 폰으로 열고
            <br />
            아래 코드를 입력하세요.
          </p>
          {room ? (
            <>
              <div className="pair-box">
                <div>
                  <span>연결 코드</span>
                  <strong>
                    {room.code.slice(0, 3)} {room.code.slice(3)}
                  </strong>
                  <small>2시간 유효 · 한 대 연결</small>
                </div>
                {qr && (
                  <img src={qr} alt="폰 연결 QR 코드" width={88} height={88} />
                )}
              </div>
              <button className="text-button" disabled={busy} onClick={create}>
                <RotateCcw size={14} /> 새 연결 코드
              </button>
            </>
          ) : (
            <button className="pair-button" disabled={busy} onClick={create}>
              <Link2 size={17} />
              {busy ? '연결 준비 중…' : '폰 연결 코드 만들기'}
            </button>
          )}
          <div className="divider" />
          <div className="control-note">
            <span>01</span>
            <div>
              <b>폰을 가로로 잡기</b>
              <p>한쪽 끝을 총구처럼 모니터로 향하세요.</p>
            </div>
          </div>
          <div className="control-note">
            <span>02</span>
            <div>
              <b>중앙과 모서리 보정</b>
              <p>폰 화면의 안내에 따라 조준을 맞추세요.</p>
            </div>
          </div>
          <div className="control-note">
            <span>03</span>
            <div>
              <b>짧게 튕겨 발사</b>
              <p>총구를 위로 튕기거나 발사 버튼을 누르세요.</p>
            </div>
          </div>
          <div className="mode-buttons">
            <button
              className={mode === 'mouse' ? 'selected' : ''}
              onClick={() => setMode('mouse')}
            >
              마우스
            </button>
            <button
              className={mode === 'phone' ? 'selected' : ''}
              onClick={() => (room ? setMode('phone') : create())}
            >
              스마트폰
            </button>
          </div>
        </aside>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="underbar">
        <span>
          <Crosshair size={16} /> 마우스 이동 · 클릭 발사
        </span>
        <button
          className="quiet"
          onClick={() => game.current?.action('reload')}
        >
          <b>R</b>{' '}
          {hud.reloadMotion
            ? RELOAD_NAMES[hud.reloadMotion]
            : reloadLabels[hud.reload]}
        </button>
        <span>
          <b>ESC</b> 일시정지
        </span>
        <span className="sound-note">
          <Volume2 size={15} /> 사운드 ON
        </span>
      </div>
      <div className="mission-note">
        <b>MISSION BRIEF</b>
        <span>
          헤드샷은 더 강한 피해와 보너스 점수. 웨이브 완료 시 체력 +10.
        </span>
        <span>무한 예비 탄창 / 수동 3단계 장전</span>
      </div>
    </>
  );
}
function Controller() {
  const [code, setCode] = useState(''),
    [connected, setConnected] = useState(false),
    [status, setStatus] = useState('코드 입력'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [hud, setHud] = useState<HUD>(empty),
    [sensor, setSensor] = useState(false),
    [step, setStep] = useState(0),
    [flash, setFlash] = useState(false),
    [sensitivity, setSensitivity] = useState(135);
  const link = useRef<Link | null>(null),
    data = useRef<Packet>({ x: 0.5, y: 0.5, events: [], time: 0 }),
    seq = useRef(0),
    angles = useRef({ yaw: 0, pitch: 0 }),
    calibrationPoints = useRef<Angle[]>([]),
    aimFilter = useRef(new AimStabilizer()),
    rawPoint = useRef({ x: 0.5, y: 0.5 }),
    sensorTime = useRef(0),
    samples = useRef<{ x: number; y: number; rawY: number; t: number }[]>([]),
    motionCleanup = useRef<() => void>(() => {}),
    stepRef = useRef(step),
    armed = useRef(true),
    lastFire = useRef(0),
    threshold = useRef(sensitivity),
    hudRef = useRef(hud);
  stepRef.current = step;
  data.current.calibration = sensor && step < 5 ? step : null;
  threshold.current = sensitivity;
  hudRef.current = hud;
  useEffect(() => {
    setCode(new URLSearchParams(location.search).get('code') || '');
    return () => {
      link.current?.close();
      motionCleanup.current();
    };
  }, []);
  function sendAction(action: string, point?: { x: number; y: number }) {
    if (action === 'fire' && stepRef.current < 5) return;
    const p = point || data.current;
    data.current.events.push({ id: ++seq.current, action, x: p.x, y: p.y });
    data.current.events = data.current.events.slice(-24);
    data.current.time = Date.now();
    link.current?.send(data.current);
    if (
      action === 'fire' &&
      hudRef.current.state === 'playing' &&
      hudRef.current.chamber &&
      !hudRef.current.reloadMotion &&
      !hudRef.current.reload
    ) {
      navigator.vibrate?.(30);
      setFlash(true);
      setTimeout(() => setFlash(false), 90);
    }
  }
  async function join() {
    setBusy(true);
    setError('');
    try {
      const r = await api('join', { code });
      const l = (link.current = new Link(r, 'phone'));
      l.onConnection = setStatus;
      l.onStatus = (v: HUD) => setHud(v);
      setConnected(true);
      setStatus('PC와 연결 중');
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
          '센서 사용에는 HTTPS 접속이 필요합니다. 배포된 사이트 주소로 접속하세요.',
        );
      const O = DeviceOrientationEvent as any,
        M = DeviceMotionEvent as any;
      const permissions = await Promise.all([
        O.requestPermission
          ? O.requestPermission()
          : Promise.resolve('granted'),
        M.requestPermission
          ? M.requestPermission()
          : Promise.resolve('granted'),
      ]);
      if (permissions.some((x) => x !== 'granted'))
        throw Error('동작 센서 권한을 허용해야 합니다.');
      motionCleanup.current();
      let received = false;
      const orientation = (e: DeviceOrientationEvent) => {
        if (e.alpha == null || e.beta == null || e.gamma == null) return;
        received = true;
        sensorTime.current = performance.now();
        const a = (e.alpha * Math.PI) / 180,
          b = (e.beta * Math.PI) / 180;
        const vx = -Math.sin(a) * Math.cos(b),
          vy = Math.cos(a) * Math.cos(b),
          vz = Math.sin(b);
        angles.current = {
          yaw: (Math.atan2(vy, vx) * 180) / Math.PI,
          pitch: (Math.asin(Math.max(-1, Math.min(1, vz))) * 180) / Math.PI,
        };
        if (stepRef.current >= 5) {
          const point = mapAim(angles.current, calibrationPoints.current);
          const now = performance.now();
          rawPoint.current = point;
          const stable = aimFilter.current.update(point, now);
          data.current.x = stable.x;
          data.current.y = stable.y;
          samples.current.push({
            x: data.current.x,
            y: data.current.y,
            rawY: point.y,
            t: now,
          });
          samples.current = samples.current.filter((s) => now - s.t < 250);
        }
      };
      const motion = (e: DeviceMotionEvent) => {
        const speed = Math.abs(e.rotationRate?.beta || 0),
          now = performance.now();
        if (speed < 35) armed.current = true;
        const old = samples.current.find((s) => now - s.t < 160);
        if (
          stepRef.current >= 5 &&
          armed.current &&
          speed > threshold.current &&
          now - lastFire.current > 350 &&
          old &&
          rawPoint.current.y < old.rawY - 0.025
        ) {
          armed.current = false;
          lastFire.current = now;
          aimFilter.current.hold(old, now);
          data.current.x = old.x;
          data.current.y = old.y;
          sendAction('fire', old);
        }
      };
      window.addEventListener('deviceorientation', orientation);
      window.addEventListener('devicemotion', motion);
      const interval = setInterval(() => {
        data.current.time = Date.now();
        link.current?.send(data.current);
      }, 33);
      const timeout = setTimeout(() => {
        if (!received) {
          setError(
            '센서 값을 받지 못했습니다. 외부 브라우저로 열거나 터치 모드를 사용하세요.',
          );
          setSensor(false);
        }
      }, 4000);
      motionCleanup.current = () => {
        window.removeEventListener('deviceorientation', orientation);
        window.removeEventListener('devicemotion', motion);
        clearInterval(interval);
        clearTimeout(timeout);
      };
      calibrationPoints.current = [];
      samples.current = [];
      aimFilter.current.reset();
      setSensor(true);
      setStep(0);
      setStatus('중앙 보정부터 시작하세요.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function calibrate() {
    if (!sensorTime.current || performance.now() - sensorTime.current > 600) {
      setError(
        '센서 값을 기다리는 중입니다. 폰을 조금 움직인 뒤 다시 저장하세요.',
      );
      return;
    }
    const points = step === 0 ? [] : calibrationPoints.current.slice(0, step);
    points.push({ ...angles.current });
    if (step === 4 && !validCalibration(points)) {
      setError(
        '모서리가 겹치거나 순서가 맞지 않습니다. 중앙부터 파란 원을 다시 따라가 주세요.',
      );
      calibrationPoints.current = [];
      setStep(0);
      return;
    }
    calibrationPoints.current = points;
    samples.current = [];
    aimFilter.current.reset();
    setStep(step + 1);
    setError('');
    if (step === 4) setStatus('네 모서리 보정 완료');
  }
  return (
    <section className="controller">
      <div className="controller-heading">
        <span className="eyebrow">PERSONAL MOTION CONTROLLER</span>
        <div className="live">
          <span className="dot online" />
          {status}
        </div>
      </div>
      {!connected ? (
        <div className="join-panel">
          <div className="phone-icon">
            <ScanLine size={42} />
          </div>
          <h1>방어선에 합류하세요.</h1>
          <p>PC 화면에 표시된 6자리 코드를 입력하세요.</p>
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label="PC 연결 코드"
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} className="otp-slot" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <button disabled={busy || code.length !== 6} onClick={join}>
            {busy ? '연결 중…' : 'PC에 연결'} <ArrowUpRight size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="phone-stats">
            <span>
              WAVE <b>{hud.wave}</b>
            </span>
            <span>
              체력 <b>{hud.health}</b>
            </span>
            <span>
              탄약 <b>{hud.ammo + (hud.chamber ? 1 : 0)}</b>
            </span>
          </div>
          {step < 5 ? (
            <div className="calibration">
              <h2>
                {!sensor
                  ? '폰을 가로로 잡으세요.'
                  : `PC의 ${CALIBRATION_TARGETS[step].name} 파란 원을 가리키세요.`}
              </h2>
              <p>
                폰의 충전 단자 반대쪽 끝을 총구로 사용합니다.
                <br />
                PC의 파란 원 중심을 가리키세요. 중앙 → 왼쪽 위 → 오른쪽 위 →
                오른쪽 아래 → 왼쪽 아래 순서입니다. 같은 자리를 유지해 주세요.
              </p>
              <button onClick={() => (sensor ? calibrate() : enable())}>
                {sensor
                  ? `${CALIBRATION_TARGETS[step].name} 저장 (${step + 1}/5)`
                  : '센서 허용하고 보정 시작'}{' '}
                <Crosshair size={18} />
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setStep(5);
                  setSensor(false);
                  setStatus('터치 조준 모드');
                  motionCleanup.current();
                  const timer = setInterval(() => {
                    data.current.time = Date.now();
                    link.current?.send(data.current);
                  }, 50);
                  motionCleanup.current = () => clearInterval(timer);
                }}
              >
                센서 없이 터치로 조작
              </button>
            </div>
          ) : (
            <>
              <div
                className={'phone-weapon ' + (flash ? 'firing' : '')}
                onPointerMove={(e) => {
                  if (!sensor && e.buttons) {
                    const r = e.currentTarget.getBoundingClientRect();
                    data.current.x = (e.clientX - r.left) / r.width;
                    data.current.y = (e.clientY - r.top) / r.height;
                  }
                }}
                onPointerDown={(e) => {
                  if (!sensor) {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const r = e.currentTarget.getBoundingClientRect();
                    data.current.x = (e.clientX - r.left) / r.width;
                    data.current.y = (e.clientY - r.top) / r.height;
                  }
                }}
              >
                <div className="weapon-caption">
                  <span>P-12 / SERVICE PISTOL</span>
                  <span>
                    {sensor
                      ? '← 총구 · 짧게 위로 튕겨 발사'
                      : '화면을 드래그해 조준'}
                  </span>
                </div>
                <Weapon
                  reload={hud.reload}
                  flash={flash}
                  motion={hud.reloadMotion}
                  progress={hud.reloadProgress}
                  chamber={hud.chamber}
                />
                <div className="weapon-caption">
                  <span>
                    {hud.chamber ? '● 약실 장전' : '○ 약실 비어 있음'}
                  </span>
                  <span>{hud.ammo} ROUNDS IN MAGAZINE</span>
                </div>
              </div>
              <div className="trigger-row">
                <button
                  className="reload-button"
                  onClick={() => sendAction('reload')}
                  disabled={!!hud.reloadMotion}
                >
                  <RotateCcw size={20} />
                  {hud.reloadMotion
                    ? RELOAD_NAMES[hud.reloadMotion]
                    : reloadLabels[hud.reload]}
                  <small>{hud.reload + 1} / 3</small>
                </button>
                <button
                  className="fire-button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    sendAction('fire');
                  }}
                >
                  <Crosshair size={26} />
                  발사
                </button>
              </div>
              <div className="controller-tools">
                <button
                  className="quiet"
                  onClick={() => {
                    setStep(0);
                    data.current.x = 0.5;
                    data.current.y = 0.5;
                  }}
                >
                  <Crosshair size={16} />
                  다시 보정
                </button>
                <button
                  className="quiet"
                  onClick={() =>
                    sendAction(
                      hud.state === 'ready' || hud.state === 'over'
                        ? 'start'
                        : 'pause',
                    )
                  }
                >
                  {hud.state === 'playing'
                    ? '일시정지'
                    : hud.state === 'paused'
                      ? '계속하기'
                      : '전투 시작'}
                </button>
              </div>
              {sensor && (
                <label className="sensitivity">
                  튕기기 감도
                  <NativeSelect
                    value={sensitivity}
                    onChange={(e) => setSensitivity(Number(e.target.value))}
                  >
                    <NativeSelectOption value={90}>민감</NativeSelectOption>
                    <NativeSelectOption value={135}>보통</NativeSelectOption>
                    <NativeSelectOption value={190}>강하게</NativeSelectOption>
                  </NativeSelect>
                </label>
              )}
              <p className="fine-print">
                진동은 지원 기기에서만 작동합니다. 폰을 작게 튕겨 주세요.
              </p>
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
