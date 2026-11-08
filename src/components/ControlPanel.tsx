import { COL, ECO_PRESETS, LIT_PRESETS } from '../data/metadata';
import { SCENARIOS, type BypassType, type Env, type ModelOutput, type Params } from '../model';
import { Sld } from './panels';

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
              fontSize: 8.5,
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

      {moduleTab === 'bypass' && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--color-background-primary)', borderRadius: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <input type="checkbox" checked={bypassActive} onChange={(e) => setBypassActive(e.target.checked)} />
              Bypass active
            </label>
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
            {(['kebeish', 'south', 'cbhac', 'mcg'] as BypassType[]).map((t) => (
              <button
                key={t}
                onClick={() => setBypassType(t)}
                style={{
                  fontSize: 9,
                  padding: '3px 10px',
                  borderRadius: 5,
                  background: bypassType === t ? COL.keb : 'var(--color-background-secondary)',
                  border: '0.5px solid var(--color-border-tertiary)',
                  color: bypassType === t ? '#fff' : 'var(--color-text-primary)',
                  cursor: 'pointer',
                  fontWeight: bypassType === t ? 600 : 400,
                  textTransform: 'capitalize'
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <Sld
            k="bypass_enzyme_Vmax25"
            val={(par.bypass_enzyme_Vmax25 as number) ?? 5}
            set={setP}
            min={0}
            max={40}
            step={0.5}
            label="Bypass enzyme Vmax25"
            unit=" µmol/m²/s"
            color={COL.keb}
            tip="[usr⚠] placeholder — must be measured in your transgenic lines."
          />
        </div>
      )}

      {moduleTab === 'advanced' && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--color-background-primary)', borderRadius: 7 }}>
          <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 6 }}>Scenarios (published genotypes)</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {Object.entries(SCENARIOS).map(([name, sc]) => (
              <button
                key={name}
                onClick={() => applyScenario(name)}
                title={sc.label}
                style={{
                  fontSize: 8.5,
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

          <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 6 }}>Kinetic constants</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px 16px' }}>
            <Sld k="Vcmax25" val={(par.Vcmax25 as number) ?? 120} set={setP} min={20} max={300} step={5} label="Vcmax25" unit=" µmol/m²/s" color="#E24B4A" tip="[usr] fit from your ACi curves." />
            <Sld k="Srel25" val={(par.Srel25 as number) ?? 2590} set={setP} min={1500} max={3500} step={10} label="Srel25" unit=" Pa/Pa" color="#e0b000" tip="[sp:spinach ⚠] no direct Arabidopsis measurement." />
            <Sld k="ci_ca" val={(par.ci_ca as number) ?? 0.7} set={setP} min={0.3} max={1} step={0.01} label="ci/ca" unit="" color="#e0b000" />
            <Sld k="PGLP_Vmax25" val={(par.PGLP_Vmax25 as number) ?? 300} set={setP} min={10} max={500} step={5} label="PGLP1 Vmax25" unit=" µmol/m²/s" color="#E24B4A" tip="[usr⚠] placeholder." />
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
                    fontSize: 9,
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
              <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
                η (PSI:PSII ratio, computed from Cc and Γ*, not user-set):{' '}
                {typeof m?.eta === 'number' ? m.eta.toFixed(4) : '—'}
              </div>
            </>
          )}

          <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
            Literature presets:{' '}
            {LIT_PRESETS.map((p) => (
              <button
                key={p.n}
                title={p.src}
                onClick={() => Object.entries(p.e).forEach(([k, v]) => setE(k as keyof Env, v as number))}
                style={{ fontSize: 8.5, padding: '1px 6px', margin: '0 3px 3px 0', borderRadius: 8, background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
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
