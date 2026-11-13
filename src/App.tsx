import { useMemo, useState } from 'react';
import { ENV_DEF, PAR_DEF } from './data/metadata';
import { runModel, SCENARIOS, type BypassType, type Env, type Params } from './model';
import { ControlPanel } from './components/ControlPanel';
import { MetabolicMap } from './components/MetabolicMap';
import { RightPanel } from './components/RightPanel';
import { Legend } from './components/panels';

type ModuleTab = 'core' | 'pr' | 'bypass' | 'advanced';
type RightTab = 'metrics' | 'bypass' | 'pools';

const TAB_INFO: [ModuleTab, string, string][] = [
  ['core', '🌿 Core', 'Carbon fixation — the basics'],
  ['pr', '🔄 Photorespiration', 'The oxygenation cycle and enzyme pools'],
  ['bypass', '⚡ Bypass', 'Engineering routes to reduce photorespiration'],
  ['advanced', '⚙ Advanced', 'Kinetic parameters, scenarios, uncertainty']
];

export default function App() {
  const [env, setEnv] = useState<Env>(ENV_DEF);
  const [par, setPar] = useState<Params>(PAR_DEF);
  const [bypassType, setBypassType] = useState<BypassType>('kebeish');
  const [bypassActive, setBypassActive] = useState(false);
  const [scenario, setScenario] = useState('WT');
  const [moduleTab, setModuleTab] = useState<ModuleTab>('core');
  const [rightTab, setRightTab] = useState<RightTab>('metrics');
  const [activeInfo, setActiveInfo] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  const switchModule = (tab: ModuleTab) => {
    setModuleTab(tab);
    if (tab === 'core') setRightTab('metrics');
    if (tab === 'pr') setRightTab('pools');
    if (tab === 'bypass') setRightTab('bypass');
    if (tab === 'advanced') setRightTab('metrics');
  };

  const setE = (k: keyof Env, v: number) => setEnv((e) => ({ ...e, [k]: v }));
  const setP = (k: string, v: number) => setPar((p) => ({ ...p, [k]: v }));
  const setPStr = (k: string, v: string) => setPar((p) => ({ ...p, [k]: v }));

  const applyScenario = (name: string) => {
    setScenario(name);
    const sc = SCENARIOS[name];
    if (!sc) return;
    const sp = sc.params;
    setPar((p) => ({
      ...PAR_DEF,
      ...p,
      ...(sp.PGLP_Vmax25 !== undefined ? { PGLP_Vmax25: sp.PGLP_Vmax25 } : {}),
      ...(sp.GDC_Vmax25 !== undefined ? { GDC_Vmax25: sp.GDC_Vmax25 } : {}),
      ...(sp.bypass_enzyme_Vmax25 !== undefined ? { bypass_enzyme_Vmax25: sp.bypass_enzyme_Vmax25 } : {}),
      ...(sp.pep_fraction !== undefined ? { pep_fraction: sp.pep_fraction } : {}),
      ...(sp.Ppc_Vmax25 !== undefined ? { Ppc_Vmax25: sp.Ppc_Vmax25 } : {}),
      ...(sp.malate_decarb_fraction !== undefined ? { malate_decarb_fraction: sp.malate_decarb_fraction } : {}),
      ...(sp.plgg1_suppression !== undefined ? { plgg1_suppression: sp.plgg1_suppression } : {})
    }));
    if (sp.bypass_active) {
      setBypassActive(true);
      setBypassType((sp.bypass_type as BypassType) ?? 'kebeish');
    } else {
      setBypassActive(false);
    }
  };

  const modelPar = useMemo<Params>(
    () => ({ ...par, bypass_active: bypassActive, bypass_type: bypassType }),
    [par, bypassActive, bypassType]
  );
  const m = useMemo(() => runModel(env, modelPar), [env, modelPar]);

  return (
    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, paddingBottom: '1rem' }}>
      <div style={{ padding: '7px 14px 4px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>Photosynthesis — FvCB verified model</div>
        <div style={{ fontSize: 9.5, color: 'var(--color-text-secondary)' }}>
          FvCB · Bernacchi 2001 · click arrows for enzyme info · click ● for metabolite info
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)' }}>
        {TAB_INFO.map(([t, l, tipText]) => (
          <button
            key={t}
            title={tipText}
            onClick={() => switchModule(t)}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: 11,
              fontWeight: moduleTab === t ? 600 : 400,
              background: moduleTab === t ? 'var(--color-background-primary)' : 'transparent',
              border: 'none',
              borderBottom: moduleTab === t ? '2px solid var(--color-text-primary)' : '2px solid transparent',
              color: moduleTab === t ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer'
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding: '4px 14px', fontSize: 9.5, color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
        {moduleTab === 'core' &&
          "What you're seeing: CO₂ fixed by RuBisCO (green arrows) vs RuBisCO activity. Sliders change the environment. Right panel shows the key outputs."}
        {moduleTab === 'pr' &&
          'Photorespiration: when RuBisCO grabs O₂ instead of CO₂, carbon goes on a costly detour through peroxisome and mitochondria (orange arrows). Pools show how full each step is.'}
        {moduleTab === 'bypass' &&
          'Bypass engineering: transgenic routes that short-circuit the photorespiratory loop, saving energy. Select a design — all Vmax values are placeholders until you measure them.'}
        {moduleTab === 'advanced' &&
          'Tune the kinetic constants that drive the model. Scenario buttons apply published genotype parameters.'}
      </div>

      <ControlPanel
        env={env}
        setE={setE}
        par={par}
        setP={setP}
        setPStr={setPStr}
        m={m}
        moduleTab={moduleTab}
        bypassActive={bypassActive}
        setBypassActive={setBypassActive}
        bypassType={bypassType}
        setBypassType={setBypassType}
        scenario={scenario}
        applyScenario={applyScenario}
      />

      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1, padding: 10, position: 'relative', minWidth: 0 }}>
          <MetabolicMap m={m} moduleTab={moduleTab} bypassActive={bypassActive} bypassType={bypassType} />
          <Legend show={showLegend} onToggle={() => setShowLegend((v) => !v)} />
        </div>
        <RightPanel
          m={m}
          rightTab={rightTab}
          setRightTab={setRightTab}
          activeInfo={activeInfo}
          setActiveInfo={setActiveInfo}
          bypassActive={bypassActive}
          env={env}
          par={par}
          modelPar={modelPar}
          scenario={scenario}
          applyScenario={applyScenario}
        />
      </div>
    </div>
  );
}
