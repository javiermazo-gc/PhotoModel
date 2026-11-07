// Shared bypass helpers — ported byte-for-byte from photosynthesis_model.html
// (lines 550-558): _lambdaCorrect() and _A_bypass_estimate().

import type { KinOutput } from '../types';

export function _lambdaCorrect(k: KinOutput, bypass_fraction: number) {
  return {
    lambda_eff: 0.5 * (1 - bypass_fraction),
    gammastar_eff: k.gammastar * (1 - bypass_fraction * 0.5)
  };
}

export function _A_bypass_estimate(
  k: KinOutput,
  CO2_bypass: number,
  refix: number,
  CO2_saved_mito: number,
  refix_mito: number,
  gammastar_eff: number
): number {
  return (
    k.A +
    CO2_bypass * refix +
    CO2_saved_mito * refix_mito +
    ((k.gammastar - gammastar_eff) * k.Vcmax_eff) / (k.Cc + k.Kc * (1 + k.Oc / k.Ko))
  );
}
