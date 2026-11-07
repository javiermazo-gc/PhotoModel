// MODULE 6c: bypassBHAC() — cBHAC [sp:rice Chen 2025 Plant Cell]
// CrGDH + BhcA-D. Net: 2 glycolate -> 1 OAA. No CO2, no NH3.
//
// Ported byte-for-byte from photosynthesis_model.html (lines 683-737).
// CORRECTED (pre-existing): gly_pool fallback 0.020 (was 0.032).

import { _arr } from '../constants';
import type { BypassOutput, Env, KinOutput, Params, PhotoRespKineticOutput, PhotoRespOutput } from '../types';
import { _A_bypass_estimate, _lambdaCorrect } from './shared';

export function bypassBHAC(
  k: KinOutput,
  pr: PhotoRespOutput,
  prk: PhotoRespKineticOutput | null | undefined,
  env: Env,
  params: Params = {}
): BypassOutput {
  const Tk = env.temp + 273.15;
  const Km_gly = params.bypass_Km_glycolate ?? 0.3;
  const Vmax25 = params.bypass_enzyme_Vmax25 ?? 5;
  const f_OAA_MDH = (params.f_OAA_MDH as number) ?? 0.5;
  const f_OAA_Asp = (params.f_OAA_AspAT as number) ?? 0.45;
  const bp_Vmax = Vmax25 * _arr((params.bypass_Ha as number) ?? 55000, Tk);
  const gly_pool = prk?.glycolate_pool ?? 0.02; // CORRECTED from 0.032
  const total_glycolate = pr.flux_glycolate;
  const bp_raw = (bp_Vmax * gly_pool) / (Km_gly + gly_pool);
  const bypass_flux = Math.min(bp_raw, total_glycolate);
  const bypass_fraction = total_glycolate > 0 ? bypass_flux / total_glycolate : 0;
  const native_GOX_flux = total_glycolate - bypass_flux;
  const OAA_flux = bypass_flux / 2;
  const NADH_consumed = bypass_flux / 2;
  const NADPH_consumed = OAA_flux * f_OAA_MDH;
  const OAA_to_malate = OAA_flux * f_OAA_MDH;
  const OAA_to_aspartate = OAA_flux * f_OAA_Asp;
  const nf = total_glycolate > 0 ? native_GOX_flux / total_glycolate : 1;
  const CO2_native = pr.flux_CO2_rel * nf;
  const NH3_native = pr.flux_NH3 * nf;
  const NH3_saving = pr.flux_NH3 - NH3_native;
  const { lambda_eff, gammastar_eff } = _lambdaCorrect(k, bypass_fraction);
  const A_bypass = _A_bypass_estimate(
    k,
    0,
    0,
    pr.flux_CO2_rel - CO2_native,
    (params.refix_mito as number) ?? 0.3,
    gammastar_eff
  );
  return {
    bypass_type: 'cbhac',
    bypass_flux,
    bypass_fraction,
    native_GOX_flux,
    OAA_flux,
    OAA_to_malate,
    OAA_to_aspartate,
    NADH_consumed,
    NADPH_consumed,
    CO2_bypass: 0,
    CO2_native,
    NH3_native,
    NH3_saving,
    ATP_saving: NH3_saving * 3,
    NADH_net: -NADH_consumed,
    NADPH_net: -NADPH_consumed,
    lambda_eff,
    gammastar_eff,
    A_bypass,
    risk_OAA: Math.min(1, OAA_flux / ((params.AspAT_capacity as number) ?? 7)),
    risk_glyoxylate: Math.min(1, bypass_flux / ((params.glyox_downstream_capacity as number) ?? 30) / 0.2),
    bypass_placeholder: true,
    bypass_note: `CrGDH Vmax=${Vmax25}${Vmax25 === 5 ? ' ⚠ placeholder' : ''}`
  };
}
