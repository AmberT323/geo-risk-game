'use client';
import { PHASES, PHASE_INFO, type Phase, DIMENSIONS, type Scores } from '@/lib/game';

const MAP: { phase: Phase; label: string; n?: string }[] = [
  { phase: 'act1', label: '平靜日常', n: '1' },
  { phase: 'act2', label: '風聲漸起', n: '2' },
  { phase: 'act3', label: '金融冰封', n: '3' },
  { phase: 'act4', label: '撐過90天', n: '4' },
  { phase: 'act5', label: '重新開機', n: '5' },
  { phase: 'report', label: '韌性報告', n: '★' },
];

/** 五幕地圖：取代傳統棋盤 */
export function ActMap({ phase }: { phase: Phase }) {
  const idx = PHASES.indexOf(phase);
  return (
    <div className="map">
      {MAP.map((m, i) => {
        const mi = PHASES.indexOf(m.phase);
        const cls = mi < idx || (m.phase === 'act3' && phase === 'survival') ? 'done' : mi === idx ? 'now' : '';
        const now = mi === idx || (m.phase === 'act3' && phase === 'survival');
        return (
          <div key={m.phase} style={{ display: 'contents' }}>
            {i > 0 && <div className={`bar ${mi <= idx ? 'done' : ''}`} />}
            <div className={`node ${now ? 'now' : cls}`}>
              <div className="dot">{m.n}</div>
              {m.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Ticker({ phase }: { phase: Phase }) {
  const items = PHASE_INFO[phase].ticker;
  if (!items.length) return null;
  return (
    <div className="ticker">
      <span>{items.map((t, i) => <span key={i} style={{ padding: 0, animation: 'none' }}><b>▍快訊</b>{t}</span>)}</span>
    </div>
  );
}

export function Bars({ items, max, fmt = (v) => String(v), tone }: {
  items: { label: string; value: number; tone?: 'alt' | 'ice' }[]; max?: number; fmt?: (v: number) => string; tone?: 'alt' | 'ice';
}) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="bars">
      {items.map((it) => (
        <div className="b" key={it.label}>
          <div className="lab"><span>{it.label}</span><span>{fmt(it.value)}</span></div>
          <div className="track"><div className={`fill ${it.tone ?? tone ?? ''}`} style={{ width: `${Math.min(100, (it.value / m) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Radar({ scores, size = 260, compare }: { scores: Scores; size?: number; compare?: Scores }) {
  const c = size / 2; const R = size / 2 - 42;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [c + Math.cos(a) * R * (v / 100), c + Math.sin(a) * R * (v / 100)];
  };
  const poly = (s: Scores) => DIMENSIONS.map((d, i) => pt(i, s[d.key]).join(',')).join(' ');
  return (
    <svg width="100%" viewBox={`-40 -6 ${size + 80} ${size + 12}`} style={{ maxWidth: size + 80, display: 'block', margin: '0 auto' }} role="img" aria-label="五維韌性雷達圖">
      {[25, 50, 75, 100].map((g) => (
        <polygon key={g} points={DIMENSIONS.map((_, i) => pt(i, g).join(',')).join(' ')} fill="none" stroke="var(--line)" />
      ))}
      {DIMENSIONS.map((_, i) => { const [x, y] = pt(i, 100); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" />; })}
      {compare && <polygon points={poly(compare)} fill="rgba(142,205,240,.12)" stroke="var(--ice)" strokeDasharray="4 3" />}
      <polygon points={poly(scores)} fill="rgba(242,181,68,.25)" stroke="var(--accent)" strokeWidth={2} />
      {DIMENSIONS.map((d, i) => {
        const [x, y] = pt(i, 128);
        return (
          <text key={d.key} x={x} y={y} fill="var(--text)" fontSize="12" textAnchor="middle" dominantBaseline="middle">
            {d.name} {scores[d.key]}
          </text>
        );
      })}
    </svg>
  );
}

export function Fuel({ months, max = 6 }: { months: number; max?: number }) {
  return <div className="fuel"><div style={{ width: `${Math.min(100, (months / max) * 100)}%` }} /></div>;
}
