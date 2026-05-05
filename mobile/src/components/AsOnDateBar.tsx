import React from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '@theme/index';
import { fmtAsOnDate, dayTag } from '@utils/date';

interface Props {
  asOfDate: string;            // ISO yyyy-mm-dd
  onPress?: () => void;        // open the date picker
}

export function AsOnDateBar({ asOfDate, onPress }: Props): React.JSX.Element {
  const tag = dayTag(asOfDate);
  const isPartial = tag === 'Live';
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.bar}>
      <View style={styles.icon}><Text style={styles.iconTxt}>📅</Text></View>
      <View style={styles.body}>
        <Text style={styles.label}>As on date</Text>
        <View style={styles.row}>
          <Text style={styles.value}>{fmtAsOnDate(asOfDate)}</Text>
          <View style={[styles.tag, isPartial && styles.tagAmber]}>
            <Text style={[styles.tagText, isPartial && styles.tagTextAmber]}>{tag}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.chev}>⌄</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: theme.spacing.lg, paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(212,175,106,0.08)',
    borderWidth: 1, borderColor: 'rgba(212,175,106,0.22)',
    marginBottom: theme.spacing.xxl,
  },
  icon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(212,175,106,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: theme.spacing.lg,
  },
  iconTxt: { fontSize: 16 },
  body: { flex: 1 },
  label: {
    fontSize: 10, color: theme.colors.text2,
    textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  value: {
    fontFamily: theme.fonts.numeric,
    fontSize: 14, fontWeight: '700', color: theme.colors.text0, marginRight: 8,
  },
  tag: {
    backgroundColor: 'rgba(212,175,106,0.14)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  tagAmber: { backgroundColor: 'rgba(255,177,60,0.18)' },
  tagText:  { fontSize: 10, fontWeight: '700', color: theme.colors.gold },
  tagTextAmber: { color: theme.colors.amber },
  chev: { color: theme.colors.text2, fontSize: 18, marginLeft: 4 },
});
