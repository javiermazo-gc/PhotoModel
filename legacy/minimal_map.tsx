import { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ─── FvCB core + Kebeish bypass ────────────────────────────────────────────
const R_gas = 8.314;
const T25   = 298.15;
const arrh  = (Ha, Tk) => Math.exp(Ha / R_gas * (1/T25 - 1/Tk));
const peaked = (Ha, Hd, dS, Tk) =>
  arrh(Ha, Tk) *
  (1 + Math.exp((dS*T25 - Hd) / (R_gas*T25))) /
  (1 + Math.exp((dS*Tk  - Hd) / (R_gas*Tk)));

function kin(env, params = {}) {
  const Tk      = env.temp + 273.15;
  const Vcmax25 = params.Vcmax25 ?? 120;
  const Kc   = 272.4  * arrh(79430,  Tk);
  const Ko   = 165.8  * arrh(36380,  Tk);
  const GS   = 42.75  * arrh(37830,  Tk);
  const Srel = (params.Srel25 ?? 2590) * arrh(-28990, Tk);
  const actFrac = Math.max(0, Math.min(env.act ?? 100, 100)) / 100;
  const piFrac  = Math.max(0, Math.min(env.pi  ?? 100, 100)) / 100;
  const Vcmax   = Vcmax25 * arrh(65330, Tk) * actFrac * piFrac;
  const Jmax25 = params.Jmax25 ?? 200;
  const JmaxT  = Jmax25 * peaked(43900, 200000, 640, Tk);
  const alpha  = 0.30, theta = 0.70;
  const I      = Math.max(0, env.light);
  const aI     = alpha * I;
  const disc   = Math.pow(aI + JmaxT, 2) - 4 * theta * aI * JmaxT;
  const J      = (aI + JmaxT - Math.sqrt(Math.max(0, disc))) / (2 * theta);
  const Rd  = 0.015 * Vcmax25 * arrh(46390, Tk);
  const Cc  = env.co2 * (params.ci_ca ?? 0.70) * (params.Cc_Ci ?? 0.80);
  const Oc  = env.o2 * 10;
  const Wc = Math.max(0, Vcmax * Cc / (Cc + Kc * (1 + Oc / Ko)));
  const Wj = J * (Cc - GS) / (4 * Cc + 8 * GS);
  const A = Math.min(Wc, Wj) - Rd;
  const vovc = (Oc * 1000) / (Srel * Math.max(Cc, 0.1));
  const Vc = Wc;
  const Vo = Vc * vovc;
  return {
    Vc, Vo, Wc, Wj, J, A, Rd, vovc,
    gammastar: GS, Kc, Ko, Cc, Oc, Srel,
    Vcmax_eff: Vcmax, Vcmax25,
    limitState: Wc <= Wj ? "Rubisco" : "RuBP",
    belowCompPt: Cc < GS,
  };
}

function photoResp(k) {
  const Vo = Math.max(0, k.Vo);
  return {
    flux_glycolate:  2 * Vo,
    flux_glycine:    2 * Vo,
    flux_serine:         Vo,
    flux_CO2_rel:    0.5 * Vo,
    flux_NH3:            Vo,
    flux_glycerate:      Vo,
    carbon_loss:     0.5 * Vo,
  };
}

// ── Kebeish bypass: GcL → GlxR (CO₂ released) → TSR (NADPH) → GLYK → 3-PGA
// All 4 steps verified: Kebeish et al. 2007 Nature Biotechnology 25:593
function bypassKebeish(k, pr, env, params = {}) {
  const Tk      = env.temp + 273.15;
  const Vmax25  = params.bypass_enzyme_Vmax25 ?? 5;
  const Km_gly  = params.bypass_Km_glycolate  ?? 0.04;
  const Ha      = params.bypass_Ha            ?? 55000;
  const refix   = params.refix_efficiency     ?? 0.60;
  const bypass_Vmax = Vmax25 * Math.exp(Ha / R_gas * (1/T25 - 1/Tk));
  const GOX_Km       = 0.210;
  const GOX_Vmax_eff = 350 * 0.495;
  const gly_demand   = pr.flux_glycolate;
  const gly_v        = Math.min(gly_demand, 0.99 * GOX_Vmax_eff);
  const gly_pool     = GOX_Km * gly_v / (GOX_Vmax_eff - gly_v);
  const bp_raw          = bypass_Vmax * gly_pool / (Km_gly + gly_pool);
  const bypass_flux     = Math.min(bp_raw, gly_demand);
  const bypass_fraction = gly_demand > 0 ? bypass_flux / gly_demand : 0;
  const native_GOX_flux = gly_demand - bypass_flux;
  // Step 2: GlxR — 2 glyoxylate → tartronate-SA + CO₂  → 0.5 CO₂ per glycolate entering
  const flux_glyoxylate_k = bypass_flux;           // GcL product
  const flux_tartronate   = bypass_flux * 0.5;     // GlxR product (2 glyox → 1 tartr)
  const CO2_released      = bypass_flux * 0.5;     // CO₂ released at GlxR step
  // Step 3: TSR — tartronate-SA + NADPH → glycerate
  const flux_glycerate_k  = flux_tartronate;        // same stoichiometry
  // Step 4: GLYK — glycerate → 3-PGA (re-enters CBB)
  const flux_3pga_k       = flux_glycerate_k;       // 1:1 phosphorylation
  const native_frac  = gly_demand > 0 ? native_GOX_flux / gly_demand : 1;
  const CO2_native   = pr.flux_CO2_rel * native_frac;
  const NH3_native   = pr.flux_NH3     * native_frac;
  const NH3_saving   = pr.flux_NH3 - NH3_native;
  // CO₂ released at GlxR may be re-fixed by RuBisCO if it stays in stroma
  const CO2_refixed  = CO2_released * refix;
  const gammastar_eff = k.gammastar * (1 - bypass_fraction * 0.5);
  const GS_denom = k.Kc * (1 + k.Oc / k.Ko);
  const A_bypass = k.A
    + CO2_refixed
    + (k.gammastar - gammastar_eff) * k.Vcmax_eff / (k.Cc + GS_denom);
  return {
    bypass_flux, bypass_fraction, native_GOX_flux,
    flux_glyoxylate_k, flux_tartronate, CO2_released, CO2_refixed,
    flux_glycerate_k, flux_3pga_k,
    CO2_native, NH3_native, NH3_saving,
    gammastar_eff, A_bypass, gly_pool,
    bypass_note: Vmax25 === 5
      ? '⚠ EcGlcDH Vmax is a placeholder (5 µmol/m²/s). Measure in transgenic lines.'
      : `EcGlcDH Vmax = ${Vmax25} µmol/m²/s`,
  };
}

function runModel(env, params = {}) {
  const k  = kin(env, params);
  const pr = photoResp(k);
  const bp = params.bypass_active ? bypassKebeish(k, pr, env, params) : null;
  return {
    ...k, ...pr,
    native_GOX_flux: bp?.native_GOX_flux ?? pr.flux_glycolate,
    flux_glycine:    (bp?.native_GOX_flux ?? pr.flux_glycolate),
    flux_serine:     (bp?.native_GOX_flux ?? pr.flux_glycolate) * 0.5,
    flux_CO2_rel:    bp?.CO2_native       ?? pr.flux_CO2_rel,
    flux_NH3:        bp?.NH3_native       ?? pr.flux_NH3,
    flux_glycerate:  (bp?.native_GOX_flux ?? pr.flux_glycolate) * 0.5,
    carbon_loss:     pr.carbon_loss,
    bypass_active:   params.bypass_active ?? false,
    bypass_flux:     bp?.bypass_flux      ?? 0,
    flux_glyoxylate_k: bp?.flux_glyoxylate_k ?? 0,
    flux_tartronate:   bp?.flux_tartronate   ?? 0,
    CO2_released:      bp?.CO2_released      ?? 0,
    CO2_refixed:       bp?.CO2_refixed       ?? 0,
    flux_glycerate_k:  bp?.flux_glycerate_k  ?? 0,
    flux_3pga_k:       bp?.flux_3pga_k       ?? 0,
    bypass_fraction: bp?.bypass_fraction  ?? 0,
    NH3_saving:      bp?.NH3_saving       ?? 0,
    A_bypass:        bp?.A_bypass         ?? k.A,
    gammastar_eff:   bp?.gammastar_eff    ?? k.gammastar,
    bypass_note:     bp?.bypass_note      ?? null,
  };
}

// ─── Ecological & literature presets ───────────────────────────────────────
const ECO_PRESETS = [
  {n:"Night",      e:{co2:420,o2:21,temp:15,light:0,   pi:40,act:20}, note:"No PAR — all flux stops"},
  {n:"Deep shade", e:{co2:380,o2:21,temp:18,light:60,  pi:55,act:50}, note:"Forest understorey"},
  {n:"Cloudy",     e:{co2:420,o2:21,temp:20,light:250, pi:75,act:70}, note:"Overcast temperate"},
  {n:"Sunny C3",   e:{co2:420,o2:21,temp:25,light:900, pi:90,act:90}, note:"Full sun C3 standard"},
  {n:"Hot/dry",    e:{co2:220,o2:21,temp:40,light:1400,pi:60,act:75}, note:"Stomata near-closed — CO₂ starved"},
  {n:"C3 winter",  e:{co2:420,o2:21,temp:8, light:400, pi:80,act:55}, note:"Cold inhibits enzymes"},
  {n:"High CO₂",   e:{co2:800,o2:21,temp:25,light:900, pi:90,act:90}, note:"eCO₂ — PR suppressed"},
  {n:"High O₂",    e:{co2:400,o2:35,temp:25,light:900, pi:90,act:90}, note:"Hyperoxia — max PR"},
  {n:"Pi starved", e:{co2:420,o2:21,temp:25,light:700, pi:12,act:80}, note:"TPT blocked"},
];
const LIT_PRESETS = [
  {n:"FvCB 1980",    e:{co2:340,o2:21,temp:25,light:1200,pi:90,act:90}, src:"Farquhar et al. 1980 Planta 149:78"},
  {n:"Bernacchi '01",e:{co2:380,o2:21,temp:25,light:1000,pi:90,act:90}, src:"Bernacchi et al. 2001 PCE 24:253"},
  {n:"Long '03",     e:{co2:370,o2:21,temp:25,light:1500,pi:90,act:90}, src:"Long & Bernacchi 2003 JXB 54:2393"},
  {n:"Kebeish '07",  e:{co2:360,o2:21,temp:22,light:120, pi:80,act:80}, src:"Kebeish et al. 2007 Nat Biotechnol 25:593"},
  {n:"FACE eCO₂",   e:{co2:570,o2:21,temp:25,light:1000,pi:90,act:90}, src:"Ainsworth & Long 2005 NP 165:351"},
  {n:"RCP8.5 2100",  e:{co2:900,o2:21,temp:29,light:1000,pi:90,act:90}, src:"IPCC AR6 RCP8.5"},
];

// ─── Arrow & node info for tooltips ────────────────────────────────────────
const ARROW_INFO = {
  rubisco_c: {name:"RuBisCO carboxylation", ec:"4.1.1.39", rxn:"RuBP + CO₂ → 2× 3-PGA", up:"↑ CO₂ (Cc), ↑ Vcmax, ↑ activation state", down:"↑ O₂ competition, ↑ temp (Srel falls), stomatal closure"},
  rubisco_o: {name:"RuBisCO oxygenation",   ec:"4.1.1.39", rxn:"RuBP + O₂ → 2-PG + 3-PGA", up:"↑ O₂, ↑ temp, ↓ CO₂", down:"↑ CO₂, C4/CCM concentrating mechanisms"},
  pgk_gapdh: {name:"PGK + GAPDH (CBB reduction)", ec:"2.7.2.3 / 1.2.1.13", rxn:"3-PGA + ATP + NADPH → G3P + Pi", up:"↑ ATP, ↑ NADPH, light via thioredoxin", down:"↓ Pi (TPT blocked), darkness"},
  regen:     {name:"RuBP regeneration (PRK)", ec:"2.7.1.19", rxn:"G3P + 3 ATP → RuBP", up:"↑ ATP, light activates PRK via thioredoxin", down:"↓ Pi, darkness"},
  pgpase:    {name:"2-PG phosphatase (PGPase)", ec:"3.1.3.18", rxn:"2-PG → Glycolate + Pi", up:"↑ 2-PG (oxygenation product)", down:"No known regulation — constitutively active"},
  gox_p:     {name:"Glycolate oxidase (peroxisome)", ec:"1.1.3.15", rxn:"Glycolate + O₂ → Glyoxylate + H₂O₂", up:"↑ glycolate flux, ↑ O₂", down:"Bypass routes divert glycolate before this step"},
  ggat:      {name:"Glu:glyoxylate aminotransferase (GGAT)", ec:"2.6.1.4", rxn:"Glyoxylate + Glu → Glycine + 2-OG", up:"↑ glyoxylate, ↑ Glu pool", down:"N-limitation; bypass reduces glyoxylate pool"},
  hpr:       {name:"Hydroxypyruvate reductase (HPR)", ec:"1.1.1.29", rxn:"Hydroxypyruvate + NADH → Glycerate + NAD⁺", up:"↑ hydroxypyruvate, ↑ NADH from mito", down:"↓ NADH supply"},
  gdc_shmt:  {name:"GDC + SHMT (mito)", ec:"1.4.4.2 / 2.1.2.1", rxn:"2 Gly → Ser + CO₂ + NH₃ + NADH", up:"↑ Gly flux, ↑ NAD⁺; uses up to 50% of mito capacity in C3", down:"NADH accumulation inhibits; cold strongly inhibits"},
  gsgo:      {name:"GS + Fd-GOGAT (NH₃ refixation)", ec:"6.3.1.2 / 1.4.7.1", rxn:"NH₃ + Gln + ATP → 2 Glu (via Gln intermediate)", up:"↑ NH₃, ↑ Fd_red (light), ↑ ATP", down:"↓ light (Fd), N-limitation"},
  gcl:       {name:"Glycolate carboligase / GcL (Kebeish step 1)", ec:"4.1.1.47", rxn:"Glycolate → Glyoxylate (E. coli enzyme expressed in stroma)", up:"↑ glycolate pool, transgene expression level", down:"Native enzyme absent in plants — requires transgene"},
  glxr:      {name:"Glyoxylate carboligase / GlxR (Kebeish step 2)", ec:"4.1.1.47", rxn:"2 Glyoxylate → Tartronate-semialdehyde + CO₂", up:"↑ glyoxylate (from GcL)", down:"CO₂ is released here — this is the one C lost per 2 glycolate"},
  tsr:       {name:"Tartronate-semialdehyde reductase / TSR (Kebeish step 3)", ec:"1.1.1.60", rxn:"Tartronate-SA + NADPH → Glycerate", up:"↑ tartronate-SA, ↑ NADPH (from light reactions)", down:"↓ NADPH under low light"},
  glyk:      {name:"Glycerate kinase / GLYK (Kebeish step 4)", ec:"2.7.1.31", rxn:"Glycerate + ATP → 3-PGA (re-enters CBB cycle)", up:"↑ glycerate, ↑ ATP", down:"↓ ATP; product 3-PGA feeds back into Calvin cycle"},
};

const NODE_INFO = {
  co2:    {name:"CO₂ (stroma)", f:"CO₂", r:"Substrate for RuBisCO carboxylation. Concentration at chloroplast (Cc) = Ca × ci/ca × Cc/Ci. Drives Wc directly."},
  rubp:   {name:"RuBP", f:"C₅H₁₂O₁₁P₂", r:"CO₂ acceptor. Regenerated by CBB cycle using 3 ATP per turn. When J is low, RuBP runs out → RuBP-limited regime."},
  pg3:    {name:"3-PGA", f:"C₃H₇O₇P", r:"First stable product of carboxylation. Reduced to G3P using ATP + NADPH. Also the product of GLYK in the Kebeish bypass — re-entering here closes the loop."},
  g3p:    {name:"G3P / triose-P", f:"C₃H₇O₆P", r:"Central branch point. Exported via TPT for sucrose synthesis, used for starch, or recycled to regenerate RuBP."},
  pg2:    {name:"2-Phosphoglycolate (2-PG)", f:"C₃H₅O₆P", r:"Oxygenation product. Immediately dephosphorylated by PGPase → glycolate. Inhibits triose-P isomerase if it accumulates."},
  glycolate:{name:"Glycolate (stroma)", f:"C₂H₄O₃", r:"Exported to peroxisome via PLGG1 transporter for classical PR, or intercepted by Kebeish enzymes. The branch point between native PR and bypass."},
  glyoxy: {name:"Glyoxylate (peroxisome)", f:"C₂H₂O₃", r:"Classical PR intermediate. Transaminated by GGAT → glycine. Toxic if it accumulates — rapidly consumed."},
  glycine:{name:"Glycine (perox → mito)", f:"C₂H₅NO₂", r:"Rate-limiting intermediate of classical PR. Transported into mitochondria for GDC. Can consume ~50% of mito capacity under high PR."},
  hpp:    {name:"Hydroxypyruvate (perox)", f:"C₃H₄O₄", r:"Serine is transaminated → hydroxypyruvate, then reduced by HPR + NADH → glycerate for return to stroma."},
  glycerate:{name:"Glycerate (perox)", f:"C₃H₆O₄", r:"Final peroxisomal product. Transported back to stroma, phosphorylated by GLYK → 3-PGA. Carbon recovered into CBB."},
  gly_m:  {name:"Glycine (mitochondria)", f:"C₂H₅NO₂", r:"GDC substrate. 2 Gly → Ser + CO₂ + NH₃ + NADH. CO₂ is the net carbon cost of classical PR (~0.5 per oxygenation)."},
  serine: {name:"Serine (mito → perox)", f:"C₃H₇NO₃", r:"GDC/SHMT product. Returns to peroxisome where SGAT removes the amino group → hydroxypyruvate."},
  nh3:    {name:"NH₃ (mito)", f:"NH₃", r:"Released by GDC. Must be re-fixed by GS/GOGAT in the stroma at cost of 1 ATP + 1 Fd_red. Major N-cycling cost of PR."},
  // Kebeish intermediates
  glyox_k:{name:"Glyoxylate (Kebeish, stroma)", f:"C₂H₂O₃", r:"GcL product in stroma — never leaves the chloroplast. Substrate for GlxR in the next bypass step. Distinct pool from peroxisomal glyoxylate."},
  tartr:  {name:"Tartronate-semialdehyde (Kebeish)", f:"C₃H₄O₄", r:"GlxR product. Formed from 2 glyoxylate with release of 1 CO₂. Immediately reduced to glycerate by TSR using NADPH."},
  glycer_k:{name:"Glycerate (Kebeish, stroma)", f:"C₃H₆O₄", r:"TSR product. Phosphorylated to 3-PGA by GLYK — the final step that returns carbon directly into the Calvin cycle, bypassing the entire perox/mito loop."},
};

// ─── Metric definitions ────────────────────────────────────────────────────
const MINFO = {
  "Net A":  {symbol:"A", formula:"min(Wc, Wj) − Rd", unit:"µmol CO₂/m²/s", desc:"Net CO₂ assimilation — carbon the leaf captures per second per m², after subtracting mitochondrial respiration (Rd). Positive = carbon gain. Negative = below CO₂ compensation point or dark. Measured by LI-6800.", range:"C3 full sun: 15–30. Zero in dark. Negative when Cc < Γ*."},
  "Limit":  {symbol:"limitState", formula:"Rubisco if Wc ≤ Wj", unit:"—", desc:"Which process bottlenecks photosynthesis right now. Rubisco-limited: more light won't help — raise CO₂ or Vcmax. RuBP-limited: more CO₂ won't help — raise light or Jmax.", range:"C3 plants typically Rubisco-limited at ambient CO₂. RuBP limitation at high CO₂ + saturating light."},
  "Wc":     {symbol:"Wc", formula:"Vcmax·Cc / (Cc + Kc·(1+O/Ko))", unit:"µmol/m²/s", desc:"Rubisco-limited rate. Set by Vcmax and CO₂ at the chloroplast (Cc). Denominator includes O₂ competitive inhibition via Kc and Ko (Michaelis constants). Rises with CO₂ and Vcmax₂₅ slider.", range:"Equals Wj at the A/Ci 'break point' — typically Cc = 200–400 µmol/mol."},
  "Wj":     {symbol:"Wj", formula:"J·(Cc−Γ*) / (4Cc+8Γ*)", unit:"µmol/m²/s", desc:"RuBP-regeneration-limited rate. J is electron transport rate (light-driven). Negative when Cc < Γ* — physically correct. Coefficients 4 and 8 encode ATP/NADPH stoichiometry of CBB + photorespiration.", range:"Limiting at high CO₂ + saturating light. Rises with PAR. Controlled independently by Jmax₂₅."},
  "Vc":     {symbol:"Vc", formula:"Wc (gross, always ≥ 0)", unit:"µmol/m²/s", desc:"Gross carboxylation flux — physical rate of RuBisCO fixing CO₂. Stays positive even when A < 0 because RuBisCO still turns over; losses just exceed gains. Sets arrow widths in the diagram.", range:"~1.3–1.5× Net A under standard conditions."},
  "Vo":     {symbol:"Vo", formula:"Vc × (O×1000) / (Srel×Cc)", unit:"µmol/m²/s", desc:"Oxygenation flux — how often RuBisCO grabs O₂ instead of CO₂, initiating photorespiration (orange arrows). Each event costs ~3.5 ATP + 2 NADH and releases 1 CO₂ in the mitochondrion. Rises with temperature (Srel falls), high O₂, low CO₂.", range:"Vo/Vc ~0.3 at 25°C ambient CO₂. Can exceed Vc under hot/dry stress."},
  "Vo/Vc":  {symbol:"vovc", formula:"(O×1000) / (Srel×Cc)", unit:"ratio", desc:"Fraction of RuBisCO turnovers that are oxygenations. Calculated from first principles via Srel (CO₂/O₂ selectivity). Value of 0.3 = 30% wasted on O₂. >1 = more oxygenations than carboxylations — severe stress.", range:"~0.25–0.35 at standard. Rises sharply above 30°C. >1 in extreme stress."},
  "J":      {symbol:"J", formula:"Non-rectangular hyperbola (α=0.30, θ=0.70)", unit:"µmol e⁻/m²/s", desc:"Electron transport rate — how fast electrons flow through the thylakoid, making ATP + NADPH for RuBP regeneration. α=0.30 (absorptance × quantum efficiency); θ=0.70 (curvature). Saturates at Jmax.", range:"Saturates at ~800–1200 µmol photons/m²/s. Jmax₂₅ independent of Vcmax₂₅."},
  "Γ*":     {symbol:"Γ*", formula:"42.75·exp(37830/R·(1/298.15−1/Tk))", unit:"µmol/mol", desc:"CO₂ compensation point ignoring Rd. Below Γ*, oxygenation exceeds carboxylation and Wj goes negative. Rises with temperature — core reason C4 plants outperform C3 in the heat. Kebeish bypass lowers the effective Γ*.", range:"42.75 at 25°C → ~55 at 35°C (Bernacchi 2001)."},
  "Rd":     {symbol:"Rd", formula:"0.015×Vcmax₂₅×arrh(46390,Tk)", unit:"µmol/m²/s", desc:"Day respiration — mitochondrial CO₂ release in the light (not photorespiration). Subtracted from gross A. The 0.015 coefficient is an approximation; measure directly for your material.", range:"0.5–2 µmol/m²/s typical. Rises with temperature and Vcmax₂₅."},
};

// ─── Palette ───────────────────────────────────────────────────────────────
const COL = {
  cbb:"#1D9E75", pr:"#D85A30", nh3:"#888", nadh:"#378ADD", keb:"#7F77DD",
  stroma:{ fill:"#eaf7f1", stroke:"#1D9E75" },
  perox: { fill:"#fef3ee", stroke:"#D85A30"  },
  mito:  { fill:"#fff8f0", stroke:"#BA7517"  },
};

// ─── SVG primitives ────────────────────────────────────────────────────────
const SR = 5.5; // small node radius

function fw(f){ return Math.max(0.4, Math.min(Math.sqrt(Math.max(f,0))*1.0, 4.5)); }
function fo(f){ return Math.max(0.15, Math.min(0.12+f*0.05, 0.88)); }

// Arrow — now with optional ak (arrow key) for click tooltip
function Arrow({x1,y1,x2,y2,flux,color,dashed,label,bend=0,ak,onA}){
  if(!flux||flux<0.005) return null;
  const w=fw(flux), op=fo(flux);
  const spd=dashed?`${Math.max(0.6,4.5-flux*0.1).toFixed(1)}s`:null;
  const d=bend?`M${x1} ${y1} Q${(x1+x2)/2+bend} ${(y1+y2)/2+bend} ${x2} ${y2}`:`M${x1} ${y1} L${x2} ${y2}`;
  const mlx=bend?(x1+x2)/2+bend*0.28:(x1+x2)/2;
  const mly=bend?(y1+y2)/2+bend*0.28:(y1+y2)/2;
  return(
    <g style={ak?{cursor:"pointer"}:{}} onClick={ak&&onA?e=>{e.stopPropagation();onA(ak,mlx,mly,flux)}:undefined}>
      <path d={d} fill="none" stroke={color} strokeWidth={w} opacity={op}
        strokeDasharray={dashed?"6 3":"none"} strokeLinecap="round" markerEnd="url(#arr)"
        style={dashed?{animation:`dk ${spd} linear infinite`}:{}}/>
      {/* fat invisible hit area for easier clicking */}
      {ak&&<path d={d} fill="none" stroke="transparent" strokeWidth={14}/>}
      {label&&flux>0.1&&<text x={mlx} y={mly-5} fontSize={7.5} fill={color}
        opacity={Math.min(op*1.8,0.9)} textAnchor="middle" style={{pointerEvents:"none"}}>
        {label} <tspan fontWeight={600}>{flux.toFixed(1)}</tspan>
      </text>}
    </g>
  );
}

// Large named node
function Node({x,y,w=68,h=21,label,comp}){
  const s=(COL[comp]||COL.stroma).stroke;
  return(<g><rect x={x} y={y} width={w} height={h} rx={4} fill="#fff" stroke={s} strokeWidth={0.8}/><text x={x+w/2} y={y+h/2} textAnchor="middle" dominantBaseline="central" fontSize={8.5} fontWeight={500} fill="#222">{label}</text></g>);
}

// Small dot node — clickable metabolite
function SmallNode({x,y,color,nk,onN}){
  return(
    <g style={{cursor:"pointer"}} onClick={e=>{e.stopPropagation();onN&&onN(nk,x,y);}}>
      <circle cx={x} cy={y} r={SR} fill="#fff" stroke={color} strokeWidth={0.9}/>
      <circle cx={x} cy={y} r={2.2} fill={color} opacity={0.8}/>
    </g>
  );
}

function CompBox({x,y,w,h,comp,label}){
  const cs=COL[comp];
  return(<g><rect x={x} y={y} width={w} height={h} rx={8} fill={cs.fill} stroke={cs.stroke} strokeWidth={0.9} opacity={0.93}/><text x={x+10} y={y+13} fontSize={8} fill={cs.stroke} fontWeight={600}>{label}</text></g>);
}

// Dark floating tooltip — for arrows and small nodes
function Tip({info,x,y,W,onClose}){
  if(!info) return null;
  const tw=210, th=info.rxn?148:88;
  const tx=Math.min(x+10, W-tw-6);
  const ty2=Math.max(y-th/2, 4);
  return(
    <g onClick={e=>e.stopPropagation()}>
      <rect x={tx} y={ty2} width={tw} height={th} rx={6} fill="#1a1f27" stroke="#3a3f48" strokeWidth={0.7} opacity={0.97}/>
      <text x={tx+8} y={ty2+14} fontSize={9} fill="#fff" fontWeight={600}>{info.name}</text>
      {info.ec&&<text x={tx+8} y={ty2+25} fontSize={7} fill="#7ec9a6">EC {info.ec}</text>}
      {info.f&&<text x={tx+8} y={ty2+25} fontSize={7.5} fill="#aed6c4">{info.f}</text>}
      {info.rxn&&<text x={tx+8} y={ty2+36} fontSize={7} fill="#c8c8c8">{info.rxn}</text>}
      {info.r&&<foreignObject x={tx+6} y={ty2+(info.rxn?45:29)} width={tw-12} height={info.rxn?55:46}>
        <div xmlns="http://www.w3.org/1999/xhtml" style={{fontSize:7.5,color:"#ccc",lineHeight:1.45}}>{info.r}</div>
      </foreignObject>}
      {info.up&&<>
        <foreignObject x={tx+6} y={ty2+48} width={tw-12} height={40}>
          <div xmlns="http://www.w3.org/1999/xhtml" style={{fontSize:7,color:"#6fdd92",lineHeight:1.4}}>▲ {info.up}</div>
        </foreignObject>
        <foreignObject x={tx+6} y={ty2+90} width={tw-12} height={40}>
          <div xmlns="http://www.w3.org/1999/xhtml" style={{fontSize:7,color:"#f48080",lineHeight:1.4}}>▼ {info.down}</div>
        </foreignObject>
      </>}
      {info.flux!=null&&<text x={tx+8} y={ty2+th-7} fontSize={7} fill="#555">flux: {info.flux.toFixed(3)} µmol/m²/s</text>}
      <text x={tx+tw-10} y={ty2+14} fontSize={12} fill="#666" style={{cursor:"pointer"}} onClick={onClose}>×</text>
    </g>
  );
}

// ─── Metric card ───────────────────────────────────────────────────────────
function MCard({label,value,unit,color,onInfo,active}){
  const v=typeof value==="number"?(Math.abs(value)>99?value.toFixed(1):value.toFixed(2)):value;
  const isNeg=typeof value==="number"&&value<0;
  const c=isNeg?"#E24B4A":(color||"var(--color-text-primary)");
  return(
    <div onClick={()=>onInfo(active?null:label)}
      style={{background:active?"var(--color-background-primary)":"var(--color-background-secondary)",
        borderRadius:6,padding:"5px 7px",textAlign:"center",
        borderLeft:`2.5px solid ${active?c:(isNeg?"#E24B4A":(color||"#ccc"))}`,
        cursor:"pointer",outline:active?`1px solid ${c}`:"none",userSelect:"none"}}>
      <div style={{fontSize:8,color:"var(--color-text-secondary)",marginBottom:1}}>{label}</div>
      <div style={{fontSize:14,fontWeight:600,color:c}}>{v}</div>
      <div style={{fontSize:7.5,color:"var(--color-text-tertiary)"}}>{unit}</div>
      <div style={{fontSize:7,color:"var(--color-text-tertiary)",marginTop:1}}>ⓘ</div>
    </div>
  );
}

function InfoPop({metric,onClose}){
  if(!metric||!MINFO[metric]) return null;
  const d=MINFO[metric];
  return(
    <div style={{margin:"6px 0 0",padding:"10px 12px",background:"var(--color-background-secondary)",
      borderRadius:7,border:"0.5px solid var(--color-border-tertiary)",fontSize:9.5,position:"relative"}}>
      <button onClick={onClose} style={{position:"absolute",top:6,right:8,background:"none",
        border:"none",fontSize:13,cursor:"pointer",color:"var(--color-text-secondary)"}}>×</button>
      <div style={{fontWeight:600,fontSize:11,marginBottom:3}}>
        {metric} <span style={{fontWeight:400,color:"var(--color-text-secondary)",fontSize:10}}>({d.symbol})</span>
      </div>
      <code style={{display:"block",fontSize:8.5,background:"var(--color-background-primary)",
        padding:"2px 6px",borderRadius:3,marginBottom:5,color:"var(--color-text-primary)"}}>{d.formula}</code>
      <div style={{lineHeight:1.6,marginBottom:4,color:"var(--color-text-primary)"}}>{d.desc}</div>
      <div style={{fontSize:9,color:"var(--color-text-secondary)"}}><strong>Range:</strong> {d.range}</div>
      <div style={{fontSize:8.5,color:"var(--color-text-tertiary)",marginTop:2}}>Unit: {d.unit}</div>
    </div>
  );
}

function Sld({k,val,set,min,max,step=1,label,unit,color}){
  return(
    <div style={{marginBottom:5}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--color-text-secondary)",marginBottom:1}}>
        <span style={{fontWeight:500,color:color||"var(--color-text-primary)"}}>{label}</span>
        <span style={{fontWeight:600,color:color||"var(--color-text-primary)"}}>{val}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e=>set(k,+e.target.value)} style={{width:"100%",accentColor:color||COL.cbb}}/>
    </div>
  );
}

function LimitBanner({m}){
  const isRub=m.limitState==="Rubisco";
  const c=isRub?"#533AB7":"#BA7517";
  return(
    <div style={{padding:"5px 10px",borderRadius:5,background:c+"12",
      border:`0.5px solid ${c}`,fontSize:9.5,color:c,lineHeight:1.6}}>
      <strong>{m.limitState}-limited</strong> — Wc={m.Wc.toFixed(1)}, Wj={m.Wj.toFixed(1)} µmol/m²/s.{" "}
      {isRub?"More light alone won't increase A — need more CO₂ or Vcmax."
             :"More CO₂ alone won't increase A — need more light or higher Jmax."}
      {m.belowCompPt&&<span style={{color:"#E24B4A"}}>{" "}⚠ Cc ({m.Cc.toFixed(0)}) &lt; Γ* ({m.gammastar.toFixed(1)}) — A is negative.</span>}
    </div>
  );
}

function Legend({show,onToggle}){
  return(
    <div>
      <button onClick={onToggle} style={{fontSize:9,padding:"2px 8px",borderRadius:4,
        background:"transparent",border:"0.5px solid var(--color-border-tertiary)",
        color:"var(--color-text-secondary)",cursor:"pointer",marginTop:6}}>
        {show?"▲ Hide":"▼ Show"} legend
      </button>
      {show&&(
        <div style={{marginTop:6,padding:"7px 10px",background:"var(--color-background-secondary)",borderRadius:6,fontSize:9}}>
          <div style={{fontWeight:500,color:"var(--color-text-secondary)",marginBottom:4}}>Compartments</div>
          {[["stroma","Chloroplast stroma"],["perox","Peroxisome"],["mito","Mitochondria"]].map(([k,l])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:5,color:"var(--color-text-secondary)",marginBottom:3}}>
              <div style={{width:10,height:10,border:`1.5px solid ${COL[k].stroke}`,borderRadius:2,background:COL[k].fill,flexShrink:0}}/>
              {l}
            </div>
          ))}
          <div style={{fontWeight:500,color:"var(--color-text-secondary)",margin:"6px 0 4px"}}>Pathways</div>
          {[[COL.cbb,"CBB / carboxylation"],[COL.pr,"Photorespiration"],[COL.keb,"Kebeish bypass"],["#aaa","CO₂ release"],[COL.nh3,"NH₃"]].map(([c,l])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:5,color:"var(--color-text-secondary)",marginBottom:2}}>
              <div style={{width:16,height:3,background:c,borderRadius:2,flexShrink:0}}/>
              {l}
            </div>
          ))}
          <div style={{marginTop:5,color:"var(--color-text-tertiary)"}}>
            Width ∝ √flux · µmol/m²/s · click arrows or ● for details
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
const ENV_DEF={co2:400,o2:21,temp:25,light:1000,pi:100,act:100};
const PAR_DEF={Vcmax25:120, Jmax25:200};

export default function App(){
  const [env,setEnv]=useState(ENV_DEF);
  const [par,setPar]=useState(PAR_DEF);
  const [bypassActive,setBypassActive]=useState(false);
  const [bypassVmax,setBypassVmax]=useState(5);
  const [activeInfo,setActiveInfo]=useState(null);
  const [showLegend,setShowLegend]=useState(false);
  const [showLit,setShowLit]=useState(false);
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState({x:0,y:0});
  const [tip,setTip]=useState(null); // {info, x, y}
  const dragging=useRef(false);
  const dragStart=useRef(null);
  const containerRef=useRef(null);

  const setE=(k,v)=>setEnv(e=>({...e,[k]:v}));
  const setP=(k,v)=>setPar(p=>({...p,[k]:v}));
  const m=useMemo(()=>runModel(env,{...par,bypass_active:bypassActive,bypass_enzyme_Vmax25:bypassVmax}),[env,par,bypassActive,bypassVmax]);

  const onA=useCallback((key,x,y,flux)=>{
    const info=ARROW_INFO[key];
    if(info) setTip({info:{...info,flux},x,y});
  },[]);
  const onN=useCallback((key,x,y)=>{
    const info=NODE_INFO[key];
    if(info) setTip({info,x,y});
  },[]);

  useEffect(()=>{
    const el=containerRef.current;if(!el)return;
    const h=e=>{e.preventDefault();setZoom(z=>Math.max(0.3,Math.min(4,z*(1-e.deltaY*0.001))));};
    el.addEventListener("wheel",h,{passive:false});
    return()=>el.removeEventListener("wheel",h);
  },[]);
  const onMD=e=>{if(e.button!==0)return;dragging.current=true;dragStart.current={mx:e.clientX,my:e.clientY,px:pan.x,py:pan.y};};
  const onMM=e=>{if(!dragging.current||!dragStart.current)return;setPan({x:dragStart.current.px+(e.clientX-dragStart.current.mx),y:dragStart.current.py+(e.clientY-dragStart.current.my)});};
  const onMU=()=>{dragging.current=false;};

  // ── Layout constants ──────────────────────────────────────────────────────
  const SVG_W = 582; // wider canvas (feature 13)
  const stromaH   = bypassActive ? 220 : 138;  // expands to fit 3-row Kebeish chain
  const compsY    = 16 + stromaH + 8;
  const SVG_H     = compsY + 120 + 24;
  const NW=68, NH=21;

  const PEROX_OFF  = compsY + 10;
  const PEROX_OFF2 = compsY + 70;

  // Node positions
  const nd={
    // CBB row (y=38)
    co2:[10,38], rubp:[120,38], pg3:[230,38], g3p:[340,38],
    // Oxygenation / glycolate row (y=94)
    pg2:[120,94], glycolate:[10,94],
    // Kebeish chain — own row at y=162, evenly spaced across full stroma width
    // Only used when bypass active; stroma expands to 220px to give room
    glyox_k: [10,  162],
    tartr:   [160, 162],
    glycer_k:[310, 162],
    // Perox (positions shift with compsY)
    glyoxy:  [390, PEROX_OFF], glycine:[484, PEROX_OFF],
    hpp:     [484, PEROX_OFF2], glycerate:[390, PEROX_OFF2],
    // Mito
    gly_m:[18, PEROX_OFF], serine:[110, PEROX_OFF],
    nh3:  [18, PEROX_OFF2],
  };
  const cx=k=>nd[k][0]+NW/2, cy=k=>nd[k][1]+NH/2;
  const lx=k=>nd[k][0],      rx=k=>nd[k][0]+NW;
  const ty=k=>nd[k][1],      by=k=>nd[k][1]+NH;

  // Small dot node positions
  const sn={
    pg2:     [nd.pg2[0]-SR-2,       nd.pg2[1]+NH/2],
    glyoxP:  [nd.glyoxy[0]+NW+SR+2, nd.glyoxy[1]+NH/2],
    glycineP:[nd.glycine[0]+NW/2,   nd.glycine[1]-SR-2],
    // Kebeish chain dots — centred on each intermediate node
    glyox_k: [nd.glyox_k[0]+NW/2,  nd.glyox_k[1]+NH/2],
    tartr:   [nd.tartr[0]+NW/2,     nd.tartr[1]+NH/2],
    glycer_k:[nd.glycer_k[0]+NW/2,  nd.glycer_k[1]+NH/2],
  };

  return(
    <div style={{fontFamily:"var(--font-sans)",fontSize:12,paddingBottom:"1rem"}}>
      <style>{`@keyframes dk{to{stroke-dashoffset:-22}}`}</style>

      {/* Header */}
      <div style={{padding:"7px 14px 4px",borderBottom:"0.5px solid var(--color-border-tertiary)",display:"flex",alignItems:"center",gap:8}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:13}}>Photosynthesis — FvCB verified model</div>
          <div style={{fontSize:9.5,color:"var(--color-text-secondary)"}}>
            FvCB · Bernacchi 2001 · click arrows for enzyme info · click ● for metabolite info · scroll to zoom · drag to pan
          </div>
        </div>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          <button onClick={()=>setZoom(z=>Math.min(z+0.25,4))} style={{padding:"2px 7px",borderRadius:5,fontSize:13,cursor:"pointer",background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-primary)"}}>＋</button>
          <button onClick={()=>{setZoom(1);setPan({x:0,y:0});}} style={{padding:"2px 6px",borderRadius:5,fontSize:9,cursor:"pointer",background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-secondary)",minWidth:34}}>{Math.round(zoom*100)}%</button>
          <button onClick={()=>setZoom(z=>Math.max(z-0.25,0.3))} style={{padding:"2px 7px",borderRadius:5,fontSize:13,cursor:"pointer",background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-primary)"}}>－</button>
        </div>
      </div>

      {/* Ecological presets */}
      <div style={{padding:"4px 14px",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
        <div style={{fontSize:9,fontWeight:500,color:"var(--color-text-secondary)",marginBottom:3}}>Ecological conditions</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:3}}>
          {ECO_PRESETS.map(p=>(
            <button key={p.n} onClick={()=>{setEnv({...p.e});setTip(null);}} title={p.note}
              style={{padding:"2px 7px",borderRadius:5,fontSize:9,cursor:"pointer",
                background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",
                color:"var(--color-text-primary)"}}>
              {p.n}
            </button>
          ))}
          <button onClick={()=>setShowLit(x=>!x)}
            style={{padding:"2px 7px",borderRadius:5,fontSize:9,cursor:"pointer",
              background:"transparent",border:"0.5px solid var(--color-border-tertiary)",
              color:"var(--color-text-secondary)"}}>
            {showLit?"▲ Hide":"▼"} Literature studies
          </button>
        </div>
        {showLit&&(
          <div style={{display:"flex",gap:4,flexWrap:"wrap",paddingTop:3,borderTop:"0.5px solid var(--color-border-tertiary)"}}>
            {LIT_PRESETS.map(p=>(
              <button key={p.n} onClick={()=>{setEnv({...p.e});setTip(null);}} title={p.src}
                style={{padding:"2px 7px",borderRadius:5,fontSize:9,cursor:"pointer",
                  background:"var(--color-background-secondary)",border:`0.5px solid ${COL.keb}`,
                  color:COL.keb}}>
                {p.n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"155px 1fr 195px"}}>

        {/* Left panel */}
        <div style={{padding:"8px 10px",borderRight:"0.5px solid var(--color-border-tertiary)"}}>
          <div style={{fontWeight:500,fontSize:9.5,color:"var(--color-text-secondary)",marginBottom:5,letterSpacing:0.5}}>ENVIRONMENT</div>
          <Sld k="co2"   val={env.co2}   set={setE} min={50}  max={1500} step={10}  label="CO₂"          unit=" ppm"        color={COL.cbb}/>
          <Sld k="o2"    val={env.o2}    set={setE} min={2}   max={35}   step={0.5} label="O₂"           unit="%"           color={COL.pr}/>
          <Sld k="temp"  val={env.temp}  set={setE} min={5}   max={45}   step={1}   label="Temp."        unit="°C"          color="#BA7517"/>
          <Sld k="light" val={env.light} set={setE} min={0}   max={2000} step={50}  label="PAR"          unit=" µmol/m²/s"  color="#e07b00"/>
          <Sld k="pi"    val={env.pi}    set={setE} min={0}   max={100}  step={5}   label="Pi avail."    unit="%"           color="#1a6fb5"/>
          <Sld k="act"   val={env.act}   set={setE} min={20}  max={100}  step={5}   label="RuBisCO act." unit="%"           color={COL.cbb}/>

          <div style={{fontWeight:500,fontSize:9.5,color:"var(--color-text-secondary)",margin:"8px 0 5px",letterSpacing:0.5}}>KEBEISH BYPASS</div>
          <button onClick={()=>setBypassActive(x=>!x)} style={{
            width:"100%",padding:"3px 10px",borderRadius:5,fontSize:9.5,cursor:"pointer",fontWeight:500,marginBottom:6,
            background:bypassActive?"#7F77DD25":"transparent",
            border:`0.5px solid ${bypassActive?"#7F77DD":"var(--color-border-tertiary)"}`,
            color:bypassActive?"#7F77DD":"var(--color-text-secondary)",transition:"all 0.12s"
          }}>{bypassActive?"✓ Active":"Enable"} EcGlcDEF</button>
          {bypassActive&&<>
            <Sld k="bypassVmax" val={bypassVmax} set={(_,v)=>setBypassVmax(v)} min={0} max={20} step={0.5}
              label="EcGlcDH Vmax ⚠" unit=" µmol/m²/s" color="#e07b00"/>
            <div style={{fontSize:8,color:"var(--color-text-tertiary)",lineHeight:1.4,marginBottom:4}}>
              Placeholder — measure in transgenic lines
            </div>
            <div style={{padding:"5px 8px",background:"#7F77DD12",borderRadius:5,fontSize:8.5,lineHeight:1.7,border:"0.5px solid #7F77DD44"}}>
              <div style={{color:COL.keb}}>Bypassed: <strong>{(m.bypass_fraction*100).toFixed(1)}%</strong> of glycolate</div>
              <div style={{color:"var(--color-text-secondary)"}}>CO₂ released (GlxR): <strong style={{color:"#aaa"}}>{m.CO2_released.toFixed(2)}</strong></div>
              <div style={{color:"var(--color-text-secondary)"}}>CO₂ re-fixed (est.): <strong style={{color:COL.cbb}}>{m.CO2_refixed.toFixed(2)}</strong></div>
              <div style={{color:"var(--color-text-secondary)"}}>3-PGA returned: <strong style={{color:COL.cbb}}>{m.flux_3pga_k.toFixed(2)}</strong></div>
              <div style={{color:"var(--color-text-secondary)"}}>NH₃ saving: <strong style={{color:COL.nh3}}>{m.NH3_saving.toFixed(2)}</strong></div>
              <div style={{color:"var(--color-text-secondary)"}}>Γ*_eff: <strong style={{color:COL.pr}}>{m.gammastar_eff.toFixed(1)}</strong> µmol/mol</div>
              <div style={{color:"var(--color-text-secondary)"}}>A_bypass (est.): <strong style={{color:COL.cbb}}>{m.A_bypass.toFixed(2)}</strong></div>
              <div style={{fontSize:7.5,color:"var(--color-text-tertiary)",marginTop:2}}>{m.bypass_note}</div>
            </div>
          </>}

          <div style={{fontWeight:500,fontSize:9.5,color:"var(--color-text-secondary)",margin:"8px 0 5px",letterSpacing:0.5}}>PARAMETERS</div>
          <Sld k="Vcmax25" val={par.Vcmax25} set={setP} min={40} max={200} step={5} label="Vcmax₂₅ (Rubisco)"    unit=" µmol/m²/s" color="#533AB7"/>
          <Sld k="Jmax25"  val={par.Jmax25}  set={setP} min={50} max={350} step={5} label="Jmax₂₅ (e⁻ transport)" unit=" µmol/m²/s" color="#e07b00"/>

          <div style={{marginTop:6,padding:"5px 8px",background:"var(--color-background-secondary)",borderRadius:5,fontSize:9,lineHeight:1.85}}>
            {[["Vcmax(T)",`${m.Vcmax_eff.toFixed(1)} µmol/m²/s`,COL.cbb],
              ["Jmax₂₅",  `${par.Jmax25} µmol/m²/s`,"#e07b00"],
              ["Γ*(T)",   `${m.gammastar.toFixed(1)} µmol/mol`, COL.pr],
              ["Srel(T)", `${m.Srel.toFixed(0)}`,               "#555"],
              ["Cc",      `${m.Cc.toFixed(0)} µmol/mol`,        "#555"],
              ["Rd",      `${m.Rd.toFixed(2)} µmol/m²/s`,       "#BA7517"],
            ].map(([l,v,c])=>(<div key={l} style={{color:"var(--color-text-secondary)"}}>{l}: <span style={{fontWeight:600,color:c}}>{v}</span></div>))}
          </div>
          <Legend show={showLegend} onToggle={()=>setShowLegend(x=>!x)}/>
        </div>

        {/* Centre: SVG map */}
        <div ref={containerRef}
          style={{overflow:"hidden",cursor:dragging.current?"grabbing":"grab",userSelect:"none",position:"relative",minHeight:340}}
          onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
          onClick={()=>setTip(null)}>
          <div style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,transformOrigin:"top left",transition:"transform 0.05s"}}>
            <svg width={SVG_W} viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{display:"block"}}>
              <defs>
                <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
                  <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth={1.5} strokeLinecap="round"/>
                </marker>
              </defs>

              {/* Compartments */}
              <CompBox x={4}   y={16}      w={574} h={stromaH} comp="stroma" label="Chloroplast stroma"/>
              <CompBox x={364} y={compsY}  w={210} h={110}     comp="perox"  label="Peroxisome"/>
              <CompBox x={4}   y={compsY}  w={290} h={110}     comp="mito"   label="Mitochondria"/>

              {/* ── CBB cycle ───────────────────────────────────────────── */}
              <Arrow x1={rx("co2")}  y1={cy("co2")}  x2={lx("rubp")} y2={cy("rubp")} flux={m.Vc} color={COL.cbb} dashed ak="rubisco_c" onA={onA}/>
              <Arrow x1={rx("rubp")} y1={cy("rubp")} x2={lx("pg3")}  y2={cy("pg3")}  flux={m.Vc} color={COL.cbb} dashed label="Vc" ak="rubisco_c" onA={onA}/>
              <Arrow x1={rx("pg3")}  y1={cy("pg3")}  x2={lx("g3p")}  y2={cy("g3p")}  flux={m.Vc} color={COL.cbb} dashed label="3ATP 2NADPH" ak="pgk_gapdh" onA={onA}/>
              <Arrow x1={cx("g3p")}  y1={ty("g3p")}  x2={cx("rubp")} y2={ty("rubp")} flux={m.Vc} color={COL.cbb} dashed label="regen" bend={-16} ak="regen" onA={onA}/>

              {/* ── Oxygenation ─────────────────────────────────────────── */}
              <Arrow x1={cx("rubp")} y1={by("rubp")} x2={sn.pg2[0]}     y2={sn.pg2[1]-SR}    flux={m.Vo} color={COL.pr} dashed label="Vo" ak="rubisco_o" onA={onA}/>
              <Arrow x1={sn.pg2[0]+SR} y1={sn.pg2[1]} x2={lx("glycolate")} y2={cy("glycolate")} flux={m.Vo} color={COL.pr} dashed ak="pgpase" onA={onA}/>

              {/* ── Native GOX route (perox) ─────────────────────────────── */}
              <Arrow x1={cx("glycolate")} y1={by("glycolate")+4} x2={sn.glyoxP[0]-SR} y2={sn.glyoxP[1]}
                flux={m.native_GOX_flux} color={COL.pr} dashed label="GOX (native)" ak="gox_p" onA={onA}/>
              <Arrow x1={sn.glyoxP[0]} y1={sn.glyoxP[1]+SR} x2={lx("glycine")} y2={cy("glycine")}
                flux={m.flux_glycine/2} color={COL.pr} dashed label="GGAT" ak="ggat" onA={onA}/>
              <Arrow x1={lx("glycine")} y1={cy("glycine")+4} x2={sn.glycineP[0]} y2={sn.glycineP[1]+SR}
                flux={m.flux_glycine} color={COL.pr} dashed label="Gly→mito"/>
              <Arrow x1={lx("hpp")} y1={cy("hpp")} x2={rx("glycerate")} y2={cy("glycerate")} // serine→hpp arrow missing, hpr
                flux={m.flux_glycerate} color={COL.pr} dashed label="HPR" ak="hpr" onA={onA}/>
              <Arrow x1={cx("glycerate")} y1={ty("glycerate")-6} x2={cx("glycolate")+20} y2={by("glycolate")+4}
                flux={m.flux_glycerate} color={COL.pr} dashed label="→stroma"/>

              {/* ── Mito ─────────────────────────────────────────────────── */}
              <Arrow x1={sn.glycineP[0]} y1={sn.glycineP[1]-SR} x2={lx("serine")} y2={cy("serine")}
                flux={m.flux_glycine} color={COL.pr} dashed label="GDC/SHMT" ak="gdc_shmt" onA={onA}/>
              <Arrow x1={cx("serine")} y1={ty("serine")} x2={cx("hpp")} y2={by("hpp")+4}
                flux={m.flux_serine} color={COL.pr} dashed label="Ser→perox" bend={-8}/>
              <Arrow x1={lx("gly_m")} y1={cy("gly_m")+4} x2={rx("nh3")} y2={cy("nh3")}
                flux={m.flux_NH3} color={COL.nh3} dashed label="NH₃" ak="gsgo" onA={onA}/>
              <Arrow x1={cx("gly_m")+10} y1={by("gly_m")} x2={cx("nh3")+10} y2={ty("nh3")}
                flux={m.flux_CO2_rel} color="#aaa" dashed label="CO₂ (GDC)"/>

              {/* ── Kebeish bypass — full 4-step chain in stroma ────────────
                   Glycolate → [GcL] → Glyox_k → [GlxR] → Tartr-SA → [TSR] → Glycerate_k → [GLYK] → 3-PGA
                   CO₂ released at GlxR step; product 3-PGA re-enters CBB
              ──────────────────────────────────────────────────────────── */}
              {bypassActive&&<>
                {/* Kebeish row label */}
                <text x={8} y={nd.glyox_k[1]-8} fontSize={7} fill={COL.keb} fontWeight={600} opacity={0.8}>
                  Kebeish bypass (stroma only):
                </text>

                {/* Step 1: Glycolate → Glyox_k dot (GcL) */}
                <Arrow x1={cx("glycolate")} y1={by("glycolate")}
                  x2={sn.glyox_k[0]} y2={sn.glyox_k[1]-SR}
                  flux={m.bypass_flux} color={COL.keb} dashed label="GcL" ak="gcl" onA={onA}/>

                {/* Glyox_k dot → Tartr dot (GlxR, releases CO₂) */}
                <Arrow x1={sn.glyox_k[0]+SR} y1={sn.glyox_k[1]}
                  x2={sn.tartr[0]-SR} y2={sn.tartr[1]}
                  flux={m.flux_glyoxylate_k} color={COL.keb} dashed label="GlxR" ak="glxr" onA={onA}/>

                {/* CO₂ released at GlxR — arcs up to CO₂ node */}
                <Arrow x1={sn.tartr[0]} y1={sn.tartr[1]-SR}
                  x2={cx("co2")+14} y2={by("co2")}
                  flux={m.CO2_released} color="#aaa" dashed label="CO₂ rel." bend={-30}/>

                {/* Tartr dot → Glycer_k dot (TSR, NADPH) */}
                <Arrow x1={sn.tartr[0]+SR} y1={sn.tartr[1]}
                  x2={sn.glycer_k[0]-SR} y2={sn.glycer_k[1]}
                  flux={m.flux_tartronate} color={COL.keb} dashed label="TSR (NADPH)" ak="tsr" onA={onA}/>

                {/* Glycer_k dot → 3-PGA (GLYK) — back into CBB! */}
                <Arrow x1={sn.glycer_k[0]+SR} y1={sn.glycer_k[1]}
                  x2={cx("pg3")} y2={by("pg3")}
                  flux={m.flux_3pga_k} color={COL.keb} dashed label="GLYK → 3-PGA" ak="glyk" onA={onA} bend={-20}/>

                {/* Labels under each dot */}
                <text x={sn.glyox_k[0]}  y={sn.glyox_k[1]+SR+9}  fontSize={6.5} fill={COL.keb} textAnchor="middle">Glyoxylate</text>
                <text x={sn.tartr[0]}    y={sn.tartr[1]+SR+9}    fontSize={6.5} fill={COL.keb} textAnchor="middle">Tartr.-SA</text>
                <text x={sn.glycer_k[0]} y={sn.glycer_k[1]+SR+9} fontSize={6.5} fill={COL.keb} textAnchor="middle">Glycerate</text>

                {/* Dot nodes */}
                <SmallNode x={sn.glyox_k[0]}  y={sn.glyox_k[1]}  color={COL.keb} nk="glyox_k"  onN={onN}/>
                <SmallNode x={sn.tartr[0]}    y={sn.tartr[1]}    color={COL.keb} nk="tartr"    onN={onN}/>
                <SmallNode x={sn.glycer_k[0]} y={sn.glycer_k[1]} color={COL.keb} nk="glycer_k" onN={onN}/>
              </>}

              {/* ── Large named nodes ────────────────────────────────────── */}
              {[["co2","CO₂","stroma"],["rubp","RuBP","stroma"],["pg3","3-PGA","stroma"],
                ["g3p","G3P","stroma"],["glycolate","Glycolate","stroma"],
                ["glycine","Glycine","perox"],["hpp","HPP","perox"],["glycerate","Glycerate","perox"],
                ["gly_m","Gly (mito)","mito"],["serine","Serine","mito"],["nh3","NH₃","mito"],
              ].map(([k,l,c])=>(<Node key={k} x={nd[k][0]} y={nd[k][1]} label={l} comp={c}/>))}

              {/* ── Small dot nodes (clickable metabolites) ──────────────── */}
              <SmallNode x={sn.pg2[0]}     y={sn.pg2[1]}     color={COL.pr}  nk="pg2"      onN={onN}/>
              <SmallNode x={sn.glyoxP[0]}  y={sn.glyoxP[1]}  color={COL.pr}  nk="glyoxy"   onN={onN}/>
              <SmallNode x={sn.glycineP[0]} y={sn.glycineP[1]} color={COL.pr} nk="glycine"  onN={onN}/>

              {/* A < 0 banner */}
              {m.A<0&&(
                <g>
                  <rect x={4} y={compsY+115} width={574} height={20} rx={3} fill="#E24B4A14" stroke="#E24B4A" strokeWidth={0.6}/>
                  <text x={12} y={compsY+128} fontSize={8.5} fill="#E24B4A" fontWeight={500}>
                    ⚠ A = {m.A.toFixed(2)} µmol/m²/s — Cc ({m.Cc.toFixed(0)}) &lt; Γ* ({m.gammastar.toFixed(1)}) — net carbon loss
                  </text>
                </g>
              )}
              <text x={8} y={SVG_H-7} fontSize={7.5} fill="#aaa">Arrow width = √flux — thicker = more molecules/s (µmol/m²/s) · Bernacchi 2001 kinetics · click arrows or ● for details</text>

              {/* Floating tooltip */}
              {tip&&<Tip info={tip.info} x={tip.x} y={tip.y} W={SVG_W} onClose={()=>setTip(null)}/>}
            </svg>
          </div>
        </div>

        {/* Right: metrics */}
        <div style={{padding:"8px 8px",borderLeft:"0.5px solid var(--color-border-tertiary)"}}>
          <div style={{fontWeight:500,fontSize:9.5,color:"var(--color-text-secondary)",marginBottom:5,letterSpacing:0.5}}>
            LIVE METRICS <span style={{fontWeight:400,fontSize:8}}>ⓘ click to learn</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
            {[["Net A",m.A,"µmol/m²/s",m.A>=0?COL.cbb:"#E24B4A"],
              ["Limit",m.limitState,"—",m.limitState==="Rubisco"?"#533AB7":"#BA7517"],
              ["Wc",m.Wc,"µmol/m²/s","#533AB7"],
              ["Wj",m.Wj,"µmol/m²/s","#BA7517"],
              ["Vc",m.Vc,"µmol/m²/s",COL.cbb],
              ["Vo",m.Vo,"µmol/m²/s",COL.pr],
              ["Vo/Vc",m.vovc,"ratio",COL.pr],
              ["J",m.J,"µmol/m²/s","#e07b00"],
              ["Γ*",bypassActive?m.gammastar_eff:m.gammastar,"µmol/mol",COL.pr],
              ["Rd",m.Rd,"µmol/m²/s","#BA7517"],
            ].map(([label,value,unit,color])=>(
              <MCard key={label} label={label} value={value} unit={unit} color={color}
                onInfo={setActiveInfo} active={activeInfo===label}/>
            ))}
          </div>

          {bypassActive&&(
            <div style={{marginBottom:6,padding:"7px 10px",background:"#7F77DD10",borderRadius:6,border:"0.5px solid #7F77DD44",fontSize:9}}>
              <div style={{fontWeight:600,fontSize:9.5,color:COL.keb,marginBottom:4}}>KEBEISH BYPASS FLUXES</div>
              {[
                ["Glycolate bypassed", m.bypass_flux,    "µmol/m²/s", COL.keb],
                ["% of glycolate",    m.bypass_fraction*100, "%",     COL.keb],
                ["CO₂ released (GlxR)",m.CO2_released,  "µmol/m²/s", "#aaa"],
                ["CO₂ re-fixed (est.)",m.CO2_refixed,   "µmol/m²/s", COL.cbb],
                ["3-PGA returned",    m.flux_3pga_k,    "µmol/m²/s", COL.cbb],
                ["NH₃ saving",        m.NH3_saving,     "µmol/m²/s", COL.nh3],
                ["A_bypass (est.)",   m.A_bypass,       "µmol/m²/s", COL.cbb],
              ].map(([l,v,u,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3,gap:4}}>
                  <span style={{color:"var(--color-text-secondary)",flex:1}}>{l}</span>
                  <span style={{fontWeight:700,color:c,minWidth:36,textAlign:"right"}}>{typeof v==="number"?v.toFixed(2):v}</span>
                  <span style={{color:"var(--color-text-tertiary)",minWidth:36}}>{u}</span>
                </div>
              ))}
            </div>
          )}

          <InfoPop metric={activeInfo} onClose={()=>setActiveInfo(null)}/>

          <div style={{fontWeight:500,fontSize:9.5,color:"var(--color-text-secondary)",margin:"8px 0 4px",letterSpacing:0.5}}>
            FLUXES vs Vc={m.Vc.toFixed(1)}
          </div>
          {[
            ["Vc (carboxylation)", m.Vc,           COL.cbb, "Gross RuBisCO carboxylation — reference"],
            ["Vo (oxygenation)",   m.Vo,           COL.pr,  "Oxygenation = Vc × Vo/Vc"],
            ["Glycolate (total)",  m.flux_glycolate,COL.pr, "2×Vo total glycolate produced"],
            ["Serine return",      m.flux_serine,  "#c06030","1×Vo — recovered per oxygenation via PR"],
            ["CO₂ lost (GDC)",     m.flux_CO2_rel, "#aaa",  "0.5×Vo — net C cost of classical PR"],
            ["NH₃ (GDC)",          m.flux_NH3,     COL.nh3, "1×Vo — must be re-fixed by GS/GOGAT"],
          ].map(([l,v,c,tip])=>{
            const ref=Math.max(m.Vc,0.01);
            const pct=Math.min(v/ref*100,150);
            return(
              <div key={l} title={tip} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <span style={{fontSize:8,color:"var(--color-text-secondary)",minWidth:80,lineHeight:1.2}}>{l}</span>
                <div style={{flex:1,margin:"0 5px",background:"var(--color-background-secondary)",borderRadius:2,height:5,position:"relative",overflow:"visible"}}>
                  <div style={{width:`${Math.min(pct,100)}%`,height:"100%",background:c,borderRadius:2,transition:"width 0.2s",opacity:0.85}}/>
                  {pct>100&&<div style={{position:"absolute",right:-2,top:-2,width:4,height:9,background:"#E24B4A",borderRadius:1}}/>}
                </div>
                <span style={{fontSize:8.5,fontWeight:600,color:c,minWidth:30,textAlign:"right"}}>{v.toFixed(1)}</span>
              </div>
            );
          })}

          <div style={{marginTop:6,padding:"5px 8px",background:"var(--color-background-secondary)",borderRadius:5,fontSize:9,lineHeight:1.75}}>
            <div style={{color:"var(--color-text-secondary)"}}>Vo/Vc: <span style={{fontWeight:600,color:COL.pr}}>{m.vovc.toFixed(3)}</span> — {(m.vovc*100).toFixed(0)}% oxygenations</div>
            <div style={{color:"var(--color-text-secondary)"}}>C lost/Vc: <span style={{fontWeight:600,color:"#E24B4A"}}>{m.Vc>0?(m.carbon_loss/m.Vc*100).toFixed(1):0}%</span></div>
          </div>
          <div style={{marginTop:6}}><LimitBanner m={m}/></div>
          <div style={{marginTop:6,fontSize:8,color:"var(--color-text-tertiary)",lineHeight:1.7}}>
            Kc₂₅=272.4 · Ko₂₅=165.8 · Γ*₂₅=42.75 · Srel₂₅=2590 · ci/ca=0.70 · Cc/Ci=0.80
          </div>
        </div>
      </div>
    </div>
  );
}
