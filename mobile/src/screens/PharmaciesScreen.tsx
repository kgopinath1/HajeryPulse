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
  TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@theme/index';
import { Card } from '@components/Card';
import { Chip } from '@components/Chip';
import { KpiTile } from '@components/KpiTile';
import { SectionTitle } from '@components/SectionTitle';
import { SegTabs } from '@components/SegTabs';
import { MultiSparkline } from '@components/MultiSparkline';
import { StackedBar } from '@components/StackedBar';
import { AsOnDateBar } from '@components/AsOnDateBar';
import { AsOnDateModal } from '@components/AsOnDateModal';
import { PickerModal } from '@components/PickerModal';
import { getTrendLabels, getPeriodLabel } from '@utils/labels';
import { Row } from '@components/Row';
import { NoDataCard } from '@components/NoDataCard';
import { pharmaApi } from '@api/pharma';
import { defaultAsOfDate } from '@utils/date';
import { fmtKwd, fmtPct, fmtInt, fmtYoy, fmtYoyPp, fmtKwdAsIs, fmtKwdSmallVal } from '@utils/format';
import {
  Pharmacy, PharmaSummary, PharmaMargin, SalesQuality,
  PharmaChannel, PharmaPaymentRow, PharmaCategoryRow,
  PharmaDiscountRow, PharmaRxOtcMix, PharmaTrend,
} from '@types/domain';

export function PharmaciesScreen(): React.JSX.Element {
  const [asOfDate, setAsOfDate] = useState<string>(defaultAsOfDate());
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [pharmacyId, setPharmacyId] = useState<string>('all');
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'ytd'>('week');
  const [pickerVisible, setPickerVisible] = useState(false);

  const [summary, setSummary] = useState<PharmaSummary | null>(null);
  const [margin, setMargin] = useState<PharmaMargin | null>(null);
  const [quality, setQuality] = useState<SalesQuality | null>(null);
const [channels, setChannels] = useState<PharmaChannel[]>([]);
  const [payments, setPayments] = useState<PharmaPaymentRow[]>([]);
  const [categories, setCategories] = useState<PharmaCategoryRow[]>([]);
  const [rxMix, setRxMix] = useState<PharmaRxOtcMix | null>(null);
  const [discounts, setDiscounts] = useState<PharmaDiscountRow[]>([]);
  const [topPharm, setTopPharm] = useState<Pharmacy[]>([]);
  const [trend, setTrend] = useState<PharmaTrend>({ current: [], previous: [] });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load list of pharmacies once
useEffect(() => {
  pharmaApi.list(asOfDate, period).then(setPharmacies);
}, [asOfDate, period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      console.log('=== API CALL PARAMS ===', { asOfDate, pharmacyId, period });
      const [s, m, q, ch, pay, cats, rx, disc, top, tr] = await Promise.all([
        pharmaApi.summary(asOfDate, pharmacyId, period),
        pharmaApi.margin(asOfDate, pharmacyId, period),
        pharmaApi.quality(asOfDate, pharmacyId, period),
        pharmaApi.channels(asOfDate, pharmacyId, period),
        pharmaApi.payments(asOfDate, pharmacyId, period),
        pharmaApi.categories(asOfDate, pharmacyId, 10),
        pharmaApi.rxOtcMix(asOfDate, pharmacyId, period),
        pharmaApi.discountLeaderboard(asOfDate, 10),
        pharmaApi.topPharmacies(asOfDate, 10),
        pharmaApi.trend(asOfDate, pharmacyId, period),
      ]);
      setSummary(s); setMargin(m); setQuality(q); setChannels(ch);
      setPayments(pay); setCategories(cats); setRxMix(rx);
      setDiscounts(disc); setTopPharm(top);
      setTrend({
        current: tr?.current ?? [],
        previous: tr?.previous ?? [],
      });
      console.log('=== API RESPONSES ===', { s, m, disc, top, cats, q, ch, pay, rx, tr });
    } catch (err) {
      console.error('=== API ERROR ===', err);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [asOfDate, pharmacyId, period]);

  useEffect(() => { load(); }, [load]);
  const currentPharmacyName =
    pharmacies.find(p => p.id === pharmacyId)?.name ?? 'All Pharmacies';
  const offlineCount =
    (summary?.storesTotal ?? 0) - (summary?.storesActive ?? 0);
 const periodLabel = getPeriodLabel(period);
    const hasData =
  (summary?.revenueKwd ?? 0) > 0 ||
  (summary?.transactions ?? 0) > 0 ||

  (margin && (margin.grossKwd ?? 0) > 0) ||

  (quality && (quality.grossKwd ?? 0) > 0) ||

  (rxMix && ((rxMix.rxKwd ?? 0) > 0 || (rxMix.otcKwd ?? 0) > 0)) ||

  (
   channels.some(c => c.kwd > 0)
  ) ||

  payments.some(p => (p.kwd ?? 0) > 0) ||

  categories.some(c => (c.kwd ?? 0) > 0) ||

  discounts.some(d => (d.discountKwd ?? 0) > 0) ||

  topPharm.some(p => (p.amtKwd ?? 0) > 0);

const showNoData = !loading && !hasData;
const getChannelColor = (code: string) => {
  switch (code.toLowerCase()) {
    case 'instore':
      return theme.colors.teal;

    case 'callcenter':
      return theme.colors.blue;

    case 'aggregator':
      return theme.colors.amber;

      case 'website':
      return theme.colors.pink;

    default:
      return theme.colors.gold;
  }
};


const getTrendLabels = (period: string, length: number): string[] => {
  switch (period) {
    case 'week':
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    case 'month':
      return Array.from({ length }, (_, i) => `W${i + 1}`);
    case 'ytd':
    default:
      return [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
  }
};

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

        {/* <AsOnDateBar asOfDate={asOfDate} /> */}

        {/* Date Picker */}
        <AsOnDateBar
          asOfDate={asOfDate}
          onPress={() => setDateModalVisible(true)}
        />

        <SegTabs
          value={period}
          onChange={val => setPeriod(val)}
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

      {/* Revenue card */}
{summary ? (
  <Card>
    <Text style={styles.eyebrow}>REVENUE · {period.toUpperCase()} TO DATE</Text>
    <Text style={styles.hero}>{fmtKwd(summary.revenueKwd)}</Text>
    <View style={{ marginTop: 4 }}>
      <Chip label={fmtYoy(summary.growthPct, summary.growthType)} tone={summary.growthPct >= 0 ? 'green' : 'red'} />
    </View>
    {period !== 'day' && (
      <View style={{ marginTop: 12 }}>
        <MultiSparkline
          primary={trend.current ?? []}
          secondary={trend.previous ?? []}
          primaryColor={theme.colors.teal}
          secondaryColor={theme.colors.blue}
          labels={getTrendLabels(period, trend.current?.length ?? 0)}
          height={120}
        />
        <View style={styles.marginLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.teal }]} />
            <Text style={styles.legendText}>Current Period</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.blue }]} />
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
   

        {/* KPI grid */}
        {summary ? (

          <View style={styles.kpiGrid}>
            <KpiTile label="Transactions" value={fmtInt(summary.transactions)} delta={{ value: `${fmtPct(summary.deltaTxns)}`, positive: true }} />
            <KpiTile label="Check Avg." value={fmtKwd(summary.basketSizeKwd)} delta={{ value: `${fmtPct(summary.deltaBasketSizeKwd, 1)}`, positive: true }} />
            <KpiTile
              label="Active stores"
              value={
                <Text style={{ fontSize: 35 }}>
                  {summary.storesActive}
                </Text>
              }
            />
            <KpiTile label="Rx share" value={fmtPct(rxMix.rxPct, 2)} chip={{ label: `OTC ${fmtPct(rxMix.otcPct, 2)}`, tone: 'teal' }} />
          </View>
          ) : (
      <Card>
        <Text style={styles.emptyText}>No KPI data available</Text>
      </Card>
        )}

      {/* Rx vs OTC */}
<SectionTitle title="Rx vs OTC Mix" rightLabel={pharmacyId === 'all' ? 'All pharmacies' : currentPharmacyName} />
{rxMix ? (
  <Card>
    <Text style={styles.eyebrow}>PRESCRIPTION (Rx) SHARE</Text>
    <Text style={[styles.hero, { color: theme.colors.teal }]}>{fmtPct(rxMix.rxPct, 2)}</Text>
    <Text style={styles.subtle}>OTC {fmtPct(rxMix.otcPct, 2)}</Text>

    <View style={{ marginTop: 12 }}>
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <StackedBar
          segments={[
            { pct: rxMix.rxPct, color: theme.colors.teal },
            { pct: rxMix.otcPct, color: theme.colors.gold },
          ]}
          height={16}
        />
        <Text style={{ position: 'absolute', left: 8, color: '#0f0f0f', fontSize: 10, fontWeight: '700' }}>
          Rx
        </Text>
        <Text style={{ position: 'absolute', right: 8, color: '#0f0f0f', fontSize: 10, fontWeight: '700' }}>
          OTC
        </Text>
      </View>
    </View>

    <View style={styles.kpiGridInner}>
      <KpiTile
        label={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: theme.colors.teal }} />
            <Text style={{ color: theme.colors.text2, fontSize: 11 }}>Prescription (Rx)</Text>
          </View>
        }
        value={fmtKwd(rxMix.rxKwd)}
        valueColor={theme.colors.teal}
        delta={{
          value: `${Math.abs(rxMix.rxYoyPct || 0).toFixed(2)}% ${rxMix.growthType}`,
          positive: rxMix.rxYoyPct >= 0,
        }}
      />
      <KpiTile
        label={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: theme.colors.gold }} />
            <Text style={{ color: theme.colors.text2, fontSize: 11 }}>Over-the-counter (OTC)</Text>
          </View>
        }
        value={fmtKwd(rxMix.otcKwd)}
        valueColor={theme.colors.gold}
        delta={{
          value: `${Math.abs(rxMix.otcYoyPct || 0).toFixed(2)}% ${rxMix.growthType}`,
          positive: rxMix.otcYoyPct >= 0,
        }}
      />
    </View>
  </Card>
) : (
  <Card>
    <Text style={styles.emptyText}>No Rx/OTC data available</Text>
  </Card>
)}

       {/* Margin */}
<SectionTitle title="Margin Analysis" rightLabel={pharmacyId === 'all' ? 'All pharmacies' : currentPharmacyName} />
{margin ? (
  <Card>
    <Text style={styles.eyebrow}>GROSS MARGIN %</Text>
    <Text style={[styles.hero, { color: theme.colors.goldSoft }]}>{fmtPct(margin.marginPct)}</Text>
    <View style={styles.marginHeaderRow}>
      <Text style={styles.subtle}>vs {fmtPct(margin.marginPctLY)} last period selected</Text>
      <Chip label={`${fmtYoyPp(margin.marginDeviationPp)} ${periodLabel}`} tone={margin.marginDeviationPp >= 0 ? 'green' : 'red'} />
    </View>

    {period !== 'day' && (
      <View style={styles.marginTrend}>
        <MultiSparkline
          primary={margin.trend ?? []}
          secondary={margin.trendLY ?? []}
          primaryColor={theme.colors.goldSoft}
          secondaryColor={theme.colors.blue}
          labels={getTrendLabels(period, margin.trend?.length ?? 0)}
          height={90}
        />
        <View style={styles.marginLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.goldSoft }]} />
            <Text style={styles.legendText}>Margin % this period</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.blue }]} />
            <Text style={styles.legendText}>Last period</Text>
          </View>
        </View>
      </View>
    )}

    <View style={styles.kpiGridInner}>
      <KpiTile
        label="Gross sales"
        value={fmtKwd(margin.grossKwd)}
        delta={{
          value: (
            <>
              <Text style={{ color: margin.grossYoyPct >= 0 ? theme.colors.green : theme.colors.red }}>{fmtPct(margin.grossYoyPct)}</Text>
              <Text style={{ color: theme.colors.text2 }}> {periodLabel}</Text>
            </>
          ),
          positive: margin.grossYoyPct >= 0,
        }}
      />

      <KpiTile
        label="Discount"
        value={fmtKwd(margin.discountKwd)}
        chip={{ label: `${fmtPct(margin.discountPct)} of Gross` }}
      />

      <KpiTile
        label="Cost of sales"
        value={fmtKwd(margin.cogsKwd)}
        delta={{
          value: (
            <>
              <Text style={{ color: margin.cogsYoyPct >= 0 ? theme.colors.green : theme.colors.red }}>{fmtPct(margin.cogsYoyPct)}</Text>
              <Text style={{ color: theme.colors.text2 }}> {periodLabel}</Text>
            </>
          ),
          positive: margin.cogsYoyPct >= 0,
        }}
      />

      <KpiTile
        label="Margin"
        value={fmtKwd(margin.marginKwd)}
        delta={{
          value: (
            <>
              <Text style={{ color: margin.grossMarginYoyPct >= 0 ? theme.colors.green : theme.colors.red }}>{fmtPct(margin.grossMarginYoyPct)}</Text>
              <Text style={{ color: theme.colors.text2 }}> {periodLabel}</Text>
            </>
          ),
          positive: margin.grossMarginYoyPct >= 0,
        }}
      />

      <KpiTile
        label="NET SALES"
        value={fmtKwd(margin.netSalesKwd)}
        valueColor={theme.colors.teal}
        subtitle="After discount & returns"
      />

      <KpiTile
        label={`${periodLabel} DEVIATION`}
        value={`${margin.marginDeviationPp > 0 ? '+' : ''}${margin.marginDeviationPp.toFixed(1)} %`}
        valueColor={
          margin.marginDeviationPp > 0
            ? theme.colors.green
            : margin.marginDeviationPp < 0
              ? theme.colors.red
              : theme.colors.text2
        }
        subtitle={
          margin.marginDeviationPp > 0
            ? 'Margin expansion'
            : margin.marginDeviationPp < 0
              ? 'Margin contraction'
              : 'No change'
        }
      />
    </View>
  </Card>
) : (
  <Card>
    <Text style={styles.emptyText}>No margin data available</Text>
  </Card>
)}

        {/* Sales Quality */}
        <SectionTitle title="Sales Quality" rightLabel="Returns analysis" />
        {quality ? (
          <>
            
            <Card>
              <Text style={styles.eyebrow}>GROSS → NET → RETURNS</Text>
              <Text style={styles.hero}>{fmtKwd(quality.netKwd)}</Text>
              <View style={styles.marginHeaderRow}>
                <Text style={styles.subtle}>{fmtPct(quality.netPct)} of gross retained</Text>
                <Chip
                  label={`${quality.netPctPp >= 0 ? '▲' : '▼'} ${Math.abs(quality.netPctPp || 0).toFixed(1)} pp ${quality.growthType}`}
                  tone={quality.netPctPp >= 0 ? 'green' : 'red'}
                />              </View>
              <View style={{ marginTop: 12 }}>
                {/* Gross sales */}
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ color: theme.colors.amber, fontWeight: '600', fontSize: 12 }}>Gross sales</Text>
                    <Text style={{ color: theme.colors.text0, fontFamily: theme.fonts.numeric, fontWeight: '700' }}>{fmtKwd(quality.grossKwd)}</Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <View style={{ height: '100%', backgroundColor: theme.colors.amber, width: '100%' }} />
                  </View>
                </View>

                {/* Sales returns */}
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ color: theme.colors.red, fontWeight: '600', fontSize: 12 }}>Sales returns</Text>
                    <Text style={{ color: theme.colors.text0, fontFamily: theme.fonts.numeric, fontWeight: '700' }}>{fmtKwd(quality.returnsKwd)}</Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <View style={{ height: '100%', backgroundColor: theme.colors.red, width: `${Math.round((quality.returnsKwd / quality.grossKwd) * 100)}%` }} />
                  </View>
                </View>

                {/* Net sales */}
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ color: theme.colors.teal, fontWeight: '600', fontSize: 12 }}>Net sales</Text>
                    <Text style={{ color: theme.colors.text0, fontFamily: theme.fonts.numeric, fontWeight: '700' }}>{fmtKwd(quality.netKwd)}</Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <View style={{ height: '100%', backgroundColor: theme.colors.teal, width: `${Math.round((quality.netKwd / quality.grossKwd) * 100)}%` }} />
                  </View>
                </View>
              </View>

              {/* Returns metrics footer */}
              <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: theme.colors.red, fontWeight: '600', fontSize: 12 }}>Returns {fmtPct(quality.returnsPct)} of gross</Text>
                <Chip
                  label={`${quality.returnsPctPp >= 0 ? '▼' : '▲'} ${Math.abs(quality.returnsPctPp || 0).toFixed(1)} pp ${quality.growthType}`}
                  tone={quality.returnsPctPp >= 0 ? 'red' : 'green'}
                />

              </View>
            </Card>
          </>
          ) : (
      <Card>
        <Text style={styles.emptyText}>No sales quality data available</Text>
      </Card>
    )}
      

      {/* Channels */}
<SectionTitle title="Sales by Channel" />

{channels.length > 0 ? (
  <Card>
    {/* Legend */}
    <View
      style={{
        flexDirection: 'row',
     flexWrap: 'wrap',
        gap:16,
        marginBottom: 12,
     }}
    >
      {channels.map(channel => (
        <View
          key={channel.channelCode}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
         }}
        >
          <View
      style={{
              width: 12,
              height: 12,
          borderRadius: 2,
           backgroundColor: getChannelColor(channel.channelCode),
            }}
          />

          <Text
            style={{
              fontSize: theme.fontSize.sm,
              color: theme.colors.text2,
            }}
          >
            {channel.channelName}{' '}
            <Text
              style={{
                fontWeight: '700',
                color: theme.colors.text0,
              }}
            >
              {channel.pct.toFixed(0)}%
            </Text>
          </Text>
        </View>
      ))}
    </View>

    {/* Stacked Bar */}
    <View style={{ marginBottom: 12 }}>
      <StackedBar
        segments={channels.map(channel => ({
          pct: Number(channel.pct),
          color: getChannelColor(channel.channelCode),
        }))}
        height={12}
      />
    </View>

    {/* Channel Values */}
    <View style={{ gap: 8 }}>
   {channels.map(channel => (
        <View
          key={channel.channelCode}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 1,
                backgroundColor: getChannelColor(channel.channelCode),
              }}
            />

            <Text style={{ color: theme.colors.text1 }}>
              {channel.channelName}
            </Text>
          </View>

          <Text
            style={{
              color: theme.colors.text0,
              fontFamily: theme.fonts.numeric,
              fontWeight: '700',
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

        {/* Payments */}

        <SectionTitle title="Sales by Payment Type" />
        <Card>
          {payments.length > 0 ? (
          payments.map(p => (

            <View key={p.key} style={styles.payRow2}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  flex: 1,
                  gap: 6,
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 1,
                    backgroundColor: p.color,
                  }}
                />
                <Text style={{ color: theme.colors.text0 }}>
                  {p.label}
                </Text>
              </View>

              <Text
                style={{
                  color: theme.colors.text0,
                  fontFamily: theme.fonts.numeric,
                  fontWeight: '700',
                }}
              >
                {fmtKwdAsIs(p.kwd)}
              </Text>

              <Text
                style={{
                  color: theme.colors.text2,
                  marginLeft: 8,
                }}
              >
                {fmtPct(p.pct)}
              </Text>
            </View>
))
      ) : (
        <Text style={styles.emptyText}>No payment data for this period</Text>
      )}
    </Card>


  {/* Top 10 Categories */}
        <SectionTitle title="Top 10 Categories" />
        <Card>
          {categories.length > 0 ? (
          categories.map(c => (
            <View key={c.key} style={styles.payRow2}>
              <Text style={{ color: theme.colors.text0, flex: 1 }}>{c.label}</Text>
              <Text style={{ width: 90, textAlign: 'left', color: theme.colors.text0, fontFamily: theme.fonts.numeric, fontWeight: '700' }}>{fmtKwdAsIs(c.kwd)}</Text>
              <Chip label={fmtPct(c.pct, 0)} tone="teal" />
            </View>
          )) 
        ) : (
        <Text style={styles.emptyText}>No category data available</Text>
      )}
    </Card>
  </>
)}

     {/* Top 10 Pharmacies */}
{pharmacyId === 'all' && (
  <>
    <SectionTitle title="Top 10 Pharmacies" />
    <Card>
      {topPharm && topPharm.length > 0 ? (
        topPharm.map((p, i) => (
          <Row
            key={p.id}
            avatar={{
              initials: String(i + 1).padStart(2, '0'),
              color: rankColor(i + 1),
            }}
            title={p.name}
            subtitle={`${fmtKwdAsIs(p.amtKwd)} · ${period} revenue`}
            amount={fmtKwdAsIs(p.amtKwd)}
            delta={{
              label: '▲ ' + Math.round(8 + i * 0.5) + '%',
              tone: 'green',
            }}
          />
        ))
      ) : (
        <Text style={styles.emptyText}>No pharmacy data available</Text>
      )}
    </Card>
  </>
)}

{/* Discount leaderboard */}
{pharmacyId === 'all' && (
  <>
    <SectionTitle title="Highest Discount by Pharmacy" rightLabel="Top 10" />
    <Card>
      {discounts.length > 0 ? (
        (() => {
          const maxRate = Math.max(...discounts.map(d => d.ratePct), 1);
          return discounts.map((d, index) => (
            <View
              key={d.id}
              style={[
                styles.discRow,
                index === discounts.length - 1 && styles.discRowLast,
              ]}
            >
              <View style={styles.discHeader}>
                <Text style={styles.discName}>{d.name}</Text>
                <Text style={styles.discValue}>
                  -{fmtKwdAsIs(d.discountKwd)} <Text style={styles.discPct}>({fmtPct(d.ratePct)})</Text>
                </Text>
              </View>
              <View style={styles.discBarBg}>
                <View
                  style={[
                    styles.discBarFill,
                    { width: `${Math.round((d.ratePct / maxRate) * 100)}%` },
                  ]}
                />
              </View>
            </View>
          ));
        })()
      ) : (
        <Text style={styles.emptyText}>No discount data available</Text>
      )}
    </Card>
  </>
)}
      </ScrollView>

      <AsOnDateModal
        visible={dateModalVisible}
        onClose={() => setDateModalVisible(false)}
        currentDate={asOfDate}
        onSelect={(date) => setAsOfDate(date)}
      />

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
    subtitle: p.id === 'all' ? `${summary?.storesActive ?? 0} active branches · default scope` : `${fmtKwd(p.amtKwd)} · ${period} revenue`,
    tag: p.id === 'all' ? 'All' : p.id,
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
  safe: { flex: 1, backgroundColor: theme.colors.bg0 },
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
  filterLabel: { fontSize: 10, color: theme.colors.text2, letterSpacing: 0.8, fontWeight: '600' },
  filterValue: { fontSize: 14, fontWeight: '700', color: theme.colors.text0, marginTop: 1 },
  eyebrow: {
    fontSize: 11, color: theme.colors.text2,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  discBarFill: {
  height: '100%',
  borderRadius: 999,
},
  hero: {
    fontFamily: theme.fonts.numeric,
    fontSize: 26, fontWeight: '700', color: theme.colors.text0, marginTop: 4, letterSpacing: -0.5,
  },
  subtle: { fontSize: 11, color: theme.colors.text2, marginTop: 4 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  kpiGridInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  marginHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  payRow: { fontSize: 12, fontWeight: '600', marginVertical: 4 },
  payRow2: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  discRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  discRowLast: {
    borderBottomWidth: 0,
  },
  discHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  discName: {
    color: theme.colors.text0,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 12,
  },
  discValue: {
    color: theme.colors.amber,
    fontFamily: theme.fonts.numeric,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'right',
  },
  discPct: {
    color: theme.colors.text2,
    fontFamily: theme.fonts.numeric,
    fontWeight: '600',
  },
  discBarBg: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginTop: 8,
  },
  discBarFill: {
    height: '100%',
    backgroundColor: theme.colors.amber,
    borderRadius: 999,
  },
  emptyText: {
  color: theme.colors.text2,
  fontSize: theme.fontSize.sm,
  textAlign: 'center',
  paddingVertical: theme.spacing.lg,
},
  marginLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: theme.colors.text2, fontSize: 11 },
});
