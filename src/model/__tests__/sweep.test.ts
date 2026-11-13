import { describe, expect, it } from 'vitest';
import { kin } from '../kin';
import { runModel } from '../runModel';
import { sweepEnv, SWEEP_RANGE } from '../sweep';
import type { Env } from '../types';

const baseEnv: Env = { co2: 400, o2: 21, temp: 25, light: 1000, pi: 100, act: 100 };

describe('sweepEnv — pure composition over runModel()', () => {
  it('each point equals a direct runModel() call at that x', () => {
    const pts = sweepEnv(baseEnv, {}, 'light', 5);
    expect(pts.map((p) => p.x)).toEqual([0, 500, 1000, 1500, 2000]);
    for (const p of pts) {
      expect(p.A).toBe(runModel({ ...baseEnv, light: p.x }, {}).A);
    }
  });

  it('spans the configured range for every variable', () => {
    for (const v of ['light', 'co2', 'temp'] as const) {
      const pts = sweepEnv(baseEnv, {}, v, 11);
      expect(pts).toHaveLength(11);
      expect(pts[0].x).toBe(SWEEP_RANGE[v].min);
      expect(pts[10].x).toBe(SWEEP_RANGE[v].max);
    }
  });

  it('A–light is non-decreasing and RuBP-limited at low light', () => {
    const pts = sweepEnv(baseEnv, {}, 'light', 41);
    for (let i = 1; i < pts.length; i++) expect(pts[i].A).toBeGreaterThanOrEqual(pts[i - 1].A - 1e-9);
    expect(pts[2].limitState).toBe('RuBP');
  });

  it('A–CO2 is non-decreasing at saturating light', () => {
    const pts = sweepEnv(baseEnv, {}, 'co2', 41);
    for (let i = 1; i < pts.length; i++) expect(pts[i].A).toBeGreaterThanOrEqual(pts[i - 1].A - 1e-9);
  });

  // Reproduces the pattern documented in docs/04_future_improvements.md
  // ("Light response curves"), which was measured on kin() alone: J-B sits
  // ~15-20% below FvCB in the light-limited range and converges once
  // Rubisco limits (30.15 µmol/m²/s at 2000 µmol).
  it('kin(): J–B is ~15-20% below FvCB at 400 µmol and converges at 2000 µmol', () => {
    const at = (light: number, model: 'fvcb' | 'johnson_berry') => kin({ ...baseEnv, light }, { photochemistry_model: model }).A;
    const gap = 1 - at(400, 'johnson_berry') / at(400, 'fvcb');
    expect(gap).toBeGreaterThan(0.15);
    expect(gap).toBeLessThan(0.2);
    expect(at(2000, 'johnson_berry')).toBeCloseTo(at(2000, 'fvcb'), 6);
    expect(at(2000, 'fvcb')).toBeCloseTo(30.15, 2);
  });

  // In the full model, kinFeedback() scales Wj (2-PG -> TPI/SBPase, Trx f)
  // but not Wc in the same way, so at 400 ppm / 25 °C the leaf stays
  // RuBP-limited across the whole 0-2000 µmol range and the two J models do
  // NOT converge — the curve chart must show this, not the kin()-level picture.
  it('runModel(): J–B is below FvCB in the light-limited range', () => {
    const at = (light: number, model: 'fvcb' | 'johnson_berry') =>
      runModel({ ...baseEnv, light }, { photochemistry_model: model }).A as number;
    for (const L of [200, 400, 800, 1000]) expect(at(L, 'johnson_berry')).toBeLessThan(at(L, 'fvcb'));
  });
});
