// Shared physical constants and small math helpers used throughout the
// kinetic model. Ported byte-for-byte from the original prototype
// (photosynthesis_model.html, lines ~331-335) — no formula changes.

/** Gas constant, J/(mol·K) */
export const R = 8.314;

/** Reference temperature, 298.15 K = 25°C */
export const T25 = 298.15;

/** Simple Arrhenius temperature scaling relative to 25°C. */
export const _arr = (Ha: number, Tk: number): number =>
  Math.exp((Ha / R) * (1 / T25 - 1 / Tk));

/** Peaked (optimum-temperature) Arrhenius function — used for Jmax. */
export const _peaked = (Ha: number, Hd: number, dS: number, Tk: number): number =>
  (_arr(Ha, Tk) * (1 + Math.exp((dS * T25 - Hd) / (R * T25)))) /
  (1 + Math.exp((dS * Tk - Hd) / (R * Tk)));

/** Clamp v into [lo, hi]. */
export const _clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));
