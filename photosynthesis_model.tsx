import { useState, useEffect, useRef, useCallback } from "react";
// Photosynthesis · Photorespiration · Organelle Map — v21

// ── palette ────────────────────────────────────────────────────────────────
const K = {
  cbb:"#1D9E75", pr:"#D85A30",
  keb:"#7F77DD",  // Kebeish: GcL/GlxR/TSR/GLYK → 3-PGA
  ap3:"#378ADD",  // AP3/Maier: GOX+MS → malate
  bhac:"#D4537E", // BHAC: BHAA synth/lyase/MDH → malate
  mcg:"#639922",  // MCG malyl-CoA-glycerate: CO2-fixing bypass → malate
  c4:"#533AB7", pyr:"#e07b00",
  tca:"#BA7517", suc:"#c0396e", gly:"#1a6fb5",
  nh3:"#888", transp:"#556",
  atp:"#E24B4A", nadph:"#7F77DD", nadh:"#378ADD", fd:"#1D9E75",
};
const CS = {
  stroma:{ fill:"#eaf7f1", stroke:"#1D9E75" },
  perox: { fill:"#fef3ee", stroke:"#D85A30" },
  mito:  { fill:"#fff8f0", stroke:"#BA7517" },
  cyto:  { fill:"#eef3ff", stroke:"#1a6fb5" },
  bs:    { fill:"#f0eeff", stroke:"#533AB7" },
  pyr_c: { fill:"#fff5e6", stroke:"#e07b00" },
};

// ── Ecological presets ─────────────────────────────────────────────────────
const ECO = [
  {n:"Night",      e:{co2:420,o2:21,temp:15,light:0,   pi:40,act:20}, note:"No PAR — all flux stops"},
  {n:"Deep shade", e:{co2:380,o2:21,temp:18,light:60,  pi:55,act:50}, note:"Forest understorey"},
  {n:"Cloudy",     e:{co2:420,o2:21,temp:20,light:250, pi:75,act:70}, note:"Overcast temperate"},
  {n:"Sunny C3",   e:{co2:420,o2:21,temp:25,light:900, pi:90,act:90}, note:"Full sun C3 standard"},
  {n:"Hot/dry",    e:{co2:220,o2:21,temp:40,light:1400,pi:60,act:75}, note:"Stomata near-closed — CO₂ starved"},
  {n:"C3 winter",  e:{co2:420,o2:21,temp:8, light:400, pi:80,act:55}, note:"Cold inhibits enzymes"},
  {n:"High CO₂",   e:{co2:800,o2:21,temp:25,light:900, pi:90,act:90}, note:"eCO₂ — PR suppressed"},
  {n:"High O₂",    e:{co2:400,o2:35,temp:25,light:900, pi:90,act:90}, note:"Hyperoxia — max PR"},
  {n:"Pi starved",  e:{co2:420,o2:21,temp:25,light:700, pi:12,act:80}, note:"TPT blocked"},
  {n:"C4 midday",  e:{co2:400,o2:21,temp:35,light:1600,pi:90,act:95}, note:"C4 conditions"},
];
const LIT = [
  {n:"FvCB 1980",    e:{co2:340,o2:21,temp:25,light:1200,pi:90,act:90}, src:"Farquhar et al. 1980 Planta 149:78"},
  {n:"Bernacchi '01",e:{co2:380,o2:21,temp:25,light:1000,pi:90,act:90}, src:"Bernacchi et al. 2001 PCE 24:253"},
  {n:"Long '03",     e:{co2:370,o2:21,temp:25,light:1500,pi:90,act:90}, src:"Long & Bernacchi 2003 JXB 54:2393"},
  {n:"Kebeish '07",  e:{co2:360,o2:21,temp:22,light:120, pi:80,act:80}, src:"Kebeish et al. 2007 Nat Biotechnol 25:593"},
  {n:"Zhu '08",      e:{co2:380,o2:21,temp:30,light:1800,pi:90,act:95}, src:"Zhu et al. 2008 Plant Physiol 146"},
  {n:"Hatch C4",     e:{co2:380,o2:2, temp:30,light:1800,pi:90,act:95}, src:"Hatch 1987 BBA 895:81"},
  {n:"FACE eCO₂",   e:{co2:570,o2:21,temp:25,light:1000,pi:90,act:90}, src:"Ainsworth & Long 2005 NP 165:351"},
  {n:"RCP8.5 2100",  e:{co2:900,o2:21,temp:29,light:1000,pi:90,act:90}, src:"IPCC AR6 RCP8.5"},
];

// ── Arrow metadata ─────────────────────────────────────────────────────────
const AM = {
  rubisco_c:{name:"RuBisCO carboxylation",ec:"4.1.1.39",rxn:"RuBP + CO₂ → 2× 3-PGA",up:"↑ CO₂ (Michaelis gated), ↑ light (J), ↑ activation",down:"↑ O₂ competition, ↑ temp (Sco declines), ↓ CO₂ stomatal closure"},
  rubisco_o:{name:"RuBisCO oxygenation",  ec:"4.1.1.39",rxn:"RuBP + O₂ → 2-PG + 3-PGA",up:"↑ O₂, ↑ temp (Sco falls), ↓ CO₂",down:"C4/pyrenoid CO₂ pump, ↑ CO₂"},
  pgk:      {name:"PGK + GAPDH",          ec:"2.7.2.3/1.2.1.13",rxn:"3-PGA + ATP + NADPH → G3P",up:"↑ ATP, ↑ NADPH, thioredoxin (light)",down:"↓ Pi (TPT blocked), darkness"},
  regen:    {name:"RuBP regeneration PRK",ec:"2.7.1.19",rxn:"G3P + 3ATP → RuBP",up:"↑ ATP, light (thioredoxin activates PRK)",down:"↓ Pi, darkness"},
  starch_s: {name:"AGPase + starch synthase",ec:"2.7.7.27",rxn:"G3P → ADP-Glc → starch",up:"↑ 3-PGA/Pi ratio activates AGPase",down:"High Pi; darkness"},
  tpt:      {name:"Triose-P/Pi translocator",ec:"TC2.A.15",rxn:"G3P(stroma) ⇌ Pi(cytosol) 1:1 antiport",up:"↑ G3P, ↑ cytosolic Pi",down:"Pi starvation — no Pi to exchange"},
  gox_p:    {name:"Glycolate oxidase (perox)",ec:"1.1.3.15",rxn:"Glycolate + O₂ → Glyoxylate + H₂O₂",up:"↑ glycolate, ↑ O₂",down:"Bypasses reroute glycolate before perox"},
  ggat:     {name:"Glu:glyoxylate AT",    ec:"2.6.1.4",rxn:"Glyoxylate + Glu → Glycine + 2-OG",up:"↑ glyoxylate, ↑ Glu",down:"N-limitation; bypasses reduce glyoxylate pool"},
  hpr:      {name:"Hydroxypyruvate reductase",ec:"1.1.1.29",rxn:"HPA + NADH → Glycerate + NAD⁺",up:"↑ HPA, ↑ NADH from mito",down:"↓ NADH; HPR2 cytosolic isozyme partly compensates"},
  gdc:      {name:"Glycine decarboxylase complex",ec:"1.4.4.2",rxn:"2 Gly → Ser + CO₂ + NH₃ + NADH (mito)",up:"↑ Gly, ↑ NAD⁺; can use 50% of mito capacity in C3",down:"NADH accumulation inhibits; cold <15°C strongly inhibits"},
  gsgo:     {name:"GS + Fd-GOGAT",        ec:"6.3.1.2/1.4.7.1",rxn:"NH₃ + Glu + ATP → Gln; Gln + 2-OG + Fd → 2 Glu",up:"↑ NH₃, ↑ Fd_red (light), ↑ ATP",down:"↓ light (Fd), N-limitation"},
  mv_sc:    {name:"Malate valve MDH + DiT2",ec:"1.1.1.37/TC2.A.15",rxn:"NADPH surplus → Malate(str) → DiT2 → cytosol",up:"↑ NADPH surplus; thioredoxin activates NADP-MDH",down:"Darkness inactivates NADP-MDH"},
  mv_cm:    {name:"Malate valve DTC → Complex I",ec:"TC2.A.23",rxn:"Malate(cyt) → mito → NADH → CI → ATP",up:"↑ cytosolic malate, ↑ mito NAD⁺",down:"DTC saturation; mito redox poise"},
  glycol:   {name:"Glycolysis PFK/PK",    ec:"2.7.1.11/2.7.1.40",rxn:"G3P → PEP → Pyruvate",up:"↑ AMP/ADP energy charge",down:"↑ ATP inhibits PFK"},
  sps:      {name:"Sucrose-P synthase",   ec:"2.4.1.14",rxn:"UDP-Glc + F6P → Sucrose",up:"↑ UDP-Glc, light-activated SPS phosphorylation",down:"Sucrose feedback; circadian"},
  // KEBEISH: GcL/GlxR/TSR/GLYK — E.coli glycolate catabolism in chloroplast
  keb:      {name:"Kebeish bypass: GcL→GlxR→TSR→GLYK (stroma)",ec:"1.1.99.14/4.1.1.47/1.1.1.60/2.7.1.31",
    rxn:"Glycolate→Glyoxylate(GcL)→Tartr.-SA(GlxR,CO₂ released)→Glycerate(TSR,NADPH)→3-PGA(GLYK)",
    up:"↑ glycolate stroma; bypasses entire perox/mito PR loop; saves GDC+GS/GOGAT cost",
    down:"CO₂ released at GlxR step (unlike other bypasses); transgene expression level"},
  // AP3/Maier: GOX + malate synthase
  ap3r:     {name:"AP3/Maier bypass: GOX + malate synthase (stroma)",ec:"1.1.3.15/2.3.3.9",
    rxn:"Glycolate→Glyoxylate(GOX,stroma)+Acetyl-CoA→Malate(MS,stroma)",
    up:"↑ glycolate, ↑ AcCoA; no GDC/GS-GOGAT; no NH₃ released",
    down:"AcCoA availability; H₂O₂ from GOX managed by stromal APX; transgene expression"},
  // BHAC: β-hydroxyaspartate cycle
  bhacr:    {name:"BHAC: BHAA synthase + lyase + MDH (stroma)",ec:"—",
    rxn:"Glyoxylate+Asp→β-HA(BHAA synth.)→OAA+NH₃(BHAA lyase)→Malate(MDH,stroma)",
    up:"↑ glyoxylate stroma, ↑ Asp; saves ~1.5 ATP vs classical PR",
    down:"Asp availability; NH₃ still released → GS/GOGAT needed"},
  // MCG malyl-CoA-glycerate: CO2-fixing bypass
  mcgr:     {name:"MCG malyl-CoA-glycerate pathway (stroma)",ec:"6.2.1.—/6.4.1.3/4.1.3.24",
    rxn:"Glycolate→Glycolyl-CoA(CoA ligase)→Malyl-CoA(propionyl-CoA carboxylase,+CO₂)→Malate(malyl-CoA lyase)",
    up:"↑ glycolate, ↑ CoA, ↑ ATP; UNIQUE: fixes CO₂ instead of releasing it; most C-efficient",
    down:"CoA + ATP cost for CoA ligase; propionyl-CoA carboxylase requires biotin; transgene"},
  pepc:     {name:"PEPC (C4 mesophyll)",  ec:"4.1.1.31",rxn:"PEP + HCO₃⁻ → OAA + Pi",up:"↑ CO₂/HCO₃⁻, PEPC kinase light-activated",down:"Malate feedback; dark"},
  nadpme:   {name:"NADP-ME (C4 BS)",      ec:"1.1.1.40",rxn:"Malate + NADP⁺ → Pyruvate + CO₂ + NADPH",up:"↑ malate, ↑ NADP⁺",down:"NADPH accumulation"},
  ppdk:     {name:"PPDK (C4 mesophyll)",  ec:"2.7.9.1",rxn:"Pyruvate + ATP + Pi → PEP + AMP + PPi",up:"↑ pyruvate, light activates PDRP",down:"Cold irreversibly inactivates; dark"},
};

const NI = {
  pg2:     {name:"2-Phosphoglycolate",f:"C₃H₅O₆P",r:"Oxygenation product. Dephosphorylated by PGPase → glycolate. Inhibits triose-P isomerase if accumulates."},
  glyox_p: {name:"Glyoxylate (peroxisome)",f:"C₂H₂O₃",r:"Classical PR. Transaminated by GGAT+SGAT → glycine. Toxic if accumulates."},
  glycine_p:{name:"Glycine (perox→mito)",f:"C₂H₅NO₂",r:"Rate-limiting step of classical PR. 2 Gly → mito GDC. Can use 50% of mito capacity."},
  gly_m:   {name:"Glycine (mito)",f:"C₂H₅NO₂",r:"GDC substrate: 2 Gly → Ser + CO₂ + NH₃ + NADH. CO₂ = net C loss (0.5 per oxygenation)."},
  co2_gdc: {name:"CO₂ from GDC",f:"CO₂",r:"Net carbon cost of photorespiration. ~25% of gross fixed C lost under standard C3 conditions."},
  pyr_m:   {name:"Pyruvate (mito)",f:"C₃H₄O₃",r:"Imported via MPC. PDH → AcCoA → TCA. Links glycolysis to mito NADH + ATP."},
  cit_out: {name:"Citrate (exported)",f:"C₆H₈O₇",r:"Exported mito→cytosol. Used for OAA/fatty acid synthesis. Links TCA to cytosolic metabolism."},
  oaa_cyt: {name:"OAA (cytosol)",f:"C₄H₄O₅",r:"From PEPC. Reduced→malate (malate valve) or transaminated→Asp (amino acid biosynthesis)."},
  phloem:  {name:"Phloem export",f:"Sucrose",r:"SUT/SWEET transporter loading. Primary long-distance C transport. Sink-demand regulated."},
  aa_s:    {name:"Amino acids",f:"Various",r:"Shikimate→Phe/Tyr/Trp; OAA→Asp/Asn/Thr/Met/Lys."},
  arom:    {name:"Aromatics/shikimate",f:"Various",r:"Lignin, flavonoids, alkaloids, salicylate. Up to 20% of C under stress."},
  fas_s:   {name:"Fatty acids (stromal FAS)",f:"Cn",r:"14 NADPH + 7 ATP per C16. Major NADPH sink at high light."},
  // Kebeish-specific intermediates
  tartr_k: {name:"Tartronate semialdehyde (Kebeish)",f:"C₃H₄O₄",r:"Formed by GlxR (glyoxylate carboligase) from 2 glyoxylate + release of CO₂. Reduced to glycerate by TSR using NADPH."},
  glycer_k:{name:"Glycerate (Kebeish, stroma)",f:"C₃H₆O₄",r:"TSR product. Phosphorylated to 3-PGA by GLYK in stroma. Entire Kebeish route stays in chloroplast."},
  // AP3
  glyox_ap:{name:"Glyoxylate (AP3, stroma)",f:"C₂H₂O₃",r:"GOX product in stroma. Immediately condensed with AcCoA by malate synthase → malate. Never reaches peroxisome."},
  // BHAC
  bha:     {name:"β-Hydroxyaspartate",f:"C₄H₇NO₅",r:"BHAC intermediate. Glyoxylate + Asp → β-HA (BHAA synthase). Cleaved → OAA + NH₃ (BHAA lyase). All stroma."},
  // MCG
  glycolyl:{name:"Glycolyl-CoA (MCG)",f:"C₃H₅O₃-CoA",r:"MCG first step: glycolate + CoA + ATP → glycolyl-CoA (acyl-CoA ligase). Energy-requiring activation."},
  malylcoa:{name:"Malyl-CoA (MCG)",f:"C₅H₇O₄-CoA",r:"MCG: glycolyl-CoA + CO₂ (biotin) → malyl-CoA (propionyl-CoA carboxylase). UNIQUE: fixes atmospheric CO₂."},
  pep_m:   {name:"PEP (C4 mesophyll)",f:"C₃H₅O₆P",r:"PEPC substrate. Km(CO₂)~1µM — 60× higher affinity than RuBisCO. Not inhibited by O₂."},
  oaa_m:   {name:"OAA (C4 mesophyll)",f:"C₄H₄O₅",r:"PEPC product → malate via NADP-MDH for BS transport."},
  mal_m:   {name:"Malate (M→BS)",f:"C₄H₆O₅",r:"Plasmodesmata transport. NADP-ME decarboxylates in BS stroma → CO₂ at RuBisCO."},
  pyr_bs:  {name:"Pyruvate (BS→M)",f:"C₃H₄O₃",r:"NADP-ME product. Returns to M-cell for PPDK → PEP, completing C4 cycle."},
};

// ── Kinetics ──────────────────────────────────────────────────────────────
function kin(env, bp, c4, pyrenoid) {
  const {co2,o2,temp,light,pi,act} = env;
  const Q10  = Math.pow(2,(temp-25)/10);
  const Sco  = 2600*Math.exp(-0.058*(temp-25));
  const alpha=0.3,theta=0.9,Jmax=act/100,I=light/1000;
  const disc = Math.max(0,(alpha*I+Jmax)**2-4*theta*alpha*I*Jmax);
  const Lf   = (alpha*I+Jmax-Math.sqrt(disc))/(2*theta);
  const J    = Q10*Lf;
  const atp_prod=J, nadph_prod=J*0.75;

  const c4eff  = c4       ? Math.min(0.95,Lf*(act/100)*(co2/400)*0.9)  : 0;
  const pyreff = pyrenoid  ? Math.min(0.98,Lf*(act/100)*0.95)           : 0;
  const CO2e   = pyrenoid ? co2*(1+80*pyreff) : c4 ? co2*(1+4.5*c4eff) : co2;
  const O2e    = pyrenoid ? o2*(1-0.98*pyreff): c4 ? o2*(1-0.75*c4eff) : o2;

  // Michaelis CO₂ gating — prevents Vc being unrealistically high at low CO₂
  const Km_co2 = 380; // ppm equivalent of RuBisCO Km
  const co2_gate = CO2e/(CO2e+Km_co2);
  const VoVc  = 0.21*(O2e/21)/(CO2e/400)*(2600/Sco);
  const Vc    = J*co2_gate/(1+VoVc);
  const Vo    = J*co2_gate*VoVc/(1+VoVc);

  // Bypass allocation
  const fk = bp.kebeish ? Math.min(Vo*0.60,Vo) : 0;
  const fa = bp.ap3     ? Math.min(Vo*0.50,Vo) : 0;
  const fb = bp.bhac    ? Math.min(Vo*0.44,Vo) : 0;
  const fm = bp.mcg     ? Math.min(Vo*0.40,Vo) : 0;
  const pr = Math.max(Vo-fk-fa-fb-fm,0);
  const pr_nh3=pr*0.5;

  // Energy
  const atp_save=fk*2+fa*2+fb*1.5+fm*2; // MCG costs extra ATP (CoA ligase)
  const c4_atp=c4?Vc*c4eff*2:0;
  const pyr_atp=pyrenoid?Vc*pyreff*2.5:0;
  const atp_demand  =(Vc*3+pr*3.5+c4_atp+pyr_atp-atp_save*0.1)*0.15;
  const nadph_demand=(Vc*2+pr*1.0+fk*0.5)*0.18; // Kebeish TSR uses NADPH
  const atpP  =Math.max(0,Math.min(1,(atp_prod-atp_demand)/Math.max(atp_prod,0.001)));
  const nadphP=Math.max(0,Math.min(1,(nadph_prod-nadph_demand)/Math.max(nadph_prod,0.001)));
  const nadhP =Math.max(0,Math.min(1,0.25+pr*2*0.40));
  const fdP   =Math.max(0,Math.min(1,Lf*0.9-pr*0.14));

  const pif=pi/100;
  const cbb_c=Vc;
  const cbb_r=Vc*Math.min(nadph_prod/Math.max(nadph_demand,0.001),1)*pif;
  const cbb_g=Vc*Math.min(atp_prod/Math.max(atp_demand,0.001),1)*pif;
  const g3p_st=cbb_r*0.20*pif,g3p_su=cbb_r*0.25*pif,g3p_gl=cbb_r*0.15*pif;

  const ns=Math.max(0,nadph_prod-Vc*2*0.18);
  const mv_sc=ns*0.55,mv_cm=mv_sc*0.70;

  const mito_gly=pr,mito_nadh=pr*2,mito_co2=pr*0.5;
  const mito_nh3=pr_nh3,mito_atp=(pr*2+mv_cm)*0.25;
  const mito_2og=mv_cm*0.8,mito_pyr=g3p_gl*0.5*0.85,mito_cit=mito_pyr*0.4;

  const pep_shk=g3p_gl*0.25,pep_pyr=g3p_gl*0.50,pep_an=g3p_gl*0.25;
  const accoa=pep_pyr*0.85,acc_fas=accoa*0.55,su_exp=g3p_su*0.72;
  const c4_pepc=c4?Vc*c4eff:0,c4_ppdk=c4_pepc;

  const net_fix=Math.max(0,Vc-0.5*pr);
  const atp_co2=net_fix>0.001?(Vc*3+pr*3.5+c4_atp+pyr_atp)/net_fix:0;
  const nadph_co2=net_fix>0.001?(Vc*2+pr)/net_fix:0;
  const qy=light>5?net_fix/(light/200):0;
  const vc_vo=Vo>0.0005?Vc/Vo:999;

  return {
    Vc,Vo,VoVc,Sco,J,Lf,co2_gate,c4eff,pyreff,bs_co2:CO2e,
    cbb_c,cbb_r,cbb_g,g3p_st,g3p_su,g3p_gl,
    fk,fa,fb,fm,pr,pr_nh3,
    mv_sc,mv_cm,
    mito_gly,mito_nadh,mito_co2,mito_nh3,mito_atp,mito_2og,mito_pyr,mito_cit,
    pep_shk,pep_pyr,pep_an,accoa,acc_fas,su_exp,
    c4_pepc,c4_ppdk,
    atpP,nadphP,nadhP,fdP,
    net_fix,atp_co2,nadph_co2,qy,vc_vo,
    atp_prod,nadph_prod,atp_demand,nadph_demand,
  };
}

// ── SVG primitives ────────────────────────────────────────────────────────
const NW=60,NH=20,SR=5.5,SW=582;

function Arr({x1,y1,x2,y2,flux,color,dashed,label,bend=0,base=0,ak,onA}){
  const f=Math.max(flux||0,base);
  if(f<0.0003&&!base) return null;
  const w=Math.max(0.5,Math.min(Math.sqrt(f)*8,7));
  const op=Math.max(0.18,Math.min(0.13+f*1.7,0.95));
  const spd=dashed?`${Math.max(0.25,2.3-f*3).toFixed(1)}s`:null;
  const mx=bend?(x1+x2)/2+bend*0.28:(x1+x2)/2;
  const my=bend?(y1+y2)/2+bend*0.28:(y1+y2)/2;
  const d=bend?`M${x1} ${y1} Q${(x1+x2)/2+bend} ${(y1+y2)/2+bend} ${x2} ${y2}`:`M${x1} ${y1} L${x2} ${y2}`;
  return(
    <g style={ak?{cursor:"pointer"}:{}} onClick={ak?e=>{e.stopPropagation();onA(ak,mx,my,f)}:null}>
      <path d={d} fill="none" stroke={color} strokeWidth={w} opacity={op}
        strokeDasharray={dashed?"7 4":"none"} strokeLinecap="round" markerEnd="url(#a)"
        style={dashed?{animation:`dk ${spd} linear infinite`}:{}}/>
      {ak&&<path d={d} fill="none" stroke="transparent" strokeWidth={14}/>}
      {label&&f>0.0006&&<text x={mx} y={my-5} fontSize={6.5} fill={color}
        opacity={Math.min(op*1.8,0.95)} textAnchor="middle" style={{pointerEvents:"none"}}>{label}</text>}
    </g>
  );
}
function LN({x,y,label,comp}){
  const s=(CS[comp]||CS.stroma).stroke;
  return(<g><rect x={x} y={y} width={NW} height={NH} rx={3.5} fill="#fff" stroke={s} strokeWidth={0.8}/><text x={x+NW/2} y={y+NH/2} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={500} fill="#222">{label}</text></g>);
}
function SN({x,y,color,nk,onN}){
  return(<g style={{cursor:"pointer"}} onClick={e=>{e.stopPropagation();onN(nk,x,y);}}><circle cx={x} cy={y} r={SR} fill="#fff" stroke={color} strokeWidth={0.9}/><circle cx={x} cy={y} r={2} fill={color} opacity={0.75}/></g>);
}
function TB({x,y,w=40,label,color}){
  return(<g><rect x={x} y={y} width={w} height={11} rx={2.5} fill={color+"18"} stroke={color} strokeWidth={0.6} strokeDasharray="3 2"/><text x={x+w/2} y={y+5.5} textAnchor="middle" dominantBaseline="central" fontSize={6} fill={color} fontWeight={500}>{label}</text></g>);
}
function CB({x,y,w,h,comp,label}){
  const cs=CS[comp]||CS.stroma;
  return(<g><rect x={x} y={y} width={w} height={h} rx={7} fill={cs.fill} stroke={cs.stroke} strokeWidth={0.85} opacity={0.93}/><text x={x+8} y={y+11} fontSize={7} fill={cs.stroke} fontWeight={600}>{label}</text></g>);
}
function Tip({info,x,y,W,onClose}){
  if(!info) return null;
  const tw=215,th=info.rxn?150:90;
  const tx=Math.min(x+10,W-tw-4),ty2=Math.max(y-th/2,4);
  return(
    <g onClick={e=>e.stopPropagation()}>
      <rect x={tx} y={ty2} width={tw} height={th} rx={6} fill="#1a1f27" stroke="#3a3f48" strokeWidth={0.7} opacity={0.97}/>
      <text x={tx+8} y={ty2+14} fontSize={9} fill="#fff" fontWeight={600}>{info.name}</text>
      {info.ec&&<text x={tx+8} y={ty2+25} fontSize={7} fill="#7ec9a6">EC {info.ec}</text>}
      {info.f&&<text x={tx+8} y={ty2+25} fontSize={7.5} fill="#aed6c4">{info.f}</text>}
      {info.rxn&&<text x={tx+8} y={ty2+36} fontSize={7} fill="#c8c8c8">{info.rxn}</text>}
      {info.r&&<foreignObject x={tx+6} y={ty2+29} width={tw-12} height={th-38}><div xmlns="http://www.w3.org/1999/xhtml" style={{fontSize:7.5,color:"#ccc",lineHeight:1.45}}>{info.r}</div></foreignObject>}
      {info.up&&<>
        <foreignObject x={tx+6} y={ty2+47} width={tw-12} height={44}><div xmlns="http://www.w3.org/1999/xhtml" style={{fontSize:7,color:"#6fdd92",lineHeight:1.4}}>▲ {info.up}</div></foreignObject>
        <foreignObject x={tx+6} y={ty2+93} width={tw-12} height={44}><div xmlns="http://www.w3.org/1999/xhtml" style={{fontSize:7,color:"#f48080",lineHeight:1.4}}>▼ {info.down}</div></foreignObject>
      </>}
      {info.flux!=null&&<text x={tx+8} y={ty2+th-6} fontSize={7} fill="#555">flux: {info.flux.toFixed(4)}</text>}
      <text x={tx+tw-10} y={ty2+14} fontSize={11} fill="#666" style={{cursor:"pointer"}} onClick={onClose}>×</text>
    </g>
  );
}

// ── Small UI components ───────────────────────────────────────────────────
function EBar({l,v,color}){const p=Math.max(0,Math.min(v,1));return(<div style={{marginBottom:3}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--color-text-secondary)",marginBottom:1}}><span style={{fontWeight:500,color}}>{l}</span><span>{(p*100).toFixed(0)}%</span></div><div style={{background:"var(--color-background-secondary)",borderRadius:3,height:5}}><div style={{width:`${p*100}%`,background:color,height:"100%",borderRadius:3,transition:"width 0.2s"}}/></div></div>);}
function MC({label,value,unit,color}){const v=typeof value==="number"?(value>200?"≫200":value.toFixed(2)):value;return(<div style={{background:"var(--color-background-secondary)",borderRadius:5,padding:"4px 5px",textAlign:"center"}}><div style={{fontSize:7.5,color:"var(--color-text-secondary)"}}>{label}</div><div style={{fontSize:12,fontWeight:500,color:color||"var(--color-text-primary)"}}>{v}</div><div style={{fontSize:7,color:"var(--color-text-tertiary)"}}>{unit}</div></div>);}
function Spark({data,fkey,label,color}){if(!data.length)return null;const vals=data.map(d=>d[fkey]||0);const mx=Math.max(...vals,0.001);const pts=vals.map((v,i)=>`${(i/Math.max(vals.length-1,1))*124},${13-(v/mx)*11}`).join(" ");return(<div style={{marginBottom:3}}><div style={{fontSize:9,color:"var(--color-text-secondary)"}}>{label}: <span style={{color,fontWeight:500}}>{vals[vals.length-1]?.toFixed(3)}</span></div><svg width={124} height={15}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.2}/></svg></div>);}
function Btn({active,onClick,label,color}){return(<button onClick={onClick} style={{padding:"3px 7px",borderRadius:5,fontSize:9.5,cursor:"pointer",fontWeight:active?500:400,background:active?color+"25":"transparent",border:`0.5px solid ${active?color:"var(--color-border-tertiary)"}`,color:active?color:"var(--color-text-secondary)",transition:"all 0.12s"}}>{label}</button>);}
function Sld({k,env,set,min,max,step=1,label,unit}){return(<div style={{marginBottom:4}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--color-text-secondary)",marginBottom:1}}><span>{label}</span><span style={{fontWeight:500,color:"var(--color-text-primary)"}}>{env[k]}{unit}</span></div><input type="range" min={min} max={max} step={step} value={env[k]} onChange={e=>set(k,+e.target.value)} style={{width:"100%"}}/></div>);}

// ── Record & Analyse ──────────────────────────────────────────────────────
function RecordPanel({recording,onToggle,records,onClear}){
  const [show,setShow]=useState(false);
  const isRecording=recording;
  const hasData=records.length>0;

  const miniChart=(vals,color)=>{
    if(!vals.length) return null;
    const mx=Math.max(...vals,0.001);
    const pts=vals.map((v,i)=>`${(i/Math.max(vals.length-1,1))*160},${20-(v/mx)*18}`).join(" ");
    return <svg width={160} height={22} style={{display:"block",background:"var(--color-background-secondary)",borderRadius:3}}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.3}/></svg>;
  };

  return(
    <div style={{borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
      <div style={{padding:"4px 14px",display:"flex",gap:6,alignItems:"center"}}>
        <button onClick={onToggle} style={{
          padding:"3px 12px",borderRadius:5,fontSize:10,cursor:"pointer",fontWeight:500,
          background:isRecording?"#E24B4A18":"#1D9E7518",
          border:`0.5px solid ${isRecording?"#E24B4A":"#1D9E75"}`,
          color:isRecording?"#E24B4A":"#1D9E75"
        }}>{isRecording?"■ Stop recording":"● Start recording"}</button>
        {isRecording&&<span style={{fontSize:9,color:"#E24B4A",fontWeight:500}}>Recording — {records.length} samples ({(records.length*0.5).toFixed(0)}s)</span>}
        {!isRecording&&hasData&&(
          <>
            <button onClick={()=>setShow(s=>!s)} style={{padding:"3px 10px",borderRadius:5,fontSize:9.5,cursor:"pointer",background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-primary)"}}>
              {show?"▲ Hide":"▼ Show"} analysis ({records.length} samples, {(records.length*0.5).toFixed(0)}s)
            </button>
            <button onClick={onClear} style={{padding:"3px 8px",borderRadius:5,fontSize:9,cursor:"pointer",background:"transparent",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-secondary)"}}>Clear</button>
          </>
        )}
        {!isRecording&&!hasData&&<span style={{fontSize:9,color:"var(--color-text-secondary)"}}>Record flux over time → stop → see cumulative analysis</span>}
      </div>

      {show&&hasData&&(()=>{
        const avg=k=>records.reduce((a,r)=>a+(r[k]||0),0)/records.length;
        const tot=k=>records.reduce((a,r)=>a+(r[k]||0),0)*0.5;
        const mn =k=>Math.min(...records.map(r=>r[k]||0));
        const mx =k=>Math.max(...records.map(r=>r[k]||0));
        const eff=(avg("net_fix")/(avg("Vc")||0.001)*100);
        const dur=(records.length*0.5).toFixed(0);
        return(
          <div style={{padding:"8px 14px 10px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div>
              <div style={{fontWeight:500,fontSize:11,marginBottom:6}}>Session summary — {dur}s</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:8}}>
                {[
                  ["Total C fixed",tot("net_fix").toFixed(3),"rel.units",K.cbb],
                  ["Total oxygenation",tot("Vo").toFixed(3),"rel.units",K.pr],
                  ["C lost (GDC CO₂)",tot("mito_co2").toFixed(3),"rel.units","#888"],
                  ["Avg carboxyl. eff.",eff.toFixed(1)+"%","net/gross",K.cbb],
                  ["Avg ATP/CO₂",avg("atp_co2").toFixed(2),"mol/mol",K.atp],
                  ["Avg quantum yield",avg("qy").toFixed(3),"CO₂/photon",K.cbb],
                  ["Max Vc",mx("Vc").toFixed(3),"rel.",K.cbb],
                  ["Min Vc",mn("Vc").toFixed(3),"rel.",K.pr],
                  ["Max Vo",mx("Vo").toFixed(3),"rel.",K.pr],
                  ["Bypass Kebeish",tot("fk").toFixed(3),"rel.",K.keb],
                  ["Bypass AP3",tot("fa").toFixed(3),"rel.",K.ap3],
                  ["Bypass BHAC",tot("fb").toFixed(3),"rel.",K.bhac],
                ].map(([l,v,u,c])=>(
                  <div key={l} style={{background:"var(--color-background-secondary)",borderRadius:4,padding:"4px 5px"}}>
                    <div style={{fontSize:7.5,color:"var(--color-text-secondary)"}}>{l}</div>
                    <div style={{fontSize:11,fontWeight:500,color:c||"var(--color-text-primary)"}}>{v}</div>
                    <div style={{fontSize:7,color:"var(--color-text-tertiary)"}}>{u}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:9,color:"var(--color-text-secondary)",lineHeight:1.7,padding:"6px 8px",background:"var(--color-background-secondary)",borderRadius:5}}>
                <strong style={{color:"var(--color-text-primary)"}}>Interpretation: </strong>
                Carboxylation efficiency {eff.toFixed(1)}% — {(100-eff).toFixed(1)}% of turnovers were oxygenations.
                {eff<70?" High photorespiration — try bypass or C4/pyrenoid.":eff>90?" Excellent — minimal photorespiration.":" Moderate PR — typical C3."}{" "}
                ATP cost {avg("atp_co2").toFixed(2)} mol/mol
                {avg("atp_co2")>4.5?" (elevated — PR expensive).":" (near theoretical ~3 for pure CBB)."}{" "}
                {tot("fk")>0.01||tot("fa")>0.01||tot("fb")>0.01?" Bypass routes active — reduced GDC load.":""}
              </div>
            </div>
            <div>
              <div style={{fontWeight:500,fontSize:11,marginBottom:6}}>Time-series</div>
              {[["Vc (carboxylation)",K.cbb,"Vc"],["Vo (oxygenation)",K.pr,"Vo"],
                ["Net C fixation",K.cbb,"net_fix"],["ATP pool",K.atp,"atpP"],["NADH pool (mito)",K.nadh,"nadhP"]
              ].map(([l,c,k])=>(
                <div key={k} style={{marginBottom:5}}>
                  <div style={{fontSize:8.5,color:"var(--color-text-secondary)",marginBottom:1}}>{l}</div>
                  {miniChart(records.map(r=>r[k]||0),c)}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App(){
  const [env,setEnv]=useState({co2:380,o2:21,temp:25,light:1000,pi:90,act:90});
  const [bp,setBp]=useState({kebeish:false,ap3:false,bhac:false,mcg:false});
  const [c4,setC4]=useState(false);
  const [pyrenoid,setPyrenoid]=useState(false);
  const [tip,setTip]=useState(null);
  const [showLit,setShowLit]=useState(false);
  const [showP,setShowP]=useState(false);
  const [hist,setHist]=useState([]);
  const [recording,setRecording]=useState(false);
  const [records,setRecords]=useState([]);
  const hRef=useRef([]);
  const recActive=useRef(false);
  const recData=useRef([]);
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState({x:0,y:0});
  const dragging=useRef(false);
  const dragStart=useRef(null);
  const containerRef=useRef(null);
  const svgRef=useRef(null);

  const se=(k,v)=>setEnv(e=>({...e,[k]:v}));
  const tb=k=>setBp(b=>({...b,[k]:!b[k]}));
  const f=kin(env,bp,c4,pyrenoid);
  const pb=f.Vo>0.001?0.02:0;

  useEffect(()=>{
    const id=setInterval(()=>{
      const fx=kin(env,bp,c4,pyrenoid);
      hRef.current=[...hRef.current.slice(-79),{...fx}];
      setHist([...hRef.current]);
      if(recActive.current){
        recData.current=[...recData.current,{...fx}];
        setRecords([...recData.current]);
      }
    },500);
    return()=>clearInterval(id);
  },[env,bp,c4,pyrenoid]);

  const toggleRec=()=>{
    if(!recording){recActive.current=true;recData.current=[];setRecords([]);setRecording(true);}
    else{recActive.current=false;setRecording(false);}
  };
  const clearRec=()=>{recActive.current=false;recData.current=[];setRecords([]);setRecording(false);};

  useEffect(()=>{
    const el=containerRef.current;if(!el)return;
    const h=e=>{e.preventDefault();setZoom(z=>Math.max(0.25,Math.min(4,z*(1-e.deltaY*0.001))));};
    el.addEventListener("wheel",h,{passive:false});return()=>el.removeEventListener("wheel",h);
  },[]);
  const onMD=e=>{if(e.button!==0)return;dragging.current=true;dragStart.current={mx:e.clientX,my:e.clientY,px:pan.x,py:pan.y};};
  const onMM=e=>{if(!dragging.current||!dragStart.current)return;setPan({x:dragStart.current.px+(e.clientX-dragStart.current.mx),y:dragStart.current.py+(e.clientY-dragStart.current.my)});};
  const onMU=()=>{dragging.current=false;};

  const dlSVG=()=>{const svg=svgRef.current;if(!svg)return;const c=svg.cloneNode(true);c.setAttribute("xmlns","http://www.w3.org/2000/svg");const s=document.createElementNS("http://www.w3.org/2000/svg","style");s.textContent="@keyframes dk{to{stroke-dashoffset:-24}}";c.insertBefore(s,c.firstChild);const b=new Blob([c.outerHTML],{type:"image/svg+xml"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="photosynthesis.svg";a.click();URL.revokeObjectURL(a.href);};
  const dlPNG=()=>{const svg=svgRef.current;if(!svg)return;const c=svg.cloneNode(true);c.setAttribute("xmlns","http://www.w3.org/2000/svg");const str=new XMLSerializer().serializeToString(c);const img=new Image();img.onload=()=>{const sc=2,cv=document.createElement("canvas");cv.width=SW*sc;cv.height=558*sc;const ctx=cv.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(img,0,0,cv.width,cv.height);const a=document.createElement("a");a.href=cv.toDataURL("image/png");a.download="photosynthesis.png";a.click();};img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(str);};

  const onA=useCallback((key,x,y,flux)=>{if(!key){setTip(null);return;}const m=AM[key];if(m)setTip({info:{...m,flux},x,y});},[]);
  const onN=useCallback((key,x,y)=>{const m=NI[key];if(m)setTip({info:m,x,y});},[]);

  // Node positions
  const nd={
    co2:[8,38],rubp:[84,38],pg3:[162,38],bpg:[240,38],g3p:[318,38],starch:[396,38],
    glycolate:[84,96],gsgo:[420,96],
    malAP:[162,164], malBH:[240,132], // AP3→malate, BHAC→malate
    hpp:[336,284],glycerate:[420,284],
    ser_m:[208,390],nh3_m:[296,390],nadh_m:[384,390],
    malMi:[114,424],nadhCI:[206,424],atpO:[296,424],x2og:[384,424],
    g3pc:[8,480],sucrose:[84,480],pep:[166,480],malC:[338,480],accoa:[8,516],
  };
  const lx=k=>nd[k][0],ly=k=>nd[k][1];
  const rx=k=>nd[k][0]+NW,cy=k=>nd[k][1]+NH/2;
  const tx=k=>nd[k][0]+NW/2,ty=k=>nd[k][1],by=k=>nd[k][1]+NH;

  // Small node positions
  const sn={
    pg2:[56,97],
    // Kebeish chain (all stroma, product=3-PGA): glyoxylate → tartronate-SA → glycerate
    glyoxK:[162,133],tartrK:[240,133],glycerK:[318,133],
    // AP3: glyoxylate (stroma)
    glyoxAP:[90,164],
    // BHAC: β-HA
    bha:[90,133],
    // MCG: glycolyl-CoA → malyl-CoA (stroma)
    glycolylCoA:[162,190],malylCoA:[240,190],malMCG:[318,190],
    // Perox
    glyoxP:[428,284],glynP:[512,272],
    // Mito
    glyM:[114,390],co2gdc:[472,390],pyrM:[114,458],citO:[472,424],
    // Cyto
    oaaC:[254,480],phloem:[170,516],aaS:[338,516],arom:[420,516],fasS:[90,516],
    // C4
    pepM:[510,38],oaaM:[510,76],malM:[510,112],pyrBS:[510,148],
  };

  return(
    <div style={{fontFamily:"var(--font-sans)",fontSize:12,paddingBottom:"1rem"}}>
      <style>{`@keyframes dk{to{stroke-dashoffset:-24}}`}</style>

      {/* Header */}
      <div style={{padding:"6px 14px 4px",borderBottom:"0.5px solid var(--color-border-tertiary)",display:"flex",alignItems:"center",gap:8}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:500,fontSize:13}}>Photosynthesis · Photorespiration · Organelle map</div>
          <div style={{fontSize:10,color:"var(--color-text-secondary)"}}>Click arrows → enzyme · click ● → metabolite · scroll to zoom · drag to pan</div>
        </div>
        <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
          <button onClick={()=>setZoom(z=>Math.min(z+0.25,4))} style={{padding:"2px 7px",borderRadius:5,fontSize:14,cursor:"pointer",background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-primary)"}}>＋</button>
          <button onClick={()=>{setZoom(1);setPan({x:0,y:0});}} style={{padding:"2px 5px",borderRadius:5,fontSize:9,cursor:"pointer",background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-secondary)",minWidth:32}}>{Math.round(zoom*100)}%</button>
          <button onClick={()=>setZoom(z=>Math.max(z-0.25,0.25))} style={{padding:"2px 7px",borderRadius:5,fontSize:14,cursor:"pointer",background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-primary)"}}>－</button>
          <button onClick={dlSVG} style={{padding:"2px 7px",borderRadius:5,fontSize:9,cursor:"pointer",background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-primary)"}}>⬇ SVG</button>
          <button onClick={dlPNG} style={{padding:"2px 7px",borderRadius:5,fontSize:9,cursor:"pointer",background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-primary)"}}>⬇ PNG</button>
        </div>
      </div>

      {/* Presets */}
      <div style={{padding:"4px 14px",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
        <div style={{fontSize:9,fontWeight:500,color:"var(--color-text-secondary)",marginBottom:2}}>Ecological conditions</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:3}}>
          {ECO.map(p=>(
            <button key={p.n} onClick={()=>setEnv({...p.e})} title={p.note}
              style={{padding:"2px 7px",borderRadius:5,fontSize:9,cursor:"pointer",background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-primary)"}}>
              {p.n}
            </button>
          ))}
          <button onClick={()=>setShowLit(x=>!x)}
            style={{padding:"2px 7px",borderRadius:5,fontSize:9,cursor:"pointer",background:"transparent",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-secondary)"}}>
            {showLit?"▲ Hide":"▼"} Literature studies
          </button>
        </div>
        {showLit&&(
          <div style={{display:"flex",gap:4,flexWrap:"wrap",paddingTop:3,borderTop:"0.5px solid var(--color-border-tertiary)"}}>
            {LIT.map(p=>(
              <button key={p.n} onClick={()=>setEnv({...p.e})} title={p.src}
                style={{padding:"2px 7px",borderRadius:5,fontSize:9,cursor:"pointer",background:"var(--color-background-secondary)",border:"0.5px solid "+K.keb,color:K.keb}}>
                {p.n}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Toggles */}
      <div style={{padding:"4px 14px",display:"flex",gap:5,flexWrap:"wrap",borderBottom:"0.5px solid var(--color-border-tertiary)",alignItems:"center"}}>
        <span style={{fontSize:9.5,color:"var(--color-text-secondary)"}}>Stroma bypass:</span>
        <Btn active={bp.kebeish} onClick={()=>tb("kebeish")} label="Kebeish (→3-PGA)" color={K.keb}/>
        <Btn active={bp.ap3}     onClick={()=>tb("ap3")}     label="AP3/Maier (→malate)" color={K.ap3}/>
        <Btn active={bp.bhac}    onClick={()=>tb("bhac")}    label="BHAC (→malate)" color={K.bhac}/>
        <Btn active={bp.mcg}     onClick={()=>tb("mcg")}     label="MCG malyl-CoA (→malate, fixes CO₂)" color={K.mcg}/>
        <span style={{fontSize:9.5,color:"var(--color-text-secondary)",marginLeft:4}}>CCM:</span>
        <Btn active={c4}       onClick={()=>{setC4(x=>!x);if(pyrenoid)setPyrenoid(false);}} label="C4 cycle" color={K.c4}/>
        <Btn active={pyrenoid} onClick={()=>{setPyrenoid(x=>!x);if(c4)setC4(false);}}       label="Pyrenoid" color={K.pyr}/>
        {pyrenoid&&<span style={{fontSize:8.5,color:K.pyr}}>RuBisCO CO₂: {f.bs_co2?.toFixed(0)} ppm</span>}
        <button onClick={()=>setShowP(x=>!x)} style={{marginLeft:"auto",padding:"3px 8px",borderRadius:5,fontSize:9,cursor:"pointer",background:"transparent",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-secondary)"}}>{showP?"Hide":"Show"} parameters</button>
      </div>

      {/* Record panel */}
      <RecordPanel recording={recording} onToggle={toggleRec} records={records} onClear={clearRec}/>

      <div style={{display:"grid",gridTemplateColumns:"136px 1fr 128px"}}>

        {/* Left */}
        <div style={{padding:"7px 8px",borderRight:"0.5px solid var(--color-border-tertiary)"}}>
          <div style={{fontWeight:500,fontSize:10,color:"var(--color-text-secondary)",marginBottom:4,letterSpacing:0.4}}>ENVIRONMENT</div>
          <Sld k="co2"  env={env} set={se} min={50}  max={2000} step={10}  label="CO₂"          unit=" ppm"/>
          <Sld k="o2"   env={env} set={se} min={2}   max={40}   step={0.5} label="O₂"           unit="%"/>
          <Sld k="temp" env={env} set={se} min={5}   max={45}   step={1}   label="Temp."        unit="°C"/>
          <Sld k="light"env={env} set={se} min={0}   max={1800} step={20}  label="PAR"          unit=""/>
          <Sld k="pi"   env={env} set={se} min={5}   max={100}  step={5}   label="Pi"           unit="%"/>
          <Sld k="act"  env={env} set={se} min={10}  max={100}  step={5}   label="RuBisCO act." unit="%"/>
          <div style={{fontWeight:500,fontSize:10,color:"var(--color-text-secondary)",margin:"5px 0 3px",letterSpacing:0.4}}>ENERGY</div>
          <EBar l="ATP"    v={f.atpP}   color={K.atp}/>
          <EBar l="NADPH"  v={f.nadphP} color={K.nadph}/>
          <EBar l="NADH"   v={f.nadhP}  color={K.nadh}/>
          <EBar l="Fd(red)"v={f.fdP}    color={K.fd}/>
          <div style={{marginTop:4,display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
            <MC label="Vc/Vo"   value={f.vc_vo}   unit="ratio"   color={f.vc_vo<5?K.pr:K.cbb}/>
            <MC label="Net fix."value={f.net_fix}  unit="rel."    color={K.cbb}/>
            <MC label="ATP/CO₂" value={f.atp_co2}  unit="mol/mol" color={K.atp}/>
            <MC label="QY"      value={f.qy}       unit="CO₂/q"   color={K.cbb}/>
          </div>
          <div style={{marginTop:4,padding:"4px 6px",background:"var(--color-background-secondary)",borderRadius:5,fontSize:9,lineHeight:1.65}}>
            <div>Vo=<span style={{color:K.pr,fontWeight:500}}>{(f.VoVc*100).toFixed(1)}%</span> Vc</div>
            <div>CO₂ gate: <span style={{color:K.cbb,fontWeight:500}}>{(f.co2_gate*100).toFixed(0)}%</span></div>
            <div>MV→cyt: <span style={{color:K.tca,fontWeight:500}}>{f.mv_sc.toFixed(3)}</span></div>
            {(c4||pyrenoid)&&<div>CCM CO₂: <span style={{color:c4?K.c4:K.pyr,fontWeight:500}}>{f.bs_co2?.toFixed(0)}</span> ppm</div>}
          </div>
          <div style={{marginTop:4,borderTop:"0.5px solid var(--color-border-tertiary)",paddingTop:4}}>
            {[["stroma","Stroma"],["perox","Peroxisome"],["mito","Mitochondria"],["cyto","Cytosol"]].map(([k,l])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:4,fontSize:9,color:"var(--color-text-secondary)",marginBottom:2}}>
                <div style={{width:8,height:8,border:`1.5px solid ${CS[k].stroke}`,borderRadius:2,background:CS[k].fill,flexShrink:0}}/>
                {l}
              </div>
            ))}
            <div style={{height:3}}/>
            {[[K.cbb,"CBB"],[K.pr,"PR"],[K.keb,"Kebeish→3-PGA"],[K.ap3,"AP3→malate"],[K.bhac,"BHAC→malate"],[K.mcg,"MCG→malate(+CO₂)"],[K.c4,"C4"],[K.pyr,"Pyrenoid"],[K.tca,"Mal.valve"],[K.suc,"Sucrose"],[K.gly,"Glycolysis"],[K.nh3,"NH₃/GS-GOGAT"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:9,color:"var(--color-text-secondary)",marginBottom:1}}>
                <div style={{width:11,height:2.5,background:c,borderRadius:2,flexShrink:0}}/>
                {l}
              </div>
            ))}
            <div style={{marginTop:3,fontSize:8.5,color:"var(--color-text-secondary)"}}>● = secondary metabolite<br/>Click arrows for enzyme info</div>
          </div>
        </div>

        {/* SVG map */}
        <div ref={containerRef} style={{overflow:"hidden",cursor:"grab",userSelect:"none",position:"relative",minHeight:380}}
          onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}>
          <div style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,transformOrigin:"top left",transition:"transform 0.05s"}}>
            <svg ref={svgRef} width={SW} viewBox={`0 0 ${SW} 558`} style={{display:"block"}}
              onClick={()=>setTip(null)}>
              <defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth={1.5} strokeLinecap="round"/></marker></defs>

              {/* Compartments */}
              <CB x={2}   y={16}  w={578} h={234} comp="stroma" label="Chloroplast stroma"/>
              <CB x={414} y={254} w={164} h={102} comp="perox"  label="Peroxisome"/>
              <CB x={100} y={362} w={476} h={104} comp="mito"   label="Mitochondria — GDC · malate valve · oxidative phosphorylation"/>
              <CB x={2}   y={470} w={578} h={82}  comp="cyto"   label="Cytosol"/>
              {c4&&<CB x={494} y={20} w={80} h={206} comp="bs" label="C4"/>}
              {pyrenoid&&<CB x={434} y={22} w={96} h={48} comp="pyr_c" label="Pyrenoid (CCM)"/>}

              <TB x={416} y={249} w={42} label="GlyT ⇌"      color={K.pr}/>
              <TB x={320} y={465} w={40} label="TPT ⇌"       color={K.transp}/>
              <TB x={166} y={465} w={52} label="DiT1/DiT2 ⇌" color={K.tca}/>
              <TB x={106} y={357} w={38} label="DTC ⇌"       color={K.tca}/>
              <TB x={150} y={465} w={34} label="MPC →"       color={K.gly}/>

              {/* CBB */}
              <Arr x1={rx("co2")}  y1={cy("co2")}  x2={lx("rubp")} y2={cy("rubp")} flux={f.Vc}    color={K.cbb} dashed/>
              <Arr x1={rx("rubp")} y1={cy("rubp")} x2={lx("pg3")}  y2={cy("pg3")}  flux={f.cbb_c} color={K.cbb} dashed label="RuBisCO"       ak="rubisco_c" onA={onA}/>
              <Arr x1={rx("pg3")}  y1={cy("pg3")}  x2={lx("bpg")}  y2={cy("bpg")}  flux={f.cbb_r} color={K.cbb} dashed label="PGK 3ATP"      ak="pgk"       onA={onA}/>
              <Arr x1={rx("bpg")}  y1={cy("bpg")}  x2={lx("g3p")}  y2={cy("g3p")}  flux={f.cbb_r} color={K.cbb} dashed label="GAPDH 2NADPH"  ak="pgk"       onA={onA}/>
              <Arr x1={tx("g3p")}  y1={ty("g3p")}  x2={tx("rubp")} y2={ty("rubp")} flux={f.cbb_g} color={K.cbb} dashed label="regen 3ATP"    ak="regen"     onA={onA} bend={-15}/>
              <Arr x1={rx("g3p")}  y1={cy("g3p")}  x2={lx("starch")}y2={cy("starch")}flux={f.g3p_st}color={K.tca}dashed label="AGPase"        ak="starch_s" onA={onA}/>
              <Arr x1={tx("g3p")}  y1={by("g3p")+12}x2={tx("g3pc")}y2={ty("g3pc")} flux={f.g3p_su+f.g3p_gl}color={K.transp}dashed label="TPT" ak="tpt" onA={onA}/>

              {/* Oxygenation */}
              <Arr x1={tx("rubp")} y1={by("rubp")} x2={sn.pg2[0]}    y2={sn.pg2[1]-SR}   flux={f.Vo} color={K.pr} dashed label="O₂ase" base={pb} ak="rubisco_o" onA={onA}/>
              <Arr x1={sn.pg2[0]+SR} y1={sn.pg2[1]} x2={lx("glycolate")} y2={cy("glycolate")} flux={f.Vo} color={K.pr} dashed base={pb}/>

              {/* KEBEISH: GcL→GlxR→TSR→GLYK → 3-PGA (no malate!) */}
              {bp.kebeish&&<>
                <Arr x1={tx("glycolate")} y1={by("glycolate")} x2={sn.glyoxK[0]} y2={sn.glyoxK[1]-SR}   flux={f.fk} color={K.keb} dashed label="GcL stroma"     ak="keb" onA={onA}/>
                <Arr x1={sn.glyoxK[0]+SR} y1={sn.glyoxK[1]} x2={sn.tartrK[0]-SR} y2={sn.tartrK[1]}     flux={f.fk} color={K.keb} dashed label="GlxR (+CO₂)"    ak="keb" onA={onA}/>
                <Arr x1={sn.tartrK[0]+SR} y1={sn.tartrK[1]} x2={sn.glycerK[0]-SR} y2={sn.glycerK[1]}   flux={f.fk} color={K.keb} dashed label="TSR NADPH"      ak="keb" onA={onA}/>
                <Arr x1={sn.glycerK[0]+SR} y1={sn.glycerK[1]} x2={rx("pg3")} y2={cy("pg3")}             flux={f.fk} color={K.keb} dashed label="GLYK→3-PGA"     ak="keb" onA={onA}/>
              </>}

              {/* AP3/Maier: GOX+MS → malate */}
              {bp.ap3&&<>
                <Arr x1={tx("glycolate")} y1={by("glycolate")} x2={sn.glyoxAP[0]} y2={sn.glyoxAP[1]-SR} flux={f.fa} color={K.ap3} dashed label="GOX stroma"    ak="ap3r" onA={onA} bend={-4}/>
                <Arr x1={sn.glyoxAP[0]+SR} y1={sn.glyoxAP[1]} x2={lx("malAP")} y2={cy("malAP")}         flux={f.fa} color={K.ap3} dashed label="MS+AcCoA→malate" ak="ap3r" onA={onA}/>
                <Arr x1={tx("malAP")} y1={ty("malAP")} x2={tx("pg3")} y2={by("pg3")}                     flux={f.fa*0.3} color={K.ap3} dashed label="→CBB"       ak="ap3r" onA={onA} bend={5}/>
              </>}

              {/* BHAC: BHAA synth+lyase+MDH → malate */}
              {bp.bhac&&<>
                <Arr x1={tx("glycolate")} y1={ty("glycolate")} x2={sn.bha[0]} y2={sn.bha[1]+SR}          flux={f.fb} color={K.bhac} dashed label="BHAA synth."  ak="bhacr" onA={onA} bend={-7}/>
                <Arr x1={sn.bha[0]+SR} y1={sn.bha[1]} x2={lx("malBH")} y2={cy("malBH")}                  flux={f.fb} color={K.bhac} dashed label="lyase+MDH→malate" ak="bhacr" onA={onA}/>
                <Arr x1={tx("malBH")} y1={ty("malBH")} x2={tx("g3p")} y2={by("g3p")}                     flux={f.fb*0.4} color={K.bhac} dashed label="→CBB"      ak="bhacr" onA={onA} bend={4}/>
              </>}

              {/* MCG malyl-CoA-glycerate: CoA ligase → propionyl-CoA carboxylase (+CO₂) → malyl-CoA lyase → malate */}
              {bp.mcg&&<>
                <Arr x1={tx("glycolate")} y1={by("glycolate")} x2={sn.glycolylCoA[0]} y2={sn.glycolylCoA[1]-SR} flux={f.fm} color={K.mcg} dashed label="CoA ligase"          ak="mcgr" onA={onA} bend={-5}/>
                <Arr x1={sn.glycolylCoA[0]+SR} y1={sn.glycolylCoA[1]} x2={sn.malylCoA[0]-SR} y2={sn.malylCoA[1]} flux={f.fm} color={K.mcg} dashed label="+CO₂ carboxylase"  ak="mcgr" onA={onA}/>
                <Arr x1={sn.malylCoA[0]+SR} y1={sn.malylCoA[1]} x2={sn.malMCG[0]-SR} y2={sn.malMCG[1]}           flux={f.fm} color={K.mcg} dashed label="malyl-CoA lyase"   ak="mcgr" onA={onA}/>
                <Arr x1={sn.malMCG[0]+SR} y1={sn.malMCG[1]} x2={tx("pg3")} y2={by("pg3")}                        flux={f.fm*0.8} color={K.mcg} dashed label="malate→CBB"    ak="mcgr" onA={onA}/>
                {/* CO2 fixed arrow (unique feature) */}
                <Arr x1={tx("co2")} y1={by("co2")} x2={sn.malylCoA[0]} y2={sn.malylCoA[1]-SR} flux={f.fm*0.5} color={K.mcg} dashed label="CO₂ fixed!" bend={5}/>
              </>}

              {/* Classical PR */}
              <Arr x1={rx("glycolate")} y1={cy("glycolate")} x2={sn.glyoxP[0]-SR} y2={sn.glyoxP[1]}         flux={f.pr} color={K.pr} dashed label="GOX perox" base={pb} ak="gox_p" onA={onA}/>
              <Arr x1={sn.glyoxP[0]} y1={sn.glyoxP[1]+SR} x2={lx("hpp")} y2={cy("hpp")}                     flux={f.pr} color={K.pr} dashed label="GGAT"     base={pb} ak="ggat"  onA={onA}/>
              <Arr x1={sn.glynP[0]-SR} y1={sn.glynP[1]} x2={rx("hpp")} y2={cy("hpp")}                       flux={f.pr} color={K.pr} dashed label="SGAT"     base={pb} ak="ggat"  onA={onA}/>
              <Arr x1={rx("hpp")} y1={cy("hpp")} x2={lx("glycerate")} y2={cy("glycerate")}                   flux={f.pr} color={K.pr} dashed label="HPR"      base={pb} ak="hpr"   onA={onA}/>
              <Arr x1={tx("glycerate")} y1={ty("glycerate")-12} x2={tx("g3p")} y2={by("g3p")}               flux={f.pr} color={K.pr} dashed label="→3-PGA"   base={pb} ak="hpr"   onA={onA} bend={-12}/>
              <Arr x1={sn.glynP[0]} y1={sn.glynP[1]+SR} x2={sn.glyM[0]} y2={sn.glyM[1]-SR}                 flux={f.mito_gly} color={K.pr} dashed label="Gly→mito" base={pb} ak="gdc" onA={onA}/>
              <Arr x1={sn.glyM[0]+SR} y1={sn.glyM[1]} x2={lx("ser_m")} y2={cy("ser_m")}                    flux={f.mito_gly} color={K.pr} dashed label="GDC/SHMT" base={pb} ak="gdc" onA={onA}/>
              <Arr x1={rx("ser_m")} y1={cy("ser_m")} x2={lx("nh3_m")} y2={cy("nh3_m")}                      flux={f.mito_gly} color={K.pr} dashed base={pb}/>
              <Arr x1={rx("nh3_m")} y1={cy("nh3_m")} x2={lx("nadh_m")} y2={cy("nadh_m")}                   flux={f.mito_nadh*0.14} color={K.nadh} dashed label="NADH→CI"/>
              <Arr x1={tx("nh3_m")} y1={ty("nh3_m")} x2={tx("gsgo")} y2={by("gsgo")}                        flux={f.mito_nh3} color={K.nh3} dashed label="NH₃→GS/GOGAT" ak="gsgo" onA={onA}/>
              <Arr x1={tx("ser_m")} y1={ty("ser_m")} x2={sn.glynP[0]} y2={sn.glynP[1]+SR}                  flux={f.mito_gly} color={K.pr} dashed label="Ser→perox" base={pb}/>
              <Arr x1={lx("nadh_m")+NW} y1={cy("nadh_m")} x2={sn.co2gdc[0]-SR} y2={sn.co2gdc[1]}          flux={f.mito_co2} color="#aaa" dashed label="CO₂ rel."/>

              {/* Malate valve */}
              <Arr x1={tx("starch")} y1={by("starch")+5} x2={tx("malC")} y2={ty("malC")}  flux={f.mv_sc} color={K.tca} dashed label="MDH→DiT1/2" ak="mv_sc" onA={onA} bend={14}/>
              <Arr x1={tx("malC")} y1={by("malC")} x2={lx("malMi")} y2={cy("malMi")}      flux={f.mv_cm} color={K.tca} dashed label="DTC→mito"  ak="mv_cm" onA={onA} bend={-8}/>
              <Arr x1={rx("malMi")} y1={cy("malMi")} x2={lx("nadhCI")} y2={cy("nadhCI")} flux={f.mv_cm} color={K.nadh} dashed label="→NADH CI"  ak="mv_cm" onA={onA}/>
              <Arr x1={rx("nadhCI")} y1={cy("nadhCI")} x2={lx("atpO")} y2={cy("atpO")}   flux={f.mito_atp} color={K.atp} dashed label="oxphos ATP"/>
              <Arr x1={rx("atpO")} y1={cy("atpO")} x2={lx("x2og")} y2={cy("x2og")}       flux={f.mito_2og} color={K.tca} dashed label="2-OG→GS/GOGAT" ak="gsgo" onA={onA}/>
              <Arr x1={tx("pep")} y1={by("pep")} x2={sn.pyrM[0]} y2={sn.pyrM[1]+SR}      flux={f.mito_pyr} color={K.gly} dashed label="Pyr MPC" bend={-6}/>
              <Arr x1={sn.citO[0]-SR} y1={sn.citO[1]} x2={tx("malC")} y2={ty("malC")}    flux={f.mito_cit} color={K.tca} dashed label="cit→cyt"/>

              {/* Cytosol */}
              <Arr x1={rx("g3pc")} y1={cy("g3pc")} x2={lx("sucrose")} y2={cy("sucrose")} flux={f.g3p_su} color={K.suc} dashed label="SPS"         ak="sps"    onA={onA}/>
              <Arr x1={rx("sucrose")} y1={cy("sucrose")} x2={lx("pep")} y2={cy("pep")}   flux={f.g3p_gl} color={K.gly} dashed label="glycolysis"  ak="glycol" onA={onA}/>
              <Arr x1={rx("pep")} y1={cy("pep")} x2={sn.oaaC[0]-SR} y2={sn.oaaC[1]}     flux={f.pep_an} color={K.tca} dashed label="PEPC"/>
              <Arr x1={sn.oaaC[0]+SR} y1={sn.oaaC[1]} x2={lx("malC")} y2={cy("malC")}  flux={f.pep_an*0.8} color={K.tca} dashed label="MDH"/>
              <Arr x1={tx("pep")} y1={by("pep")} x2={lx("accoa")} y2={cy("accoa")}       flux={f.pep_pyr} color={K.gly} dashed label="PK→AcCoA"   ak="glycol" onA={onA} bend={6}/>
              <Arr x1={tx("sucrose")} y1={by("sucrose")} x2={sn.phloem[0]} y2={sn.phloem[1]-SR} flux={f.su_exp} color={K.suc} dashed label="phloem"/>
              <Arr x1={tx("pep")} y1={by("pep")} x2={sn.aaS[0]-SR} y2={sn.aaS[1]}       flux={f.pep_shk} color={K.gly} dashed label="shik.→AA"/>
              <Arr x1={tx("pep")} y1={by("pep")} x2={sn.arom[0]-SR} y2={sn.arom[1]}     flux={f.pep_shk*0.4} color={K.gly} dashed bend={6}/>
              <Arr x1={tx("accoa")} y1={ty("accoa")} x2={sn.fasS[0]} y2={sn.fasS[1]+SR} flux={f.acc_fas} color={K.tca} dashed label="FAS"/>

              {/* C4 */}
              {c4&&<>
                <Arr x1={sn.pepM[0]} y1={sn.pepM[1]+SR} x2={sn.oaaM[0]} y2={sn.oaaM[1]-SR} flux={f.c4_pepc} color={K.c4} dashed label="PEPC"      ak="pepc"   onA={onA}/>
                <Arr x1={sn.oaaM[0]} y1={sn.oaaM[1]+SR} x2={sn.malM[0]} y2={sn.malM[1]-SR} flux={f.c4_pepc} color={K.c4} dashed label="MDH"/>
                <Arr x1={sn.malM[0]-SR} y1={sn.malM[1]} x2={tx("rubp")} y2={ty("rubp")}    flux={f.c4_pepc*0.9} color={K.c4} dashed label="BS CO₂→CBB" ak="nadpme" onA={onA} bend={-8}/>
                <Arr x1={sn.malM[0]} y1={sn.malM[1]+SR} x2={sn.pyrBS[0]} y2={sn.pyrBS[1]-SR} flux={f.c4_ppdk} color={K.c4} dashed label="NADP-ME"   ak="nadpme" onA={onA}/>
                <Arr x1={sn.pyrBS[0]-SR} y1={sn.pyrBS[1]} x2={sn.pepM[0]-SR} y2={sn.pepM[1]} flux={f.c4_ppdk} color={K.c4} dashed label="PPDK 2ATP" ak="ppdk"   onA={onA} bend={18}/>
              </>}
              {pyrenoid&&<>
                <Arr x1={530} y1={46} x2={tx("co2")+8} y2={by("co2")} flux={f.pyreff*f.Vc} color={K.pyr} dashed label="HCO₃⁻ pump→CO₂" bend={-5}/>
              </>}

              {/* Large nodes */}
              <LN x={lx("co2")}    y={ly("co2")}    label="CO₂"        comp="stroma"/>
              <LN x={lx("rubp")}   y={ly("rubp")}   label="RuBP"       comp="stroma"/>
              <LN x={lx("pg3")}    y={ly("pg3")}    label="3-PGA"      comp="stroma"/>
              <LN x={lx("bpg")}    y={ly("bpg")}    label="1,3-BPG"    comp="stroma"/>
              <LN x={lx("g3p")}    y={ly("g3p")}    label="G3P"        comp="stroma"/>
              <LN x={lx("starch")} y={ly("starch")} label="Starch"     comp="stroma"/>
              <LN x={lx("glycolate")} y={ly("glycolate")} label="Glycolate" comp="stroma"/>
              <LN x={lx("gsgo")}   y={ly("gsgo")}   label="GS/GOGAT"   comp="stroma"/>
              {bp.ap3 &&<LN x={lx("malAP")} y={ly("malAP")} label="Malate(AP3)"  comp="stroma"/>}
              {bp.bhac&&<LN x={lx("malBH")} y={ly("malBH")} label="Malate(BHAC)" comp="stroma"/>}
              <LN x={lx("hpp")}       y={ly("hpp")}       label="HPP"       comp="perox"/>
              <LN x={lx("glycerate")} y={ly("glycerate")} label="Glycerate" comp="perox"/>
              <LN x={lx("ser_m")}  y={ly("ser_m")}  label="Serine(out)" comp="mito"/>
              <LN x={lx("nh3_m")}  y={ly("nh3_m")}  label="NH₃(out)"   comp="mito"/>
              <LN x={lx("nadh_m")} y={ly("nadh_m")} label="NADH(GDC)"  comp="mito"/>
              <LN x={lx("malMi")}  y={ly("malMi")}  label="Malate(in)" comp="mito"/>
              <LN x={lx("nadhCI")} y={ly("nadhCI")} label="NADH→CI"    comp="mito"/>
              <LN x={lx("atpO")}   y={ly("atpO")}   label="ATP(out)"   comp="mito"/>
              <LN x={lx("x2og")}   y={ly("x2og")}   label="2-OG(out)"  comp="mito"/>
              <LN x={lx("g3pc")}   y={ly("g3pc")}   label="G3P(cyt)"   comp="cyto"/>
              <LN x={lx("sucrose")}y={ly("sucrose")} label="Sucrose"    comp="cyto"/>
              <LN x={lx("pep")}    y={ly("pep")}    label="PEP"        comp="cyto"/>
              <LN x={lx("malC")}   y={ly("malC")}   label="Malate(cyt)"comp="cyto"/>
              <LN x={lx("accoa")}  y={ly("accoa")}  label="Ac-CoA"     comp="cyto"/>

              {/* Small nodes */}
              <SN x={sn.pg2[0]}    y={sn.pg2[1]}    color={K.pr}   nk="pg2"       onN={onN}/>
              <SN x={sn.glyoxP[0]} y={sn.glyoxP[1]} color={K.pr}   nk="glyox_p"   onN={onN}/>
              <SN x={sn.glynP[0]}  y={sn.glynP[1]}  color={K.pr}   nk="glycine_p" onN={onN}/>
              <SN x={sn.glyM[0]}   y={sn.glyM[1]}   color={K.pr}   nk="gly_m"     onN={onN}/>
              <SN x={sn.co2gdc[0]} y={sn.co2gdc[1]} color="#aaa"   nk="co2_gdc"   onN={onN}/>
              <SN x={sn.pyrM[0]}   y={sn.pyrM[1]}   color={K.gly}  nk="pyr_m"     onN={onN}/>
              <SN x={sn.citO[0]}   y={sn.citO[1]}   color={K.tca}  nk="cit_out"   onN={onN}/>
              <SN x={sn.oaaC[0]}   y={sn.oaaC[1]}   color={K.tca}  nk="oaa_cyt"   onN={onN}/>
              <SN x={sn.phloem[0]} y={sn.phloem[1]} color={K.suc}  nk="phloem"    onN={onN}/>
              <SN x={sn.aaS[0]}    y={sn.aaS[1]}    color={K.gly}  nk="aa_s"      onN={onN}/>
              <SN x={sn.arom[0]}   y={sn.arom[1]}   color={K.gly}  nk="arom"      onN={onN}/>
              <SN x={sn.fasS[0]}   y={sn.fasS[1]}   color={K.tca}  nk="fas_s"     onN={onN}/>
              {bp.kebeish&&<>
                <SN x={sn.glyoxK[0]}  y={sn.glyoxK[1]}  color={K.keb} nk="tartr_k"  onN={onN}/>
                <SN x={sn.tartrK[0]}  y={sn.tartrK[1]}  color={K.keb} nk="tartr_k"  onN={onN}/>
                <SN x={sn.glycerK[0]} y={sn.glycerK[1]} color={K.keb} nk="glycer_k" onN={onN}/>
              </>}
              {bp.ap3 &&<SN x={sn.glyoxAP[0]} y={sn.glyoxAP[1]} color={K.ap3}  nk="glyox_ap" onN={onN}/>}
              {bp.bhac&&<SN x={sn.bha[0]}      y={sn.bha[1]}      color={K.bhac} nk="bha"      onN={onN}/>}
              {bp.mcg&&<>
                <SN x={sn.glycolylCoA[0]} y={sn.glycolylCoA[1]} color={K.mcg} nk="glycolyl" onN={onN}/>
                <SN x={sn.malylCoA[0]}    y={sn.malylCoA[1]}    color={K.mcg} nk="malylcoa" onN={onN}/>
                <SN x={sn.malMCG[0]}      y={sn.malMCG[1]}      color={K.mcg} nk="glyox_ap" onN={onN}/>
              </>}
              {c4&&<>
                <SN x={sn.pepM[0]}  y={sn.pepM[1]}  color={K.c4} nk="pep_m"  onN={onN}/>
                <SN x={sn.oaaM[0]}  y={sn.oaaM[1]}  color={K.c4} nk="oaa_m"  onN={onN}/>
                <SN x={sn.malM[0]}  y={sn.malM[1]}  color={K.c4} nk="mal_m"  onN={onN}/>
                <SN x={sn.pyrBS[0]} y={sn.pyrBS[1]} color={K.c4} nk="pyr_bs" onN={onN}/>
              </>}

              {tip&&<Tip info={tip.info} x={tip.x} y={tip.y} W={SW} onClose={()=>setTip(null)}/>}
            </svg>
          </div>
        </div>

        {/* Right */}
        <div style={{padding:"7px 8px",borderLeft:"0.5px solid var(--color-border-tertiary)"}}>
          <div style={{fontWeight:500,fontSize:10,color:"var(--color-text-secondary)",marginBottom:4,letterSpacing:0.4}}>FLUX HISTORY</div>
          <Spark data={hist} fkey="Vc"        label="Vc"         color={K.cbb}/>
          <Spark data={hist} fkey="Vo"        label="Vo/PR"      color={K.pr}/>
          <Spark data={hist} fkey="net_fix"   label="Net C fix." color={K.cbb}/>
          <Spark data={hist} fkey="mv_sc"     label="MV str→cyt"color={K.tca}/>
          <Spark data={hist} fkey="mito_nadh" label="NADH(GDC)" color={K.nadh}/>
          <Spark data={hist} fkey="mito_atp"  label="ATP(mito)"  color={K.atp}/>
          <Spark data={hist} fkey="g3p_st"    label="→ Starch"   color={K.tca}/>
          <Spark data={hist} fkey="g3p_su"    label="→ Sucrose"  color={K.suc}/>
          <Spark data={hist} fkey="fk"        label="Kebeish"   color={K.keb}/>
          <Spark data={hist} fkey="fa"        label="AP3"       color={K.ap3}/>
          <Spark data={hist} fkey="fb"        label="BHAC"      color={K.bhac}/>
          <Spark data={hist} fkey="fm"        label="MCG"       color={K.mcg}/>
          <Spark data={hist} fkey="c4_pepc"   label="C4 PEPC"  color={K.c4}/>
        </div>
      </div>

      {showP&&(
        <div style={{padding:"10px 14px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:8}}>
            {[["Vc",f.Vc],["Vo",f.Vo],["Vc/Vo",f.vc_vo>200?">200":f.vc_vo],["Sco",f.Sco?.toFixed(0)],
              ["J(NRH)",f.J],["Lf",f.Lf],["CO₂ gate",f.co2_gate],["ATP prod",f.atp_prod],
              ["NADPH prod",f.nadph_prod],["ATP demand",f.atp_demand],["CBB carbox",f.cbb_c],["CBB reduct",f.cbb_r],
              ["Classical PR",f.pr],["Kebeish",f.fk],["AP3",f.fa],["BHAC",f.fb],
              ["MCG",f.fm],["G3P starch",f.g3p_st],["G3P sucrose",f.g3p_su],["MV→cyt",f.mv_sc],
              ["Mito NADH",f.mito_nadh],["Mito ATP",f.mito_atp],["Net fix.",f.net_fix],["QY",f.qy],
            ].map(([l,v])=>(
              <div key={l} style={{background:"var(--color-background-secondary)",borderRadius:4,padding:"4px 5px"}}>
                <div style={{fontSize:8,color:"var(--color-text-secondary)"}}>{l}</div>
                <div style={{fontWeight:500,fontSize:10}}>{typeof v==="number"?v.toFixed(4):v??"-"}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:9.5,color:"var(--color-text-secondary)",padding:"8px 10px",background:"var(--color-background-secondary)",borderRadius:5,lineHeight:1.9}}>
            <strong style={{color:"var(--color-text-primary)"}}>Bypass routes (corrected):</strong>{" "}
            Kebeish (2007): E.coli glycolate catabolism — GcL→glyoxylate→GlxR(carboligase,CO₂ rel.)→tartr-SA→TSR(NADPH)→glycerate→GLYK→3-PGA. Product = 3-PGA. No malate. ·
            AP3/Maier (2012): GOX(stroma)+malate synthase — glycolate→glyoxylate+AcCoA→malate. Product = malate. ·
            BHAC (Gündel 2024): BHAA synthase+lyase+MDH — glyoxylate+Asp→β-HA→OAA+NH₃→malate. Product = malate. ·
            MCG malyl-CoA-glycerate (Trudeau/Bar-Even group): CoA ligase+propionyl-CoA carboxylase(fixes CO₂!)+malyl-CoA lyase→malate. Unique: CO₂ fixed rather than released. ·
            Flux magnitudes are qualitative (correct direction, illustrative scale). See Farquhar 1980 for Vc/Vo; Bernacchi 2001 for Sco(T).
          </div>
        </div>
      )}
    </div>
  );
}
