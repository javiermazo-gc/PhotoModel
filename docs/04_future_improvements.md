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

### McG GCL/TSR/GK tail
The malyl-CoA-glycerate cycle name refers to glycerate being produced via
GCL→TSR from recycled glyoxylate. Lu 2025 uses the same GCL/TSR/GK enzymes
as Kebeish for this arm. The model currently only shows Mode A AcCoA and
Mode B. The GCL tail producing 3-PGA should be added:
- `flux_tartronate_mcg = bypass_flux * 0.5`
- `flux_glycerate_mcg = flux_tartronate_mcg`
- `flux_3pga_mcg = flux_glycerate_mcg`

(Note: these three fields are already computed and returned by
`bypassMcG()` in this codebase — they were added incidentally while fixing
Bug #2 above, since `flux_3pga_mcg` needed a real definition. What remains
undone from this item is giving the GCL/TSR/GK tail its own three-node,
three-arrow chain in the SVG map, matching the Kebeish layout, rather than
the single collapsed "glycerate shunt" arrow currently drawn in
`src/components/MetabolicMap.tsx`.)

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

### McG visual layout
- The two-branch layout (GCL row + MTK/MCL row) is conceptually correct
- MalylCoA and Malate labels were being confused with wrong NODE_INFO
  entries
- Fix: Add proper `malylcoa` and `malate_mcg` entries to NODE_INFO (already
  present in `src/data/metadata.ts` in this codebase)

### Bypass arrow entry from glycolate
All CrGDH bypasses should show an explicit arrow from glycolate →
glyoxylate (CrGDH step) in stroma, clearly labelled, before diverging to
their respective paths. (Present in this codebase's `MetabolicMap.tsx` as
the single `ak="gcl"` arrow feeding into each bypass compartment box.)

### Peroxisome layout
- Glycolate (entry, top-left), Glycine (top-right), HPP (bottom-right),
  Glycerate (bottom-left offset from glycolate to separate vertical arrows)
- GOX step shown inside perox as horizontal arrow glycolate→glyoxylate

### Full per-bypass-design SVG fidelity (carried over from the 2026-11-07 port)
The original prototype (`minimal_map_BACKUP_20261007.tsx`) hand-tuned
~50+ coordinate constants per module tab × bypass type (a 600×dynamic-height
SVG whose compartment box sizes, node positions, and arrow bends all shift
depending on which tab and bypass design is active). This port's
`src/components/MetabolicMap.tsx` reproduces the same compartments, the
same nodes, the same ARROW_INFO/NODE_INFO tooltip content, and the same
real flux values for all four bypass designs, but on a single fixed-size
canvas with simplified, hand-picked coordinates rather than the original's
fully dynamic per-state layout engine. Restoring full 1:1 geometric
fidelity (dynamic SVG height per tab/bypass combination, the exact original
node offsets, and the full multi-arrow McG GCL/TSR/GK tail) is a good next
SVG-polish task.

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

### Light response curves + Johnson–Berry electron transport model
See `docs/proposals/johnson_berry.md` for the full design. Briefly: add a
mechanistic alternative to the empirical FvCB electron-transport term
(`kin()`'s `J` calculation currently uses the non-rectangular hyperbola with
an empirical `theta` curvature parameter) based on Lamour, Chave, Johnson,
Berry et al. 2026 (bioRxiv 2026.05.08.723728), which models electron
transport via cytochrome b6f capacity instead. `kin()` already computes
`Cc` and `Γ*` before the `J` line, which this formulation needs — no new
environmental inputs required, just a `photochemistry_model` toggle
(default `'fvcb'`, preserving all current output) and new parameters
(`Cb6f_max`, `α₁`). The difference is mainly visible as a smoother,
slightly lower light-response curve at intermediate light (validated
against 1,422 A–Q curves across 146 species in the source paper) — pairs
naturally with a light-response-curve chart feature, since at this model's
single-point reference conditions the system is already Rubisco-limited and
the swap is otherwise invisible. Suggested priority: medium.

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
