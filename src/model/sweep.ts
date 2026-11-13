// Response-curve sweeps: run the full steady-state model across a range of
// one environmental variable, holding everything else fixed.
//
// This is pure composition over runModel() — no new biochemistry. Each
// point is an independent steady state (see CLAUDE.md: there is no state
// carried between runModel() calls), so a sweep is just a map over inputs.

import { runModel } from './runModel';
import type { Env, Params } from './types';

export type SweepVar = 'light' | 'co2' | 'temp';

export interface SweepPoint {
  x: number;
  A: number;
  limitState: 'Rubisco' | 'RuBP' | 'TPU';
}

/** Default sweep ranges (CO2 extends below the UI slider to show the A-Ci initial slope). */
export const SWEEP_RANGE: Record<SweepVar, { min: number; max: number }> = {
  light: { min: 0, max: 2000 },
  co2: { min: 50, max: 1200 },
  temp: { min: 5, max: 40 }
};

export function sweepEnv(
  env: Env,
  params: Params,
  variable: SweepVar,
  n = 41,
  range: { min: number; max: number } = SWEEP_RANGE[variable]
): SweepPoint[] {
  const pts: SweepPoint[] = [];
  const steps = Math.max(2, n);
  for (let i = 0; i < steps; i++) {
    const x = range.min + ((range.max - range.min) * i) / (steps - 1);
    const out = runModel({ ...env, [variable]: x }, params);
    pts.push({ x, A: out.A as number, limitState: out.limitState as SweepPoint['limitState'] });
  }
  return pts;
}
