// MODULE 4: trxfState() [At✓ Xi 2026; Yoshida 2015; Michelet 2013]
//
// Ported byte-for-byte from photosynthesis_model.html (lines 482-500).

import { _clamp } from './constants';
import type { Env, MetabolicOutputsResult, Params, TrxfOutput } from './types';

export function trxfState(
  env: Env,
  mo: Partial<MetabolicOutputsResult> | null | undefined,
  params: Params = {}
): TrxfOutput {
  const floor = params.trxf_dark_floor ?? 0.1;
  const sat = params.trxf_light_sat ?? 0.95;
  const half = params.trxf_half_light ?? 80;
  const steep = params.trxf_steepness ?? 0.03;
  const sig = 1 / (1 + Math.exp(-steep * (Math.max(0, env.light) - half)));
  const trxf_light = floor + (sat - floor) * sig;
  const bypass_correction =
    (mo?.NADH_net ?? 0) * (params.trxf_NADH_sensitivity ?? 0.02) +
    (mo?.NADPH_net ?? 0) * (params.trxf_NADPH_sensitivity ?? 0.05);
  const trxf_red = _clamp(trxf_light + bypass_correction, 0, 1);
  const rca_alpha = params.rca_alpha_fraction ?? 0.5;
  const rca_dark = params.rca_dark_min ?? 0.2;
  const vcmax_rca_scale = rca_alpha * (rca_dark + trxf_red * (1 - rca_dark)) + (1 - rca_alpha);
  const cbb_dark = params.cbb_regen_dark_min ?? 0.15;
  return {
    trxf_red,
    vcmax_rca_scale,
    cbb_regen_activation: cbb_dark + trxf_red * (1 - cbb_dark)
  };
}
