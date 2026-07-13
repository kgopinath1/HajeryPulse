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
import { StackedBar } from '@components/StackedBar';
import { AsOnDateBar } from '@components/AsOnDateBar';
import { PickerModal } from '@components/PickerModal';
import { Row } from '@components/Row';
import { AsOnDateModal } from '@components/AsOnDateModal';
import { MultiSparkline } from '@components/MultiSparkline';
import { NoDataCard } from '@components/NoDataCard';
import { fbApi } from '@api/fb';
import { defaultAsOfDate } from '@utils/date';
import { fmtKwd, fmtPct, fmtInt, fmtYoy, fmtKwdSmallVal,fmtKwdAsIs } from '@utils/format';
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
  const [brands, setBrands] = useState<FBBrand[]>([]);
  const [outlets, setOutlets] = useState<FBOutlet[]>([]);
  const [scopeType, setScopeType] = useState<FbScopeType>('all');
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [summary, setSummary] = useState<FBSummary | null>(null);
  const [brandSummary, setBrandSummary] = useState<FBBrand[]>([]);
  const [aggrs, setAggrs] = useState<FBAggregatorRow[]>([]);
  const [channels, setChannels] = useState<FBChannelMix[]>([]);
  const [payments, setPayments] = useState<FBPaymentRow[]>([]);
  const [delivery, setDelivery] = useState<FBBrand[]>([]);
  const [topOutlets, setTopOutlets] = useState<FBOutlet[]>([]);
  const [trend, setTrend] = useState<{
    current: number[];
    previous: number[];
  }>({
    current: [],
    previous: [],
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateModalVisible, setDateModalVisible] = useState(false);

  // Bootstrap
  useEffect(() => {
     console.log("Calling outlets with:", { asOfDate, scopeType, scopeId, period });
    Promise.all([
      fbApi.brands(asOfDate,  period),
      fbApi.outlets(asOfDate, scopeType, scopeId, period)
    ]).then(([b, o]) => {
      setBrands(b);
      setOutlets(o);
    console.log("brands:", b);
     console.log("outlets:", o);
    }).catch((err) => console.error("Load failed:", err));
  }, [asOfDate, scopeType, scopeId, period]);


  const load = useCallback(async () => {

    setLoading(true);
    try {
      const [s, bs, ag, pay, del, top, tr] = await Promise.all([
        fbApi.summary(asOfDate, scopeType, scopeId, period),
        fbApi.brandSummary(asOfDate, scopeType, scopeId, period),
        fbApi.aggregators(asOfDate, scopeType, scopeId, period),
        fbApi.payments(asOfDate, scopeType, scopeId, period),
        fbApi.deliveryByBrand(asOfDate, scopeType, scopeId, period),
        fbApi.topOutlets(asOfDate, scopeType, scopeId, period, 10),
        fbApi.trend(asOfDate, scopeType, scopeId, period)
      ]);
      const ch: FBChannelMix[]= await fbApi
  .channels(asOfDate, scopeType, scopeId, period)
  .catch(() => []);
      setSummary(s); setBrandSummary(bs); setAggrs(ag);
      setChannels(ch);
      setPayments(pay); setDelivery(del); setTopOutlets(top);
      setTrend({
        current: tr.current ?? [],
        previous: tr.previous ?? [],
      });
      console.log("TREND API RESPONSE:", tr);
      console.log("API RESPONSE:", bs, ch);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [asOfDate, scopeType, scopeId, period]);

  useEffect(() => { load(); }, [load]);
  // const offlineOutlets = Math.max(
  //   (summary?.outletsTotal ?? 0) - (summary?.outletsActive ?? 0),
  //   0
  // );
  const toggleBrand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const hasData =
    (summary?.revenueKwd ?? 0) > 0 ||
    (summary?.covers ?? 0) > 0 ||

    brandSummary.some(x => (x.amtKwd ?? 0) > 0) ||

    aggrs.some(x => (x.kwd ?? 0) > 0) ||

    payments.some(x => (x.kwd ?? 0) > 0) ||

    delivery.some(x => (x.deliveryKwd ?? 0) > 0) ||

    topOutlets.some(x => (x.amtKwd ?? 0) > 0) ||

    channels.some(c => c.kwd > 0);


  const showNoData = !loading && !hasData;
  const getChannelColor = (code: string) => {
  switch (code.toLowerCase()) {
    case 'dinein':
      return theme.colors.pink;

    case 'delivery':
      return theme.colors.blue;

    case 'takeaway':
      return theme.colors.gold;

    default:
      return theme.colors.teal;
  }
};


  if (loading && !summary) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={theme.colors.gold} /></SafeAreaView>;
  }

  console.log('hasData', hasData);
  console.log('showNoData', showNoData);

  console.log('summary', summary);
  console.log('brandSummary', brandSummary.length);
  console.log('aggrs', aggrs.length);
  console.log('payments', payments.length);
  console.log('delivery', delivery.length);
  console.log('topOutlets', topOutlets.length);
  console.log('channels', channels);

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

  // const filterActive = scopeType !== 'all' || scopeId !== null || period !== 'week';

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
            title: o.name,
            subtitle: `${brand?.name ?? ''} · ${fmtKwd(o.amtKwd)}`,
            tag: 'Outlet',
          };
        }),
      ];
  //console.log('pickerOptions:', pickerOptions?.length ?? 0);
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

        {showNoData ? (
          <NoDataCard />
        ) : (
          <>


            {/* Revenue */}

            {summary && (summary.revenueKwd ?? 0) > 0 ? (
              <Card>
                <Text style={styles.eyebrow}>
                  REVENUE · {period.toUpperCase()} TO DATE
                </Text>

                <Text style={styles.hero}>{fmtKwd(summary.revenueKwd)}</Text>
                <View style={{ marginTop: 4 }}>

                  <Chip label={fmtYoy(summary.growthPct, summary.growthType)}
                    tone={summary.growthPct >= 0 ? 'green' : 'red'} />
                </View>

                {period !== 'day' && (
                  <View style={{ marginTop: 12 }}>
                    <MultiSparkline
                      primary={trend.current ?? []}
                      secondary={trend.previous ?? []}
                      primaryColor={theme.colors.pink}
                      secondaryColor={theme.colors.blue}
                      labels={
                        period === 'week'
                          ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                          : period === 'month'
                            ? ['W1', 'W2', 'W3', 'W4', 'W5']
                            : [
                              'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                            ]
                      }
                      height={120}
                    />
                    <View style={styles.marginLegend}>
                      <View style={styles.legendItem}>
                        <View
                          style={[
                            styles.legendDot,
                            { backgroundColor: theme.colors.pink },
                          ]}
                        />
                        <Text style={styles.legendText}>Current Period</Text>
                      </View>

                      <View style={styles.legendItem}>
                        <View
                          style={[
                            styles.legendDot,
                            { backgroundColor: theme.colors.blue },
                          ]}
                        />
                        <Text style={styles.legendText}>Previous Period</Text>
                      </View>
                    </View>
                    <Text style={{ color: theme.colors.text2 }}>
                      {period === 'week' && 'Last 7 days'}
                      {period === 'month' && 'Weekly trend'}
                      {period === 'ytd' && 'Monthly trend'}
                    </Text>
                  </View>
                )}
              </Card>
            ) : (
              <Card>
                <Text style={styles.emptyText}>No revenue data available</Text>
              </Card>
            )}

            {/* KPIs */}

            {summary && (summary.covers ?? 0) > 0 ? (
              <View style={styles.kpiGrid}>
                <KpiTile label="Transactions" value={fmtInt(summary.covers)} delta={{ value: `${summary.coversdelta?.toFixed(1) || 0}%`, positive: summary.coversdelta >= 0 }} />
                <KpiTile label="Check Avg" value={fmtKwd(summary.ticketKwd)} delta={{ value: `${summary.ticketKwdDelta?.toFixed(1) || 0}%`, positive: summary.ticketKwdDelta >= 0 }} />

                <KpiTile
                  label="Active stores"
                  value={
                    <Text style={{ fontSize: 35 }}>
                      {summary.outletsActive}
                    </Text>
                  }
                />

                <KpiTile label="YoY growth" value={
                  <Text style={{ color: summary.yoyPct >= 0 ? theme.colors.green : theme.colors.red }}>
                    {fmtYoy(summary.yoyPct)}
                  </Text>
                } delta={{ value: 'vs last year', positive: summary.yoyPct >= 0 }} />
              </View>
            ) : (
              <Card>
                <Text style={styles.emptyText}>No KPI data available</Text>
              </Card>
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
              {brandSummary.length > 0 && brandSummary.some(x => (x.amtKwd ?? 0) > 0) ? (
                brandSummary.map(b => {
                  const total = brandSummary.reduce((s, x) => s + x.amtKwd, 0);
                  const share = total > 0 ? (b.amtKwd / total) * 100 : 0;

                  return (
                    <View key={b.id} style={styles.brandRow}>
                      <View style={[styles.brandSwatch, { backgroundColor: b.color }]} />
                      <Text style={[styles.brandName, { flex: 1 }]}>{b.name}</Text>
                      <Text style={styles.brandValue}>{fmtKwd(b.amtKwd)}</Text>
                      <Text style={styles.brandShare}>{fmtPct(share)}</Text>
                      <Chip
                        label={fmtYoy(b.growthPct)}
                        tone={b.growthPct >= 0 ? 'green' : 'red'}
                      />
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No brand sales data available</Text>
              )}
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
              {brandSummary.length > 0 && brandSummary.some(x => (x.amtKwd ?? 0) > 0) ? (
                brandSummary.map(b => {
                  const isOpen = expanded.has(b.id);
                  const totalSales = brandSummary.reduce((s, x) => s + x.amtKwd, 0);
                  const brandContribution =
                    totalSales > 0 ? (b.amtKwd / totalSales) * 100 : 0;

                  const childOutlets = outlets
                    .filter(o => o.brandId === b.id)
                    .sort((a, c) => c.amtKwd - a.amtKwd);

                  return (
                    <View key={b.id}>
                      <TouchableOpacity
                        style={styles.bdBrand}
                        onPress={() => toggleBrand(b.id)}
                      >
                        <Text
                          style={[
                            styles.bdChev,
                            isOpen && { color: theme.colors.pink },
                          ]}
                        >
                          {isOpen ? '▼' : '▶'}
                        </Text>

                        <View
                          style={[
                            styles.brandSwatch,
                            { backgroundColor: b.color },
                          ]}
                        />

                        <Text style={[styles.brandName, { flex: 1 }]}>
                          {b.name}
                        </Text>

                        <Text style={styles.bdMeta}>
                          {b.outletCount} outlet{b.outletCount > 1 ? 's' : ''}
                        </Text>

                        <Text style={styles.brandValue}>
                          {fmtKwd(b.amtKwd)}
                        </Text>

                        <Text style={styles.bdContribution}>
                          {fmtPct(brandContribution)}
                        </Text>
                      </TouchableOpacity>

                      {isOpen &&
                        childOutlets.map(o => {
                          const oShare =
                            b.amtKwd > 0 ? (o.amtKwd / b.amtKwd) * 100 : 0;

                          return (
                            <View key={o.code} style={styles.bdOutlet}>
                              <Text style={[styles.outletName, { flex: 1 }]}>
                                {o.name}
                              </Text>

                              <Text style={styles.outletAmt}>
                                {fmtKwd(o.amtKwd)}
                              </Text>

                              <Text style={styles.outletShare}>
                                {fmtPct(oShare)}
                              </Text>
                            </View>
                          );
                        })}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No brand-outlet data available</Text>
              )}
            </Card>


           /*** Channel Mix */
<Text style={styles.globalNote}>
  The below values include service charge and tips.
</Text>

<SectionTitle title="Channel Mix" />

{channels.length > 0 ? (
  <Card>
    <Text style={styles.eyebrow}>
      REVENUE SPLIT BY CHANNEL
    </Text>

    {/* Stacked Bar */}
    <View style={{ marginTop: 12 }}>
      <StackedBar
        segments={channels.map(channel => ({
          pct: Number(channel.pct),
          color: getChannelColor(channel.channelCode),
        }))}
      />
    </View>

   {/* Legend */}
<View
  style={{
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    rowGap: 8,
    columnGap: 12,
  }}
>
  {channels.map(channel => (
    <View
      key={channel.channelCode}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          marginRight: 6,
          backgroundColor: getChannelColor(channel.channelCode),
        }}
      />

      <Text
        style={{
          color: theme.colors.text1,
          fontSize: 12,
        }}
      >
        {channel.channelName}{' '}
        <Text
          style={{
            color: theme.colors.text0,
            fontWeight: '700',
            fontFamily: theme.fonts.numeric,
          }}
        >
          {channel.pct.toFixed(1)}%
        </Text>
      </Text>
    </View>
  ))}
</View>

    <Text
      style={{
        color: theme.colors.text2,
        fontSize: 11,
        marginTop: 14,
        marginBottom: 10,
      }}
    >
      These values below include service charge and tips.
    </Text>

    {/* Channel Values */}
    <View>
      {channels.map(channel => (
        <View
          key={`value-${channel.channelCode}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
          }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              marginRight: 10,
              backgroundColor: getChannelColor(
                channel.channelCode
              ),
            }}
          />

          <Text
            style={{
              flex: 1,
              color: theme.colors.text1,
              fontSize: 13,
            }}
          >
            {channel.channelName}
          </Text>

          <Text
            style={{
              minWidth: 90,
              textAlign: 'right',
              color: theme.colors.text0,
              fontWeight: '700',
              fontFamily: theme.fonts.numeric,
            }}
          >
            {fmtKwdAsIs(channel.kwd)}
          </Text>
        </View>
      ))}
    </View>
  </Card>
) : (
  <Card>
    <Text style={styles.emptyText}>
      No channel data available
    </Text>
  </Card>
)}

            {/* Aggregators */}
            <SectionTitle title="Sales by Aggregator" />
            <Card>
              {aggrs.length > 0 && aggrs.some(a => (a.kwd ?? 0) > 0) ? aggrs.map(a => (
                <View key={a.key} style={styles.payRow}>
                  <View style={[styles.swatch, { backgroundColor: a.color }]} />
                  <Text style={{ flex: 1, color: theme.colors.text0 }}>{a.label}</Text>
                  <Text style={{ fontFamily: theme.fonts.numeric, fontWeight: '700', color: theme.colors.text0 }}>{fmtKwdAsIs(a.kwd)}</Text>
                  <Text style={{ marginLeft: 8, color: theme.colors.text2 }}>{fmtPct(a.pct)}</Text>
                </View>
              )) : (
                <Text style={styles.emptyText}>No aggregator sales for this period</Text>
              )}
            </Card>

            {/* Delivery by brand */}
            <SectionTitle title="Delivery Sales by Brand" />
            <Card>
              {delivery.length > 0 && delivery.some(b => (b.deliveryKwd ?? 0) > 0) ? delivery.map(b => (
                <View key={b.id} style={styles.payRow}>
                  <View style={[styles.swatch, { backgroundColor: b.color }]} />
                  <Text style={{ flex: 1, color: theme.colors.text0 }}>{b.name}</Text>
                  <Text style={{ fontFamily: theme.fonts.numeric, fontWeight: '700', color: theme.colors.text0 }}>{fmtKwdAsIs(b.deliveryKwd)}</Text>
                </View>
              )) : (
                <Text style={styles.emptyText}>No delivery sales for this period</Text>
              )}
            </Card>

            {/* Payments */}
            <SectionTitle title="Sales by Payment Type" />
            <Card>
              {payments.length > 0 && payments.some(p => (p.kwd ?? 0) > 0) ? payments.map(p => (
                <View key={p.key} style={styles.payRow}>
                  <View style={[styles.swatch, { backgroundColor: p.color }]} />
                  <Text style={{ flex: 1, color: theme.colors.text0 }}>{p.label}</Text>
                  <Text style={{ fontFamily: theme.fonts.numeric, fontWeight: '700', color: theme.colors.text0 }}>{fmtKwdAsIs(p.kwd)}</Text>
                  <Text style={{ marginLeft: 8, color: theme.colors.text2 }}>{fmtPct(p.pct)}</Text>
                </View>
              )) : (
                <Text style={styles.emptyText}>No payment data for this period</Text>
              )}
            </Card>

            {/* Top outlets */}
            {scopeType !== 'brand' && (
              <>
                <SectionTitle title="Top 10 Outlets" />
                <Card>
                  {topOutlets.length > 0 && topOutlets.some(o => (o.amtKwd ?? 0) > 0) ? (
                    topOutlets.map((o, i) => {
                      const brand = brands.find(b => b.id === o.brandId);

                      return (
                        <Row
                          key={o.code}
                          avatar={{ initials: String(i + 1).padStart(2, '0'), color: brand?.color ?? theme.colors.gold }}
                          title={` ${o.name}`}
                          subtitle={brand?.name}
                          amount={fmtKwdAsIs(o.amtKwd)}
                          delta={{ label: fmtYoy(o.yoyPct), tone: o.yoyPct >= 0 ? 'green' : 'red' }}
                        />
                      );
                    })
                  ) : (
                    <Text style={styles.emptyText}>No outlet data for this period</Text>
                  )}
                </Card>
              </>
            )}


          </>
        )}

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
  safe: { flex: 1, backgroundColor: theme.colors.bg0 },
  center: { flex: 1, backgroundColor: theme.colors.bg0, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 14, paddingBottom: 80 },
  h2: { fontSize: 22, fontWeight: '700', color: theme.colors.text0 },
  subhead: { fontSize: 12, color: theme.colors.text2, marginTop: 2, marginBottom: 14 },

  globalNote: {
    color: theme.colors.text2,
    fontSize: 12,
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  filterBar: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(255,124,174,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,124,174,0.22)',
    marginBottom: 14,
  },
  filterIcon: { fontSize: 18, marginRight: 12 },
  filterLabel: { fontSize: 10, color: theme.colors.text2, letterSpacing: 0.8, fontWeight: '600' },
  filterValue: { fontSize: 14, fontWeight: '700', color: theme.colors.text0, marginTop: 1 },
  eyebrow: { fontSize: 11, color: theme.colors.text2, textTransform: 'uppercase', letterSpacing: 0.6 },
  hero: { fontFamily: theme.fonts.numeric, fontSize: 26, fontWeight: '700', color: theme.colors.text0, marginTop: 4 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  brandSwatch: { width: 9, height: 9, borderRadius: 3 },
  brandName: { fontSize: 13, fontWeight: '600', color: theme.colors.text0 },
  brandValue: { fontFamily: theme.fonts.numeric, fontSize: 13, fontWeight: '700', color: theme.colors.text0 },
  brandShare: { fontSize: 11, color: theme.colors.text2, minWidth: 38, textAlign: 'right' },
  bdBrand: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  bdChev: { width: 16, color: theme.colors.text3, fontSize: 14 },
  bdMeta: { fontSize: 10, color: theme.colors.text2 },
  bdContribution: { fontSize: 12, fontWeight: '700', color: theme.colors.gold, minWidth: 40, textAlign: 'right' },
  bdOutlet: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, paddingLeft: 28,
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  
  outletName: { fontSize: 11, color: theme.colors.text1 },
  outletAmt: { fontFamily: theme.fonts.numeric, fontSize: 11, fontWeight: '700', color: theme.colors.text0 },
  outletShare: { fontSize: 10, color: theme.colors.text3, minWidth: 36, textAlign: 'right' },
  helperText: { fontSize: 11, color: theme.colors.text3, marginBottom: 8, paddingHorizontal: 2 },
  emptyText: {
    color: theme.colors.text2,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
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
  swatch: { width: 10, height: 10, borderRadius: 3, marginRight: 10 },
  marginLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: theme.colors.text2, fontSize: 11 },
  payRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
});