import type { ModelOutput } from '../model';
import { InfoPop, LimitBanner, MCard } from './panels';

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

interface RightPanelProps {
  m: ModelOutput;
  rightTab: 'metrics' | 'bypass' | 'pools';
  setRightTab: (t: 'metrics' | 'bypass' | 'pools') => void;
  activeInfo: string | null;
  setActiveInfo: (v: string | null) => void;
  bypassActive: boolean;
}

export function RightPanel({ m, rightTab, setRightTab, activeInfo, setActiveInfo, bypassActive }: RightPanelProps) {
  return (
    <div style={{ width: 230, flexShrink: 0, borderLeft: '0.5px solid var(--color-border-tertiary)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        {([
          ['metrics', 'Metrics'],
          ['bypass', 'Bypass'],
          ['pools', 'Pools & Enz.']
        ] as const).map(([t, l]) => (
          <button
            key={t}
            onClick={() => setRightTab(t)}
            style={{
              flex: 1,
              padding: '6px 4px',
              fontSize: 9,
              fontWeight: rightTab === t ? 600 : 400,
              background: rightTab === t ? 'var(--color-background-primary)' : 'transparent',
              border: 'none',
              borderBottom: rightTab === t ? '2px solid var(--color-text-primary)' : '2px solid transparent',
              color: rightTab === t ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer'
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding: 10, overflowY: 'auto', flex: 1 }}>
        {rightTab === 'metrics' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5, marginBottom: 8 }}>
              <MCard label="Net A" value={num(m.A)} unit="µmol/m²/s" color="#1D9E75" onInfo={setActiveInfo} active={activeInfo === 'Net A'} />
              <MCard label="A_fvCB" value={num(m.A_fvCB)} unit="µmol/m²/s" onInfo={setActiveInfo} active={activeInfo === 'A_fvCB'} />
              {bypassActive && <MCard label="A_bypass" value={num(m.A_bypass)} unit="µmol/m²/s" color="#7F77DD" onInfo={setActiveInfo} active={activeInfo === 'A_bypass'} />}
              <MCard label="Limit" value={m.limitState as string} unit="" onInfo={setActiveInfo} active={activeInfo === 'Limit'} />
              <MCard label="Wc" value={num(m.Wc)} unit="µmol/m²/s" onInfo={setActiveInfo} active={activeInfo === 'Wc'} />
              <MCard label="Wj" value={num(m.Wj)} unit="µmol/m²/s" onInfo={setActiveInfo} active={activeInfo === 'Wj'} />
              <MCard label="Vc" value={num(m.Vc)} unit="µmol/m²/s" onInfo={setActiveInfo} active={activeInfo === 'Vc'} />
              <MCard label="Vo" value={num(m.Vo)} unit="µmol/m²/s" color="#D85A30" onInfo={setActiveInfo} active={activeInfo === 'Vo'} />
              <MCard label="Vo/Vc" value={num(m.vovc)} unit="ratio" onInfo={setActiveInfo} active={activeInfo === 'Vo/Vc'} />
              <MCard label="J" value={num(m.J)} unit="µmol e⁻/m²/s" onInfo={setActiveInfo} active={activeInfo === 'J'} />
              <MCard label="Γ*" value={num(m.gammastar)} unit="µmol/mol" onInfo={setActiveInfo} active={activeInfo === 'Γ*'} />
              <MCard label="Rd" value={num(m.Rd)} unit="µmol/m²/s" onInfo={setActiveInfo} active={activeInfo === 'Rd'} />
              <MCard label="dA fb" value={num(m.dA_feedback)} unit="µmol/m²/s" onInfo={setActiveInfo} active={activeInfo === 'dA fb'} />
              <MCard label="Trx f" value={num(m.trxf_red)} unit="0–1" color="#533AB7" onInfo={setActiveInfo} active={activeInfo === 'Trx f'} />
            </div>
            <InfoPop metric={activeInfo} onClose={() => setActiveInfo(null)} />
            <div style={{ marginTop: 8 }}>
              <LimitBanner m={m as any} />
            </div>
          </>
        )}

        {rightTab === 'bypass' && (
          <>
            {!bypassActive ? (
              <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Bypass is inactive. Switch to the Bypass tab and enable it to see pathway-specific outputs here.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 6, textTransform: 'capitalize' }}>{m.bypass_type as string} bypass</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5, marginBottom: 8 }}>
                  <MCard label="bypass_flux" value={num(m.bypass_flux)} unit="µmol/m²/s" color="#7F77DD" onInfo={setActiveInfo} active={false} />
                  <MCard label="fraction" value={num(m.bypass_fraction)} unit="0–1" onInfo={setActiveInfo} active={false} />
                  <MCard label="CO₂_bypass" value={num(m.CO2_bypass)} unit="µmol/m²/s" onInfo={setActiveInfo} active={false} />
                  <MCard label="glycerate_bp" value={num(m.glycerate_bypass)} unit="µmol/m²/s" onInfo={setActiveInfo} active={false} />
                  <MCard label="OAA_flux" value={num(m.OAA_flux)} unit="µmol/m²/s" onInfo={setActiveInfo} active={false} />
                  <MCard label="AcCoA total" value={num(m.acetylCoA_total)} unit="µmol/m²/s" onInfo={setActiveInfo} active={false} />
                  <MCard label="NH₃ saved" value={num(m.NH3_saving)} unit="µmol/m²/s" color="#888" onInfo={setActiveInfo} active={false} />
                  <MCard label="ATP net" value={num(m.ATP_net)} unit="µmol/m²/s" onInfo={setActiveInfo} active={false} />
                  <MCard label="NADH net" value={num(m.NADH_net)} unit="µmol/m²/s" color="#378ADD" onInfo={setActiveInfo} active={false} />
                  <MCard label="γ*_eff" value={num(m.gammastar_eff)} unit="µmol/mol" onInfo={setActiveInfo} active={false} />
                </div>
                {num(m.risk_glyoxylate) > 0.5 && (
                  <div style={{ fontSize: 9, color: '#E24B4A', marginBottom: 4 }}>⚠ risk_glyoxylate = {num(m.risk_glyoxylate).toFixed(2)} — possible free glyoxylate accumulation (see South 2019 phenotype).</div>
                )}
                {num(m.risk_OAA) > 0.5 && <div style={{ fontSize: 9, color: '#E24B4A', marginBottom: 4 }}>⚠ risk_OAA = {num(m.risk_OAA).toFixed(2)} — OAA may exceed AspAT capacity.</div>}
                {num(m.risk_malate_valve) > 0.5 && <div style={{ fontSize: 9, color: '#E24B4A', marginBottom: 4 }}>⚠ risk_malate_valve = {num(m.risk_malate_valve).toFixed(2)} — exported carbon may exceed DiT capacity.</div>}
                {m.bypass_note && <div style={{ fontSize: 8.5, color: 'var(--color-text-tertiary)', marginTop: 6, lineHeight: 1.4 }}>{m.bypass_note as string}</div>}
              </>
            )}
          </>
        )}

        {rightTab === 'pools' && (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 6 }}>Enzyme saturation</div>
            {([
              ['GOX', m.GOX_sat],
              ['GDC', m.GDC_sat],
              ['GGAT', m.GGAT_sat],
              ['HPR1', m.HPR1_sat],
              ['PGLP1', m.PGLP_sat]
            ] as const).map(([label, v]) => (
              <SatBar key={label} label={label} value={num(v)} />
            ))}
            <div style={{ fontSize: 10, fontWeight: 600, margin: '10px 0 6px' }}>Pool sizes (steady-state)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5 }}>
              <MCard label="pool_2PG" value={num(m.pool_2PG)} unit="mM" onInfo={setActiveInfo} active={false} />
              <MCard label="glycolate" value={num(m.glycolate_pool)} unit="mM" onInfo={setActiveInfo} active={false} />
              <MCard label="glycine" value={num(m.glycine_pool)} unit="mM" onInfo={setActiveInfo} active={false} />
              <MCard label="glyoxylate" value={num(m.glyoxylate_pool)} unit="mM" onInfo={setActiveInfo} active={false} />
              <MCard label="HP" value={num(m.HP_pool)} unit="mM" onInfo={setActiveInfo} active={false} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SatBar({ label, value }: { label: string; value: number }) {
  const c = value > 0.75 ? '#E24B4A' : value > 0.5 ? '#e0b000' : '#1D9E75';
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: c }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div style={{ height: 5, background: 'var(--color-background-secondary)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, value * 100)}%`, background: c }} />
      </div>
    </div>
  );
}
