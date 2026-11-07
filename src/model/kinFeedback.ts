// MODULE 5: kinFeedback() [At✓ Flügel 2017; Yoshida 2015; Ki sp:spinach]
//
// Ported byte-for-byte from photosynthesis_model.html (lines 503-547).
// This is the only place kin()'s Vcmax/Wj are re-derived with the three
// feedback loops (2-PG inhibition, Trx f regulation, GDC back-pressure)
// layered on top; kin() itself is never mutated.

import type { Env, KinFeedbackOutput, KinOutput, Params, PhotoRespKineticOutput, TrxfOutput } from './types';

export function kinFeedback(
  k: KinOutput,
  prk: PhotoRespKineticOutput | null | undefined,
  trxf: TrxfOutput | null | undefined,
  env: Env,
  params: Params = {}
): KinFeedbackOutput {
  let Vcmax_fb = k.Vcmax_eff;
  let Wj_fb = k.Wj;
  if (!(params.disable_2pg ?? false) && prk) {
    const p2PG = prk.pool_2PG ?? 0;
    Wj_fb *= (1 / (1 + p2PG / (params.Ki_TPI ?? 0.066))) * (1 / (1 + p2PG / (params.Ki_SBPase ?? 0.2)));
  }
  if (!(params.disable_trxf ?? false) && trxf) {
    Vcmax_fb *= trxf.vcmax_rca_scale;
    Wj_fb *= trxf.cbb_regen_activation;
  }
  if (!(params.disable_gdc ?? false) && prk) {
    const GDC_sat = prk.GDC_sat ?? 0;
    const thresh = params.gdc_threshold ?? 0.7;
    if (GDC_sat > thresh) {
      const excess = GDC_sat - thresh;
      Vcmax_fb /= 1 + Math.pow(excess / (1 - thresh), 2) * (params.glyox_Ki_scale ?? 0.15);
    }
  }
  const Wc_fb = (Vcmax_fb * k.Cc) / (k.Cc + k.Kc * (1 + k.Oc / k.Ko));
  const Wmin_fb = Math.min(Wc_fb, Wj_fb);
  const A_fb = Wmin_fb - k.Rd;
  const vovc_fb = (k.Oc * 1000) / (k.Srel * Math.max(k.Cc, 0.1));
  return {
    A: A_fb,
    Wc: Wc_fb,
    Wj: Wj_fb,
    Vcmax_eff: Vcmax_fb,
    vovc: vovc_fb,
    Vc: Wmin_fb,
    Vo: Wmin_fb * vovc_fb,
    Rd: k.Rd,
    limitState: Wc_fb <= Wj_fb ? 'Rubisco' : 'RuBP',
    dA_feedback: A_fb - k.A,
    J: k.J,
    gammastar: k.gammastar,
    Kc: k.Kc,
    Ko: k.Ko,
    Cc: k.Cc,
    Oc: k.Oc,
    Vcmax25: k.Vcmax25,
    Jmax: k.Jmax,
    Srel: k.Srel
  };
}
