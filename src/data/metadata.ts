// Tooltip content, confidence-colour palette, and environment/parameter
// presets for the UI. Ported verbatim (data only, no biochemistry) from
// minimal_map_BACKUP_20261007.tsx (ARROW_INFO, NODE_INFO, MINFO, COL,
// CONF, CONF_LABEL, ENV_DEF, PAR_DEF, ECO_PRESETS, LIT_PRESETS).

import type { Env, Params } from '../model/types';

export interface ArrowInfo {
  name: string;
  ec?: string;
  rxn?: string;
  up?: string;
  down?: string;
  conf: 'high' | 'medium' | 'low' | 'placeholder';
  unc: string;
}

export const ARROW_INFO: Record<string, ArrowInfo> = {
  rubisco_c: {
    name: 'RuBisCO carboxylation',
    ec: '4.1.1.39',
    rxn: 'RuBP + CO₂ → 2× 3-PGA',
    up: '↑ CO₂ (Cc), ↑ Vcmax, ↑ activation state',
    down: '↑ O₂ competition, ↑ temp (Srel falls), stomatal closure',
    conf: 'high',
    unc: 'Kc/Ko/Γ* [C3 std Bernacchi 2002]. Vcmax25 [usr] — fit from your ACi curves.'
  },
  rubisco_o: {
    name: 'RuBisCO oxygenation',
    ec: '4.1.1.39',
    rxn: 'RuBP + O₂ → 2-PG + 3-PGA',
    up: '↑ O₂, ↑ temp, ↓ CO₂',
    down: '↑ CO₂, C4/CCM concentrating mechanisms',
    conf: 'medium',
    unc: 'Srel25=2590 [sp:spinach ⚠] — no direct Arabidopsis measurement.'
  },
  pgk_gapdh: {
    name: 'PGK + GAPDH (CBB reduction)',
    ec: '2.7.2.3 / 1.2.1.13',
    rxn: '3-PGA + ATP + NADPH → G3P + Pi',
    up: '↑ ATP, ↑ NADPH, light via thioredoxin',
    down: '↓ Pi (TPT blocked), darkness',
    conf: 'high',
    unc: 'Stoichiometry [At✓]. Pi limitation modelled via pi slider.'
  },
  regen: {
    name: 'RuBP regeneration (PRK)',
    ec: '2.7.1.19',
    rxn: 'G3P + 3 ATP → RuBP',
    up: '↑ ATP, light activates PRK via thioredoxin',
    down: '↓ Pi, darkness',
    conf: 'high',
    unc: 'Stoichiometry [At✓]. Trx f activation of PRK [At✓ Michelet 2013].'
  },
  pgpase: {
    name: '2-PG phosphatase (PGLP1)',
    ec: '3.1.3.18',
    rxn: '2-PG → Glycolate + Pi',
    up: '↑ 2-PG; Trx f light-activated [At✓ Xi 2026]',
    down: 'No known product inhibition',
    conf: 'placeholder',
    unc: 'Vmax25=300 µmol/m²/s [usr ⚠]. Km=0.272mM [sp:rice].'
  },
  gox_p: {
    name: 'Glycolate oxidase / CrGDH (bypass)',
    ec: '1.1.3.15',
    rxn: 'Glycolate + O₂ → Glyoxylate + H₂O₂ (native) OR Glycolate → Glyoxylate (bypass, no H₂O₂)',
    up: '↑ glycolate, ↑ O₂ (native); ↑ transgene expression (bypass)',
    down: 'Bypass routes divert glycolate before GOX step',
    conf: 'high',
    unc: 'Native GOX: Km=0.210mM [At✓ Jossier 2019]. CrGDH: electron acceptor unknown in planta [HIGH ⚠].'
  },
  ggat: {
    name: 'Glu:glyoxylate aminotransferase (GGAT)',
    ec: '2.6.1.4',
    rxn: 'Glyoxylate + Glu → Glycine + 2-OG',
    up: '↑ glyoxylate',
    down: 'Bypass reduces glyoxylate pool',
    conf: 'high',
    unc: 'Confirmed non-rate-limiting in Arabidopsis WT [At✓ Liepman 2003].'
  },
  hpr: {
    name: 'Hydroxypyruvate reductase (HPR1)',
    ec: '1.1.1.29',
    rxn: 'Hydroxypyruvate + NADH → Glycerate + NAD⁺',
    up: '↑ hydroxypyruvate, ↑ NADH',
    down: '↓ NADH supply',
    conf: 'high',
    unc: 'Confirmed non-rate-limiting [At✓ Timm lab]. Km=0.08mM [At✓].'
  },
  gdc_shmt: {
    name: 'GDC + SHMT (mitochondria)',
    ec: '1.4.4.2 / 2.1.2.1',
    rxn: '2 Gly → Ser + CO₂ + NH₃ + NADH',
    up: '↑ Gly flux, ↑ NAD⁺; uses up to 50% of mito capacity in C3',
    down: 'NADH accumulation inhibits; cold <15°C strongly inhibits',
    conf: 'medium',
    unc: 'Vmax [At✓ Timm 2012]. Km=3.5mM glycine [sp:pea ⚠].'
  },
  gsgo: {
    name: 'GS + Fd-GOGAT (NH₃ refixation)',
    ec: '6.3.1.2 / 1.4.7.1',
    rxn: 'NH₃ + Gln + ATP → 2 Glu',
    up: '↑ NH₃, ↑ Fd_red (light)',
    down: '↓ light (Fd), N-limitation',
    conf: 'high',
    unc: 'Stoichiometry [At✓]. Flux = 1× Vo in WT.'
  },
  gcl: {
    name: 'GcL / CrGDH — bypass step 1',
    ec: '4.1.1.47',
    rxn: 'Glycolate → Glyoxylate (stromal, no H₂O₂)',
    up: '↑ glycolate pool; transgene expression',
    down: 'Requires transgene — native enzyme absent in plants',
    conf: 'placeholder',
    unc: 'Vmax25=5 [usr ⚠ placeholder]. Km=0.04mM [sp:E.coli] (Kebeish) / 0.30mM [sp:Chlamy] (South/cBHAC/McG).'
  },
  glxr: {
    name: 'GlxR / CuMS — bypass step 2',
    ec: '4.1.1.47 / 2.3.3.9',
    rxn: '2 Glyoxylate → Tartronate-SA + CO₂ (Kebeish) OR Glyoxylate + AcCoA → Malate (South)',
    up: '↑ glyoxylate (from step 1)',
    down: 'Rate governed by upstream CrGDH/GcL',
    conf: 'placeholder',
    unc: 'Kebeish: CO₂ stoichiometry [At✓ 2007]. South: CuMS from Cucurbita maxima [sp:tobacco South 2019].'
  },
  tsr: {
    name: 'TSR — Kebeish step 3 (E. coli)',
    ec: '1.1.1.60',
    rxn: 'Tartronate-SA + NADPH → Glycerate',
    up: '↑ tartronate-SA, ↑ NADPH',
    down: '↓ NADPH under low light',
    conf: 'placeholder',
    unc: 'Stoichiometry [At✓ Kebeish 2007]. Rate governed by upstream GcL.'
  },
  glyk: {
    name: 'GLYK — Kebeish step 4 (E. coli)',
    ec: '2.7.1.31',
    rxn: 'Glycerate + ATP → 3-PGA (→ CBB)',
    up: '↑ glycerate, ↑ ATP',
    down: 'Confirmed non-limiting in Kebeish lines [At✓]',
    conf: 'high',
    unc: 'Product 3-PGA re-enters CBB [At✓ Kebeish 2007]. Stoichiometry verified.'
  },
  cbhac_gdh: {
    name: 'CrGDH+BhcA-D / Ppc / CuMS — cBHAC, South or McG entry',
    ec: '1.1.—',
    rxn: '2 Glycolate → OAA (cBHAC) · Glycolate → Glyoxylate → Malate (South) · PEP+HCO₃⁻ → OAA (McG Mode B)',
    up: '↑ glycolate pool; transgene expression',
    down: 'CrGDH electron acceptor unknown in planta ⚠; CuMS can become rate-limiting in South AP3 lines',
    conf: 'placeholder',
    unc:
      'South 2019 metabolomics: AP3 lines showed elevated stromal glyoxylate + reduced serine/glycerate — consistent with CuMS becoming limiting relative to CrGDH, allowing glyoxylate accumulation. This activates risk_glyoxylate in the model (>0.7 = warning). Not a model error — risk_glyoxylate is the correct flag. cBHAC: not yet in Arabidopsis [sp:rice Chen 2025]. All Vmax [usr ⚠].'
  }
};

export interface NodeInfo {
  name: string;
  f: string;
  conf: 'high' | 'medium' | 'low' | 'placeholder';
  r: string;
  unc: string;
}

export const NODE_INFO: Record<string, NodeInfo> = {
  co2: {
    name: 'CO₂ (stroma)',
    f: 'CO₂',
    conf: 'medium',
    r: 'Substrate for RuBisCO. Cc = Ca × ci/ca × Cc/Ci.',
    unc: 'ci/ca=0.70 [est]; Cc/Ci=0.80 [est gm] — Arabidopsis gm may be lower (~0.70–0.75).'
  },
  rubp: {
    name: 'RuBP',
    f: 'C₅H₁₂O₁₁P₂',
    conf: 'high',
    r: 'CO₂ acceptor. Regenerated by CBB using 3 ATP per turn. Limiting when J is low.',
    unc: 'Stoichiometry [At✓].'
  },
  pg3: {
    name: '3-PGA',
    f: 'C₃H₇O₇P',
    conf: 'high',
    r: 'First product of carboxylation. Also product of GLYK in Kebeish — re-entering CBB here closes the loop.',
    unc: 'Stoichiometry [At✓].'
  },
  g3p: {
    name: 'G3P / triose-P',
    f: 'C₃H₇O₆P',
    conf: 'high',
    r: 'Branch point: exported via TPT for sucrose, starch, or recycled to regenerate RuBP.',
    unc: 'Stoichiometry [At✓]. TPT export modelled via Pi slider.'
  },
  pg2: {
    name: '2-PG',
    f: 'C₃H₅O₆P',
    conf: 'medium',
    r: 'Oxygenation product. PGLP1 → glycolate. Inhibits TPI+SBPase (Loop 1 feedback) when pool >~0.01mM.',
    unc: 'Pool depends on PGLP1 Vmax [usr ⚠] and Km [sp:rice]. Ki_TPI [sp:spinach ⚠].'
  },
  glycolate: {
    name: 'Glycolate (stroma)',
    f: 'C₂H₄O₃',
    conf: 'high',
    r: 'Branch point: PLGG1 export to peroxisome (native PR) or intercepted by bypass enzymes in stroma.',
    unc: 'GOX Km=0.210mM [At✓ AtGOX1]. PLGG1 capacity [est].'
  },
  glyoxy: {
    name: 'Glyoxylate (peroxisome)',
    f: 'C₂H₂O₃',
    conf: 'high',
    r: 'Classical PR intermediate. GGAT → glycine. Toxic if accumulates.',
    unc: 'GGAT confirmed non-limiting [At✓]. Pool [At✓ qualitative].'
  },
  glycine: {
    name: 'Glycine (perox → mito)',
    f: 'C₂H₅NO₂',
    conf: 'medium',
    r: 'Rate-limiting PR intermediate. GlyT transport to mito for GDC. Can use ~50% of mito capacity.',
    unc: 'GDC Km=3.5mM [sp:pea ⚠] — no Arabidopsis measurement.'
  },
  hpp: {
    name: 'Hydroxypyruvate (perox)',
    f: 'C₃H₄O₄',
    conf: 'high',
    r: 'SGAT product. Reduced by HPR1+NADH → glycerate. HPR1 confirmed non-limiting.',
    unc: 'HPR1 Km=0.08mM [At✓].'
  },
  glycerate: {
    name: 'Glycerate (perox)',
    f: 'C₃H₆O₄',
    conf: 'high',
    r: 'Final peroxisomal product → stroma via PLGG1 → GLYK → 3-PGA. Carbon recovered into CBB.',
    unc: 'Stoichiometry [At✓].'
  },
  gly_m: {
    name: 'Glycine (mitochondria)',
    f: 'C₂H₅NO₂',
    conf: 'medium',
    r: 'GDC substrate. 2 Gly → Ser + CO₂ + NH₃ + NADH.',
    unc: 'GDC Km [sp:pea ⚠]. Cold inhibition [At✓ direction].'
  },
  serine: {
    name: 'Serine (mito → perox)',
    f: 'C₃H₇NO₃',
    conf: 'high',
    r: 'GDC/SHMT product. Returns to peroxisome → SGAT → hydroxypyruvate.',
    unc: 'Stoichiometry [At✓].'
  },
  nh3: {
    name: 'NH₃ (mitochondria)',
    f: 'NH₃',
    conf: 'high',
    r: 'GDC product. Re-fixed by GS/GOGAT in stroma (1 ATP + 1 Fd_red per NH₃). Major N-cycling cost of PR.',
    unc: 'Stoichiometry [At✓].'
  },
  glyox_k: {
    name: 'Glyoxylate (Kebeish, stroma)',
    f: 'C₂H₂O₃',
    conf: 'placeholder',
    r: 'GcL product. Never leaves chloroplast. Substrate for GlxR. Distinct from peroxisomal glyoxylate.',
    unc: 'Flux governed by EcGlcDH Vmax [usr ⚠]. Pool unmeasured in transgenic Arabidopsis.'
  },
  glyox_ap: {
    name: 'Glyoxylate (bypass, stroma)',
    f: 'C₂H₂O₃',
    conf: 'placeholder',
    r:
      'CrGDH product in South/McG bypass. Should be immediately condensed by CuMS (South) or MTK (McG). ⚠ South 2019 metabolomics showed elevated glyoxylate in AP3 lines — CuMS can become rate-limiting, allowing free stromal glyoxylate to accumulate and inhibit RuBisCO. This is what risk_glyoxylate measures.',
    unc:
      '[sp:tobacco South 2019 / At✓ Lu 2025]. CrGDH electron acceptor unknown in planta [HIGH ⚠]. Vmax [usr ⚠]. CuMS Km unknown in plant context [est ⚠]. Risk threshold: glyox_downstream_capacity=30 µmol/m²/s (adjustable).'
  },
  tartr: {
    name: 'Tartronate-SA / Malate (bypass node)',
    f: 'C₃H₄O₄ / C₄H₆O₅',
    conf: 'placeholder',
    r: 'Kebeish: tartronate-semialdehyde from GlxR → TSR+NADPH → glycerate. South: malate from CuMS → NADP-ME (CO₂) or DiT1 export.',
    unc: 'Kebeish: [At✓ 2007]. South: malate_decarb_fraction=0.70 [est ⚠].'
  },
  glycer_k: {
    name: 'Glycerate (Kebeish/McG, stroma)',
    f: 'C₃H₆O₄',
    conf: 'high',
    r: 'TSR product → GK → 3-PGA. Carbon fully recovered into CBB. Same enzyme used in both Kebeish and McG GCL-path.',
    unc: 'GK confirmed non-limiting [At✓ Kebeish 2007].'
  },
  malylcoa: {
    name: 'Malyl-CoA (McG Mode A)',
    f: 'C₇H₁₁NO₅S (thioester)',
    conf: 'placeholder',
    r:
      'MTK (malate thiokinase) condenses glyoxylate + acetyl-CoA → malyl-CoA. MCL (malyl-CoA lyase) then cleaves it → malate + CoA. CoA cycles and is not consumed net. Key McG-specific intermediate.',
    unc: '[At✓ Lu 2025] enzyme identities confirmed. Pool unmeasured in planta. MTK/MCL kinetics [est ⚠].'
  },
  malate_mcg: {
    name: 'Malate (McG net product)',
    f: 'C₄H₆O₅',
    conf: 'placeholder',
    r: 'Net carbon product of McG Mode A — one malate per glycolate processed. Exported via DiT1 (malate valve) or used for fatty acid synthesis in the plastid.',
    unc: '[At✓ qualitative Lu 2025]. Malate fate split (export vs lipids) [est ⚠] — not yet quantified in Arabidopsis transgenic lines.'
  }
};

export interface MetricInfo {
  symbol: string;
  formula: string;
  unit: string;
  desc: string;
  range: string;
}

export const MINFO: Record<string, MetricInfo> = {
  'Net A': {
    symbol: 'A',
    formula: 'min(Wc,Wj,Wp)−Rd+feedback',
    unit: 'µmol CO₂/m²/s',
    desc:
      'Feedback-corrected net CO₂ assimilation. Includes three feedback loops on top of FvCB: 2-PG inhibition of TPI/SBPase (Loop 1), Trx f regulation of RCA+CBB enzymes (Loop 2), GDC saturation back-pressure (Loop 3). A_fvCB shows raw FvCB without feedback.',
    range: 'C3 full sun: 15–30. Zero in dark. Negative when Cc < Γ* or severe 2-PG accumulation.'
  },
  Limit: {
    symbol: 'limitState',
    formula: 'Rubisco if Wc≤Wj≤Wp',
    unit: '—',
    desc:
      'Which process bottlenecks photosynthesis. Rubisco-limited: more light won\'t help — raise CO₂ or Vcmax. RuBP-limited: more CO₂ won\'t help — raise light or Jmax. TPU: triose-P utilisation saturated (high CO₂, saturating light, when Tp25 is set).',
    range: 'Ambient CO₂: Rubisco-limited. High CO₂ + bright light: RuBP. TPU: rare.'
  },
  Wc: {
    symbol: 'Wc',
    formula: 'Vcmax·Cc / (Cc+Kc·(1+O/Ko))',
    unit: 'µmol/m²/s',
    desc:
      'Rubisco carboxylation rate after feedback corrections (Trx f RCA scaling, GDC back-pressure). Kc=272.4 µmol/mol, Ko=165.8 mmol/mol at 25°C [Bernacchi 2002 C3 std]. Rises with CO₂, falls with high O₂ and temperature.',
    range: 'Equals Wj at the A/Ci break point — typically Cc 200–400 µmol/mol.'
  },
  Wj: {
    symbol: 'Wj',
    formula: 'J·Cc / (4·Cc+8·Γ*)',
    unit: 'µmol/m²/s',
    desc:
      'RuBP-regeneration-limited rate using the correct Cc-based Bernacchi 2002 formula. After feedback, Wj is scaled by Trx f activation (Loop 2) and 2-PG inhibition of TPI+SBPase (Loop 1). Coefficients 4 and 8 reflect CBB+PR stoichiometry.',
    range: 'Limiting at high CO₂ + saturating light. Rises with PAR and Jmax.'
  },
  Vc: {
    symbol: 'Vc',
    formula: 'min(Wc,Wj,Wp)',
    unit: 'µmol/m²/s',
    desc: 'Gross carboxylation flux — the actual RuBisCO rate given the active limitation. Stays positive even when A < 0. Sets SVG arrow widths (width ∝ √Vc).',
    range: '~1.3–1.5× Net A at standard conditions.'
  },
  Vo: {
    symbol: 'Vo',
    formula: 'Vc×(O×1000)/(Srel×Cc)',
    unit: 'µmol/m²/s',
    desc:
      'Oxygenation flux — RuBisCO grabbing O₂, initiating photorespiration (orange arrows). Each oxygenation costs ~3.5 ATP + 2 NADH and releases 0.5 CO₂ in mitochondria. Rises with temperature (Srel falls), high O₂, low CO₂. Uncertainty: Srel25=2590 [sp:spinach ⚠].',
    range: 'Vo/Vc ~0.3 at 25°C ambient. Can exceed Vc under hot/dry stress.'
  },
  'Vo/Vc': {
    symbol: 'vovc',
    formula: '(O×1000)/(Srel×Cc)',
    unit: 'ratio',
    desc:
      'Oxygenation-to-carboxylation ratio from first principles via Srel. Srel ±15% → vovc ±15% — this uncertainty propagates directly to all photorespiratory flux outputs. Value >1 means more oxygenations than carboxylations.',
    range: '~0.25–0.35 at standard. Rises sharply above 30°C.'
  },
  J: {
    symbol: 'J',
    formula: 'Non-rectangular hyperbola (α=0.30, θ=0.70)',
    unit: 'µmol e⁻/m²/s',
    desc:
      'Electron transport rate — thylakoid electron flow making ATP+NADPH for RuBP regeneration. α=0.30 [C3 std]; θ=0.70 [C3 std]. Jmax25=1.67×Vcmax25 [C3 std est] — coupled via ratio.',
    range: 'Saturates at ~800–1200 µmol photons/m²/s PAR.'
  },
  'Γ*': {
    symbol: 'Γ*',
    formula: '42.75·exp(37830/R·(1/298.15−1/Tk))',
    unit: 'µmol/mol',
    desc:
      'CO₂ compensation point ignoring Rd. Below Γ*, Wj goes negative. When bypass is active, display shows Γ*_eff = Γ* × (1 − bypass_fraction × 0.5) — the λ correction [Busch 2020]: fewer CO₂ molecules are lost per oxygenation when bypass intercepts glycolate. A lower Γ*_eff means the leaf can fix carbon at lower CO₂.',
    range: '42.75 at 25°C → ~55 at 35°C [Bernacchi 2001].'
  },
  Rd: {
    symbol: 'Rd',
    formula: '0.015×Vcmax₂₅×arrh(46390,Tk)',
    unit: 'µmol/m²/s',
    desc:
      'Day respiration — mitochondrial CO₂ release in the light (not photorespiration). The 0.015 ratio [C3 std] is an approximation; range 0.010–0.025 across species. Measure from your material for precision.',
    range: '0.5–2 µmol/m²/s typical. Rises with temperature.'
  },
  'dA fb': {
    symbol: 'dA_feedback',
    formula: 'A_feedback − A_fvCB',
    unit: 'µmol/m²/s',
    desc:
      'How much the three feedback loops shift A relative to standard FvCB. Negative = feedbacks reduce A (2-PG accumulation or Trx f limitation). Near-zero in WT at ambient. Larger and more negative in pglp1-2 mutant. Compare A and A_fvCB in the metrics.',
    range: '−2 to 0 typical in WT. More negative with impaired PGLP1.'
  },
  'Trx f': {
    symbol: 'trxf_red',
    formula: 'floor + (sat−floor)·σ(I)',
    unit: '0–1',
    desc:
      'Thioredoxin f reduction state — master switch for the illuminated chloroplast. Reduced by ferredoxin via FTR during photosynthesis. Activates PGLP1 [At✓ Xi 2026], RuBisCO activase α [At✓ Yoshida 2015], FBPase, SBPase, PRK, GAPDH [At✓ Michelet 2013]. Dark floor=0.10, light sat=0.95 [At✓].',
    range: '0.10 (dark) → 0.95 (saturating light). Half-sat ~80 µmol/m²/s [At✓ indirect].'
  }
};

export const COL = {
  cbb: '#1D9E75',
  pr: '#D85A30',
  nh3: '#888',
  nadh: '#378ADD',
  keb: '#7F77DD',
  cbhac: '#378ADD',
  stroma: { fill: '#eaf7f1', stroke: '#1D9E75' },
  perox: { fill: '#fef3ee', stroke: '#D85A30' },
  mito: { fill: '#fff8f0', stroke: '#BA7517' }
} as const;

export const CONF: Record<string, string> = {
  high: '#1D9E75',
  medium: '#e0b000',
  low: '#e07b00',
  placeholder: '#E24B4A'
};

export const CONF_LABEL: Record<string, string> = {
  high: '[At✓] Measured in Arabidopsis',
  medium: '[C3/sp] Other species or C3 standard',
  low: '[est] Estimated from indirect evidence',
  placeholder: '[usr⚠] Placeholder — needs your measurement'
};

export const ENV_DEF: Env = { co2: 400, o2: 21, temp: 25, light: 1000, pi: 100, act: 100 };

export const PAR_DEF: Params = {
  Vcmax25: 120,
  Srel25: 2590,
  ci_ca: 0.7,
  Cc_Ci: 0.8,
  PGLP_Vmax25: 300,
  PGLP_Km_2PG: 0.272,
  GOX_Km_gly: 0.21,
  GDC_Km_gly: 3.5,
  Ki_TPI: 0.066,
  Ki_SBPase: 0.2,
  bypass_enzyme_Vmax25: 5,
  bypass_Km_glycolate: 0.04,
  refix_efficiency: 0.6
};

export interface Preset {
  n: string;
  e: Env;
  note?: string;
  src?: string;
}

export const ECO_PRESETS: Preset[] = [
  { n: 'Night', e: { co2: 420, o2: 21, temp: 15, light: 0, pi: 40, act: 20 }, note: 'No PAR — all flux stops' },
  { n: 'Deep shade', e: { co2: 380, o2: 21, temp: 18, light: 60, pi: 55, act: 50 }, note: 'Forest understorey' },
  { n: 'Cloudy', e: { co2: 420, o2: 21, temp: 20, light: 250, pi: 75, act: 70 }, note: 'Overcast temperate' },
  { n: 'Sunny C3', e: { co2: 420, o2: 21, temp: 25, light: 900, pi: 90, act: 90 }, note: 'Full sun C3 standard' },
  { n: 'Hot/dry', e: { co2: 220, o2: 21, temp: 40, light: 1400, pi: 60, act: 75 }, note: 'Stomata near-closed — CO₂ starved' },
  { n: 'C3 winter', e: { co2: 420, o2: 21, temp: 8, light: 400, pi: 80, act: 55 }, note: 'Cold inhibits enzymes' },
  { n: 'High CO₂', e: { co2: 800, o2: 21, temp: 25, light: 900, pi: 90, act: 90 }, note: 'eCO₂ — PR suppressed' },
  { n: 'High O₂', e: { co2: 400, o2: 35, temp: 25, light: 900, pi: 90, act: 90 }, note: 'Hyperoxia — max PR' },
  { n: 'Pi starved', e: { co2: 420, o2: 21, temp: 25, light: 700, pi: 12, act: 80 }, note: 'TPT blocked' }
];

export const LIT_PRESETS: Preset[] = [
  { n: 'FvCB 1980', e: { co2: 340, o2: 21, temp: 25, light: 1200, pi: 90, act: 90 }, src: 'Farquhar et al. 1980 Planta 149:78' },
  { n: "Bernacchi '01", e: { co2: 380, o2: 21, temp: 25, light: 1000, pi: 90, act: 90 }, src: 'Bernacchi et al. 2001 PCE 24:253' },
  { n: "Long '03", e: { co2: 370, o2: 21, temp: 25, light: 1500, pi: 90, act: 90 }, src: 'Long & Bernacchi 2003 JXB 54:2393' },
  { n: "Kebeish '07", e: { co2: 360, o2: 21, temp: 22, light: 120, pi: 80, act: 80 }, src: 'Kebeish et al. 2007 Nat Biotechnol 25:593' },
  { n: 'FACE eCO₂', e: { co2: 570, o2: 21, temp: 25, light: 1000, pi: 90, act: 90 }, src: 'Ainsworth & Long 2005 NP 165:351' },
  { n: 'RCP8.5 2100', e: { co2: 900, o2: 21, temp: 29, light: 1000, pi: 90, act: 90 }, src: 'IPCC AR6 RCP8.5' }
];
