import { format, parseISO, subDays, differenceInCalendarDays } from 'date-fns';

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
  const days = differenceInCalendarDays(new Date(), parseISO(iso));
  if (days <= 0) return 'Live';
  if (days === 1) return 'Day −1';
  return `Day −${days}`;
}
