// Regression tests for the three documented bug fixes applied during this
// port (see docs/02_errors_and_status.md "FIXED" section and
// docs/archive/port_2026-11-07_future_improvements.md's former Priority 1 list). One test per
// fix, asserting the CORRECTED behavior so a future change can't silently
// reintroduce any of these.

import { describe, expect, it } from 'vitest';
import { runModel } from '../runModel';
import { bypassMcG } from '../bypass/mcg';
import { kin } from '../kin';
import { photoResp, photoRespKinetic } from '../photoResp';
import { R, T25 } from '../constants';
import type { Env } from '../types';

const env: Env = { co2: 400, o2: 21, temp: 25, light: 1000, pi: 100, act: 100 };

describe('Bug fix #1 [HIGH]: McG acetylCoA_modeA production stoichiometry', () => {
  it('acetylCoA_modeA is 1:1 with bypass_flux, NOT scaled by lipidFrac', () => {
    const k = kin(env, {});
    const pr = photoResp(k);
    const prk = photoRespKinetic(k, pr, env, {});
    const defaultLipidFrac = 0.6; // params.acetylCoA_fate_lipid default
    const bp = bypassMcG(k, pr, prk, env, {});
    expect(bp.acetylCoA_modeA).toBeCloseTo(bp.bypass_flux as number, 9);

    // Explicitly confirm it is independent of acetylCoA_fate_lipid: the old,
    // buggy formula was `bypass_flux * lipidFrac`, which would make
    // acetylCoA_modeA scale with that parameter. It must not.
    const bpLowLipid = bypassMcG(k, pr, prk, env, { acetylCoA_fate_lipid: 0.1 });
    const bpHighLipid = bypassMcG(k, pr, prk, env, { acetylCoA_fate_lipid: 0.9 });
    expect(bpLowLipid.acetylCoA_modeA).toBeCloseTo(bpHighLipid.acetylCoA_modeA as number, 9);
    expect(bpLowLipid.acetylCoA_modeA).toBeCloseTo(bp.bypass_flux as number, 9);

    // Sanity: confirm this is NOT what the old buggy formula would have
    // produced at the default lipidFrac (which underestimated AcCoA by 40%).
    const buggyValue = (bp.bypass_flux as number) * defaultLipidFrac;
    expect(bp.acetylCoA_modeA as number).not.toBeCloseTo(buggyValue, 3);
  });

  it('end-to-end via runModel(): acetylCoA_total reflects the corrected 1:1 production', () => {
    const out = runModel(env, { bypass_active: true, bypass_type: 'mcg' });
    // acetylCoA_total = acetylCoA_modeA + acetylCoA_modeB, and acetylCoA_modeA
    // alone must equal bypass_flux (modeB adds on top, never subtracts).
    expect(out.acetylCoA_modeA as number).toBeCloseTo(out.bypass_flux as number, 9);
    expect(out.acetylCoA_total as number).toBeGreaterThanOrEqual((out.acetylCoA_modeA as number) - 1e-9);
  });
});

describe('Bug fix #2 [MEDIUM]: McG A_bypass NaN risk removed', () => {
  it('A_bypass is a finite number, never NaN, across a range of conditions', () => {
    const envs: Env[] = [
      { co2: 400, o2: 21, temp: 25, light: 1000, pi: 100, act: 100 },
      { co2: 200, o2: 21, temp: 35, light: 1500, pi: 60, act: 75 },
      { co2: 800, o2: 35, temp: 10, light: 50, pi: 100, act: 100 }
    ];
    for (const e of envs) {
      const out = runModel(e, { bypass_active: true, bypass_type: 'mcg' });
      expect(Number.isNaN(out.A_bypass as number)).toBe(false);
      expect(Number.isFinite(out.A_bypass as number)).toBe(true);
    }
  });

  it('flux_3pga_mcg is defined and finite (no longer an undefined reference)', () => {
    const k = kin(env, {});
    const pr = photoResp(k);
    const prk = photoRespKinetic(k, pr, env, {});
    const bp = bypassMcG(k, pr, prk, env, {});
    expect(bp.flux_3pga_mcg).toBeDefined();
    expect(Number.isFinite(bp.flux_3pga_mcg as number)).toBe(true);
  });
});

describe('Bug fix #3 [LOW]: O2 solubility enthalpy corrected to -12600 J/mol', () => {
  it('GOX saturation ratio under forced GOX saturation matches the corrected Ha', () => {
    // Force GOX_rate to be capped at 0.99*GOX_Veff (saturating branch) by
    // giving it a tiny Vmax25, so GOX_sat collapses to a closed form that
    // depends only on O2 partial pressure (O2p) and GOX_Km_O2 — making the
    // Ha used for O2 solubility directly observable in the output.
    const hotEnv: Env = { co2: 400, o2: 21, temp: 35, light: 1000, pi: 100, act: 100 };
    const params = { GOX_Vmax25: 1e-6 };
    const k = kin(hotEnv, params);
    const pr = photoResp(k);
    const prk = photoRespKinetic(k, pr, hotEnv, params);

    const Tk = hotEnv.temp + 273.15;
    const GOX_KmO2 = 0.27; // default GOX_Km_O2
    const correctO2p = (hotEnv.o2 / 100) * 1.26 * Math.exp((-12600 / R) * (1 / T25 - 1 / Tk));
    const expectedSat = (0.99 * correctO2p) / (GOX_KmO2 + correctO2p);

    expect(prk.GOX_sat).toBeCloseTo(expectedSat, 6);

    // Confirm this is NOT what the old, buggy -16000 J/mol constant would
    // have produced at this temperature.
    const wrongO2p = (hotEnv.o2 / 100) * 1.26 * Math.exp((-16000 / R) * (1 / T25 - 1 / Tk));
    const wrongSat = (0.99 * wrongO2p) / (GOX_KmO2 + wrongO2p);
    expect(prk.GOX_sat as number).not.toBeCloseTo(wrongSat, 4);
  });
});
