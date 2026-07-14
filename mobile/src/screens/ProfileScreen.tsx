/**
 * Profile screen — executive profile, preferences, and account actions.
 *
 * Data notes:
 *  - Name/email come from useAuth()'s real user object (Entra ID claims via /me).
 *  - Job title, "Approved this month", and "Avg. response time" are NOT part
 *    of AuthUserDto today — these are business metrics that would need a
 *    dedicated endpoint (e.g. GET /api/v1/profile/stats) or an extra field
 *    on AuthUserDto if title is meant to come from Entra ID / your directory.
 *    Passed as props here with sensible fallbacks so the screen renders
 *    correctly once that data source exists.
 */
import React from 'react';
import {
  ScrollView, Text, View, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { theme } from '@theme/index';
import { Card } from '@components/Card';
import { SectionTitle } from '@components/SectionTitle';
import { useAuth } from '@auth/AuthContext';

interface ProfileStats {
  approvedThisMonth: number;
  avgResponseTimeHours: number;
}

interface ProfileScreenProps {
  // TODO: replace with a real data source once available — e.g. a
  // useProfileStats() hook backed by GET /api/v1/profile/stats.
  stats?: ProfileStats;
  jobTitle?: string;
  organization?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

const PREFERENCES = [
  {
    key: 'notifications',
    icon: 'notifications-outline',
    title: 'Push notifications',
    subtitle: 'Approvals · KPI alerts · SLA breaches',
  },
  {
    key: 'dashboards',
    icon: 'star-outline',
    title: 'Favorite dashboards',
    subtitle: 'Sales, Inventory WH-03, Overdue AR',
  },
  {
    key: 'security',
    icon: 'lock-closed-outline',
    title: 'Security & Face ID',
    subtitle: 'Biometric · session timeout 5m',
  },
  {
    key: 'delegation',
    icon: 'time-outline',
    title: 'Delegation rules',
    subtitle: 'CFO delegated while traveling',
  },
] as const;

export function ProfileScreen({
  stats,
  jobTitle = 'Team Member',
  organization = 'Hajery Group',
}: ProfileScreenProps): React.JSX.Element {
  const { user, signOut } = useAuth();
  const displayName = user?.name || 'Unknown User';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h2}>Profile</Text>
        <Text style={styles.subhead}>Account · Preferences · Security</Text>

        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(displayName)}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.role}>{jobTitle} · {organization}</Text>
        </View>

        {/* Stats */}
        {/* <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.eyebrow}>APPROVED THIS MONTH</Text>
            <Text style={styles.statValue}>{stats?.approvedThisMonth ?? '—'}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.eyebrow}>AVG. RESPONSE TIME</Text>
            <Text style={styles.statValue}>
              {stats?.avgResponseTimeHours != null ? `${stats.avgResponseTimeHours}h` : '—'}
            </Text>
          </Card>
        </View> */}

        {/* Preferences */}
       {/*  <SectionTitle title="Preferences" />
        <Card>
          {PREFERENCES.map((item, idx) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.listItem,
                idx === PREFERENCES.length - 1 && styles.listItemLast,
              ]}
              onPress={() => {
                // TODO: navigate to the relevant settings screen
              }}
            >
              <View style={styles.listIcon}>
                <Ionicons name={item.icon} size={18} color={theme.colors.text1} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{item.title}</Text>
                <Text style={styles.listSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.text3} />
            </TouchableOpacity>
          ))}
        </Card> */}

        {/* Account */}
        <SectionTitle title="Account" />
        <Card>
          <TouchableOpacity
            style={[styles.listItem, styles.listItemLast]}
            onPress={signOut}
          >
            <View style={styles.listIcon}>
              <Ionicons name="log-out-outline" size={18} color={theme.colors.red} />
            </View>
            <Text style={[styles.listTitle, { color: theme.colors.red }]}>Sign out</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg0 },
  scroll: { padding: 14, paddingBottom: 80 },
  h2: { fontSize: 22, fontWeight: '700', color: theme.colors.text0 },
  subhead: { fontSize: 12, color: theme.colors.text2, marginTop: 2, marginBottom: 14 },

  avatarWrap: { alignItems: 'center', marginBottom: theme.spacing.lg },
  avatar: {
    width: 72, height: 72, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 26, fontWeight: '700', color: theme.colors.bg0 },
  name: { fontSize: theme.fontSize.lg ?? 18, fontWeight: '700', color: theme.colors.text0 },
  role: { fontSize: theme.fontSize.sm, color: theme.colors.text2, marginTop: 2 },

  eyebrow: {
    fontSize: 11, color: theme.colors.text2,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: { flex: 1 },
  statValue: {
    fontFamily: theme.fonts.numeric, fontSize: 22,
    fontWeight: '700', color: theme.colors.text0, marginTop: 6,
  },

  listItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  listItemLast: { borderBottomWidth: 0 },
  listIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  listTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.text0 },
  listSubtitle: { fontSize: 11, color: theme.colors.text2, marginTop: 2 },
});