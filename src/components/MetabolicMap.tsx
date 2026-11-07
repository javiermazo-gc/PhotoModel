// The SVG metabolic map. Ported in spirit from minimal_map_BACKUP_20261007.tsx's
// giant inline SVG inside App() (CBB core + photorespiration compartments +
// per-bypass-design pathway diagrams), but with a deliberately simplified,
// fixed-geometry layout rather than the original's ~50+ hand-tuned,
// tab/bypass-conditional coordinate calculations. All nodes/arrows here use
// real runModel() output fields and the same Arrow/Node/SmallNode/CompBox/
// SatPill primitives and ARROW_INFO/NODE_INFO tooltip data as the original —
// see the "What was simplified" note in the project README for details.

import { COL } from '../data/metadata';
import type { BypassType, ModelOutput } from '../model';
import { Arrow, CompBox, Node, SatPill, SmallNode } from './primitives';

const SVG_W = 640;
const SVG_H = 390;

interface MetabolicMapProps {
  m: ModelOutput;
  moduleTab: 'core' | 'pr' | 'bypass' | 'advanced';
  bypassActive: boolean;
  bypassType: BypassType;
  onA: (key: string, x: number, y: number, flux: number) => void;
  onN: (key: string, x: number, y: number) => void;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

export function MetabolicMap({ m, moduleTab, bypassActive, bypassType, onA, onN }: MetabolicMapProps) {
  const showPR = moduleTab === 'pr' || moduleTab === 'bypass' || moduleTab === 'advanced';
  const showBypass = (moduleTab === 'bypass' || moduleTab === 'advanced') && bypassActive;

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ background: '#fff', borderRadius: 8 }} onClick={() => onA('', 0, 0, 0)}>
      <style>{`@keyframes dk{to{stroke-dashoffset:-22}}`}</style>
      <defs>
        <marker id="arr" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#888" />
        </marker>
      </defs>

      {/* ── CBB core — always visible ───────────────────────────────── */}
      <Node x={20} y={20} label="CO₂" />
      <Node x={170} y={20} label="RuBP" />
      <Node x={320} y={20} label="3-PGA" />
      <Node x={470} y={20} label="G3P" />

      <Arrow x1={88} y1={31} x2={170} y2={31} flux={num(m.Vc)} color={COL.cbb} label="Vc" ak="rubisco_c" onA={onA} conf="high" />
      <Arrow x1={238} y1={31} x2={320} y2={31} flux={num(m.Vc)} color={COL.cbb} ak="pgk_gapdh" onA={onA} conf="high" />
      <Arrow x1={388} y1={31} x2={470} y2={31} flux={num(m.Vc)} color={COL.cbb} ak="regen" onA={onA} conf="high" />
      <Arrow x1={470} y1={41} x2={238} y2={41} flux={num(m.Vc)} color={COL.cbb} bend={60} ak="regen" onA={onA} conf="high" />

      {/* ── Photorespiration — PR / Bypass / Advanced tabs ──────────── */}
      {showPR && (
        <>
          <Node x={170} y={74} label="2-PG" conf="medium" />
          <Node x={20} y={74} label="Glycolate" conf="high" />
          <Arrow x1={204} y1={20} x2={204} y2={74} flux={num(m.Vo)} color={COL.pr} label="Vo" ak="rubisco_o" onA={onA} conf="medium" />
          <Arrow x1={170} y1={85} x2={88} y2={85} flux={num(m.Vo)} color={COL.pr} ak="pgpase" onA={onA} conf="placeholder" />
          <SatPill sat={num(m.PGLP_sat)} x={130} y={85} ak="pgpase" onA={onA} flux={num(m.Vo)} />

          <CompBox x={10} y={120} w={300} h={130} comp="perox" label="Peroxisome" />
          <CompBox x={320} y={120} w={190} h={130} comp="mito" label="Mitochondria" />

          <SmallNode x={50} y={160} color={COL.pr} nk="glyoxy" label="Glyoxylate" onN={onN} conf="high" />
          <SmallNode x={260} y={160} color={COL.pr} nk="glycine" label="Glycine" onN={onN} conf="medium" />
          <SmallNode x={260} y={222} color={COL.pr} nk="hpp" label="HPP" onN={onN} conf="high" />
          <SmallNode x={110} y={222} color={COL.pr} nk="glycerate" label="Glycerate" onN={onN} conf="high" />

          <Arrow x1={60} y1={160} x2={240} y2={160} flux={num(m.flux_glyoxylate_k) > 0 ? num(m.native_GOX_flux) : num(m.flux_glycine)} color={COL.pr} ak="ggat" onA={onA} conf="high" />
          <Arrow x1={260} y1={178} x2={260} y2={210} flux={num(m.flux_NH3)} color={COL.pr} ak="gdc_shmt" onA={onA} conf="medium" />
          <Arrow x1={240} y1={222} x2={130} y2={222} flux={num(m.flux_glycerate)} color={COL.pr} ak="hpr" onA={onA} conf="high" />
          <Arrow x1={110} y1={210} x2={60} y2={178} flux={num(m.flux_glycerate)} color={COL.pr} bend={-20} ak="hpr" onA={onA} conf="high" />

          <SmallNode x={345} y={160} color="#BA7517" nk="gly_m" label="Gly (mito)" onN={onN} conf="medium" />
          <SmallNode x={480} y={160} color="#BA7517" nk="serine" label="Serine" onN={onN} conf="high" />
          <SmallNode x={345} y={222} color={COL.nh3} nk="nh3" label="NH₃" onN={onN} conf="high" />

          <Arrow x1={365} y1={160} x2={460} y2={160} flux={num(m.flux_serine)} color="#BA7517" ak="gdc_shmt" onA={onA} conf="medium" />
          <Arrow x1={345} y1={178} x2={345} y2={210} flux={num(m.flux_NH3)} color={COL.nh3} ak="gdc_shmt" onA={onA} conf="medium" />
          <text x={400} y={262} fontSize={7} fill={COL.nh3} textAnchor="middle">
            GS/GOGAT refixation (stroma)
          </text>
          <Arrow x1={365} y1={222} x2={400} y2={250} flux={num(m.flux_NH3)} color={COL.nh3} dashed ak="gsgo" onA={onA} conf="high" />

          <SatPill sat={num(m.GOX_sat)} x={155} y={160} ak="gox_p" onA={onA} flux={num(m.flux_glyoxylate_k) || num(m.flux_glycine)} />
          <SatPill sat={num(m.GDC_sat)} x={260} y={192} ak="gdc_shmt" onA={onA} flux={num(m.flux_NH3)} />
        </>
      )}

      {/* ── Active bypass pathway — Bypass / Advanced tabs ──────────── */}
      {showBypass && <BypassLayer m={m} bypassType={bypassType} onA={onA} onN={onN} />}
    </svg>
  );
}

function BypassLayer({
  m,
  bypassType,
  onA,
  onN
}: {
  m: ModelOutput;
  bypassType: BypassType;
  onA: (key: string, x: number, y: number, flux: number) => void;
  onN: (key: string, x: number, y: number) => void;
}) {
  const boxY = 268,
    boxH = 100;
  const label =
    bypassType === 'kebeish'
      ? 'Kebeish bypass (EcGlcDEF, stroma)'
      : bypassType === 'south'
      ? 'South AP3 bypass (CrGDH+CuMS, stroma)'
      : bypassType === 'cbhac'
      ? 'cBHAC bypass (CrGDH+BhcA-D, stroma)'
      : 'McG dual-cycle bypass (CrGDH+MTK/MCL + Ppc, stroma)';

  return (
    <>
      <CompBox x={10} y={boxY} w={610} h={boxH} comp="keb" label={label} />
      <Arrow x1={54} y1={74 + 22} x2={54} y2={boxY} flux={num(m.bypass_flux)} color={COL.keb} ak="gcl" onA={onA} conf="placeholder" />

      {bypassType === 'kebeish' && (
        <>
          <SmallNode x={70} y={boxY + 35} color={COL.keb} nk="glyox_k" label="Glyoxylate" onN={onN} conf="placeholder" />
          <SmallNode x={220} y={boxY + 35} color={COL.keb} nk="tartr" label="Tartronate-SA" onN={onN} conf="placeholder" />
          <SmallNode x={380} y={boxY + 35} color={COL.keb} nk="glycer_k" label="Glycerate" onN={onN} conf="high" />
          <Arrow x1={90} y1={boxY + 35} x2={200} y2={boxY + 35} flux={num(m.flux_glyoxylate_k)} color={COL.keb} ak="glxr" onA={onA} conf="placeholder" label="→CO₂" />
          <Arrow x1={240} y1={boxY + 35} x2={360} y2={boxY + 35} flux={num(m.flux_tartronate)} color={COL.keb} ak="tsr" onA={onA} conf="placeholder" />
          <Arrow x1={400} y1={boxY + 20} x2={320} y2={20 + 10} flux={num(m.flux_3pga_k)} color={COL.keb} bend={-120} ak="glyk" onA={onA} conf="high" />
        </>
      )}

      {bypassType === 'south' && (
        <>
          <SmallNode x={70} y={boxY + 35} color={COL.keb} nk="glyox_ap" label="Glyoxylate" onN={onN} conf="placeholder" />
          <SmallNode x={240} y={boxY + 35} color={COL.keb} nk="tartr" label="Malate" onN={onN} conf="placeholder" />
          <Arrow x1={90} y1={boxY + 35} x2={220} y2={boxY + 35} flux={num(m.bypass_flux)} color={COL.keb} ak="glxr" onA={onA} conf="placeholder" />
          <Arrow x1={270} y1={boxY + 20} x2={340} y2={boxY - 30} flux={num(m.malate_decarboxylated)} color="#aaa" dashed ak="cbhac_gdh" onA={onA} conf="placeholder" label="CO₂ (NADP-ME)" />
          <Arrow x1={270} y1={boxY + 50} x2={400} y2={boxY + 60} flux={num(m.malate_exported)} color={COL.keb} ak="cbhac_gdh" onA={onA} conf="placeholder" label="export (DiT1)" />
        </>
      )}

      {bypassType === 'cbhac' && (
        <>
          <SmallNode x={70} y={boxY + 35} color={COL.cbhac} nk="glyox_ap" label="Glyoxylate" onN={onN} conf="placeholder" />
          <SmallNode x={240} y={boxY + 35} color={COL.cbhac} nk="tartr" label="OAA" onN={onN} conf="placeholder" />
          <Arrow x1={90} y1={boxY + 35} x2={220} y2={boxY + 35} flux={num(m.bypass_flux)} color={COL.cbhac} ak="cbhac_gdh" onA={onA} conf="placeholder" />
          <Arrow x1={270} y1={boxY + 20} x2={400} y2={boxY}
            flux={num(m.OAA_to_malate)} color={COL.cbhac} ak="cbhac_gdh" onA={onA} conf="placeholder" label="→ malate (DiT1)" />
          <Arrow x1={270} y1={boxY + 50} x2={400} y2={boxY + 70}
            flux={num(m.OAA_to_aspartate)} color={COL.cbhac} ak="cbhac_gdh" onA={onA} conf="placeholder" label="→ aspartate" />
        </>
      )}

      {bypassType === 'mcg' && (
        <>
          <SmallNode x={70} y={boxY + 35} color={COL.keb} nk="malylcoa" label="Glyoxylate" onN={onN} conf="placeholder" />
          <SmallNode x={200} y={boxY + 35} color={COL.keb} nk="malylcoa" label="Malyl-CoA" onN={onN} conf="placeholder" />
          <SmallNode x={330} y={boxY + 35} color={COL.keb} nk="malate_mcg" label="Malate" onN={onN} conf="placeholder" />
          <Arrow x1={90} y1={boxY + 35} x2={180} y2={boxY + 35} flux={num(m.flux_glyoxylate_mcg)} color={COL.keb} ak="gcl" onA={onA} conf="placeholder" />
          <Arrow x1={220} y1={boxY + 35} x2={310} y2={boxY + 35} flux={num(m.flux_malylCoA)} color={COL.keb} ak="glxr" onA={onA} conf="placeholder" />
          <Arrow x1={350} y1={boxY + 20} x2={450} y2={boxY - 20} flux={num(m.flux_malate_lipid ?? m.acetylCoA_lipid)} color={COL.keb} ak="glxr" onA={onA} conf="placeholder" label="→ lipids" />
          <Arrow x1={350} y1={boxY + 50} x2={450} y2={boxY + 80} flux={num(m.flux_malate_export)} color={COL.keb} ak="glxr" onA={onA} conf="placeholder" label="→ export" />
          <Arrow x1={90} y1={boxY + 20} x2={320} y2={20 + 10} flux={num(m.flux_3pga_mcg)} color="#1D9E75" bend={-150} ak="tsr" onA={onA} conf="placeholder" label="glycerate shunt" />
          <SmallNode x={520} y={boxY + 35} color="#378ADD" nk="co2" label="Mode B: PEP→OAA" onN={onN} conf="low" />
          <Arrow x1={320} y1={31} x2={520} y2={boxY + 35} flux={num(m.modeB_flux)} color="#378ADD" bend={80} ak="cbhac_gdh" onA={onA} conf="low" label="HCO₃⁻ fixed" />
        </>
      )}
    </>
  );
}
