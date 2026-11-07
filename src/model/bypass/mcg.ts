// MODULE 6d: bypassMcG() — malyl-CoA-glycerate (MCG) cycle [At✓ Lu 2025 Science 389]
// The name tells you the key intermediates: malyl-CoA and glycerate.
// Mode A full chain [Lu 2025 Fig 1]:
//   CrGDH: Glycolate -> Glyoxylate
//   MTK:   Glyoxylate + AcCoA(cycling) -> Malyl-CoA  (malate thiokinase, reverse)
//   MCL:   Malyl-CoA -> Malate + CoA    (malyl-CoA lyase)
//   NADP-ME(or MDH): Malate -> Pyruvate/OAA (some carbon to lipids, rest to glycerate shunt)
//   GCL:   Glyoxylate -> Tartronate-SA + CO2  (SAME enzyme as Kebeish — native or transgene)
//   TSR:   Tartronate-SA -> Glycerate          (SAME as Kebeish)
//   GK:    Glycerate -> 3-PGA -> CBB            (SAME as Kebeish)
// Net Mode A: Glycolate -> AcCoA(net) + 3-PGA + CO2
// Mode B: 3PG -> OAA via Ppc (HCO3-, NOT CO2) — fixes additional CO2 [At✓ Lu 2025]
//
// Ported from photosynthesis_model.html (lines 739-842), with the two
// documented bugs from docs/02_errors_and_status.md / 04_future_improvements.md
// FIXED here (not left as TODOs):
//
// BUG FIX #1 (HIGH): acetylCoA_modeA was `bypass_flux * lipidFrac` — wrong.
//   1 AcCoA is produced per glycolate processed through Mode A (1:1
//   stoichiometry per Lu 2025); lipidFrac is the FATE split of that AcCoA
//   (lipids vs export), applied downstream in metabolicOutputs(), not here.
//   Fixed: `const acetylCoA_modeA = bypass_flux;`
//
// BUG FIX #2 (MEDIUM): A_bypass referenced `flux_3pga_mcg * 0.3` as an ad-hoc
//   bonus term. flux_3pga_mcg IS computed and returned here (unlike the
//   original prototype, where it was referenced in A_bypass's formula but
//   never defined in scope, producing `undefined * 0.3 = NaN`), but per the
//   documented fix we remove this invented term from A_bypass entirely
//   rather than inventing new biochemistry to replace it.

import { _arr } from '../constants';
import type { BypassOutput, Env, KinOutput, Params, PhotoRespKineticOutput, PhotoRespOutput } from '../types';
import { _lambdaCorrect } from './shared';

export function bypassMcG(
  k: KinOutput,
  pr: PhotoRespOutput,
  prk: PhotoRespKineticOutput | null | undefined,
  env: Env,
  params: Params = {}
): BypassOutput {
  const Tk = env.temp + 273.15;
  const Km_gly = params.bypass_Km_glycolate ?? 0.3;
  const Vmax25 = params.bypass_enzyme_Vmax25 ?? 5;
  const lipidFrac = (params.acetylCoA_fate_lipid as number) ?? 0.6;
  const pep_frac = (params.pep_fraction as number) ?? 0.1; // [est HIGH ⚠]
  const bp_Vmax = Vmax25 * _arr((params.bypass_Ha as number) ?? 55000, Tk);
  const gly_pool = prk?.glycolate_pool ?? 0.02;
  const total_glycolate = pr.flux_glycolate;
  const bp_raw = (bp_Vmax * gly_pool) / (Km_gly + gly_pool);
  const bypass_flux = Math.min(bp_raw, total_glycolate);
  const bypass_fraction = total_glycolate > 0 ? bypass_flux / total_glycolate : 0;
  const native_GOX_flux = total_glycolate - bypass_flux;

  // Mode A intermediates — 1:1 stoichiometry [Lu 2025]
  const flux_glyoxylate_mcg = bypass_flux;
  const flux_malylCoA = bypass_flux; // MTK step
  const flux_malate_mcg = bypass_flux; // MCL step -> malate
  const flux_malate_lipid = flux_malate_mcg * lipidFrac; // -> fatty acids
  const flux_malate_export = flux_malate_mcg * (1 - lipidFrac); // -> export/OAA
  // Glycerate shunt (GCL/TSR/GK — same enzymes as Kebeish, recycles glyoxylate)
  const flux_tartronate_mcg = bypass_flux * 0.5; // GCL: 2 glyox -> 1 tartr + CO2
  const CO2_mcg = bypass_flux * 0.5; // CO2 from GCL
  const flux_glycerate_mcg = flux_tartronate_mcg;
  const flux_3pga_mcg = flux_glycerate_mcg; // GK -> 3-PGA -> CBB
  // BUG FIX #1: net AcCoA production is 1:1 with bypass_flux. lipidFrac is
  // the downstream fate split (lipids vs export), applied in
  // metabolicOutputs(), NOT here.
  const acetylCoA_modeA = bypass_flux;

  // Mode B: PEP -> OAA via Ppc
  const PEP_flux = k.Wc * pep_frac;
  const Ppc_Vmax25 = (params.Ppc_Vmax25 as number) ?? Vmax25;
  const Ppc_Km_PEP = (params.Ppc_Km_PEP as number) ?? 0.15;
  const Ppc_VmaxT = Ppc_Vmax25 * _arr((params.Ppc_Ha as number) ?? 55000, Tk);
  const v_ppc = Math.min(PEP_flux, 0.99 * Ppc_VmaxT);
  const PEP_pool = (Ppc_Km_PEP * v_ppc) / (Ppc_VmaxT - v_ppc);
  const modeB_flux = Math.min((Ppc_VmaxT * PEP_pool) / (Ppc_Km_PEP + PEP_pool), PEP_flux);
  const acetylCoA_modeB = modeB_flux;
  const CO2_fixed_modeB = modeB_flux;
  const OAA_from_modeB = modeB_flux;
  const acetylCoA_total = acetylCoA_modeA + acetylCoA_modeB;
  const nf = total_glycolate > 0 ? native_GOX_flux / total_glycolate : 1;
  const CO2_native = pr.flux_CO2_rel * nf;
  const NH3_native = pr.flux_NH3 * nf;
  const NH3_saving = pr.flux_NH3 - NH3_native;
  const ATP_consumed = flux_malylCoA;
  const { lambda_eff, gammastar_eff } = _lambdaCorrect(k, bypass_fraction);
  const GS_d = k.Kc * (1 + k.Oc / k.Ko);
  // BUG FIX #2: the original `+ flux_3pga_mcg * 0.3` term referenced a value
  // that was never returned by this function, producing NaN. Removed per
  // the documented fix rather than inventing new biochemistry to replace it.
  const A_bypass =
    k.A +
    (pr.flux_CO2_rel - CO2_native) * ((params.refix_mito as number) ?? 0.3) +
    ((k.gammastar - gammastar_eff) * k.Vcmax_eff) / (k.Cc + GS_d) +
    modeB_flux * 0.5;
  return {
    bypass_type: 'mcg',
    bypass_flux,
    bypass_fraction,
    native_GOX_flux,
    flux_glyoxylate_mcg,
    flux_malylCoA,
    flux_malate_mcg,
    flux_malate_export,
    flux_malate_lipid,
    flux_tartronate_mcg,
    flux_glycerate_mcg,
    flux_3pga_mcg,
    CO2_mcg,
    acetylCoA_modeA,
    acetylCoA_modeB,
    acetylCoA_total: acetylCoA_modeA + acetylCoA_modeB,
    acetylCoA_lipid: flux_malate_lipid,
    modeB_flux,
    PEP_flux,
    PEP_pool,
    CO2_fixed_modeB,
    OAA_from_modeB,
    OAA_flux: OAA_from_modeB,
    OAA_to_malate: flux_malate_export,
    OAA_to_aspartate: 0,
    CO2_bypass: CO2_mcg,
    CO2_native,
    CO2_total: CO2_native + CO2_mcg - CO2_fixed_modeB,
    NH3_native,
    NH3_saving,
    ATP_consumed,
    NADH_net: bypass_flux * 0.5,
    NADPH_net: -acetylCoA_modeB,
    lambda_eff,
    gammastar_eff,
    A_bypass,
    bypass_placeholder: true,
    bypass_note: [`CrGDH Vmax=${Vmax25}${Vmax25 === 5 ? ' ⚠ placeholder' : ''}`, `pep_fraction=${pep_frac} [est HIGH ⚠]`].join('; ')
  };
}
