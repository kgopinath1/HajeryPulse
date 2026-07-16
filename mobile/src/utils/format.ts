/**
 * Display formatters. KWD figures from the API are now always true, full values
 * (no pre-scaling by the backend) — these formatters handle abbreviation internally.
 */

/** 1234500 → "KWD 1.23M" ; 742000 → "KWD 742K" ; 3.245 → "KWD 3" */
export function fmtKwd(value: number): string {
  if (value == null || isNaN(value)) return '—';
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    return `KWD ${(value / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `KWD ${(value / 1_000).toFixed(0)}K`;
  }
  return `KWD ${Math.round(value)}`;
}

/** For small values that still want K/M abbreviation but with more precision below 1K */
export function fmtKwdSmallVal(value: number): string {
  if (value == null || isNaN(value)) return '—';
  const abs = Math.abs(value);

  // ✅ Millions
  if (abs >= 1_000_000) {
    return `KWD ${(value / 1_000_000).toFixed(2)}M`;
  }

  // ✅ Thousands
  if (abs >= 1_000) {
    return `KWD ${(value / 1_000).toFixed(0)}K`;
  }

  // ✅ Small values (< 1K) — show with decimals for precision
  return `KWD ${value.toFixed(2)}`;
}

/** 1234.5 → "1,234.500" */
export function fmtKwdAsIs(value: number): string {
  if (value == null || isNaN(value)) return '—';

  return value.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
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
export function fmtYoy(value: number, type?: string): string {
  if (value == null || isNaN(value)) return '—';
  const arrow = value >= 0 ? '▲' : '▼';
  const pct = Math.abs(value).toFixed(1);
  return `${arrow} ${pct}% ${type ?? ''}`.trim();
}

/** YoY in pp: 1.2 → "▲ +1.2 pp" ; -0.8 → "▼ 0.8 pp" */
export function fmtYoyPp(value: number): string {
  if (value == null || isNaN(value)) return '—';
  const arrow = value >= 0 ? '▲' : '▼';
  const sign = value >= 0 ? '+' : '';
  return `${arrow} ${sign}${value.toFixed(1)} %`;
}

/** Initials from a string, max 2 chars: "Al Anoud Pharmacy" → "AA" */
export function initials(s: string, max = 2): string {
  return (s.match(/[A-Z]/g) || []).slice(0, max).join('') || s.slice(0, max).toUpperCase();
}

export function fmtPpNumber(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}`;
}