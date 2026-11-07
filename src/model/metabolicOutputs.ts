// MODULE 7: metabolicOutputs()
//
// Ported byte-for-byte from photosynthesis_model.html (lines 844-901).
//
// Note on BUG FIX #1 (see bypass/mcg.ts): this function already applies a
// fate-split fraction (`f_acetylCoA_FA`, default 0.60) to `acetylCoA_total`
// to split carbon between fatty acids and export for the McG pathway — that
// part of the original code was correct and is unchanged here. The bug was
// upstream, in bypassMcG() pre-multiplying `acetylCoA_modeA` (production)
// by a *different* fraction (`acetylCoA_fate_lipid`) before it ever reached
// this function. With that fixed, `acetylCoA_total` now carries the full
// 1:1 AcCoA production and this function's existing fate split is the only
// place lipid/export partitioning happens for the carbon-output metrics.

import { _clamp } from './constants';
import type { BypassOutput, Env, KinOutput, MetabolicOutputsResult, Params } from './types';

export function metabolicOutputs(
  k: KinOutput,
  bp: BypassOutput | null | undefined,
  env: Env,
  params: Params = {}
): MetabolicOutputsResult {
  const btype = bp?.bypass_type ?? 'none';
  const f_gc = (params.f_glycerate_calvin as number) ?? 0.95;
  const f_MDH = (params.f_OAA_MDH as number) ?? 0.5;
  const f_Asp = (params.f_OAA_AspAT as number) ?? 0.45;
  const f_FA = (params.f_acetylCoA_FA as number) ?? 0.6;
  let C_cal = 0,
    C_FA = 0,
    C_aa = 0,
    C_exp = 0,
    NADH_net = 0,
    NADPH_net = 0;
  if (btype === 'kebeish') {
    const g = (bp?.glycerate_bypass as number) ?? 0;
    C_cal = g * 3 * f_gc;
    C_exp = g * 3 * (1 - f_gc);
    NADH_net = -((bp?.bypass_flux as number) ?? 0) * 0.5;
  } else if (btype === 'south') {
    C_cal = ((bp?.malate_decarboxylated as number) ?? 0) * 4 * 0.4;
    C_exp = ((bp?.malate_exported as number) ?? 0) * 4;
    NADH_net = (bp?.NADH_net as number) ?? 0;
  } else if (btype === 'cbhac') {
    const OAA = (bp?.OAA_flux as number) ?? 0;
    C_exp = OAA * 4 * f_MDH;
    C_aa = OAA * 4 * f_Asp;
    NADH_net = (bp?.NADH_net as number) ?? 0;
    NADPH_net = (bp?.NADPH_net as number) ?? 0;
  } else if (btype === 'mcg') {
    const AcCoA = (bp?.acetylCoA_total as number) ?? 0;
    C_FA = AcCoA * 2 * f_FA;
    C_exp = AcCoA * 2 * (1 - f_FA);
    C_aa = ((bp?.OAA_from_modeB as number) ?? 0) * 4 * f_Asp;
    C_cal = ((bp?.CO2_fixed_modeB as number) ?? 0) * 0.7;
    NADH_net = (bp?.NADH_net as number) ?? 0;
    NADPH_net = (bp?.NADPH_net as number) ?? 0;
  }
  const N_conserved = (bp?.NH3_saving as number) ?? 0;
  const ATP_net = ((bp?.ATP_saving as number) ?? 0) - ((bp?.ATP_consumed as number) ?? 0);
  const NADH_native = k.Vo * 0.5;
  const redox_pressure = _clamp(NADH_native > 0 ? 0.5 + (NADH_net / NADH_native) * 0.3 : 0.5, 0, 1);
  return {
    carbon_to_calvin: +C_cal.toFixed(4),
    carbon_to_fatty_acids: +C_FA.toFixed(4),
    carbon_to_amino_acids: +C_aa.toFixed(4),
    carbon_exported: +C_exp.toFixed(4),
    OAA_to_malate: btype === 'cbhac' ? +(((bp?.OAA_flux as number) ?? 0) * f_MDH).toFixed(4) : 0,
    OAA_to_aspartate: btype === 'cbhac' ? +(((bp?.OAA_flux as number) ?? 0) * f_Asp).toFixed(4) : 0,
    nitrogen_conserved: +N_conserved.toFixed(4),
    NADH_net: +NADH_net.toFixed(4),
    NADPH_net: +NADPH_net.toFixed(4),
    redox_pressure: +redox_pressure.toFixed(4),
    ATP_net: +ATP_net.toFixed(4),
    risk_glyoxylate: (bp?.risk_glyoxylate as number) ?? 0,
    risk_OAA: (bp?.risk_OAA as number) ?? 0,
    risk_malate_valve: +_clamp(C_exp / ((params.DiT_capacity as number) ?? 30) / 4, 0, 1).toFixed(3)
  };
}
