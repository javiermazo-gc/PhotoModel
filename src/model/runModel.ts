// MAIN runModel() — the single entry point.
//
// Module chain: kin() -> photoResp() -> photoRespKinetic() -> bypass*() ->
// metabolicOutputs() -> trxfState() -> kinFeedback() -> flat output object.
//
// Ported byte-for-byte from photosynthesis_model.html (lines 904-1001).
// Also re-exports runScenario()/compareScenarios()/SCENARIOS (lines 1004-1105).

import { kin } from './kin';
import { photoResp, photoRespKinetic } from './photoResp';
import { bypassKebeish } from './bypass/kebeish';
import { bypassSouth } from './bypass/south';
import { bypassBHAC } from './bypass/cbhac';
import { bypassMcG } from './bypass/mcg';
import { metabolicOutputs } from './metabolicOutputs';
import { trxfState } from './trxfState';
import { kinFeedback } from './kinFeedback';
import { _clamp } from './constants';
import type { BypassOutput, BypassType, Env, ModelOutput, Params } from './types';

export function runModel(env: Env, params: Params = {}): ModelOutput {
  const k = kin(env, params);
  const pr = photoResp(k);
  const prk = photoRespKinetic(k, pr, env, params);
  let bp: BypassOutput | null = null;
  if (params.bypass_active) {
    const bt: BypassType = params.bypass_type ?? 'kebeish';
    if (bt === 'kebeish') bp = bypassKebeish(k, pr, prk, env, params);
    else if (bt === 'south') bp = bypassSouth(k, pr, prk, env, params);
    else if (bt === 'cbhac') bp = bypassBHAC(k, pr, prk, env, params);
    else if (bt === 'mcg') bp = bypassMcG(k, pr, prk, env, params);
  }
  const mo = metabolicOutputs(k, bp, env, params);
  const trxf = trxfState(env, mo, params);
  const kfb = kinFeedback(k, prk, trxf, env, params);
  const redox_pressure = _clamp(0.5 + (mo.NADH_net / Math.max(k.Vo * 0.5, 0.001)) * 0.3, 0, 1);
  return {
    A: kfb.A,
    A_fvCB: k.A,
    A_bypass: (bp?.A_bypass as number) ?? kfb.A,
    Wc: kfb.Wc,
    Wj: kfb.Wj,
    Wp: k.Wp,
    limitState: kfb.limitState,
    Vc: kfb.Vc,
    Vo: kfb.Vo,
    vovc: kfb.vovc,
    gammastar: k.gammastar,
    gammastar_eff: (bp?.gammastar_eff as number) ?? k.gammastar,
    lambda_eff: (bp?.lambda_eff as number) ?? 0.5,
    Cc: k.Cc,
    Vcmax_eff: kfb.Vcmax_eff,
    Vcmax25: k.Vcmax25,
    J: k.J,
    Rd: kfb.Rd,
    dA_feedback: kfb.dA_feedback,
    trxf_red: trxf.trxf_red,
    redox_pressure,
    flux_glycolate: pr.flux_glycolate,
    native_GOX_flux: (bp?.native_GOX_flux as number) ?? pr.flux_glycolate,
    flux_glycine: (bp?.native_GOX_flux as number) ?? pr.flux_glycolate,
    flux_serine: ((bp?.native_GOX_flux as number) ?? pr.flux_glycolate) * 0.5,
    flux_CO2_rel: bp ? (bp.CO2_native as number) ?? pr.flux_CO2_rel : prk.flux_CO2_rel,
    flux_NH3: bp ? (bp.NH3_native as number) ?? pr.flux_NH3 : prk.flux_NH3,
    flux_glycerate: prk.flux_glycerate ?? pr.flux_glycerate,
    flux_3PGA_rec: pr.flux_3PGA_rec,
    carbon_loss_pct: pr.carbon_loss_pct,
    pool_2PG: prk.pool_2PG,
    glycolate_pool: prk.glycolate_pool,
    glycine_pool: prk.glycine_pool,
    glyoxylate_pool: prk.glyoxylate_pool,
    HP_pool: prk.HP_pool,
    GOX_sat: prk.GOX_sat,
    GDC_sat: prk.GDC_sat,
    GGAT_sat: prk.GGAT_sat,
    HPR1_sat: prk.HPR1_sat,
    PGLP_sat: prk.PGLP_sat,
    PGLP_f_redox: prk.f_redox,
    bypass_active: params.bypass_active ?? false,
    bypass_type: bp?.bypass_type ?? null,
    bypass_flux: (bp?.bypass_flux as number) ?? 0,
    bypass_fraction: (bp?.bypass_fraction as number) ?? 0,
    CO2_bypass: (bp?.CO2_bypass as number) ?? 0,
    glycerate_bypass: (bp?.glycerate_bypass as number) ?? 0,
    flux_glyoxylate_k: (bp?.flux_glyoxylate_k as number) ?? 0,
    flux_tartronate: (bp?.flux_tartronate as number) ?? 0,
    flux_glycerate_k: (bp?.flux_glycerate_k as number) ?? 0,
    flux_3pga_k: (bp?.flux_3pga_k as number) ?? 0,
    // McG intermediates
    flux_malylCoA: (bp?.flux_malylCoA as number) ?? 0,
    flux_malate_mcg: (bp?.flux_malate_mcg as number) ?? 0,
    flux_malate_export: (bp?.flux_malate_export as number) ?? 0,
    flux_tartronate_mcg: (bp?.flux_tartronate_mcg as number) ?? 0,
    flux_glycerate_mcg: (bp?.flux_glycerate_mcg as number) ?? 0,
    flux_3pga_mcg: (bp?.flux_3pga_mcg as number) ?? 0,
    malate_bypass: (bp?.malate_bypass as number) ?? 0,
    malate_decarboxylated: (bp?.malate_decarboxylated as number) ?? 0,
    malate_exported: (bp?.malate_exported as number) ?? 0,
    OAA_flux: (bp?.OAA_flux as number) ?? 0,
    OAA_to_malate: (bp?.OAA_to_malate as number) ?? 0,
    OAA_to_aspartate: (bp?.OAA_to_aspartate as number) ?? 0,
    acetylCoA_total: (bp?.acetylCoA_total as number) ?? 0,
    acetylCoA_modeA: (bp?.acetylCoA_modeA as number) ?? 0,
    acetylCoA_modeB: (bp?.acetylCoA_modeB as number) ?? 0,
    modeB_flux: (bp?.modeB_flux as number) ?? 0,
    CO2_fixed_modeB: (bp?.CO2_fixed_modeB as number) ?? 0,
    CO2_total: (bp?.CO2_total as number) ?? pr.flux_CO2_rel,
    NH3_saving: (bp?.NH3_saving as number) ?? 0,
    bypass_placeholder: (bp?.bypass_placeholder as boolean) ?? false,
    bypass_note: (bp?.bypass_note as string) ?? null,
    carbon_to_amino_acids: mo.carbon_to_amino_acids,
    carbon_to_fatty_acids: mo.carbon_to_fatty_acids,
    carbon_exported: mo.carbon_exported,
    nitrogen_conserved: mo.nitrogen_conserved,
    ATP_net: mo.ATP_net,
    NADH_net: mo.NADH_net,
    risk_glyoxylate: mo.risk_glyoxylate,
    risk_OAA: mo.risk_OAA,
    risk_malate_valve: mo.risk_malate_valve
  };
}

// ─── Scenario manager ───────────────────────────────────────────────────
export interface Scenario {
  label: string;
  params: Params;
}

export const SCENARIOS: Record<string, Scenario> = {
  WT: { label: 'Wild type (Col-0)', params: {} },
  PGLP1_OE: { label: 'PGLP1-OE (144% Vmax) [At✓]', params: { PGLP_Vmax25: 432 } },
  PGLP1_AS: { label: 'PGLP1-AS (9% Vmax) [At✓]', params: { PGLP_Vmax25: 27 } },
  GDC_H_OE: { label: 'GDC-H OE [At✓]', params: { GDC_Vmax25: 345 } },
  KEBEISH: {
    label: 'Kebeish (EcGlcDEF) [At✓]',
    params: { bypass_active: true, bypass_type: 'kebeish', bypass_enzyme_Vmax25: 5 }
  },
  SOUTH_AP3: {
    label: 'South AP3 (CrGDH+CuMS) [sp:tobacco]',
    params: { bypass_active: true, bypass_type: 'south', bypass_enzyme_Vmax25: 5, malate_decarb_fraction: 0.7 }
  },
  SOUTH_AP3_PLGG1: {
    label: 'South AP3 + PLGG1 RNAi (+40%) [sp:tobacco]',
    params: {
      bypass_active: true,
      bypass_type: 'south',
      bypass_enzyme_Vmax25: 10,
      malate_decarb_fraction: 0.7,
      plgg1_suppression: 0.6
    }
  },
  CBHAC: {
    label: 'cBHAC (CrGDH+BhcA-D) [sp:rice]',
    params: { bypass_active: true, bypass_type: 'cbhac', bypass_enzyme_Vmax25: 5 }
  },
  PGLP1_OE_CBHAC: {
    label: 'PGLP1-OE + cBHAC',
    params: { PGLP_Vmax25: 432, bypass_active: true, bypass_type: 'cbhac', bypass_enzyme_Vmax25: 5 }
  },
  MCG: {
    label: 'McG dual cycle [At✓ Lu 2025]',
    params: { bypass_active: true, bypass_type: 'mcg', bypass_enzyme_Vmax25: 5, pep_fraction: 0.1 }
  },
  MCG_HIGH: {
    label: 'McG high expression [At✓ Lu 2025]',
    params: { bypass_active: true, bypass_type: 'mcg', bypass_enzyme_Vmax25: 20, Ppc_Vmax25: 20, pep_fraction: 0.18 }
  }
};

export interface ScenarioResult extends ModelOutput {
  scenario: string;
  label: string;
}

export function runScenario(name: string, env: Env, extra: Params = {}): ScenarioResult {
  const sc = SCENARIOS[name];
  if (!sc) throw new Error(`Unknown scenario: ${name}`);
  return {
    scenario: name,
    label: sc.label,
    ...runModel(env, { ...sc.params, ...extra })
  };
}

export function compareScenarios(names: string[], env: Env): ScenarioResult[] {
  return names.map((n) => runScenario(n, env)).sort((a, b) => (b.A as number) - (a.A as number));
}
