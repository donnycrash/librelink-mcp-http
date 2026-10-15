export type GlucoseUnits = 'mg/dL' | 'mmol/L';

// Abbott's own apps use this divisor; the upstream client library does the same.
const MGDL_PER_MMOL = 18;

export function isMmol(units: GlucoseUnits): boolean {
  return units === 'mmol/L';
}

/**
 * Convert an internal mg/dL glucose value for display.
 * Safe for deltas and standard deviations as well as absolute readings,
 * since the conversion is purely linear with no offset.
 */
export function toDisplay(mgdl: number, units: GlucoseUnits): number {
  if (!isMmol(units)) return Math.round(mgdl * 100) / 100;
  return Math.round((mgdl / MGDL_PER_MMOL) * 10) / 10;
}

/** Convert a user-supplied display value back to the mg/dL used internally. */
export function fromDisplay(value: number, units: GlucoseUnits): number {
  if (!isMmol(units)) return value;
  return Math.round(value * MGDL_PER_MMOL);
}

/** Label form: mmol/L is conventionally written to one decimal place. */
export function formatValue(mgdl: number, units: GlucoseUnits): string {
  const v = toDisplay(mgdl, units);
  return isMmol(units) ? v.toFixed(1) : String(v);
}

export function formatRange(low: number, high: number, units: GlucoseUnits): string {
  return `${formatValue(low, units)}-${formatValue(high, units)} ${units}`;
}
