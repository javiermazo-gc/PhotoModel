// Response-curve mini chart: net A vs light / CO2 / temperature at the
// current parameters. The active electron-transport model is drawn as a
// solid line coloured by limitation state (Rubisco = purple, RuBP = amber,
// matching the Limit/Wc/Wj metric cards); the other model (FvCB <-> J-B) is
// overlaid as a dashed grey line so the difference between the two is
// visible where it actually exists (light-limited region), rather than only
// at the single default operating point where the two converge.
//
// No model logic here — all points come from sweepEnv() in src/model/sweep.ts.

import { useMemo, useState } from 'react';
import { sweepEnv, SWEEP_RANGE, type Env, type Params, type SweepPoint, type SweepVar } from '../model';

const W = 240;
const H = 150;
const PAD = { l: 28, r: 8, t: 8, b: 24 };
const LIMIT_COL: Record<SweepPoint['limitState'], string> = { Rubisco: '#533AB7', RuBP: '#BA7517', TPU: '#9B4DCA' };

const VARS: { v: SweepVar; label: string; axis: string; envKey: keyof Env }[] = [
  { v: 'light', label: 'Light', axis: 'PAR (µmol/m²/s)', envKey: 'light' },
  { v: 'co2', label: 'CO₂', axis: 'CO₂ (ppm)', envKey: 'co2' },
  { v: 'temp', label: 'Temp', axis: 'Leaf temperature (°C)', envKey: 'temp' }
];

const MODEL_LABEL = { fvcb: 'FvCB', johnson_berry: 'J–B' } as const;

/** Round-number tick step (1/2/5 × 10^k) giving roughly `count` intervals. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag;
}

function ticks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-6; t += step) out.push(Math.round(t * 1e6) / 1e6);
  return out;
}

export function ResponseCurves({ env, params, currentA }: { env: Env; params: Params; currentA: number }) {
  const [variable, setVariable] = useState<SweepVar>('light');
  const [showAlt, setShowAlt] = useState(true);
  const meta = VARS.find((d) => d.v === variable)!;

  const active = (params.photochemistry_model ?? 'fvcb') as keyof typeof MODEL_LABEL;
  const alt = active === 'fvcb' ? 'johnson_berry' : 'fvcb';

  const main = useMemo(() => sweepEnv(env, params, variable), [env, params, variable]);
  const other = useMemo(
    () => (showAlt ? sweepEnv(env, { ...params, photochemistry_model: alt }, variable) : []),
    [env, params, variable, alt, showAlt]
  );

  const { min: xMin, max: xMax } = SWEEP_RANGE[variable];
  const allA = [...main, ...other].map((p) => p.A);
  const yStep = niceStep(Math.max(...allA) - Math.min(0, ...allA), 4);
  const yMin = Math.floor(Math.min(0, ...allA) / yStep) * yStep;
  const yMax = Math.max(yMin + yStep, Math.ceil(Math.max(...allA) / yStep) * yStep);
  const sx = (x: number) => PAD.l + ((x - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
  const sy = (a: number) => H - PAD.b - ((a - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  // Split the active curve into contiguous same-limitation runs so each gets its own colour.
  const runs: { state: SweepPoint['limitState']; pts: SweepPoint[] }[] = [];
  main.forEach((p, i) => {
    const last = runs[runs.length - 1];
    if (last && last.state === p.limitState) last.pts.push(p);
    else runs.push({ state: p.limitState, pts: i > 0 ? [main[i - 1], p] : [p] });
  });
  const path = (pts: SweepPoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.A).toFixed(1)}`).join('');

  const curX = env[meta.envKey] as number;
  const curA = currentA;
  const inRange = curX >= xMin && curX <= xMax;

  const xTicks = ticks(xMin, xMax, niceStep(xMax - xMin, 5));
  const yTicks = ticks(yMin, yMax, yStep);
  const states = Array.from(new Set(main.map((p) => p.limitState)));

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {VARS.map((d) => (
          <button
            key={d.v}
            onClick={() => setVariable(d.v)}
            style={{
              flex: 1,
              fontSize: 9,
              padding: '2px 4px',
              borderRadius: 5,
              border: '0.5px solid var(--color-border-tertiary)',
              background: variable === d.v ? 'var(--accent)' : 'var(--color-background-secondary)',
              color: variable === d.v ? '#fff' : 'var(--color-text-secondary)',
              fontWeight: variable === d.v ? 600 : 400,
              cursor: 'pointer'
            }}
          >
            A–{d.label}
          </button>
        ))}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Net assimilation versus ${meta.axis}`} style={{ display: 'block' }}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="var(--color-border-tertiary)" strokeWidth={0.5} />
            <text x={PAD.l - 3} y={sy(t) + 2.5} fontSize={7} textAnchor="end" fill="var(--color-text-tertiary)">
              {t.toFixed(0)}
            </text>
          </g>
        ))}
        {yMin < 0 && <line x1={PAD.l} x2={W - PAD.r} y1={sy(0)} y2={sy(0)} stroke="var(--color-text-tertiary)" strokeWidth={0.6} />}
        {xTicks.map((t) => (
          <text key={t} x={sx(t)} y={H - PAD.b + 9} fontSize={7} textAnchor="middle" fill="var(--color-text-tertiary)">
            {t.toFixed(0)}
          </text>
        ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 3} fontSize={7.5} textAnchor="middle" fill="var(--color-text-secondary)">
          {meta.axis}
        </text>
        <text x={7} y={(PAD.t + H - PAD.b) / 2} fontSize={7.5} textAnchor="middle" fill="var(--color-text-secondary)" transform={`rotate(-90 7 ${(PAD.t + H - PAD.b) / 2})`}>
          A (µmol/m²/s)
        </text>

        {showAlt && other.length > 0 && (
          <path d={path(other)} fill="none" stroke="var(--color-text-tertiary)" strokeWidth={1.2} strokeDasharray="3 2" />
        )}
        {runs.map((r, i) => (
          <path key={i} d={path(r.pts)} fill="none" stroke={LIMIT_COL[r.state]} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {inRange && (
          <g>
            <line x1={sx(curX)} x2={sx(curX)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-text-tertiary)" strokeWidth={0.5} strokeDasharray="1.5 1.5" />
            <circle cx={sx(curX)} cy={sy(curA)} r={3} fill="var(--color-background-primary)" stroke="var(--color-text-primary)" strokeWidth={1.2}>
              <title>{`Current: ${curX.toFixed(0)} → A = ${curA.toFixed(2)} µmol/m²/s`}</title>
            </circle>
          </g>
        )}
      </svg>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', fontSize: 8, color: 'var(--color-text-secondary)', marginTop: 2 }}>
        {states.map((s) => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 10, height: 2, background: LIMIT_COL[s], display: 'inline-block' }} />
            {MODEL_LABEL[active]} · {s}
          </span>
        ))}
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
          <input type="checkbox" checked={showAlt} onChange={(e) => setShowAlt(e.target.checked)} style={{ margin: 0, width: 10, height: 10 }} />
          <span style={{ width: 10, borderTop: '1.2px dashed var(--color-text-tertiary)', display: 'inline-block' }} />
          {MODEL_LABEL[alt]}
        </label>
      </div>
    </div>
  );
}
