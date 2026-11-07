// MODULE 6a: bypassKebeish() — Kebeish [At✓ Kebeish 2007 Nat Biotechnol]
// Originally named bypass() in the prototype. Renamed for clarity; logic
// ported byte-for-byte from photosynthesis_model.html (lines 560-612).
// CORRECTED (pre-existing, already fixed before this port):
// glycerate_bypass=bypass_flux/2; NADH_net=-bypass_flux*0.5

import { _arr } from '../constants';
import type { BypassOutput, Env, KinOutput, Params, PhotoRespKineticOutput, PhotoRespOutput } from '../types';
import { _A_bypass_estimate, _lambdaCorrect } from './shared';

export function bypassKebeish(
  k: KinOutput,
  pr: PhotoRespOutput,
  prk: PhotoRespKineticOutput | null | undefined,
  env: Env,
  params: Params = {}
): BypassOutput {
  const Tk = env.temp + 273.15;
  const Km_gly = params.bypass_Km_glycolate ?? 0.04;
  const Vmax25 = params.bypass_enzyme_Vmax25 ?? 5;
  const refix = params.refix_efficiency ?? 0.6;
  const bp_Vmax = Vmax25 * _arr((params.bypass_Ha as number) ?? 55000, Tk);
  const gly_pool = prk?.glycolate_pool ?? 0.02;
  const bp_raw = (bp_Vmax * gly_pool) / (Km_gly + gly_pool);
  const bypass_flux = Math.min(bp_raw, pr.flux_glycolate);
  const bypass_fraction = pr.flux_glycolate > 0 ? bypass_flux / pr.flux_glycolate : 0;
  const native_GOX_flux = pr.flux_glycolate - bypass_flux;
  const CO2_bypass = 0.5 * bypass_flux;
  const glycerate_bypass = 0.5 * bypass_flux; // CORRECTED: 1 glycerate per 2 glycolate
  const nf = pr.flux_glycolate > 0 ? native_GOX_flux / pr.flux_glycolate : 1;
  const NH3_native = pr.flux_NH3 * nf;
  const NH3_saving = pr.flux_NH3 - NH3_native;
  const { lambda_eff, gammastar_eff } = _lambdaCorrect(k, bypass_fraction);
  const CO2_saved_mito = pr.flux_CO2_rel * (1 - nf); // CO2 not released because native PR reduced
  const A_bypass = _A_bypass_estimate(
    k,
    CO2_bypass,
    refix,
    CO2_saved_mito,
    (params.refix_mito as number) ?? 0.3,
    gammastar_eff
  );
  // Kebeish SVG chain fluxes
  const flux_glyoxylate_k = bypass_flux;
  const flux_tartronate = bypass_flux * 0.5;
  const flux_3pga_k = flux_tartronate;
  return {
    bypass_type: 'kebeish',
    bypass_flux,
    bypass_fraction,
    native_GOX_flux,
    CO2_bypass,
    glycerate_bypass,
    flux_glyoxylate_k,
    flux_tartronate,
    flux_glycerate_k: flux_tartronate,
    flux_3pga_k,
    CO2_native: pr.flux_CO2_rel * nf,
    NH3_native,
    NH3_saving,
    ATP_saving: NH3_saving * 3,
    lambda_eff,
    gammastar_eff,
    A_bypass,
    NADH_net: -bypass_flux * 0.5,
    NADPH_net: 0,
    // CORRECTED: was -bypass_flux
    bypass_placeholder: true,
    bypass_note: `EcGlcDH Vmax=${Vmax25}${Vmax25 === 5 ? ' ⚠ placeholder' : ''}`
  };
}
