// MODULE 2: photoResp() [Ogren 1984; Leegood 1995]
// MODULE 3: photoRespKinetic() [GOX At✓ Jossier 2019; GDC At✓ Timm 2012; PGLP1 Xi 2026]
//
// Ported from photosynthesis_model.html (lines 396-479).
//
// BUG FIX #3 (LOW, docs/04_future_improvements.md "O2 Ha correction"):
// the Arrhenius enthalpy term for O2 solubility/dissolution used
// Ha = -16000 J/mol. The standard enthalpy of O2 dissolution is
// approximately -12600 J/mol. Changed below; everything else in this
// file is byte-for-byte identical to the original.

import { _arr } from './constants';
import type { Env, KinOutput, Params, PhotoRespKineticOutput, PhotoRespOutput } from './types';

export function photoResp(k: KinOutput): PhotoRespOutput {
  const Vo = Math.max(0, k.Vo);
  return {
    flux_2PG: Vo,
    flux_glycolate: 2 * Vo,
    flux_glyoxylate: 2 * Vo,
    flux_glycine: 2 * Vo,
    flux_serine: Vo,
    flux_CO2_rel: 0.5 * Vo,
    flux_NH3: Vo,
    flux_glycerate: Vo,
    flux_3PGA_rec: Vo,
    cost_ATP: 3 * Vo,
    cost_reductant: 2 * Vo,
    carbon_loss: 0.5 * Vo,
    carbon_loss_pct: k.Wc > 0 ? ((0.5 * Vo) / k.Wc) * 100 : 0
  };
}

export function photoRespKinetic(
  k: KinOutput,
  pr: PhotoRespOutput,
  env: Env,
  params: Params = {}
): PhotoRespKineticOutput {
  const Tk = env.temp + 273.15;
  const a = (Ha: number) => _arr(Ha, Tk);
  const GOX_Vmax = (params.GOX_Vmax25 ?? 350) * a(57000);
  const GOX_Km = params.GOX_Km_gly ?? 0.21;
  const GOX_KmO2 = params.GOX_Km_O2 ?? 0.27;
  // BUG FIX #3: -16000 -> -12600 J/mol (standard enthalpy of O2 dissolution).
  // Equivalent to the original inline `Math.exp(-16000/R*(1/T25-1/Tk))` form,
  // just expressed via the shared _arr() Arrhenius helper with the corrected Ha.
  const O2p = (env.o2 / 100) * 1.26 * _arr(-12600, Tk);
  const GOX_Veff = (GOX_Vmax * O2p) / (GOX_KmO2 + O2p);
  const gly_v = Math.min(pr.flux_glycolate, 0.99 * GOX_Veff);
  const glycolate_pool = (GOX_Km * gly_v) / (GOX_Veff - gly_v);
  const GOX_rate = (GOX_Veff * glycolate_pool) / (GOX_Km + glycolate_pool);
  const GOX_sat = GOX_rate / GOX_Vmax;
  const GDC_Vmax = (params.GDC_Vmax25 ?? 230) * a(65000);
  const GDC_Km = params.GDC_Km_gly ?? 3.5;
  const gdc_v = Math.min(2 * k.Vo, 0.99 * GDC_Vmax);
  const glycine_pool = (GDC_Km * gdc_v) / (GDC_Vmax - gdc_v);
  const GDC_rate_gly = (GDC_Vmax * glycine_pool) / (GDC_Km + glycine_pool);
  const GDC_rate = GDC_rate_gly / 2;
  const GDC_sat = GDC_rate_gly / GDC_Vmax;
  const GGAT_Vmax = (params.GGAT_Vmax25 ?? 150) * a(55000);
  const GGAT_Km = params.GGAT_Km_glyox ?? 0.2;
  const glyox_v = Math.min(GOX_rate, 0.99 * GGAT_Vmax);
  const glyoxylate_pool = (GGAT_Km * glyox_v) / (GGAT_Vmax - glyox_v);
  const GGAT_rate = (GGAT_Vmax * glyoxylate_pool) / (GGAT_Km + glyoxylate_pool);
  const GGAT_sat = GGAT_rate / GGAT_Vmax;
  const HPR_Vmax = (params.HPR1_Vmax25 ?? 200) * a(55000);
  const HPR_Km = params.HPR1_Km_HP ?? 0.08;
  const hpr_v = Math.min(GDC_rate, 0.99 * HPR_Vmax);
  const HP_pool = (HPR_Km * hpr_v) / (HPR_Vmax - hpr_v);
  const HPR_rate = (HPR_Vmax * HP_pool) / (HPR_Km + HP_pool);
  const HPR1_sat = HPR_rate / HPR_Vmax;
  const PGLP_Km = params.PGLP_Km_2PG ?? 0.272;
  const PGLP_Vmax = (params.PGLP_Vmax25 ?? 300) * a(55000);
  const rb = params.PGLP_redox_base ?? 0.65;
  const rk = params.PGLP_redox_k ?? 0.05;
  const I = Math.max(0, env.light);
  const f_redox =
    (rb + (1 - rb) * (1 - Math.exp(-rk * I))) / (rb + (1 - rb) * (1 - Math.exp(-rk * 100)));
  const PGLP_Veff = PGLP_Vmax * f_redox;
  const pglp_v = Math.min(k.Vo, 0.99 * PGLP_Veff);
  const pool_2PG = (PGLP_Km * pglp_v) / (PGLP_Veff - pglp_v);
  const PGLP_rate = (PGLP_Veff * pool_2PG) / (PGLP_Km + pool_2PG);
  const PGLP_sat = PGLP_rate / PGLP_Veff;
  return {
    GOX_rate,
    GOX_sat,
    GDC_rate,
    GDC_sat,
    GGAT_rate,
    GGAT_sat,
    HPR_rate,
    HPR1_sat,
    PGLP_rate,
    PGLP_sat,
    pool_2PG,
    glycolate_pool,
    glycine_pool,
    glyoxylate_pool,
    HP_pool,
    f_redox,
    flux_CO2_rel: GDC_rate,
    flux_NH3: GDC_rate * 2,
    flux_glycerate: HPR_rate
  };
}
