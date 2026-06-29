/**
 * Display formatters. KWD figures from the API are always in thousands.
 */

/** 1234.5 → "KWD 1.23M" ; 742 → "KWD 742K" ; 12.34 → "KWD 12K" */
export function fmtKwd(thousands: number): string {
  if (thousands == null || isNaN(thousands)) return '—';
  if (Math.abs(thousands) >= 1000) {
    return `KWD ${(thousands / 1000).toFixed(2)}M`;
  }
  return `KWD ${Math.round(thousands)}K`;
}

/**already divided by 1000 */
export function fmtKwdSmallVal(thousands: number): string {
  if (thousands == null || isNaN(thousands)) return '—';

  const abs = Math.abs(thousands);

  // ✅ Handle small values (< 1K)
  if (abs < 1) {
    return `KWD ${(thousands * 1000).toFixed(2)}`;
  }

  // ✅ Millions
  if (abs >= 1000) {
    return `KWD ${(thousands / 1000).toFixed(2)}M`;
  }

  // ✅ Thousands
  return `KWD ${Math.round(thousands)}K`;
}

/** 1234.5 → "KWD 1234.500" */
export function fmtKwdAsIs(value: number): string {
  if (value == null || isNaN(value)) return '—';
  return `KWD ${value.toFixed(3)}`;
}

/** 41.83 → "41.8%"  */
export function fmtPct(value: number, decimals = 1): string {
  if (value == null || isNaN(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

/** 18240 → "18,240" */
export function fmtInt(value: number): string {
  if (value == null || isNaN(value)) return '—';
  return Math.round(value).toLocaleString('en-US');
}

/** YoY arrow + value: 12.4 → "▲ 12.4%" ; -3.2 → "▼ 3.2%" */
export function fmtYoy(value: number,type?: string): string {
  if (value == null || isNaN(value)) return '—';
  const arrow = value >= 0 ? '▲' : '▼';
  const pct = Math.abs(value).toFixed(1);
  return `${arrow} ${pct}% ${type ?? ''}`.trim();
}

/** YoY in pp: 1.2 → "▲ +1.2 pp" ; -0.8 → "▼ 0.8 pp" */
export function fmtYoyPp(value: number): string {
  if (value == null || isNaN(value)) return '—';
  const arrow = value >= 0 ? '▲' : '▼';
  const sign  = value >= 0 ? '+' : '';
  return `${arrow} ${sign}${value.toFixed(1)} pp`;
}

/** Initials from a string, max 2 chars: "Al Anoud Pharmacy" → "AA" */
export function initials(s: string, max = 2): string {
  return (s.match(/[A-Z]/g) || []).slice(0, max).join('') || s.slice(0, max).toUpperCase();
}
