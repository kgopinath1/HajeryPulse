/**
 * Approval detail — full request view with line items, attachments,
 * history, and approve/reject/clarify actions.
 */
import React, { useEffect, useState } from 'react';
import {
  ScrollView, Text, View, ActivityIndicator,
  TouchableOpacity, Alert, TextInput, Modal, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';

import { theme } from '@theme/index';
import { Card } from '@components/Card';
import { Chip } from '@components/Chip';
import { useAuth } from '@auth/AuthContext';
import { inboxApi } from '@api/inbox';
import { fmtKwd } from '@utils/format';
import { ApprovalRequestDetail } from '@types/domain';
import { RootStackParamList } from '@navigation/types';

type Route = RouteProp<RootStackParamList, 'ApprovalDetail'>;

export function ApprovalDetailScreen(): React.JSX.Element {
  const { params } = useRoute<Route>();
  const nav = useNavigation();
  const { reauthenticate } = useAuth();

  const [detail, setDetail] = useState<ApprovalRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modalAction, setModalAction] = useState<'approve' | 'reject' | 'clarify' | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    inboxApi.detail(params.requestId).then(setDetail).finally(() => setLoading(false));
  }, [params.requestId]);

  const submit = async () => {
    if (!detail) return;

    // Biometric reauth before any write
    const ok = await reauthenticate();
    if (!ok) {
      Alert.alert('Authentication failed', 'Please try again.');
      return;
    }

    setBusy(true);
    try {
      switch (modalAction) {
        case 'approve': await inboxApi.approve(detail.id, comment);   break;
        case 'reject':  await inboxApi.reject (detail.id, comment);   break;
        case 'clarify': await inboxApi.clarify(detail.id, comment);   break;
      }
      Alert.alert('Done', 'Your decision has been recorded.');
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Action failed', e.message ?? 'Please try again.');
    } finally {
      setBusy(false);
      setModalAction(null);
      setComment('');
    }
  };

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={theme.colors.gold} /></SafeAreaView>;
  if (!detail) return <SafeAreaView style={styles.center}><Text style={{ color: theme.colors.text2 }}>Request not found.</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 120 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <Chip label={detail.type.toUpperCase()} tone="gold" />
          <Chip label={detail.status} tone={detail.status === 'Pending' ? 'amber' : detail.status === 'Approved' ? 'green' : 'red'} />
          <Text style={{ flex: 1, color: theme.colors.text2, textAlign: 'right', fontFamily: theme.fonts.numeric }}>{detail.id}</Text>
        </View>

        <Text style={styles.title}>{detail.title}</Text>
        <Text style={styles.amount}>{fmtKwd(detail.amountKwd)}</Text>

        <Card>
          <Text style={styles.label}>Requester</Text>
          <Text style={styles.value}>{detail.requester}</Text>
          <Text style={[styles.label, { marginTop: 8 }]}>BU</Text>
          <Text style={styles.value}>{detail.buCode}</Text>
          <Text style={[styles.label, { marginTop: 8 }]}>Description</Text>
          <Text style={styles.body}>{detail.description}</Text>
        </Card>

        {/* Line items */}
        {detail.lineItems.length > 0 && (
          <>
            <Text style={styles.section}>Line items</Text>
            <Card>
              {detail.lineItems.map(li => (
                <View key={li.itemNo} style={styles.line}>
                  <Text style={styles.lineDesc}>{li.description}</Text>
                  <Text style={styles.lineMeta}>{li.qty} × {fmtKwd(li.unitPriceKwd / 1000)} · {li.vendor}</Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Attachments */}
        {detail.attachments.length > 0 && (
          <>
            <Text style={styles.section}>Attachments</Text>
            <Card>
              {detail.attachments.map(a => (
                <Text key={a.fileName} style={styles.attach}>📎 {a.fileName}  ({Math.round(a.sizeBytes / 1024)} KB)</Text>
              ))}
            </Card>
          </>
        )}

        {/* History */}
        <Text style={styles.section}>History</Text>
        <Card>
          {detail.history.map((e, i) => (
            <View key={i} style={styles.histRow}>
              <Text style={styles.histDate}>{new Date(e.occurredAt).toLocaleString()}</Text>
              <Text style={styles.histAction}><Text style={{ fontWeight: '600' }}>{e.user}</Text> · {e.action}</Text>
              {e.comment && <Text style={styles.histComment}>{e.comment}</Text>}
            </View>
          ))}
        </Card>
      </ScrollView>

      {/* Action bar */}
      {detail.status === 'Pending' && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnReject]}  onPress={() => setModalAction('reject')}><Text style={styles.btnText}>Reject</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnClarify]} onPress={() => setModalAction('clarify')}><Text style={styles.btnText}>Clarify</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={() => setModalAction('approve')}><Text style={[styles.btnText, { color: theme.colors.bg0 }]}>Approve</Text></TouchableOpacity>
        </View>
      )}

      {/* Comment modal */}
      <Modal visible={modalAction !== null} transparent animationType="slide" onRequestClose={() => setModalAction(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {modalAction === 'approve' ? 'Approve request' : modalAction === 'reject' ? 'Reject request' : 'Ask for clarification'}
            </Text>
            <TextInput
              style={styles.input}
              multiline
              placeholder={modalAction === 'clarify' ? 'What information do you need?' : 'Optional comment'}
              placeholderTextColor={theme.colors.text3}
              value={comment} onChangeText={setComment}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalAction(null)}>
                <Text style={{ color: theme.colors.text1 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSend} onPress={submit} disabled={busy}>
                {busy ? <ActivityIndicator color={theme.colors.bg0} /> : <Text style={{ color: theme.colors.bg0, fontWeight: '700' }}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.colors.bg0 },
  center: { flex: 1, backgroundColor: theme.colors.bg0, alignItems: 'center', justifyContent: 'center' },
  title:  { fontSize: 20, fontWeight: '700', color: theme.colors.text0, marginBottom: 4 },
  amount: { fontFamily: theme.fonts.numeric, fontSize: 22, fontWeight: '700', color: theme.colors.gold, marginBottom: 12 },
  label:  { fontSize: 10, color: theme.colors.text2, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },
  value:  { fontSize: 13, color: theme.colors.text0, fontWeight: '600', marginTop: 2 },
  body:   { fontSize: 13, color: theme.colors.text1, marginTop: 4, lineHeight: 18 },
  section:{ fontSize: 16, fontWeight: '700', color: theme.colors.text0, marginTop: 14, marginBottom: 6 },
  line:   { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  lineDesc:{ fontSize: 13, fontWeight: '600', color: theme.colors.text0 },
  lineMeta:{ fontSize: 11, color: theme.colors.text2, marginTop: 2 },
  attach:  { fontSize: 12, color: theme.colors.text1, paddingVertical: 6 },
  histRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  histDate:{ fontSize: 10, color: theme.colors.text3 },
  histAction:{ fontSize: 12, color: theme.colors.text1, marginTop: 2 },
  histComment:{ fontSize: 11, color: theme.colors.text2, marginTop: 4, fontStyle: 'italic' },
  actions: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 8, padding: 14,
    backgroundColor: theme.colors.bg0,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  btn: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  btnReject:  { backgroundColor: theme.colors.red },
  btnClarify: { backgroundColor: theme.colors.blue },
  btnApprove: { backgroundColor: theme.colors.gold },
  btnText:    { color: 'white', fontWeight: '700', fontSize: 13 },
  modalBg:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modal:      {
    backgroundColor: theme.colors.bg1,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text0, marginBottom: 12 },
  input:      {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border,
    color: theme.colors.text0,
    padding: 12, minHeight: 80, marginBottom: 12,
    fontSize: 13,
  },
  modalBtnCancel: { flex: 1, padding: 14, alignItems: 'center', borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
  modalBtnSend:   { flex: 1, padding: 14, alignItems: 'center', borderRadius: theme.radius.md, backgroundColor: theme.colors.gold },
});
