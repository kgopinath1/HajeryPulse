import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { theme } from '@theme/index';

export type ChipTone = 'gold' | 'teal' | 'blue' | 'purple' | 'pink' | 'amber' | 'green' | 'red' | 'neutral';

interface ChipProps {
  label: string;
  tone?: ChipTone;
}

const toneColors: Record<ChipTone, { bg: string; fg: string }> = {
  gold:    { bg: 'rgba(212,175,106,0.16)', fg: theme.colors.gold },
  teal:    { bg: 'rgba(48,224,196,0.16)',  fg: theme.colors.teal },
  blue:    { bg: 'rgba(91,140,255,0.16)',  fg: theme.colors.blue },
  purple:  { bg: 'rgba(154,124,255,0.16)', fg: theme.colors.purple },
  pink:    { bg: 'rgba(255,124,174,0.16)', fg: theme.colors.pink },
  amber:   { bg: 'rgba(255,177,60,0.16)',  fg: theme.colors.amber },
  green:   { bg: 'rgba(95,209,122,0.16)',  fg: theme.colors.green },
  red:     { bg: 'rgba(255,92,108,0.16)',  fg: theme.colors.red },
  neutral: { bg: 'rgba(255,255,255,0.06)', fg: theme.colors.text1 },
};

export function Chip({ label, tone = 'neutral' }: ChipProps): React.JSX.Element {
  const c = toneColors[tone];
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical:   theme.spacing.xs,
    borderRadius:      theme.radius.pill,
    alignSelf:         'flex-start',
  },
  text: {
    fontSize:   theme.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
