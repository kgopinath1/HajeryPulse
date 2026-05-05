import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { theme } from '@theme/index';

interface SectionTitleProps {
  title: string;
  rightLabel?: string;       // e.g. "All channels"
  onPressRight?: () => void; // makes the right label tappable
}

export function SectionTitle({ title, rightLabel, onPressRight }: SectionTitleProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {rightLabel && (
        <Text style={[styles.right, onPressRight && { color: theme.colors.gold }]} onPress={onPressRight}>
          {rightLabel}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text0,
    letterSpacing: -0.2,
  },
  right: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text2,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
