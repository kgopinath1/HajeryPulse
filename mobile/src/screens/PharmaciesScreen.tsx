/**
 * Pharmacies dashboard.
 *
 * Filter: tap the pharmacy bar to open a picker; selection rescales every widget.
 * Widgets: revenue card, KPI grid (with Rx share), Rx vs OTC mix,
 * Margin Analysis, Sales Quality, channels, payments, top 10 pharmacies,
 * highest-discount leaderboard, top 10 categories.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView, Text, View, RefreshControl, ActivityIndicator,
  TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@theme/index';
import { Card } from '@components/Card';
import { Chip } from '@components/Chip';
import { KpiTile } from '@components/KpiTile';
import { SectionTitle } from '@components/SectionTitle';
import { SegTabs } from '@components/SegTabs';
import { Sparkline } from '@components/Sparkline';
import { StackedBar } from '@components/StackedBar';
import { AsOnDateBar } from '@components/AsOnDateBar';
import { PickerModal } from '@components/PickerModal';
import { Row } from '@components/Row';

import { pharmaApi } from '@api/pharma';
import { defaultAsOfDate } from '@utils/date';
import { fmtKwd, fmtPct, fmtInt, fmtYoy } from '@utils/format';
import {
  Pharmacy, PharmaSummary, PharmaMargin, SalesQuality,
  PharmaChannel, PharmaPaymentRow, PharmaCategoryRow,
  PharmaDiscountRow, PharmaRxOtcMix,
} from '@types/domain';

export function PharmaciesScreen(): React.JSX.Element {
  const [asOfDate] = useState<string>(defaultAsOfDate());
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [pharmacyId, setPharmacyId] = useState<string>('all');
  const [pickerVisible, setPickerVisible] = useState(false);

  const [summary,  setSummary]  = useState<PharmaSummary | null>(null);
  const [margin,   setMargin]   = useState<PharmaMargin | null>(null);
  const [quality,  setQuality]  = useState<SalesQuality | null>(null);
  const [channels, setChannels] = useState<PharmaChannel | null>(null);
  const [payments, setPayments] = useState<PharmaPaymentRow[]>([]);
  const [categories, setCategories] = useState<PharmaCategoryRow[]>([]);
  const [rxMix,    setRxMix]    = useState<PharmaRxOtcMix | null>(null);
  const [discounts, setDiscounts] = useState<PharmaDiscountRow[]>([]);
  const [topPharm, setTopPharm] = useState<Pharmacy[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load list of pharmacies once
  useEffect(() => { pharmaApi.list().then(setPharmacies); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m, q, ch, pay, cats, rx, disc, top] = await Promise.all([
        pharmaApi.summary(asOfDate, pharmacyId),
        pharmaApi.margin(asOfDate, pharmacyId),
        pharmaApi.quality(asOfDate, pharmacyId),
        pharmaApi.channels(asOfDate, pharmacyId),
        pharmaApi.payments(asOfDate, pharmacyId),
        pharmaApi.categories(asOfDate, pharmacyId, 10),
        pharmaApi.rxOtcMix(asOfDate, pharmacyId),
        pharmaApi.discountLeaderboard(asOfDate, 10),
        pharmaApi.topPharmacies(asOfDate, 10),
      ]);
      setSummary(s); setMargin(m); setQuality(q); setChannels(ch);
      setPayments(pay); setCategories(cats); setRxMix(rx);
      setDiscounts(disc); setTopPharm(top);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [asOfDate, pharmacyId]);

  useEffect(() => { load(); }, [load]);

  const currentPharmacyName =
    pharmacies.find(p => p.id === pharmacyId)?.name ?? 'All Pharmacies';

  if (loading && !summary) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={theme.colors.gold} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.gold} />}
      >
        <Text style={styles.h2}>Pharmacies</Text>
        <Text style={styles.subhead}>Retail · Rx + OTC</Text>

        {/* Pharmacy filter bar */}
        <TouchableOpacity style={styles.filterBar} onPress={() => setPickerVisible(true)}>
          <Text style={styles.filterIcon}>🏥</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>PHARMACY FILTER</Text>
            <Text style={styles.filterValue}>{currentPharmacyName}</Text>
          </View>
          <Chip label={pharmacyId === 'all' ? `${pharmacies.length - 1} branches` : '1 branch'} tone="teal" />
        </TouchableOpacity>

        <AsOnDateBar asOfDate={asOfDate} />

        <SegTabs value="week" onChange={() => {}} options={[
          { key: 'day', label: 'Day' }, { key: 'week', label: 'Week' },
          { key: 'month', label: 'Month' }, { key: 'ytd', label: 'YTD' },
        ]} />

        {/* Revenue card */}
        {summary && (
          <Card>
            <Text style={styles.eyebrow}>REVENUE · WEEK TO DATE</Text>
            <Text style={styles.hero}>{fmtKwd(summary.revenueKwd)}</Text>
            <View style={{ marginTop: 4 }}>
              <Chip label="▲ 6.8% WoW" tone="teal" />
            </View>
            <View style={{ marginTop: 12 }}>
              <Sparkline values={[85, 70, 80, 55, 62, 45, 50, 30]} color={theme.colors.teal} height={120} />
            </View>
          </Card>
        )}

        {/* KPI grid */}
        {summary && (
          <View style={styles.kpiGrid}>
            <KpiTile label="Transactions" value={fmtInt(summary.transactions)} delta={{ value: '7.2%', positive: true }} />
            <KpiTile label="Basket size"  value={fmtKwd(summary.basketSizeKwd / 1000)} delta={{ value: '2.1%', positive: true }} />
            <KpiTile label="Active stores" value={
              <Text>{summary.storesActive}<Text style={{ fontSize: 12, color: theme.colors.text2 }}>{` / ${summary.storesTotal}`}</Text></Text>
            } chip={{ label: pharmacyId === 'all' ? '1 offline' : 'live', tone: pharmacyId === 'all' ? 'amber' : 'green' }} />
            <KpiTile label="Rx share" value={fmtPct(summary.rxSharePct, 0)} chip={{ label: `OTC ${fmtPct(100 - summary.rxSharePct, 0)}`, tone: 'teal' }} />
          </View>
        )}

        {/* Rx vs OTC */}
        {rxMix && (
          <>
            <SectionTitle title="Rx vs OTC Mix" rightLabel={pharmacyId === 'all' ? 'All pharmacies' : currentPharmacyName} />
            <Card>
              <Text style={styles.eyebrow}>PRESCRIPTION (Rx) SHARE</Text>
              <Text style={[styles.hero, { color: theme.colors.teal }]}>{fmtPct(rxMix.rxPct)}</Text>
              <Text style={styles.subtle}>OTC {fmtPct(rxMix.otcPct)}</Text>
              <View style={{ marginTop: 12 }}>
                <StackedBar
                  segments={[
                    { pct: rxMix.rxPct,  color: theme.colors.teal },
                    { pct: rxMix.otcPct, color: theme.colors.gold },
                  ]}
                  height={16}
                />
              </View>
              <View style={styles.kpiGridInner}>
                <KpiTile label="Prescription (Rx)" value={fmtKwd(rxMix.rxKwd)} delta={{ value: '8.4% WoW', positive: true }} />
                <KpiTile label="Over-the-counter"  value={fmtKwd(rxMix.otcKwd)} delta={{ value: '5.9% WoW', positive: true }} />
              </View>
            </Card>
          </>
        )}

        {/* Margin */}
        {margin && (
          <>
            <SectionTitle title="Margin Analysis" rightLabel={pharmacyId === 'all' ? 'All pharmacies' : currentPharmacyName} />
            <Card>
              <Text style={styles.eyebrow}>GROSS MARGIN %</Text>
              <Text style={[styles.hero, { color: theme.colors.goldSoft }]}>{fmtPct(margin.marginPct)}</Text>
              <Text style={styles.subtle}>vs {fmtPct(margin.marginPctLY)} last year</Text>
              <View style={styles.kpiGridInner}>
                <KpiTile label="Gross sales"   value={fmtKwd(margin.grossKwd)} delta={{ value: '7.4%', positive: true }} />
                <KpiTile label="Discount"      value={`−${fmtKwd(margin.discountKwd)}`} />
                <KpiTile label="Cost of sales" value={fmtKwd(margin.cogsKwd)} delta={{ value: '4.6%', positive: false }} />
                <KpiTile label="Margin"        value={fmtKwd(margin.marginKwd)} delta={{ value: '12.8%', positive: true }} />
              </View>
            </Card>
          </>
        )}

        {/* Sales Quality */}
        {quality && (
          <>
            <SectionTitle title="Sales Quality" rightLabel="Returns analysis" />
            <Card>
              <Text style={styles.eyebrow}>GROSS → NET</Text>
              <Text style={styles.hero}>{fmtKwd(quality.netKwd)}</Text>
              <Text style={styles.subtle}>{fmtPct(quality.netPct)} of gross retained</Text>
              <View style={{ marginTop: 12 }}>
                <StackedBar segments={[
                  { pct: quality.netPct, color: theme.colors.teal },
                  { pct: quality.returnsPct, color: theme.colors.red },
                ]} />
              </View>
            </Card>
          </>
        )}

        {/* Channels */}
        {channels && (
          <>
            <SectionTitle title="Sales by Channel" />
            <Card>
              <View style={{ marginTop: 4 }}>
                <Text style={[styles.payRow, { color: theme.colors.teal }]}>Instore — {fmtKwd(channels.instoreKwd)}</Text>
                <Text style={[styles.payRow, { color: theme.colors.blue }]}>Call center — {fmtKwd(channels.callcenterKwd)}</Text>
                <Text style={[styles.payRow, { color: theme.colors.amber }]}>Aggregator — {fmtKwd(channels.aggregatorKwd)}</Text>
              </View>
            </Card>
          </>
        )}

        {/* Payments */}
        <SectionTitle title="Sales by Payment Type" />
        <Card>
          {payments.map(p => (
            <View key={p.key} style={styles.payRow2}>
              <Text style={{ color: theme.colors.text0, flex: 1 }}>{p.label}</Text>
              <Text style={{ color: theme.colors.text0, fontFamily: theme.fonts.numeric, fontWeight: '700' }}>{fmtKwd(p.kwd)}</Text>
              <Text style={{ color: theme.colors.text2, marginLeft: 8 }}>{fmtPct(p.pct)}</Text>
            </View>
          ))}
        </Card>

        {/* Top 10 Pharmacies */}
        <SectionTitle title="Top 10 Pharmacies" />
        {topPharm.map((p, i) => (
          <Row
            key={p.id}
            avatar={{ initials: String(i + 1).padStart(2, '0'), color: rankColor(i + 1) }}
            title={p.name}
            subtitle={`${fmtKwd(p.amtKwd)} · weekly revenue`}
            amount={fmtKwd(p.amtKwd)}
            delta={{ label: '▲ ' + Math.round(8 + i * 0.5) + '%', tone: 'green' }}
          />
        ))}

        {/* Discount leaderboard */}
        <SectionTitle title="Highest Discount by Pharmacy" rightLabel="Top 10" />
        <Card>
          {discounts.map(d => (
            <View key={d.id} style={styles.discRow}>
              <Text style={{ color: theme.colors.text0, flex: 1 }}>{d.name}</Text>
              <Text style={{ color: theme.colors.amber, fontFamily: theme.fonts.numeric, fontWeight: '700' }}>
                −{fmtKwd(d.discountKwd / 1000)} ({fmtPct(d.ratePct)})
              </Text>
            </View>
          ))}
        </Card>

        {/* Top 10 Categories */}
        <SectionTitle title="Top 10 Categories" />
        <Card>
          {categories.map(c => (
            <View key={c.key} style={styles.payRow2}>
              <Text style={{ color: theme.colors.text0, flex: 1 }}>{c.label}</Text>
              <Text style={{ color: theme.colors.text0, fontFamily: theme.fonts.numeric, fontWeight: '700' }}>{fmtKwd(c.kwd)}</Text>
              <Chip label={fmtPct(c.pct, 0)} tone="teal" />
            </View>
          ))}
        </Card>
      </ScrollView>

      <PickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        title="Select Pharmacy"
        subtitle="All KPIs and widgets recompute for the selected scope"
        selectedKey={pharmacyId}
        onSelect={key => { setPharmacyId(key); setPickerVisible(false); }}
        options={pharmacies.map(p => ({
          key: p.id,
          title: p.name,
          subtitle: p.id === 'all' ? '29 active branches · default scope' : `${fmtKwd(p.amtKwd)} · weekly revenue`,
          tag: p.id === 'all' ? 'All' : 'Branch',
        }))}
      />
    </SafeAreaView>
  );
}

const RANK_PALETTE = [
  theme.colors.gold, theme.colors.teal, theme.colors.blue, theme.colors.purple,
  theme.colors.pink, theme.colors.amber, theme.colors.gold, theme.colors.teal,
  theme.colors.blue, theme.colors.purple,
];
function rankColor(rank: number): string { return RANK_PALETTE[(rank - 1) % RANK_PALETTE.length]!; }

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.colors.bg0 },
  center: { flex: 1, backgroundColor: theme.colors.bg0, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 14, paddingBottom: 80 },
  h2: { fontSize: 22, fontWeight: '700', color: theme.colors.text0 },
  subhead: { fontSize: 12, color: theme.colors.text2, marginTop: 2, marginBottom: 14 },
  filterBar: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(48,224,196,0.10)',
    borderWidth: 1, borderColor: 'rgba(48,224,196,0.22)',
    marginBottom: 14,
  },
  filterIcon: { fontSize: 18, marginRight: 12 },
  filterLabel:{ fontSize: 10, color: theme.colors.text2, letterSpacing: 0.8, fontWeight: '600' },
  filterValue:{ fontSize: 14, fontWeight: '700', color: theme.colors.text0, marginTop: 1 },
  eyebrow: {
    fontSize: 11, color: theme.colors.text2,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  hero: {
    fontFamily: theme.fonts.numeric,
    fontSize: 26, fontWeight: '700', color: theme.colors.text0, marginTop: 4, letterSpacing: -0.5,
  },
  subtle:    { fontSize: 11, color: theme.colors.text2, marginTop: 4 },
  kpiGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  kpiGridInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  payRow:    { fontSize: 12, fontWeight: '600', marginVertical: 4 },
  payRow2:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  discRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
});
