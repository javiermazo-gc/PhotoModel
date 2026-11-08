// Two interchangeable formulations for electron transport rate J, selected
// in kin() via params.photochemistry_model (default: 'fvcb', preserving
// kin()'s existing frozen output byte-for-byte). See
// docs/proposals/johnson_berry.md for the full design rationale.
//
// The Johnson-Berry equations below are transcribed directly from the
// typeset equations in Lamour, Chave, Johnson, Berry et al. 2026 (bioRxiv
// 2026.05.08.723728), Equations (2) and (3) — read from the rendered PDF
// page, not from a text/OCR extraction (this paper's equations are
// embedded as images with no extractable Unicode text, and an earlier
// AI-summarized reading of them was subtly wrong in exactly the term that
// matters: eta's formula). Re-verify against the source PDF page 4 before
// changing these.

/**
 * Standard FvCB non-rectangular hyperbola. Ported as-is from kin() — not a
 * new formula, just given a name so it's selectable alongside the JB one.
 */
export const computeJ_FvCB = (alpha: number, theta: number, JmaxT: number, I: number): number => {
  const aI = alpha * I;
  return (aI + JmaxT - Math.sqrt(Math.max(0, Math.pow(aI + JmaxT, 2) - 4 * theta * aI * JmaxT))) / (2 * theta);
};

/**
 * Johnson-Berry Equation (2):
 *   J = eta^-1 * (Cb6fmax * Q) / (Cb6fmax / (alpha1 * phi1Pmax) + Q)
 *
 * Multiplying numerator and denominator by (alpha1*phi1Pmax) gives the
 * algebraically equivalent, simpler-to-compute rectangular-hyperbola form
 * used here:
 *   J = (1/eta) * (Cb6fmax * S * Q) / (Cb6fmax + S * Q),  where S = alpha1 * phi1Pmax
 *
 * `alpha1` here plays the role of the paper's combined (leaf absorptance x
 * PSI fraction) term — this codebase doesn't track leaf absorptance
 * separately from quantum yield anywhere else either (its existing `alpha`
 * for the FvCB path is already a single combined slope parameter), so we
 * keep that same level of granularity here rather than adding a third
 * free parameter nothing else in the model would use. phi1Pmax is kept
 * separate since it's a fixed biophysical constant (0.96), not something
 * to fit.
 */
export const computeJ_JohnsonBerry = (
  Cb6fmaxT: number,
  alpha1: number,
  phi1Pmax: number,
  eta: number,
  I: number
): number => {
  const S = alpha1 * phi1Pmax;
  const denominator = Cb6fmaxT + S * I;
  return eta > 0 && denominator > 0 ? (Cb6fmaxT * S * I) / (eta * denominator) : 0;
};

/**
 * Johnson-Berry Equation (3): eta = ratio of PSI:PSII electron transport,
 * a function of chloroplastic CO2 (Cc) and the CO2 compensation point
 * (gammastar). NOT a free parameter. Per the paper's stated bounds, this
 * ranges from exactly 1 (Cc -> infinity) to 1.125 (Cc = 0) at the default
 * nL=0.75, nC=1 — verified algebraically: at Cc=0, (7*gammastar)/(8*gammastar)
 * = 0.875, so eta = 1 - 0.75 + 0.875 = 1.125; at Cc -> infinity, the gammastar
 * terms vanish and (3*Cc)/(4*Cc) = 0.75, so eta = 1 - 0.75 + 0.75 = 1.
 */
export const computeEta = (Cc: number, gammastar: number, nL = 0.75, nC = 1.0): number =>
  1 - nL / nC + (3 * Cc + 7 * gammastar) / ((4 * Cc + 8 * gammastar) * nC);

/** phi1Pmax: max photochemical yield of PSI, mol/mol — fixed per the JB paper. */
export const PHI_1P_MAX = 0.96;
/** nL: ATP coupling efficiency, linear electron flow, mol ATP / mol electrons. */
export const N_L = 0.75;
/** nC: ATP coupling efficiency, cyclic electron flow, mol ATP / mol electrons. */
export const N_C = 1.0;
