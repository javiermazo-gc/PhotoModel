# Future Improvements & Roadmap (active backlog)

Priority 1 (the three documented model bugs) is resolved as of the
2026-11-07 port to this modular TypeScript project — see
`docs/02_errors_and_status.md` and
`docs/archive/port_2026-11-07_future_improvements.md` (historical
port-day snapshot) for details. Priorities 2-5 below are carried forward
unchanged from the original prototype's roadmap and remain the active
backlog for this codebase. See `docs/proposals/` for point-in-time design
proposals for specific upcoming features (e.g. the Johnson-Berry electron
transport model).

## Priority 2 — Model Completeness

### McG GCL/TSR/GK tail — done (2026-11-08)
The malyl-CoA-glycerate cycle name refers to glycerate being produced via
GCL→TSR from recycled glyoxylate. Lu 2025 uses the same GCL/TSR/GK enzymes
as Kebeish for this arm. `flux_tartronate_mcg`/`flux_glycerate_mcg`/
`flux_3pga_mcg` were already computed by `bypassMcG()`; `MetabolicMap.tsx`
now gives this tail its own three-node, three-arrow chain (Glyox. →
Tartr.-SA → Glycerate → 3-PGA, same visual treatment as the Kebeish chain),
plus the separate malyl-CoA/malate sub-row (MTK/MCL step) directly beneath
it, connected by a dashed fork line — matching the original prototype's
`minimal_map_BACKUP_20261007.tsx` layout.

### Kebeish `A_bypass` CO₂_saved_mito
The benefit from reduced mitochondrial CO₂ release (native PR reduced by
bypass) may be undercounted. Should explicitly compute
`CO2_saved_mito = pr.flux_CO2_rel * (1 - nf)` and pass to
`_A_bypass_estimate`.

(Note: `src/model/bypass/kebeish.ts` already does exactly this — it was
correct in the ported prototype. This item can likely be closed, but is
kept here for continuity with the original roadmap language pending a
second look.)

### `pool_2PGA_modeB` for McG Mode B
2-phosphoglycerate (PGAM product) pool for metabolomics comparison:
`const pool_2PGA_modeB = (params.pool_3PGA_est ?? 1.0) * 0.17`
Note: this is 2-phospho**glycerate** (normal glycolytic metabolite), NOT
2-phospho**glycolate** (toxic oxygenation product). Must be clearly
labelled. Not yet implemented in `bypassMcG()`.

## Priority 3 — SVG Improvements

Status as of 2026-11-08: `src/components/MetabolicMap.tsx` was rewritten as
a faithful 1:1 geometric port of `minimal_map_BACKUP_20261007.tsx`'s
dynamic layout engine — the same `nd`/`sn` coordinate tables, the same
`stromaH`/`PEROX_*`/`MITO_*`/cytosol sizing formulas (which shift per
module tab × bypass design, exactly as in the original), the same
per-bypass-type branches, and self-contained mouse-wheel zoom + click-drag
pan. Verified by: (a) side-by-side screenshots against
`photosynthesis_model.html` for Core/PR/Advanced and all four bypass
designs, and (b) a DOM bounding-box check confirming every SVG element in
both the port and the original stays within the shared `viewBox` (zero
off-canvas elements) for each state. This resolves the items that used to
be listed here (McG visual layout, bypass arrow entry from glycolate,
peroxisome layout, full per-bypass-design fidelity).

What's left is genuinely cosmetic:
- The zoom (+/reset%/−) toolbar sits in its own row above the map pane
  rather than inline in the page header next to the title, since
  `MetabolicMap.tsx` owns its zoom/pan state locally instead of threading
  it through `App.tsx` props.
- `SatPill` (enzyme-saturation percentage pill) and `LimitBanner` exist in
  `src/components/primitives.tsx` / `panels.tsx` and are kept available,
  but — matching the original, where both are defined and never actually
  rendered in the main map/right-panel — `SatPill` is unused on the map.
  `LimitBanner` *is* rendered in this port's Metrics tab even though the
  original never called it either; this is a deliberate small improvement
  kept from the previous pass, not a fidelity gap.

## Priority 4 — New Features

### MCA panel
Expose the `mca()` function results in the Advanced tab as a ranked bar
chart showing control coefficients for bypass_flux and A. (`mca()` does not
exist in the current model — this is still a from-scratch feature, in both
the original prototype and this port.)

### Scenario comparison chart
A small bar chart in the right panel comparing A across all scenarios at
current env conditions. `compareScenarios()` already exists in
`src/model/runModel.ts` and is exported — only the chart UI is missing.

### Export/import params
Save/load slider state as JSON for reproducibility.

### Temperature response curves
A mini chart showing A vs temperature at current params.

### Johnson–Berry electron transport model — ✅ IMPLEMENTED (2026-11-08)
Mechanistic cytochrome-b6f alternative to the empirical FvCB electron
transport term, selectable via `params.photochemistry_model` (default
`'fvcb'`, preserving all prior output byte-for-byte). See
`src/model/electronTransport.ts`, `src/model/kin.ts`, and
`docs/proposals/johnson_berry.md` for the implementation, the exact
equations (verified directly against the source PDF's rendered equations —
an earlier AI-summarized reading of the paper had gotten the eta formula
subtly wrong), and test coverage. Exposed in the UI as an "Electron
transport model" toggle on the Advanced tab.

### Light response curves (still open)
A mini chart showing A vs light (PAR) at current params. This is exactly
where the FvCB-vs-Johnson-Berry difference becomes visible to a user — at
this model's default single-point reference conditions (400 ppm, 1000
µmol) the system is already Rubisco-limited, where the two electron
transport models converge and the difference is easy to miss without a
curve. A verified light sweep at the Johnson-Berry defaults (400 ppm CO2,
25C) shows A roughly 15-20% lower than FvCB in the 50-800 µmol range
(e.g. 12.48 vs 15.32 µmol/m²/s at 400 µmol), narrowing to ~0% once Rubisco
becomes limiting above ~1500-2000 µmol, where both models predict the same
A (30.15 µmol/m²/s in this sweep) — this chart would make that pattern
visible interactively rather than requiring a console script to see it.

## Priority 5 — Future Model Extensions

### Mesophyll conductance (gm) properly
Currently `Cc = co2 × ci_ca × Cc_Ci` — a simple scalar correction. A proper
gm model would track CO₂ drawdown from intercellular space to chloroplast
stroma.

### C4 adaptation
The model is pure C3. A C4 module would need a bundle sheath/mesophyll
two-cell model.

### Dynamic simulation
Converting the steady-state model to a simple ODE system for pool dynamics
would allow light-fleck responses and CO₂ step responses.

### Metabolomics fitting
Interface to fit model parameters against measured metabolite pools
(glycolate, glycine, 2-PG etc.) from metabolomics data.
