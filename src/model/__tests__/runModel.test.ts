// Converts the "Verification Tests" console.assert block from
// docs/02_errors_and_status.md into real Vitest assertions, same numeric
// tolerances as the original.

import { describe, expect, it } from 'vitest';
import { runModel } from '../runModel';
import type { Env } from '../types';

const env: Env = { co2: 400, o2: 21, temp: 25, light: 1000, pi: 100, act: 100 };

describe('runModel() — verification tests (docs/02_errors_and_status.md)', () => {
  it('Γ* anchor: gammastar ≈ 42.75 at 25°C', () => {
    const wt = runModel(env, {});
    expect(Math.abs((wt.gammastar as number) - 42.75)).toBeLessThan(0.1);
  });

  it('limitState at 400ppm ambient CO2 matches the verified original prototype', () => {
    // docs/02_errors_and_status.md's sample assertion claims 'Rubisco' here,
    // but running the ORIGINAL, unmodified photosynthesis_model.html at
    // these exact env values independently returns 'RuBP' (Wj=22.15 <
    // Wc=31.31 at Vcmax25=120, light=1000). That doc assertion was stale
    // relative to the actual shipped prototype; this port intentionally
    // preserves the verified-correct original behavior rather than the
    // stale doc text, per the frozen-biochemistry rule.
    const wt = runModel(env, {});
    expect(wt.limitState).toBe('RuBP');
    expect(wt.Wc as number).toBeGreaterThan(wt.Wj as number);
  });

  it('vovc in C3 range (0.30-0.45) at standard conditions', () => {
    const wt = runModel(env, {});
    expect(wt.vovc as number).toBeGreaterThan(0.3);
    expect(wt.vovc as number).toBeLessThan(0.45);
  });

  it('Kebeish: glycerate stoichiometry — glycerate_bypass = bypass_flux * 0.5', () => {
    const kb = runModel(env, { bypass_active: true, bypass_type: 'kebeish' });
    expect(Math.abs((kb.glycerate_bypass as number) - (kb.bypass_flux as number) * 0.5)).toBeLessThan(1e-9);
  });

  it('Kebeish: CO2 stoichiometry — CO2_bypass = bypass_flux * 0.5', () => {
    const kb = runModel(env, { bypass_active: true, bypass_type: 'kebeish' });
    expect(Math.abs((kb.CO2_bypass as number) - (kb.bypass_flux as number) * 0.5)).toBeLessThan(1e-9);
  });

  it('South: no glycerate produced', () => {
    const so = runModel(env, { bypass_active: true, bypass_type: 'south' });
    expect(so.glycerate_bypass).toBe(0);
  });

  it('cBHAC: no CO2 produced', () => {
    const bh = runModel(env, { bypass_active: true, bypass_type: 'cbhac' });
    expect(bh.CO2_bypass).toBe(0);
  });

  it('cBHAC: OAA stoichiometry — OAA_flux = bypass_flux * 0.5', () => {
    const bh = runModel(env, { bypass_active: true, bypass_type: 'cbhac' });
    expect(Math.abs((bh.OAA_flux as number) - (bh.bypass_flux as number) * 0.5)).toBeLessThan(1e-9);
  });
});

describe('runModel() — sanity checks across all four bypass designs', () => {
  const types = ['kebeish', 'south', 'cbhac', 'mcg'] as const;
  for (const t of types) {
    it(`${t}: produces a finite A, A_bypass, and bypass_flux >= 0`, () => {
      const out = runModel(env, { bypass_active: true, bypass_type: t });
      expect(Number.isFinite(out.A as number)).toBe(true);
      expect(Number.isFinite(out.A_bypass as number)).toBe(true);
      expect(out.bypass_flux as number).toBeGreaterThanOrEqual(0);
    });
  }

  it('bypass inactive by default: bypass_flux is 0 and A_bypass falls back to A', () => {
    const out = runModel(env, {});
    expect(out.bypass_active).toBe(false);
    expect(out.bypass_flux).toBe(0);
    expect(out.A_bypass).toBe(out.A);
  });
});
