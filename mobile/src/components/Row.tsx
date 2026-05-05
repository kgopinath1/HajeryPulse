import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { theme } from '@theme/index';
import { Chip, ChipTone } from './Chip';

interface RowProps {
  avatar?:  { initials: string; color: string };
  title:    string;
  subtitle?: string;
  amount:   string;
  delta?:   { label: string; tone: ChipTone };
}

/** List row used for "Top 10 Brands", "Top 10 Customers", "Top 10 Pharmacies", etc. */
export function Row({ avatar, title, subtitle, amount, delta }: RowProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      {avatar && (
        <View style={[styles.avatar, { backgroundColor: avatar.color + '30' }]}>
          <Text style={[styles.avatarTxt, { color: avatar.color }]}>{avatar.initials}</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{amount}</Text>
        {delta && <Chip label={delta.label} tone={delta.tone} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: theme.spacing.lg, paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  avatar: {
    width: 38, height: 38, borderRadius: theme.radius.md,
    alignItems: 'center', justifyContent: 'center',
    marginRight: theme.spacing.lg,
  },
  avatarTxt: {
    fontFamily: theme.fonts.numeric,
    fontSize: 12, fontWeight: '700',
  },
  body: { flex: 1 },
  title:    { fontSize: 13, fontWeight: '600', color: theme.colors.text0 },
  subtitle: { fontSize: 11, color: theme.colors.text2, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: {
    fontFamily: theme.fonts.numeric,
    fontSize: 13, fontWeight: '700', color: theme.colors.text0, marginBottom: 4,
  },
});
