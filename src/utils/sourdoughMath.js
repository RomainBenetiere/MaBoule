/**
 * sourdoughMath.js
 * Pure math functions for sourdough analytics.
 * Framework-agnostic — portable to Swift / Kotlin.
 */

/**
 * Calculate total hydration percentage of the dough.
 *
 * Formula: ((W/F) * (W + F) + S * H_prev) / (W + F + S)
 *
 * @param {number} water       - Water weight (g)
 * @param {number} flour       - Flour weight (g)
 * @param {number} starter     - Starter weight (g)
 * @param {number} prevHydration - Previous mother-dough hydration (0–1 ratio, e.g. 1.0 = 100%)
 * @returns {number} Hydration as a ratio (multiply by 100 for %).
 */
export function calculateHydration(water, flour, starter, prevHydration) {
  if (flour === 0 && starter === 0) return 0;
  const wf = water + flour;
  const numerator = (water / (flour || 1)) * wf + starter * prevHydration;
  const denominator = wf + starter;
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculate the volume of a spherical-cap approximation of a bread loaf.
 *
 * The loaf is modelled as a spherical cap measured by two perpendicular
 * diameters (D1, D2) and a height (h).
 *
 * Average radius:  r = (D1 + D2) / 4
 * Volume:          V = (π h / 6)(3 r² + h²)  ×  formFactor
 *
 * @param {number} d1          - Diameter 1 (cm)
 * @param {number} d2          - Diameter 2 (cm)
 * @param {number} h           - Height of the cap (cm)
 * @param {number} formFactor  - Adjustment multiplier (default 1.0)
 * @returns {number} Volume in cm³
 */
export function calculateSphericalCapVolume(d1, d2, h, formFactor = 1.0) {
  const r = (d1 + d2) / 4;
  const volume = (Math.PI * h / 6) * (3 * r * r + h * h);
  return volume * formFactor;
}

/**
 * Calculate density from mass and volume.
 *
 * @param {number} massKg   - Mass in kilograms
 * @param {number} volumeCm3 - Volume in cm³
 * @returns {number} Density in g/cm³
 */
export function calculateDensity(massKg, volumeCm3) {
  if (volumeCm3 === 0) return 0;
  return (massKg * 1000) / volumeCm3; // convert kg → g
}

/**
 * Convert a volume in cm³ to litres.
 * @param {number} cm3
 * @returns {number}
 */
export function cm3ToLitres(cm3) {
  return cm3 / 1000;
}
