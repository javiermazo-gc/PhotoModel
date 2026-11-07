// SVG primitives for the metabolic map — ported from
// minimal_map_BACKUP_20261007.tsx (Arrow, Node, SmallNode, SatPill,
// CompBox, Tip, fw(), fo()) and rewritten as idiomatic JSX. Same markup,
// same styling logic, same click/tooltip behaviour as the original.

import { COL, CONF, CONF_LABEL, type ArrowInfo, type NodeInfo } from '../data/metadata';

/** Arrow stroke width scales with sqrt(flux), clamped. */
export function fw(f: number): number {
  return Math.max(0.4, Math.min(Math.sqrt(Math.max(f, 0)) * 1.0, 4.5));
}

/** Arrow opacity scales with flux, clamped. */
export function fo(f: number): number {
  return Math.max(0.15, Math.min(0.12 + f * 0.05, 0.88));
}

export const SR = 9; // small node radius — matches SN_R in SmallNode

interface ArrowProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  flux: number;
  color: string;
  dashed?: boolean;
  label?: string;
  bend?: number;
  ak?: string;
  onA?: (key: string, x: number, y: number, flux: number) => void;
  conf?: 'high' | 'medium' | 'low' | 'placeholder';
}

export function Arrow({ x1, y1, x2, y2, flux, color, dashed, label, bend = 0, ak, onA, conf }: ArrowProps) {
  if (!flux || flux < 0.005) return null;
  const w = fw(flux);
  const op = fo(flux);
  const spd = dashed ? `${Math.max(0.6, 4.5 - flux * 0.1).toFixed(1)}s` : undefined;
  const d = bend
    ? `M${x1} ${y1} Q${(x1 + x2) / 2 + bend} ${(y1 + y2) / 2 + bend} ${x2} ${y2}`
    : `M${x1} ${y1} L${x2} ${y2}`;
  const mlx = bend ? (x1 + x2) / 2 + bend * 0.28 : (x1 + x2) / 2;
  const mly = bend ? (y1 + y2) / 2 + bend * 0.28 : (y1 + y2) / 2;
  const cc = conf ? CONF[conf] ?? '#555' : null;
  return (
    <g
      style={ak ? { cursor: 'pointer' } : undefined}
      onClick={
        ak && onA
          ? (e) => {
              e.stopPropagation();
              onA(ak, mlx, mly, flux);
            }
          : undefined
      }
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={w}
        opacity={op}
        strokeDasharray={dashed ? '6 3' : 'none'}
        strokeLinecap="round"
        markerEnd="url(#arr)"
        style={dashed ? { animation: `dk ${spd} linear infinite` } : undefined}
      />
      {ak && <path d={d} fill="none" stroke="transparent" strokeWidth={14} />}
      {label && flux > 0.1 && (
        <text
          x={mlx}
          y={mly - 5}
          fontSize={7.5}
          fill={color}
          opacity={Math.min(op * 1.8, 0.9)}
          textAnchor="middle"
          style={{ pointerEvents: 'none' }}
        >
          {label} <tspan fontWeight={600}>{flux.toFixed(1)}</tspan>
        </text>
      )}
      {ak && cc && <circle cx={mlx + 8} cy={mly - 10} r={3} fill={cc} opacity={0.85} style={{ pointerEvents: 'none' }} />}
    </g>
  );
}

interface NodeProps {
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  comp?: keyof typeof COL;
  conf?: 'high' | 'medium' | 'low' | 'placeholder';
}

export function Node({ x, y, w = 68, h = 21, label, comp, conf }: NodeProps) {
  const compColor = comp ? (COL as unknown as Record<string, { fill: string; stroke: string }>)[comp] : undefined;
  const s = conf ? CONF[conf] ?? '#555' : (compColor ?? COL.stroma).stroke;
  const sw = conf && conf !== 'high' ? 1.6 : 0.8;
  const dash = conf === 'placeholder' ? '3 2' : conf === 'low' ? '4 2' : 'none';
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#fff" stroke={s} strokeWidth={sw} strokeDasharray={dash} />
      {conf && conf !== 'high' && <circle cx={x + w - 5} cy={y + 5} r={3} fill={s} opacity={0.85} />}
      <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fontSize={8.5} fontWeight={500} fill="#222">
        {label}
      </text>
    </g>
  );
}

interface SmallNodeProps {
  x: number;
  y: number;
  color: string;
  nk: string;
  onN?: (key: string, x: number, y: number) => void;
  conf?: 'high' | 'medium' | 'low' | 'placeholder';
  label?: string;
}

const SN_R = 9;

export function SmallNode({ x, y, color, nk, onN, conf, label }: SmallNodeProps) {
  const rc = conf ? CONF[conf] ?? color : color;
  const bdg = !!(conf && conf !== 'high');
  const dash = conf === 'placeholder' ? '2.5 2' : conf === 'low' ? '4 2' : 'none';
  const shortLabel = label ?? nk;
  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        onN?.(nk, x, y);
      }}
    >
      <circle cx={x} cy={y} r={20} fill="transparent" />
      <circle cx={x} cy={y} r={SN_R + 3} fill="none" stroke={rc} strokeWidth={bdg ? 1.2 : 0.5} strokeDasharray={dash} opacity={bdg ? 0.7 : 0.3} />
      <circle cx={x} cy={y} r={SN_R} fill="white" stroke={rc} strokeWidth={1.2} />
      <circle cx={x} cy={y} r={2.5} fill={rc} opacity={0.9} />
      <text x={x} y={y + SN_R + 9} fontSize={7} fill={rc} textAnchor="middle" fontWeight={500} style={{ pointerEvents: 'none' }}>
        {shortLabel}
      </text>
      {bdg && (
        <g style={{ pointerEvents: 'none' }}>
          <circle cx={x + SN_R - 1} cy={y - SN_R + 1} r={4} fill={rc} />
          <text x={x + SN_R - 1} y={y - SN_R + 4.5} fontSize={5.5} fill="white" textAnchor="middle" fontWeight={700}>
            {conf === 'placeholder' ? '!' : conf === 'low' ? '~' : '?'}
          </text>
        </g>
      )}
    </g>
  );
}

interface SatPillProps {
  sat: number | null | undefined;
  x: number;
  y: number;
  label?: string;
  ak?: string;
  onA?: (key: string, x: number, y: number, flux: number) => void;
  flux?: number;
}

export function SatPill({ sat, x, y, ak, onA, flux }: SatPillProps) {
  if (sat == null || sat < 0.01) return null;
  const c = sat > 0.75 ? '#E24B4A' : sat > 0.5 ? '#e0b000' : '#1D9E75';
  const pct = (sat * 100).toFixed(0) + '%';
  const pw = 20,
    ph = 11;
  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        ak && onA?.(ak, x, y, flux ?? 0);
      }}
    >
      <rect x={x - pw / 2 - 4} y={y - ph / 2 - 4} width={pw + 8} height={ph + 8} fill="transparent" />
      <rect x={x - pw / 2} y={y - ph / 2} width={pw} height={ph} rx={ph / 2} fill={c} opacity={0.12} stroke={c} strokeWidth={0.8} />
      <text x={x} y={y + 4} fontSize={7} fill={c} textAnchor="middle" fontWeight={600}>
        {pct}
      </text>
    </g>
  );
}

interface CompBoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  comp: keyof typeof COL;
  label: string;
}

export function CompBox({ x, y, w, h, comp, label }: CompBoxProps) {
  const cs = COL[comp] as { fill: string; stroke: string };
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={cs.fill} stroke={cs.stroke} strokeWidth={0.9} opacity={0.93} />
      <text x={x + 10} y={y + 13} fontSize={8} fill={cs.stroke} fontWeight={600}>
        {label}
      </text>
    </g>
  );
}

export interface TipState {
  info: (ArrowInfo | NodeInfo) & { flux?: number };
  x: number;
  y: number;
}

interface TipProps {
  tip: TipState | null;
  W: number;
  onClose: () => void;
}

export function Tip({ tip, W, onClose }: TipProps) {
  if (!tip) return null;
  const { info, x, y } = tip;
  const hasUnc = !!(info.unc || info.conf);
  const tw = 225,
    th = ('rxn' in info && info.rxn ? 148 : 88) + (hasUnc ? 40 : 0);
  const tx = Math.min(x + 10, W - tw - 6);
  const ty2 = Math.max(y - th / 2, 4);
  const cc = CONF[info.conf] ?? '#555';
  const rxn = 'rxn' in info ? info.rxn : undefined;
  const ec = 'ec' in info ? info.ec : undefined;
  const f = 'f' in info ? info.f : undefined;
  const r = 'r' in info ? info.r : undefined;
  const up = 'up' in info ? info.up : undefined;
  const down = 'down' in info ? info.down : undefined;
  return (
    <g onClick={(e) => e.stopPropagation()}>
      <rect x={tx} y={ty2} width={tw} height={th} rx={6} fill="#1a1f27" stroke="#3a3f48" strokeWidth={0.7} opacity={0.97} />
      <rect x={tx} y={ty2} width={tw} height={5} rx={3} fill={cc} opacity={0.85} />
      <text x={tx + 8} y={ty2 + 17} fontSize={9} fill="#fff" fontWeight={600}>
        {info.name}
      </text>
      {ec && (
        <text x={tx + 8} y={ty2 + 28} fontSize={7} fill="#7ec9a6">
          EC {ec}
        </text>
      )}
      {f && !ec && (
        <text x={tx + 8} y={ty2 + 28} fontSize={7.5} fill="#aed6c4">
          {f}
        </text>
      )}
      {rxn && (
        <text x={tx + 8} y={ty2 + 39} fontSize={7} fill="#c8c8c8">
          {rxn}
        </text>
      )}
      {r && (
        <foreignObject x={tx + 6} y={ty2 + (rxn ? 48 : 32)} width={tw - 12} height={rxn ? 52 : 44}>
          <div style={{ fontSize: 7.5, color: '#ccc', lineHeight: 1.45 }}>{r}</div>
        </foreignObject>
      )}
      {up && (
        <>
          <foreignObject x={tx + 6} y={ty2 + 52} width={tw - 12} height={36}>
            <div style={{ fontSize: 7, color: '#6fdd92', lineHeight: 1.4 }}>▲ {up}</div>
          </foreignObject>
          <foreignObject x={tx + 6} y={ty2 + 90} width={tw - 12} height={36}>
            <div style={{ fontSize: 7, color: '#f48080', lineHeight: 1.4 }}>▼ {down}</div>
          </foreignObject>
        </>
      )}
      {info.flux != null && (
        <text x={tx + 8} y={ty2 + th - (hasUnc ? 43 : 8)} fontSize={7} fill="#555">
          flux: {info.flux.toFixed(3)} µmol/m²/s
        </text>
      )}
      {hasUnc && (
        <>
          <rect x={tx + 4} y={ty2 + th - 38} width={tw - 8} height={34} rx={3} fill={cc} opacity={0.08} />
          <rect x={tx + 4} y={ty2 + th - 38} width={tw - 8} height={34} rx={3} stroke={cc} strokeWidth={0.4} fill="none" />
          <text x={tx + 8} y={ty2 + th - 27} fontSize={6} fill={cc} fontWeight={700} opacity={0.9}>
            {CONF_LABEL[info.conf] ?? ''}
          </text>
          <foreignObject x={tx + 6} y={ty2 + th - 24} width={tw - 12} height={20}>
            <div style={{ fontSize: 6.5, color: '#aaa', lineHeight: 1.35 }}>{info.unc}</div>
          </foreignObject>
        </>
      )}
      <text x={tx + tw - 10} y={ty2 + 17} fontSize={12} fill="#666" style={{ cursor: 'pointer' }} onClick={onClose}>
        ×
      </text>
    </g>
  );
}
