/**
 * Home screen — daily snapshot: revenue, quick KPIs.
 *
 * Data notes:
 *  - Greeting name comes from useAuth()'s real user (Entra ID claims via /me).
 *  - Revenue is REAL — GET /api/v1/home/revenue-summary (F&B + Pharmacy,
 *    blended growth %; WT excluded for now, see sp_GetHomeCombinedRevenue).
 *  - Quick KPIs are REAL — GET /api/v1/home/quick-kpis, always month-to-date
 *    vs. prior month (MoM), regardless of any period selector elsewhere.
 *    - "Orders" blends WT's real order count with FB/Pharmacy's transaction
 *      counts as a proxy — not strictly the same concept per business line.
 *    - "Gross Margin" is Pharmacy + WT only — F&B has no COGS tracked in
 *      fact.FBSales, so it can't be included.
 *    - "Fulfillment" has no data source anywhere yet — stays a placeholder.
 *  - Urgent approval banner and Pending Approvals list remain commented out —
 *    both depend on InboxController, which is currently fully commented
 *    out server-side. Re-enable once that's built.
 */
import React, { useEffect, useState } from 'react';
import {
  ScrollView, Text, View, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { theme } from '@theme/index';
import { Card } from '@components/Card';
import { SectionTitle } from '@components/SectionTitle';
import { KpiTile } from '@components/KpiTile';
import { Chip } from '@components/Chip';
// import { Row } from '@components/Row'; // TODO: re-enable once pending approvals are live
import { AsOnDateBar } from '@components/AsOnDateBar';
import { AsOnDateModal } from '@components/AsOnDateModal';
import { useAuth } from '@auth/AuthContext';
import { homeApi } from '@api/home';
import { defaultAsOfDate } from '@utils/date';
import { fmtKwd, fmtYoy } from '@utils/format';

interface RevenueState {
  totalKwd: number;
  growthPct: number;
  growthType: string;
}

interface QuickKpisState {
  totalOrders: number;
  ordersDeltaPct: number;
  avgOrderValueKwd: number;
  avgOrderValueDeltaPct: number;
  grossMarginPct: number;
  grossMarginDeltaPp: number;
  fulfillmentPct: number;
  fulfillmentDeltaPp: number;
}

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

  const [revenue, setRevenue] = useState<RevenueState | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);

  const [kpis, setKpis] = useState<QuickKpisState | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  const displayName = user?.name || 'there';

  useEffect(() => {
    let cancelled = false;
    setRevenueLoading(true);

    homeApi.revenueSummary(asOfDate, 'week')
      .then(r => {
        if (cancelled) return;
        setRevenue({
          totalKwd: r.totalRevenueKwd,
          growthPct: r.growthPct,
          growthType: r.growthType,
        });
      })
      .catch(err => {
        console.error('Failed to load combined revenue:', err);
      })
      .finally(() => {
        if (!cancelled) setRevenueLoading(false);
      });

    return () => { cancelled = true; };
  }, [asOfDate]);

  useEffect(() => {
    let cancelled = false;
    setKpisLoading(true);

    homeApi.quickKpis(asOfDate)
      .then(k => {
        if (cancelled) return;
        setKpis({
          totalOrders: k.totalOrders,
          ordersDeltaPct: k.ordersDeltaPct,
          avgOrderValueKwd: k.avgOrderValueKwd,
          avgOrderValueDeltaPct: k.avgOrderValueDeltaPct,
          grossMarginPct: k.grossMarginPct,
          grossMarginDeltaPp: k.grossMarginDeltaPp,
          fulfillmentPct: k.fulfillmentPct,
          fulfillmentDeltaPp: k.fulfillmentDeltaPp,
        });
      })
      .catch(err => {
        console.error('Failed to load quick KPIs:', err);
      })
      .finally(() => {
        if (!cancelled) setKpisLoading(false);
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

        {/* Revenue — real, blended F&B + Pharmacy via sp_GetHomeCombinedRevenue */}
        <Card>
          {revenueLoading && !revenue ? (
            <ActivityIndicator color={theme.colors.gold} />
          ) : revenue ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>REVENUE · {asOfDate}</Text>
                <Text style={styles.hero}>{fmtKwd(revenue.totalKwd)}</Text>
                <View style={{ marginTop: 6 }}>
                  <Chip
                    label={fmtYoy(revenue.growthPct, revenue.growthType)}
                    tone={revenue.growthPct >= 0 ? 'green' : 'red'}
                  />
                </View>
                <Text style={styles.helperText}>
                  Combined: F&amp;B + Pharmacy
                </Text>
              </View>
              <Ionicons name="trending-up" size={40} color={theme.colors.gold} />
            </View>
          ) : (
            <Text style={styles.emptyText}>Revenue unavailable</Text>
          )}
        </Card>

        {/* Urgent approval banner — PLACEHOLDER, disabled until Inbox exists
        {urgentApproval && (
          <TouchableOpacity
            style={styles.urgentBanner}
            // @ts-expect-error — ApprovalDetail lives on the root stack
            onPress={() => navigation.navigate('ApprovalDetail', { id: urgentApproval.id })}
          >
            <Ionicons name="alert-circle" size={20} color={theme.colors.red} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.urgentTitle}>{urgentApproval.title}</Text>
              <Text style={styles.urgentSubtitle}>{urgentApproval.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.text3} />
          </TouchableOpacity>
        )}
        */}

        {/* Quick KPIs — real, month-to-date vs prior month (MoM), except Fulfillment */}
        <SectionTitle
          title="Quick KPIs"
          rightLabel={
            <TouchableOpacity onPress={() => {/* TODO: navigate to full KPI screen */}}>
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          }
        />
        <View style={styles.kpiGrid}>
          {kpisLoading && !kpis ? (
            <Card style={{ flex: 1, minWidth: '100%' }}>
              <ActivityIndicator color={theme.colors.gold} />
            </Card>
          ) : kpis ? (
            <>
              <KpiTile
                label="Orders (blended)"
                value={String(kpis.totalOrders)}
                delta={{
                  value: `${kpis.ordersDeltaPct >= 0 ? '+' : ''}${kpis.ordersDeltaPct.toFixed(1)}%`,
                  positive: kpis.ordersDeltaPct >= 0,
                }}
              />
              <KpiTile
                label="Avg. Order Value"
                value={fmtKwd(kpis.avgOrderValueKwd)}
                delta={{
                  value: `${kpis.avgOrderValueDeltaPct >= 0 ? '+' : ''}${kpis.avgOrderValueDeltaPct.toFixed(1)}%`,
                  positive: kpis.avgOrderValueDeltaPct >= 0,
                }}
              />
              <KpiTile
                label="Gross Margin (Pharma + WT)"
                value={`${kpis.grossMarginPct.toFixed(1)}%`}
                delta={{
                  value: `${kpis.grossMarginDeltaPp >= 0 ? '+' : ''}${kpis.grossMarginDeltaPp.toFixed(1)}pp`,
                  positive: kpis.grossMarginDeltaPp >= 0,
                }}
                
              />
              {/* Fulfillment */}
              <KpiTile
                label="Fulfillment (W&T)"
                value={`${kpis.fulfillmentPct.toFixed(1)}%`}
                delta={{
                  value: `${kpis.fulfillmentDeltaPp >= 0 ? '+' : ''}${kpis.fulfillmentDeltaPp.toFixed(1)}pp`,
                  positive: kpis.fulfillmentDeltaPp >= 0,
                }}
              />
               </>
          ) : (
            <Card style={{ flex: 1, minWidth: '100%' }}>
              <Text style={styles.emptyText}>Quick KPIs unavailable</Text>
            </Card>
          )}
        </View>

        {/* Pending approvals — PLACEHOLDER, disabled until Inbox exists
        <SectionTitle title="Pending Approvals" />
        <Card>
          {pendingApprovals.length > 0 ? (
            pendingApprovals.map(a => (
              <Row
                key={a.id}
                avatar={{ initials: a.initials, color: a.color }}
                title={a.title}
                subtitle={a.subtitle}
                amount={fmtKwd(a.amountKwd)}
                delta={{ label: a.dueLabel, tone: 'neutral' }}
                // @ts-expect-error — ApprovalDetail lives on the root stack
                onPress={() => navigation.navigate('ApprovalDetail', { id: a.id })}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No pending approvals</Text>
          )}
        </Card>
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

  eyebrow: { fontSize: 11, color: theme.colors.text2, textTransform: 'uppercase', letterSpacing: 0.6 },
  hero: { fontFamily: theme.fonts.numeric, fontSize: 26, fontWeight: '700', color: theme.colors.text0, marginTop: 4 },
  helperText: { fontSize: 11, color: theme.colors.text3, marginTop: 6 },

  urgentBanner: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, marginTop: 14, marginBottom: 4,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(229,72,77,0.10)',
    borderWidth: 1, borderColor: 'rgba(229,72,77,0.25)',
  },
  urgentTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.red },
  urgentSubtitle: { fontSize: 11, color: theme.colors.text2, marginTop: 2 },

  viewAll: { fontSize: 12, fontWeight: '600', color: theme.colors.gold },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 14 },

  emptyText: {
    color: theme.colors.text2,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
});