import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { theme } from '@theme/index';
import { Chip, ChipTone } from './Chip';

interface KpiTileProps {
  label: string;
  value: string | React.ReactNode;
  delta?: { value: string; positive: boolean };
  chip?:  { label: string; tone: ChipTone };
}

export function KpiTile({ label, value, delta, chip }: KpiTileProps): React.JSX.Element {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {delta && (
        <Text style={[styles.delta, { color: delta.positive ? theme.colors.green : theme.colors.red }]}>
          {delta.positive ? '▲' : '▼'} {delta.value}
        </Text>
      )}
      {chip && <View style={{ marginTop: 4 }}><Chip label={chip.label} tone={chip.tone} /></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: '47%',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  label: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  value: {
    fontFamily: theme.fonts.numeric,
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text0,
    marginTop: 4,
  },
  delta: {
    fontSize: theme.fontSize.sm,
    marginTop: 2,
    fontWeight: '600',
  },
});
