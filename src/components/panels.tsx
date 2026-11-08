// Metric cards, info popovers, sliders, limitation banner, legend.
// Ported from minimal_map_BACKUP_20261007.tsx (MCard, InfoPop, Sld,
// LimitBanner, Legend) and rewritten as idiomatic JSX.

import { COL, MINFO } from '../data/metadata';
import type { KinFeedbackOutput } from '../model/types';

interface MCardProps {
  label: string;
  value: number | string;
  unit: string;
  color?: string;
  onInfo: (label: string) => void;
  active: boolean;
}

export function MCard({ label, value, unit, color, onInfo, active }: MCardProps) {
  const v = typeof value === 'number' ? (Math.abs(value) > 99 ? value.toFixed(1) : value.toFixed(2)) : value;
  const isNeg = typeof value === 'number' && value < 0;
  const c = isNeg ? '#E24B4A' : color || 'var(--color-text-primary)';
  return (
    <div
      className="stat-tile"
      onClick={() => onInfo(active ? '' : label)}
      style={{
        background: active ? 'var(--color-background-primary)' : 'var(--color-background-secondary)',
        borderRadius: 'var(--radius-sm)',
        padding: '7px 9px',
        textAlign: 'center',
        borderLeft: `3px solid ${active ? c : isNeg ? '#E24B4A' : color || '#ccc'}`,
        cursor: 'pointer',
        outline: active ? `1px solid ${c}` : 'none',
        userSelect: 'none'
      }}
    >
      <div style={{ fontSize: 9, color: 'var(--color-text-secondary)', marginBottom: 2, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 15.5, fontWeight: 650, color: c, letterSpacing: '-0.01em' }}>{v}</div>
      <div style={{ fontSize: 8.5, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{unit}</div>
      <div style={{ fontSize: 8, color: 'var(--color-text-tertiary)', marginTop: 2, opacity: 0.7 }}>ⓘ</div>
    </div>
  );
}

interface InfoPopProps {
  metric: string | null;
  onClose: () => void;
}

export function InfoPop({ metric, onClose }: InfoPopProps) {
  if (!metric || !MINFO[metric]) return null;
  const d = MINFO[metric];
  return (
    <div
      style={{
        margin: '6px 0 0',
        padding: '10px 12px',
        background: 'var(--color-background-secondary)',
        borderRadius: 7,
        border: '0.5px solid var(--color-border-tertiary)',
        fontSize: 9.5,
        position: 'relative'
      }}
    >
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)' }}
      >
        ×
      </button>
      <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 3 }}>
        {metric} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', fontSize: 10 }}>({d.symbol})</span>
      </div>
      <code style={{ display: 'block', fontSize: 8.5, background: 'var(--color-background-primary)', padding: '2px 6px', borderRadius: 3, marginBottom: 5, color: 'var(--color-text-primary)' }}>
        {d.formula}
      </code>
      <div style={{ lineHeight: 1.6, marginBottom: 4, color: 'var(--color-text-primary)' }}>{d.desc}</div>
      <div style={{ fontSize: 9, color: 'var(--color-text-secondary)' }}>
        <strong>Range:</strong> {d.range}
      </div>
      <div style={{ fontSize: 8.5, color: 'var(--color-text-tertiary)', marginTop: 2 }}>Unit: {d.unit}</div>
    </div>
  );
}

interface SldProps {
  k: string;
  val: number;
  set: (k: string, v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit: string;
  color?: string;
  tip?: string;
}

export function Sld({ k, val, set, min, max, step = 1, label, unit, color, tip }: SldProps) {
  return (
    <div style={{ marginBottom: 8 }} title={tip}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
        <span style={{ fontWeight: 500, color: color || 'var(--color-text-primary)' }}>{label}</span>
        <span style={{ fontWeight: 600, color: color || 'var(--color-text-primary)' }}>
          {val}
          {unit}
        </span>
      </div>
      {tip && <div style={{ fontSize: 8, color: 'var(--color-text-tertiary)', marginBottom: 3, lineHeight: 1.4 }}>{tip}</div>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={val}
        onChange={(e) => set(k, +e.target.value)}
        style={{ width: '100%', color: color || COL.cbb, accentColor: color || COL.cbb }}
      />
    </div>
  );
}

export function LimitBanner({ m }: { m: KinFeedbackOutput & { belowCompPt?: boolean } }) {
  const isRub = m.limitState === 'Rubisco';
  const c = isRub ? '#533AB7' : '#BA7517';
  return (
    <div style={{ padding: '7px 11px', borderRadius: 'var(--radius-sm)', background: c + '12', border: `0.5px solid ${c}`, fontSize: 10, color: c, lineHeight: 1.6 }}>
      <strong>{m.limitState}-limited</strong> — Wc={m.Wc.toFixed(1)}, Wj={m.Wj.toFixed(1)} µmol/m²/s.{' '}
      {isRub ? "More light alone won't increase A — need more CO₂ or Vcmax." : "More CO₂ alone won't increase A — need more light or higher Jmax."}
      {m.belowCompPt && (
        <span style={{ color: '#E24B4A' }}>
          {' '}
          ⚠ Cc ({m.Cc.toFixed(0)}) &lt; Γ* ({m.gammastar.toFixed(1)}) — A is negative.
        </span>
      )}
    </div>
  );
}

export function Legend({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <div>
      <button
        onClick={onToggle}
        style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: 'transparent', border: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)', cursor: 'pointer', marginTop: 6 }}
      >
        {show ? '▲ Hide' : '▼ Show'} legend
      </button>
      {show && (
        <div style={{ marginTop: 6, padding: '7px 10px', background: 'var(--color-background-secondary)', borderRadius: 6, fontSize: 9 }}>
          <div style={{ fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Compartments</div>
          {([
            ['stroma', 'Chloroplast stroma'],
            ['perox', 'Peroxisome'],
            ['mito', 'Mitochondria']
          ] as const).map(([k, l]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--color-text-secondary)', marginBottom: 3 }}>
              <div style={{ width: 10, height: 10, border: `1.5px solid ${COL[k].stroke}`, borderRadius: 2, background: COL[k].fill, flexShrink: 0 }} />
              {l}
            </div>
          ))}
          <div style={{ fontWeight: 500, color: 'var(--color-text-secondary)', margin: '6px 0 4px' }}>Pathways</div>
          {([
            [COL.cbb, 'CBB / carboxylation'],
            [COL.pr, 'Photorespiration'],
            [COL.keb, 'Kebeish bypass'],
            ['#aaa', 'CO₂ release'],
            [COL.nh3, 'NH₃']
          ] as const).map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
              <div style={{ width: 16, height: 3, background: c, borderRadius: 2, flexShrink: 0 }} />
              {l}
            </div>
          ))}
          <div style={{ marginTop: 5, color: 'var(--color-text-tertiary)' }}>Width ∝ √flux · µmol/m²/s · click arrows or ● for details</div>
        </div>
      )}
    </div>
  );
}
