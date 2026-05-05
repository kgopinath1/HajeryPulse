/**
 * F&B dashboard.
 * Filter: brand or outlet picker (two-tab modal).
 * Widgets: revenue, KPI grid (with YoY growth), brand summary,
 * brand-outlet drill-down, channels, aggregators, payments,
 * delivery-by-brand, top 10 outlets.
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
import { AsOnDateBar } from '@components/AsOnDateBar';
import { PickerModal } from '@components/PickerModal';
import { Row } from '@components/Row';

import { fbApi } from '@api/fb';
import { defaultAsOfDate } from '@utils/date';
import { fmtKwd, fmtPct, fmtInt, fmtYoy } from '@utils/format';
import {
  FBBrand, FBOutlet, FBSummary, FbScopeType,
  FBAggregatorRow, FBPaymentRow,
} from '@types/domain';

export function FBScreen(): React.JSX.Element {
  const [asOfDate]      = useState(defaultAsOfDate());
  const [pickerTab, setPickerTab] = useState<'brands' | 'outlets'>('brands');
  const [pickerVisible, setPickerVisible] = useState(false);

  const [brands,  setBrands]   = useState<FBBrand[]>([]);
  const [outlets, setOutlets]  = useState<FBOutlet[]>([]);
  const [scopeType, setScopeType] = useState<FbScopeType>('all');
  const [scopeId,   setScopeId]   = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());

  const [summary,    setSummary]    = useState<FBSummary | null>(null);
  const [brandSummary, setBrandSummary] = useState<FBBrand[]>([]);
  const [aggrs,      setAggrs]      = useState<FBAggregatorRow[]>([]);
  const [payments,   setPayments]   = useState<FBPaymentRow[]>([]);
  const [delivery,   setDelivery]   = useState<FBBrand[]>([]);
  const [topOutlets, setTopOutlets] = useState<FBOutlet[]>([]);

  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Bootstrap
  useEffect(() => {
    Promise.all([fbApi.brands(), fbApi.outlets()]).then(([b, o]) => {
      setBrands(b); setOutlets(o);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, bs, ag, pay, del, top] = await Promise.all([
        fbApi.summary(asOfDate, scopeType, scopeId),
        fbApi.brandSummary(asOfDate, scopeType, scopeId),
        fbApi.aggregators(asOfDate, scopeType, scopeId),
        fbApi.payments(asOfDate, scopeType, scopeId),
        fbApi.deliveryByBrand(asOfDate, scopeType, scopeId),
        fbApi.topOutlets(asOfDate, scopeType, scopeId, 10),
      ]);
      setSummary(s); setBrandSummary(bs); setAggrs(ag);
      setPayments(pay); setDelivery(del); setTopOutlets(top);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [asOfDate, scopeType, scopeId]);

  useEffect(() => { load(); }, [load]);

  const toggleBrand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading && !summary) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={theme.colors.gold} /></SafeAreaView>;
  }

  const filterLabel = summary?.scope.name ?? 'All Brands & Outlets';
  const filterTag   = summary?.scope.type === 'all'    ? `${brands.length} brands · ${outlets.length} outlets`
                    : summary?.scope.type === 'brand'  ? `${brands.find(b => b.id === scopeId)?.outletCount ?? ''} outlets`
                    : '1 outlet';

  const pickerOptions =
    pickerTab === 'brands'
      ? [
          { key: 'all|null', title: 'All Brands & Outlets', subtitle: '12 brands · 43 outlets', tag: 'All' },
          ...brands.map(b => ({
            key: `brand|${b.id}`, title: b.name,
            subtitle: `${b.outletCount} outlet${b.outletCount > 1 ? 's' : ''} · ${fmtKwd(b.amtKwd)}`,
            tag: 'Brand',
          })),
        ]
      : outlets.map(o => {
          const brand = brands.find(b => b.id === o.brandId);
          return {
            key: `outlet|${o.code}`,
            title: `${o.code}  ${o.name}`,
            subtitle: `${brand?.name ?? ''} · ${fmtKwd(o.amtKwd)}`,
            tag: 'Outlet',
          };
        });

  const selectedKey = scopeId ? `${scopeType}|${scopeId}` : 'all|null';

  const onSelect = (key: string) => {
    const [type, id] = key.split('|') as [FbScopeType, string];
    setScopeType(type === 'outlet' ? 'outlet' : type === 'brand' ? 'brand' : 'all');
    setScopeId(id === 'null' ? null : id);
    setPickerVisible(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.gold} />}
      >
        <Text style={styles.h2}>F&amp;B</Text>
        <Text style={styles.subhead}>Dine-in · Delivery · Takeaway</Text>

        {/* Brand/Outlet filter */}
        <TouchableOpacity style={styles.filterBar} onPress={() => setPickerVisible(true)}>
          <Text style={styles.filterIcon}>🍽️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>BRAND / OUTLET FILTER</Text>
            <Text style={styles.filterValue}>{filterLabel}</Text>
          </View>
          <Chip label={filterTag} tone="pink" />
        </TouchableOpacity>

        <AsOnDateBar asOfDate={asOfDate} />

        <SegTabs value="week" onChange={() => {}} options={[
          { key: 'day', label: 'Day' }, { key: 'week', label: 'Week' },
          { key: 'month', label: 'Month' }, { key: 'ytd', label: 'YTD' },
        ]} />

        {/* Revenue */}
        {summary && (
          <Card>
            <Text style={styles.eyebrow}>REVENUE · WEEK TO DATE</Text>
            <Text style={styles.hero}>{fmtKwd(summary.revenueKwd)}</Text>
            <View style={{ marginTop: 4 }}>
              <Chip label="▲ 11.4% WoW" tone="pink" />
            </View>
            <View style={{ marginTop: 12 }}>
              <Sparkline values={[95, 80, 110, 70, 90, 55, 72, 35]} color={theme.colors.pink} height={120} />
            </View>
          </Card>
        )}

        {/* KPIs */}
        {summary && (
          <View style={styles.kpiGrid}>
            <KpiTile label="Covers" value={fmtInt(summary.covers)} delta={{ value: '8.3%', positive: true }} />
            <KpiTile label="Avg. ticket" value={fmtKwd(summary.ticketKwd)} delta={{ value: '2.9%', positive: true }} />
            <KpiTile label="Active outlets" value={`${summary.outletsActive} / ${summary.outletsTotal}`} chip={{ label: 'all live', tone: 'green' }} />
            <KpiTile label="YoY growth" value={fmtYoy(summary.yoyPct)} delta={{ value: 'vs last year', positive: summary.yoyPct >= 0 }} />
          </View>
        )}

        {/* Brand-wise summary */}
        <SectionTitle title="Brand-wise Sales Summary" rightLabel={`${brandSummary.length} brand${brandSummary.length > 1 ? 's' : ''}`} />
        <Card>
          {brandSummary.map(b => {
            const total = brandSummary.reduce((s, x) => s + x.amtKwd, 0);
            const share = total > 0 ? (b.amtKwd / total) * 100 : 0;
            return (
              <View key={b.id} style={styles.brandRow}>
                <View style={[styles.brandSwatch, { backgroundColor: b.color }]} />
                <Text style={[styles.brandName, { flex: 1 }]}>{b.name}</Text>
                <Text style={styles.brandValue}>{fmtKwd(b.amtKwd)}</Text>
                <Text style={styles.brandShare}>{fmtPct(share)}</Text>
                <Chip label={fmtYoy(b.yoyPct)} tone={b.yoyPct >= 0 ? 'green' : 'red'} />
              </View>
            );
          })}
        </Card>

        {/* Brand & Outlet drill-down */}
        <SectionTitle title="Brand & Outlet Drill-down" rightLabel={`${brandSummary.length} brands`} />
        <Text style={styles.helperText}>Tap a brand to expand its outlets. Outlet contribution shown as % of brand total.</Text>
        <Card>
          {brandSummary.map(b => {
            const isOpen = expanded.has(b.id);
            const childOutlets = outlets.filter(o => o.brandId === b.id).sort((a, c) => c.amtKwd - a.amtKwd);
            return (
              <View key={b.id}>
                <TouchableOpacity style={styles.bdBrand} onPress={() => toggleBrand(b.id)}>
                  <Text style={[styles.bdChev, isOpen && { color: theme.colors.pink }]}>{isOpen ? '▼' : '▶'}</Text>
                  <View style={[styles.brandSwatch, { backgroundColor: b.color }]} />
                  <Text style={[styles.brandName, { flex: 1 }]}>{b.name}</Text>
                  <Text style={styles.bdMeta}>{b.outletCount} outlet{b.outletCount > 1 ? 's' : ''}</Text>
                  <Text style={styles.brandValue}>{fmtKwd(b.amtKwd)}</Text>
                </TouchableOpacity>
                {isOpen && childOutlets.map(o => {
                  const oShare = b.amtKwd > 0 ? (o.amtKwd / b.amtKwd) * 100 : 0;
                  return (
                    <View key={o.code} style={styles.bdOutlet}>
                      <Text style={styles.outletCode}>{o.code}</Text>
                      <Text style={[styles.outletName, { flex: 1 }]}>{o.name}</Text>
                      <Text style={styles.outletAmt}>{fmtKwd(o.amtKwd)}</Text>
                      <Text style={styles.outletShare}>{fmtPct(oShare)}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </Card>

        {/* Aggregators */}
        <SectionTitle title="Sales by Aggregator" />
        <Card>
          {aggrs.map(a => (
            <View key={a.key} style={styles.payRow}>
              <View style={[styles.swatch, { backgroundColor: a.color }]} />
              <Text style={{ flex: 1, color: theme.colors.text0 }}>{a.label}</Text>
              <Text style={{ fontFamily: theme.fonts.numeric, fontWeight: '700', color: theme.colors.text0 }}>{fmtKwd(a.kwd)}</Text>
              <Text style={{ marginLeft: 8, color: theme.colors.text2 }}>{fmtPct(a.pct)}</Text>
            </View>
          ))}
        </Card>

        {/* Delivery by brand */}
        <SectionTitle title="Delivery Sales by Brand" />
        <Card>
          {delivery.map(b => (
            <View key={b.id} style={styles.payRow}>
              <View style={[styles.swatch, { backgroundColor: b.color }]} />
              <Text style={{ flex: 1, color: theme.colors.text0 }}>{b.name}</Text>
              <Text style={{ fontFamily: theme.fonts.numeric, fontWeight: '700', color: theme.colors.text0 }}>{fmtKwd(b.deliveryKwd)}</Text>
            </View>
          ))}
        </Card>

        {/* Payments */}
        <SectionTitle title="Sales by Payment Type" />
        <Card>
          {payments.map(p => (
            <View key={p.key} style={styles.payRow}>
              <View style={[styles.swatch, { backgroundColor: p.color }]} />
              <Text style={{ flex: 1, color: theme.colors.text0 }}>{p.label}</Text>
              <Text style={{ fontFamily: theme.fonts.numeric, fontWeight: '700', color: theme.colors.text0 }}>{fmtKwd(p.kwd)}</Text>
              <Text style={{ marginLeft: 8, color: theme.colors.text2 }}>{fmtPct(p.pct)}</Text>
            </View>
          ))}
        </Card>

        {/* Top outlets */}
        <SectionTitle title="Top 10 Outlets" />
        {topOutlets.map(o => {
          const brand = brands.find(b => b.id === o.brandId);
          return (
            <Row
              key={o.code}
              avatar={{ initials: o.code.slice(0, 2), color: brand?.color ?? theme.colors.gold }}
              title={`${o.code}  ${o.name}`}
              subtitle={brand?.name}
              amount={fmtKwd(o.amtKwd)}
              delta={{ label: fmtYoy(o.yoyPct), tone: o.yoyPct >= 0 ? 'green' : 'red' }}
            />
          );
        })}
      </ScrollView>

      {/* Picker */}
      <PickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        title="Select Brand or Outlet"
        subtitle="All KPIs and widgets recompute for the selected scope"
        selectedKey={selectedKey}
        onSelect={onSelect}
        options={pickerOptions}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.colors.bg0 },
  center: { flex: 1, backgroundColor: theme.colors.bg0, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 14, paddingBottom: 80 },
  h2: { fontSize: 22, fontWeight: '700', color: theme.colors.text0 },
  subhead: { fontSize: 12, color: theme.colors.text2, marginTop: 2, marginBottom: 14 },
  filterBar: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(255,124,174,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,124,174,0.22)',
    marginBottom: 14,
  },
  filterIcon: { fontSize: 18, marginRight: 12 },
  filterLabel:{ fontSize: 10, color: theme.colors.text2, letterSpacing: 0.8, fontWeight: '600' },
  filterValue:{ fontSize: 14, fontWeight: '700', color: theme.colors.text0, marginTop: 1 },
  eyebrow: { fontSize: 11, color: theme.colors.text2, textTransform: 'uppercase', letterSpacing: 0.6 },
  hero: { fontFamily: theme.fonts.numeric, fontSize: 26, fontWeight: '700', color: theme.colors.text0, marginTop: 4 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  brandSwatch: { width: 9, height: 9, borderRadius: 3 },
  brandName:   { fontSize: 13, fontWeight: '600', color: theme.colors.text0 },
  brandValue:  { fontFamily: theme.fonts.numeric, fontSize: 13, fontWeight: '700', color: theme.colors.text0 },
  brandShare:  { fontSize: 11, color: theme.colors.text2, minWidth: 38, textAlign: 'right' },
  bdBrand:     {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  bdChev:      { width: 16, color: theme.colors.text3, fontSize: 14 },
  bdMeta:      { fontSize: 10, color: theme.colors.text2 },
  bdOutlet:    {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, paddingLeft: 28,
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  outletCode:  {
    fontFamily: theme.fonts.numeric, fontSize: 9, fontWeight: '700',
    color: theme.colors.gold, paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: 'rgba(212,175,106,0.10)', borderRadius: 6,
  },
  outletName:  { fontSize: 11, color: theme.colors.text1 },
  outletAmt:   { fontFamily: theme.fonts.numeric, fontSize: 11, fontWeight: '700', color: theme.colors.text0 },
  outletShare: { fontSize: 10, color: theme.colors.text3, minWidth: 36, textAlign: 'right' },
  helperText:  { fontSize: 11, color: theme.colors.text3, marginBottom: 8, paddingHorizontal: 2 },
  swatch:      { width: 10, height: 10, borderRadius: 3, marginRight: 10 },
  payRow:      {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
});
