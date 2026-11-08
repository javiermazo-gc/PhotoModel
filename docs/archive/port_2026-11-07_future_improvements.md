# Future Improvements & Roadmap (historical port-day snapshot, 2026-11-07 — see docs/04_future_improvements.md for the active backlog)

## Priority 1 — Fix Remaining Model Errors — ✅ RESOLVED in this port (2026-11-07)

All three items below were fixed during the port to `photosynthesis-model/`.
See `docs/02_errors_and_status.md`'s "FIXED in this codebase" section and
the regression tests in `src/model/__tests__/bugfixes.test.ts` for details.

### McG `acetylCoA_modeA` (HIGH) — FIXED
**Was**: `const acetylCoA_modeA = bypass_flux * lipidFrac` (WRONG)
**Fix applied**: `const acetylCoA_modeA = bypass_flux;` in
`src/model/bypass/mcg.ts`. `lipidFrac` now applies only to the fate split
downstream (already correct elsewhere in the function and in
`metabolicOutputs()`).

### McG `A_bypass` NaN risk (MEDIUM) — FIXED
**Was**: `A_bypass = ... + flux_3pga_mcg * 0.3` where `flux_3pga_mcg` was
undefined in that scope.
**Fix applied**: the term was removed from `A_bypass` in
`src/model/bypass/mcg.ts` (per the documented fix, rather than inventing
new biochemistry to replace it). `flux_3pga_mcg` is computed and returned
by `bypassMcG()` (it was always needed for the glycerate-shunt display) but
is no longer referenced inside `A_bypass`.

### O₂ Ha correction (LOW) — FIXED
**Was**: `-16000 J/mol`
**Fix applied**: `-12600 J/mol` (standard enthalpy O₂ dissolution), in
`src/model/photoResp.ts`.

---

For Priority 2 through 5 (SVG improvements, MCA panel, scenario comparison,
export/import params, gm model, C4 adaptation, dynamic simulation,
metabolomics fitting), see `docs/04_future_improvements.md` — the active
backlog for this codebase.
