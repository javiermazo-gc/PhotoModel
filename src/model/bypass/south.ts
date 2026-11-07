// MODULE 6b: bypassSouth() — South 2019 AP3 [sp:tobacco Science 363:eaat9077]
// CrGDH + CuMS: glycolate -> malate (NOT glycerate, NOT direct CO2)
// CO2 from NADP-ME decarboxylating malate (conditional, fraction param)
// PLGG1 RNAi optional — retains glycolate for bypass
//
// Ported byte-for-byte from photosynthesis_model.html (lines 614-681).
//
// DOCUMENTED PHENOTYPE — South 2019 metabolomics (Fig. S5):
//   AP3 lines showed ELEVATED stromal glyoxylate AND reduced serine + glycerate.
//   Cause: CuMS (malate synthase) can become rate-limiting relative to CrGDH,
//   allowing stromal glyoxylate to accumulate before MS processes it.
//   Consequence: free glyoxylate inhibits RuBisCO — activates risk_glyoxylate.
//   Reduced serine + glycerate = native PR suppressed = native_GOX_flux reduced
//   (consistent with bypass diverting glycolate away from peroxisome).
//   -> risk_glyoxylate is the CORRECT flag for this phenotype. NOT a code error.

import { _arr } from '../constants';
import type { BypassOutput, Env, KinOutput, Params, PhotoRespKineticOutput, PhotoRespOutput } from '../types';
import { _A_bypass_estimate, _lambdaCorrect } from './shared';

export function bypassSouth(
  k: KinOutput,
  pr: PhotoRespOutput,
  prk: PhotoRespKineticOutput | null | undefined,
  env: Env,
  params: Params = {}
): BypassOutput {
  const Tk = env.temp + 273.15;
  const Km_gly = params.bypass_Km_glycolate ?? 0.3;
  const Vmax25 = params.bypass_enzyme_Vmax25 ?? 5;
  const malate_dec = (params.malate_decarb_fraction as number) ?? 0.7; // [est] range 0.30-1.0
  const plgg1 = (params.plgg1_suppression as number) ?? 0; // [est] PLGG1 RNAi fraction
  const refix = params.refix_efficiency ?? 0.6;
  const bp_Vmax = Vmax25 * _arr((params.bypass_Ha as number) ?? 55000, Tk);
  const gly_pool = (prk?.glycolate_pool ?? 0.02) * (1 + plgg1 * 0.3);
  const bp_raw = (bp_Vmax * gly_pool) / (Km_gly + gly_pool);
  const bypass_flux = Math.min(bp_raw, pr.flux_glycolate);
  const bypass_fraction = pr.flux_glycolate > 0 ? bypass_flux / pr.flux_glycolate : 0;
  const native_GOX_flux = pr.flux_glycolate - bypass_flux;
  const malate_bypass = bypass_flux;
  const malate_decarboxylated = malate_bypass * malate_dec;
  const malate_exported = malate_bypass * (1 - malate_dec);
  const CO2_bypass = malate_decarboxylated;
  const nf = pr.flux_glycolate > 0 ? native_GOX_flux / pr.flux_glycolate : 1;
  const CO2_native = pr.flux_CO2_rel * nf;
  const NH3_native = pr.flux_NH3 * nf;
  const NH3_saving = pr.flux_NH3 - NH3_native;
  const { lambda_eff, gammastar_eff } = _lambdaCorrect(k, bypass_fraction);
  const A_bypass = _A_bypass_estimate(
    k,
    CO2_bypass,
    refix,
    pr.flux_CO2_rel - CO2_native,
    (params.refix_mito as number) ?? 0.3,
    gammastar_eff
  );
  return {
    bypass_type: 'south',
    bypass_flux,
    bypass_fraction,
    native_GOX_flux,
    malate_bypass,
    malate_decarboxylated,
    malate_exported,
    CO2_bypass,
    glycerate_bypass: 0,
    OAA_flux: 0,
    OAA_to_malate: malate_exported,
    OAA_to_aspartate: 0,
    CO2_native,
    NH3_native,
    NH3_saving,
    ATP_saving: NH3_saving * 3,
    NADH_net: bypass_flux * 0.5,
    NADPH_net: 0,
    lambda_eff,
    gammastar_eff,
    A_bypass,
    bypass_placeholder: true,
    bypass_note: [
      `CrGDH+CuMS Vmax=${Vmax25}${Vmax25 === 5 ? ' ⚠ placeholder' : ''}`,
      `malate_decarb=${malate_dec.toFixed(2)} [est]`,
      plgg1 > 0 ? `PLGG1 RNAi=${(plgg1 * 100).toFixed(0)}%` : null,
      `⚠ AP3 lines show elevated stromal glyoxylate (South 2019) — CuMS can be rate-limiting — see risk_glyoxylate`
    ]
      .filter(Boolean)
      .join('; ')
  };
}
