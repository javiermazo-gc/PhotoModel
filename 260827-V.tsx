import { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ─── Kinetic model — model_full.js June 2026 corrected ──────────────────────
// Corrections vs previous: glycerate_bypass=bypass_flux/2, NADH_net=-bypass_flux*0.5,
// gly_pool fallback 0.020, Tp25 defaults to Vcmax25/12, bypassSouth+bypassMcG added.
// Architecture: kin() FROZEN. runModel() single entry point. Flat objects only.
const R   = 8.314;
const T25 = 298.15;
const _arr    = (Ha, Tk) => Math.exp(Ha / R * (1/T25 - 1/Tk));
const _peaked = (Ha, Hd, dS, Tk) =>
  _arr(Ha, Tk) *
  (1 + Math.exp((dS*T25 - Hd) / (R*T25))) /
  (1 + Math.exp((dS*Tk  - Hd) / (R*Tk)));
const _clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// MODULE 1: kin() — FROZEN [Bernacchi 2001/2002; Farquhar 1980]
function kin(env, params = {}) {
  const Tk = env.temp + 273.15;
  const Kc25=params.Kc25??272.4; const Ko25=params.Ko25??165.8;
  const GS25=params.GS25??42.75; const Srel25=params.Srel25??2590;
  const Kc=Kc25*_arr(79430,Tk); const Ko=Ko25*_arr(36380,Tk);
  const GS=GS25*_arr(37830,Tk); const Srel=Srel25*_arr(-28990,Tk);
  const Vcmax25=params.Vcmax25??120;
  const Vcmax=Vcmax25*_arr(65330,Tk)*_clamp(env.act??100,0,100)/100*_clamp(env.pi??100,0,100)/100;
  const Vomax=Vcmax*(Ko*1000/Kc)/Srel;
  const Jmax25=(params.Jmax_Vcmax_ratio??1.67)*Vcmax25;
  const JmaxT=Jmax25*_peaked(43900,200000,640,Tk);
  const alpha=params.alpha??0.30; const theta=params.theta??0.70;
  const I=Math.max(0,env.light); const aI=alpha*I;
  const J=(aI+JmaxT-Math.sqrt(Math.max(0,Math.pow(aI+JmaxT,2)-4*theta*aI*JmaxT)))/(2*theta);
  const Rd=((params.Rd_fraction??0.015)*Vcmax25)*_arr(46390,Tk);
  const Cc=env.co2*(params.ci_ca??0.70)*(params.Cc_Ci??0.80);
  const Oc=env.o2*10;
  const Wc=Vcmax*Cc/(Cc+Kc*(1+Oc/Ko));
  const Wj=J*Cc/(4*Cc+8*GS);
  // TPU: default Vcmax25/12 [C3 std Gregory 2021]; Tp25_off:true disables
  const Tp25=params.Tp25!==undefined?params.Tp25:params.Tp25_off?null:Vcmax25/12;
  const TpT=Tp25?Tp25*_arr(47100,Tk):Infinity;
  const Wp=isFinite(TpT)&&(Cc-GS)>0?3*TpT*Cc/(Cc-GS):Infinity;
  const Wmin=Math.min(Wc,Wj,Wp);
  const A=Wmin-Rd;
  const vovc=(Oc*1000)/(Srel*Math.max(Cc,0.1));
  return {
    Vc:Wmin,Vo:Wmin*vovc,Wc,Wj,Wp:isFinite(Wp)?Wp:null,J,A,Rd,vovc,
    gammastar:GS,Kc,Ko,Cc,Oc,Srel,Vcmax_eff:Vcmax,Vcmax25,Vomax,Jmax:JmaxT,
    limitState:Wc<=Wj&&Wc<=Wp?'Rubisco':Wj<=Wp?'RuBP':'TPU',belowCompPt:Cc<GS,
  };
}

// MODULE 2: photoResp() [Ogren 1984; Leegood 1995]
function photoResp(k) {
  const Vo=Math.max(0,k.Vo);
  return {
    flux_2PG:Vo,flux_glycolate:2*Vo,flux_glyoxylate:2*Vo,
    flux_glycine:2*Vo,flux_serine:Vo,flux_CO2_rel:0.5*Vo,
    flux_NH3:Vo,flux_glycerate:Vo,flux_3PGA_rec:Vo,
    cost_ATP:3*Vo,cost_reductant:2*Vo,
    carbon_loss:0.5*Vo,carbon_loss_pct:k.Wc>0?(0.5*Vo/k.Wc)*100:0,
  };
}

// MODULE 3: photoRespKinetic() [GOX At✓ Jossier 2019; GDC At✓ Timm 2012; PGLP1 Xi 2026]
function photoRespKinetic(k, pr, env, params={}) {
  const Tk=env.temp+273.15; const a=Ha=>_arr(Ha,Tk);
  const GOX_Vmax=(params.GOX_Vmax25??350)*a(57000);
  const GOX_Km=params.GOX_Km_gly??0.210;
  const GOX_KmO2=params.GOX_Km_O2??0.270;
  const O2p=(env.o2/100)*1.26*Math.exp(-16000/R*(1/T25-1/Tk));
  const GOX_Veff=GOX_Vmax*O2p/(GOX_KmO2+O2p);
  const gly_v=Math.min(pr.flux_glycolate,0.99*GOX_Veff);
  const glycolate_pool=GOX_Km*gly_v/(GOX_Veff-gly_v);
  const GOX_rate=GOX_Veff*glycolate_pool/(GOX_Km+glycolate_pool);
  const GOX_sat=GOX_rate/GOX_Vmax;
  const GDC_Vmax=(params.GDC_Vmax25??230)*a(65000);
  const GDC_Km=params.GDC_Km_gly??3.5;
  const gdc_v=Math.min(2*k.Vo,0.99*GDC_Vmax);
  const glycine_pool=GDC_Km*gdc_v/(GDC_Vmax-gdc_v);
  const GDC_rate_gly=GDC_Vmax*glycine_pool/(GDC_Km+glycine_pool);
  const GDC_rate=GDC_rate_gly/2; const GDC_sat=GDC_rate_gly/GDC_Vmax;
  const GGAT_Vmax=(params.GGAT_Vmax25??150)*a(55000);
  const GGAT_Km=params.GGAT_Km_glyox??0.20;
  const glyox_v=Math.min(GOX_rate,0.99*GGAT_Vmax);
  const glyoxylate_pool=GGAT_Km*glyox_v/(GGAT_Vmax-glyox_v);
  const GGAT_rate=GGAT_Vmax*glyoxylate_pool/(GGAT_Km+glyoxylate_pool);
  const GGAT_sat=GGAT_rate/GGAT_Vmax;
  const HPR_Vmax=(params.HPR1_Vmax25??200)*a(55000);
  const HPR_Km=params.HPR1_Km_HP??0.08;
  const hpr_v=Math.min(GDC_rate,0.99*HPR_Vmax);
  const HP_pool=HPR_Km*hpr_v/(HPR_Vmax-hpr_v);
  const HPR_rate=HPR_Vmax*HP_pool/(HPR_Km+HP_pool);
  const HPR1_sat=HPR_rate/HPR_Vmax;
  const PGLP_Km=params.PGLP_Km_2PG??0.272;
  const PGLP_Vmax=(params.PGLP_Vmax25??300)*a(55000);
  const rb=params.PGLP_redox_base??0.65; const rk=params.PGLP_redox_k??0.05;
  const I=Math.max(0,env.light);
  const f_redox=(rb+(1-rb)*(1-Math.exp(-rk*I)))/(rb+(1-rb)*(1-Math.exp(-rk*100)));
  const PGLP_Veff=PGLP_Vmax*f_redox;
  const pglp_v=Math.min(k.Vo,0.99*PGLP_Veff);
  const pool_2PG=PGLP_Km*pglp_v/(PGLP_Veff-pglp_v);
  const PGLP_rate=PGLP_Veff*pool_2PG/(PGLP_Km+pool_2PG);
  const PGLP_sat=PGLP_rate/PGLP_Veff;
  return {
    GOX_rate,GOX_sat,GDC_rate,GDC_sat,GGAT_rate,GGAT_sat,HPR_rate,HPR1_sat,
    PGLP_rate,PGLP_sat,pool_2PG,glycolate_pool,glycine_pool,glyoxylate_pool,HP_pool,f_redox,
    flux_CO2_rel:GDC_rate,flux_NH3:GDC_rate*2,flux_glycerate:HPR_rate,
  };
}

// MODULE 4: trxfState() [At✓ Xi 2026; Yoshida 2015; Michelet 2013]
function trxfState(env, mo, params={}) {
  const floor=params.trxf_dark_floor??0.10; const sat=params.trxf_light_sat??0.95;
  const half=params.trxf_half_light??80; const steep=params.trxf_steepness??0.03;
  const sig=1/(1+Math.exp(-steep*(Math.max(0,env.light)-half)));
  const trxf_light=floor+(sat-floor)*sig;
  const bypass_correction=(mo?.NADH_net??0)*(params.trxf_NADH_sensitivity??0.02)+(mo?.NADPH_net??0)*(params.trxf_NADPH_sensitivity??0.05);
  const trxf_red=_clamp(trxf_light+bypass_correction,0,1);
  const rca_alpha=params.rca_alpha_fraction??0.50; const rca_dark=params.rca_dark_min??0.20;
  const vcmax_rca_scale=rca_alpha*(rca_dark+trxf_red*(1-rca_dark))+(1-rca_alpha);
  const cbb_dark=params.cbb_regen_dark_min??0.15;
  return {trxf_red,vcmax_rca_scale,cbb_regen_activation:cbb_dark+trxf_red*(1-cbb_dark)};
}

// MODULE 5: kinFeedback() [At✓ Flügel 2017; Yoshida 2015; Ki sp:spinach]
function kinFeedback(k, prk, trxf, env, params={}) {
  let Vcmax_fb=k.Vcmax_eff; let Wj_fb=k.Wj;
  if (!(params.disable_2pg??false)&&prk) {
    const p2PG=prk.pool_2PG??0;
    Wj_fb*=(1/(1+p2PG/(params.Ki_TPI??0.066)))*(1/(1+p2PG/(params.Ki_SBPase??0.200)));
  }
  if (!(params.disable_trxf??false)&&trxf) {
    Vcmax_fb*=trxf.vcmax_rca_scale; Wj_fb*=trxf.cbb_regen_activation;
  }
  if (!(params.disable_gdc??false)&&prk) {
    const GDC_sat=prk.GDC_sat??0; const thresh=params.gdc_threshold??0.70;
    if (GDC_sat>thresh) {
      const excess=GDC_sat-thresh;
      Vcmax_fb/=(1+Math.pow(excess/(1-thresh),2)*(params.glyox_Ki_scale??0.15));
    }
  }
  const Wc_fb=Vcmax_fb*k.Cc/(k.Cc+k.Kc*(1+k.Oc/k.Ko));
  const Wmin_fb=Math.min(Wc_fb,Wj_fb); const A_fb=Wmin_fb-k.Rd;
  const vovc_fb=(k.Oc*1000)/(k.Srel*Math.max(k.Cc,0.1));
  return {
    A:A_fb,Wc:Wc_fb,Wj:Wj_fb,Vcmax_eff:Vcmax_fb,vovc:vovc_fb,
    Vc:Wmin_fb,Vo:Wmin_fb*vovc_fb,Rd:k.Rd,
    limitState:Wc_fb<=Wj_fb?'Rubisco':'RuBP',dA_feedback:A_fb-k.A,
    J:k.J,gammastar:k.gammastar,Kc:k.Kc,Ko:k.Ko,
    Cc:k.Cc,Oc:k.Oc,Vcmax25:k.Vcmax25,Jmax:k.Jmax,Srel:k.Srel,
  };
}

// Bypass helpers
function _lambdaCorrect(k, bypass_fraction) {
  return {lambda_eff:0.5*(1-bypass_fraction),gammastar_eff:k.gammastar*(1-bypass_fraction*0.5)};
}
function _A_bypass_estimate(k, CO2_bypass, refix, CO2_saved_mito, refix_mito, gammastar_eff) {
  return k.A+CO2_bypass*refix+CO2_saved_mito*refix_mito+(k.gammastar-gammastar_eff)*k.Vcmax_eff/(k.Cc+k.Kc*(1+k.Oc/k.Ko));
}

// MODULE 6a: bypass() — Kebeish [At✓ Kebeish 2007 Nat Biotechnol]
// CORRECTED: glycerate_bypass=bypass_flux/2; NADH_net=-bypass_flux*0.5
function bypass(k, pr, prk, env, params={}) {
  const Tk=env.temp+273.15;
  const Km_gly=params.bypass_Km_glycolate??0.04;
  const Vmax25=params.bypass_enzyme_Vmax25??5;
  const refix=params.refix_efficiency??0.60;
  const bp_Vmax=Vmax25*_arr(params.bypass_Ha??55000,Tk);
  const gly_pool=prk?.glycolate_pool??0.020;
  const bp_raw=bp_Vmax*gly_pool/(Km_gly+gly_pool);
  const bypass_flux=Math.min(bp_raw,pr.flux_glycolate);
  const bypass_fraction=pr.flux_glycolate>0?bypass_flux/pr.flux_glycolate:0;
  const native_GOX_flux=pr.flux_glycolate-bypass_flux;
  const CO2_bypass=0.5*bypass_flux;
  const glycerate_bypass=0.5*bypass_flux; // CORRECTED: 1 glycerate per 2 glycolate
  const nf=pr.flux_glycolate>0?native_GOX_flux/pr.flux_glycolate:1;
  const NH3_native=pr.flux_NH3*nf; const NH3_saving=pr.flux_NH3-NH3_native;
  const {lambda_eff,gammastar_eff}=_lambdaCorrect(k,bypass_fraction);
  const CO2_saved_mito = pr.flux_CO2_rel*(1-nf); // CO₂ not released because native PR reduced
  const A_bypass=_A_bypass_estimate(k,CO2_bypass,refix,CO2_saved_mito,params.refix_mito??0.30,gammastar_eff);
  // Kebeish SVG chain fluxes
  const flux_glyoxylate_k=bypass_flux;
  const flux_tartronate=bypass_flux*0.5;
  const flux_3pga_k=flux_tartronate;
  return {
    bypass_type:'kebeish',bypass_flux,bypass_fraction,native_GOX_flux,
    CO2_bypass,glycerate_bypass,flux_glyoxylate_k,flux_tartronate,
    flux_glycerate_k:flux_tartronate,flux_3pga_k,
    CO2_native:pr.flux_CO2_rel*nf,NH3_native,NH3_saving,ATP_saving:NH3_saving*3,
    lambda_eff,gammastar_eff,A_bypass,
    NADH_net:-bypass_flux*0.5,NADPH_net:0, // CORRECTED: was -bypass_flux
    bypass_placeholder:true,
    bypass_note:`EcGlcDH Vmax=${Vmax25}${Vmax25===5?' ⚠ placeholder':''}`,
  };
}

// MODULE 6b: bypassSouth() — South 2019 AP3 [sp:tobacco Science 363:eaat9077]
// CrGDH + CuMS: glycolate → malate (NOT glycerate, NOT direct CO2)
// CO2 from NADP-ME decarboxylating malate (conditional, fraction param)
// PLGG1 RNAi optional — retains glycolate for bypass
//
// ⚠ DOCUMENTED PHENOTYPE — South 2019 metabolomics (Fig. S5):
//   AP3 lines showed ELEVATED stromal glyoxylate AND reduced serine + glycerate.
//   Cause: CuMS (malate synthase) can become rate-limiting relative to CrGDH,
//   allowing stromal glyoxylate to accumulate before MS processes it.
//   Consequence: free glyoxylate inhibits RuBisCO — activates risk_glyoxylate.
//   Reduced serine + glycerate = native PR suppressed = native_GOX_flux reduced
//   (consistent with bypass diverting glycolate away from peroxisome).
//   → risk_glyoxylate is the CORRECT flag for this phenotype. NOT a code error.
//   To tune sensitivity: adjust glyox_downstream_capacity param (default 30).
//   For AP3-specific modelling: bypass_Km_glycolate may need raising toward
//   the CuMS Km rather than CrGDH Km [both [est ⚠] — no published At values].
function bypassSouth(k, pr, prk, env, params={}) {
  const Tk=env.temp+273.15;
  const Km_gly=params.bypass_Km_glycolate??0.30;
  const Vmax25=params.bypass_enzyme_Vmax25??5;
  const malate_dec=params.malate_decarb_fraction??0.70; // [est] range 0.30-1.0
  const plgg1=params.plgg1_suppression??0;              // [est] PLGG1 RNAi fraction
  const refix=params.refix_efficiency??0.60;
  const bp_Vmax=Vmax25*_arr(params.bypass_Ha??55000,Tk);
  const gly_pool=(prk?.glycolate_pool??0.020)*(1+plgg1*0.30);
  const bp_raw=bp_Vmax*gly_pool/(Km_gly+gly_pool);
  const bypass_flux=Math.min(bp_raw,pr.flux_glycolate);
  const bypass_fraction=pr.flux_glycolate>0?bypass_flux/pr.flux_glycolate:0;
  const native_GOX_flux=pr.flux_glycolate-bypass_flux;
  const malate_bypass=bypass_flux;
  const malate_decarboxylated=malate_bypass*malate_dec;
  const malate_exported=malate_bypass*(1-malate_dec);
  const CO2_bypass=malate_decarboxylated;
  const nf=pr.flux_glycolate>0?native_GOX_flux/pr.flux_glycolate:1;
  const CO2_native=pr.flux_CO2_rel*nf; const NH3_native=pr.flux_NH3*nf;
  const NH3_saving=pr.flux_NH3-NH3_native;
  const {lambda_eff,gammastar_eff}=_lambdaCorrect(k,bypass_fraction);
  const A_bypass=_A_bypass_estimate(k,CO2_bypass,refix,pr.flux_CO2_rel-CO2_native,params.refix_mito??0.30,gammastar_eff);
  return {
    bypass_type:'south',bypass_flux,bypass_fraction,native_GOX_flux,
    malate_bypass,malate_decarboxylated,malate_exported,
    CO2_bypass,glycerate_bypass:0,OAA_flux:0,OAA_to_malate:malate_exported,OAA_to_aspartate:0,
    CO2_native,NH3_native,NH3_saving,ATP_saving:NH3_saving*3,
    NADH_net:bypass_flux*0.5,NADPH_net:0,
    lambda_eff,gammastar_eff,A_bypass,
    bypass_placeholder:true,
    bypass_note:[`CrGDH+CuMS Vmax=${Vmax25}${Vmax25===5?' ⚠ placeholder':''}`,
      `malate_decarb=${malate_dec.toFixed(2)} [est]`,
      plgg1>0?`PLGG1 RNAi=${(plgg1*100).toFixed(0)}%`:null,
      `⚠ AP3 lines show elevated stromal glyoxylate (South 2019) — CuMS can be rate-limiting — see risk_glyoxylate`,
    ].filter(Boolean).join('; '),
  };
}

// MODULE 6c: bypassBHAC() — cBHAC [sp:rice Chen 2025 Plant Cell]
// CORRECTED: gly_pool fallback 0.020 (was 0.032)
function bypassBHAC(k, pr, prk, env, params={}) {
  const Tk=env.temp+273.15;
  const Km_gly=params.bypass_Km_glycolate??0.30;
  const Vmax25=params.bypass_enzyme_Vmax25??5;
  const f_OAA_MDH=params.f_OAA_MDH??0.50;
  const f_OAA_Asp=params.f_OAA_AspAT??0.45;
  const bp_Vmax=Vmax25*_arr(params.bypass_Ha??55000,Tk);
  const gly_pool=prk?.glycolate_pool??0.020; // CORRECTED from 0.032
  const total_glycolate=pr.flux_glycolate;
  const bp_raw=bp_Vmax*gly_pool/(Km_gly+gly_pool);
  const bypass_flux=Math.min(bp_raw,total_glycolate);
  const bypass_fraction=total_glycolate>0?bypass_flux/total_glycolate:0;
  const native_GOX_flux=total_glycolate-bypass_flux;
  const OAA_flux=bypass_flux/2;
  const NADH_consumed=bypass_flux/2; const NADPH_consumed=OAA_flux*f_OAA_MDH;
  const OAA_to_malate=OAA_flux*f_OAA_MDH; const OAA_to_aspartate=OAA_flux*f_OAA_Asp;
  const nf=total_glycolate>0?native_GOX_flux/total_glycolate:1;
  const CO2_native=pr.flux_CO2_rel*nf; const NH3_native=pr.flux_NH3*nf;
  const NH3_saving=pr.flux_NH3-NH3_native;
  const {lambda_eff,gammastar_eff}=_lambdaCorrect(k,bypass_fraction);
  const A_bypass=_A_bypass_estimate(k,0,0,pr.flux_CO2_rel-CO2_native,params.refix_mito??0.30,gammastar_eff);
  return {
    bypass_type:'cbhac',bypass_flux,bypass_fraction,native_GOX_flux,
    OAA_flux,OAA_to_malate,OAA_to_aspartate,NADH_consumed,NADPH_consumed,
    CO2_bypass:0,CO2_native,NH3_native,NH3_saving,ATP_saving:NH3_saving*3,
    NADH_net:-NADH_consumed,NADPH_net:-NADPH_consumed,
    lambda_eff,gammastar_eff,A_bypass,
    risk_OAA:Math.min(1,OAA_flux/(params.AspAT_capacity??7)),
    risk_glyoxylate:Math.min(1,(bypass_flux/(params.glyox_downstream_capacity??30))/0.2),
    bypass_placeholder:true,
    bypass_note:`CrGDH Vmax=${Vmax25}${Vmax25===5?' ⚠ placeholder':''}`,
  };
}

// MODULE 6d: bypassMcG() — McG dual cycle [At✓ Lu 2025 Science 389:eadp3528]
// Mode A full chain: CrGDH→glyoxylate, MTK→malyl-CoA, MCL→acetyl-CoA+glyoxylate(recycled),
//   GCL→tartronate-SA+CO₂, TSR→glycerate, GK→3-PGA
// Note: GCL/TSR/GK are the SAME enzymes as Kebeish — McG reuses that tail
// Mode B: 3PG→OAA via Ppc (HCO₃⁻, NOT CO₂) →MDH→MTK→MCL→acetyl-CoA (fixes CO₂!)
function bypassMcG(k, pr, prk, env, params={}) {
  const Tk=env.temp+273.15;
  const Km_gly=params.bypass_Km_glycolate??0.30;
  const Vmax25=params.bypass_enzyme_Vmax25??5;
  const lipidFrac=params.acetylCoA_fate_lipid??0.60;
  const pep_frac=params.pep_fraction??0.10; // [est HIGH ⚠]
  const bp_Vmax=Vmax25*_arr(params.bypass_Ha??55000,Tk);
  const gly_pool=prk?.glycolate_pool??0.020;
  const total_glycolate=pr.flux_glycolate;
  const bp_raw=bp_Vmax*gly_pool/(Km_gly+gly_pool);
  const bypass_flux=Math.min(bp_raw,total_glycolate);
  const bypass_fraction=total_glycolate>0?bypass_flux/total_glycolate:0;
  const native_GOX_flux=total_glycolate-bypass_flux;

  // Mode A chain intermediates — all 1:1 stoichiometry per glycolate [Lu 2025]
  const flux_glyoxylate_mcg = bypass_flux;          // CrGDH product
  const flux_malylCoA        = bypass_flux;          // MTK: glyoxylate → malyl-CoA
  const acetylCoA_modeA      = bypass_flux;          // MCL: malyl-CoA → AcCoA + glyoxylate(recycled)
  // GCL step: recycled glyoxylate → tartronate-SA + CO₂ (same as Kebeish GlxR)
  // stoichiometry: 2 glyoxylate → 1 tartronate-SA, but in McG only 1 recycled per cycle
  const flux_tartronate_mcg  = bypass_flux * 0.5;   // GCL (same enzyme as Kebeish)
  const CO2_mcg              = bypass_flux * 0.5;    // CO₂ from GCL step
  const flux_glycerate_mcg   = flux_tartronate_mcg;  // TSR (same as Kebeish)
  const flux_3pga_mcg        = flux_glycerate_mcg;   // GK→3-PGA (same as Kebeish)
  const acetylCoA_lipid      = acetylCoA_modeA * lipidFrac;

  // Mode B: PEP→OAA via Ppc
  const PEP_flux=k.Wc*pep_frac;
  const Ppc_Vmax25=params.Ppc_Vmax25??Vmax25;
  const Ppc_Km_PEP=params.Ppc_Km_PEP??0.15;
  const Ppc_VmaxT=Ppc_Vmax25*_arr(params.Ppc_Ha??55000,Tk);
  const v_ppc=Math.min(PEP_flux,0.99*Ppc_VmaxT);
  const PEP_pool=Ppc_Km_PEP*v_ppc/(Ppc_VmaxT-v_ppc);
  const modeB_flux=Math.min(Ppc_VmaxT*PEP_pool/(Ppc_Km_PEP+PEP_pool),PEP_flux);
  const acetylCoA_modeB=modeB_flux;
  const CO2_fixed_modeB=modeB_flux;
  const OAA_from_modeB=modeB_flux;
  const acetylCoA_total=acetylCoA_modeA+acetylCoA_modeB;

  const nf=total_glycolate>0?native_GOX_flux/total_glycolate:1;
  const CO2_native=pr.flux_CO2_rel*nf; const NH3_native=pr.flux_NH3*nf;
  const NH3_saving=pr.flux_NH3-NH3_native; const ATP_consumed=acetylCoA_total;
  const {lambda_eff,gammastar_eff}=_lambdaCorrect(k,bypass_fraction);
  const GS_d=k.Kc*(1+k.Oc/k.Ko);
  const A_bypass=k.A+(pr.flux_CO2_rel-CO2_native)*(params.refix_mito??0.30)
    +(k.gammastar-gammastar_eff)*k.Vcmax_eff/(k.Cc+GS_d)+modeB_flux*0.5;
  return {
    bypass_type:'mcg',bypass_flux,bypass_fraction,native_GOX_flux,
    flux_glyoxylate_mcg,flux_malylCoA,flux_tartronate_mcg,flux_glycerate_mcg,flux_3pga_mcg,
    CO2_mcg,
    acetylCoA_modeA,acetylCoA_modeB,acetylCoA_total,acetylCoA_lipid,
    modeB_flux,PEP_flux,PEP_pool,CO2_fixed_modeB,OAA_from_modeB,
    OAA_flux:OAA_from_modeB,OAA_to_malate:0,OAA_to_aspartate:0,
    CO2_bypass:CO2_mcg,CO2_native,CO2_total:CO2_native+CO2_mcg-CO2_fixed_modeB,
    NH3_native,NH3_saving,ATP_consumed,
    NADH_net:bypass_flux*0.5,NADPH_net:-acetylCoA_modeB,
    lambda_eff,gammastar_eff,A_bypass,
    bypass_placeholder:true,
    bypass_note:[`CrGDH Vmax=${Vmax25}${Vmax25===5?' ⚠ placeholder':''}`,`pep_fraction=${pep_frac} [est HIGH ⚠]`].join('; '),
  };
}

// MODULE 7: metabolicOutputs()
function metabolicOutputs(k, bp, env, params={}) {
  const btype=bp?.bypass_type??'none';
  const f_gc=params.f_glycerate_calvin??0.95;
  const f_MDH=params.f_OAA_MDH??0.50; const f_Asp=params.f_OAA_AspAT??0.45;
  const f_FA=params.f_acetylCoA_FA??0.60;
  let C_cal=0,C_FA=0,C_aa=0,C_exp=0,NADH_net=0,NADPH_net=0;
  if (btype==='kebeish') {
    const g=bp.glycerate_bypass??0;
    C_cal=g*3*f_gc; C_exp=g*3*(1-f_gc); NADH_net=-(bp.bypass_flux??0)*0.5;
  } else if (btype==='south') {
    C_cal=(bp.malate_decarboxylated??0)*4*0.40; C_exp=(bp.malate_exported??0)*4;
    NADH_net=bp.NADH_net??0;
  } else if (btype==='cbhac') {
    const OAA=bp.OAA_flux??0;
    C_exp=OAA*4*f_MDH; C_aa=OAA*4*f_Asp;
    NADH_net=bp.NADH_net??0; NADPH_net=bp.NADPH_net??0;
  } else if (btype==='mcg') {
    const AcCoA=bp.acetylCoA_total??0;
    C_FA=AcCoA*2*f_FA; C_exp=AcCoA*2*(1-f_FA);
    C_aa=(bp.OAA_from_modeB??0)*4*f_Asp; C_cal=(bp.CO2_fixed_modeB??0)*0.7;
    NADH_net=bp.NADH_net??0; NADPH_net=bp.NADPH_net??0;
  }
  const N_conserved=bp?.NH3_saving??0;
  const ATP_net=(bp?.ATP_saving??0)-(bp?.ATP_consumed??0);
  const NADH_native=k.Vo*0.5;
  const redox_pressure=_clamp(NADH_native>0?0.5+(NADH_net/NADH_native)*0.3:0.5,0,1);
  return {
    carbon_to_calvin:+C_cal.toFixed(4),carbon_to_fatty_acids:+C_FA.toFixed(4),
    carbon_to_amino_acids:+C_aa.toFixed(4),carbon_exported:+C_exp.toFixed(4),
    OAA_to_malate:btype==='cbhac'?+((bp.OAA_flux??0)*f_MDH).toFixed(4):0,
    OAA_to_aspartate:btype==='cbhac'?+((bp.OAA_flux??0)*f_Asp).toFixed(4):0,
    nitrogen_conserved:+N_conserved.toFixed(4),
    NADH_net:+NADH_net.toFixed(4),NADPH_net:+NADPH_net.toFixed(4),
    redox_pressure:+redox_pressure.toFixed(4),ATP_net:+ATP_net.toFixed(4),
    risk_glyoxylate:bp?.risk_glyoxylate??0,risk_OAA:bp?.risk_OAA??0,
    risk_malate_valve:+_clamp(C_exp/(params.DiT_capacity??30)/4,0,1).toFixed(3),
  };
}

// MAIN runModel()
function runModel(env, params={}) {
  const k=kin(env,params); const pr=photoResp(k);
  const prk=photoRespKinetic(k,pr,env,params);
  let bp=null;
  if (params.bypass_active) {
    const bt=params.bypass_type??'kebeish';
    if      (bt==='kebeish') bp=bypass(k,pr,prk,env,params);
    else if (bt==='south')   bp=bypassSouth(k,pr,prk,env,params);
    else if (bt==='cbhac')   bp=bypassBHAC(k,pr,prk,env,params);
    else if (bt==='mcg')     bp=bypassMcG(k,pr,prk,env,params);
  }
  const mo=metabolicOutputs(k,bp,env,params);
  const trxf=trxfState(env,mo,params);
  const kfb=kinFeedback(k,prk,trxf,env,params);
  const redox_pressure=_clamp(0.5+(mo.NADH_net/Math.max(k.Vo*0.5,0.001))*0.3,0,1);
  return {
    A:kfb.A,A_fvCB:k.A,A_bypass:bp?.A_bypass??kfb.A,
    Wc:kfb.Wc,Wj:kfb.Wj,Wp:k.Wp,limitState:kfb.limitState,
    Vc:kfb.Vc,Vo:kfb.Vo,vovc:kfb.vovc,
    gammastar:k.gammastar,gammastar_eff:bp?.gammastar_eff??k.gammastar,lambda_eff:bp?.lambda_eff??0.5,
    Cc:k.Cc,Vcmax_eff:kfb.Vcmax_eff,Vcmax25:k.Vcmax25,J:k.J,Rd:kfb.Rd,
    dA_feedback:kfb.dA_feedback,trxf_red:trxf.trxf_red,redox_pressure,
    flux_glycolate:pr.flux_glycolate,
    native_GOX_flux:bp?.native_GOX_flux??pr.flux_glycolate,
    flux_glycine:bp?.native_GOX_flux??pr.flux_glycolate,
    flux_serine:(bp?.native_GOX_flux??pr.flux_glycolate)*0.5,
    flux_CO2_rel:bp?(bp.CO2_native??pr.flux_CO2_rel):prk.flux_CO2_rel,
    flux_NH3:bp?(bp.NH3_native??pr.flux_NH3):prk.flux_NH3,
    flux_glycerate:prk.flux_glycerate??pr.flux_glycerate,
    flux_3PGA_rec:pr.flux_3PGA_rec,carbon_loss_pct:pr.carbon_loss_pct,
    pool_2PG:prk.pool_2PG,glycolate_pool:prk.glycolate_pool,
    glycine_pool:prk.glycine_pool,glyoxylate_pool:prk.glyoxylate_pool,HP_pool:prk.HP_pool,
    GOX_sat:prk.GOX_sat,GDC_sat:prk.GDC_sat,GGAT_sat:prk.GGAT_sat,
    HPR1_sat:prk.HPR1_sat,PGLP_sat:prk.PGLP_sat,PGLP_f_redox:prk.f_redox,
    bypass_active:params.bypass_active??false,bypass_type:bp?.bypass_type??null,
    bypass_flux:bp?.bypass_flux??0,bypass_fraction:bp?.bypass_fraction??0,
    CO2_bypass:bp?.CO2_bypass??0,glycerate_bypass:bp?.glycerate_bypass??0,
    flux_glyoxylate_k:bp?.flux_glyoxylate_k??0,flux_tartronate:bp?.flux_tartronate??0,
    flux_glycerate_k:bp?.flux_glycerate_k??0,flux_3pga_k:bp?.flux_3pga_k??0,
    // McG intermediates
    flux_malylCoA:bp?.flux_malylCoA??0,
    flux_tartronate_mcg:bp?.flux_tartronate_mcg??0,
    flux_glycerate_mcg:bp?.flux_glycerate_mcg??0,
    flux_3pga_mcg:bp?.flux_3pga_mcg??0,
    malate_bypass:bp?.malate_bypass??0,malate_decarboxylated:bp?.malate_decarboxylated??0,
    malate_exported:bp?.malate_exported??0,
    OAA_flux:bp?.OAA_flux??0,OAA_to_malate:bp?.OAA_to_malate??0,OAA_to_aspartate:bp?.OAA_to_aspartate??0,
    acetylCoA_total:bp?.acetylCoA_total??0,acetylCoA_modeA:bp?.acetylCoA_modeA??0,
    acetylCoA_modeB:bp?.acetylCoA_modeB??0,modeB_flux:bp?.modeB_flux??0,
    CO2_fixed_modeB:bp?.CO2_fixed_modeB??0,CO2_total:bp?.CO2_total??pr.flux_CO2_rel,
    NH3_saving:bp?.NH3_saving??0,bypass_placeholder:bp?.bypass_placeholder??false,
    bypass_note:bp?.bypass_note??null,
    carbon_to_amino_acids:mo.carbon_to_amino_acids,carbon_to_fatty_acids:mo.carbon_to_fatty_acids,
    carbon_exported:mo.carbon_exported,nitrogen_conserved:mo.nitrogen_conserved,
    ATP_net:mo.ATP_net,NADH_net:mo.NADH_net,
    risk_glyoxylate:mo.risk_glyoxylate,risk_OAA:mo.risk_OAA,risk_malate_valve:mo.risk_malate_valve,
  };
}

// SCENARIO MANAGER
const SCENARIOS = {
  WT:              {label:'Wild type (Col-0)',                      params:{}},
  PGLP1_OE:        {label:'PGLP1-OE (144% Vmax) [At✓]',           params:{PGLP_Vmax25:432}},
  PGLP1_AS:        {label:'PGLP1-AS (9% Vmax) [At✓]',             params:{PGLP_Vmax25:27}},
  GDC_H_OE:        {label:'GDC-H OE [At✓]',                       params:{GDC_Vmax25:345}},
  KEBEISH:         {label:'Kebeish (EcGlcDEF) [At✓]',              params:{bypass_active:true,bypass_type:'kebeish',bypass_enzyme_Vmax25:5}},
  SOUTH_AP3:       {label:'South AP3 (CrGDH+CuMS) [sp:tobacco]',  params:{bypass_active:true,bypass_type:'south',bypass_enzyme_Vmax25:5,malate_decarb_fraction:0.70}},
  SOUTH_AP3_PLGG1: {label:'South AP3 + PLGG1 RNAi (+40%) [sp:tobacco]', params:{bypass_active:true,bypass_type:'south',bypass_enzyme_Vmax25:10,malate_decarb_fraction:0.70,plgg1_suppression:0.60}},
  CBHAC:           {label:'cBHAC (CrGDH+BhcA-D) [sp:rice]',       params:{bypass_active:true,bypass_type:'cbhac',bypass_enzyme_Vmax25:5}},
  PGLP1_OE_CBHAC:  {label:'PGLP1-OE + cBHAC',                     params:{PGLP_Vmax25:432,bypass_active:true,bypass_type:'cbhac',bypass_enzyme_Vmax25:5}},
  MCG:             {label:'McG dual cycle [At✓ Lu 2025]',           params:{bypass_active:true,bypass_type:'mcg',bypass_enzyme_Vmax25:5,pep_fraction:0.10}},
  MCG_HIGH:        {label:'McG high expression [At✓ Lu 2025]',     params:{bypass_active:true,bypass_type:'mcg',bypass_enzyme_Vmax25:20,Ppc_Vmax25:20,pep_fraction:0.18}},
};
function runScenario(name, env, extra={}) {
  const sc=SCENARIOS[name]; if (!sc) throw new Error(`Unknown scenario: ${name}`);
  return {scenario:name,label:sc.label,...runModel(env,{...sc.params,...extra})};
}
function compareScenarios(names, env) {
  return names.map(n=>runScenario(n,env)).sort((a,b)=>b.A-a.A);
}


const ARROW_INFO = {
  rubisco_c: {name:"RuBisCO carboxylation", ec:"4.1.1.39", rxn:"RuBP + CO₂ → 2× 3-PGA",
    up:"↑ CO₂ (Cc), ↑ Vcmax, ↑ activation state", down:"↑ O₂ competition, ↑ temp (Srel falls), stomatal closure",
    conf:"high", unc:"Kc/Ko/Γ* [C3 std Bernacchi 2002]. Vcmax25 [usr] — fit from your ACi curves."},
  rubisco_o: {name:"RuBisCO oxygenation", ec:"4.1.1.39", rxn:"RuBP + O₂ → 2-PG + 3-PGA",
    up:"↑ O₂, ↑ temp, ↓ CO₂", down:"↑ CO₂, C4/CCM concentrating mechanisms",
    conf:"medium", unc:"Srel25=2590 [sp:spinach ⚠] — no direct Arabidopsis measurement."},
  pgk_gapdh: {name:"PGK + GAPDH (CBB reduction)", ec:"2.7.2.3 / 1.2.1.13", rxn:"3-PGA + ATP + NADPH → G3P + Pi",
    up:"↑ ATP, ↑ NADPH, light via thioredoxin", down:"↓ Pi (TPT blocked), darkness",
    conf:"high", unc:"Stoichiometry [At✓]. Pi limitation modelled via pi slider."},
  regen:     {name:"RuBP regeneration (PRK)", ec:"2.7.1.19", rxn:"G3P + 3 ATP → RuBP",
    up:"↑ ATP, light activates PRK via thioredoxin", down:"↓ Pi, darkness",
    conf:"high", unc:"Stoichiometry [At✓]. Trx f activation of PRK [At✓ Michelet 2013]."},
  pgpase:    {name:"2-PG phosphatase (PGLP1)", ec:"3.1.3.18", rxn:"2-PG → Glycolate + Pi",
    up:"↑ 2-PG; Trx f light-activated [At✓ Xi 2026]", down:"No known product inhibition",
    conf:"placeholder", unc:"Vmax25=300 µmol/m²/s [usr ⚠]. Km=0.272mM [sp:rice]."},
  gox_p:     {name:"Glycolate oxidase / CrGDH (bypass)", ec:"1.1.3.15", rxn:"Glycolate + O₂ → Glyoxylate + H₂O₂ (native) OR Glycolate → Glyoxylate (bypass, no H₂O₂)",
    up:"↑ glycolate, ↑ O₂ (native); ↑ transgene expression (bypass)", down:"Bypass routes divert glycolate before GOX step",
    conf:"high", unc:"Native GOX: Km=0.210mM [At✓ Jossier 2019]. CrGDH: electron acceptor unknown in planta [HIGH ⚠]."},
  ggat:      {name:"Glu:glyoxylate aminotransferase (GGAT)", ec:"2.6.1.4", rxn:"Glyoxylate + Glu → Glycine + 2-OG",
    up:"↑ glyoxylate", down:"Bypass reduces glyoxylate pool",
    conf:"high", unc:"Confirmed non-rate-limiting in Arabidopsis WT [At✓ Liepman 2003]."},
  hpr:       {name:"Hydroxypyruvate reductase (HPR1)", ec:"1.1.1.29", rxn:"Hydroxypyruvate + NADH → Glycerate + NAD⁺",
    up:"↑ hydroxypyruvate, ↑ NADH", down:"↓ NADH supply",
    conf:"high", unc:"Confirmed non-rate-limiting [At✓ Timm lab]. Km=0.08mM [At✓]."},
  gdc_shmt:  {name:"GDC + SHMT (mitochondria)", ec:"1.4.4.2 / 2.1.2.1", rxn:"2 Gly → Ser + CO₂ + NH₃ + NADH",
    up:"↑ Gly flux, ↑ NAD⁺; uses up to 50% of mito capacity in C3", down:"NADH accumulation inhibits; cold <15°C strongly inhibits",
    conf:"medium", unc:"Vmax [At✓ Timm 2012]. Km=3.5mM glycine [sp:pea ⚠]."},
  gsgo:      {name:"GS + Fd-GOGAT (NH₃ refixation)", ec:"6.3.1.2 / 1.4.7.1", rxn:"NH₃ + Gln + ATP → 2 Glu",
    up:"↑ NH₃, ↑ Fd_red (light)", down:"↓ light (Fd), N-limitation",
    conf:"high", unc:"Stoichiometry [At✓]. Flux = 1× Vo in WT."},
  gcl:       {name:"GcL / CrGDH — bypass step 1", ec:"4.1.1.47", rxn:"Glycolate → Glyoxylate (stromal, no H₂O₂)",
    up:"↑ glycolate pool; transgene expression", down:"Requires transgene — native enzyme absent in plants",
    conf:"placeholder", unc:"Vmax25=5 [usr ⚠ placeholder]. Km=0.04mM [sp:E.coli] (Kebeish) / 0.30mM [sp:Chlamy] (South/cBHAC/McG)."},
  glxr:      {name:"GlxR / CuMS — bypass step 2", ec:"4.1.1.47 / 2.3.3.9", rxn:"2 Glyoxylate → Tartronate-SA + CO₂ (Kebeish) OR Glyoxylate + AcCoA → Malate (South)",
    up:"↑ glyoxylate (from step 1)", down:"Rate governed by upstream CrGDH/GcL",
    conf:"placeholder", unc:"Kebeish: CO₂ stoichiometry [At✓ 2007]. South: CuMS from Cucurbita maxima [sp:tobacco South 2019]."},
  tsr:       {name:"TSR — Kebeish step 3 (E. coli)", ec:"1.1.1.60", rxn:"Tartronate-SA + NADPH → Glycerate",
    up:"↑ tartronate-SA, ↑ NADPH", down:"↓ NADPH under low light",
    conf:"placeholder", unc:"Stoichiometry [At✓ Kebeish 2007]. Rate governed by upstream GcL."},
  glyk:      {name:"GLYK — Kebeish step 4 (E. coli)", ec:"2.7.1.31", rxn:"Glycerate + ATP → 3-PGA (→ CBB)",
    up:"↑ glycerate, ↑ ATP", down:"Confirmed non-limiting in Kebeish lines [At✓]",
    conf:"high", unc:"Product 3-PGA re-enters CBB [At✓ Kebeish 2007]. Stoichiometry verified."},
  cbhac_gdh: {name:"CrGDH+BhcA-D / Ppc / CuMS — cBHAC, South or McG entry", ec:"1.1.—", rxn:"2 Glycolate → OAA (cBHAC) · Glycolate → Glyoxylate → Malate (South) · PEP+HCO₃⁻ → OAA (McG Mode B)",
    up:"↑ glycolate pool; transgene expression", down:"CrGDH electron acceptor unknown in planta ⚠; CuMS can become rate-limiting in South AP3 lines",
    conf:"placeholder", unc:"South 2019 metabolomics: AP3 lines showed elevated stromal glyoxylate + reduced serine/glycerate — consistent with CuMS becoming limiting relative to CrGDH, allowing glyoxylate accumulation. This activates risk_glyoxylate in the model (>0.7 = warning). Not a model error — risk_glyoxylate is the correct flag. cBHAC: not yet in Arabidopsis [sp:rice Chen 2025]. All Vmax [usr ⚠]."},
};

const NODE_INFO = {
  co2:      {name:"CO₂ (stroma)", f:"CO₂", conf:"medium",
    r:"Substrate for RuBisCO. Cc = Ca × ci/ca × Cc/Ci.",
    unc:"ci/ca=0.70 [est]; Cc/Ci=0.80 [est gm] — Arabidopsis gm may be lower (~0.70–0.75)."},
  rubp:     {name:"RuBP", f:"C₅H₁₂O₁₁P₂", conf:"high",
    r:"CO₂ acceptor. Regenerated by CBB using 3 ATP per turn. Limiting when J is low.",
    unc:"Stoichiometry [At✓]."},
  pg3:      {name:"3-PGA", f:"C₃H₇O₇P", conf:"high",
    r:"First product of carboxylation. Also product of GLYK in Kebeish — re-entering CBB here closes the loop.",
    unc:"Stoichiometry [At✓]."},
  g3p:      {name:"G3P / triose-P", f:"C₃H₇O₆P", conf:"high",
    r:"Branch point: exported via TPT for sucrose, starch, or recycled to regenerate RuBP.",
    unc:"Stoichiometry [At✓]. TPT export modelled via Pi slider."},
  pg2:      {name:"2-PG", f:"C₃H₅O₆P", conf:"medium",
    r:"Oxygenation product. PGLP1 → glycolate. Inhibits TPI+SBPase (Loop 1 feedback) when pool >~0.01mM.",
    unc:"Pool depends on PGLP1 Vmax [usr ⚠] and Km [sp:rice]. Ki_TPI [sp:spinach ⚠]."},
  glycolate:{name:"Glycolate (stroma)", f:"C₂H₄O₃", conf:"high",
    r:"Branch point: PLGG1 export to peroxisome (native PR) or intercepted by bypass enzymes in stroma.",
    unc:"GOX Km=0.210mM [At✓ AtGOX1]. PLGG1 capacity [est]."},
  glyoxy:   {name:"Glyoxylate (peroxisome)", f:"C₂H₂O₃", conf:"high",
    r:"Classical PR intermediate. GGAT → glycine. Toxic if accumulates.",
    unc:"GGAT confirmed non-limiting [At✓]. Pool [At✓ qualitative]."},
  glycine:  {name:"Glycine (perox → mito)", f:"C₂H₅NO₂", conf:"medium",
    r:"Rate-limiting PR intermediate. GlyT transport to mito for GDC. Can use ~50% of mito capacity.",
    unc:"GDC Km=3.5mM [sp:pea ⚠] — no Arabidopsis measurement."},
  hpp:      {name:"Hydroxypyruvate (perox)", f:"C₃H₄O₄", conf:"high",
    r:"SGAT product. Reduced by HPR1+NADH → glycerate. HPR1 confirmed non-limiting.",
    unc:"HPR1 Km=0.08mM [At✓]."},
  glycerate:{name:"Glycerate (perox)", f:"C₃H₆O₄", conf:"high",
    r:"Final peroxisomal product → stroma via PLGG1 → GLYK → 3-PGA. Carbon recovered into CBB.",
    unc:"Stoichiometry [At✓]."},
  gly_m:    {name:"Glycine (mitochondria)", f:"C₂H₅NO₂", conf:"medium",
    r:"GDC substrate. 2 Gly → Ser + CO₂ + NH₃ + NADH.",
    unc:"GDC Km [sp:pea ⚠]. Cold inhibition [At✓ direction]."},
  serine:   {name:"Serine (mito → perox)", f:"C₃H₇NO₃", conf:"high",
    r:"GDC/SHMT product. Returns to peroxisome → SGAT → hydroxypyruvate.",
    unc:"Stoichiometry [At✓]."},
  nh3:      {name:"NH₃ (mitochondria)", f:"NH₃", conf:"high",
    r:"GDC product. Re-fixed by GS/GOGAT in stroma (1 ATP + 1 Fd_red per NH₃). Major N-cycling cost of PR.",
    unc:"Stoichiometry [At✓]."},
  glyox_k:  {name:"Glyoxylate (Kebeish, stroma)", f:"C₂H₂O₃", conf:"placeholder",
    r:"GcL product. Never leaves chloroplast. Substrate for GlxR. Distinct from peroxisomal glyoxylate.",
    unc:"Flux governed by EcGlcDH Vmax [usr ⚠]. Pool unmeasured in transgenic Arabidopsis."},
  glyox_ap: {name:"Glyoxylate (bypass, stroma)", f:"C₂H₂O₃", conf:"placeholder",
    r:"CrGDH product in South/McG bypass. Should be immediately condensed by CuMS (South) or MTK (McG). ⚠ South 2019 metabolomics showed elevated glyoxylate in AP3 lines — CuMS can become rate-limiting, allowing free stromal glyoxylate to accumulate and inhibit RuBisCO. This is what risk_glyoxylate measures.",
    unc:"[sp:tobacco South 2019 / At✓ Lu 2025]. CrGDH electron acceptor unknown in planta [HIGH ⚠]. Vmax [usr ⚠]. CuMS Km unknown in plant context [est ⚠]. Risk threshold: glyox_downstream_capacity=30 µmol/m²/s (adjustable)."},
  tartr:    {name:"Tartronate-SA / Malate (bypass node)", f:"C₃H₄O₄ / C₄H₆O₅", conf:"placeholder",
    r:"Kebeish: tartronate-semialdehyde from GlxR → TSR+NADPH → glycerate. South: malate from CuMS → NADP-ME (CO₂) or DiT1 export.",
    unc:"Kebeish: [At✓ 2007]. South: malate_decarb_fraction=0.70 [est ⚠]."},
  glycer_k: {name:"Glycerate (Kebeish, stroma)", f:"C₃H₆O₄", conf:"high",
    r:"TSR product → GLYK → 3-PGA. Entire Kebeish bypass stays in chloroplast. Carbon fully recovered into CBB.",
    unc:"GLYK confirmed non-limiting [At✓ Kebeish 2007]."},
};


const MINFO = {
  "Net A":  {symbol:"A", formula:"min(Wc,Wj,Wp)−Rd+feedback", unit:"µmol CO₂/m²/s",
    desc:"Feedback-corrected net CO₂ assimilation. Includes three feedback loops on top of FvCB: 2-PG inhibition of TPI/SBPase (Loop 1), Trx f regulation of RCA+CBB enzymes (Loop 2), GDC saturation back-pressure (Loop 3). A_fvCB shows raw FvCB without feedback.",
    range:"C3 full sun: 15–30. Zero in dark. Negative when Cc < Γ* or severe 2-PG accumulation."},
  "Limit":  {symbol:"limitState", formula:"Rubisco if Wc≤Wj≤Wp", unit:"—",
    desc:"Which process bottlenecks photosynthesis. Rubisco-limited: more light won't help — raise CO₂ or Vcmax. RuBP-limited: more CO₂ won't help — raise light or Jmax. TPU: triose-P utilisation saturated (high CO₂, saturating light, when Tp25 is set).",
    range:"Ambient CO₂: Rubisco-limited. High CO₂ + bright light: RuBP. TPU: rare."},
  "Wc":     {symbol:"Wc", formula:"Vcmax·Cc / (Cc+Kc·(1+O/Ko))", unit:"µmol/m²/s",
    desc:"Rubisco carboxylation rate after feedback corrections (Trx f RCA scaling, GDC back-pressure). Kc=272.4 µmol/mol, Ko=165.8 mmol/mol at 25°C [Bernacchi 2002 C3 std]. Rises with CO₂, falls with high O₂ and temperature.",
    range:"Equals Wj at the A/Ci break point — typically Cc 200–400 µmol/mol."},
  "Wj":     {symbol:"Wj", formula:"J·Cc / (4·Cc+8·Γ*)", unit:"µmol/m²/s",
    desc:"RuBP-regeneration-limited rate using the correct Cc-based Bernacchi 2002 formula. After feedback, Wj is scaled by Trx f activation (Loop 2) and 2-PG inhibition of TPI+SBPase (Loop 1). Coefficients 4 and 8 reflect CBB+PR stoichiometry.",
    range:"Limiting at high CO₂ + saturating light. Rises with PAR and Jmax."},
  "Vc":     {symbol:"Vc", formula:"min(Wc,Wj,Wp)", unit:"µmol/m²/s",
    desc:"Gross carboxylation flux — the actual RuBisCO rate given the active limitation. Stays positive even when A < 0. Sets SVG arrow widths (width ∝ √Vc).",
    range:"~1.3–1.5× Net A at standard conditions."},
  "Vo":     {symbol:"Vo", formula:"Vc×(O×1000)/(Srel×Cc)", unit:"µmol/m²/s",
    desc:"Oxygenation flux — RuBisCO grabbing O₂, initiating photorespiration (orange arrows). Each oxygenation costs ~3.5 ATP + 2 NADH and releases 0.5 CO₂ in mitochondria. Rises with temperature (Srel falls), high O₂, low CO₂. Uncertainty: Srel25=2590 [sp:spinach ⚠].",
    range:"Vo/Vc ~0.3 at 25°C ambient. Can exceed Vc under hot/dry stress."},
  "Vo/Vc":  {symbol:"vovc", formula:"(O×1000)/(Srel×Cc)", unit:"ratio",
    desc:"Oxygenation-to-carboxylation ratio from first principles via Srel. Srel ±15% → vovc ±15% — this uncertainty propagates directly to all photorespiratory flux outputs. Value >1 means more oxygenations than carboxylations.",
    range:"~0.25–0.35 at standard. Rises sharply above 30°C."},
  "J":      {symbol:"J", formula:"Non-rectangular hyperbola (α=0.30, θ=0.70)", unit:"µmol e⁻/m²/s",
    desc:"Electron transport rate — thylakoid electron flow making ATP+NADPH for RuBP regeneration. α=0.30 [C3 std]; θ=0.70 [C3 std]. Jmax25=1.67×Vcmax25 [C3 std est] — coupled via ratio.",
    range:"Saturates at ~800–1200 µmol photons/m²/s PAR."},
  "Γ*":     {symbol:"Γ*", formula:"42.75·exp(37830/R·(1/298.15−1/Tk))", unit:"µmol/mol",
    desc:"CO₂ compensation point ignoring Rd. Below Γ*, Wj goes negative. When bypass is active, display shows Γ*_eff = Γ* × (1 − bypass_fraction × 0.5) — the λ correction [Busch 2020]: fewer CO₂ molecules are lost per oxygenation when bypass intercepts glycolate. A lower Γ*_eff means the leaf can fix carbon at lower CO₂.",
    range:"42.75 at 25°C → ~55 at 35°C [Bernacchi 2001]."},
  "Rd":     {symbol:"Rd", formula:"0.015×Vcmax₂₅×arrh(46390,Tk)", unit:"µmol/m²/s",
    desc:"Day respiration — mitochondrial CO₂ release in the light (not photorespiration). The 0.015 ratio [C3 std] is an approximation; range 0.010–0.025 across species. Measure from your material for precision.",
    range:"0.5–2 µmol/m²/s typical. Rises with temperature."},
  "dA fb":  {symbol:"dA_feedback", formula:"A_feedback − A_fvCB", unit:"µmol/m²/s",
    desc:"How much the three feedback loops shift A relative to standard FvCB. Negative = feedbacks reduce A (2-PG accumulation or Trx f limitation). Near-zero in WT at ambient. Larger and more negative in pglp1-2 mutant. Compare A and A_fvCB in the metrics.",
    range:"−2 to 0 typical in WT. More negative with impaired PGLP1."},
  "Trx f":  {symbol:"trxf_red", formula:"floor + (sat−floor)·σ(I)", unit:"0–1",
    desc:"Thioredoxin f reduction state — master switch for the illuminated chloroplast. Reduced by ferredoxin via FTR during photosynthesis. Activates PGLP1 [At✓ Xi 2026], RuBisCO activase α [At✓ Yoshida 2015], FBPase, SBPase, PRK, GAPDH [At✓ Michelet 2013]. Dark floor=0.10, light sat=0.95 [At✓].",
    range:"0.10 (dark) → 0.95 (saturating light). Half-sat ~80 µmol/m²/s [At✓ indirect]."},
};

// ─── Palette ───────────────────────────────────────────────────────────────
const COL = {
  cbb:"#1D9E75", pr:"#D85A30", nh3:"#888", nadh:"#378ADD",
  keb:"#7F77DD", cbhac:"#378ADD",
  stroma:{ fill:"#eaf7f1", stroke:"#1D9E75" },
  perox: { fill:"#fef3ee", stroke:"#D85A30"  },
  mito:  { fill:"#fff8f0", stroke:"#BA7517"  },
};

// ─── SVG primitives ────────────────────────────────────────────────────────
const SR = 9; // small node radius — matches SN_R in SmallNode

function fw(f){ return Math.max(0.4, Math.min(Math.sqrt(Math.max(f,0))*1.0, 4.5)); }
function fo(f){ return Math.max(0.15, Math.min(0.12+f*0.05, 0.88)); }

// Arrow — now with optional ak (arrow key) for click tooltip
// Confidence colour lookup
const CONF = {high:"#1D9E75", medium:"#e0b000", low:"#e07b00", placeholder:"#E24B4A"};
const CONF_LABEL = {
  high:        "[At✓] Measured in Arabidopsis",
  medium:      "[C3/sp] Other species or C3 standard",
  low:         "[est] Estimated from indirect evidence",
  placeholder: "[usr⚠] Placeholder — needs your measurement",
};

// Arrow — confidence dot at midpoint when ak present
function Arrow({x1,y1,x2,y2,flux,color,dashed,label,bend=0,ak,onA,conf}){
  if(!flux||flux<0.005) return null;
  const w=fw(flux), op=fo(flux);
  const spd=dashed?`${Math.max(0.6,4.5-flux*0.1).toFixed(1)}s`:null;
  const d=bend?`M${x1} ${y1} Q${(x1+x2)/2+bend} ${(y1+y2)/2+bend} ${x2} ${y2}`:`M${x1} ${y1} L${x2} ${y2}`;
  const mlx=bend?(x1+x2)/2+bend*0.28:(x1+x2)/2;
  const mly=bend?(y1+y2)/2+bend*0.28:(y1+y2)/2;
  const cc = conf ? (CONF[conf]??"#555") : null;
  return(
    <g style={ak?{cursor:"pointer"}:{}} onClick={ak&&onA?e=>{e.stopPropagation();onA(ak,mlx,mly,flux)}:undefined}>
      <path d={d} fill="none" stroke={color} strokeWidth={w} opacity={op}
        strokeDasharray={dashed?"6 3":"none"} strokeLinecap="round" markerEnd="url(#arr)"
        style={dashed?{animation:`dk ${spd} linear infinite`}:{}}/>
      {ak&&<path d={d} fill="none" stroke="transparent" strokeWidth={14}/>}
      {label&&flux>0.1&&<text x={mlx} y={mly-5} fontSize={7.5} fill={color}
        opacity={Math.min(op*1.8,0.9)} textAnchor="middle" style={{pointerEvents:"none"}}>
        {label} <tspan fontWeight={600}>{flux.toFixed(1)}</tspan>
      </text>}
      {/* Confidence dot — only on clickable arrows with known conf */}
      {ak&&cc&&<circle cx={mlx+8} cy={mly-10} r={3} fill={cc} opacity={0.85} style={{pointerEvents:"none"}}/>}
    </g>
  );
}

// Large named node — conf ring colour when supplied
function Node({x,y,w=68,h=21,label,comp,conf}){
  const s = conf ? (CONF[conf]??"#555") : (COL[comp]||COL.stroma).stroke;
  const sw = conf && conf !== 'high' ? 1.6 : 0.8;
  const dash = conf === 'placeholder' ? "3 2" : conf === 'low' ? "4 2" : "none";
  return(
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#fff"
        stroke={s} strokeWidth={sw} strokeDasharray={dash}/>
      {conf&&conf!=='high'&&<circle cx={x+w-5} cy={y+5} r={3} fill={s} opacity={0.85}/>}
      <text x={x+w/2} y={y+h/2} textAnchor="middle" dominantBaseline="central"
        fontSize={8.5} fontWeight={500} fill="#222">{label}</text>
    </g>
  );
}

// Small metabolite node — larger, legible, confidence shown as corner badge
// Click anywhere on the node (circle + label) to open tooltip
const SN_R = 9; // radius — bigger than before for easier clicking
function SmallNode({x,y,color,nk,onN,conf,label}){
  const rc  = conf ? (CONF[conf] ?? color) : color;
  const bdg = conf && conf !== 'high'; // show corner badge for non-verified nodes
  const dash = conf==='placeholder' ? "2.5 2" : conf==='low' ? "4 2" : "none";
  const shortLabel = label ?? nk;
  return(
    <g style={{cursor:"pointer"}}
       onClick={e=>{e.stopPropagation(); onN&&onN(nk,x,y);}}>
      {/* Invisible fat hit area — 20px radius */}
      <circle cx={x} cy={y} r={20} fill="transparent"/>
      {/* Outer dashed ring — encodes uncertainty tier */}
      <circle cx={x} cy={y} r={SN_R+3} fill="none" stroke={rc}
        strokeWidth={bdg?1.2:0.5} strokeDasharray={dash} opacity={bdg?0.7:0.3}/>
      {/* Main circle */}
      <circle cx={x} cy={y} r={SN_R} fill="white" stroke={rc} strokeWidth={1.2}/>
      {/* Centre dot */}
      <circle cx={x} cy={y} r={2.5} fill={rc} opacity={0.9}/>
      {/* Metabolite abbreviation below */}
      <text x={x} y={y+SN_R+9} fontSize={7} fill={rc} textAnchor="middle"
        fontWeight={500} style={{pointerEvents:"none"}}>{shortLabel}</text>
      {/* Confidence corner badge — only for non-high */}
      {bdg&&(
        <g style={{pointerEvents:"none"}}>
          <circle cx={x+SN_R-1} cy={y-SN_R+1} r={4} fill={rc}/>
          <text x={x+SN_R-1} y={y-SN_R+4.5} fontSize={5.5} fill="white"
            textAnchor="middle" fontWeight={700}>
            {conf==='placeholder'?'!':conf==='low'?'~':'?'}
          </text>
        </g>
      )}
    </g>
  );
}

// Enzyme saturation pill — clickable, opens arrow tooltip for that enzyme
// SatPill: % only on map — enzyme name appears only in tooltip on click
function SatPill({sat, x, y, label, ak, onA, flux}){
  if(sat==null||sat<0.01) return null;
  const c = sat>0.75?"#E24B4A":sat>0.50?"#e0b000":"#1D9E75";
  const pct = (sat*100).toFixed(0)+"%";
  const pw = 20, ph = 11;
  return(
    <g style={{cursor:"pointer"}}
       onClick={e=>{e.stopPropagation(); ak&&onA&&onA(ak, x, y, flux??0);}}>
      <rect x={x-pw/2-4} y={y-ph/2-4} width={pw+8} height={ph+8} fill="transparent"/>
      <rect x={x-pw/2} y={y-ph/2} width={pw} height={ph} rx={ph/2}
        fill={c} opacity={0.12} stroke={c} strokeWidth={0.8}/>
      <text x={x} y={y+4} fontSize={7} fill={c} textAnchor="middle" fontWeight={600}>{pct}</text>
    </g>
  );
}

function CompBox({x,y,w,h,comp,label}){
  const cs=COL[comp];
  return(<g><rect x={x} y={y} width={w} height={h} rx={8} fill={cs.fill} stroke={cs.stroke} strokeWidth={0.9} opacity={0.93}/><text x={x+10} y={y+13} fontSize={8} fill={cs.stroke} fontWeight={600}>{label}</text></g>);
}

// Dark floating tooltip — coloured top band + uncertainty section
function Tip({info,x,y,W,onClose}){
  if(!info) return null;
  const hasUnc = !!(info.unc || info.conf);
  const tw=225, th=(info.rxn?148:88)+(hasUnc?40:0);
  const tx=Math.min(x+10, W-tw-6), ty2=Math.max(y-th/2, 4);
  const cc = CONF[info.conf] ?? "#555";
  return(
    <g onClick={e=>e.stopPropagation()}>
      <rect x={tx} y={ty2} width={tw} height={th} rx={6} fill="#1a1f27" stroke="#3a3f48" strokeWidth={0.7} opacity={0.97}/>
      <rect x={tx} y={ty2} width={tw} height={5} rx={3} fill={cc} opacity={0.85}/>
      <text x={tx+8} y={ty2+17} fontSize={9} fill="#fff" fontWeight={600}>{info.name}</text>
      {info.ec&&<text x={tx+8} y={ty2+28} fontSize={7} fill="#7ec9a6">EC {info.ec}</text>}
      {info.f&&!info.ec&&<text x={tx+8} y={ty2+28} fontSize={7.5} fill="#aed6c4">{info.f}</text>}
      {info.rxn&&<text x={tx+8} y={ty2+39} fontSize={7} fill="#c8c8c8">{info.rxn}</text>}
      {info.r&&<foreignObject x={tx+6} y={ty2+(info.rxn?48:32)} width={tw-12} height={info.rxn?52:44}>
        <div xmlns="http://www.w3.org/1999/xhtml" style={{fontSize:7.5,color:"#ccc",lineHeight:1.45}}>{info.r}</div>
      </foreignObject>}
      {info.up&&<>
        <foreignObject x={tx+6} y={ty2+52} width={tw-12} height={36}>
          <div xmlns="http://www.w3.org/1999/xhtml" style={{fontSize:7,color:"#6fdd92",lineHeight:1.4}}>▲ {info.up}</div>
        </foreignObject>
        <foreignObject x={tx+6} y={ty2+90} width={tw-12} height={36}>
          <div xmlns="http://www.w3.org/1999/xhtml" style={{fontSize:7,color:"#f48080",lineHeight:1.4}}>▼ {info.down}</div>
        </foreignObject>
      </>}
      {info.flux!=null&&<text x={tx+8} y={ty2+th-(hasUnc?43:8)} fontSize={7} fill="#555">flux: {info.flux.toFixed(3)} µmol/m²/s</text>}
      {hasUnc&&<>
        <rect x={tx+4} y={ty2+th-38} width={tw-8} height={34} rx={3} fill={cc} opacity={0.08}/>
        <rect x={tx+4} y={ty2+th-38} width={tw-8} height={34} rx={3} stroke={cc} strokeWidth={0.4} fill="none"/>
        <text x={tx+8} y={ty2+th-27} fontSize={6} fill={cc} fontWeight={700} opacity={0.9}>{CONF_LABEL[info.conf]??""}</text>
        <foreignObject x={tx+6} y={ty2+th-24} width={tw-12} height={20}>
          <div xmlns="http://www.w3.org/1999/xhtml" style={{fontSize:6.5,color:"#aaa",lineHeight:1.35}}>{info.unc}</div>
        </foreignObject>
      </>}
      <text x={tx+tw-10} y={ty2+17} fontSize={12} fill="#666" style={{cursor:"pointer"}} onClick={onClose}>×</text>
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

function Sld({k,val,set,min,max,step=1,label,unit,color,tip}){
  return(
    <div style={{marginBottom:6}} title={tip}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:9.5,marginBottom:1}}>
        <span style={{fontWeight:500,color:color||"var(--color-text-primary)"}}>{label}</span>
        <span style={{fontWeight:600,color:color||"var(--color-text-primary)"}}>{val}{unit}</span>
      </div>
      {tip&&<div style={{fontSize:7.5,color:"var(--color-text-tertiary)",marginBottom:2,lineHeight:1.3}}>{tip}</div>}
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
// Default params — all from model_full PARAM_DEFAULTS
const PAR_DEF={
  Vcmax25:120, Srel25:2590, ci_ca:0.70, Cc_Ci:0.80,
  PGLP_Vmax25:300, PGLP_Km_2PG:0.272,
  GOX_Km_gly:0.210, GDC_Km_gly:3.5,
  Ki_TPI:0.066, Ki_SBPase:0.200,
  bypass_enzyme_Vmax25:5, bypass_Km_glycolate:0.04,
  refix_efficiency:0.60,
};
// Slider confidence: 'high'=[At✓] green, 'medium'=[C3/sp] yellow,
// 'low'=[est] orange, 'placeholder'=[usr⚠] red
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

// CONF_COL = CONF (defined at line 528 — same values)

export default function App(){
  const [env,setEnv]=useState(ENV_DEF);
  const [par,setPar]=useState(PAR_DEF);
  const [bypassType,setBypassType]=useState('kebeish'); // 'kebeish'|'cbhac'
  const [bypassActive,setBypassActive]=useState(false);
  const [scenario,setScenario]=useState('WT');
  const [moduleTab,setModuleTab]=useState('core'); // 'core'|'pr'|'bypass'|'advanced'
  const [rightTab,setRightTab]=useState('metrics');
  const [showKinSliders,setShowKinSliders]=useState(false);
  const [activeInfo,setActiveInfo]=useState(null);
  const [showLegend,setShowLegend]=useState(false);
  const [showLit,setShowLit]=useState(false);
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState({x:0,y:0});
  const [tip,setTip]=useState(null);
  const dragging=useRef(false);
  const dragStart=useRef(null);
  const containerRef=useRef(null);

  const switchModule = (tab) => {
    setModuleTab(tab);
    if (tab==='core')     setRightTab('metrics');
    if (tab==='pr')       setRightTab('pools');
    if (tab==='bypass')   setRightTab('bypass');
    if (tab==='advanced') setRightTab('metrics');
  };
  const setE=(k,v)=>setEnv(e=>({...e,[k]:v}));
  const setP=(k,v)=>setPar(p=>({...p,[k]:v}));

  // Apply scenario — overrides par but keeps env
  const applyScenario = (name) => {
    setScenario(name);
    const sc = SCENARIOS[name];
    if (!sc) return;
    const sp = sc.params;
    setPar(p => ({...PAR_DEF, ...p,
      ...(sp.PGLP_Vmax25 !== undefined ? {PGLP_Vmax25: sp.PGLP_Vmax25} : {}),
      ...(sp.GDC_Vmax25  !== undefined ? {GDC_Vmax25:  sp.GDC_Vmax25}  : {}),
      ...(sp.bypass_enzyme_Vmax25 !== undefined ? {bypass_enzyme_Vmax25: sp.bypass_enzyme_Vmax25} : {}),
    }));
    if (sp.bypass_active) { setBypassActive(true); setBypassType(sp.bypass_type ?? 'kebeish'); }
    else { setBypassActive(false); }
  };

  const m=useMemo(()=>runModel(env,{
    ...par,
    Tp25: (par.Tp25??0) > 0 ? par.Tp25 : null,
    bypass_active: bypassActive,
    bypass_type:   bypassType,
  }),[env,par,bypassActive,bypassType]);

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
  const SVG_W = 600;
  const stromaH = (bypassActive && (moduleTab==='bypass'||moduleTab==='advanced'))
    ? (bypassType==='mcg' ? 250 : 230) : 138;
  const NW=72, NH=22;

  // Peroxisome: directly below glycolate (left). Mitochondria: right of perox, same y.
  const PEROX_X = 4,   PEROX_W = 310, PEROX_Y = 16+stromaH+8, PEROX_H = 130;
  const MITO_X  = PEROX_X+PEROX_W+10, MITO_W = 200, MITO_Y = PEROX_Y, MITO_H = PEROX_H;
  const cytoY = PEROX_Y+PEROX_H+10, cytoH = 38;
  const showCyto = bypassActive && (bypassType==='cbhac'||bypassType==='south');
  const SVG_H = showCyto ? cytoY+cytoH+14 : PEROX_Y+PEROX_H+22;
  const compsY = PEROX_Y, compH = PEROX_H;
  const PEROX_OFF = PEROX_Y+18, PEROX_OFF2 = PEROX_Y+54;

  const nd={
    co2:[10,38], rubp:[140,38], pg3:[280,38], g3p:[420,38],
    pg2:[140,96], glycolate:[10,96],
    glyox_k:[100,175], tartr:[230,175], glycer_k:[360,175],
    // Peroxisome — left, below glycolate
    glyoxy:   [PEROX_X+12,            PEROX_Y+20],   // glycolate arrives (top-left)
    glycine:  [PEROX_X+PEROX_W-NW-12, PEROX_Y+20],   // glycine leaves to mito (top-right)
    glycerate:[PEROX_X+12+NW+16,      PEROX_Y+88],   // glycerate returns — offset right of glyoxy
    hpp:      [PEROX_X+PEROX_W-NW-12, PEROX_Y+88],   // hpp (bot-right)
    // Mitochondria — right of perox, same y
    gly_m:  [MITO_X+8,            MITO_Y+18],
    serine: [MITO_X+MITO_W-NW-8,  MITO_Y+18],
    nh3:    [MITO_X+8,            MITO_Y+54],
  };
  const cx=k=>nd[k][0]+NW/2, cy=k=>nd[k][1]+NH/2;
  const lx=k=>nd[k][0],      rx=k=>nd[k][0]+NW;
  const ty=k=>nd[k][1],      by=k=>nd[k][1]+NH;

  // Small dot nodes
  const sn={
    pg2:     [nd.pg2[0]-SR-2,      nd.pg2[1]+NH/2],
    glyox_k: [nd.glyox_k[0]+NW/2, nd.glyox_k[1]+NH/2],
    tartr:   [nd.tartr[0]+NW/2,    nd.tartr[1]+NH/2],
    glycer_k:[nd.glycer_k[0]+NW/2, nd.glycer_k[1]+NH/2],
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

      {/* ── Module tab bar ──────────────────────────────────────────────── */}
      <div style={{display:"flex",borderBottom:"0.5px solid var(--color-border-tertiary)",background:"var(--color-background-secondary)"}}>
        {[
          ['core',    '🌿 Core',            'Carbon fixation — the basics'],
          ['pr',      '🔄 Photorespiration', 'The oxygenation cycle and enzyme pools'],
          ['bypass',  '⚡ Bypass',           'Engineering routes to reduce photorespiration'],
          ['advanced','⚙ Advanced',         'Kinetic parameters, scenarios, uncertainty'],
        ].map(([t,l,tip])=>(
          <button key={t} onClick={()=>switchModule(t)} title={tip}
            style={{flex:1,padding:"8px 4px",fontSize:9.5,cursor:"pointer",fontWeight:moduleTab===t?600:400,
              background:moduleTab===t?"var(--color-background-primary)":"transparent",
              border:"none",borderBottom:moduleTab===t?"2px solid var(--color-text-primary)":"2px solid transparent",
              color:moduleTab===t?"var(--color-text-primary)":"var(--color-text-secondary)"}}>
            {l}
          </button>
        ))}
      </div>

      {/* Module description */}
      <div style={{padding:"4px 14px",fontSize:8,color:"var(--color-text-tertiary)",borderBottom:"0.5px solid var(--color-border-tertiary)",minHeight:22}}>
        {moduleTab==='core'&&    "What you're seeing: CO₂ fixed by RuBisCO (green arrows) vs RuBisCO activity. Sliders change the environment. Right panel shows the key outputs."}
        {moduleTab==='pr'&&      "Photorespiration: when RuBisCO grabs O₂ instead of CO₂, carbon goes on a costly detour through peroxisome and mitochondria (orange arrows). Pools show how full each step is."}
        {moduleTab==='bypass'&&  "Bypass engineering: transgenic routes that short-circuit the photorespiratory loop, saving energy. Select a design — all Vmax values are placeholders until you measure them."}
        {moduleTab==='advanced'&&"Tune the kinetic constants that drive the model. Confidence colour: green=[At✓], yellow=[C3/sp], orange=[est], red=[usr⚠]. Scenario buttons apply published genotype parameters."}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"175px 1fr 195px"}}>

        {/* Left panel */}
        <div style={{padding:"8px 10px",borderRight:"0.5px solid var(--color-border-tertiary)",overflowY:"auto"}}>

          {/* ── CORE: environment + Vcmax ─────────────────────────── */}
          {(moduleTab==='core'||moduleTab==='pr'||moduleTab==='bypass'||moduleTab==='advanced')&&<>
            <div style={{fontWeight:600,fontSize:9,color:"var(--color-text-secondary)",marginBottom:6,letterSpacing:0.4}}>ENVIRONMENT</div>
            <Sld k="co2"   val={env.co2}   set={setE} min={50}  max={1500} step={10} label="CO₂ concentration" unit=" ppm"       color={COL.cbb}
              tip="How much CO₂ is in the air. Normal air = 420 ppm. Higher = more fixation, less photorespiration."/>
            <Sld k="light" val={env.light} set={setE} min={0}   max={2000} step={50} label="Light (PAR)"        unit=" µmol/m²/s" color="#e07b00"
              tip="Photosynthetically active radiation. Drives electron transport (J) which regenerates the CO₂ acceptor RuBP."/>
            <Sld k="temp"  val={env.temp}  set={setE} min={5}   max={45}   step={1}  label="Temperature"        unit="°C"         color="#BA7517"
              tip="Affects all enzyme rates. Warmer = more photorespiration (RuBisCO selectivity for CO₂ falls with heat)."/>
            <Sld k="o2"    val={env.o2}    set={setE} min={2}   max={35}   step={0.5} label="O₂ level"          unit="%"          color={COL.pr}
              tip="Competes with CO₂ at the RuBisCO active site. Normal air = 21%. Higher = more oxygenation (photorespiration)."/>
          </>}

          {/* Core-specific extras */}
          {moduleTab==='core'&&<>
            <div style={{fontWeight:600,fontSize:9,color:"var(--color-text-secondary)",margin:"10px 0 6px",letterSpacing:0.4}}>RUBISCO CAPACITY</div>
            <Sld k="Vcmax25" val={par.Vcmax25} set={setP} min={40} max={200} step={5}
              label="Max carboxylation rate" unit=" µmol/m²/s" color={CONF.high}
              tip="The maximum speed of RuBisCO at 25°C. Measure this from an A/Ci curve in your material. Typical Arabidopsis: 100–140."/>
            <div style={{marginTop:8,padding:"6px 8px",background:"var(--color-background-secondary)",borderRadius:6,fontSize:8.5,lineHeight:2}}>
              <div style={{color:"var(--color-text-tertiary)",fontSize:8,marginBottom:3,fontWeight:500}}>COMPUTED FROM SLIDERS</div>
              {[["Net CO₂ fixed (A)",   m.A.toFixed(2),         "µmol/m²/s", m.A>=0?COL.cbb:"#E24B4A", "Carbon gained per m² of leaf per second"],
                ["Bottleneck",          m.limitState,           "",          m.limitState==="Rubisco"?"#533AB7":"#BA7517","Rubisco=need more CO₂. RuBP=need more light."],
                ["Electron transport",  m.J.toFixed(1),         "µmol/m²/s", "#e07b00","Rate of light-driven reactions"],
                ["RuBisCO rate (Vc)",   m.Vc.toFixed(2),        "µmol/m²/s", COL.cbb,"Actual carboxylation rate"],
                ["Oxygenation (Vo)",    m.Vo.toFixed(2),        "µmol/m²/s", COL.pr,"Rate of wasteful O₂ reactions"],
                ["CO₂ at chloroplast",  m.Cc.toFixed(0),        "µmol/mol",  "#555","Less than air CO₂ due to stomata + cell walls"],
              ].map(([l,v,u,c,tip])=>(
                <div key={l} title={tip} style={{display:"flex",justifyContent:"space-between",cursor:"default"}}>
                  <span style={{color:"var(--color-text-secondary)"}}>{l}</span>
                  <span style={{color:c,fontWeight:600}}>{v}<span style={{color:"var(--color-text-tertiary)",fontWeight:400,fontSize:7.5}}> {u}</span></span>
                </div>
              ))}
            </div>
            <div style={{marginTop:8}}>
              <div style={{fontWeight:600,fontSize:9,color:"var(--color-text-secondary)",marginBottom:5,letterSpacing:0.4}}>QUICK PRESETS</div>
              <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:4}}>
                {ECO_PRESETS.map(p=>(
                  <button key={p.n} onClick={()=>{setEnv({...p.e});setTip(null);}} title={p.note}
                    style={{padding:"2px 7px",borderRadius:5,fontSize:8,cursor:"pointer",
                      background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",
                      color:"var(--color-text-secondary)"}}>
                    {p.n}
                  </button>
                ))}
              </div>
            </div>
          </>}

          {/* ── PR: adds Pi + act sliders ─────────────────────────── */}
          {moduleTab==='pr'&&<>
            <Sld k="pi"  val={env.pi}  set={setE} min={0} max={100} step={5} label="Phosphate availability" unit="%" color="#1a6fb5"
              tip="Inorganic phosphate (Pi) is needed to export sugar from the chloroplast. Low Pi blocks export and slows photosynthesis."/>
            <Sld k="act" val={env.act} set={setE} min={20} max={100} step={5} label="RuBisCO activation"    unit="%" color={COL.cbb}
              tip="Fraction of RuBisCO that is active (carbamylated). Falls in darkness or stress. 100% = fully active."/>
            <div style={{marginTop:10,fontWeight:600,fontSize:9,color:"var(--color-text-secondary)",marginBottom:4,letterSpacing:0.4}}>PHOTORESPIRATION RATES</div>
            <div style={{padding:"6px 8px",background:"var(--color-background-secondary)",borderRadius:6,fontSize:8.5,lineHeight:2}}>
              {[["Oxygenations (Vo)",  m.Vo.toFixed(2),"µmol/m²/s",COL.pr,"How often RuBisCO grabs O₂ instead of CO₂"],
                ["Vo/Vc ratio",        m.vovc.toFixed(3),"—",COL.pr,"~0.3 = 30% of reactions wasteful. Rises with heat."],
                ["C lost to PR",       (m.carbon_loss_pct??0).toFixed(1),"%",COL.pr,"Carbon that takes the photorespiratory detour"],
                ["NH₃ released",       m.flux_NH3?.toFixed(2)??"—","µmol/m²/s","#888","Must be re-fixed at ATP cost"],
                ["Γ* (comp. point)",   m.gammastar.toFixed(1),"µmol/mol",COL.pr,"CO₂ level where oxygenation = carboxylation"],
              ].map(([l,v,u,c,tip])=>(
                <div key={l} title={tip} style={{display:"flex",justifyContent:"space-between",cursor:"default"}}>
                  <span style={{color:"var(--color-text-secondary)"}}>{l}</span>
                  <span style={{color:c,fontWeight:600}}>{v}<span style={{color:"var(--color-text-tertiary)",fontWeight:400,fontSize:7.5}}> {u}</span></span>
                </div>
              ))}
            </div>
          </>}

          {/* ── BYPASS ───────────────────────────────────────────── */}
          {moduleTab==='bypass'&&<>
            <div style={{fontWeight:600,fontSize:9,color:"var(--color-text-secondary)",margin:"8px 0 5px",letterSpacing:0.4}}>SELECT BYPASS DESIGN</div>
            <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:6}}>
              {[['kebeish','Kebeish (EcGlcDEF)','#7F77DD','Glycolate → CO₂ + 3-PGA in stroma. Published in Arabidopsis [At✓ 2007].'],
                ['south',  'South AP3 (CrGDH+CuMS)','#e07b00','Glycolate → malate via stroma. Field-tested in tobacco [sp:tobacco 2019]. ⚠ elevated glyoxylate risk.'],
                ['cbhac',  'cBHAC (CrGDH+BhcA-D)','#378ADD','Glycolate → OAA → malate or aspartate. In rice [sp:rice 2025].'],
                ['mcg',    'McG dual cycle (Lu 2025)','#1D9E75','Glycolate → acetyl-CoA + CO₂ fixation via Ppc. 3× biomass in Arabidopsis [At✓].'],
              ].map(([bt,label,c,desc])=>(
                <button key={bt} onClick={()=>{setBypassType(bt);setBypassActive(true);setScenario('');}}
                  style={{padding:"5px 8px",borderRadius:6,fontSize:8.5,cursor:"pointer",textAlign:"left",lineHeight:1.4,
                    background:bypassActive&&bypassType===bt?c+'18':"var(--color-background-secondary)",
                    border:`1px solid ${bypassActive&&bypassType===bt?c:"var(--color-border-tertiary)"}`,
                    color:bypassActive&&bypassType===bt?c:"var(--color-text-secondary)"}}>
                  <div style={{fontWeight:600,marginBottom:2}}>{bypassActive&&bypassType===bt?'✓ ':''}{label}</div>
                  <div style={{fontSize:7.5,color:"var(--color-text-tertiary)",fontWeight:400}}>{desc}</div>
                </button>
              ))}
              <button onClick={()=>{setBypassActive(false);setScenario('WT');}}
                style={{padding:"3px 8px",borderRadius:5,fontSize:8,cursor:"pointer",textAlign:"left",
                  background:"transparent",border:"0.5px solid var(--color-border-tertiary)",
                  color:"var(--color-text-tertiary)"}}>
                ✕ No bypass (wild type)
              </button>
            </div>
            {bypassActive&&<>
              {/* ── CrGDH / GcL: the key diversion step ─────────────────── */}
              <div style={{padding:"8px 10px",borderRadius:7,marginBottom:8,
                border:`1.5px solid ${bypassType==='kebeish'?COL.keb:bypassType==='south'?"#e07b00":bypassType==='mcg'?"#1D9E75":"#378ADD"}`,
                background:`${bypassType==='kebeish'?COL.keb:bypassType==='south'?"#e07b00":bypassType==='mcg'?"#1D9E75":"#378ADD"}0d`}}>
                <div style={{fontWeight:700,fontSize:10,marginBottom:2,
                  color:bypassType==='kebeish'?COL.keb:bypassType==='south'?"#e07b00":bypassType==='mcg'?"#1D9E75":"#378ADD"}}>
                  {bypassType==='kebeish'?'GcL (EcGlcDH)':'CrGDH'} — glycolate oxidation
                </div>
                <div style={{fontSize:8,color:"var(--color-text-secondary)",marginBottom:6,lineHeight:1.5}}>
                  This enzyme oxidises glycolate → glyoxylate <strong>in the stroma</strong>,
                  diverting it away from the peroxisome. Its Vmax and Km set how much
                  glycolate is intercepted. Both are <span style={{color:"#E24B4A"}}>unmeasured in Arabidopsis</span> — values below are estimates.
                </div>

                {/* Live diversion gauge */}
                <div style={{marginBottom:6}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:8.5,marginBottom:3}}>
                    <span style={{color:"var(--color-text-secondary)"}}>Glycolate diverted to bypass</span>
                    <span style={{fontWeight:700,
                      color:bypassType==='kebeish'?COL.keb:bypassType==='south'?"#e07b00":bypassType==='mcg'?"#1D9E75":"#378ADD"}}>
                      {(m.bypass_fraction*100).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{height:8,borderRadius:4,background:"var(--color-background-secondary)",overflow:"hidden"}}>
                    <div style={{
                      height:"100%",borderRadius:4,transition:"width 0.2s",
                      background:bypassType==='kebeish'?COL.keb:bypassType==='south'?"#e07b00":bypassType==='mcg'?"#1D9E75":"#378ADD",
                      width:`${Math.min(m.bypass_fraction*100,100)}%`}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:7,color:"var(--color-text-tertiary)",marginTop:1}}>
                    <span>→ peroxisome: {(m.native_GOX_flux??0).toFixed(2)} µmol/m²/s</span>
                    <span>→ bypass: {(m.bypass_flux??0).toFixed(2)} µmol/m²/s</span>
                  </div>
                </div>

                {/* Vmax slider — the main control */}
                <Sld k="bypass_enzyme_Vmax25" val={par.bypass_enzyme_Vmax25??5} set={setP}
                  min={0} max={30} step={0.5}
                  label="Max enzyme speed (Vmax) ⚠ unmeasured"
                  unit=" µmol/m²/s"
                  color={CONF.placeholder}
                  tip="Raise this to divert more glycolate. At Vmax=5 (default placeholder) only ~10% is intercepted because the glycolate pool is much smaller than the Km. Measure in leaf extracts of your transgenic lines."/>

                {/* Km slider — equally important */}
                <Sld k="bypass_Km_glycolate" val={par.bypass_Km_glycolate??
                  (bypassType==='kebeish'?0.04:0.30)} set={setP}
                  min={0.01} max={0.50} step={0.01}
                  label="Km for glycolate ⚠ estimated"
                  unit=" mM"
                  color={CONF.placeholder}
                  tip={bypassType==='kebeish'
                    ?"Kebeish: Km=0.04mM [sp:E.coli Lord 1972]. Glycolate pool ~0.02mM — enzyme is substrate-limited. Lower Km = more efficient diversion."
                    :"CrGDH: Km=0.30mM [sp:Chlamydomonas est]. Glycolate pool ~0.02mM — only ~6% saturation at default. Lowering Km dramatically increases diversion."}/>

                {/* Current saturation note */}
                <div style={{fontSize:7.5,color:"var(--color-text-tertiary)",lineHeight:1.5,marginTop:2,padding:"3px 5px",background:"#0001",borderRadius:3}}>
                  Pool/Km = {((m.glycolate_pool??0.02)/(par.bypass_Km_glycolate??(bypassType==='kebeish'?0.04:0.30))*100).toFixed(0)}% saturation
                  — enzyme running at {((m.bypass_flux??0)/Math.max(par.bypass_enzyme_Vmax25??5,0.01)*100).toFixed(0)}% of Vmax.
                  {(m.glycolate_pool??0.02)<(par.bypass_Km_glycolate??(bypassType==='kebeish'?0.04:0.30))
                    ?" Pool << Km: linear regime — Vmax and Km both limit equally."
                    :" Pool ≈ Km: Vmax is the main limit."}
                </div>
              </div>

              {bypassType==='south'&&<>
                <Sld k="malate_decarb_fraction" val={par.malate_decarb_fraction??0.70} set={setP}
                  min={0.30} max={1.00} step={0.05}
                  label="Malate → CO₂ via NADP-ME" unit="" color={CONF.low}
                  tip="Fraction of malate decarboxylated back to CO₂ by NADP-ME. Remainder exported via malate valve (DiT1)."/>
                <Sld k="plgg1_suppression" val={par.plgg1_suppression??0} set={setP}
                  min={0} max={0.80} step={0.05}
                  label="PLGG1 suppression (RNAi)" unit="" color={CONF.low}
                  tip="South 2019 suppressed PLGG1 (glycolate exporter) to retain more glycolate in the chloroplast for the bypass."/>
              </>}
              {bypassType==='mcg'&&<>
                <Sld k="pep_fraction" val={par.pep_fraction??0.10} set={setP}
                  min={0.02} max={0.20} step={0.01}
                  label="3PG → Mode B fraction ⚠" unit="" color={CONF.placeholder}
                  tip="Fraction of 3-PGA routed through Ppc for CO₂ fixation (Mode B). Highly uncertain — needs measurement."/>
              </>}
            </>}
          </>}

          {/* ── ADVANCED: kinetic parameters + scenarios ─────────── */}
          {moduleTab==='advanced'&&<>
            <div style={{fontWeight:600,fontSize:9,color:"var(--color-text-secondary)",marginBottom:4,letterSpacing:0.4}}>SCENARIOS</div>
            <div style={{fontSize:8,color:"var(--color-text-tertiary)",marginBottom:5,lineHeight:1.5}}>Apply a published genotype. Sets kinetic params automatically.</div>
            <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:10}}>
              {Object.entries(SCENARIOS).map(([name,sc])=>(
                <button key={name} onClick={()=>applyScenario(name)} title={sc.label}
                  style={{padding:"2px 6px",borderRadius:5,fontSize:8,cursor:"pointer",fontWeight:scenario===name?600:400,
                    background:scenario===name?"var(--color-background-primary)":"transparent",
                    border:`0.5px solid ${scenario===name?"var(--color-text-secondary)":"var(--color-border-tertiary)"}`,
                    color:scenario===name?"var(--color-text-primary)":"var(--color-text-secondary)"}}>
                  {name}
                </button>
              ))}
            </div>
            <div style={{fontWeight:600,fontSize:9,color:"var(--color-text-secondary)",marginBottom:3,letterSpacing:0.4}}>
              KINETIC PARAMETERS
              <span style={{fontWeight:400,fontSize:7.5,marginLeft:6}}>
                <span style={{color:CONF.high}}>■ At✓</span>{' '}
                <span style={{color:CONF.medium}}>■ C3/sp</span>{' '}
                <span style={{color:CONF.low}}>■ est</span>{' '}
                <span style={{color:CONF.placeholder}}>■ usr⚠</span>
              </span>
            </div>
            <Sld k="Vcmax25"     val={par.Vcmax25}      set={setP} min={40}    max={200}  step={5}    label="RuBisCO max speed (Vcmax₂₅)"   unit=" µmol/m²/s" color={CONF.high}     tip="Measure from A/Ci curve. Arabidopsis Col-0 typical: 100–140."/>
            <Sld k="Srel25"      val={par.Srel25??2590}  set={setP} min={2000}  max={2800} step={10}   label="RuBisCO CO₂/O₂ selectivity"    unit=" Pa/Pa"      color={CONF.low}      tip="[sp:spinach] How much better RuBisCO is at CO₂ vs O₂. Higher = less photorespiration. No Arabidopsis measurement."/>
            <Sld k="ci_ca"       val={par.ci_ca??0.70}   set={setP} min={0.60}  max={0.85} step={0.01} label="Stomatal CO₂ ratio (ci/ca)"     unit=""            color={CONF.low}      tip="Fraction of air CO₂ that gets inside the leaf. Depends on stomata opening. ~0.7 typical but varies with water stress."/>
            <Sld k="Cc_Ci"       val={par.Cc_Ci??0.80}   set={setP} min={0.65}  max={0.95} step={0.01} label="Mesophyll conductance (Cc/Ci)"  unit=""            color={CONF.low}      tip="Further CO₂ drop from cell wall to chloroplast. 1.0 = no resistance. Arabidopsis may be 0.70–0.80."/>
            <Sld k="PGLP_Vmax25" val={par.PGLP_Vmax25??300} set={setP} min={110} max={1200} step={10} label="PGLP1 phosphatase max speed ⚠"  unit=" µmol/m²/s" color={CONF.placeholder} tip="⚠ No reliable Arabidopsis measurement. PGLP1 removes 2-PG (toxic oxygenation product). Reduce to simulate pglp1 mutant."/>
            <Sld k="PGLP_Km_2PG" val={par.PGLP_Km_2PG??0.272} set={setP} min={0.025} max={0.57} step={0.005} label="PGLP1 affinity for 2-PG" unit=" mM"       color={CONF.medium}   tip="[sp:rice] How concentrated 2-PG must be before PGLP1 works at half speed. Lower = more efficient enzyme."/>
            <Sld k="GOX_Km_gly"  val={par.GOX_Km_gly??0.210} set={setP} min={0.15} max={0.35} step={0.005} label="GOX affinity for glycolate" unit=" mM"       color={CONF.high}     tip="[At✓ AtGOX1 Jossier 2019] Glycolate oxidase half-saturation. Lower = works at lower glycolate concentrations."/>
            <Sld k="GDC_Km_gly"  val={par.GDC_Km_gly??3.5}   set={setP} min={3.0}  max={7.0}  step={0.1}  label="GDC affinity for glycine ⚠" unit=" mM"       color={CONF.medium}   tip="[sp:pea] Glycine decarboxylase half-saturation. No Arabidopsis measurement. High value means GDC needs lots of glycine to run fast."/>
            <Sld k="Ki_TPI"      val={par.Ki_TPI??0.066}  set={setP} min={0.04}  max={0.12} step={0.002} label="2-PG inhibition of TPI"      unit=" mM"        color={CONF.medium}   tip="[sp:spinach] When 2-PG rises above this, it slows triose-phosphate isomerase. This is Loop 1 feedback."/>
            <Sld k="Ki_SBPase"   val={par.Ki_SBPase??0.200} set={setP} min={0.08} max={0.40} step={0.01} label="2-PG inhibition of SBPase"   unit=" mM"        color={CONF.low}      tip="[est] When 2-PG rises, it also slows sedoheptulose bisphosphatase — reducing RuBP regeneration."/>
            <Sld k="Tp25"        val={par.Tp25??0}        set={setP} min={0}     max={20}   step={0.5}  label="TPU limit (0 = off)"          unit=" µmol/m²/s" color={CONF.low}      tip="Triose-phosphate utilisation limit. Only visible at very high CO₂ + saturating light. Set ~10 for Arabidopsis. Off by default."/>
          </>}

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

              {/* Compartments — stroma border colour encodes redox pressure */}
              {(()=>{
                const rp = m.redox_pressure;
                const stromaStroke = rp > 0.65 ? "#E24B4A" : rp < 0.35 ? "#1D9E75" : "#BA7517";
                return <>
                  <rect x={4} y={16} width={SVG_W-8} height={stromaH} rx={8}
                    fill="#eaf7f1" stroke={stromaStroke} strokeWidth={0.9} opacity={0.93}/>
                  <text x={14} y={28} fontSize={8} fill={stromaStroke} fontWeight={600}>Chloroplast stroma</text>
                  {rp>0.65&&<text x={14} y={39} fontSize={6.5} fill="#E24B4A">over-reduced ⚠</text>}
                </>;
              })()}
              {(moduleTab==='pr'||moduleTab==='bypass'||moduleTab==='advanced')&&<>
              <CompBox x={PEROX_X} y={PEROX_Y} w={PEROX_W} h={PEROX_H} comp="perox" label="Peroxisome"/>
              <CompBox x={MITO_X}  y={MITO_Y}  w={MITO_W}  h={MITO_H}  comp="mito"  label="Mitochondria"/>
              </>}

              {/* Transport labels shown as zone markers inside PR arrows block */}

              {/* All bypass types now live — MCG uses McG module */}

              {/* ── CBB cycle ───────────────────────────────────────────── */}
              <Arrow x1={rx("co2")}  y1={cy("co2")}  x2={lx("rubp")} y2={cy("rubp")} flux={m.Vc} color={COL.cbb} dashed ak="rubisco_c" conf="high" onA={onA}/>
              <Arrow x1={rx("rubp")} y1={cy("rubp")} x2={lx("pg3")}  y2={cy("pg3")}  flux={m.Vc} color={COL.cbb} dashed label="Vc" ak="rubisco_c" conf="high" onA={onA}/>
              <Arrow x1={rx("pg3")}  y1={cy("pg3")}  x2={lx("g3p")}  y2={cy("g3p")}  flux={m.Vc} color={COL.cbb} dashed label="3ATP 2NADPH" ak="pgk_gapdh" conf="high" onA={onA}/>
              <Arrow x1={cx("g3p")}  y1={ty("g3p")}  x2={cx("rubp")} y2={ty("rubp")} flux={m.Vc} color={COL.cbb} dashed label="regen" bend={-16} ak="regen" conf="high" onA={onA}/>

              {/* ── Oxygenation ─────────────────────────────────────────── */}
              <Arrow x1={cx("rubp")} y1={by("rubp")} x2={sn.pg2[0]}     y2={sn.pg2[1]-SR}    flux={m.Vo} color={COL.pr} dashed label="Vo" ak="rubisco_o" conf="medium" onA={onA}/>
              <Arrow x1={sn.pg2[0]+SR} y1={sn.pg2[1]} x2={lx("glycolate")} y2={cy("glycolate")} flux={m.Vo} color={COL.pr} dashed ak="pgpase" conf="placeholder" onA={onA}/>

              {/* ── Photorespiration arrows ─────────────────────────────── */}
              {(moduleTab==='pr'||moduleTab==='bypass'||moduleTab==='advanced')&&<>

                {/* 1. Glycolate → Perox (straight down, PLGG1) */}
                <Arrow x1={cx("glycolate")} y1={by("glycolate")}
                  x2={cx("glyoxy")} y2={ty("glyoxy")}
                  flux={m.native_GOX_flux} color={COL.pr} dashed
                  label="Glycolate→Perox" ak="gox_p" conf="high" onA={onA}/>

                {/* 2. Glycolate→Glyoxylate inside perox (GOX, horizontal right) */}
                <Arrow x1={rx("glyoxy")} y1={cy("glyoxy")}
                  x2={cx("glycine")-20} y2={cy("glyoxy")}
                  flux={m.native_GOX_flux} color={COL.pr} dashed
                  label="→Glyoxylate (GOX)" ak="gox_p" conf="high" onA={onA}/>

                {/* 3. Glyoxylate→Glycine (GGAT, continues right) */}
                <Arrow x1={cx("glycine")-20} y1={cy("glyoxy")}
                  x2={lx("glycine")} y2={cy("glycine")}
                  flux={m.flux_glycine/2} color={COL.pr} dashed
                  label="→Glycine (GGAT)" ak="ggat" conf="high" onA={onA}/>

                {/* 4. Glycine→Mito (GlyT, right out of perox) */}
                <Arrow x1={rx("glycine")} y1={cy("glycine")}
                  x2={lx("gly_m")} y2={cy("gly_m")}
                  flux={m.flux_glycine} color={COL.pr} dashed
                  label="Glycine→Mito (GlyT)"/>

                {/* 5. GDC: 2 Glycine → Serine + CO₂ + NH₃ (key mito step) */}
                <Arrow x1={rx("gly_m")} y1={cy("gly_m")}
                  x2={lx("serine")} y2={cy("serine")}
                  flux={m.flux_serine} color={COL.pr} dashed
                  label="2Gly→Ser+CO₂+NH₃ (GDC)" ak="gdc_shmt" conf="medium" onA={onA}/>

                {/* 6. CO₂ down from gly_m */}
                <Arrow x1={cx("gly_m")} y1={by("gly_m")}
                  x2={cx("gly_m")} y2={by("gly_m")+32}
                  flux={m.flux_CO2_rel} color="#bbb" dashed label="CO₂"/>

                {/* 7. NH₃ up from nh3 node */}
                <Arrow x1={cx("nh3")} y1={ty("nh3")}
                  x2={cx("nh3")} y2={ty("nh3")-32}
                  flux={m.flux_NH3} color={COL.nh3} dashed
                  label="NH₃→GS" ak="gsgo" conf="high" onA={onA}/>

                {/* 8. Serine→Perox (GlyT, straight left back) */}
                <Arrow x1={lx("serine")} y1={cy("serine")+8}
                  x2={rx("hpp")} y2={cy("hpp")}
                  flux={m.flux_serine} color={COL.pr} dashed
                  label="Ser→Perox (GlyT)"/>

                {/* 9. HPP→Glycerate inside perox (HPR1, horizontal left) */}
                <Arrow x1={lx("hpp")} y1={cy("hpp")}
                  x2={rx("glycerate")} y2={cy("glycerate")}
                  flux={m.flux_glycerate} color={COL.pr} dashed
                  label="→Glycerate (HPR1)" ak="hpr" conf="high" onA={onA}/>

                {/* 10. Glycerate→3-PGA via GLYK (phosphorylation, re-enters CBB) */}
                <Arrow x1={cx("glycerate")} y1={ty("glycerate")}
                  x2={cx("pg3")} y2={by("pg3")}
                  flux={m.flux_glycerate} color={COL.pr} dashed
                  label="→3-PGA (GLYK)" bend={-20}/>

              </>}

              {/* ── Bypass SVG — only in bypass / advanced modules ──────────── */}
              {(moduleTab==='bypass'||moduleTab==='advanced')&&bypassActive&&<>

                {/* ── KEBEISH ─────────────────────────────────────────────── */}
                {bypassType==='kebeish'&&<>
                  <Arrow x1={rx("glycolate")} y1={cy("glycolate")}
                    x2={sn.glyox_k[0]-SR} y2={sn.glyox_k[1]}
                    flux={m.bypass_flux} color={COL.keb} dashed label="GcL"
                    ak="gcl" conf="placeholder" onA={onA}/>
                  <SmallNode x={sn.glyox_k[0]} y={sn.glyox_k[1]} color={COL.keb} nk="glyox_k" label="Glyox." conf="placeholder" onN={onN}/>
                  <Arrow x1={sn.glyox_k[0]+SR} y1={sn.glyox_k[1]}
                    x2={sn.tartr[0]-SR} y2={sn.tartr[1]}
                    flux={m.flux_glyoxylate_k} color={COL.keb} dashed label="GlxR+CO₂" ak="glxr" conf="placeholder" onA={onA}/>
                  <Arrow x1={sn.tartr[0]} y1={sn.tartr[1]-SR}
                    x2={cx("co2")+10} y2={by("co2")}
                    flux={m.CO2_bypass} color="#bbb" dashed bend={-25}/>
                  <text x={(sn.tartr[0]+cx("co2"))/2-14} y={(sn.tartr[1]+by("co2"))/2} fontSize={6} fill="#bbb">CO₂</text>
                  <SmallNode x={sn.tartr[0]} y={sn.tartr[1]} color={COL.keb} nk="tartr" label="Tartr." conf="placeholder" onN={onN}/>
                  <Arrow x1={sn.tartr[0]+SR} y1={sn.tartr[1]}
                    x2={sn.glycer_k[0]-SR} y2={sn.glycer_k[1]}
                    flux={m.flux_tartronate} color={COL.keb} dashed label="TSR" ak="tsr" conf="placeholder" onA={onA}/>
                  <SmallNode x={sn.glycer_k[0]} y={sn.glycer_k[1]} color={COL.keb} nk="glycer_k" label="Glycer." conf="high" onN={onN}/>
                  <Arrow x1={sn.glycer_k[0]+SR} y1={sn.glycer_k[1]}
                    x2={cx("pg3")} y2={by("pg3")}
                    flux={m.flux_3pga_k} color={COL.keb} dashed label="→3-PGA (GLYK)" ak="glyk" conf="high" onA={onA} bend={-18}/>
                </>}

                {/* ── SOUTH: CrGDH → glyoxylate → CuMS → malate ────────── */}
                {bypassType==='south'&&<>
                  <Arrow x1={rx("glycolate")} y1={cy("glycolate")}
                    x2={sn.glyox_k[0]-SR} y2={sn.glyox_k[1]}
                    flux={m.bypass_flux} color="#e07b00" dashed label="CrGDH"
                    ak="cbhac_gdh" conf="placeholder" onA={onA}/>
                  <SmallNode x={sn.glyox_k[0]} y={sn.glyox_k[1]} color="#e07b00" nk="glyox_ap" label="Glyox." conf="placeholder" onN={onN}/>
                  <Arrow x1={sn.glyox_k[0]+SR} y1={sn.glyox_k[1]}
                    x2={sn.tartr[0]-SR} y2={sn.tartr[1]}
                    flux={m.malate_bypass} color="#e07b00" dashed label="CuMS→Malate"
                    ak="glxr" conf="placeholder" onA={onA}/>
                  <SmallNode x={sn.tartr[0]} y={sn.tartr[1]} color="#e07b00" nk="tartr" label="Malate" conf="placeholder" onN={onN}/>
                  {m.malate_decarboxylated>0.01&&
                    <Arrow x1={sn.tartr[0]+SR} y1={sn.tartr[1]}
                      x2={sn.glycer_k[0]-SR} y2={sn.tartr[1]}
                      flux={m.malate_decarboxylated} color="#bbb" dashed label="NADP-ME→CO₂"/>}
                  {m.malate_exported>0.01&&<>
                    <Arrow x1={sn.tartr[0]} y1={sn.tartr[1]+SR}
                      x2={sn.tartr[0]} y2={compsY-8}
                      flux={m.malate_exported} color="#e07b00" dashed/>
                    <text x={sn.tartr[0]+4} y={compsY-10} fontSize={6} fill="#e07b00">DiT1↓</text>
                  </>}
                </>}

                {/* ── cBHAC: CrGDH → glyoxylate → BhcA-D → OAA ────────── */}
                {bypassType==='cbhac'&&<>
                  <Arrow x1={rx("glycolate")} y1={cy("glycolate")}
                    x2={sn.glyox_k[0]-SR} y2={sn.glyox_k[1]}
                    flux={m.bypass_flux} color="#378ADD" dashed label="CrGDH"
                    ak="cbhac_gdh" conf="placeholder" onA={onA}/>
                  <SmallNode x={sn.glyox_k[0]} y={sn.glyox_k[1]} color="#378ADD" nk="glyox_ap" label="Glyox." conf="placeholder" onN={onN}/>
                  <Arrow x1={sn.glyox_k[0]+SR} y1={sn.glyox_k[1]}
                    x2={sn.tartr[0]-SR} y2={sn.tartr[1]}
                    flux={m.OAA_flux} color="#378ADD" dashed label="BhcA-D→OAA"
                    ak="cbhac_gdh" conf="placeholder" onA={onA}/>
                  <SmallNode x={sn.tartr[0]} y={sn.tartr[1]} color="#378ADD" nk="tartr" label="OAA" conf="placeholder" onN={onN}/>
                  {m.OAA_to_malate>0.01&&
                    <Arrow x1={sn.tartr[0]+SR} y1={sn.tartr[1]}
                      x2={sn.glycer_k[0]-SR} y2={sn.tartr[1]}
                      flux={m.OAA_to_malate} color="#378ADD" dashed label="MDH→Malate (DiT1)"
                      ak="cbhac_gdh" conf="placeholder" onA={onA}/>}
                  {m.OAA_to_aspartate>0.01&&<>
                    <Arrow x1={sn.tartr[0]} y1={sn.tartr[1]+SR}
                      x2={sn.tartr[0]} y2={compsY-8}
                      flux={m.OAA_to_aspartate} color="#9B4DCA" dashed/>
                    <text x={sn.tartr[0]+4} y={compsY-10} fontSize={6} fill="#9B4DCA">AspAT→Asp (DiT2)</text>
                  </>}
                </>}

                {/* ── McG: Kebeish chain + MTK/MCL branch below glyox_k ───
                     Glyoxylate branches:
                     → GCL (y=175, Kebeish-identical): Glyox→Tartr→Glycer→3-PGA
                     → MTK (y=210, McG-specific):       Glyox→MalylCoA→AcCoA→lipids */}
                {bypassType==='mcg'&&(()=>{
                  const brow = 212; // MTK/MCL sub-row — below glyox_k, between glyox and tartr x
                  const bx1  = sn.glyox_k[0]; // MalylCoA x (below glyox_k)
                  const bx2  = sn.tartr[0];    // AcCoA x (below tartr)
                  return(<>
                    {/* Entry: CrGDH → Glyoxylate */}
                    <Arrow x1={rx("glycolate")} y1={cy("glycolate")}
                      x2={sn.glyox_k[0]-SR} y2={sn.glyox_k[1]}
                      flux={m.bypass_flux} color="#1D9E75" dashed label="CrGDH"
                      ak="gcl" conf="placeholder" onA={onA}/>
                    <SmallNode x={sn.glyox_k[0]} y={sn.glyox_k[1]} color="#1D9E75" nk="glyox_ap" label="Glyox." conf="placeholder" onN={onN}/>

                    {/* ── GCL path (y=175, same as Kebeish) ─────────────────── */}
                    <Arrow x1={sn.glyox_k[0]+SR} y1={sn.glyox_k[1]}
                      x2={sn.tartr[0]-SR} y2={sn.tartr[1]}
                      flux={m.flux_tartronate_mcg} color="#1D9E75" dashed label="GCL+CO₂"
                      ak="glxr" conf="placeholder" onA={onA}/>
                    <Arrow x1={sn.tartr[0]} y1={sn.tartr[1]-SR}
                      x2={cx("co2")+10} y2={by("co2")}
                      flux={m.CO2_mcg} color="#bbb" dashed bend={-25}/>
                    <text x={(sn.tartr[0]+cx("co2"))/2-14} y={(sn.tartr[1]+by("co2"))/2} fontSize={6} fill="#bbb">CO₂</text>
                    <SmallNode x={sn.tartr[0]} y={sn.tartr[1]} color="#1D9E75" nk="glyox_k" label="Tartr." conf="placeholder" onN={onN}/>
                    <Arrow x1={sn.tartr[0]+SR} y1={sn.tartr[1]}
                      x2={sn.glycer_k[0]-SR} y2={sn.glycer_k[1]}
                      flux={m.flux_glycerate_mcg} color="#1D9E75" dashed label="TSR"
                      ak="tsr" conf="placeholder" onA={onA}/>
                    <SmallNode x={sn.glycer_k[0]} y={sn.glycer_k[1]} color="#1D9E75" nk="glycer_k" label="Glycer." conf="high" onN={onN}/>
                    <Arrow x1={sn.glycer_k[0]+SR} y1={sn.glycer_k[1]}
                      x2={cx("pg3")} y2={by("pg3")}
                      flux={m.flux_3pga_mcg} color="#1D9E75" dashed label="GK→3-PGA"
                      ak="glyk" conf="high" onA={onA} bend={-18}/>

                    {/* ── MTK/MCL path (y=212, below glyox_k) ──────────────── */}
                    {/* Branch down from glyox_k */}
                    <Arrow x1={sn.glyox_k[0]+NW/2} y1={sn.glyox_k[1]+SR}
                      x2={bx1+NW/2} y2={brow-SR}
                      flux={m.flux_malylCoA} color="#1D9E75" dashed label="MTK"/>
                    <SmallNode x={bx1} y={brow} color="#1D9E75" nk="tartr" label="MalylCoA" conf="placeholder" onN={onN}/>
                    {/* MCL → AcCoA (right along sub-row) */}
                    <Arrow x1={bx1+SR} y1={brow}
                      x2={bx2-SR} y2={brow}
                      flux={m.acetylCoA_modeA} color="#1D9E75" dashed label="MCL→AcCoA"
                      ak="gcl" conf="placeholder" onA={onA}/>
                    <SmallNode x={bx2} y={brow} color="#1D9E75" nk="glyox_ap" label="AcCoA" conf="placeholder" onN={onN}/>
                    {/* AcCoA → lipids */}
                    {m.acetylCoA_lipid>0.01&&
                      <Arrow x1={bx2+SR} y1={brow}
                        x2={sn.glycer_k[0]-SR} y2={brow}
                        flux={m.acetylCoA_lipid} color="#1D9E75" dashed label="→lipids"/>}

                    {/* Mode B annotation */}
                    {m.modeB_flux>0.01&&
                      <text x={bx1} y={brow+SR+14} fontSize={6.5} fill="#1D9E75">
                        Mode B: 3PGA→Ppc→OAA ({m.CO2_fixed_modeB.toFixed(2)} µmol CO₂ fixed/m²/s)
                      </text>}
                  </>);
                })()}

              </>}}

              {/* ── Large named nodes ────────────────────────────────────── */}
              {/* Stroma nodes — always visible */}
              {[["co2","CO₂","stroma"],["rubp","RuBP","stroma"],["pg3","3-PGA","stroma"],
                ["g3p","G3P","stroma"],["glycolate","Glycolate","stroma"],
              ].map(([k,l,c])=>(<Node key={k} x={nd[k][0]} y={nd[k][1]} label={l} comp={c}/>))}
              {/* Perox + mito nodes — only when PR/bypass/advanced */}
              {(moduleTab==='pr'||moduleTab==='bypass'||moduleTab==='advanced')&&
                [["glyoxy","Glycolate","perox"],["glycine","Glycine","perox"],
                 ["hpp","HPP","perox"],["glycerate","Glycerate","perox"],
                 ["gly_m","Gly (mito)","mito"],["serine","Serine","mito"],["nh3","NH₃","mito"],
                ].map(([k,l,c])=>(<Node key={k} x={nd[k][0]} y={nd[k][1]} label={l} comp={c}/>))
              }

              {/* ── Small dot nodes (clickable metabolites) ──────────────── */}
              <SmallNode x={sn.pg2[0]}      y={sn.pg2[1]}      color={COL.pr}  nk="pg2"     label="2-PG"   conf="medium" onN={onN}/>
              {/* glyoxP SmallNode removed — glycolate→glyoxylate conversion shown via arrow inside perox */}

              {/* Enzyme saturations shown in right panel — not on SVG to reduce clutter */}

              {/* ── Phase 2: cytosol strip + malate valve (cBHAC only) ───── */}
              {showCyto&&<>
                {/* Cytosol compartment */}
                <rect x={4} y={cytoY} width={SVG_W-8} height={cytoH} rx={6}
                  fill="#f0f4ff" stroke="#8899cc" strokeWidth={0.8} opacity={0.9}/>
                <text x={14} y={cytoY+12} fontSize={8} fill="#8899cc" fontWeight={600}>Cytosol</text>

                {/* DiT1 — malate export (OAA→malate via NADP-MDH, leaves via DiT1/OMT) */}
                {m.OAA_to_malate>0.01&&<>
                  <Arrow
                    x1={200} y1={compsY+110}
                    x2={200} y2={cytoY}
                    flux={m.OAA_to_malate} color="#378ADD" dashed
                    label="malate" ak="cbhac_gdh" conf="placeholder" onA={onA}/>
                  {/* malate node in cytosol */}
                  <rect x={164} y={cytoY+8} width={72} height={18} rx={4}
                    fill="#fff" stroke="#378ADD" strokeWidth={0.8} strokeDasharray="3 2"/>
                  <text x={200} y={cytoY+20} fontSize={8} fill="#378ADD"
                    textAnchor="middle" fontWeight={500}>Malate (cyt)</text>
                  <text x={164} y={cytoY+9} fontSize={6} fill="#378ADD">DiT1/OMT⇌</text>
                  {/* label: NADP-MDH step */}
                  <text x={208} y={compsY+122} fontSize={6.5} fill="#378ADD" opacity={0.8}>NADP-MDH</text>
                </>}

                {/* DiT2 — aspartate export (OAA→Asp via plastidic AspAT, exits via DiT2) */}
                {m.OAA_to_aspartate>0.01&&<>
                  <Arrow
                    x1={320} y1={compsY+110}
                    x2={320} y2={cytoY}
                    flux={m.OAA_to_aspartate} color="#9B4DCA" dashed
                    label="aspartate" ak="cbhac_gdh" conf="placeholder" onA={onA}/>
                  <rect x={284} y={cytoY+8} width={72} height={18} rx={4}
                    fill="#fff" stroke="#9B4DCA" strokeWidth={0.8} strokeDasharray="3 2"/>
                  <text x={320} y={cytoY+20} fontSize={8} fill="#9B4DCA"
                    textAnchor="middle" fontWeight={500}>Asp (cyt)</text>
                  <text x={284} y={cytoY+9} fontSize={6} fill="#9B4DCA">DiT2⇌</text>
                  <text x={328} y={compsY+122} fontSize={6.5} fill="#9B4DCA" opacity={0.8}>AspAT</text>
                </>}

                {/* OAA node in stroma (cBHAC product) */}
                <rect x={230} y={compsY+88} width={72} height={18} rx={4}
                  fill="#fff" stroke="#378ADD" strokeWidth={1.1} strokeDasharray="3 2"/>
                <text x={266} y={compsY+100} fontSize={8} fill="#378ADD"
                  textAnchor="middle" fontWeight={500}>OAA (str.)</text>
                <text x={231} y={compsY+89} fontSize={6} fill="#E24B4A">⚠ est.</text>

                {/* OAA fate split legend */}
                <text x={420} y={cytoY+14} fontSize={7} fill="#888">
                  OAA: {(m.OAA_flux??0).toFixed(2)} µmol/m²/s
                </text>
                <text x={420} y={cytoY+24} fontSize={7} fill="#378ADD">
                  → malate: {(m.OAA_to_malate??0).toFixed(2)}
                </text>
                <text x={420} y={cytoY+34} fontSize={7} fill="#9B4DCA">
                  → Asp: {(m.OAA_to_aspartate??0).toFixed(2)}
                </text>
              </>}
              {m.A<0&&(
                <g>
                  <rect x={4} y={compsY+115} width={SVG_W-8} height={20} rx={3} fill="#E24B4A14" stroke="#E24B4A" strokeWidth={0.6}/>
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

        {/* Right: tabbed panel */}
        <div style={{borderLeft:"0.5px solid var(--color-border-tertiary)",display:"flex",flexDirection:"column",minHeight:0}}>

          {/* Tab bar */}
          <div style={{display:"flex",borderBottom:"0.5px solid var(--color-border-tertiary)",flexShrink:0}}>
            {[['metrics','Metrics'],['bypass','Bypass'],['pools','Pools & Enz.']].map(([t,l])=>(
              <button key={t} onClick={()=>setRightTab(t)}
                style={{flex:1,padding:"5px 4px",fontSize:9,cursor:"pointer",fontWeight:rightTab===t?600:400,
                  background:rightTab===t?"var(--color-background-primary)":"transparent",
                  border:"none",borderBottom:rightTab===t?"2px solid var(--color-text-primary)":"2px solid transparent",
                  color:rightTab===t?"var(--color-text-primary)":"var(--color-text-secondary)"}}>
                {l}
              </button>
            ))}
          </div>

          {/* Uncertainty badge — always visible */}
          {(()=>{
            const ph=bypassActive&&par.bypass_enzyme_Vmax25===5;
            const lo=[par.Srel25===2590,par.ci_ca===0.70,par.Cc_Ci===0.80].filter(Boolean).length;
            const c=ph?"#E24B4A":lo>1?"#e07b00":"#1D9E75";
            return <div style={{padding:"3px 8px",fontSize:8,color:c,borderBottom:"0.5px solid var(--color-border-tertiary)",flexShrink:0}}>
              {ph?"⚠ bypass Vmax placeholder":lo>1?`${lo} estimated params`:"params ok"} · click arrows/nodes for details
            </div>;
          })()}

          <div style={{padding:"6px 8px",overflowY:"auto",flex:1}}>

          {/* ── TAB: METRICS ──────────────────────────────────────── */}
          {rightTab==='metrics'&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3,marginBottom:6}}>
              {[["Net A",m.A,"µmol/m²/s",m.A>=0?COL.cbb:"#E24B4A"],
                ["Limit",m.limitState,"—",m.limitState==="Rubisco"?"#533AB7":"#BA7517"],
                ["Wc",m.Wc,"µmol/m²/s","#533AB7"],
                ["Wj",m.Wj,"µmol/m²/s","#BA7517"],
                ["Vc",m.Vc,"µmol/m²/s",COL.cbb],
                ["Vo",m.Vo,"µmol/m²/s",COL.pr],
                ["Vo/Vc",m.vovc.toFixed(3),"—",COL.pr],
                ["J",m.J,"µmol/m²/s","#e07b00"],
                ["Γ*",(bypassActive?m.gammastar_eff:m.gammastar).toFixed(1),"µmol/mol",COL.pr],
                ["Rd",m.Rd,"µmol/m²/s","#BA7517"],
                ["dA fb",m.dA_feedback,"µmol/m²/s",m.dA_feedback<-0.5?"#E24B4A":"#888"],
                ["Trx f",(m.trxf_red*100).toFixed(0)+"%","—","#e07b00"],
                ...((par.Tp25??0)>0&&m.Wp!=null?[["Wp",m.Wp,"µmol/m²/s","#9B4DCA"]]:[]),
              ].map(([label,value,unit,color])=>(
                <MCard key={label} label={label} value={value} unit={unit} color={color}
                  onInfo={setActiveInfo} active={activeInfo===label}/>
              ))}
            </div>
            {/* Info popover */}
            <InfoPop metric={activeInfo} onClose={()=>setActiveInfo(null)}/>
            {/* Quick derived stats */}
            <div style={{fontSize:8.5,lineHeight:1.9,color:"var(--color-text-secondary)"}}>
              {[["A_fvCB",m.A_fvCB.toFixed(2),"µmol/m²/s","#888","Raw FvCB without feedback"],
                ["Cc",m.Cc.toFixed(0),"µmol/mol","#555","CO₂ at chloroplast"],
                ["Srel(T)",m.Srel?.toFixed(0)??"—","","#555","RuBisCO selectivity at T"],
                ["C lost",m.carbon_loss_pct?.toFixed(1)??"—","%",COL.pr,"Carbon lost to PR / Vc"],
                ["λ_eff",m.lambda_eff?.toFixed(3)??"0.500","—",COL.keb,"Effective λ (Busch 2020)"],
                ["redox",m.redox_pressure>0.65?"oxidised":m.redox_pressure<0.35?"reducing":"neutral","",
                  m.redox_pressure>0.65?"#E24B4A":m.redox_pressure<0.35?"#1D9E75":"#BA7517","Stromal redox state"],
              ].map(([l,v,u,c,tip])=>(
                <div key={l} title={tip} style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:"var(--color-text-tertiary)"}}>{l}</span>
                  <span style={{color:c,fontWeight:500}}>{v} <span style={{color:"var(--color-text-tertiary)",fontWeight:400,fontSize:7.5}}>{u}</span></span>
                </div>
              ))}
            </div>

            {/* Scenario comparison — collapsible */}
            <details style={{marginTop:8}}>
              <summary style={{fontSize:9,fontWeight:500,color:"var(--color-text-secondary)",cursor:"pointer",userSelect:"none",marginBottom:4}}>
                ▶ Compare all scenarios
              </summary>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:7.5}}>
                  <thead>
                    <tr style={{borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
                      {["Scenario","A","bp%","⚠"].map(h=>(
                        <th key={h} style={{textAlign:"left",padding:"2px 3px",color:"var(--color-text-secondary)",fontWeight:500}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compareScenarios(Object.keys(SCENARIOS),env).map(r=>(
                      <tr key={r.scenario} onClick={()=>applyScenario(r.scenario)}
                        style={{borderBottom:"0.5px solid var(--color-border-tertiary)",
                          background:r.scenario===scenario?"var(--color-background-secondary)":"transparent",
                          cursor:"pointer"}}>
                        <td style={{padding:"2px 3px",color:r.scenario===scenario?"var(--color-text-primary)":"var(--color-text-secondary)",fontWeight:r.scenario===scenario?600:400,fontSize:7}}>{r.scenario}</td>
                        <td style={{padding:"2px 3px",color:COL.cbb,fontWeight:500}}>{r.A.toFixed(1)}</td>
                        <td style={{padding:"2px 3px",color:COL.keb}}>{r.bypass_fraction>0?(r.bypass_fraction*100).toFixed(0)+"%":"—"}</td>
                        <td style={{padding:"2px 3px",color:"#E24B4A"}}>{r.bypass_placeholder?"⚠":""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            {/* Uncertainty log — collapsible */}
            <details style={{marginTop:6}}>
              <summary style={{fontSize:9,fontWeight:500,color:"var(--color-text-secondary)",cursor:"pointer",userSelect:"none"}}>
                ▶ Uncertainty log
              </summary>
              <div style={{fontSize:8,lineHeight:1.7,marginTop:4}}>
                {[
                  {key:"bypass_enzyme_Vmax25",val:par.bypass_enzyme_Vmax25??5,conf:"placeholder",label:"Bypass Vmax",fix:"Measure enzyme activity in leaf extracts of transgenic lines."},
                  {key:"PGLP_Vmax25",val:par.PGLP_Vmax25??300,conf:"placeholder",label:"PGLP1 Vmax",fix:"No reliable At leaf-scale measurement. Extract assay recommended."},
                  {key:"Srel25",val:par.Srel25??2590,conf:"low",label:"Srel₂₅",fix:"Spinach value [sp:spinach]. Use At-specific measurement if available."},
                  {key:"ci_ca",val:par.ci_ca??0.70,conf:"low",label:"ci/ca",fix:"Estimated. Measure under your conditions."},
                  {key:"GDC_Km_gly",val:par.GDC_Km_gly??3.5,conf:"medium",label:"GDC Km(Gly)",fix:"Pea value [sp:pea]. No At measurement published."},
                ].map(u=>(
                  <div key={u.key} style={{marginBottom:5,paddingBottom:4,borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:1}}>
                      <span style={{width:7,height:7,background:CONF[u.conf],borderRadius:"50%",display:"inline-block",flexShrink:0}}/>
                      <span style={{fontWeight:600,color:"var(--color-text-primary)",fontSize:8}}>{u.label}</span>
                      <span style={{color:"var(--color-text-tertiary)",marginLeft:"auto",fontSize:7.5}}>{typeof u.val==="number"?u.val.toFixed(3):u.val}</span>
                    </div>
                    <div style={{color:"var(--color-text-tertiary)",paddingLeft:11,fontSize:7.5}}>{u.fix}</div>
                  </div>
                ))}
              </div>
            </details>
          </>}

          {/* ── TAB: BYPASS ───────────────────────────────────────── */}
          {rightTab==='bypass'&&<>
            {!bypassActive&&<div style={{color:"var(--color-text-tertiary)",fontSize:9,padding:"12px 0",textAlign:"center"}}>
              Select a bypass type in the left panel to see outputs here.
            </div>}
            {bypassActive&&<>
              <div style={{fontWeight:600,fontSize:10,marginBottom:6,
                color:bypassType==='cbhac'?'#378ADD':bypassType==='south'?'#e07b00':bypassType==='mcg'?'#1D9E75':COL.keb}}>
                {bypassType==='kebeish'?'Kebeish (EcGlcDEF)':bypassType==='south'?'South 2019 (CrGDH+CuMS)':bypassType==='mcg'?'McG dual cycle (Lu 2025)':'cBHAC (CrGDH+BhcA-D)'}
              </div>

              {/* Core bypass outputs */}
              {(()=>{
                const rows = bypassType==='kebeish'?[
                  ["Glycolate bypassed", m.bypass_flux,       "µmol/m²/s", COL.keb],
                  ["% diverted",         m.bypass_fraction*100, "%",        COL.keb],
                  ["CO₂ rel. (GlxR)",   m.CO2_bypass,         "µmol/m²/s","#aaa"],
                  ["3-PGA returned",     m.flux_3pga_k,        "µmol/m²/s",COL.cbb],
                  ["NH₃ saved",          m.NH3_saving,         "µmol/m²/s",COL.nh3],
                  ["Native GOX",         m.native_GOX_flux,    "µmol/m²/s",COL.pr],
                  [m.bypass_placeholder?"A_bypass ⚠":"A_bypass", m.A_bypass,"µmol/m²/s", m.bypass_placeholder?"#e07b00":COL.cbb],
                ] : bypassType==='south'?[
                  ["Glycolate bypassed", m.bypass_flux,        "µmol/m²/s","#e07b00"],
                  ["% diverted",         m.bypass_fraction*100, "%",       "#e07b00"],
                  ["Malate produced",    m.malate_bypass,      "µmol/m²/s","#e07b00"],
                  ["→ NADP-ME (CO₂)",   m.malate_decarboxylated,"µmol/m²/s","#aaa"],
                  ["→ DiT1 export",      m.malate_exported,    "µmol/m²/s","#e07b00"],
                  ["NH₃ saved",          m.NH3_saving,         "µmol/m²/s",COL.nh3],
                  [m.bypass_placeholder?"A_bypass ⚠":"A_bypass", m.A_bypass,"µmol/m²/s",m.bypass_placeholder?"#e07b00":COL.cbb],
                ] : bypassType==='mcg'?[
                  ["Glycolate bypassed", m.bypass_flux,        "µmol/m²/s","#1D9E75"],
                  ["% diverted",         m.bypass_fraction*100, "%",       "#1D9E75"],
                  ["AcCoA total",        m.acetylCoA_total,    "µmol/m²/s","#1D9E75"],
                  ["  Mode A (gly)",     m.acetylCoA_modeA,    "µmol/m²/s","#1D9E75"],
                  ["  Mode B (3PG)",     m.acetylCoA_modeB,    "µmol/m²/s","#1D9E75"],
                  ["CO₂ fixed (B)",      m.CO2_fixed_modeB,    "µmol/m²/s",COL.cbb],
                  ["NH₃ saved",          m.NH3_saving,         "µmol/m²/s",COL.nh3],
                  [m.bypass_placeholder?"A_bypass ⚠":"A_bypass", m.A_bypass,"µmol/m²/s",m.bypass_placeholder?"#e07b00":COL.cbb],
                ] : [
                  ["Glycolate bypassed", m.bypass_flux,        "µmol/m²/s","#378ADD"],
                  ["% diverted",         m.bypass_fraction*100, "%",       "#378ADD"],
                  ["OAA flux",           m.OAA_flux,           "µmol/m²/s","#378ADD"],
                  ["→ malate (DiT1)",    m.OAA_to_malate,      "µmol/m²/s","#378ADD"],
                  ["→ aspartate (DiT2)", m.OAA_to_aspartate,   "µmol/m²/s","#9B4DCA"],
                  ["NH₃ saved",          m.NH3_saving,         "µmol/m²/s",COL.nh3],
                  [m.bypass_placeholder?"A_bypass ⚠":"A_bypass", m.A_bypass,"µmol/m²/s",m.bypass_placeholder?"#e07b00":COL.cbb],
                ];
                return rows.map(([l,v,u,c])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
                    <span style={{fontSize:8.5,color:String(l).includes("⚠")?"#e07b00":"var(--color-text-secondary)",flex:1}}>{l}</span>
                    <span style={{fontWeight:700,color:c,fontSize:9,minWidth:40,textAlign:"right"}}>{typeof v==="number"?v.toFixed(2):v}</span>
                    <span style={{fontSize:7.5,color:"var(--color-text-tertiary)",minWidth:36}}>{u}</span>
                  </div>
                ));
              })()}

              {/* Shared bypass metrics */}
              <div style={{marginTop:6,paddingTop:5,borderTop:"0.5px solid var(--color-border-tertiary)",fontSize:8.5,lineHeight:1.9}}>
                {[["Γ*_eff",m.gammastar_eff?.toFixed(1)??"—","µmol/mol",COL.pr],
                  ["λ_eff",m.lambda_eff?.toFixed(3)??"—","—",COL.keb],
                  ["Native GOX",m.native_GOX_flux?.toFixed(2)??"—","µmol/m²/s",COL.pr],
                ].map(([l,v,u,c])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:"var(--color-text-tertiary)"}}>{l}</span>
                    <span style={{color:c,fontWeight:500}}>{v} <span style={{color:"var(--color-text-tertiary)",fontWeight:400,fontSize:7.5}}>{u}</span></span>
                  </div>
                ))}
              </div>

              {/* Risk flags */}
              {(m.risk_glyoxylate>0.5||m.risk_OAA>0.5)&&(
                <div style={{marginTop:5,padding:"4px 6px",background:"#E24B4A0d",border:"0.5px solid #E24B4A55",borderRadius:4,fontSize:8}}>
                  <div style={{fontWeight:600,color:"#E24B4A",marginBottom:2}}>⚠ Risk flags</div>
                  {m.risk_glyoxylate>0.5&&<div style={{color:"#E24B4A"}}>Glyoxylate: {(m.risk_glyoxylate*100).toFixed(0)}% — approaching RuBisCO Ki</div>}
                  {m.risk_OAA>0.5&&<div style={{color:"#E24B4A"}}>OAA: {(m.risk_OAA*100).toFixed(0)}% — approaching AspAT capacity</div>}
                </div>
              )}

              {/* Bypass note */}
              <div style={{marginTop:6,fontSize:7.5,color:"var(--color-text-tertiary)",lineHeight:1.5}}>{m.bypass_note}</div>

              {/* Metabolic fates */}
              <div style={{marginTop:6,paddingTop:5,borderTop:"0.5px solid var(--color-border-tertiary)"}}>
                <div style={{fontSize:9,fontWeight:500,color:"var(--color-text-secondary)",marginBottom:4}}>METABOLIC FATES</div>
                {[["C → CBB", m.carbon_to_amino_acids,"µmol/m²/s",COL.cbb,"Carbon returned to Calvin cycle"],
                  ["C → FA",  m.carbon_to_fatty_acids,"µmol/m²/s","#1a6fb5","Carbon to fatty acids (McG)"],
                  ["C → AA",  m.carbon_to_amino_acids,"µmol/m²/s","#9B4DCA","Carbon to amino acids"],
                  ["C export",m.carbon_exported,      "µmol/m²/s","#BA7517","Carbon exported from chloroplast"],
                  ["N saved", m.nitrogen_conserved,   "µmol/m²/s",COL.nh3, "NH₃ not released"],
                ].filter(([,v])=>(v??0)>0.001).map(([l,v,u,c,tip])=>(
                  <div key={l} title={tip} style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontSize:8,color:"var(--color-text-secondary)"}}>{l}</span>
                    <span style={{fontSize:8.5,fontWeight:600,color:c}}>{(v??0).toFixed(3)} <span style={{fontWeight:400,fontSize:7,color:"var(--color-text-tertiary)"}}>{u}</span></span>
                  </div>
                ))}
              </div>
            </>}
          </>}

          {/* ── TAB: POOLS & ENZYMES ──────────────────────────────── */}
          {rightTab==='pools'&&<>
            {/* What kind of model is this? */}
            <div style={{padding:"6px 8px",background:"var(--color-background-secondary)",borderRadius:6,marginBottom:8,fontSize:8,lineHeight:1.7,borderLeft:"3px solid #378ADD"}}>
              <div style={{fontWeight:600,color:"var(--color-text-primary)",marginBottom:3}}>How pool sizes are computed</div>
              <div style={{color:"var(--color-text-secondary)"}}>
                This is a <strong>steady-state model</strong> — no ODEs, no time. Pool sizes are back-calculated
                from fluxes using the MM inverse: <code style={{fontSize:7.5,background:"#0001",padding:"0 3px",borderRadius:2}}>[S] = Km × v / (Vmax − v)</code>.
                This is valid at steady state. But most pools don't <em>set</em> the fluxes — the fluxes are imposed stoichiometrically.
                The two exceptions that genuinely feed back into A are <strong>pool_2PG</strong> (→ Wj via Loop 1)
                and <strong>glycolate_pool</strong> (→ bypass flux). The rest are useful for metabolomics comparison only.
              </div>
            </div>

            {/* Legend */}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:8,fontSize:7.5,color:"var(--color-text-tertiary)"}}>
              <span>🔗 feeds back into A</span>
              <span>📊 metabolomics reference only</span>
              <span style={{color:"#1D9E75"}}>[At✓] Arabidopsis</span>
              <span style={{color:"#e0b000"}}>[sp:X] other species</span>
              <span style={{color:"#e07b00"}}>[est] estimated</span>
              <span style={{color:"#E24B4A"}}>[usr⚠] unmeasured</span>
            </div>

            {/* Section: Active feedbacks — these actually change A */}
            <div style={{fontSize:9,fontWeight:600,color:"var(--color-text-primary)",marginBottom:2}}>🔗 Active feedbacks — change A</div>
            <div style={{fontSize:7.5,color:"var(--color-text-tertiary)",marginBottom:6,lineHeight:1.4}}>
              These pools/enzymes are wired into kinFeedback() and shift the final A value.
            </div>

            {[
              {label:"2-PG pool",
               val:m.pool_2PG, warn:0.020, col:"#533AB7",
               feedback:"Loop 1: inhibits TPI + SBPase → reduces Wj. Active now: Wj scaled by ×{f}",
               fval:m.pool_2PG>0?(1/(1+m.pool_2PG/0.066))*(1/(1+m.pool_2PG/0.200)):1,
               verif:"pool_2PG: [sp:rice] Km. Ki_TPI [sp:spinach]. Ki_SBPase [est]. Direction [At✓ Flügel 2017]",
               honest:"Meaningful in pglp1 mutants. Near-zero effect in WT at ambient CO₂."},
              {label:"Glycolate pool",
               val:m.glycolate_pool, warn:0.50, col:COL.pr,
               feedback:"Bypass substrate: higher glycolate pool → more bypass flux (when bypass active)",
               fval:null,
               verif:"GOX Km=0.210mM [At✓ AtGOX1 Jossier 2019]",
               honest:"Only feeds back when bypass is active. In WT, sets how much bypass could intercept."},
              {label:"Glycine pool",
               val:m.glycine_pool, warn:0.50, col:"#BA7517",
               feedback:"Loop 3: GDC_sat > 70% → glyoxylate back-inhibits Vcmax",
               fval:m.GDC_sat>0.70?1/(1+Math.pow((m.GDC_sat-0.70)/0.30,2)*0.15):1,
               verif:"GDC Vmax [At✓ Timm 2012]. GDC Km [sp:pea ⚠]. Ki scale [est ⚠]",
               honest:"Near-zero effect in WT. Activates only if GDC becomes genuinely rate-limiting (e.g. cold stress, GDC-OE lines)."},
              {label:"PGLP1 saturation",
               val:m.PGLP_sat, warn:0.80, col:"#533AB7",
               feedback:"Sets pool_2PG (above). PGLP_Vmax [usr⚠] — this is the critical uncertain parameter",
               fval:null,
               verif:"Trx f activation [At✓ Xi 2026]. Vmax [usr⚠ no At measurement]. Km [sp:rice]",
               honest:"The model's most consequential uncertain parameter. Lowering PGLP_Vmax raises 2-PG and reduces A via Loop 1."},
            ].map(u=>{
              const hi=u.val!=null&&u.val>u.warn;
              const scalePct = u.fval!=null ? `→ scales A by ×${u.fval.toFixed(3)}` : '';
              return(
                <div key={u.label} style={{marginBottom:8,padding:"6px 8px",borderRadius:5,
                  background:"var(--color-background-secondary)",
                  border:`0.5px solid ${hi?"#E24B4A":"var(--color-border-tertiary)"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:8.5,fontWeight:600,color:"var(--color-text-primary)"}}>{u.label}</span>
                    <span style={{fontSize:8.5,fontWeight:700,color:hi?"#E24B4A":u.col}}>
                      {u.val!=null?u.val.toFixed(4):u.PGLP_sat!=null?((u.PGLP_sat??0)*100).toFixed(0)+"%":"—"}
                      {hi&&" ⚠"}
                    </span>
                  </div>
                  {u.val!=null&&<div style={{background:"var(--color-background-primary)",borderRadius:2,height:4,marginBottom:4}}>
                    <div style={{width:`${Math.min((u.val/u.warn)*100,100)}%`,height:"100%",background:hi?"#E24B4A":u.col,borderRadius:2,transition:"width 0.2s"}}/>
                  </div>}
                  <div style={{fontSize:7.5,color:u.col,marginBottom:2}}>🔗 {u.feedback} {scalePct&&<span style={{color:"#555"}}>{scalePct}</span>}</div>
                  <div style={{fontSize:7,color:"#1D9E75",marginBottom:2}}>{u.verif}</div>
                  <div style={{fontSize:7,color:"var(--color-text-tertiary)",fontStyle:"italic"}}>{u.honest}</div>
                </div>
              );
            })}

            {/* Section: Reference only */}
            <div style={{fontSize:9,fontWeight:600,color:"var(--color-text-primary)",margin:"10px 0 2px"}}>📊 Reference only — don't change A</div>
            <div style={{fontSize:7.5,color:"var(--color-text-tertiary)",marginBottom:6,lineHeight:1.4}}>
              Computed for comparison with metabolomics data. Not wired into feedback loops.
            </div>

            {[
              {label:"Glyoxylate pool", val:m.glyoxylate_pool, col:"#c06030",
               verif:"GGAT Km=0.20mM [At✓ GGT1 Liepman 2003]. GGAT confirmed non-limiting.",
               note:"GGAT never rate-limiting in WT — pool changes don't affect A. Compare with metabolomics to validate model."},
              {label:"HP (hydroxypyruvate) pool", val:m.HP_pool, col:COL.pr,
               verif:"HPR1 Km=0.08mM [At✓]. HPR1 confirmed non-limiting (hpr1 mutant viable in air).",
               note:"HPR1 never rate-limiting — HP pool doesn't feed back. Use for metabolomics comparison only."},
              {label:"GOX saturation", val:m.GOX_sat, col:COL.pr,
               verif:"GOX Km=0.210mM [At✓ AtGOX1]. Vmax [At✓ est Jossier 2019].",
               note:"GOX sets the glycolate pool size which feeds the bypass. GOX_sat itself has no direct feedback — intermediate."},
              {label:"GGAT saturation", val:m.GGAT_sat, col:"#c06030",
               verif:"[At✓ non-limiting]. Confirmed in Arabidopsis — not a bottleneck.",
               note:"Shown for completeness. Never limits flux in WT — saturation level has no effect on A."},
              {label:"HPR1 saturation", val:m.HPR1_sat, col:COL.pr,
               verif:"[At✓ non-limiting]. hpr1 mutant viable in ambient air.",
               note:"Shown for completeness. Never limits flux in WT — saturation level has no effect on A."},
            ].map(u=>{
              const isSat = u.val!=null && u.val<=1.0 && !u.label.includes("pool");
              return(
                <div key={u.label} style={{marginBottom:6,padding:"5px 7px",borderRadius:5,
                  background:"var(--color-background-secondary)",opacity:0.85}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontSize:8,fontWeight:500,color:"var(--color-text-secondary)"}}>{u.label}</span>
                    <span style={{fontSize:8,fontWeight:600,color:u.col}}>
                      {u.val!=null?(isSat?((u.val)*100).toFixed(0)+"%":u.val.toFixed(4)+" mM"):"—"}
                    </span>
                  </div>
                  <div style={{fontSize:7,color:"#1D9E75",marginBottom:1}}>{u.verif}</div>
                  <div style={{fontSize:7,color:"var(--color-text-tertiary)",fontStyle:"italic"}}>{u.note}</div>
                </div>
              );
            })}

            <div style={{marginTop:6,fontSize:7.5,color:"var(--color-text-tertiary)",lineHeight:1.6,padding:"4px 0",borderTop:"0.5px solid var(--color-border-tertiary)"}}>
              Trx f state: {((m.trxf_red??0)*100).toFixed(0)}% reduced [At✓ Xi 2026] · Stromal redox: {m.redox_pressure>0.65?"⚠ oxidised":m.redox_pressure<0.35?"reducing":"neutral"}
            </div>
          </>}

          </div>{/* end scrollable area */}
        </div>
      </div>
    </div>
  );
}
