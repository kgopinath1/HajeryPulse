import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { theme } from '@theme/index';
import { fmtKwdAsIs } from '@utils/format';
import { StackedBar } from './StackedBar';
import { InfoToolTip } from './InfoToolTip';

export interface BreakdownSegment {
  value: number;
  color: string;
}

interface Props {
  amount: number;
  label?: string;
  /** Small caption on the right, e.g. "4 TYPES" or the current org level. */
  meta?: string;
  /** Shows an info icon next to the label; tapping it explains what the amounts include. */
  info?: string;
  /** When given, draws a composition bar under the total. Omit if the card already has its own bar. */
  segments?: BreakdownSegment[];
}

/**
 * Total header for widgets that split sales by a dimension (payment type,
 * brand, channel…). Sits at the top of the Card, above the breakdown rows,
 * separated from them by a hairline.
 */
export function BreakdownTotal({
  amount,
  label = 'TOTAL SALES',
  meta,
  info,
  segments,
}: Props): React.JSX.Element {
  const segTotal = segments?.reduce((s, x) => s + Math.max(x.value ?? 0, 0), 0) ?? 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <View style={styles.labelLeft}>
          <Text style={styles.label}>{label}</Text>
          {info ? <InfoToolTip text={info} /> : null}
        </View>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>

      {/* Always the full, unrounded value (3 decimals = fils). */}
      <Text style={styles.amount}>
        <Text style={styles.unit}>KWD </Text>
        {fmtKwdAsIs(amount)}
      </Text>

      {segments && segTotal > 0 && (
        <View style={styles.bar}>
          <StackedBar
            height={6}
            segments={segments.map(s => ({
              pct: (Math.max(s.value ?? 0, 0) / segTotal) * 100,
              color: s.color,
            }))}
          />
        </View>
      )}

      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: theme.spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
    color: theme.colors.text2,
  },
  meta: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: theme.colors.text3,
  },
  amount: {
    marginTop: theme.spacing.xs,
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    fontFamily: theme.fonts.numeric,
    color: theme.colors.gold,
    letterSpacing: -0.3,
  },
  unit: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text2,
  },
  bar: {
    marginTop: theme.spacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.borderHi,
    marginTop: theme.spacing.xl,
  },
});
