import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { theme } from '@theme/index';

interface Props<T extends string> {
  options: { key: T; label: string ; icon?: React.ReactNode;}[];
  value: T;
  onChange: (key: T) => void;
}

export function SegTabs<T extends string>({ options, value, onChange }: Props<T>): React.JSX.Element {
  return (
    <View style={styles.row}>
      {options.map(o => {
        const active = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.btn, active && styles.btnActive]}
          >
            <View style={styles.content}>
  {o.icon}
  <Text style={[styles.txt, active && styles.txtActive]}>
    {o.label}
  </Text>
</View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 3,
    marginVertical: theme.spacing.sm,
  },
  btn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.sm,
  },
  btnActive: { backgroundColor: 'rgba(212,175,106,0.16)' },
  txt: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text2 },
  txtActive: { color: theme.colors.gold },
  content: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
},
});
