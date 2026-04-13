const activityFadeDurationMs = 6 * 60 * 60 * 1000;

/**
 * Returns a 0–1 progress value based on how recently the sensor was seen.
 * 1 = just now, 0 = older than 6 hours.
 */
export function getActivityProgress(lastContact: string, now: number): number {
  const ageMs = Math.max(0, now - new Date(lastContact).getTime());
  return Math.max(0, 1 - ageMs / activityFadeDurationMs);
}

/**
 * CSS color for a sensor marker: green when fresh, grey when stale.
 */
export function getSensorActivityColor(lastContact: string, now: number): string {
  const progress = getActivityProgress(lastContact, now);
  if (progress <= 0) return 'rgba(148, 163, 184, 0.55)';

  const green = Math.round(120 + progress * 90);
  const red = Math.round(148 - progress * 88);
  return `rgba(${red}, ${green}, 105, ${0.35 + progress * 0.65})`;
}

/**
 * Hex color (0xRRGGBB) for use in Three.js materials.
 */
export function getSensorActivityHex(lastContact: string, now: number): number {
  const progress = getActivityProgress(lastContact, now);
  if (progress <= 0) return 0x94a3b8;

  const r = Math.round(148 - progress * 88);
  const g = Math.round(120 + progress * 90);
  const b = 105;
  return (r << 16) | (g << 8) | b;
}
