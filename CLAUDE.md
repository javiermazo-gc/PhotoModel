# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev         # Vite dev server
npm run build        # tsc --noEmit && vite build
npm run typecheck    # tsc --noEmit only
npm test             # vitest run (all tests, single run)
npm run test:watch   # vitest watch mode
```

Run a single test file: `npx vitest run src/model/__tests__/bugfixes.test.ts`
Run a single test by name: `npx vitest run -t "acetylCoA_modeA"`

CI (`.github/workflows/ci.yml`) runs typecheck → test → build on every push/PR to `main`.

## Architecture

This is a steady-state algebraic kinetic model (FvCB-type) of C3
photosynthesis in Arabidopsis — **not** a dynamic ODE model. There are no
time derivatives; every call to `runModel()` computes a fresh steady state
from scratch. Pool sizes reported in the output are back-calculated from
fluxes via the Michaelis-Menten inverse (`[S] = Km × v / (Vmax − v)`) — they
are diagnostic, not state that evolves or feeds forward between calls.

### Module chain

`runModel(env, params)` in `src/model/runModel.ts` is the single entry
point and composes everything else in this fixed order:

```
kin() → photoResp() → photoRespKinetic() → bypass*() → metabolicOutputs() → trxfState() → kinFeedback() → flat output
```

Each stage takes the previous stages' outputs as plain arguments and
returns a plain object — there is no shared mutable state, no classes. This
matters when tracing a bug: the value you're chasing was computed in
exactly one of these functions and threaded through as a parameter from
there on.

- **`kin.ts`** — the FvCB core (Bernacchi 2001/2002/2003 kinetics; Wc/Wj/Wp
  limitations). **Frozen by design**: it is never modified to accommodate a
  bypass or feedback loop. `kinFeedback()` wraps/re-derives `A` afterward
  instead. Any change here needs a strong justification and a new
  regression test — see `docs/01_architecture.md` for why specific formulas
  (e.g. `Wj = J × Cc / (4×Cc + 8×GS)`) are chosen.
- **`photoResp.ts`** — two functions: `photoResp()` (pure stoichiometric
  fluxes off `Vo`) and `photoRespKinetic()` (enzyme-level saturation and
  pool-size estimates for GOX/GDC/GGAT/HPR1/PGLP1).
- **`bypass/{kebeish,south,cbhac,mcg}.ts`** — one file per photorespiratory
  bypass metabolic-engineering design. Each has genuinely different
  stoichiometry (see `docs/01_architecture.md` for the biochemistry of
  each) — do not assume one bypass's fix or pattern generalizes to another.
  `bypass/shared.ts` holds the few helpers actually common across all four.
- **`metabolicOutputs.ts`**, **`trxfState.ts`**, **`kinFeedback.ts`** —
  carbon/N/redox accounting, thioredoxin-f redox state, and the three
  feedback loops (2-PG→TPI/SBPase, Trx f→RCA/CBB, GDC-saturation→Vcmax)
  that re-derive `A` on top of `kin()`'s output.
- **`types.ts`** — `Env`/`Params`/`ModelOutput` shapes. `ModelOutput` is
  intentionally a large flat object (mirrors the original prototype's
  single return value) rather than a nested structure.

`SCENARIOS`, `runScenario()`, and `compareScenarios()` (bottom of
`runModel.ts`) are a small named-preset layer on top of `runModel()` —
each scenario is just a `Params` object (e.g. `PGLP1_OE`, `KEBEISH`,
`MCG_HIGH`).

### Uncertainty notation

Parameters and claims throughout `src/model/` and `docs/` are tagged:
`[At✓]` measured in Arabidopsis, `[C3 std]` standard FvCB practice,
`[sp:X]` measured in species X (use with caution), `[est]` estimated,
`[usr⚠]` placeholder that must eventually be measured. Preserve this
notation when adding or changing parameters.

### Any change to model biochemistry requires

1. A regression test in `src/model/__tests__/`.
2. An entry in `docs/02_errors_and_status.md` using the uncertainty
   notation above.

This codebase is a structural port of an earlier single-file prototype
(`photosynthesis_model.html`); the biochemistry was kept byte-for-byte
identical during the port except for three documented, tested fixes (see
`docs/02_errors_and_status.md`). Treat that fidelity as the baseline to
preserve unless a change is deliberate and documented.

### `docs/` layout

- `01_architecture.md`, `02_errors_and_status.md`, `03_model_limitations.md`,
  `04_future_improvements.md` — living status docs, kept current.
- `docs/proposals/` — point-in-time design proposals for specific upcoming
  features (not yet implemented).
- `docs/archive/` — frozen historical snapshots (e.g. the original port-day
  roadmap). Don't edit these; add new information to the live docs instead.

### UI layer

`src/components/` (SVG metabolic map, control panel, metrics/bypass/pools
side panel) and `src/data/metadata.ts` (tooltip copy, presets — no
biochemistry) sit on top of `runModel()` and have no business logic of
their own. The SVG map uses a single fixed-size canvas with simplified
coordinates rather than the original prototype's per-tab/per-bypass dynamic
layout — see `docs/04_future_improvements.md` (Priority 3) before trying to
restore full geometric fidelity or zoom/pan.
