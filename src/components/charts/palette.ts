/**
 * Chart palette.
 *
 * Categorical hues are assigned in FIXED SLOT ORDER and never cycled — a series
 * keeps its colour when filters change the series count, so the reader never has
 * to re-learn the legend.
 *
 * Both columns were validated with the data-viz palette checker
 * (lightness band, chroma floor, CVD separation, normal-vision floor, contrast):
 *   light surface: all checks pass, worst adjacent CVD ΔE 9.1
 *   dark  surface: all checks pass, worst adjacent CVD ΔE 8.4
 * Three light-mode hues sit under 3:1 against the light surface, so every chart
 * using them ships visible direct labels or a table view (the "relief rule").
 */

export const SERIES_LIGHT = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
] as const;

export const SERIES_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
] as const;

/** Status colours are reserved — never reused as "series N". */
export const STATUS_COLORS = {
  good: { light: '#1baf7a', dark: '#199e70' },
  warning: { light: '#eda100', dark: '#c98500' },
  serious: { light: '#eb6834', dark: '#d95926' },
  critical: { light: '#e34948', dark: '#e66767' },
} as const;

/**
 * Stable slot assignment by entity key. Colour follows the entity, never its
 * rank in the current result set.
 */
const SLOT_BY_KEY: Record<string, number> = {
  // ticket status
  OPEN: 0,
  IN_PROGRESS: 1,
  PENDING_MEMBER: 3,
  RESOLVED: 2,
  CLOSED: 5,
  // priority
  LOW: 2,
  MEDIUM: 0,
  HIGH: 3,
  URGENT: 7,
  // sentiment
  POSITIVE: 2,
  NEUTRAL: 0,
  NEGATIVE: 3,
  FRUSTRATED: 7,
  // gym support categories
  MEMBERSHIP: 0,
  EQUIPMENT: 1,
  CLASSES: 2,
  PERSONAL_TRAINING: 6,
  NUTRITION: 5,
  INJURY: 7,
  ACCOUNT: 4,
  COMPLAINT: 3,
  GENERAL: 5,
  // membership tiers
  DAY_PASS: 5,
  BASIC: 0,
  PRO: 2,
  ELITE: 6,
  // membership status
  ACTIVE: 2,
  FROZEN: 0,
  EXPIRED: 3,
  CANCELLED: 7,
  PENDING: 4,
};

export function colorForKey(key: string, index: number, dark: boolean): string {
  const palette = dark ? SERIES_DARK : SERIES_LIGHT;
  const slot = SLOT_BY_KEY[key] ?? index;
  return palette[slot % palette.length];
}

export function seriesColor(index: number, dark: boolean): string {
  const palette = dark ? SERIES_DARK : SERIES_LIGHT;
  return palette[index % palette.length];
}

export function statusColor(level: keyof typeof STATUS_COLORS, dark: boolean): string {
  return STATUS_COLORS[level][dark ? 'dark' : 'light'];
}

/** Maps an SLA/compliance percentage onto the reserved status ramp. */
export function complianceLevel(percent: number | null): keyof typeof STATUS_COLORS {
  if (percent === null) return 'warning';
  if (percent >= 90) return 'good';
  if (percent >= 75) return 'warning';
  if (percent >= 50) return 'serious';
  return 'critical';
}
