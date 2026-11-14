// The SVG metabolic map. Faithfully ported from minimal_map_BACKUP_20261007.tsx's
// inline SVG inside App() — same layout constants (nd/sn coordinate tables,
// dynamic stromaH/PEROX/MITO/cytosol geometry), same per-tab and
// per-bypass-design conditional branches, same zoom/pan/tooltip behaviour.
// Kept as a self-contained component (owns its own zoom/pan/tip state) so
// App.tsx doesn't need to thread any of that through props.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ARROW_INFO, COL, NODE_INFO } from '../data/metadata';
import type { BypassType, ModelOutput } from '../model';
import { Arrow, CompBox, Node, SmallNode, Tip, type TipState } from './primitives';

type ModuleTab = 'core' | 'pr' | 'bypass' | 'advanced';

interface MetabolicMapProps {
  m: ModelOutput;
  moduleTab: ModuleTab;
  bypassActive: boolean;
  bypassType: BypassType;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

const SR = 9; // small node radius, matches primitives.SR
const NW = 72,
  NH = 22;

type Pt = [number, number];
type NodeMap = Record<string, Pt>;

export function MetabolicMap({ m, moduleTab, bypassActive, bypassType }: MetabolicMapProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tip, setTip] = useState<TipState | null>(null);
  const dragging = useRef(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const onA = useCallback((key: string, x: number, y: number, flux: number) => {
    if (!key) {
      setTip(null);
      return;
    }
    const info = ARROW_INFO[key];
    if (info) setTip({ info: { ...info, flux }, x, y });
  }, []);

  const onN = useCallback((key: string, x: number, y: number) => {
    const info = NODE_INFO[key];
    if (info) setTip({ info, x, y });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.max(0.3, Math.min(4, z * (1 - e.deltaY * 0.001))));
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, []);

  const onMD = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };
  const onMM = (e: React.MouseEvent) => {
    if (!dragging.current || !dragStart.current) return;
    setPan({ x: dragStart.current.px + (e.clientX - dragStart.current.mx), y: dragStart.current.py + (e.clientY - dragStart.current.my) });
  };
  const onMU = () => {
    dragging.current = false;
  };

  // ── Layout constants — ported verbatim from the original ───────────────
  const SVG_W = 600;
  // mcg gets extra height beyond the original's 250px: its malyl-CoA/malate
  // sub-row + "Mode B" caption were cramped enough in the original to
  // produce an actual label collision (verified by comparing rendered text
  // bounding boxes against the original pixel-for-pixel — both have it).
  // This is a deliberate improvement on the original's layout, not a
  // fidelity target.
  const stromaH = bypassActive && (moduleTab === 'bypass' || moduleTab === 'advanced') ? (bypassType === 'mcg' ? 292 : 230) : 138;

  const PEROX_X = 4,
    PEROX_W = 310,
    PEROX_Y = 16 + stromaH + 8,
    PEROX_H = 130;
  const MITO_X = PEROX_X + PEROX_W + 10,
    MITO_W = 200,
    MITO_Y = PEROX_Y,
    MITO_H = PEROX_H;
  const cytoY = PEROX_Y + PEROX_H + 10,
    cytoH = 38;
  const showCyto = bypassActive && (bypassType === 'cbhac' || bypassType === 'south');
  const SVG_H = showCyto ? cytoY + cytoH + 14 : PEROX_Y + PEROX_H + 22;
  const compsY = PEROX_Y;

  const nd: NodeMap = {
    co2: [10, 38],
    rubp: [140, 38],
    pg3: [280, 38],
    g3p: [420, 38],
    pg2: [140, 96],
    glycolate: [10, 96],
    glyox_k: [100, 175],
    tartr: [230, 175],
    glycer_k: [360, 175],
    glyoxy: [PEROX_X + 12, PEROX_Y + 20],
    glycine: [PEROX_X + PEROX_W - NW - 12, PEROX_Y + 20],
    glycerate: [PEROX_X + 12 + NW + 16, PEROX_Y + 88],
    hpp: [PEROX_X + PEROX_W - NW - 12, PEROX_Y + 88],
    gly_m: [MITO_X + 8, MITO_Y + 18],
    serine: [MITO_X + MITO_W - NW - 8, MITO_Y + 18],
    nh3: [MITO_X + 8, MITO_Y + 54]
  };
  const cx = (k: string) => nd[k][0] + NW / 2;
  const cy = (k: string) => nd[k][1] + NH / 2;
  const lx = (k: string) => nd[k][0];
  const rx = (k: string) => nd[k][0] + NW;
  const ty = (k: string) => nd[k][1];
  const by = (k: string) => nd[k][1] + NH;

  const sn: NodeMap = {
    pg2: [nd.pg2[0] - SR - 2, nd.pg2[1] + NH / 2],
    glyox_k: [nd.glyox_k[0] + NW / 2, nd.glyox_k[1] + NH / 2],
    tartr: [nd.tartr[0] + NW / 2, nd.tartr[1] + NH / 2],
    glycer_k: [nd.glycer_k[0] + NW / 2, nd.glycer_k[1] + NH / 2]
  };

  const showPR = moduleTab === 'pr' || moduleTab === 'bypass' || moduleTab === 'advanced';
  const showBypassLayer = (moduleTab === 'bypass' || moduleTab === 'advanced') && bypassActive;
  const rp = num(m.redox_pressure);
  const stromaStroke = rp > 0.65 ? '#E24B4A' : rp < 0.35 ? '#1D9E75' : '#BA7517';

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, alignItems: 'center', marginBottom: 4 }}>
        <button onClick={() => setZoom((z) => Math.min(z + 0.25, 4))} style={zoomBtnStyle}>
          ＋
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          style={{ ...zoomBtnStyle, fontSize: 9, minWidth: 34 }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => setZoom((z) => Math.max(z - 0.25, 0.3))} style={zoomBtnStyle}>
          －
        </button>
      </div>

      <div
        ref={containerRef}
        style={{
          overflow: 'hidden',
          cursor: dragging.current ? 'grabbing' : 'grab',
          userSelect: 'none',
          position: 'relative',
          minHeight: 340,
          background: '#fff',
          borderRadius: 8
        }}
        onMouseDown={onMD}
        onMouseMove={onMM}
        onMouseUp={onMU}
        onMouseLeave={onMU}
        onClick={() => setTip(null)}
      >
        <div style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: 'top left', transition: 'transform 0.05s' }}>
          <svg width={SVG_W} viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ display: 'block' }}>
            <style>{`@keyframes dk{to{stroke-dashoffset:-22}}`}</style>
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={4.5} markerHeight={4.5} orient="auto-start-reverse">
                <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth={1.5} strokeLinecap="round" />
              </marker>
            </defs>

            {/* ── Chloroplast stroma — always visible, border colour reflects redox state ── */}
            <rect x={4} y={16} width={SVG_W - 8} height={stromaH} rx={8} fill="#eaf7f1" stroke={stromaStroke} strokeWidth={0.9} opacity={0.93} />
            <text x={14} y={28} fontSize={8} fill={stromaStroke} fontWeight={600}>
              Chloroplast stroma
            </text>
            {rp > 0.65 && (
              <text x={14} y={39} fontSize={6.5} fill="#E24B4A">
                over-reduced ⚠
              </text>
            )}

            {showPR && (
              <>
                <CompBox x={PEROX_X} y={PEROX_Y} w={PEROX_W} h={PEROX_H} comp="perox" label="Peroxisome" />
                <CompBox x={MITO_X} y={MITO_Y} w={MITO_W} h={MITO_H} comp="mito" label="Mitochondria" />
              </>
            )}

            {/* ── CBB core — always visible ─────────────────────────────── */}
            <Arrow x1={rx('co2')} y1={cy('co2')} x2={lx('rubp')} y2={cy('rubp')} flux={num(m.Vc)} color={COL.cbb} dashed ak="rubisco_c" conf="high" onA={onA} />
            <Arrow x1={rx('rubp')} y1={cy('rubp')} x2={lx('pg3')} y2={cy('pg3')} flux={num(m.Vc)} color={COL.cbb} dashed label="Vc" ak="rubisco_c" conf="high" onA={onA} />
            <Arrow x1={rx('pg3')} y1={cy('pg3')} x2={lx('g3p')} y2={cy('g3p')} flux={num(m.Vc)} color={COL.cbb} dashed label="3ATP 2NADPH" ak="pgk_gapdh" conf="high" onA={onA} />
            <Arrow x1={cx('g3p')} y1={ty('g3p')} x2={cx('rubp')} y2={ty('rubp')} flux={num(m.Vc)} color={COL.cbb} dashed label="regen" bend={-16} ak="regen" conf="high" onA={onA} />

            {/* ── Oxygenation branch — always visible (even on Core tab) ──── */}
            <Arrow x1={cx('rubp')} y1={by('rubp')} x2={sn.pg2[0]} y2={sn.pg2[1] - SR} flux={num(m.Vo)} color={COL.pr} dashed label="Vo (oxygenation)" ak="rubisco_o" conf="medium" onA={onA} />
            <SmallNode x={sn.pg2[0]} y={sn.pg2[1]} color={COL.pr} nk="pg2" label="2-PG" conf="medium" onN={onN} />

            {showPR && (
              <Arrow x1={sn.pg2[0] + SR} y1={sn.pg2[1]} x2={lx('glycolate')} y2={cy('glycolate')} flux={num(m.Vo)} color={COL.pr} dashed label="PGLP1→Glycolate" ak="pgpase" conf="placeholder" onA={onA} />
            )}

            {showPR && (
              <>
                <Arrow x1={cx('glycolate')} y1={by('glycolate')} x2={cx('glyoxy')} y2={ty('glyoxy')} flux={num(m.native_GOX_flux)} color={COL.pr} dashed label="Glycolate→Perox" ak="gox_p" conf="high" onA={onA} />
                <Arrow x1={rx('glyoxy')} y1={cy('glyoxy')} x2={cx('glycine') - 20} y2={cy('glyoxy')} flux={num(m.native_GOX_flux)} color={COL.pr} dashed label="→Glyoxylate (GOX)" ak="gox_p" conf="high" onA={onA} />
                <Arrow x1={cx('glycine') - 20} y1={cy('glyoxy')} x2={lx('glycine')} y2={cy('glycine')} flux={num(m.flux_glycine) / 2} color={COL.pr} dashed label="→Glycine (GGAT)" ak="ggat" conf="high" onA={onA} />
                <Arrow x1={rx('glycine')} y1={cy('glycine')} x2={lx('gly_m')} y2={cy('gly_m')} flux={num(m.flux_glycine)} color={COL.pr} dashed label="Glycine→Mito (GlyT)" />
                <Arrow x1={rx('gly_m')} y1={cy('gly_m')} x2={lx('serine')} y2={cy('serine')} flux={num(m.flux_serine)} color={COL.pr} dashed label="2Gly→Ser+CO₂+NH₃ (GDC)" ak="gdc_shmt" conf="medium" onA={onA} />
                <Arrow x1={cx('gly_m')} y1={by('gly_m')} x2={cx('gly_m')} y2={by('gly_m') + 32} flux={num(m.flux_CO2_rel)} color="#bbb" dashed label="CO₂" />
                <Arrow x1={cx('nh3')} y1={ty('nh3')} x2={cx('nh3')} y2={ty('nh3') - 32} flux={num(m.flux_NH3)} color={COL.nh3} dashed label="NH₃→GS" ak="gsgo" conf="high" onA={onA} />
                <Arrow x1={lx('serine')} y1={cy('serine') + 8} x2={rx('hpp')} y2={cy('hpp')} flux={num(m.flux_serine)} color={COL.pr} dashed label="Ser→Perox (GlyT)" />
                <Arrow x1={lx('hpp')} y1={cy('hpp')} x2={rx('glycerate')} y2={cy('glycerate')} flux={num(m.flux_glycerate)} color={COL.pr} dashed label="→Glycerate (HPR1)" ak="hpr" conf="high" onA={onA} />
                <Arrow x1={cx('glycerate')} y1={ty('glycerate')} x2={cx('pg3')} y2={by('pg3')} flux={num(m.flux_glycerate)} color={COL.pr} dashed label="→3-PGA (GLYK)" bend={-20} />
              </>
            )}

            {showBypassLayer && (
              <BypassLayer m={m} bypassType={bypassType} sn={sn} cx={cx} by={by} compsY={compsY} onA={onA} onN={onN} />
            )}

            {/* ── CBB core nodes ─────────────────────────────────────────── */}
            {(
              [
                ['co2', 'CO₂', 'stroma'],
                ['rubp', 'RuBP', 'stroma'],
                ['pg3', '3-PGA', 'stroma'],
                ['g3p', 'G3P', 'stroma']
              ] as const
            ).map(([k, l, c]) => (
              <Node key={k} x={nd[k][0]} y={nd[k][1]} label={l} comp={c} />
            ))}

            {showPR && <Node x={nd.glycolate[0]} y={nd.glycolate[1]} label="Glycolate" comp="stroma" />}

            {showPR &&
              (
                [
                  ['glyoxy', 'Glycolate', 'perox'],
                  ['glycine', 'Glycine', 'perox'],
                  ['hpp', 'HPP', 'perox'],
                  ['glycerate', 'Glycerate', 'perox'],
                  ['gly_m', 'Gly (mito)', 'mito'],
                  ['serine', 'Serine', 'mito'],
                  ['nh3', 'NH₃', 'mito']
                ] as const
              ).map(([k, l, c]) => <Node key={k} x={nd[k][0]} y={nd[k][1]} label={l} comp={c} />)}

            {showCyto && <CytosolLayer m={m} compsY={compsY} cytoY={cytoY} cytoH={cytoH} svgW={SVG_W} onA={onA} />}

            {num(m.A) < 0 && (
              <g>
                <rect x={4} y={compsY + 115} width={SVG_W - 8} height={20} rx={3} fill="#E24B4A14" stroke="#E24B4A" strokeWidth={0.6} />
                <text x={12} y={compsY + 128} fontSize={8.5} fill="#E24B4A" fontWeight={500}>
                  ⚠ A = {num(m.A).toFixed(2)} µmol/m²/s — Cc ({num(m.Cc).toFixed(0)}) &lt; Γ* ({num(m.gammastar).toFixed(1)}) — net carbon loss
                </text>
              </g>
            )}

            <text x={8} y={SVG_H - 7} fontSize={7.5} fill="#aaa">
              Arrow width = √flux — thicker = more molecules/s (µmol/m²/s) · Bernacchi 2001 kinetics · click arrows or ● for details
            </text>

            {tip && <Tip tip={tip} W={SVG_W} onClose={() => setTip(null)} />}
          </svg>
        </div>
      </div>
      <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', marginTop: 4 }}>scroll to zoom · drag to pan</div>
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  padding: '2px 7px',
  borderRadius: 5,
  fontSize: 13,
  cursor: 'pointer',
  background: 'var(--color-background-secondary)',
  border: '0.5px solid var(--color-border-tertiary)',
  color: 'var(--color-text-primary)'
};

// ── Bypass pathway layer — one branch per design, each fully contained ──
// inside the stroma box (stromaH is widened by the caller to fit the y=175
// bypass-chain row, plus the extra McG sub-row at y≈227 when bypassType is
// 'mcg'). Ported verbatim from the original's per-bypassType branches.
function BypassLayer({
  m,
  bypassType,
  sn,
  cx,
  by,
  compsY,
  onA,
  onN
}: {
  m: ModelOutput;
  bypassType: BypassType;
  sn: NodeMap;
  cx: (k: string) => number;
  by: (k: string) => number;
  compsY: number;
  onA: (key: string, x: number, y: number, flux: number) => void;
  onN: (key: string, x: number, y: number) => void;
}) {
  // glycolate node right edge — nd.glycolate is fixed at [10, 96] regardless
  // of tab, so this mirrors lx/rx/cy('glycolate') from the parent directly.
  const glycolateR = { x: 10 + NW, y: 96 + NH / 2 };

  if (bypassType === 'kebeish') {
    return (
      <>
        <Arrow x1={glycolateR.x} y1={glycolateR.y} x2={sn.glyox_k[0] - SR} y2={sn.glyox_k[1]} flux={num(m.bypass_flux)} color={COL.keb} dashed label="GcL" ak="gcl" conf="placeholder" onA={onA} />
        <SmallNode x={sn.glyox_k[0]} y={sn.glyox_k[1]} color={COL.keb} nk="glyox_k" label="Glyox." conf="placeholder" onN={onN} />
        <Arrow x1={sn.glyox_k[0] + SR} y1={sn.glyox_k[1]} x2={sn.tartr[0] - SR} y2={sn.tartr[1]} flux={num(m.flux_glyoxylate_k)} color={COL.keb} dashed label="GlxR+CO₂" ak="glxr" conf="placeholder" onA={onA} />
        <Arrow x1={sn.tartr[0]} y1={sn.tartr[1] - SR} x2={cx('co2') + 10} y2={by('co2')} flux={num(m.CO2_bypass)} color="#bbb" dashed bend={-25} />
        <text x={(sn.tartr[0] + cx('co2')) / 2 - 14} y={(sn.tartr[1] + by('co2')) / 2} fontSize={6} fill="#bbb">
          CO₂
        </text>
        <SmallNode x={sn.tartr[0]} y={sn.tartr[1]} color={COL.keb} nk="tartr" label="Tartr." conf="placeholder" onN={onN} />
        <Arrow x1={sn.tartr[0] + SR} y1={sn.tartr[1]} x2={sn.glycer_k[0] - SR} y2={sn.glycer_k[1]} flux={num(m.flux_tartronate)} color={COL.keb} dashed label="TSR" ak="tsr" conf="placeholder" onA={onA} />
        <SmallNode x={sn.glycer_k[0]} y={sn.glycer_k[1]} color={COL.keb} nk="glycer_k" label="Glycer." conf="high" onN={onN} />
        <Arrow x1={sn.glycer_k[0] + SR} y1={sn.glycer_k[1]} x2={cx('pg3')} y2={by('pg3')} flux={num(m.flux_3pga_k)} color={COL.keb} dashed label="→3-PGA (GLYK)" ak="glyk" conf="high" onA={onA} bend={-18} />
      </>
    );
  }

  if (bypassType === 'south') {
    return (
      <>
        <Arrow x1={glycolateR.x} y1={glycolateR.y} x2={sn.glyox_k[0] - SR} y2={sn.glyox_k[1]} flux={num(m.bypass_flux)} color="#e07b00" dashed label="CrGDH" ak="cbhac_gdh" conf="placeholder" onA={onA} />
        <SmallNode x={sn.glyox_k[0]} y={sn.glyox_k[1]} color="#e07b00" nk="glyox_ap" label="Glyox." conf="placeholder" onN={onN} />
        <Arrow x1={sn.glyox_k[0] + SR} y1={sn.glyox_k[1]} x2={sn.tartr[0] - SR} y2={sn.tartr[1]} flux={num(m.malate_bypass)} color="#e07b00" dashed label="CuMS→Malate" ak="glxr" conf="placeholder" onA={onA} />
        <SmallNode x={sn.tartr[0]} y={sn.tartr[1]} color="#e07b00" nk="tartr" label="Malate" conf="placeholder" onN={onN} />
        {num(m.malate_decarboxylated) > 0.01 && (
          <Arrow x1={sn.tartr[0] + SR} y1={sn.tartr[1]} x2={sn.glycer_k[0] - SR} y2={sn.tartr[1]} flux={num(m.malate_decarboxylated)} color="#bbb" dashed label="NADP-ME→CO₂" />
        )}
        {num(m.malate_exported) > 0.01 && (
          <>
            <Arrow x1={sn.tartr[0]} y1={sn.tartr[1] + SR} x2={sn.tartr[0]} y2={compsY - 8} flux={num(m.malate_exported)} color="#e07b00" dashed />
            <text x={sn.tartr[0] + 4} y={compsY - 10} fontSize={6} fill="#e07b00">
              DiT1↓
            </text>
          </>
        )}
      </>
    );
  }

  if (bypassType === 'cbhac') {
    return (
      <>
        <Arrow x1={glycolateR.x} y1={glycolateR.y} x2={sn.glyox_k[0] - SR} y2={sn.glyox_k[1]} flux={num(m.bypass_flux)} color="#378ADD" dashed label="CrGDH" ak="cbhac_gdh" conf="placeholder" onA={onA} />
        <SmallNode x={sn.glyox_k[0]} y={sn.glyox_k[1]} color="#378ADD" nk="glyox_ap" label="Glyox." conf="placeholder" onN={onN} />
        <Arrow x1={sn.glyox_k[0] + SR} y1={sn.glyox_k[1]} x2={sn.tartr[0] - SR} y2={sn.tartr[1]} flux={num(m.OAA_flux)} color="#378ADD" dashed label="BhcA-D→OAA" ak="cbhac_gdh" conf="placeholder" onA={onA} />
        <SmallNode x={sn.tartr[0]} y={sn.tartr[1]} color="#378ADD" nk="tartr" label="OAA" conf="placeholder" onN={onN} />
        {num(m.OAA_to_malate) > 0.01 && (
          <Arrow x1={sn.tartr[0] + SR} y1={sn.tartr[1]} x2={sn.glycer_k[0] - SR} y2={sn.tartr[1]} flux={num(m.OAA_to_malate)} color="#378ADD" dashed label="MDH→Malate (DiT1)" ak="cbhac_gdh" conf="placeholder" onA={onA} />
        )}
        {num(m.OAA_to_aspartate) > 0.01 && (
          <>
            <Arrow x1={sn.tartr[0]} y1={sn.tartr[1] + SR} x2={sn.tartr[0]} y2={compsY - 8} flux={num(m.OAA_to_aspartate)} color="#9B4DCA" dashed />
            <text x={sn.tartr[0] + 4} y={compsY - 10} fontSize={6} fill="#9B4DCA">
              AspAT→Asp (DiT2)
            </text>
          </>
        )}
      </>
    );
  }

  // mcg — glyoxylate→tartronate-SA→glycerate shunt (top row, same enzymes as
  // Kebeish) PLUS a malyl-CoA→malate sub-row directly beneath, fully
  // contained inside the (widened) stroma box via the fork connector line.
  // Gap widened from the original's 52 (-> 68) to give the "Mode B" caption
  // below room to clear the node labels without colliding (see stromaH).
  const brow = sn.tartr[1] + 68;
  const bx1 = sn.glyox_k[0];
  const bx2 = sn.tartr[0];
  const forkX = sn.glyox_k[0] + NW / 2;
  return (
    <>
      <Arrow x1={glycolateR.x} y1={glycolateR.y} x2={sn.glyox_k[0] - SR} y2={sn.glyox_k[1]} flux={num(m.bypass_flux)} color="#1D9E75" dashed label="CrGDH" ak="gcl" conf="placeholder" onA={onA} />
      <SmallNode x={sn.glyox_k[0]} y={sn.glyox_k[1]} color="#1D9E75" nk="glyox_ap" label="Glyox." conf="placeholder" onN={onN} />
      <Arrow x1={sn.glyox_k[0] + SR} y1={sn.glyox_k[1]} x2={sn.tartr[0] - SR} y2={sn.tartr[1]} flux={num(m.flux_tartronate_mcg)} color="#1D9E75" dashed label="GCL+CO₂" ak="glxr" conf="placeholder" onA={onA} />
      <Arrow x1={sn.tartr[0]} y1={sn.tartr[1] - SR} x2={cx('co2') + 10} y2={by('co2')} flux={num(m.CO2_mcg)} color="#bbb" dashed bend={-25} />
      <text x={(sn.tartr[0] + cx('co2')) / 2 - 14} y={(sn.tartr[1] + by('co2')) / 2} fontSize={6} fill="#bbb">
        CO₂
      </text>
      <SmallNode x={sn.tartr[0]} y={sn.tartr[1]} color="#1D9E75" nk="glyox_k" label="Tartr.-SA" conf="placeholder" onN={onN} />
      <Arrow x1={sn.tartr[0] + SR} y1={sn.tartr[1]} x2={sn.glycer_k[0] - SR} y2={sn.glycer_k[1]} flux={num(m.flux_glycerate_mcg)} color="#1D9E75" dashed label="TSR" ak="tsr" conf="placeholder" onA={onA} />
      <SmallNode x={sn.glycer_k[0]} y={sn.glycer_k[1]} color="#1D9E75" nk="glycer_k" label="Glycerate" conf="high" onN={onN} />
      <Arrow x1={sn.glycer_k[0] + SR} y1={sn.glycer_k[1]} x2={cx('pg3')} y2={by('pg3')} flux={num(m.flux_3pga_mcg)} color="#1D9E75" dashed label="GK→3-PGA" ak="glyk" conf="high" onA={onA} bend={-18} />
      <line x1={forkX} y1={sn.glyox_k[1] + SR} x2={forkX} y2={brow - SR} stroke="#1D9E75" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.85} />
      <text x={forkX + 3} y={sn.glyox_k[1] + SR + 20} fontSize={6.5} fill="#1D9E75" fontWeight={600}>
        MTK↓
      </text>
      <SmallNode x={bx1} y={brow} color="#1D9E75" nk="malylcoa" label="Malyl-CoA" conf="placeholder" onN={onN} />
      <Arrow x1={bx1 + SR} y1={brow} x2={bx2 - SR} y2={brow} flux={num(m.flux_malate_mcg)} color="#1D9E75" dashed label="MCL→Malate" ak="gcl" conf="placeholder" onA={onA} />
      <SmallNode x={bx2} y={brow} color="#1D9E75" nk="malate_mcg" label="Malate" conf="placeholder" onN={onN} />
      {num(m.flux_malate_lipid) > 0.01 && (
        <Arrow x1={bx2 + SR} y1={brow} x2={sn.glycer_k[0] + NW / 2} y2={brow} flux={num(m.flux_malate_lipid)} color="#1D9E75" dashed label="→FA synth" />
      )}
      {num(m.modeB_flux) > 0.01 && (
        <text x={bx1} y={brow + SR + 26} fontSize={6.5} fill="#1D9E75">
          Mode B: 3PGA→Ppc ({num(m.CO2_fixed_modeB).toFixed(2)} µmol CO₂/m²/s fixed)
        </text>
      )}
    </>
  );
}

// ── Cytosol compartment — shown for South/cBHAC bypass only, holds the
// exported malate/aspartate nodes and the always-drawn "OAA (str.)" badge
// that sits over the stroma/peroxisome boundary, exactly as in the original.
function CytosolLayer({
  m,
  compsY,
  cytoY,
  cytoH,
  svgW,
  onA
}: {
  m: ModelOutput;
  compsY: number;
  cytoY: number;
  cytoH: number;
  svgW: number;
  onA: (key: string, x: number, y: number, flux: number) => void;
}) {
  return (
    <>
      <rect x={4} y={cytoY} width={svgW - 8} height={cytoH} rx={6} fill="#f0f4ff" stroke="#8899cc" strokeWidth={0.8} opacity={0.9} />
      <text x={14} y={cytoY + 12} fontSize={8} fill="#8899cc" fontWeight={600}>
        Cytosol
      </text>

      {num(m.OAA_to_malate) > 0.01 && (
        <>
          <Arrow x1={200} y1={compsY + 110} x2={200} y2={cytoY} flux={num(m.OAA_to_malate)} color="#378ADD" dashed label="malate" ak="cbhac_gdh" conf="placeholder" onA={onA} />
          <rect x={164} y={cytoY + 8} width={72} height={18} rx={4} fill="#fff" stroke="#378ADD" strokeWidth={0.8} strokeDasharray="3 2" />
          <text x={200} y={cytoY + 20} fontSize={8} fill="#378ADD" textAnchor="middle" fontWeight={500}>
            Malate (cyt)
          </text>
          <text x={164} y={cytoY + 9} fontSize={6} fill="#378ADD">
            DiT1/OMT⇌
          </text>
          <text x={208} y={compsY + 122} fontSize={6.5} fill="#378ADD" opacity={0.8}>
            NADP-MDH
          </text>
        </>
      )}

      {num(m.OAA_to_aspartate) > 0.01 && (
        <>
          <Arrow x1={320} y1={compsY + 110} x2={320} y2={cytoY} flux={num(m.OAA_to_aspartate)} color="#9B4DCA" dashed label="aspartate" ak="cbhac_gdh" conf="placeholder" onA={onA} />
          <rect x={284} y={cytoY + 8} width={72} height={18} rx={4} fill="#fff" stroke="#9B4DCA" strokeWidth={0.8} strokeDasharray="3 2" />
          <text x={320} y={cytoY + 20} fontSize={8} fill="#9B4DCA" textAnchor="middle" fontWeight={500}>
            Asp (cyt)
          </text>
          <text x={284} y={cytoY + 9} fontSize={6} fill="#9B4DCA">
            DiT2⇌
          </text>
          <text x={328} y={compsY + 122} fontSize={6.5} fill="#9B4DCA" opacity={0.8}>
            AspAT
          </text>
        </>
      )}

      <rect x={230} y={compsY + 88} width={72} height={18} rx={4} fill="#fff" stroke="#378ADD" strokeWidth={1.1} strokeDasharray="3 2" />
      <text x={266} y={compsY + 100} fontSize={8} fill="#378ADD" textAnchor="middle" fontWeight={500}>
        OAA (str.)
      </text>
      <text x={231} y={compsY + 89} fontSize={6} fill="#E24B4A">
        ⚠ est.
      </text>
      <text x={420} y={cytoY + 14} fontSize={7} fill="#888">
        OAA: {num(m.OAA_flux).toFixed(2)} µmol/m²/s
      </text>
      <text x={420} y={cytoY + 24} fontSize={7} fill="#378ADD">
        → malate: {num(m.OAA_to_malate).toFixed(2)}
      </text>
      <text x={420} y={cytoY + 34} fontSize={7} fill="#9B4DCA">
        → Asp: {num(m.OAA_to_aspartate).toFixed(2)}
      </text>
    </>
  );
}
