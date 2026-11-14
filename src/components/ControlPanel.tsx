import { COL, CONF, ECO_PRESETS, LIT_PRESETS } from '../data/metadata';
import { SCENARIOS, type BypassType, type Env, type ModelOutput, type Params } from '../model';
import { Sld } from './panels';

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

interface ControlPanelProps {
  env: Env;
  setE: (k: keyof Env, v: number) => void;
  par: Params;
  setP: (k: string, v: number) => void;
  setPStr: (k: string, v: string) => void;
  m: ModelOutput;
  moduleTab: string;
  bypassActive: boolean;
  setBypassActive: (v: boolean) => void;
  bypassType: BypassType;
  setBypassType: (v: BypassType) => void;
  scenario: string;
  applyScenario: (name: string) => void;
}

export function ControlPanel({
  env,
  setE,
  par,
  setP,
  setPStr,
  m,
  moduleTab,
  bypassActive,
  setBypassActive,
  bypassType,
  setBypassType,
  scenario,
  applyScenario
}: ControlPanelProps) {
  return (
    <div style={{ padding: '8px 12px', background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 16px' }}>
        <Sld k="co2" val={env.co2} set={(_, v) => setE('co2', v)} min={100} max={1200} step={10} label="CO₂" unit=" ppm" color={COL.cbb} />
        <Sld k="o2" val={env.o2} set={(_, v) => setE('o2', v)} min={1} max={50} step={1} label="O₂" unit=" %" color={COL.pr} />
        <Sld k="temp" val={env.temp} set={(_, v) => setE('temp', v)} min={0} max={45} step={1} label="Temp" unit="°C" />
        <Sld k="light" val={env.light} set={(_, v) => setE('light', v)} min={0} max={2000} step={10} label="Light (PAR)" unit=" µmol/m²/s" />
        <Sld k="pi" val={env.pi ?? 100} set={(_, v) => setE('pi', v)} min={0} max={100} step={1} label="Stomatal/Pi" unit="%" />
        <Sld k="act" val={env.act ?? 100} set={(_, v) => setE('act', v)} min={0} max={100} step={1} label="RuBisCO activation" unit="%" />
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
        {ECO_PRESETS.map((p) => (
          <button
            key={p.n}
            title={p.note}
            onClick={() => Object.entries(p.e).forEach(([k, v]) => setE(k as keyof Env, v as number))}
            style={{
              fontSize: 9.5,
              padding: '2px 7px',
              borderRadius: 10,
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-tertiary)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer'
            }}
          >
            {p.n}
          </button>
        ))}
      </div>

      {moduleTab === 'core' && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--color-background-primary)', borderRadius: 7 }}>
          <div
            style={{
              marginBottom: 8,
              padding: '6px 8px',
              borderRadius: 5,
              fontSize: 8,
              lineHeight: 1.6,
              background: 'var(--color-background-secondary)',
              borderLeft: '3px solid var(--color-border-tertiary)'
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>What this model shows</div>
            <div style={{ color: 'var(--color-text-secondary)' }}>
              The <strong>Farquhar–von Caemmerer–Berry (FvCB)</strong> model — the standard for C3 leaf gas exchange. It
              computes net CO₂ assimilation from three potential limits: RuBisCO capacity (Wc), electron transport (Wj), and
              triose-phosphate utilisation (Wp).
            </div>
            <div style={{ color: 'var(--color-text-tertiary)', marginTop: 4 }}>
              <strong>What it abstracts away:</strong> individual CBB enzyme steps (PGK, GAPDH, PRK etc.), chloroplast
              ATP/ADP pools, post-translational regulation beyond Trx f, and mesophyll spatial gradients. Glycolate and
              photorespiration appear in the<em> Photorespiration</em> tab — they are downstream of oxygenation, not part
              of CBB.
            </div>
          </div>
          <div style={{ fontWeight: 600, fontSize: 9, color: 'var(--color-text-secondary)', margin: '10px 0 6px', letterSpacing: 0.4 }}>
            RUBISCO CAPACITY
          </div>
          <Sld
            k="Vcmax25"
            val={(par.Vcmax25 as number) ?? 120}
            set={setP}
            min={40}
            max={200}
            step={5}
            label="Max carboxylation rate"
            unit=" µmol/m²/s"
            color={CONF.high}
            tip="The maximum speed of RuBisCO at 25°C. Measure this from an A/Ci curve in your material. Typical Arabidopsis: 100–140."
          />
        </div>
      )}

      {moduleTab === 'pr' && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--color-background-primary)', borderRadius: 7 }}>
          <div style={{ fontWeight: 600, fontSize: 9, color: 'var(--color-text-secondary)', marginBottom: 4, letterSpacing: 0.4 }}>
            PHOTORESPIRATION RATES
          </div>
          <div style={{ padding: '6px 8px', background: 'var(--color-background-secondary)', borderRadius: 6, fontSize: 8.5, lineHeight: 2 }}>
            {(
              [
                ['Oxygenations (Vo)', num(m.Vo).toFixed(2), 'µmol/m²/s', COL.pr, 'How often RuBisCO grabs O₂ instead of CO₂'],
                ['Vo/Vc ratio', num(m.vovc).toFixed(3), '—', COL.pr, '~0.3 = 30% of reactions wasteful. Rises with heat.'],
                ['C lost to PR', num(m.carbon_loss_pct).toFixed(1), '%', COL.pr, 'Carbon that takes the photorespiratory detour'],
                ['NH₃ released', num(m.flux_NH3).toFixed(2), 'µmol/m²/s', '#888', 'Must be re-fixed at ATP cost'],
                ['Γ* (comp. point)', num(m.gammastar).toFixed(1), 'µmol/mol', COL.pr, 'CO₂ level where oxygenation = carboxylation']
              ] as [string, string, string, string, string][]
            ).map(([l, v, u, c, tip]) => (
              <div key={l} title={tip} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'default' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{l}</span>
                <span style={{ color: c, fontWeight: 600 }}>
                  {v}
                  <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400, fontSize: 7.5 }}> {u}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {moduleTab === 'bypass' && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--color-background-primary)', borderRadius: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <input type="checkbox" checked={bypassActive} onChange={(e) => setBypassActive(e.target.checked)} />
              Bypass active
            </label>
          </div>

          <div style={{ fontWeight: 600, fontSize: 9, color: 'var(--color-text-secondary)', margin: '8px 0 5px', letterSpacing: 0.4 }}>
            SELECT BYPASS DESIGN
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
            {(
              [
                ['kebeish', 'Kebeish (EcGlcDEF)', COL.keb, 'Glycolate → CO₂ + 3-PGA in stroma. Published in Arabidopsis [At✓ 2007].'],
                ['south', 'South AP3 (CrGDH+CuMS)', '#e07b00', 'Glycolate → malate via stroma. Field-tested in tobacco [sp:tobacco 2019]. ⚠ elevated glyoxylate risk.'],
                ['cbhac', 'cBHAC (CrGDH+BhcA-D)', COL.cbhac, 'Glycolate → OAA → malate or aspartate. In rice [sp:rice 2025].'],
                ['mcg', 'McG dual cycle (Lu 2025)', '#1D9E75', 'Glycolate → acetyl-CoA + CO₂ fixation via Ppc. 3× biomass in Arabidopsis [At✓].']
              ] as [BypassType, string, string, string][]
            ).map(([t, label, c, desc]) => (
              <button
                key={t}
                onClick={() => {
                  setBypassType(t);
                  setBypassActive(true);
                }}
                style={{
                  padding: '5px 8px',
                  borderRadius: 6,
                  fontSize: 8.5,
                  cursor: 'pointer',
                  textAlign: 'left',
                  lineHeight: 1.4,
                  background: bypassActive && bypassType === t ? c + '18' : 'var(--color-background-secondary)',
                  border: `1px solid ${bypassActive && bypassType === t ? c : 'var(--color-border-tertiary)'}`,
                  color: bypassActive && bypassType === t ? c : 'var(--color-text-secondary)'
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {bypassActive && bypassType === t ? '✓ ' : ''}
                  {label}
                </div>
                <div style={{ fontSize: 7.5, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{desc}</div>
              </button>
            ))}
            <button
              onClick={() => setBypassActive(false)}
              style={{
                padding: '3px 8px',
                borderRadius: 5,
                fontSize: 8,
                cursor: 'pointer',
                textAlign: 'left',
                background: 'transparent',
                border: '0.5px solid var(--color-border-tertiary)',
                color: 'var(--color-text-tertiary)'
              }}
            >
              ✕ No bypass (wild type)
            </button>
          </div>

          {bypassActive &&
            (() => {
              const bc = bypassType === 'kebeish' ? COL.keb : bypassType === 'south' ? '#e07b00' : bypassType === 'mcg' ? '#1D9E75' : COL.cbhac;
              const kmDefault = bypassType === 'kebeish' ? 0.04 : 0.3;
              const km = (par.bypass_Km_glycolate as number) ?? kmDefault;
              const glycolatePool = typeof m.glycolate_pool === 'number' ? m.glycolate_pool : 0.02;
              const vmax = (par.bypass_enzyme_Vmax25 as number) ?? 5;
              const bypassFraction = num(m.bypass_fraction);
              return (
                <>
                  <div style={{ padding: '8px 10px', borderRadius: 7, marginBottom: 8, border: `1.5px solid ${bc}`, background: `${bc}0d` }}>
                    <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 2, color: bc }}>
                      {bypassType === 'kebeish' ? 'GcL (EcGlcDH)' : 'CrGDH'} — glycolate oxidation
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--color-text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>
                      This enzyme oxidises glycolate → glyoxylate <strong>in the stroma</strong>, diverting it away from
                      the peroxisome. Its Vmax and Km set how much glycolate is intercepted. Both are{' '}
                      <span style={{ color: '#E24B4A' }}>unmeasured in Arabidopsis</span> — values below are estimates.
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, marginBottom: 3 }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Glycolate diverted to bypass</span>
                        <span style={{ fontWeight: 700, color: bc }}>{(bypassFraction * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: 'var(--color-background-secondary)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            borderRadius: 4,
                            transition: 'width 0.2s',
                            background: bc,
                            width: `${Math.min(bypassFraction * 100, 100)}%`
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                        <span>→ peroxisome: {num(m.native_GOX_flux).toFixed(2)} µmol/m²/s</span>
                        <span>→ bypass: {num(m.bypass_flux).toFixed(2)} µmol/m²/s</span>
                      </div>
                    </div>
                    <Sld
                      k="bypass_enzyme_Vmax25"
                      val={vmax}
                      set={setP}
                      min={0}
                      max={30}
                      step={0.5}
                      label="Max enzyme speed (Vmax) ⚠ unmeasured"
                      unit=" µmol/m²/s"
                      color={CONF.placeholder}
                      tip="Raise this to divert more glycolate. At Vmax=5 (default placeholder) only ~10% is intercepted because the glycolate pool is much smaller than the Km. Measure in leaf extracts of your transgenic lines."
                    />
                    <Sld
                      k="bypass_Km_glycolate"
                      val={km}
                      set={setP}
                      min={0.01}
                      max={0.5}
                      step={0.01}
                      label="Km for glycolate ⚠ estimated"
                      unit=" mM"
                      color={CONF.placeholder}
                      tip={
                        bypassType === 'kebeish'
                          ? 'Kebeish: Km=0.04mM [sp:E.coli Lord 1972]. Glycolate pool ~0.02mM — enzyme is substrate-limited. Lower Km = more efficient diversion.'
                          : 'CrGDH: Km=0.30mM [sp:Chlamydomonas est]. Glycolate pool ~0.02mM — only ~6% saturation at default. Lowering Km dramatically increases diversion.'
                      }
                    />
                    <div style={{ fontSize: 7.5, color: 'var(--color-text-tertiary)', lineHeight: 1.5, marginTop: 2, padding: '3px 5px', background: '#0001', borderRadius: 3 }}>
                      Pool/Km = {((glycolatePool / km) * 100).toFixed(0)}% saturation — enzyme running at{' '}
                      {((num(m.bypass_flux) / Math.max(vmax, 0.01)) * 100).toFixed(0)}% of Vmax.
                      {glycolatePool < km
                        ? ' Pool << Km: linear regime — Vmax and Km both limit equally.'
                        : ' Pool ≈ Km: Vmax is the main limit.'}
                    </div>
                    {bypassType === 'south' && (
                      <>
                        <Sld
                          k="malate_decarb_fraction"
                          val={(par.malate_decarb_fraction as number) ?? 0.7}
                          set={setP}
                          min={0.3}
                          max={1.0}
                          step={0.05}
                          label="Malate → CO₂ via NADP-ME"
                          unit=""
                          color={CONF.low}
                          tip="Fraction of malate decarboxylated back to CO₂ by NADP-ME. Remainder exported via malate valve (DiT1)."
                        />
                        <Sld
                          k="plgg1_suppression"
                          val={(par.plgg1_suppression as number) ?? 0}
                          set={setP}
                          min={0}
                          max={0.8}
                          step={0.05}
                          label="PLGG1 suppression (RNAi)"
                          unit=""
                          color={CONF.low}
                          tip="South 2019 suppressed PLGG1 (glycolate exporter) to retain more glycolate in the chloroplast for the bypass."
                        />
                      </>
                    )}
                    {bypassType === 'mcg' && (
                      <Sld
                        k="pep_fraction"
                        val={(par.pep_fraction as number) ?? 0.1}
                        set={setP}
                        min={0.02}
                        max={0.2}
                        step={0.01}
                        label="3PG → Mode B fraction ⚠"
                        unit=""
                        color={CONF.placeholder}
                        tip="Fraction of 3-PGA routed through Ppc for CO₂ fixation (Mode B). Highly uncertain — needs measurement."
                      />
                    )}
                  </div>
                </>
              );
            })()}
        </div>
      )}

      {moduleTab === 'advanced' && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--color-background-primary)', borderRadius: 7 }}>
          <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4 }}>Scenarios (published genotypes)</div>
          <div style={{ fontSize: 8, color: 'var(--color-text-tertiary)', marginBottom: 5, lineHeight: 1.5 }}>
            Apply a published genotype. Sets kinetic params automatically.
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {Object.entries(SCENARIOS).map(([name, sc]) => (
              <button
                key={name}
                onClick={() => applyScenario(name)}
                title={sc.label}
                style={{
                  fontSize: 9.5,
                  padding: '3px 8px',
                  borderRadius: 5,
                  background: scenario === name ? 'var(--color-text-primary)' : 'var(--color-background-secondary)',
                  color: scenario === name ? 'var(--color-background-primary)' : 'var(--color-text-primary)',
                  border: '0.5px solid var(--color-border-tertiary)',
                  cursor: 'pointer'
                }}
              >
                {name}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 6 }}>
            Kinetic parameters
            <span style={{ fontWeight: 400, fontSize: 7.5, marginLeft: 6 }}>
              <span style={{ color: CONF.high }}>■ At✓</span> <span style={{ color: CONF.medium }}>■ C3/sp</span>{' '}
              <span style={{ color: CONF.low }}>■ est</span> <span style={{ color: CONF.placeholder }}>■ usr⚠</span>
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px 16px' }}>
            <Sld
              k="Vcmax25"
              val={(par.Vcmax25 as number) ?? 120}
              set={setP}
              min={40}
              max={200}
              step={5}
              label="RuBisCO max speed (Vcmax₂₅)"
              unit=" µmol/m²/s"
              color={CONF.high}
              tip="Measure from A/Ci curve. Arabidopsis Col-0 typical: 100–140."
            />
            <Sld
              k="Srel25"
              val={(par.Srel25 as number) ?? 2590}
              set={setP}
              min={2000}
              max={2800}
              step={10}
              label="RuBisCO CO₂/O₂ selectivity"
              unit=" Pa/Pa"
              color={CONF.low}
              tip="[sp:spinach] How much better RuBisCO is at CO₂ vs O₂. Higher = less photorespiration. No Arabidopsis measurement."
            />
            <Sld
              k="ci_ca"
              val={(par.ci_ca as number) ?? 0.7}
              set={setP}
              min={0.6}
              max={0.85}
              step={0.01}
              label="Stomatal CO₂ ratio (ci/ca)"
              unit=""
              color={CONF.low}
              tip="Fraction of air CO₂ that gets inside the leaf. Depends on stomata opening. ~0.7 typical but varies with water stress."
            />
            <Sld
              k="Cc_Ci"
              val={(par.Cc_Ci as number) ?? 0.8}
              set={setP}
              min={0.65}
              max={0.95}
              step={0.01}
              label="Mesophyll conductance (Cc/Ci)"
              unit=""
              color={CONF.low}
              tip="Further CO₂ drop from cell wall to chloroplast. 1.0 = no resistance. Arabidopsis may be 0.70–0.80."
            />
            <Sld
              k="PGLP_Vmax25"
              val={(par.PGLP_Vmax25 as number) ?? 300}
              set={setP}
              min={110}
              max={1200}
              step={10}
              label="PGLP1 phosphatase max speed ⚠"
              unit=" µmol/m²/s"
              color={CONF.placeholder}
              tip="⚠ No reliable Arabidopsis measurement. PGLP1 removes 2-PG (toxic oxygenation product). Reduce to simulate pglp1 mutant."
            />
            <Sld
              k="PGLP_Km_2PG"
              val={(par.PGLP_Km_2PG as number) ?? 0.272}
              set={setP}
              min={0.025}
              max={0.57}
              step={0.005}
              label="PGLP1 affinity for 2-PG"
              unit=" mM"
              color={CONF.medium}
              tip="[sp:rice] How concentrated 2-PG must be before PGLP1 works at half speed. Lower = more efficient enzyme."
            />
            <Sld
              k="GOX_Km_gly"
              val={(par.GOX_Km_gly as number) ?? 0.21}
              set={setP}
              min={0.15}
              max={0.35}
              step={0.005}
              label="GOX affinity for glycolate"
              unit=" mM"
              color={CONF.high}
              tip="[At✓ AtGOX1 Jossier 2019] Glycolate oxidase half-saturation. Lower = works at lower glycolate concentrations."
            />
            <Sld
              k="GDC_Km_gly"
              val={(par.GDC_Km_gly as number) ?? 3.5}
              set={setP}
              min={3.0}
              max={7.0}
              step={0.1}
              label="GDC affinity for glycine ⚠"
              unit=" mM"
              color={CONF.medium}
              tip="[sp:pea] Glycine decarboxylase half-saturation. No Arabidopsis measurement. High value means GDC needs lots of glycine to run fast."
            />
            <Sld
              k="Ki_TPI"
              val={(par.Ki_TPI as number) ?? 0.066}
              set={setP}
              min={0.04}
              max={0.12}
              step={0.002}
              label="2-PG inhibition of TPI"
              unit=" mM"
              color={CONF.medium}
              tip="[sp:spinach] When 2-PG rises above this, it slows triose-phosphate isomerase. This is Loop 1 feedback."
            />
            <Sld
              k="Ki_SBPase"
              val={(par.Ki_SBPase as number) ?? 0.2}
              set={setP}
              min={0.08}
              max={0.4}
              step={0.01}
              label="2-PG inhibition of SBPase"
              unit=" mM"
              color={CONF.low}
              tip="[est] When 2-PG rises, it also slows sedoheptulose bisphosphatase — reducing RuBP regeneration."
            />
            <Sld
              k="Tp25"
              val={(par.Tp25 as number) ?? 0}
              set={setP}
              min={0}
              max={20}
              step={0.5}
              label="TPU limit (0 = off)"
              unit=" µmol/m²/s"
              color={CONF.low}
              tip="Triose-phosphate utilisation limit. Only visible at very high CO₂ + saturating light. Set ~10 for Arabidopsis. Off by default."
            />
            <Sld k="bypass_Km_glycolate" val={(par.bypass_Km_glycolate as number) ?? 0.04} set={setP} min={0.01} max={0.5} step={0.01} label="Bypass Km(glycolate)" unit=" mM" color={COL.keb} />
            <Sld k="refix_efficiency" val={(par.refix_efficiency as number) ?? 0.6} set={setP} min={0} max={1} step={0.05} label="CO₂ refixation efficiency" unit="" color={COL.keb} />
          </div>

          <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 6, marginTop: 10 }}>
            Electron transport model
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
            {(
              [
                ['fvcb', 'FvCB (empirical θ)'],
                ['johnson_berry', 'Johnson–Berry (Cb6f) [est]']
              ] as [string, string][]
            ).map(([val, label]) => {
              const active = (par.photochemistry_model ?? 'fvcb') === val;
              return (
                <button
                  key={val}
                  onClick={() => setPStr('photochemistry_model', val)}
                  title="Johnson-Berry 2026 (bioRxiv 2026.05.08.723728): replaces the empirical theta curvature parameter with a mechanistic cytochrome-b6f electron transport capacity. See docs/proposals/johnson_berry.md."
                  style={{
                    fontSize: 9.5,
                    padding: '3px 10px',
                    borderRadius: 5,
                    background: active ? '#4a7fe2' : 'var(--color-background-secondary)',
                    border: '0.5px solid var(--color-border-tertiary)',
                    color: active ? '#fff' : 'var(--color-text-primary)',
                    cursor: 'pointer',
                    fontWeight: active ? 600 : 400
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {(par.photochemistry_model ?? 'fvcb') === 'johnson_berry' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px 16px', marginBottom: 4 }}>
                <Sld
                  k="Cb6f_max25"
                  val={(par.Cb6f_max25 as number) ?? 1.4 * ((par.Jmax_Vcmax_ratio as number) ?? 1.67) * ((par.Vcmax25 as number) ?? 120)}
                  set={setP}
                  min={50}
                  max={600}
                  step={5}
                  label="Cb6f_max25"
                  unit=" µmol e⁻/m²/s"
                  color="#4a7fe2"
                  tip="[est sp:multi] Max cytochrome b6f electron flow at 25°C. Default: 1.4 × Jmax25 (paper reports 1-1.8× across 601 A-Ci curves, cross-species)."
                />
                <Sld
                  k="alpha1"
                  val={(par.alpha1 as number) ?? (par.alpha as number) ?? 0.3}
                  set={setP}
                  min={0.05}
                  max={0.6}
                  step={0.01}
                  label="α₁ (PSI light fraction)"
                  unit=""
                  color="#4a7fe2"
                  tip="[est] Combined leaf-absorptance × PSI-fraction term. Defaults to the same value as the FvCB α slider."
                />
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
                η (PSI:PSII ratio, computed from Cc and Γ*, not user-set):{' '}
                {typeof m?.eta === 'number' ? m.eta.toFixed(4) : '—'}
              </div>
            </>
          )}

          <div style={{ fontSize: 9.5, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
            Literature presets:{' '}
            {LIT_PRESETS.map((p) => (
              <button
                key={p.n}
                title={p.src}
                onClick={() => Object.entries(p.e).forEach(([k, v]) => setE(k as keyof Env, v as number))}
                style={{ fontSize: 9.5, padding: '1px 6px', margin: '0 3px 3px 0', borderRadius: 8, background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
              >
                {p.n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
