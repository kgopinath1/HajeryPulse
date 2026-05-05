/**
 * Inbox — list of pending approval requests.
 * Tapping a row pushes ApprovalDetailScreen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView, Text, View, RefreshControl, ActivityIndicator,
  TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { theme } from '@theme/index';
import { Chip } from '@components/Chip';
import { SegTabs } from '@components/SegTabs';
import { inboxApi } from '@api/inbox';
import { fmtKwd } from '@utils/format';
import { ApprovalRequestSummary, ApprovalStatus } from '@types/domain';
import { RootStackParamList } from '@navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AppTabs'>;

export function InboxScreen(): React.JSX.Element {
  const nav = useNavigation<Nav>();
  const [status, setStatus] = useState<ApprovalStatus | 'all'>('Pending');
  const [items, setItems] = useState<ApprovalRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await inboxApi.list(status, 50);
      setItems(r.items);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ padding: 14 }}>
        <Text style={styles.h2}>Inbox</Text>
        <Text style={styles.subhead}>LPO · Asset · Expense · HR approvals</Text>
      </View>

      <View style={{ paddingHorizontal: 14 }}>
        <SegTabs<ApprovalStatus | 'all'>
          value={status}
          onChange={setStatus}
          options={[
            { key: 'Pending',  label: 'Pending' },
            { key: 'Approved', label: 'Approved' },
            { key: 'Rejected', label: 'Rejected' },
            { key: 'all',      label: 'All' },
          ]}
        />
      </View>

      {loading
        ? <View style={styles.center}><ActivityIndicator color={theme.colors.gold} /></View>
        : (
          <ScrollView
            contentContainerStyle={{ padding: 14, paddingBottom: 80 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.gold} />}
          >
            {items.length === 0 && (
              <Text style={styles.empty}>No {status.toLowerCase()} requests.</Text>
            )}
            {items.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => nav.navigate('ApprovalDetail', { requestId: item.id })}
              >
                <View style={styles.cardHead}>
                  <Chip label={item.type.toUpperCase()} tone={item.type === 'lpo' ? 'gold' : 'blue'} />
                  <Text style={styles.id}>{item.id}</Text>
                  <Chip label={item.status} tone={statusTone(item.status)} />
                </View>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <View style={styles.cardFoot}>
                  <Text style={styles.meta}>{item.requester}</Text>
                  <Text style={styles.amount}>{fmtKwd(item.amountKwd)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )
      }
    </SafeAreaView>
  );
}

function statusTone(s: ApprovalStatus) {
  switch (s) {
    case 'Pending':       return 'amber' as const;
    case 'Approved':      return 'green' as const;
    case 'Rejected':      return 'red' as const;
    case 'Clarification': return 'blue'  as const;
  }
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.colors.bg0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h2: { fontSize: 22, fontWeight: '700', color: theme.colors.text0 },
  subhead: { fontSize: 12, color: theme.colors.text2, marginTop: 2 },
  empty:   { color: theme.colors.text2, textAlign: 'center', marginTop: 50 },
  card:    {
    padding: 14, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: 10,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  id:       { color: theme.colors.text2, fontFamily: theme.fonts.numeric, fontSize: 11, flex: 1 },
  title:    { fontSize: 14, fontWeight: '600', color: theme.colors.text0, marginBottom: 8 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta:     { fontSize: 11, color: theme.colors.text2 },
  amount:   {
    fontFamily: theme.fonts.numeric,
    fontSize: 14, fontWeight: '700', color: theme.colors.gold,
  },
});
