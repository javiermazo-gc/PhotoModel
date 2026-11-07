// MODULE 1: kin() — FROZEN [Bernacchi 2001/2002; Farquhar 1980]
//
// Ported byte-for-byte from photosynthesis_model.html (lines 338-393) /
// minimal_map_BACKUP_20261007.tsx (lines 15-70). DO NOT alter any formula,
// constant, or default here — this is the frozen FvCB core. kinFeedback()
// re-derives A with the three feedback loops layered on top; it never
// mutates kin()'s own output.

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
  const aI = alpha * I;
  const J =
    (aI + JmaxT - Math.sqrt(Math.max(0, Math.pow(aI + JmaxT, 2) - 4 * theta * aI * JmaxT))) /
    (2 * theta);
  const Rd = (params.Rd_fraction ?? 0.015) * Vcmax25 * _arr(46390, Tk);
  const Cc = env.co2 * (params.ci_ca ?? 0.7) * (params.Cc_Ci ?? 0.8);
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
    belowCompPt: Cc < GS
  };
}
