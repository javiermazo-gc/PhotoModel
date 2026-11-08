// Core type definitions for the FvCB kinetic model.
//
// `Params` is intentionally permissive: almost every field is optional and
// defaulted inside the model functions via `??`, matching the original
// single-file prototype where params is a loose bag of overrides. Keeping
// it as a real (if wide) interface — rather than `Record<string, number>` —
// still gives autocomplete and catches typos in known field names, while
// `[key: string]: unknown` keeps the door open for bypass-specific or
// future params without needing to touch this file every time.

export interface Env {
  /** Ambient CO2, ppm */
  co2: number;
  /** Ambient O2, % (e.g. 21) */
  o2: number;
  /** Leaf temperature, °C */
  temp: number;
  /** Photosynthetically active radiation, µmol photons/m²/s */
  light: number;
  /** Internal CO2 as % of saturating (stomatal/Pi limitation knob), 0-100 */
  pi?: number;
  /** RuBisCO activation state, 0-100 */
  act?: number;
}

export type BypassType = 'kebeish' | 'south' | 'cbhac' | 'mcg';

export interface Params {
  // kin() — FvCB core
  Kc25?: number;
  Ko25?: number;
  GS25?: number;
  Srel25?: number;
  Vcmax25?: number;
  Jmax_Vcmax_ratio?: number;
  alpha?: number;
  theta?: number;
  /** Electron-transport formulation for J. Default 'fvcb' (empirical
   *  non-rectangular hyperbola, uses alpha/theta/Jmax). 'johnson_berry'
   *  uses cytochrome-b6f capacity instead — see docs/proposals/johnson_berry.md. */
  photochemistry_model?: 'fvcb' | 'johnson_berry';
  /** Johnson-Berry only: max cytochrome b6f electron flow at 25C, µmol e-/m²/s.
   *  Defaults to 1.4 x Jmax25 [est sp:multi] if unset. */
  Cb6f_max25?: number;
  /** Johnson-Berry only: fraction of absorbed irradiance reaching PSI.
   *  Defaults to the same value as `alpha` if unset. */
  alpha1?: number;
  Rd_fraction?: number;
  ci_ca?: number;
  Cc_Ci?: number;
  Tp25?: number | null;
  Tp25_off?: boolean;

  // photoRespKinetic()
  GOX_Vmax25?: number;
  GOX_Km_gly?: number;
  GOX_Km_O2?: number;
  GDC_Vmax25?: number;
  GDC_Km_gly?: number;
  GGAT_Vmax25?: number;
  GGAT_Km_glyox?: number;
  HPR1_Vmax25?: number;
  HPR1_Km_HP?: number;
  PGLP_Km_2PG?: number;
  PGLP_Vmax25?: number;
  PGLP_redox_base?: number;
  PGLP_redox_k?: number;

  // trxfState()
  trxf_dark_floor?: number;
  trxf_light_sat?: number;
  trxf_half_light?: number;
  trxf_steepness?: number;
  trxf_NADH_sensitivity?: number;
  trxf_NADPH_sensitivity?: number;
  rca_alpha_fraction?: number;
  rca_dark_min?: number;
  cbb_regen_dark_min?: number;

  // kinFeedback()
  disable_2pg?: boolean;
  Ki_TPI?: number;
  Ki_SBPase?: number;
  disable_trxf?: boolean;
  disable_gdc?: boolean;
  gdc_threshold?: number;
  glyox_Ki_scale?: number;

  // bypass() / bypassSouth() / bypassBHAC() / bypassMcG() — shared
  bypass_active?: boolean;
  bypass_type?: BypassType;
  bypass_Km_glycolate?: number;
  bypass_enzyme_Vmax25?: number;
  bypass_Ha?: number;
  refix_efficiency?: number;
  refix_mito?: number;

  // bypassSouth()
  malate_decarb_fraction?: number;
  plgg1_suppression?: number;

  // bypassBHAC()
  f_OAA_MDH?: number;
  f_OAA_AspAT?: number;
  AspAT_capacity?: number;
  glyox_downstream_capacity?: number;

  // bypassMcG()
  acetylCoA_fate_lipid?: number;
  pep_fraction?: number;
  Ppc_Vmax25?: number;
  Ppc_Km_PEP?: number;
  Ppc_Ha?: number;

  // metabolicOutputs()
  f_glycerate_calvin?: number;
  f_acetylCoA_FA?: number;
  DiT_capacity?: number;

  // allow bypass-specific or future overrides without widening every call site
  [key: string]: unknown;
}

/** Output of kin() — the frozen FvCB core. */
export interface KinOutput {
  Vc: number;
  Vo: number;
  Wc: number;
  Wj: number;
  Wp: number | null;
  J: number;
  A: number;
  Rd: number;
  vovc: number;
  gammastar: number;
  Kc: number;
  Ko: number;
  Cc: number;
  Oc: number;
  Srel: number;
  Vcmax_eff: number;
  Vcmax25: number;
  Vomax: number;
  Jmax: number;
  limitState: 'Rubisco' | 'RuBP' | 'TPU';
  belowCompPt: boolean;
  /** Which J formulation was used — see photochemistry_model in Params. */
  photochemistryModel: 'fvcb' | 'johnson_berry';
  /** Johnson-Berry only: PSI:PSII electron transport ratio. null under 'fvcb'. */
  eta: number | null;
  /** Johnson-Berry only: temperature-adjusted cytochrome b6f capacity. null under 'fvcb'. */
  Cb6fmax: number | null;
}

/** Output of photoResp() — stoichiometric-only photorespiration fluxes. */
export interface PhotoRespOutput {
  flux_2PG: number;
  flux_glycolate: number;
  flux_glyoxylate: number;
  flux_glycine: number;
  flux_serine: number;
  flux_CO2_rel: number;
  flux_NH3: number;
  flux_glycerate: number;
  flux_3PGA_rec: number;
  cost_ATP: number;
  cost_reductant: number;
  carbon_loss: number;
  carbon_loss_pct: number;
}

/** Output of photoRespKinetic() — enzyme-level saturation & pool sizes. */
export interface PhotoRespKineticOutput {
  GOX_rate: number;
  GOX_sat: number;
  GDC_rate: number;
  GDC_sat: number;
  GGAT_rate: number;
  GGAT_sat: number;
  HPR_rate: number;
  HPR1_sat: number;
  PGLP_rate: number;
  PGLP_sat: number;
  pool_2PG: number;
  glycolate_pool: number;
  glycine_pool: number;
  glyoxylate_pool: number;
  HP_pool: number;
  f_redox: number;
  flux_CO2_rel: number;
  flux_NH3: number;
  flux_glycerate: number;
}

/** Output of trxfState() — thioredoxin f redox state. */
export interface TrxfOutput {
  trxf_red: number;
  vcmax_rca_scale: number;
  cbb_regen_activation: number;
}

/** Output of kinFeedback() — kin() re-run with the three feedback loops applied. */
export interface KinFeedbackOutput {
  A: number;
  Wc: number;
  Wj: number;
  Vcmax_eff: number;
  vovc: number;
  Vc: number;
  Vo: number;
  Rd: number;
  limitState: 'Rubisco' | 'RuBP';
  dA_feedback: number;
  J: number;
  gammastar: number;
  Kc: number;
  Ko: number;
  Cc: number;
  Oc: number;
  Vcmax25: number;
  Jmax: number;
  Srel: number;
}

/**
 * Output of any bypass*() function. Each bypass design returns a different
 * subset of fields (see docs/01_architecture.md for the stoichiometry of
 * each), so this stays a loose/partial shape rather than a strict union —
 * the original prototype reads every field through `bp?.field ?? default`
 * in runModel() for exactly this reason.
 */
export interface BypassOutput {
  bypass_type: BypassType;
  bypass_flux: number;
  bypass_fraction: number;
  native_GOX_flux: number;
  CO2_bypass?: number;
  CO2_native?: number;
  CO2_total?: number;
  glycerate_bypass?: number;
  NH3_native?: number;
  NH3_saving?: number;
  ATP_saving?: number;
  ATP_consumed?: number;
  lambda_eff?: number;
  gammastar_eff?: number;
  A_bypass?: number;
  NADH_net?: number;
  NADPH_net?: number;
  bypass_placeholder?: boolean;
  bypass_note?: string;
  risk_glyoxylate?: number;
  risk_OAA?: number;
  OAA_flux?: number;
  OAA_to_malate?: number;
  OAA_to_aspartate?: number;
  [key: string]: unknown;
}

/** Output of metabolicOutputs(). */
export interface MetabolicOutputsResult {
  carbon_to_calvin: number;
  carbon_to_fatty_acids: number;
  carbon_to_amino_acids: number;
  carbon_exported: number;
  OAA_to_malate: number;
  OAA_to_aspartate: number;
  nitrogen_conserved: number;
  NADH_net: number;
  NADPH_net: number;
  redox_pressure: number;
  ATP_net: number;
  risk_glyoxylate: number;
  risk_OAA: number;
  risk_malate_valve: number;
}

/**
 * The flat output shape returned by runModel() — everything the UI reads.
 * Kept as a permissive Record rather than fully enumerated: the original
 * prototype treats this as one big flat bag of ~90 fields consumed
 * ad-hoc by the SVG map and metric cards, and over-specifying it here
 * would not catch any real bugs (every consumer already needs to handle
 * missing/zero fields via `?? 0`).
 */
export type ModelOutput = Record<string, number | string | boolean | null>;
