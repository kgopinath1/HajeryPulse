/**
 * RevenueCard — reusable, tappable revenue widget for the Home screen.
 *
 * One component covers all three business lines (WT / F&B / Pharmacy);
 * the Home screen normalizes each API's response into RevenueCardData
 * and picks the sparkline color per line.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { theme } from '@theme/index';
import { Card } from '@components/Card';
import { Chip } from '@components/Chip';
import { MultiSparkline } from '@components/MultiSparkline';
import { fmtKwd, fmtYoy } from '@utils/format';

export type Period = 'day' | 'week' | 'month' | 'ytd';

/**
 * X-axis labels for the sparkline, matching the other screens:
 *  week  → Mon…Sun, month → W1…W5, ytd → Jan…Dec.
 * Sliced to `count` so labels line up with however many points came back.
 */
function getTrendLabels(period: Period, count: number): string[] {
  let labels: string[];
  switch (period) {
    case 'week':
      labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      break;
    case 'month':
      labels = ['W1', 'W2', 'W3', 'W4', 'W5'];
      break;
    case 'ytd':
      labels = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      break;
    default:
      labels = [];
  }
  return count > 0 ? labels.slice(0, count) : labels;
}

export interface RevenueCardData {
  revenueKwd: number;
  growthPct: number;
  growthType: string;
  current: number[];   // current-period trend points
  previous: number[];  // previous-period trend points
}

interface Props {
  /** e.g. "WHOLESALE & TENDER" — rendered as the eyebrow */
  title: string;
  period: Period;
  data: RevenueCardData | null;
  loading: boolean;
  /** sparkline + legend color for the current-period series */
  primaryColor: string;
  /** legend label for the secondary series ("Previous Period" / "Last Period") */
  previousLabel?: string;
  onPress: () => void;
}

export function RevenueCard({
  title,
  period,
  data,
  loading,
  primaryColor,
  previousLabel = 'Previous Period',
  onPress,
}: Props): React.JSX.Element {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Card>
        {loading && !data ? (
          <ActivityIndicator color={theme.colors.gold} />
        ) : data ? (
          <>
            {/* Header row — eyebrow + chevron so the card reads as tappable */}
            <View style={styles.headerRow}>
              <Text style={styles.eyebrow}>
                {title} · {period.toUpperCase()} TO DATE
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.text3}
              />
            </View>

            <Text style={styles.hero}>{fmtKwd(data.revenueKwd)}</Text>
            <View style={{ marginTop: 4 }}>
              <Chip
                label={fmtYoy(data.growthPct, data.growthType)}
                tone={data.growthPct >= 0 ? 'green' : 'red'}
              />
            </View>

            {period !== 'day' && data.current.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <MultiSparkline
                  primary={data.current}
                  secondary={data.previous}
                  primaryColor={primaryColor}
                  secondaryColor={theme.colors.blue}
                  labels={getTrendLabels(period, data.current.length)}
                  height={120}
                />
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: primaryColor }]}
                    />
                    <Text style={styles.legendText}>Current Period</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: theme.colors.blue },
                      ]}
                    />
                    <Text style={styles.legendText}>{previousLabel}</Text>
                  </View>
                </View>
                <Text style={styles.trendCaption}>
                  {period === 'week' && 'Last 7 days'}
                  {period === 'month' && 'Weekly trend'}
                  {period === 'ytd' && 'Monthly trend'}
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.emptyText}>No revenue data available</Text>
        )}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 11,
    color: theme.colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hero: {
    fontFamily: theme.fonts.numeric,
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text0,
    marginTop: 4,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: theme.colors.text2 },
  trendCaption: { color: theme.colors.text2, marginTop: 4 },
  emptyText: {
    color: theme.colors.text2,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
});
