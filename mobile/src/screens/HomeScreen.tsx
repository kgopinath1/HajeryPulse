/**
 * Home screen — per-business-line revenue snapshot.
 *
 * Replaces the old blended-revenue card + Quick KPIs grid with three
 * tappable revenue cards, in order: Wholesale & Tender → F&B → Pharmacy.
 * Each card navigates to its business-line screen.
 *
 * Data notes:
 *  - Each line is fetched independently (allSettled) so one failing API
 *    doesn't blank the whole Home screen.
 *  - Period is fixed to 'month' here (Home has no period selector yet);
 *    change HOME_PERIOD or lift it into state to add one later.
 *  - Data shapes differ per API and are normalized via the to*Data()
 *    adapters below into RevenueCardData.
 *  - Urgent approval banner / Pending Approvals remain disabled — they
 *    depend on InboxController, which is commented out server-side.
 */
import React, { useEffect, useState } from 'react';
import {
  ScrollView, Text, View, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { theme } from '@theme/index';
import { SectionTitle } from '@components/SectionTitle';
import { AsOnDateBar } from '@components/AsOnDateBar';
import { AsOnDateModal } from '@components/AsOnDateModal';
import { RevenueCard, RevenueCardData, Period } from '@components/RevenueCard';
import { useAuth } from '@auth/AuthContext';
import { defaultAsOfDate } from '@utils/date';

// TODO: adjust these imports to your actual API modules — they should be
// the same ones WTScreen / FBScreen / PharmacyScreen already use.
import { salesApi } from '@api/sales';
import { fbApi } from '@api/fb';
import { pharmaApi } from '@api/pharma';
import {
  BTFilter,
 FbScopeType,
} from '@types/domain';
/** Home always shows month-to-date for now. */
const HOME_PERIOD: Period = 'month';

/* ------------------------------------------------------------------ */
/* Adapters — normalize each API's shape into RevenueCardData          */
/* ------------------------------------------------------------------ */

// WT: summary carries everything, incl. spark/sparkLY
// (summary.revenue.kwd / .wow / .growthType)
function toWtData(s: any): RevenueCardData {
  return {
    revenueKwd: s.revenue.kwd,
    growthPct: s.revenue.wow,
    growthType: s.revenue.growthType,
    current: s.spark ?? [],
    previous: s.sparkLY ?? [],
  };
}

// F&B and Pharmacy: summary + separate trend response
// (summary.revenueKwd / .growthPct / .growthType, trend.current/.previous)
function toLineData(summary: any, trend: any): RevenueCardData {
  return {
    revenueKwd: summary.revenueKwd,
    growthPct: summary.growthPct,
    growthType: summary.growthType,
    current: trend?.current ?? [],
    previous: trend?.previous ?? [],
  };
}

/* ------------------------------------------------------------------ */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomeScreen(): React.JSX.Element {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [asOfDate, setAsOfDate] = useState(defaultAsOfDate());
  const [dateModalVisible, setDateModalVisible] = useState(false);

  const [wt, setWt] = useState<RevenueCardData | null>(null);
  const [fb, setFb] = useState<RevenueCardData | null>(null);
  const [pharmacy, setPharmacy] = useState<RevenueCardData | null>(null);
  const [loading, setLoading] = useState(true);

const scopeType: FbScopeType = 'all';
const scopeId: string | null = null;
const bt: BTFilter = 'both';
const pharmacyId = 'all';
  const displayName = user?.name || 'there';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Each line independently — one failure shouldn't blank the others.
    // TODO: match method names/signatures to what each screen already calls.
    const wtP = salesApi.summary(asOfDate, bt, HOME_PERIOD)
      .then(s => { if (!cancelled) setWt(toWtData(s)); });

    const fbP = Promise.all([
      fbApi.summary(asOfDate, scopeType, scopeId, HOME_PERIOD),
      fbApi.trend(asOfDate, scopeType, scopeId, HOME_PERIOD),
    ]).then(([s, t]) => { if (!cancelled) setFb(toLineData(s, t)); });

    const phP = Promise.all([
       pharmaApi.summary(asOfDate, pharmacyId, HOME_PERIOD),
    
      pharmaApi.trend(asOfDate, pharmacyId,HOME_PERIOD),
    ]).then(([s, t]) => { if (!cancelled) setPharmacy(toLineData(s, t)); });

    Promise.allSettled([wtP, fbP, phP]).then(results => {
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          const line = ['WholesaleTenderScreen', 'F&FBScreen', 'PharmaciesScreen'][i];
          console.error(`Failed to load ${line} revenue:`, r.reason);
        }
      });
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [asOfDate]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatarWrap}
            // @ts-expect-error — Profile lives on the root stack, not this tab's navigator
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(displayName)}</Text>
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.greetingSmall}>{greeting()}</Text>
            <Text style={styles.greetingName}>{displayName}</Text>
          </View>

          <TouchableOpacity
            style={styles.bellButton}
            // TODO: navigate to a notifications screen once one exists
            onPress={() => {}}
          >
            <Ionicons name="notifications-outline" size={18} color={theme.colors.text0} />
            {/* TODO: badge count is a placeholder */}
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>7</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Date */}
        <AsOnDateBar asOfDate={asOfDate} onPress={() => setDateModalVisible(true)} />

        {/* Business-line revenue cards — WT → F&B → Pharmacy */}
        <SectionTitle title="Wholesale & Tender" />

        <View style={styles.cardStack}>
          <RevenueCard
            title="Wholesale & Tender"
            period={HOME_PERIOD}
            data={wt}
            loading={loading}
            primaryColor={theme.colors.goldSoft}
            previousLabel="Last Period"
            onPress={() => navigation.navigate('WholesaleTender')}
          />

 <SectionTitle title="Food & Beverage" />
          <RevenueCard
            title="Food & Beverage"
            period={HOME_PERIOD}
            data={fb}
            loading={loading}
            primaryColor={theme.colors.pink}
            // @ts-expect-error — TODO: use your actual F&B route/tab name
            onPress={() => navigation.navigate('FB')}
          />
<SectionTitle title="Pharmacy" />
          <RevenueCard
            title="Pharmacy"
            period={HOME_PERIOD}
            data={pharmacy}
            loading={loading}
            primaryColor={theme.colors.teal}
            // @ts-expect-error — TODO: use your actual Pharmacy route/tab name
            onPress={() => navigation.navigate('Pharmacies')}
          />
        </View>

        {/* Urgent approval banner — PLACEHOLDER, disabled until Inbox exists
        {urgentApproval && ( ... )}
        */}

        {/* Pending approvals — PLACEHOLDER, disabled until Inbox exists
        <SectionTitle title="Pending Approvals" />
        ...
        */}
      </ScrollView>

      <AsOnDateModal
        visible={dateModalVisible}
        onClose={() => setDateModalVisible(false)}
        currentDate={asOfDate}
        onSelect={setAsOfDate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg0 },
  scroll: { padding: 14, paddingBottom: 80 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatarWrap: {},
  avatar: {
    width: 44, height: 44, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.teal,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: theme.colors.bg0 },
  greetingSmall: { fontSize: 12, color: theme.colors.text2 },
  greetingName: { fontSize: 17, fontWeight: '700', color: theme.colors.text0, marginTop: 1 },
  bellButton: {
    width: 38, height: 38, borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: theme.colors.pink,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { fontSize: 9, fontWeight: '700', color: theme.colors.text0 },

  cardStack: { gap: 10, marginTop: 4, marginBottom: 14 },
});
