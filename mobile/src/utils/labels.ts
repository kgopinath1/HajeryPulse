/**
 * Returns the x-axis labels for a period-based trend sparkline.
 *
 * Bucket counts vary by period (matching the stored procedures):
 *   day   -> not used (screens skip rendering the trend for 'day')
 *   week  -> 7 fixed daily labels (Mon..Sun)
 *   month -> variable weekly labels (W1..Wn), sized to match actual data length
 *            since a month can span a different number of elapsed weeks
 *   ytd   -> 12 fixed monthly labels (Jan..Dec)
 *
 * @param period - the currently selected period tab
 * @param length - number of data points actually returned (used only for 'month')
 */
export type TrendPeriod = 'day' | 'week' | 'month' | 'ytd';

export const getTrendLabels = (period: TrendPeriod | string, length: number): string[] => {
  switch (period) {
    case 'week':
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    case 'month':
      return Array.from({ length }, (_, i) => `W${i + 1}`);
    case 'ytd':
    default:
      return [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
  }
};

/**
 * Maps a selected period to its comparison-type label, shown alongside
 * growth/delta chips (e.g. "▲ 4.2% WoW"). Falls back to a generic delta
 * symbol if an unrecognized period string is passed.
 *
 * @param period - the currently selected period tab
 */
export const getPeriodLabel = (period: TrendPeriod | string): string => {
  switch (period) {
    case 'day':
      return 'DoD';
    case 'week':
      return 'WoW';
    case 'month':
      return 'MoM';
    case 'ytd':
      return 'YoY';
    default:
      return 'Δ';
  }
};

/**
 * Human-readable label for the Business Type (Wholesale/Tender) filter,
 * shown as a section subtitle (e.g. "Margin Analysis · Wholesale only").
 *
 * @param bt - the currently selected business-type filter
 */
export type BTFilterLabel = 'both' | 'wholesale' | 'tender';

export const btLabel = (bt: BTFilterLabel | string): string => {
  switch (bt) {
    case 'wholesale':
      return 'Wholesale only';
    case 'tender':
      return 'Tender only';
    case 'both':
    default:
      return 'All channels';
  }
};