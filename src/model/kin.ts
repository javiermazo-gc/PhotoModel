// MODULE 1: kin() — FROZEN [Bernacchi 2001/2002; Farquhar 1980]
//
// Ported byte-for-byte from photosynthesis_model.html (lines 338-393) /
// minimal_map_BACKUP_20261007.tsx (lines 15-70). DO NOT alter any formula,
// constant, or default here — this is the frozen FvCB core. kinFeedback()
// re-derives A with the three feedback loops layered on top; it never
// mutates kin()'s own output.
//
// EXCEPTION: the electron-transport term (J) has a second, opt-in
// formulation — Johnson-Berry (JB), gated behind
// params.photochemistry_model. Left unset (the default), behavior and
// output are byte-identical to before this was added; this is additive,
// not a modification of the frozen FvCB path. See
// docs/proposals/johnson_berry.md.

import { computeEta, computeJ_FvCB, computeJ_JohnsonBerry, PHI_1P_MAX } from './electronTransport';
import { _arr, _clamp, _peaked } from './constants';
import type { Env, KinOutput, Params } from './types';

export function kin(env: Env, params: Params = {}): KinOutput {
  const Tk = env.temp + 273.15;
  const Kc25 = params.Kc25 ?? 272.4;
  const Ko25 = params.Ko25 ?? 165.8;
  const GS25 = params.GS25 ?? 42.75;
  const Srel25 = params.Srel25 ?? 2590;
  const Kc = Kc25 * _arr(79430, Tk);
  const Ko = Ko25 * _arr(36380, Tk);
  const GS = GS25 * _arr(37830, Tk);
  const Srel = Srel25 * _arr(-28990, Tk);
  const Vcmax25 = params.Vcmax25 ?? 120;
  const Vcmax =
    Vcmax25 *
    _arr(65330, Tk) *
    (_clamp(env.act ?? 100, 0, 100) / 100) *
    (_clamp(env.pi ?? 100, 0, 100) / 100);
  const Vomax = Vcmax * ((Ko * 1000) / Kc) / Srel;
  const Jmax25 = (params.Jmax_Vcmax_ratio ?? 1.67) * Vcmax25;
  const JmaxT = Jmax25 * _peaked(43900, 200000, 640, Tk);
  const alpha = params.alpha ?? 0.3;
  const theta = params.theta ?? 0.7;
  const I = Math.max(0, env.light);
  // Cc moved up from its original position (just below) so the
  // Johnson-Berry path can use it for eta. Its value is unaffected by
  // this reordering — it depends only on env/params, not on J.
  const Cc = env.co2 * (params.ci_ca ?? 0.7) * (params.Cc_Ci ?? 0.8);
  const photochemistryModel = params.photochemistry_model ?? 'fvcb';
  let J: number;
  let eta: number | null = null;
  let Cb6fmax: number | null = null;
  if (photochemistryModel === 'johnson_berry') {
    const Cb6fmax25 = params.Cb6f_max25 ?? 1.4 * Jmax25; // [est sp:multi] see docs/proposals/johnson_berry.md
    Cb6fmax = Cb6fmax25 * _peaked(43900, 200000, 640, Tk); // same temp response as Jmax [est]
    const alpha1 = params.alpha1 ?? alpha;
    eta = computeEta(Cc, GS);
    J = computeJ_JohnsonBerry(Cb6fmax, alpha1, PHI_1P_MAX, eta, I);
  } else {
    J = computeJ_FvCB(alpha, theta, JmaxT, I);
  }
  const Rd = (params.Rd_fraction ?? 0.015) * Vcmax25 * _arr(46390, Tk);
  const Oc = env.o2 * 10;
  const Wc = (Vcmax * Cc) / (Cc + Kc * (1 + Oc / Ko));
  const Wj = (J * Cc) / (4 * Cc + 8 * GS);
  // TPU: default Vcmax25/12 [C3 std Gregory 2021]; Tp25_off:true disables
  const Tp25 = params.Tp25 !== undefined ? params.Tp25 : params.Tp25_off ? null : Vcmax25 / 12;
  const TpT = Tp25 ? Tp25 * _arr(47100, Tk) : Infinity;
  const Wp = isFinite(TpT) && Cc - GS > 0 ? (3 * TpT * Cc) / (Cc - GS) : Infinity;
  const Wmin = Math.min(Wc, Wj, Wp);
  const A = Wmin - Rd;
  const vovc = (Oc * 1000) / (Srel * Math.max(Cc, 0.1));
  return {
    Vc: Wmin,
    Vo: Wmin * vovc,
    Wc,
    Wj,
    Wp: isFinite(Wp) ? Wp : null,
    J,
    A,
    Rd,
    vovc,
    gammastar: GS,
    Kc,
    Ko,
    Cc,
    Oc,
    Srel,
    Vcmax_eff: Vcmax,
    Vcmax25,
    Vomax,
    Jmax: JmaxT,
    limitState: Wc <= Wj && Wc <= Wp ? 'Rubisco' : Wj <= Wp ? 'RuBP' : 'TPU',
    belowCompPt: Cc < GS,
    photochemistryModel,
    eta,
    Cb6fmax
  };
}
