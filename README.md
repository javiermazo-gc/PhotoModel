# Photosynthesis Model

A steady-state kinetic model (Farquhar-von Caemmerer-Berry, FvCB-type) of
C3 photosynthesis in *Arabidopsis thaliana*, extended with four
photorespiratory-bypass metabolic-engineering designs (Kebeish, South AP3,
cBHAC, McG dual-cycle) and an interactive SVG metabolic map for exploring
how environment, kinetic parameters, and bypass engineering choices change
net carbon assimilation.

This project is a structural port of an earlier single-file React
prototype (`photosynthesis_model.html`) into a modular Vite + React +
TypeScript codebase with a real test suite. **The biochemistry is
unchanged** except for three documented bug fixes (see
[`docs/02_errors_and_status.md`](docs/02_errors_and_status.md)) — this is a
refactor and bug-fix pass, not a rewrite of the science.

The earliest prototype stage of this project (pre-dating the single-file
HTML version) lives on the [`legacy-prototype`](../../tree/legacy-prototype)
branch with its own original commit history, kept for reference rather than
merged into the active codebase.

## Running it

```bash
npm install
npm run dev       # starts the Vite dev server
```

Other scripts:

```bash
npm run build      # tsc --noEmit && vite build
npm run preview    # preview the production build
npm test           # vitest run
npm run test:watch # vitest, watch mode
npm run typecheck  # tsc --noEmit
```

## Testing

`npm test` runs the Vitest suite in `src/model/__tests__/`:

- `runModel.test.ts` — converts the "Verification Tests" `console.assert`
  block from the original prototype's docs into real `expect(...)`
  assertions (Γ* anchor, limitation state, Vo/Vc range, and the
  stoichiometry of all four bypass designs), plus sanity checks that every
  bypass design produces finite, non-negative output across env conditions.
- `bugfixes.test.ts` — one regression test per documented bug fix (see
  below), asserting the corrected behavior so it can't silently regress.

## Architecture

The model lives entirely under `src/model/` and is pure, side-effect-free
TypeScript — no React, no DOM. The module chain (unchanged from the
original prototype) is:

```
kin() → photoResp() → photoRespKinetic() → bypass*() → metabolicOutputs() → trxfState() → kinFeedback() → flat output
```

| File | Responsibility |
|---|---|
| `src/model/constants.ts` | Shared physical constants (`R`, `T25`) and Arrhenius helpers (`_arr`, `_peaked`, `_clamp`) |
| `src/model/kin.ts` | `kin()` — the **frozen** Bernacchi 2001/2002 FvCB core (Wc/Wj/Wp limitations) |
| `src/model/photoResp.ts` | `photoResp()` (stoichiometric PR fluxes) and `photoRespKinetic()` (enzyme-level saturation & pool sizes — GOX, GDC, GGAT, HPR1, PGLP1) |
| `src/model/bypass/kebeish.ts` | Kebeish 2007 bypass: 2 glycolate → 1 glycerate + 1 CO₂ |
| `src/model/bypass/south.ts` | South 2019 AP3 bypass: glycolate → malate, CO₂ via NADP-ME |
| `src/model/bypass/cbhac.ts` | cBHAC 2025 bypass: 2 glycolate → 1 OAA |
| `src/model/bypass/mcg.ts` | McG (Lu 2025) dual-cycle bypass: Mode A (glycolate → AcCoA) + Mode B (PEP + HCO₃⁻ → AcCoA) |
| `src/model/metabolicOutputs.ts` | Carbon/nitrogen/redox accounting downstream of whichever bypass is active |
| `src/model/trxfState.ts` | Thioredoxin f redox state (light-dependent) |
| `src/model/kinFeedback.ts` | Re-derives A with the three feedback loops (2-PG inhibition, Trx f regulation, GDC back-pressure) layered on top of `kin()` |
| `src/model/runModel.ts` | The single entry point `runModel(env, params)`, plus `SCENARIOS`/`runScenario`/`compareScenarios` |

`src/data/metadata.ts` holds UI-facing content only (tooltip copy for every
enzyme/metabolite, the confidence-colour legend, environment/literature
presets) — no biochemistry. `src/components/` has the SVG metabolic map,
control panel, and metrics/bypass/pools side panel; `src/App.tsx` wires it
all together.

See `docs/01_architecture.md` for the original architecture notes (module
chain, feedback loops, uncertainty notation) and `docs/03_model_limitations.md`
for what this steady-state algebraic model can and cannot tell you.

## The three bug fixes applied during this port

See `docs/02_errors_and_status.md` for full detail and
`src/model/__tests__/bugfixes.test.ts` for the regression tests.

1. **[HIGH]** McG `acetylCoA_modeA` was `bypass_flux * lipidFrac` (wrong —
   underestimated AcCoA production by 40% at default settings). Fixed to
   `bypass_flux` (1:1 stoichiometry per Lu 2025); `lipidFrac` now applies
   only to the downstream fate split (lipids vs export).
2. **[MEDIUM]** McG `A_bypass` referenced `flux_3pga_mcg * 0.3`, where
   `flux_3pga_mcg` was never defined in that function's scope
   (`undefined * 0.3 = NaN`). The term was removed from `A_bypass` per the
   documented fix.
3. **[LOW]** The O₂ solubility/dissolution Arrhenius enthalpy was
   `-16000 J/mol`; corrected to `-12600 J/mol`, the standard enthalpy of O₂
   dissolution.

## UI port fidelity

`src/components/MetabolicMap.tsx` is a 1:1 geometric port of the original
prototype's SVG metabolic map, including the coordinate constants that
shift per module tab and per active bypass design (dynamic SVG height,
distinct node offsets for each of the four bypass pathways, the multi-step
GCL/TSR/GK tail plus malyl-CoA/malate sub-row for McG, and mouse-wheel
zoom / click-drag pan). `src/components/RightPanel.tsx` likewise restores
the original's full right-panel output: the scenario-comparison table, the
uncertainty log, per-bypass metabolic-fates breakdown, and the Pools &
Enz. active-feedback/reference-only sections. See
`docs/04_future_improvements.md` (Priority 3) for the handful of remaining
cosmetic (non-geometric) differences.

## Development workflow

Solo-maintained project; lightweight trunk-based flow:

- `main` stays green — every push/PR runs `.github/workflows/ci.yml`
  (`npm ci && npm run typecheck && npm test && npm run build`) via GitHub
  Actions. Check the Actions tab before trusting a merge.
- For anything beyond a one-line fix, branch off (`feat/...`, `fix/...`,
  `docs/...`), open a PR so CI runs, then merge into `main` once green. Quick
  fixes can go straight to `main` if you've already run `npm test` locally.
- Any change to the model biochemistry (`src/model/`) needs: a regression
  test in `src/model/__tests__/`, and an entry in
  `docs/02_errors_and_status.md` using the project's uncertainty notation
  (`[At✓]`/`[sp:X]`/`[est]`/`[usr⚠]` — see `docs/01_architecture.md`). The
  FvCB core in `src/model/kin.ts` is frozen by design — see that doc before
  touching it.
