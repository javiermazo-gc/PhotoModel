# Model Limitations & What It Can/Cannot Tell You

## What Kind of Model Is This?
Steady-state algebraic kinetic model. No time derivatives. No transients.
Each slider position = one new steady state computed instantly.

Pool sizes are back-calculated from fluxes at steady state using:
`[S] = Km × v / (Vmax − v)`
This is valid at steady state but pools don't **set** the fluxes — they're diagnostic.

## What It CAN Tell You
- How A changes with CO₂, temperature, light under FvCB assumptions
- Relative size of photorespiratory flux vs carboxylation under different conditions
- How pool_2PG accumulation (low PGLP1) reduces A via Loop 1
- How different bypass designs change Γ*_eff and estimated A_bypass
- Which bypass type diverts the most glycolate given current pool size
- Mechanistic differences between Kebeish, South, cBHAC, McG
- MCA: which parameters most control bypass_flux and A

## What It CANNOT Tell You
- Transient responses (light flashes, CO₂ step changes)
- Whether a bypass saturates or becomes unstable under specific conditions
- Quantitative A_bypass predictions (bypass Vmax is unmeasured — [usr⚠])
- CrGDH behaviour in planta (electron acceptor unknown — affects South, cBHAC, McG)
- What happens when pool sizes are limited by transport capacity
- Species-specific values for Srel, Ki_TPI, Ki_SBPase, GDC Km — all from other species

## Parameters Most Urgently Needing Arabidopsis Measurement
| Parameter | Default | Source | Method to measure |
|---|---|---|---|
| `bypass_enzyme_Vmax25` | 5 µmol/m²/s | [usr⚠] | Enzyme assay in leaf extracts of transgenic lines |
| `PGLP_Vmax25` | 300 µmol/m²/s | [usr⚠] | Enzyme assay, compare OE/AS lines |
| `Srel25` | 2590 Pa/Pa | [sp:spinach] | 14CO₂/O₂ discrimination, Arabidopsis RuBisCO |
| `CrGDH Km(glycolate)` | 0.30 mM | [sp:Chlamydomonas] | Enzyme assay, CrGDH protein |
| `pep_fraction` (McG) | 0.10 | [est] | 13C-bicarbonate incorporation in McG lines |
| `Ki_TPI` | 0.066 mM | [sp:spinach] | Enzyme assay, AtTPI |

## The Calvin Cycle Abstraction
The FvCB model abstracts away:
- Individual CBB enzyme steps (PGK, GAPDH, PRK, FBPase, SBPase, etc.)
- Chloroplast ATP/ADP pools explicitly
- Post-translational regulation beyond Trx f
- Mesophyll conductance spatial gradients

Glycolate and photorespiration are **downstream of oxygenation**, not part of CBB.
They appear only in the PR/Bypass/Advanced tabs.

## Jmax Parameterisation Note
This model uses Bernacchi 2003 values (Ha=43900, Hd=200000, dS=640).
The `plantecophys` R package uses Ha=29680, dS=631.88 from a broader compilation.
Both are valid; values differ by ~10% at 35°C. Not an error, a choice.

## Johnson-Berry Electron Transport Model (opt-in)
When `photochemistry_model: 'johnson_berry'` is selected instead of the
default FvCB path:
- The paper's own validation assumed infinite mesophyll conductance
  (`Cc = Ci`); this model already applies a scalar `Cc_Ci` correction
  regardless of which electron-transport formula is active, so this is no
  worse than the model's existing simplification, but not a more rigorous
  gm treatment either.
- The default `Cb6f_max25 = 1.4 × Jmax25` conversion factor is an empirical
  regression from a cross-species dataset (601 A-Ci curves; the paper
  reports 1-1.8× across species) [est sp:multi] — not an
  Arabidopsis-specific measurement, same caveat tier as `Srel25` or `CrGDH
  Km` elsewhere in this model.
- `alpha1` (the combined leaf-absorptance × PSI-fraction term) defaults to
  the same numeric value as the FvCB path's `alpha` [est] — a simplifying
  choice, not a measured equivalence.
- `eta`'s range (1.0-1.125, verified both analytically and in
  `src/model/__tests__/johnsonBerry.test.ts`) means the practical effect of
  switching models is concentrated in the *shape* of the light-response
  curve (smoother, slightly lower A at intermediate light — see
  `docs/proposals/johnson_berry.md`), not a large CO2-sensitivity swing.
