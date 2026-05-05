import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { theme } from '@theme/index';

export function Card({ children, style, ...rest }: ViewProps): React.JSX.Element {
  return <View style={[styles.card, style]} {...rest}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius:    theme.radius.lg,
    borderWidth:     1,
    borderColor:     theme.colors.border,
    padding:         theme.spacing.xxl,
    marginVertical:  theme.spacing.sm,
  },
});
