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
import { StackedBar } from '@components/StackedBar';
import { AsOnDateBar } from '@components/AsOnDateBar';
import { PickerModal } from '@components/PickerModal';
import { Row } from '@components/Row';
import { AsOnDateModal } from '@components/AsOnDateModal';
``
import { fbApi } from '@api/fb';
import DateTimePicker from '@react-native-community/datetimepicker';
import { defaultAsOfDate } from '@utils/date';
import { fmtKwd, fmtPct, fmtInt, fmtYoy ,fmtYoyPp, fmtKwdSmallVal} from '@utils/format';
import {
  FBBrand, FBOutlet, FBSummary, FbScopeType,
  FBAggregatorRow, FBPaymentRow, FBChannelMix,
} from '@types/domain';

export function FBScreen(): React.JSX.Element {

 const [asOfDate, setAsOfDate] = useState(defaultAsOfDate());
/*  const [showPicker, setShowPicker] = useState(false); */
  const [pickerTab, setPickerTab] = useState<'brands' | 'outlets'>('brands');
  const [pickerVisible, setPickerVisible] = useState(false);
const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'ytd'>('week');
  const [brands,  setBrands]   = useState<FBBrand[]>([]);
  const [outlets, setOutlets]  = useState<FBOutlet[]>([]);
  const [scopeType, setScopeType] = useState<FbScopeType>('all');
  const [scopeId,   setScopeId]   = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());

  const [summary,    setSummary]    = useState<FBSummary | null>(null);
  const [brandSummary, setBrandSummary] = useState<FBBrand[]>([]);
  const [aggrs,      setAggrs]      = useState<FBAggregatorRow[]>([]);
  const [channels,   setChannels]   = useState<FBChannelMix | null>(null);
  const [payments,   setPayments]   = useState<FBPaymentRow[]>([]);
  const [delivery,   setDelivery]   = useState<FBBrand[]>([]);
  const [topOutlets, setTopOutlets] = useState<FBOutlet[]>([]);
  const [trend, setTrend] = useState<number[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
const [dateModalVisible, setDateModalVisible] = useState(false);

  // Bootstrap
 useEffect(() => {
  Promise.all([
    fbApi.brands(),
    fbApi.outlets(asOfDate, scopeType, scopeId, period)
  ]).then(([b, o]) => {
    setBrands(b);
    setOutlets(o);
    console.log("brands:", b);
    console.log("outlets:", o);
  });
}, [asOfDate, scopeType, scopeId, period]);


  const load = useCallback(async () => {

    setLoading(true);
    try {
      const [s, bs, ag, pay, del, top,tr] = await Promise.all([
        fbApi.summary(asOfDate, scopeType, scopeId,period),
        fbApi.brandSummary(asOfDate, scopeType, scopeId,period),
        fbApi.aggregators(asOfDate, scopeType, scopeId),
        fbApi.payments(asOfDate, scopeType, scopeId),
        fbApi.deliveryByBrand(asOfDate, scopeType, scopeId),
        fbApi.topOutlets(asOfDate, scopeType, scopeId,period, 10),
        fbApi.trend(asOfDate, scopeType, scopeId, period)
      ]);
      const ch = await fbApi.channels(asOfDate, scopeType, scopeId).catch(() => null);
      setSummary(s); setBrandSummary(bs); setAggrs(ag);
      setChannels(ch);
      setPayments(pay); setDelivery(del); setTopOutlets(top);
      setTrend((tr ?? []).map((x: any) => x.value ?? 0));
      console.log("TREND API RESPONSE:", tr);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [asOfDate, scopeType, scopeId,period]);

  useEffect(() => { load(); }, [load]);
 const offlineOutlets = Math.max(
  (summary?.outletsTotal ?? 0) - (summary?.outletsActive ?? 0),
  0
);
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


const filterLabel =
  scopeType === 'brand'
    ? brands.find(b => b.id === scopeId)?.name ?? 'Unknown Brand'
    : scopeType === 'outlet'
    ? outlets.find(o => o.code === scopeId)?.name ?? 'Unknown Outlet'
    : 'All Brands & Outlets';

const filterTag =
  scopeType === 'brand'
    ? `${brands.find(b => b.id === scopeId)?.outletCount ?? 0} outlets`
    : scopeType === 'outlet'
    ? '1 outlet'
    : `${brands.length} brands · ${outlets.length} outlets`;

  const pickerOptions =
    pickerTab === 'brands'
      ? [
          {
            key: 'all|null',
            title: 'All Brands & Outlets',
            subtitle: `${brands.length} brands · ${outlets.length} outlets`,
            tag: 'All',
          },
          ...brands.map(b => ({
            key: `brand|${b.id}`,
            title: b.name,
            subtitle: `${b.outletCount} outlet${b.outletCount > 1 ? 's' : ''} · ${fmtKwd(b.amtKwd)}`,
            tag: 'Brand',
          })),
        ]
      : [
          {
            key: 'all|null',
            title: 'All Brands & Outlets',
            subtitle: `${brands.length} brands · ${outlets.length} outlets`,
            tag: 'All',
          },
          ...outlets.map(o => {
            const brand = brands.find(b => b.id === o.brandId);

            return {
              key: `outlet|${o.code}`,
              title: `${o.code}  ${o.name}`,
              subtitle: `${brand?.name ?? ''} · ${fmtKwd(o.amtKwd)}`,
              tag: 'Outlet',
            };
          }),
        ];
console.log('pickerOptions:', pickerOptions?.length ?? 0);
  const selectedKey = scopeId ? `${scopeType}|${scopeId}` : 'all|null';

  const onSelect = (key: string) => {
    const [type, id] = key.split('|') as [FbScopeType, string];
   
    setScopeType(type === 'outlet' ? 'outlet' : type === 'brand' ? 'brand' : 'all');
    setScopeId(id === 'null' ? null : id);
   // setPickerVisible(false);
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


  {/* Date Picker */}
<AsOnDateBar
  asOfDate={asOfDate}
  onPress={() => setDateModalVisible(true)}
/>


{/* Period Filter */}
<SegTabs
  value={period}
  onChange={(val) => setPeriod(val)}
  options={[
    { key: 'day', label: 'Day' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'ytd', label: 'YTD' },
  ]}
/>


        {/* Revenue */}
        {summary && (
          <Card>
            <Text style={styles.eyebrow}>
              REVENUE · {period.toUpperCase()} TO DATE
            </Text>

            <Text style={styles.hero}>{fmtKwd(summary.revenueKwd)}</Text>
            <View style={{ marginTop: 4 }}>

             <Chip label={fmtYoy(summary.growthPct, summary.growthType)}
             tone={summary.growthPct >= 0 ? 'green' : 'red'}/>
            </View>

{period !== 'day' && (
  <View style={{ marginTop: 12 }}>
    <Sparkline
      values={trend.length ? trend : [0]}
      color={theme.colors.pink}
      height={120}
/>
<Text style={{ color: theme.colors.text2 }}>
      {period === 'week' && 'Last 7 days'}
      {period === 'month' && 'Weekly trend'}
      {period === 'ytd' && 'Monthly trend'}
    </Text>
  </View>
)}
 </Card>
        )}

        {/* KPIs */}
        {summary && (
          
          <View style={styles.kpiGrid}>
            <KpiTile label="Covers" value={fmtInt(summary.covers)} delta={{ value: `${summary.coversdelta?.toFixed(1) || 0}%`, positive: summary.coversdelta >= 0 }} />
            <KpiTile label="Avg. ticket" value={fmtKwd(summary.ticketKwd)} delta={{ value: `${summary.ticketKwdDelta?.toFixed(1) || 0}%`, positive: summary.ticketKwdDelta >= 0 }} />
            {/* <KpiTile label="Active outlets" value={`${summary.outletsActive} / ${summary.outletsTotal}`} chip={{ label: 'all live', tone: 'green' }} /> */}
            <KpiTile
  label="Active outlets"
  value={`${summary?.outletsActive ?? 0} / ${summary?.outletsTotal ?? 0}`}
  chip={{
    label:
      offlineOutlets > 0
        ? `${offlineOutlets} offline`
        : 'all live',
    tone: offlineOutlets > 0 ? 'amber' : 'green'
  }}
/>

            <KpiTile label="YoY growth" value={
<Text style={{ color: summary.yoyPct >= 0 ? theme.colors.green : theme.colors.red }}>
      {fmtYoy(summary.yoyPct)}
    </Text>
} delta={{ value: 'vs last year', positive: summary.yoyPct >= 0 }} />
          </View>
        )}

        {/* Brand-wise summary */}
        <SectionTitle
          title="Brand-wise Sales Summary"
          rightLabel={
            <View style={styles.brandCountBadge}>
              <Text style={styles.brandCountText}>{`${brandSummary.length} BRAND${brandSummary.length > 1 ? 'S' : ''}`}</Text>
            </View>
          }
        />
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
                <Chip label={fmtYoy(b.growthPct)} tone={b.growthPct >= 0 ? 'green' : 'red'} />
              </View>
            );
          })}
        </Card>

        {/* Brand & Outlet drill-down */}
        <SectionTitle
          title="Brand & Outlet Drill-down"
          rightLabel={
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{brandSummary.length} BRANDS</Text>
              <Text style={styles.sectionBadgeDot}>·</Text>
              <Text style={styles.sectionBadgeText}>{outlets.length} OUTLETS</Text>
            </View>
          }
        />
        <Text style={styles.helperText}>Tap a brand to expand its outlets. Outlet contribution shown as % of brand total.</Text>
        <Card>
          {brandSummary.map(b => {
            console.log('Brands Drilldown:' + b.id)

            const isOpen = expanded.has(b.id);
            const totalSales = brandSummary.reduce((s, x) => s + x.amtKwd, 0);
            const brandContribution = totalSales > 0 ? (b.amtKwd / totalSales) * 100 : 0;
            // const childOutlets = outlets.filter(o => o.brandId === b.id).sort((a, c)  => c.amtKwd - a.amtKwd);
            console.log('BRAND:', b.id);
            console.log('All Outlets Sample:', JSON.stringify(outlets[0], null, 2));
            const childOutlets =
              outlets
                .filter(o => {
                  console.log(
                    'Checking Outlet BrandId:',
                    o.brandId,
                    'against Brand:',
                    b.id
                  );

                  return o.brandId === b.id;
                })
                .sort((a, c) => c.amtKwd - a.amtKwd);

            console.log('Matched Outlets Count:', childOutlets.length);

childOutlets.forEach(o => {
   console.log(
      'Outlet:',
      o.code,
      o.name,
      o.amtKwd
   );
});
            return (
              <View key={b.id}>
                <TouchableOpacity style={styles.bdBrand} onPress={() => toggleBrand(b.id)}>
                  <Text style={[styles.bdChev, isOpen && { color: theme.colors.pink }]}>{isOpen ? '▼' : '▶'}</Text>
                  <View style={[styles.brandSwatch, { backgroundColor: b.color }]} />
                  <Text style={[styles.brandName, { flex: 1 }]}>{b.name}</Text>
                  <Text style={styles.bdMeta}>{b.outletCount} outlet{b.outletCount > 1 ? 's' : ''}</Text>
                  <Text style={styles.brandValue}>{fmtKwd(b.amtKwd)}</Text>
                  <Text style={styles.bdContribution}>{fmtPct(brandContribution)}</Text>
                </TouchableOpacity>
                {isOpen && childOutlets.map(o => {
                 
                  const oShare = b.amtKwd > 0 ? (o.amtKwd / b.amtKwd) * 100 : 0;
                  return (
                    <View key={o.code} style={styles.bdOutlet}>
                      {/* <Text style={styles.outletCode}>{o.code}</Text> */}
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

        {/* Channel Mix */}
        {channels && (
          <>
            <SectionTitle title="Channel Mix" />
            <Card>
              <Text style={styles.eyebrow}>Revenue split by channel</Text>
              <View style={{ marginTop: 12 }}>
                <StackedBar
                  segments={[
                    { pct: channels.dineInPct, color: theme.colors.pink },
                    { pct: channels.deliveryPct, color: theme.colors.blue },
                    { pct: channels.takeawayPct, color: theme.colors.gold },
                  ]}
                />
              </View>
              <View style={styles.channelLegend}>
                <View style={styles.channelLegendItem}>
                  <View style={[styles.channelDot, { backgroundColor: theme.colors.pink }]} />
                  <Text style={styles.channelLabel}>Dine-in</Text>
                  <Text style={styles.channelPct}>{fmtPct(channels.dineInPct)}</Text>
                </View>
                <View style={styles.channelLegendItem}>
                  <View style={[styles.channelDot, { backgroundColor: theme.colors.blue }]} />
                  <Text style={styles.channelLabel}>Delivery</Text>
                  <Text style={styles.channelPct}>{fmtPct(channels.deliveryPct)}</Text>
                </View>
                <View style={styles.channelLegendItem}>
                  <View style={[styles.channelDot, { backgroundColor: theme.colors.gold }]} />
                  <Text style={styles.channelLabel}>Takeaway</Text>
                  <Text style={styles.channelPct}>{fmtPct(channels.takeawayPct)}</Text>
                </View>
              </View>
            </Card>
          </>
        )}

        {/* Aggregators */}
        <SectionTitle title="Sales by Aggregator" />
        <Card>
          {aggrs.map(a => (
            <View key={a.key} style={styles.payRow}>
              <View style={[styles.swatch, { backgroundColor: a.color }]} />
              <Text style={{ flex: 1, color: theme.colors.text0 }}>{a.label}</Text>
              <Text style={{ fontFamily: theme.fonts.numeric, fontWeight: '700', color: theme.colors.text0 }}>{fmtKwdSmallVal(a.kwd)}</Text>
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
              <Text style={{ fontFamily: theme.fonts.numeric, fontWeight: '700', color: theme.colors.text0 }}>{fmtKwdSmallVal(b.deliveryKwd)}</Text>
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
              <Text style={{ fontFamily: theme.fonts.numeric, fontWeight: '700', color: theme.colors.text0 }}>{fmtKwdSmallVal(p.kwd)}</Text>
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
              title={` ${o.name}`}
              subtitle={brand?.name}
              amount={fmtKwd(o.amtKwd)}
              delta={{ label: fmtYoy(o.yoyPct), tone: o.yoyPct >= 0 ? 'green' : 'red' }}
            />
          );
        })}
      </ScrollView>

<AsOnDateModal
  visible={dateModalVisible}
  onClose={() => setDateModalVisible(false)}
  currentDate={asOfDate}
  onSelect={(date) => setAsOfDate(date)}
/>

      {/* Picker */}
      <PickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        title="Select Brand or Outlet"
        subtitle="All KPIs and widgets recompute for the selected scope"
         tab={pickerTab}
         onTabChange={setPickerTab}
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
  channelLegend: { marginTop: 14, gap: 10, flexDirection: 'row', justifyContent: 'space-around' },
  channelLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  channelDot: { width: 8, height: 8, borderRadius: 4 },
  channelLabel: { fontSize: 12, color: theme.colors.text0 },
  channelPct: { fontFamily: theme.fonts.numeric, fontSize: 12, fontWeight: '700', color: theme.colors.text0, marginLeft: 4 },
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
  bdContribution: { fontSize: 12, fontWeight: '700', color: theme.colors.gold, minWidth: 40, textAlign: 'right' },
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
  brandCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(212,175,106,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,106,0.25)',
  },
  brandCountText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.gold,
    letterSpacing: 0.4,
  },
  highlight:   { color: theme.colors.gold, fontWeight: '700' },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(212,175,106,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,106,0.20)',
  },
  sectionBadgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.gold,
  },
  sectionBadgeDot: {
    marginHorizontal: 6,
    color: theme.colors.gold,
    fontSize: theme.fontSize.xs,
  },
  swatch:      { width: 10, height: 10, borderRadius: 3, marginRight: 10 },
  payRow:      {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
});