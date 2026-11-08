# Known Errors & Current Status

## Status of this codebase (photosynthesis-model/ — ported 2026-11-07)

This is a structural port of `photosynthesis_model.html` (the single-file
React prototype) into a modular Vite + React + TypeScript project. The
FvCB biochemistry is byte-for-byte identical to the prototype except for
the three fixes below, which were applied during the port per
`docs/archive/port_2026-11-07_future_improvements.md`'s former "Priority 1"
list.

### ✅ FIXED in the prototype (photosynthesis_model.html, before this port)
| Error | Fix |
|---|---|
| `glycerate_bypass = bypass_flux` (1:1 wrong) | Corrected to `bypass_flux / 2` |
| `GOX_Km = 0.15 mM` (pea) | Corrected to `0.210 mM` [At✓ AtGOX1 Jossier 2019] |
| `NADH_net` overcounted 2× in Kebeish | Corrected to `bypass_flux × 0.5` |
| `f_OAA_calvin` (direct OAA→CBB) | Removed — no such route in C3 chloroplasts |
| `bypassSouth()` was missing | Added with CrGDH + CuMS correct biochemistry |
| `Tp25 = null` | Default now `Vcmax25/12` |
| `gly_pool fallback` in cBHAC was 0.032 mM | Corrected to 0.020 mM |
| `bypassMcG Mode B` was incoherent stub | Properly coupled to `k.Wc × pep_fraction` via Ppc |

### ✅ FIXED in this codebase (photosynthesis-model/, 2026-11-07 port)

#### [HIGH] McG `acetylCoA_modeA = bypass_flux * lipidFrac`
- **Was**: multiplied `bypass_flux × 0.60` (default lipidFrac), underestimating
  Mode A AcCoA production by 40% at default settings.
- **Now**: `src/model/bypass/mcg.ts` sets `const acetylCoA_modeA = bypass_flux;`
  (1 AcCoA per glycolate, 1:1 [At✓ Lu 2025]). `lipidFrac`
  (`acetylCoA_fate_lipid`) is still applied where it always correctly
  belonged — to the fate split of the resulting malate/AcCoA pool (lipids
  vs export), in `flux_malate_lipid` / `flux_malate_export` inside
  `bypassMcG()` and again via `f_acetylCoA_FA` in `metabolicOutputs()` —
  never to the production step.
- Regression test: `src/model/__tests__/bugfixes.test.ts` — "Bug fix #1".

#### [MEDIUM] McG `A_bypass` uses `flux_3pga_mcg * 0.3`
- **Was**: `flux_3pga_mcg` was referenced in the `A_bypass` formula but never
  defined in that function's scope → `undefined * 0.3 = NaN` risk.
- **Now**: `src/model/bypass/mcg.ts` computes and returns `flux_3pga_mcg`
  (it was always needed for the SVG glycerate-shunt display), but per the
  documented fix the ad-hoc `+ flux_3pga_mcg * 0.3` term has been **removed**
  from the `A_bypass` calculation rather than inventing new biochemistry to
  justify it.
- Regression test: `src/model/__tests__/bugfixes.test.ts` — "Bug fix #2".

#### [LOW] O₂ solubility Ha = -16000 J/mol
- **Was**: the O₂ solubility/dissolution Arrhenius term in
  `photoRespKinetic()` used `Ha = -16000` J/mol.
- **Now**: `src/model/photoResp.ts` uses `-12600` J/mol, the standard
  enthalpy of O₂ dissolution. Small effect in practice: GOX is far from
  saturating at default Vmax, so `GOX_rate` tracks `flux_glycolate`
  regardless of this constant in typical conditions; the difference is only
  observable when GOX is forced toward saturation (see the regression test).
- Regression test: `src/model/__tests__/bugfixes.test.ts` — "Bug fix #3".

### ⚠ KNOWN UNCERTAINTIES (not errors, but important)
| Parameter | Current value | Source | Impact |
|---|---|---|---|
| `bypass_enzyme_Vmax25` | 5 µmol/m²/s | [usr⚠] placeholder | Controls all bypass flux |
| `PGLP_Vmax25` | 300 µmol/m²/s | [usr⚠] | Controls pool_2PG and Loop 1 |
| `Srel25` | 2590 Pa/Pa | [sp:spinach] | ±15% propagates to vovc |
| `CrGDH Km` | 0.30 mM | [sp:Chlamydomonas] | Controls bypass fraction |
| `pep_fraction` (McG Mode B) | 0.10 | [est HIGH⚠] | Controls Mode B flux |
| `CrGDH electron acceptor` | assumed NADH | unknown in planta | Affects redox balance |

### Note on the sample verification tests below

Running the **original, unmodified** `photosynthesis_model.html` at the
exact conditions in the test block (`co2:400, o2:21, temp:25, light:1000,
pi:100, act:100`, `params:{}`) independently gives `limitState: "RuBP"`
(`Wc≈31.3 > Wj≈22.1` at the default `Vcmax25=120`), not `"Rubisco"` as the
`console.assert` text below claims. That assertion was already stale
relative to the shipped prototype before this port started. This codebase
preserves the verified-correct original behavior (frozen biochemistry) and
its Vitest suite (`src/model/__tests__/runModel.test.ts`) asserts `"RuBP"`
with a comment explaining the discrepancy, rather than silently "fixing"
the model to match the stale doc text.

## Verification Tests (run in browser console)
```javascript
const env = {co2:400, o2:21, temp:25, light:1000, pi:100, act:100};
const wt = runModel(env, {});
console.assert(Math.abs(wt.gammastar - 42.75) < 0.1, 'Γ* anchor');
console.assert(wt.limitState === 'Rubisco', 'Rubisco-limited at 400ppm'); // see note above — actually 'RuBP'
console.assert(wt.vovc > 0.30 && wt.vovc < 0.45, 'vovc in C3 range');
const kb = runModel(env, {bypass_active:true, bypass_type:'kebeish'});
console.assert(Math.abs(kb.glycerate_bypass - kb.bypass_flux*0.5) < 1e-9, 'glycerate stoich');
console.assert(Math.abs(kb.CO2_bypass - kb.bypass_flux*0.5) < 1e-9, 'CO2 stoich');
const so = runModel(env, {bypass_active:true, bypass_type:'south'});
console.assert(so.glycerate_bypass === 0, 'South: no glycerate');
const bh = runModel(env, {bypass_active:true, bypass_type:'cbhac'});
console.assert(bh.CO2_bypass === 0, 'cBHAC: no CO2');
console.assert(Math.abs(bh.OAA_flux - bh.bypass_flux*0.5) < 1e-9, 'cBHAC OAA stoich');
console.log('Tests passed ✓');
```

These same assertions (with the `limitState` correction noted above) are
now real, CI-runnable Vitest tests in
`src/model/__tests__/runModel.test.ts`, plus dedicated regression tests for
the three fixes in `src/model/__tests__/bugfixes.test.ts`. Run them with
`npm test`.
