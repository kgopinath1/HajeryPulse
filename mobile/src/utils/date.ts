import { format, parseISO, subDays } from 'date-fns';

/** "Wed, 22 Apr 2026" */
export function fmtAsOnDate(iso: string): string {
  return format(parseISO(iso), 'EEE, dd MMM yyyy');
}

/** Returns yesterday in YYYY-MM-DD (default base for as-on-date pickers). */
export function defaultAsOfDate(): string {
  return format(subDays(new Date(), 1), 'yyyy-MM-dd');
}

/** Tag string for a date relative to "today": Day -1 / Day -2 / Live / etc. */
export function dayTag(iso: string): string {
  const today = new Date();
  const target = parseISO(iso);
  const diffMs = today.getTime() - target.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Live';
  if (days === 1) return 'Day −1';
  return `Day −${days}`;
}
