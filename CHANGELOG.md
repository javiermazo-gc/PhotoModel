# Changelog

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
