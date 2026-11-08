# Architecture & Key Decisions

## Model Type
**Steady-state algebraic kinetic model** — not a dynamic ODE model.
No time derivatives. Every slider move computes a new steady state instantly.
Pool sizes are back-calculated from fluxes using MM inverse: `[S] = Km × v / (Vmax − v)`

## Entry Point
`runModel(env, params)` → flat object with all outputs.
`env`: `{ co2(ppm), o2(%), temp(°C), light(µmol/m²/s), pi(0-100), act(0-100) }`

## Module Chain
```
kin() → photoResp() → photoRespKinetic() → bypass*() → metabolicOutputs() → trxfState() → kinFeedback() → flat output
```

## FvCB Core (`kin()`) — FROZEN
- Bernacchi 2001/2002/2003 parameterisation [C3 std]
- Three limitations: Wc (RuBisCO), Wj (electron transport), Wp (TPU)
- `Wj = J × Cc / (4×Cc + 8×GS)` — correct Cc-based Bernacchi 2002 formula
- `vovc = (Oc×1000) / (Srel×Cc)` — dimensionally correct
- `Tp25 = Vcmax25/12` default (TPU rare in Arabidopsis but included)
- **DECISION**: kin() is never modified. kinFeedback() wraps it for bypass comparison.

### Electron transport (`J`) — two selectable formulations
`params.photochemistry_model` gates which formula computes `J`, default
`'fvcb'` (preserves all the above byte-for-byte). `'johnson_berry'` selects
a mechanistic cytochrome-b6f-based alternative (Lamour, Chave, Johnson,
Berry et al. 2026) that replaces the empirical `theta` curvature parameter.
Both paths share the same downstream `Wj = J×Cc/(4×Cc+8×GS)` conversion —
the JB equations only replace how `J` itself is computed, not how it's
turned into a carboxylation rate. See `src/model/electronTransport.ts` and
`docs/proposals/johnson_berry.md` [est sp:multi] for the equations,
parameter mapping, and verification against the source PDF.

## Photorespiration (`photoResp()`)
Stoichiometric fluxes only. All 1:1 with Vo except:
- `flux_glycolate = 2 × Vo` (2C per oxygenation)
- `flux_CO2_rel = 0.5 × Vo` (GDC: 1 CO₂ per 2 glycine)
- `flux_NH3 = Vo` (1 NH₃ per oxygenation)
- `glycerate_bypass = 0.5 × bypass_flux` (1 glycerate per 2 glycolate via GCL→TSR)

## Bypass Designs

### Kebeish [At✓ 2007]
EcGlcDEF (E.coli) in chloroplast stroma. GlxR→TSR→GLYK.
Net: 2 glycolate → 1 glycerate + 1 CO₂ (both stay in chloroplast)
`CO2_bypass = 0.5 × bypass_flux` ✓
`glycerate_bypass = 0.5 × bypass_flux` ✓ (corrected from 1:1)

### South AP3 [sp:tobacco✓ 2019]
CrGDH + CuMS. Glycolate → glyoxylate → malate (via + AcCoA).
Net: glycolate → malate. `glycerate_bypass = 0`.
CO₂ only from NADP-ME decarboxylating malate (conditional, not stoichiometric).

### cBHAC [sp:rice✓ 2025]
CrGDH + BhcA-D. Net: 2 glycolate → 1 OAA. No CO₂, no NH₃.
OAA fate: MDH→malate (DiT1) or AspAT→aspartate (DiT2).
No direct OAA→CBB route in C3 chloroplasts.

### McG dual cycle [At✓ Lu 2025]
Mode A: CrGDH→MTK→MCL→GCL→TSR→GK. Net: glycolate → acetyl-CoA.
Mode B: ENO1(native)→Ppc(transgene)→MDH→MTK→MCL. 3-PGA + HCO₃⁻ → AcCoA + CO₂ fixed.
Uses BICARBONATE not CO₂ at Ppc → no RuBisCO competition.

## Feedback Loops (`kinFeedback()`)
- **Loop 1**: 2-PG → TPI + SBPase inhibition → Wj [At✓ Flügel 2017]
- **Loop 2**: Trx f → RCA + CBB enzymes → Vcmax, Wj [At✓ Xi 2026]
- **Loop 3**: GDC saturation → glyoxylate back-inhibition → Vcmax [At✓ dir. Timm 2012]

## UI Architecture
- 4 module tabs: Core | Photorespiration | Bypass | Advanced
- Right panel tabs: Metrics | Bypass | Pools & Enzymes
- `moduleTab` state drives what SVG layers are visible
- `rightTab` state drives right panel content
- SVG: 600px wide, compartments stacked (perox below glycolate, mito right of perox)
- Arrow width = `fw(flux)` = `max(0.4, min(sqrt(flux)*1.0, 4.5))`

## Pool Sizes
Valid steady-state estimates only. Two genuinely feed back into A:
1. `pool_2PG` → Loop 1 (TPI/SBPase inhibition)
2. `glycolate_pool` → bypass flux substrate
Others (glyoxylate, HP, glycine pools) are reference only — don't change A.
