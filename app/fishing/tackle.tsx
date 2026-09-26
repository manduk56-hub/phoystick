'use client';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import {
  spots,
  rigs,
  baits,
  equipment,
  species,
  hooks,
  leaders,
  type FishingState,
} from '@/lib/fishing-model';
type Action = (action: string, value?: number) => void;
export function FishingRange({
  label,
  value,
  min = 0.1,
  max = 1,
  step = 0.05,
  display,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  display: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="fishing-range">
      <span>
        {label}
        <b>{display}</b>
      </span>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
    </label>
  );
}
export function FishingRigControls({
  state: s,
  action,
}: {
  state: FishingState;
  action: Action;
}) {
  return (
    <div className="rig-live-controls">
      <FishingRange
        label="드랙 브레이크"
        value={s.drag}
        display={`${Math.round(s.drag * 100)}% · ${(equipment[s.gear].reel * s.drag).toFixed(1)} kg`}
        disabled={s.paused}
        onChange={(v) => action('drag', v)}
      />
      <FishingRange
        label="릴 감기 속도"
        value={s.speed}
        display={`${Math.round(s.speed * 100)}%`}
        disabled={s.paused}
        onChange={(v) => action('speed', v)}
      />
      {s.phase === 'fighting' && (
        <FishingRange
          label="낚싯대 각도"
          value={s.rod}
          min={0}
          display={`${Math.round(20 + s.rod * 60)}°`}
          disabled={s.paused}
          onChange={(v) => action('rod', v)}
        />
      )}
    </div>
  );
}
export default function Tackle({
  state: s,
  action,
  close,
}: {
  state: FishingState;
  action: Action;
  close: () => void;
}) {
  const [power, setPower] = useState(0.65);
  const idle = ['ready', 'caught', 'escaped'].includes(s.phase),
    locked = !idle || s.paused;
  const gear = equipment[s.gear];
  return (
    <aside className="tackle-panel" aria-label="낚시 수첩과 채비">
      <div className="tackle-heading">
        <div>
          <span>FIELD NOTEBOOK</span>
          <h2>낚시 수첩</h2>
        </div>
        <button className="quiet" aria-label="낚시 수첩 닫기" onClick={close}>
          ×
        </button>
      </div>
      <div className="angler-wallet">
        <span>
          LV. {1 + Math.floor(s.xp / 100)} <small>{s.xp % 100} / 100 XP</small>
        </span>
        <b>
          {s.silver} <small>실버</small>
        </b>
      </div>
      <Tabs defaultValue="rig">
        <TabsList aria-label="낚시 수첩 메뉴">
          <TabsTrigger value="rig">채비</TabsTrigger>
          <TabsTrigger value="fish">어종</TabsTrigger>
          <TabsTrigger value="net">어획</TabsTrigger>
          <TabsTrigger value="shop">상점</TabsTrigger>
        </TabsList>
        <TabsContent value="rig">
          <div className="tackle-section">
            <h3>01 / 포인트</h3>
            <div className="spot-options">
              {spots.map((spot, i) => (
                <button
                  key={spot.name}
                  className={s.spot === i ? 'selected' : ''}
                  disabled={locked}
                  aria-pressed={s.spot === i}
                  onClick={() => action('spot', i)}
                >
                  <span>
                    <b>{spot.name}</b>
                    <small>{spot.bottom}</small>
                  </span>
                  <strong>{spot.depth.toFixed(1)} m</strong>
                </button>
              ))}
            </div>
          </div>
          <div className="tackle-section">
            <h3>02 / 채비와 미끼</h3>
            <div className="rig-options">
              {rigs.map((rig, i) => (
                <button
                  key={rig}
                  disabled={locked}
                  aria-pressed={s.rig === i}
                  className={s.rig === i ? 'selected' : ''}
                  onClick={() => action('rig', i)}
                >
                  {rig}
                </button>
              ))}
            </div>
            <label className="bait-select">
              미끼
              <select
                value={s.bait}
                disabled={locked}
                onChange={(e) => action('bait', Number(e.target.value))}
              >
                {baits.map((bait, i) => (
                  <option key={bait} value={i}>
                    {bait}
                  </option>
                ))}
              </select>
            </label>
            <FishingRange
              label={s.rig === 1 ? '바닥 수심' : '공략 수심'}
              value={s.rig === 1 ? spots[s.spot].depth : s.depth}
              min={0.3}
              max={spots[s.spot].depth}
              step={0.1}
              display={`${(s.rig === 1 ? spots[s.spot].depth : s.depth).toFixed(1)} m`}
              disabled={locked || s.rig === 1}
              onChange={(v) => action('depth', v)}
            />
            <FishingRange
              label="캐스팅 강도"
              value={power}
              min={0.15}
              display={`${Math.round(power * 100)}% · 약 ${Math.round(8 + power * (spots[s.spot].distance + s.gear * 8))} m`}
              disabled={locked}
              onChange={setPower}
            />
          </div>
          <div className="tackle-section">
            <h3>03 / 바늘·목줄·릴</h3>
            <label className="bait-select">
              바늘 크기
              <select
                disabled={locked}
                value={s.hookSize}
                onChange={(e) => action('hookSize', Number(e.target.value))}
              >
                {hooks.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="bait-select">
              목줄
              <select
                disabled={locked}
                value={s.leader}
                onChange={(e) => action('leader', Number(e.target.value))}
              >
                {leaders.map((item, i) => (
                  <option key={item.name} value={i}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="tackle-help">
              {leaders[s.leader].detail} · 큰 바늘은 대물을 유도하지만 작은
              어종의 입질은 줄어듭니다.
            </p>
            <FishingRigControls state={s} action={action} />
            <div className="gear-spec">
              <b>{gear.name}</b>
              <span>
                유효 강도{' '}
                {(
                  gear.line *
                  leaders[s.leader].strength *
                  (0.6 + s.condition * 0.4)
                ).toFixed(1)}{' '}
                kg · 스풀 {gear.capacity} m
              </span>
              <span>채비 상태 {Math.round(s.condition * 100)}%</span>
            </div>
          </div>
          <p className="tackle-help">
            {locked
              ? s.paused
                ? '잠시 멈췄어요. 수첩을 닫고 계속 낚시하기를 누르세요.'
                : '낚시 중에는 드랙과 릴 속도를 조절할 수 있습니다.'
              : s.rig === 2
                ? '스피닝은 기다리는 동안에도 줄을 감아야 입질이 옵니다.'
                : '예신에는 기다리세요. 찌가 깊이 잠기면 SPACE로 챔질하세요.'}
          </p>
          <div className="tackle-actions">
            <button
              disabled={locked}
              onClick={() => {
                action('cast', power);
                close();
              }}
            >
              캐스팅하기 ↗
            </button>
            <button
              className="quiet"
              disabled={locked || s.silver < 5}
              onClick={() => action('feed')}
            >
              밑밥 · 5 S
            </button>
          </div>
          {!idle && (
            <button
              className="recall-button quiet"
              disabled={s.paused}
              onClick={() => action('recall')}
            >
              채비 회수 · 포인트 변경
            </button>
          )}
        </TabsContent>
        <TabsContent value="fish">
          <p className="tackle-help">
            포인트·미끼·수심을 맞추면 입질이 빨라집니다. 아래 수치는 이 게임의
            어종 설정입니다.
          </p>
          {species.map((f, i) => (
            <article className="species-entry" key={f.name}>
              <div>
                <h3>{f.name}</h3>
                <span>
                  {s.journal.some((c) => c.species === i)
                    ? '포획 기록 있음'
                    : '미발견'}
                </span>
              </div>
              <i>{f.latin}</i>
              <p>
                {spots[f.spot].name} · {f.depth.toFixed(1)} m 부근
                <br />
                선호 미끼: {baits[f.bait.indexOf(Math.max(...f.bait))]}
                <br />
                {f.min}–{f.max} kg · 트로피 {f.trophy} kg 이상
              </p>
            </article>
          ))}
        </TabsContent>
        <TabsContent value="net">
          <div className="net-summary">
            <span>살림망 {s.keepnet.length} / 20</span>
            <b>{s.keepnet.reduce((n, f) => n + f.value, 0)} S</b>
          </div>
          <button
            className="sell-button"
            disabled={locked || !s.keepnet.length}
            onClick={() => action('sell')}
          >
            어획 전체 판매
          </button>
          <p className="tackle-help">
            기록과 장비는 이 브라우저에 자동 저장됩니다.
          </p>
          {s.journal.length === 0 ? (
            <div className="journal-empty">
              아직 기록이 없습니다.
              <br />첫 물고기를 낚아 수첩을 채워보세요.
            </div>
          ) : (
            s.journal.map((f) => (
              <article className="catch-entry" key={f.id}>
                <div>
                  <b>
                    {f.trophy ? '★ ' : ''}
                    {f.name}
                  </b>
                  <strong>{f.weight.toFixed(2)} kg</strong>
                </div>
                <p>
                  {f.length} cm · {spots[f.spot].name}
                  <span>
                    {f.released
                      ? '방생'
                      : s.keepnet.some((c) => c.id === f.id)
                        ? `보관 · ${f.value} S`
                        : '판매 완료'}
                  </span>
                </p>
              </article>
            ))
          )}
        </TabsContent>
        <TabsContent value="shop">
          <p className="tackle-help">
            강한 채비는 대물의 돌진을 견딥니다. 어획을 판매해 장비를 구입하세요.
          </p>
          {equipment.map((item, i) => (
            <article className="shop-entry" key={item.name}>
              <span>
                {i === 0 ? 'STARTER' : i === 1 ? 'ALL-ROUND' : 'BIG GAME'}
              </span>
              <h3>{item.name}</h3>
              <p>
                {item.rod}
                <br />줄 {item.line} kg · 드랙 최대 {item.reel} kg
                <br />
                스풀 {item.capacity} m
              </p>
              <button
                disabled={
                  locked ||
                  s.gear === i ||
                  (!s.owned.includes(i) && s.silver < item.cost)
                }
                onClick={() => action('buy', i)}
              >
                {s.gear === i
                  ? '장착 중'
                  : s.owned.includes(i)
                    ? '장착하기'
                    : `${item.cost} 실버 · 구입`}
              </button>
            </article>
          ))}
          <button
            className="sell-button quiet"
            disabled={locked || s.silver < 8 || s.condition >= 1}
            onClick={() => action('repair')}
          >
            채비 정비 · 8 실버
          </button>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
