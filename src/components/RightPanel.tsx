// Right-side output panel — Metrics / Bypass / Pools & Enz. tabs.
// Faithfully ported from minimal_map_BACKUP_20261007.tsx's right-panel
// section inside App() (lines ~3794-4448): the metric-card grid + extras
// row, the "Compare all scenarios" and "Uncertainty log" <details>, the
// per-bypass-type output rows + risk flags + METABOLIC FATES section, and
// the Pools & Enz. tab's "Active feedbacks" / "Reference only" breakdown.

import { CONF } from '../data/metadata';
import { compareScenarios, SCENARIOS, type Env, type ModelOutput, type Params } from '../model';
import { InfoPop, LimitBanner, MCard } from './panels';
import { ResponseCurves } from './ResponseCurves';

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

interface RightPanelProps {
  m: ModelOutput;
  rightTab: 'metrics' | 'bypass' | 'pools';
  setRightTab: (t: 'metrics' | 'bypass' | 'pools') => void;
  activeInfo: string | null;
  setActiveInfo: (v: string | null) => void;
  bypassActive: boolean;
  env: Env;
  par: Params;
  /** Params exactly as passed to runModel() (incl. bypass_active/bypass_type). */
  modelPar: Params;
  scenario: string;
  applyScenario: (name: string) => void;
}

export function RightPanel({ m, rightTab, setRightTab, activeInfo, setActiveInfo, bypassActive, env, par, modelPar, scenario, applyScenario }: RightPanelProps) {
  return (
    <div style={{ width: 264, flexShrink: 0, borderLeft: '0.5px solid var(--color-border-tertiary)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        {(
          [
            ['metrics', 'Metrics'],
            ['bypass', 'Bypass'],
            ['pools', 'Pools & Enz.']
          ] as const
        ).map(([t, l]) => (
          <button
            key={t}
            onClick={() => setRightTab(t)}
            style={{
              flex: 1,
              padding: '7px 4px',
              fontSize: 9.5,
              fontWeight: rightTab === t ? 600 : 400,
              background: rightTab === t ? 'var(--color-background-primary)' : 'transparent',
              border: 'none',
              borderBottom: rightTab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: rightTab === t ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              transition: 'color 0.12s var(--ease), border-color 0.12s var(--ease)'
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding: 11, overflowY: 'auto', flex: 1 }}>
        {rightTab === 'metrics' && <MetricsTab m={m} par={par} modelPar={modelPar} env={env} scenario={scenario} applyScenario={applyScenario} activeInfo={activeInfo} setActiveInfo={setActiveInfo} bypassActive={bypassActive} />}
        {rightTab === 'bypass' && <BypassTab m={m} bypassActive={bypassActive} />}
        {rightTab === 'pools' && <PoolsTab m={m} />}
      </div>
    </div>
  );
}

// ─── Metrics tab ────────────────────────────────────────────────────────
function MetricsTab({
  m,
  par,
  modelPar,
  env,
  scenario,
  applyScenario,
  activeInfo,
  setActiveInfo,
  bypassActive
}: {
  m: ModelOutput;
  par: Params;
  modelPar: Params;
  env: Env;
  scenario: string;
  applyScenario: (name: string) => void;
  activeInfo: string | null;
  setActiveInfo: (v: string | null) => void;
  bypassActive: boolean;
}) {
  const cards: [string, number | string, string, string][] = [
    ['Net A', num(m.A), 'µmol/m²/s', num(m.A) >= 0 ? '#1D9E75' : '#E24B4A'],
    ['Limit', m.limitState as string, '—', m.limitState === 'Rubisco' ? '#533AB7' : '#BA7517'],
    ['Wc', num(m.Wc), 'µmol/m²/s', '#533AB7'],
    ['Wj', num(m.Wj), 'µmol/m²/s', '#BA7517'],
    ['Vc', num(m.Vc), 'µmol/m²/s', '#1D9E75'],
    ['Vo', num(m.Vo), 'µmol/m²/s', '#D85A30'],
    ['Vo/Vc', num(m.vovc).toFixed(3), '—', '#D85A30'],
    ['J', num(m.J), 'µmol/m²/s', '#e07b00'],
    ['Γ*', num(bypassActive ? m.gammastar_eff : m.gammastar).toFixed(1), 'µmol/mol', '#D85A30'],
    ['Rd', num(m.Rd), 'µmol/m²/s', '#BA7517'],
    ['dA fb', num(m.dA_feedback), 'µmol/m²/s', num(m.dA_feedback) < -0.5 ? '#E24B4A' : '#888'],
    ['Trx f', (num(m.trxf_red) * 100).toFixed(0) + '%', '—', '#e07b00']
  ];
  if (num(par.Tp25) > 0 && m.Wp != null) cards.push(['Wp', num(m.Wp), 'µmol/m²/s', '#9B4DCA']);

  const extras: [string, string, string, string][] = [
    ['A_fvCB', num(m.A_fvCB).toFixed(2), 'µmol/m²/s', '#888'],
    ['Cc', num(m.Cc).toFixed(0), 'µmol/mol', '#555'],
    ['Srel(T)', m.Srel != null ? num(m.Srel).toFixed(0) : '—', '', '#555'],
    ['C lost', m.carbon_loss_pct != null ? num(m.carbon_loss_pct).toFixed(1) : '—', '%', '#D85A30'],
    ['λ_eff', m.lambda_eff != null ? num(m.lambda_eff).toFixed(3) : '0.500', '—', '#7F77DD'],
    [
      'redox',
      num(m.redox_pressure) > 0.65 ? 'oxidised' : num(m.redox_pressure) < 0.35 ? 'reducing' : 'neutral',
      '',
      num(m.redox_pressure) > 0.65 ? '#E24B4A' : num(m.redox_pressure) < 0.35 ? '#1D9E75' : '#BA7517'
    ]
  ];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7, marginBottom: 10 }}>
        {cards.map(([label, value, unit, color]) => (
          <MCard key={label} label={label} value={value} unit={unit} color={color} onInfo={setActiveInfo} active={activeInfo === label} />
        ))}
      </div>
      <InfoPop metric={activeInfo} onClose={() => setActiveInfo(null)} />

      <div style={{ fontSize: 8.5, lineHeight: 1.9, color: 'var(--color-text-secondary)', marginTop: 4 }}>
        {extras.map(([l, v, u, c]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-tertiary)' }}>{l}</span>
            <span style={{ color: c, fontWeight: 500 }}>
              {v} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400, fontSize: 8 }}>{u}</span>
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8 }}>
        <LimitBanner m={m as any} />
      </div>

      <details open style={{ marginTop: 8 }}>
        <summary style={{ fontSize: 9.5, fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none', marginBottom: 5 }}>▶ Response curves</summary>
        <ResponseCurves env={env} params={modelPar} currentA={num(m.A)} />
      </details>

      <details style={{ marginTop: 8 }}>
        <summary style={{ fontSize: 9.5, fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none', marginBottom: 5 }}>▶ Compare all scenarios</summary>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                {['Scenario', 'A', 'bp%', '⚠'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '2px 3px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareScenarios(Object.keys(SCENARIOS), env).map((r) => (
                <tr
                  key={r.scenario}
                  onClick={() => applyScenario(r.scenario)}
                  style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', background: r.scenario === scenario ? 'var(--color-background-secondary)' : 'transparent', cursor: 'pointer' }}
                >
                  <td style={{ padding: '2px 3px', color: r.scenario === scenario ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: r.scenario === scenario ? 600 : 400, fontSize: 7.5 }}>
                    {r.scenario}
                  </td>
                  <td style={{ padding: '2px 3px', color: '#1D9E75', fontWeight: 500 }}>{num(r.A).toFixed(1)}</td>
                  <td style={{ padding: '2px 3px', color: '#7F77DD' }}>{num(r.bypass_fraction) > 0 ? (num(r.bypass_fraction) * 100).toFixed(0) + '%' : '—'}</td>
                  <td style={{ padding: '2px 3px', color: '#E24B4A' }}>{r.bypass_placeholder ? '⚠' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details style={{ marginTop: 6 }}>
        <summary style={{ fontSize: 9.5, fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none' }}>▶ Uncertainty log</summary>
        <div style={{ fontSize: 8, lineHeight: 1.7, marginTop: 4 }}>
          {(
            [
              { key: 'bypass_enzyme_Vmax25', val: num(par.bypass_enzyme_Vmax25 ?? 5), conf: 'placeholder', label: 'Bypass Vmax', fix: 'Measure enzyme activity in leaf extracts of transgenic lines.' },
              { key: 'PGLP_Vmax25', val: num(par.PGLP_Vmax25 ?? 300), conf: 'placeholder', label: 'PGLP1 Vmax', fix: 'No reliable At leaf-scale measurement. Extract assay recommended.' },
              { key: 'Srel25', val: num(par.Srel25 ?? 2590), conf: 'low', label: 'Srel₂₅', fix: 'Spinach value [sp:spinach]. Use At-specific measurement if available.' },
              { key: 'ci_ca', val: num(par.ci_ca ?? 0.7), conf: 'low', label: 'ci/ca', fix: 'Estimated. Measure under your conditions.' },
              { key: 'GDC_Km_gly', val: num(par.GDC_Km_gly ?? 3.5), conf: 'medium', label: 'GDC Km(Gly)', fix: 'Pea value [sp:pea]. No At measurement published.' }
            ] as const
          ).map((u) => (
            <div key={u.key} style={{ marginBottom: 5, paddingBottom: 4, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                <span style={{ width: 7, height: 7, background: CONF[u.conf], borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 8 }}>{u.label}</span>
                <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 'auto', fontSize: 8 }}>{u.val.toFixed(3)}</span>
              </div>
              <div style={{ color: 'var(--color-text-tertiary)', paddingLeft: 11, fontSize: 8 }}>{u.fix}</div>
            </div>
          ))}
        </div>
      </details>
    </>
  );
}

// ─── Bypass tab ─────────────────────────────────────────────────────────
function BypassTab({ m, bypassActive }: { m: ModelOutput; bypassActive: boolean }) {
  if (!bypassActive) {
    return <div style={{ color: 'var(--color-text-tertiary)', fontSize: 9, padding: '12px 0', textAlign: 'center' }}>Select a bypass type in the left panel to see outputs here.</div>;
  }
  const bypassType = m.bypass_type as string;
  const headerColor = bypassType === 'cbhac' ? '#378ADD' : bypassType === 'south' ? '#e07b00' : bypassType === 'mcg' ? '#1D9E75' : '#7F77DD';
  const headerLabel = bypassType === 'kebeish' ? 'Kebeish (EcGlcDEF)' : bypassType === 'south' ? 'South 2019 (CrGDH+CuMS)' : bypassType === 'mcg' ? 'McG dual cycle (Lu 2025)' : 'cBHAC (CrGDH+BhcA-D)';

  const rows: [string, number, string, string][] =
    bypassType === 'kebeish'
      ? [
          ['Glycolate bypassed', num(m.bypass_flux), 'µmol/m²/s', '#7F77DD'],
          ['% diverted', num(m.bypass_fraction) * 100, '%', '#7F77DD'],
          ['CO₂ rel. (GlxR)', num(m.CO2_bypass), 'µmol/m²/s', '#aaa'],
          ['3-PGA returned', num(m.flux_3pga_k), 'µmol/m²/s', '#1D9E75'],
          ['NH₃ saved', num(m.NH3_saving), 'µmol/m²/s', '#888'],
          ['Native GOX', num(m.native_GOX_flux), 'µmol/m²/s', '#D85A30'],
          [m.bypass_placeholder ? 'A_bypass ⚠' : 'A_bypass', num(m.A_bypass), 'µmol/m²/s', m.bypass_placeholder ? '#e07b00' : '#1D9E75']
        ]
      : bypassType === 'south'
      ? [
          ['Glycolate bypassed', num(m.bypass_flux), 'µmol/m²/s', '#e07b00'],
          ['% diverted', num(m.bypass_fraction) * 100, '%', '#e07b00'],
          ['Malate produced', num(m.malate_bypass), 'µmol/m²/s', '#e07b00'],
          ['→ NADP-ME (CO₂)', num(m.malate_decarboxylated), 'µmol/m²/s', '#aaa'],
          ['→ DiT1 export', num(m.malate_exported), 'µmol/m²/s', '#e07b00'],
          ['NH₃ saved', num(m.NH3_saving), 'µmol/m²/s', '#888'],
          [m.bypass_placeholder ? 'A_bypass ⚠' : 'A_bypass', num(m.A_bypass), 'µmol/m²/s', m.bypass_placeholder ? '#e07b00' : '#1D9E75']
        ]
      : bypassType === 'mcg'
      ? [
          ['Glycolate bypassed', num(m.bypass_flux), 'µmol/m²/s', '#1D9E75'],
          ['% diverted', num(m.bypass_fraction) * 100, '%', '#1D9E75'],
          ['AcCoA total', num(m.acetylCoA_total), 'µmol/m²/s', '#1D9E75'],
          ['  Mode A (gly)', num(m.acetylCoA_modeA), 'µmol/m²/s', '#1D9E75'],
          ['  Mode B (3PG)', num(m.acetylCoA_modeB), 'µmol/m²/s', '#1D9E75'],
          ['CO₂ fixed (B)', num(m.CO2_fixed_modeB), 'µmol/m²/s', '#1D9E75'],
          ['NH₃ saved', num(m.NH3_saving), 'µmol/m²/s', '#888'],
          [m.bypass_placeholder ? 'A_bypass ⚠' : 'A_bypass', num(m.A_bypass), 'µmol/m²/s', m.bypass_placeholder ? '#e07b00' : '#1D9E75']
        ]
      : [
          ['Glycolate bypassed', num(m.bypass_flux), 'µmol/m²/s', '#378ADD'],
          ['% diverted', num(m.bypass_fraction) * 100, '%', '#378ADD'],
          ['OAA flux', num(m.OAA_flux), 'µmol/m²/s', '#378ADD'],
          ['→ malate (DiT1)', num(m.OAA_to_malate), 'µmol/m²/s', '#378ADD'],
          ['→ aspartate (DiT2)', num(m.OAA_to_aspartate), 'µmol/m²/s', '#9B4DCA'],
          ['NH₃ saved', num(m.NH3_saving), 'µmol/m²/s', '#888'],
          [m.bypass_placeholder ? 'A_bypass ⚠' : 'A_bypass', num(m.A_bypass), 'µmol/m²/s', m.bypass_placeholder ? '#e07b00' : '#1D9E75']
        ];

  // Note: the original's runModel() never threads metabolicOutputs()'s
  // carbon_to_calvin field through to the flat output object — "C → CBB"
  // reuses carbon_to_amino_acids verbatim (see minimal_map_BACKUP line
  // ~4158). Kept identical here rather than "fixed", per the port brief.
  const fates = (
    [
      ['C → CBB', num(m.carbon_to_amino_acids), 'µmol/m²/s', '#1D9E75'],
      ['C → FA', num(m.carbon_to_fatty_acids), 'µmol/m²/s', '#1a6fb5'],
      ['C → AA', num(m.carbon_to_amino_acids), 'µmol/m²/s', '#9B4DCA'],
      ['C export', num(m.carbon_exported), 'µmol/m²/s', '#BA7517'],
      ['N saved', num(m.nitrogen_conserved), 'µmol/m²/s', '#888']
    ] as [string, number, string, string][]
  ).filter(([, v]) => v > 0.001);

  return (
    <>
      <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 6, color: headerColor }}>{headerLabel}</div>
      {rows.map(([l, v, u, c]) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
          <span style={{ fontSize: 8.5, color: String(l).includes('⚠') ? '#e07b00' : 'var(--color-text-secondary)', flex: 1 }}>{l}</span>
          <span style={{ fontWeight: 700, color: c, fontSize: 9, minWidth: 40, textAlign: 'right' }}>{v.toFixed(2)}</span>
          <span style={{ fontSize: 8, color: 'var(--color-text-tertiary)', minWidth: 36 }}>{u}</span>
        </div>
      ))}

      <div style={{ marginTop: 6, paddingTop: 5, borderTop: '0.5px solid var(--color-border-tertiary)', fontSize: 8.5, lineHeight: 1.9 }}>
        {(
          [
            ['Γ*_eff', m.gammastar_eff != null ? num(m.gammastar_eff).toFixed(1) : '—', 'µmol/mol', '#D85A30'],
            ['λ_eff', m.lambda_eff != null ? num(m.lambda_eff).toFixed(3) : '—', '—', '#7F77DD'],
            ['Native GOX', m.native_GOX_flux != null ? num(m.native_GOX_flux).toFixed(2) : '—', 'µmol/m²/s', '#D85A30']
          ] as const
        ).map(([l, v, u, c]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-tertiary)' }}>{l}</span>
            <span style={{ color: c, fontWeight: 500 }}>
              {v} <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400, fontSize: 8 }}>{u}</span>
            </span>
          </div>
        ))}
      </div>

      {(num(m.risk_glyoxylate) > 0.5 || num(m.risk_OAA) > 0.5) && (
        <div style={{ marginTop: 5, padding: '4px 6px', background: '#E24B4A0d', border: '0.5px solid #E24B4A55', borderRadius: 4, fontSize: 8 }}>
          <div style={{ fontWeight: 600, color: '#E24B4A', marginBottom: 2 }}>⚠ Risk flags</div>
          {num(m.risk_glyoxylate) > 0.5 && <div style={{ color: '#E24B4A' }}>Glyoxylate: {(num(m.risk_glyoxylate) * 100).toFixed(0)}% — approaching RuBisCO Ki</div>}
          {num(m.risk_OAA) > 0.5 && <div style={{ color: '#E24B4A' }}>OAA: {(num(m.risk_OAA) * 100).toFixed(0)}% — approaching AspAT capacity</div>}
        </div>
      )}

      {m.bypass_note && <div style={{ marginTop: 6, fontSize: 8, color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>{m.bypass_note as string}</div>}

      <div style={{ marginTop: 6, paddingTop: 5, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
        <div style={{ fontSize: 9, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>METABOLIC FATES</div>
        {fates.map(([l, v, u, c]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--color-text-secondary)' }}>{l}</span>
            <span style={{ fontSize: 8.5, fontWeight: 600, color: c }}>
              {v.toFixed(3)} <span style={{ fontWeight: 400, fontSize: 8, color: 'var(--color-text-tertiary)' }}>{u}</span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Pools & Enz. tab ───────────────────────────────────────────────────
function PoolsTab({ m }: { m: ModelOutput }) {
  const activeFeedbacks = [
    {
      label: '2-PG pool',
      val: num(m.pool_2PG),
      warn: 0.02,
      col: '#533AB7',
      feedback: 'Loop 1: inhibits TPI + SBPase → reduces Wj.',
      fval: num(m.pool_2PG) > 0 ? (1 / (1 + num(m.pool_2PG) / 0.066)) * (1 / (1 + num(m.pool_2PG) / 0.2)) : 1,
      verif: 'pool_2PG: [sp:rice] Km. Ki_TPI [sp:spinach]. Ki_SBPase [est]. Direction [At✓ Flügel 2017]',
      honest: 'Meaningful in pglp1 mutants. Near-zero effect in WT at ambient CO₂.'
    },
    {
      label: 'Glycolate pool',
      val: num(m.glycolate_pool),
      warn: 0.5,
      col: '#D85A30',
      feedback: 'Bypass substrate: higher glycolate pool → more bypass flux (when bypass active)',
      fval: null,
      verif: 'GOX Km=0.210mM [At✓ AtGOX1 Jossier 2019]',
      honest: 'Only feeds back when bypass is active. In WT, sets how much bypass could intercept.'
    },
    {
      label: 'Glycine pool',
      val: num(m.glycine_pool),
      warn: 0.5,
      col: '#BA7517',
      feedback: 'Loop 3: GDC_sat > 70% → glyoxylate back-inhibits Vcmax',
      fval: num(m.GDC_sat) > 0.7 ? 1 / (1 + Math.pow((num(m.GDC_sat) - 0.7) / 0.3, 2) * 0.15) : 1,
      verif: 'GDC Vmax [At✓ Timm 2012]. GDC Km [sp:pea ⚠]. Ki scale [est ⚠]',
      honest: 'Near-zero effect in WT. Activates only if GDC becomes genuinely rate-limiting (e.g. cold stress, GDC-OE lines).'
    },
    {
      label: 'PGLP1 saturation',
      val: num(m.PGLP_sat),
      warn: 0.8,
      col: '#533AB7',
      feedback: 'Sets pool_2PG (above). PGLP_Vmax [usr⚠] — this is the critical uncertain parameter',
      fval: null,
      verif: 'Trx f activation [At✓ Xi 2026]. Vmax [usr⚠ no At measurement]. Km [sp:rice]',
      honest: "The model's most consequential uncertain parameter. Lowering PGLP_Vmax raises 2-PG and reduces A via Loop 1."
    }
  ];

  const referenceOnly = [
    { label: 'Glyoxylate pool', val: num(m.glyoxylate_pool), col: '#c06030', isSat: false, verif: 'GGAT Km=0.20mM [At✓ GGT1 Liepman 2003]. GGAT confirmed non-limiting.', note: "GGAT never rate-limiting in WT — pool changes don't affect A. Compare with metabolomics to validate model." },
    { label: 'HP (hydroxypyruvate) pool', val: num(m.HP_pool), col: '#D85A30', isSat: false, verif: 'HPR1 Km=0.08mM [At✓]. HPR1 confirmed non-limiting (hpr1 mutant viable in air).', note: "HPR1 never rate-limiting — HP pool doesn't feed back. Use for metabolomics comparison only." },
    { label: 'GOX saturation', val: num(m.GOX_sat), col: '#D85A30', isSat: true, verif: 'GOX Km=0.210mM [At✓ AtGOX1]. Vmax [At✓ est Jossier 2019].', note: 'GOX sets the glycolate pool size which feeds the bypass. GOX_sat itself has no direct feedback — intermediate.' },
    { label: 'GGAT saturation', val: num(m.GGAT_sat), col: '#c06030', isSat: true, verif: '[At✓ non-limiting]. Confirmed in Arabidopsis — not a bottleneck.', note: 'Shown for completeness. Never limits flux in WT — saturation level has no effect on A.' },
    { label: 'HPR1 saturation', val: num(m.HPR1_sat), col: '#D85A30', isSat: true, verif: '[At✓ non-limiting]. hpr1 mutant viable in ambient air.', note: 'Shown for completeness. Never limits flux in WT — saturation level has no effect on A.' }
  ];

  return (
    <>
      <div style={{ padding: '6px 8px', background: 'var(--color-background-secondary)', borderRadius: 6, marginBottom: 8, fontSize: 8, lineHeight: 1.7, borderLeft: '3px solid #378ADD' }}>
        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 3 }}>How pool sizes are computed</div>
        <div style={{ color: 'var(--color-text-secondary)' }}>
          This is a <strong>steady-state model</strong> — no ODEs, no time. Pool sizes are back-calculated from fluxes using the MM inverse:{' '}
          <code style={{ fontSize: 8, background: '#0001', padding: '0 3px', borderRadius: 2 }}>[S] = Km × v / (Vmax − v)</code>. This is valid at steady state. But most pools don't <em>set</em> the
          fluxes — the fluxes are imposed stoichiometrically. The two exceptions that genuinely feed back into A are <strong>pool_2PG</strong> (→ Wj via Loop 1) and <strong>glycolate_pool</strong> (→
          bypass flux). The rest are useful for metabolomics comparison only.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8, fontSize: 8, color: 'var(--color-text-tertiary)' }}>
        <span>🔗 feeds back into A</span>
        <span>📊 metabolomics reference only</span>
        <span style={{ color: '#1D9E75' }}>[At✓] Arabidopsis</span>
        <span style={{ color: '#e0b000' }}>[sp:X] other species</span>
        <span style={{ color: '#e07b00' }}>[est] estimated</span>
        <span style={{ color: '#E24B4A' }}>[usr⚠] unmeasured</span>
      </div>

      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>🔗 Active feedbacks — change A</div>
      <div style={{ fontSize: 8, color: 'var(--color-text-tertiary)', marginBottom: 6, lineHeight: 1.4 }}>These pools/enzymes are wired into kinFeedback() and shift the final A value.</div>
      {activeFeedbacks.map((u) => {
        const hi = u.val > u.warn;
        const scalePct = u.fval != null ? `→ scales A by ×${u.fval.toFixed(3)}` : '';
        return (
          <div key={u.label} style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 5, background: 'var(--color-background-secondary)', border: `0.5px solid ${hi ? '#E24B4A' : 'var(--color-border-tertiary)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>{u.label}</span>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: hi ? '#E24B4A' : u.col }}>
                {u.label === 'PGLP1 saturation' ? (u.val * 100).toFixed(0) + '%' : u.val.toFixed(4)}
                {hi && ' ⚠'}
              </span>
            </div>
            <div style={{ background: 'var(--color-background-primary)', borderRadius: 2, height: 4, marginBottom: 4 }}>
              <div style={{ width: `${Math.min((u.val / u.warn) * 100, 100)}%`, height: '100%', background: hi ? '#E24B4A' : u.col, borderRadius: 2, transition: 'width 0.2s' }} />
            </div>
            <div style={{ fontSize: 8, color: u.col, marginBottom: 2 }}>
              🔗 {u.feedback} {scalePct && <span style={{ color: '#555' }}>{scalePct}</span>}
            </div>
            <div style={{ fontSize: 8, color: '#1D9E75', marginBottom: 2 }}>{u.verif}</div>
            <div style={{ fontSize: 8, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>{u.honest}</div>
          </div>
        );
      })}

      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-text-primary)', margin: '10px 0 2px' }}>📊 Reference only — don't change A</div>
      <div style={{ fontSize: 8, color: 'var(--color-text-tertiary)', marginBottom: 6, lineHeight: 1.4 }}>Computed for comparison with metabolomics data. Not wired into feedback loops.</div>
      {referenceOnly.map((u) => (
        <div key={u.label} style={{ marginBottom: 6, padding: '5px 7px', borderRadius: 5, background: 'var(--color-background-secondary)', opacity: 0.85 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 8, fontWeight: 500, color: 'var(--color-text-secondary)' }}>{u.label}</span>
            <span style={{ fontSize: 8, fontWeight: 600, color: u.col }}>{u.isSat ? (u.val * 100).toFixed(0) + '%' : u.val.toFixed(4) + ' mM'}</span>
          </div>
          <div style={{ fontSize: 8, color: '#1D9E75', marginBottom: 1 }}>{u.verif}</div>
          <div style={{ fontSize: 8, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>{u.note}</div>
        </div>
      ))}

      <div style={{ marginTop: 6, fontSize: 8, color: 'var(--color-text-tertiary)', lineHeight: 1.6, padding: '4px 0', borderTop: '0.5px solid var(--color-border-tertiary)' }}>
        Trx f state: {(num(m.trxf_red) * 100).toFixed(0)}% reduced [At✓ Xi 2026] · Stromal redox:{' '}
        {num(m.redox_pressure) > 0.65 ? '⚠ oxidised' : num(m.redox_pressure) < 0.35 ? 'reducing' : 'neutral'}
      </div>
    </>
  );
}
