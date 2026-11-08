import { describe, expect, it } from 'vitest';
import { computeEta, computeJ_FvCB, computeJ_JohnsonBerry, PHI_1P_MAX } from '../electronTransport';
import { kin } from '../kin';
import type { Env } from '../types';

const baseEnv: Env = { co2: 400, o2: 21, temp: 25, light: 1000, pi: 100, act: 100 };

describe('Johnson-Berry electron transport — default behavior unchanged', () => {
  it('kin() with no photochemistry_model param matches the explicit fvcb path', () => {
    const implicit = kin(baseEnv, {});
    const explicit = kin(baseEnv, { photochemistry_model: 'fvcb' });
    expect(implicit.J).toBeCloseTo(explicit.J, 12);
    expect(implicit.A).toBeCloseTo(explicit.A, 12);
    expect(implicit.photochemistryModel).toBe('fvcb');
    expect(implicit.eta).toBeNull();
    expect(implicit.Cb6fmax).toBeNull();
  });
});

describe('Johnson-Berry Equation (3): eta', () => {
  // Verified against Lamour, Chave, Johnson, Berry et al. 2026, Eq. (3),
  // read directly from the typeset PDF (not OCR/text-extracted, since the
  // equations are embedded as images with no extractable text layer):
  //   eta = 1 - nL/nC + (3*Cc + 7*gammastar) / ((4*Cc + 8*gammastar)*nC)
  // The paper states eta's extreme values (Cc -> 0, Cc -> infinity) are
  // 1.125 and 1 respectively, for the default nL=0.75, nC=1.

  it('approaches 1.125 as Cc -> 0 and 1 as Cc -> infinity (the paper-stated bounds)', () => {
    const gammastar = 42.75;
    expect(computeEta(0, gammastar)).toBeCloseTo(1.125, 9);
    expect(computeEta(1e9, gammastar)).toBeCloseTo(1, 6);
  });

  it('stays within [1, 1.125] across the model physiological CO2 range', () => {
    const gammastar = 42.75;
    for (const Cc of [0, 50, 112, 224, 448, 672, 10000]) {
      const eta = computeEta(Cc, gammastar);
      expect(eta).toBeGreaterThanOrEqual(1);
      expect(eta).toBeLessThanOrEqual(1.125);
    }
  });

  it('kin() under johnson_berry reports eta within the paper-stated bound across the model CO2 sweep', () => {
    for (const co2 of [100, 200, 400, 800, 1500]) {
      const out = kin({ ...baseEnv, co2 }, { photochemistry_model: 'johnson_berry' });
      expect(out.eta).not.toBeNull();
      const eta = out.eta as number;
      expect(eta).toBeGreaterThanOrEqual(1);
      expect(eta).toBeLessThanOrEqual(1.125);
    }
  });
});

describe('Johnson-Berry Equation (2): J — mathematical equivalence to FvCB at theta->0, eta=1', () => {
  it('computeJ_JohnsonBerry(eta=1) reduces to the exact rectangular-hyperbola limit of computeJ_FvCB(theta->0)', () => {
    // As theta -> 0, the FvCB non-rectangular hyperbola's analytic limit is
    // the plain rectangular hyperbola J = (alpha*I*Jmax)/(alpha*I+Jmax)
    // (verified by L'Hopital / Taylor expansion of the sqrt term). At
    // eta=1, computeJ_JohnsonBerry algebraically reduces to the same form
    // with Cb6fmax standing in for Jmax and (alpha1*phi1Pmax) for alpha.
    const alpha = 0.3;
    const Jmax = 200;
    const I = 800;

    const thetaNearZero = 1e-9;
    const jFvcbLimit = computeJ_FvCB(alpha, thetaNearZero, Jmax, I);

    // Choose alpha1 so that alpha1*phi1Pmax === alpha exactly, and
    // Cb6fmax === Jmax, so the two formulas describe the identical curve.
    const alpha1 = alpha / PHI_1P_MAX;
    const jJohnsonBerry = computeJ_JohnsonBerry(Jmax, alpha1, PHI_1P_MAX, 1, I);

    const analyticRectHyperbola = (alpha * I * Jmax) / (alpha * I + Jmax);

    expect(jJohnsonBerry).toBeCloseTo(analyticRectHyperbola, 9);
    expect(jFvcbLimit).toBeCloseTo(analyticRectHyperbola, 4); // theta=1e-9 is a numerical approach to the limit, not the exact limit
  });
});

describe('Johnson-Berry electron transport — johnson_berry path via kin()', () => {
  it('selecting johnson_berry changes J relative to fvcb at the same conditions', () => {
    const fvcb = kin(baseEnv, { photochemistry_model: 'fvcb' });
    const jb = kin(baseEnv, { photochemistry_model: 'johnson_berry' });
    expect(jb.photochemistryModel).toBe('johnson_berry');
    expect(jb.eta).not.toBeNull();
    expect(jb.Cb6fmax).not.toBeNull();
    expect(jb.J).not.toBeCloseTo(fvcb.J, 6);
  });

  it('a custom Cb6f_max25 and alpha1 are honored instead of the defaults', () => {
    const withDefaults = kin(baseEnv, { photochemistry_model: 'johnson_berry' });
    const withOverrides = kin(baseEnv, {
      photochemistry_model: 'johnson_berry',
      Cb6f_max25: 300,
      alpha1: 0.4
    });
    expect(withOverrides.J).not.toBeCloseTo(withDefaults.J, 6);
  });

  it('J is finite and non-negative across a light sweep under johnson_berry', () => {
    for (const light of [0, 50, 300, 1000, 2000]) {
      const out = kin({ ...baseEnv, light }, { photochemistry_model: 'johnson_berry' });
      expect(Number.isFinite(out.J)).toBe(true);
      expect(out.J).toBeGreaterThanOrEqual(0);
    }
  });
});
