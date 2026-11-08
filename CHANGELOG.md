# Changelog

## 2026-11-08 — Johnson-Berry electron transport model (opt-in)

Added a mechanistic alternative to the empirical FvCB electron-transport
term, based on Lamour, Chave, Johnson, Berry et al. 2026 (bioRxiv
2026.05.08.723728). Selectable via `params.photochemistry_model` (`'fvcb'`
default — preserves all prior output byte-for-byte; `'johnson_berry'`
switches to a cytochrome-b6f-capacity-based `J` calculation instead of the
empirical `theta` curvature parameter), with a corresponding toggle in the
UI's Advanced tab.

The implementation required reading the paper's actual typeset equations
directly from a rendered PDF page — the equations are embedded as images
with no extractable text layer, and an earlier AI-summarized web reading
of the paper had produced a subtly wrong formula for `eta` (the PSI:PSII
ratio term) that was caught by a failing bounds test rather than assumed
correct. See `docs/proposals/johnson_berry.md` for the verified equations
and `src/model/__tests__/johnsonBerry.test.ts` for the test coverage
(including an exact mathematical-equivalence check against the FvCB
`theta->0` limit).

New files: `src/model/electronTransport.ts`,
`src/model/__tests__/johnsonBerry.test.ts`. `kin.ts`'s FvCB path is
unchanged when `photochemistry_model` is unset (26/26 tests pass,
including all 18 pre-existing ones).

## 2026-11-07 — Port to modular TypeScript project + three bug fixes

Ported the single-file React prototype (`photosynthesis_model.html`) into
a modular Vite + React + TypeScript project (`photosynthesis-model/`) with
a Vitest test suite. The FvCB biochemistry, photorespiration stoichiometry,
all four bypass designs, and the three feedback loops were ported
byte-for-byte equivalent in logic — verified independently against the
original prototype's own output for `kebeish`/`south`/`cbhac` (identical)
and `mcg` (differs only at the two fixed bug locations, as expected).

Fixed three documented bugs during the port (not left as TODOs):

- **[HIGH]** McG `acetylCoA_modeA` was `bypass_flux * lipidFrac`, wrong —
  AcCoA production is 1:1 with `bypass_flux` per Lu 2025. Fixed; `lipidFrac`
  now applies only to the downstream AcCoA fate split (lipids vs export).
- **[MEDIUM]** McG `A_bypass` referenced an undefined `flux_3pga_mcg`
  variable (`undefined * 0.3` → NaN risk). The ad-hoc term was removed from
  `A_bypass`.
- **[LOW]** O₂ solubility/dissolution enthalpy corrected from
  `-16000 J/mol` to `-12600 J/mol` (standard value).

Also:

- Added regression tests for all three fixes and converted the original
  `console.assert` "Verification Tests" into real Vitest assertions.
- Copied and updated the architecture/status/limitations/roadmap docs.
