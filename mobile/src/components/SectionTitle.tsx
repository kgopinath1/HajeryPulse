import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { theme } from '@theme/index';

interface SectionTitleProps {
  title: string;
  rightLabel?: React.ReactNode;       // e.g. "All channels" or styled element
  onPressRight?: () => void; // makes the right label tappable
}

export function SectionTitle({ title, rightLabel, onPressRight }: SectionTitleProps): React.JSX.Element {
  const isStringLabel = typeof rightLabel === 'string';

  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {rightLabel && (
        <View style={styles.rightContainer}>
          {isStringLabel ? (
            <Text style={[styles.rightText, onPressRight && { color: theme.colors.gold }]} onPress={onPressRight}>
              {rightLabel}
            </Text>
          ) : (
            rightLabel
          )}
        </View>
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
  rightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rightText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text2,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
