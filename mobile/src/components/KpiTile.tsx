import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { theme } from '@theme/index';
import { Chip, ChipTone } from './Chip';

interface KpiTileProps {
  label: string;
  value: string | React.ReactNode;
  // allow delta value to be a React node so callers can style parts of it
  delta?: { value: string | React.ReactNode; positive: boolean };
  chip?:  { label: string; tone: ChipTone };
  subtitle?: string;
  valueColor?: string;
}

export function KpiTile({ label, value, delta, chip, subtitle, valueColor }: KpiTileProps): React.JSX.Element {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor || theme.colors.text0 }]}>{value}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {delta && (
        <View style={[styles.deltaBadge, { backgroundColor: delta.positive ? 'rgba(95,209,122,0.16)' : 'rgba(255,92,108,0.16)' }]}> 
          <Text style={[styles.deltaText, { color: delta.positive ? theme.colors.green : theme.colors.red }]}>
            {delta.positive ? '▲ ' : '▼ '}
          </Text>
          <Text style={[styles.deltaText, { color: delta.positive ? theme.colors.green : theme.colors.red }]}>
            {delta.value}
          </Text>
        </View>
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
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    marginTop: 8,
  },
  deltaText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text2,
    marginTop: 4,
    fontWeight: '500',
  },
});
