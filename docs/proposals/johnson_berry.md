# Johnson–Berry Electron Transport Model — Integration Proposal

**Status**: implemented 2026-11-08. See `src/model/electronTransport.ts`,
`src/model/kin.ts` (gated behind `params.photochemistry_model`), and
`src/model/__tests__/johnsonBerry.test.ts`.

**Important correction vs. the proposal below**: an earlier AI-summarized
reading of the paper (not a direct read of the typeset equations) produced
a subtly wrong formula for η — specifically a `Cc − Γ*` denominator that
isn't in the actual paper and caused η to range from ~0.2 to ~1 instead of
the paper's stated 1.0–1.125. The implementation was corrected against the
actual rendered equations (2) and (3) on page 4 of the PDF (these equations
are embedded as images in the paper with no extractable text layer, so a
text-based fetch cannot recover them — rendering the PDF page to an image
and reading it directly was necessary). The verified equations are:

```
J = eta^-1 * (Cb6fmax * Q) / (Cb6fmax / (alpha1 * phi1Pmax) + Q)
eta = 1 - nL/nC + (3*Cc + 7*gammastar) / ((4*Cc + 8*gammastar) * nC)
```

The rest of this document (the original proposal) is kept below for
historical context; where it conflicts with the corrected equations above,
the equations above are authoritative.

## Source

Lamour, Chave, Johnson, Berry et al., "Improved model representation of the
photosynthetic light reactions reduces estimates of global gross primary
productivity", bioRxiv 2026.05.08.723728 (posted 2026-05-12).
https://www.biorxiv.org/content/10.64898/2026.05.08.723728v1.full

This is the paper behind what's informally called the "Johnson–Berry" or "JB"
model. It replaces the empirical non-rectangular hyperbola FvCB uses for
electron transport (the `θ` curvature parameter) with a mechanistic
formulation built around cytochrome b6f capacity.

## Why this is relevant to this codebase specifically

Our `kin()` function currently computes `J` like this (the standard FvCB
non-rectangular hyperbola):

```js
const alpha = params.alpha ?? 0.30;
const theta = params.theta ?? 0.70;
const I = Math.max(0, env.light);
const aI = alpha * I;
const J = (aI + JmaxT - Math.sqrt(Math.max(0, Math.pow(aI + JmaxT, 2) - 4 * theta * aI * JmaxT))) / (2 * theta);
```

`theta` here is exactly the empirical fudge factor the JB paper is targeting.
And critically, `kin()` *already computes* both `Cc` and `GS` (Γ*) before this
line — the two inputs the JB formulation needs that FvCB's J calculation
doesn't use. That makes this an unusually clean swap-in: no new environmental
inputs required, just new parameters and a different formula for `J`.

## The JB equations

```
J = (Cb6f_max · α₁ · φ1Pmax · η · Q) / (Cb6f_max · η + α₁ · φ1Pmax · Q)

η = (nL · Γ*) / (nC · (Cc − Γ*))
```

| Symbol | Meaning | Value / source |
|---|---|---|
| `Cb6f_max` | max electron flow through cytochrome b6f (µmol e⁻ m⁻²s⁻¹) | new parameter, plays the role `Jmax` plays today |
| `α₁` | fraction of absorbed irradiance reaching PSI | new parameter, analogous to today's `alpha` |
| `φ1Pmax` | max photochemical yield of PSI (mol/mol) | fixed constant, **0.96** |
| `η` | ratio of PSI:PSII electron transport | computed from `Cc`, `Γ*` — not a free parameter |
| `nL` | ATP coupling efficiency, linear electron flow | fixed constant, **0.75** |
| `nC` | ATP coupling efficiency, cyclic electron flow | fixed constant, **1.0** |
| `Q` | irradiance | same as our existing `I` (`env.light`) |

`θ` is eliminated entirely (the paper shows FvCB with `θ=0` is the
mathematical limit of the JB formula when `η=1`).

## Parameter defaults / continuity with current model

The paper fitted 601 A–Ci curves and found `Cb6f_max ≈ 1–1.8 × Jmax` (R²>0.99
for the regression). That gives us a bridge for defaults: we can derive a
starting `Cb6f_max25` from the existing `Jmax_Vcmax_ratio`-based `Jmax25`
(e.g. `Cb6f_max25 = 1.4 × Jmax25` as a first default, refinable later), and
apply the *same* Bernacchi temperature response curve (`Ha=43900, Hd=200000,
dS=640`) that's already used for `JmaxT`, since the paper doesn't propose a
different one and ours is already parameterised per-species via `_peaked()`.

`η`'s practical range is tiny — the paper notes it only varies 1–1.125 across
physiological `Cc`, so in practice this mostly changes the *shape* of the
light-response curve (smoother transition, lower predicted A at intermediate
light — matching measured A–Q curves better in 83% of 1,422 curves across 146
species), not a dramatic CO₂-sensitivity effect.

## Implementation plan

1. Add `src/model/electronTransport.ts` with two pure functions:
   - `computeJ_FvCB(alpha, theta, JmaxT, I)` — today's formula, moved as-is.
   - `computeJ_JohnsonBerry(Cb6fmaxT, alpha1, phi1Pmax, eta, I)` — the new one.
   - A small `computeEta(Cc, gammastar, nL = 0.75, nC = 1.0)` helper.
2. In `kin()`, gate on a new param: `params.photochemistry_model` —
   `'fvcb' | 'johnson_berry'`, **defaulting to `'fvcb'`**. This preserves
   byte-identical output (and every existing verification test) when the
   param is unset, which keeps faith with the architecture doc's rule that
   `kin()`'s existing output is frozen — the JB path is additive, not a
   replacement of the default.
3. Surface it as a new control in the Advanced tab: a toggle plus a
   `Cb6f_max25` slider (with the `1.4×Jmax25` default pre-filled), analogous
   to how `theta`/`alpha` are exposed today.
4. Return whichever `J` was computed under the existing `J` key so everything
   downstream (`Wj`, `limitState`, etc.) needs zero changes.

## Suggested validation / tests

- Unit test: with `theta → 0` and `η` forced to 1, `computeJ_FvCB` and
  `computeJ_JohnsonBerry` converge (the paper's stated mathematical
  equivalence) — within numerical tolerance.
- Unit test: at standard reference conditions (400 ppm CO₂, 1000 µmol
  light), JB-model `A` should be close to but not identical to FvCB-model
  `A`; assert it's lower at intermediate light and the two converge at
  saturating light (matches the paper's qualitative finding).
- Sanity test: `eta` stays within the paper's stated bound of
  1.0–1.125 across the model's physiological `Cc` range.

## Where this fits in the roadmap

This is a good complement to the already-planned **"light response curves"**
feature (closely related to the existing Priority 4 "temperature response
curves" idea in the roadmap) — that's exactly where the FvCB-vs-JB
difference becomes visible to a user, since at the model's default reference
point (400 ppm, saturating light) the system is already Rubisco-limited and
the electron-transport term barely matters. The JB-vs-FvCB difference is a
light-response-curve story, not a single-point story, so shipping both
together will make this upgrade legible rather than invisible.

**Suggested priority**: medium. It's scientifically well-motivated and cheap
to add behind a flag without disturbing anything frozen, but it's secondary
to the three already-documented bug fixes and to anything blocking core
correctness. Good candidate for the next development session once the
restructured project is live.

## Caveats to carry into `docs/03_model_limitations.md`

- JB's own validation assumed infinite mesophyll conductance (`Cc = Ci`);
  our model already applies a scalar `Cc_Ci` correction, so this is no worse
  than our existing simplification, but it's not a more rigorous gm
  treatment either.
- The `Cb6f_max ≈ 1–1.8 × Jmax` conversion factor is itself an empirical
  regression from a cross-species dataset — not an Arabidopsis-specific
  measurement. Should be tagged `[est]` / `[sp:multi]` in our uncertainty
  notation, same as other borrowed cross-species parameters already in this
  model (e.g. `Srel25`, `CrGDH Km`).
