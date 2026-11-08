# New Session Handoff Prompt

Use this to start a new chat session with full context.

---

## Context

We are building an interactive visual kinetic model of C3 photosynthesis and photorespiratory bypass engineering in *Arabidopsis thaliana*. The model is a React/SVG single-page app built as a self-contained HTML file.

**Working file**: `photosynthesis_model.html` (self-contained, ~286 KB, React 18 inlined)
**Source**: `minimal_map.tsx` (~4450 lines, React component)

## What It Is

Steady-state FvCB model with:
- 4 module tabs: Core (CBB only) | Photorespiration | Bypass | Advanced
- 4 bypass designs: Kebeish 2007 [At✓], South 2019 AP3 [sp:tobacco], cBHAC 2025 [sp:rice], McG 2025 [At✓]
- SVG metabolic map with clickable nodes and arrows (tooltips with biochemistry + uncertainty)
- Right panel: Metrics | Bypass outputs | Pool sizes + enzyme saturations
- Feedback loops: 2-PG→TPI/SBPase (Loop 1), Trx f→RCA+CBB (Loop 2), GDC sat→Vcmax (Loop 3)

## Critical Rules for This Codebase

1. **ALWAYS take a backup before any edit**: `cp minimal_map.tsx minimal_map.BACKUP_YYYYMMDD_HHMMSS.tsx`
2. **ONLY make surgical str_replace edits** — never replace whole blocks
3. **After any model change**, verify with: `node -e "const code=require('fs').readFileSync('app_compiled.js','utf8'); new Function('React','ReactDOM',code); console.log('OK')"`
4. **To rebuild HTML after tsx changes**: compile with Babel, then combine with inlined React from `node_modules`
5. **The visual layer and model layer are separate** — model = first ~500 lines of app_good.js, visual = everything after `function fw(f)`

## Known Errors Still To Fix (see 02_errors_and_status.md)

### HIGH — McG acetylCoA_modeA wrong
```javascript
// CURRENT (wrong):
const acetylCoA_modeA = bypass_flux * lipidFrac;
// FIX:
const acetylCoA_modeA = bypass_flux;
```

### MEDIUM — McG A_bypass NaN risk  
`flux_3pga_mcg` referenced but not defined in bypassMcG return. Remove term or add return key.

### LOW — O₂ solubility Ha
Change `-16000` to `-12600` in photoRespKinetic().

## Biochemistry Reference

**Kebeish**: 2 glycolate → 1 glycerate + 1 CO₂ (all stroma, EcGlcDEF + GCL + TSR)
**South AP3**: glycolate → malate (CrGDH + CuMS, stroma). CO₂ only via NADP-ME (conditional).
**cBHAC**: 2 glycolate → 1 OAA (CrGDH + BhcA-D, stroma). No CO₂, no NH₃.
**McG Mode A**: glycolate → AcCoA (CrGDH + MTK + MCL + GCL + TSR + GK). Net 1:1.
**McG Mode B**: 3-PGA + HCO₃⁻ → AcCoA (ENO1 + Ppc + MDH + MTK + MCL). Fixes CO₂.

**Key stoichiometry**:
- `glycerate_bypass = bypass_flux / 2` (Kebeish only — 1 glycerate per 2 glycolate)
- `CO2_bypass = bypass_flux / 2` (Kebeish only)
- South, cBHAC, McG: `glycerate_bypass = 0`
- cBHAC: `OAA_flux = bypass_flux / 2` (2 glycolate → 1 OAA)

## Model Uncertainty Notation
- `[At✓]` = measured in Arabidopsis
- `[C3 std]` = standard FvCB practice
- `[sp:X]` = measured in species X — use with caution
- `[est]` = estimated
- `[usr⚠]` = placeholder — must be measured
