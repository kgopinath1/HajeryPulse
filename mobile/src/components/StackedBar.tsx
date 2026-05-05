import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '@theme/index';

export interface StackedBarSegment {
  pct: number;          // 0–100
  color: string;        // gradient start; the bar is drawn flat for now
}

interface Props {
  segments: StackedBarSegment[];
  height?: number;
}

/**
 * Horizontal stacked bar — used for channel mix, Rx vs OTC, etc.
 * For real gradients use react-native-linear-gradient; we use solid
 * colors here for portability.
 */
export function StackedBar({ segments, height = 14 }: Props): React.JSX.Element {
  return (
    <View style={[styles.bar, { height, borderRadius: height / 2 }]}>
      {segments.map((s, i) => (
        <View
          key={i}
          style={{ width: `${s.pct}%`, backgroundColor: s.color, height: '100%' }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    width: '100%',
  },
});
