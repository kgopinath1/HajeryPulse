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
import { Sparkline } from '@components/Sparkline';
import { StackedBar } from '@components/StackedBar';
import { AsOnDateBar } from '@components/AsOnDateBar';
import { AsOnDateModal } from '@components/AsOnDateModal';
import { PickerModal } from '@components/PickerModal';
import { Row } from '@components/Row';
import { pharmaApi } from '@api/pharma';
import { defaultAsOfDate } from '@utils/date';
import { fmtKwd, fmtPct, fmtInt, fmtYoy, fmtYoyPp, fmtKwdAsIs, fmtKwdSmallVal } from '@utils/format';
import {
  Pharmacy, PharmaSummary, PharmaMargin, SalesQuality,
  PharmaChannel, PharmaPaymentRow, PharmaCategoryRow,
  PharmaDiscountRow, PharmaRxOtcMix, PharmaTrendPoint,
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
  const [channels, setChannels] = useState<PharmaChannel | null>(null);
  const [payments, setPayments] = useState<PharmaPaymentRow[]>([]);
  const [categories, setCategories] = useState<PharmaCategoryRow[]>([]);
  const [rxMix, setRxMix] = useState<PharmaRxOtcMix | null>(null);
  const [discounts, setDiscounts] = useState<PharmaDiscountRow[]>([]);
  const [topPharm, setTopPharm] = useState<Pharmacy[]>([]);
  const [trend, setTrend] = useState<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load list of pharmacies once
  useEffect(() => { pharmaApi.list().then(setPharmacies); }, []);

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
      setTrend((tr ?? []).map((x: PharmaTrendPoint) => x.value ?? 0));
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



        {/* Revenue card */}
        {summary && (
          <Card>
            <Text style={styles.eyebrow}>REVENUE · {period.toUpperCase()} TO DATE</Text>
            <Text style={styles.hero}>{fmtKwd(summary.revenueKwd)}</Text>
            <View style={{ marginTop: 4 }}>
              <Chip label={fmtYoy(summary.growthPct, summary.growthType)} tone={summary.growthPct >= 0 ? 'green' : 'red'} />
            </View>
            {period !== 'day' && (
              <View style={{ marginTop: 12 }}>
                <Sparkline values={trend.length ? trend : [0]} color={theme.colors.teal} height={120} />
                <Text style={{ color: theme.colors.text2 }}>
                  {period === 'week' && 'Last 7 days'}
                  {period === 'month' && 'Weekly trend'}
                  {period === 'ytd' && 'Monthly trend'}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* KPI grid */}
        {summary && (

          <View style={styles.kpiGrid}>
            <KpiTile label="Transactions" value={fmtInt(summary.transactions)} delta={{ value: `${fmtPct(summary.deltaTxns)}`, positive: true }} />
            <KpiTile label="Basket size" value={fmtKwd(summary.basketSizeKwd)} delta={{ value: `${fmtPct(summary.deltaBasketSizeKwd, 1)}`, positive: true }} />
            <KpiTile label="Active stores" value={
              <Text>{summary.storesActive}<Text style={{ fontSize: 12, color: theme.colors.text2 }}>{` / ${summary.storesTotal}`}</Text></Text>
            }
              /* chip=
              {{ label: pharmacyId === 'all' ? '1 offline' : 'live', tone: pharmacyId === 'all' ? 'amber' : 'green' }}  */
              chip={{
                label:
                  pharmacyId === 'all'
                    ? `${offlineCount} offline`
                    : 'live',
                tone:
                  pharmacyId === 'all' && offlineCount > 0
                    ? 'amber'
                    : 'green'
              }}
            />
            <KpiTile label="Rx share" value={fmtPct(rxMix.rxPct, 0)} chip={{ label: `OTC ${fmtPct(rxMix.otcPct, 0)}`, tone: 'teal' }} />
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
                    { pct: rxMix.rxPct, color: theme.colors.teal },
                    { pct: rxMix.otcPct, color: theme.colors.gold },
                  ]}
                  height={16}
                />
              </View>
              <View style={styles.kpiGridInner}>
                <KpiTile
                  label="Prescription (Rx)"
                  value={fmtKwd(rxMix.rxKwd)}
                  delta={{

                    value: `${Math.abs(rxMix.rxYoyPct || 0).toFixed(1)}% ${rxMix.growthType}`,
                    positive: rxMix.rxYoyPct >= 0

                  }}
                />

                <KpiTile
                  label="Over-the-counter"
                  value={fmtKwd(rxMix.otcKwd)}
                  delta={{

                    value: `${Math.abs(rxMix.otcYoyPct || 0).toFixed(1)}% ${rxMix.growthType}`,
                    positive: rxMix.otcYoyPct >= 0

                  }}
                />
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
              <View style={styles.marginHeaderRow}>
                <Text style={styles.subtle}>vs {fmtPct(margin.marginPctLY)} last year</Text>
                <Chip label={`${fmtYoyPp(margin.marginPct - margin.marginPctLY)} YoY`} tone={margin.marginPct - margin.marginPctLY >= 0 ? 'green' : 'red'} />
              </View>
              <View style={styles.kpiGridInner}>
                {
                  // Compute YoY percentages using last-year values returned by the API
                  (() => {
                    const grossYoY = margin.lyGrossKwd ? ((margin.grossKwd - margin.lyGrossKwd) / Math.abs(margin.lyGrossKwd)) * 100 : NaN;
                    const cogsYoY = margin.lyCogsKwd ? ((margin.cogsKwd - margin.lyCogsKwd) / Math.abs(margin.lyCogsKwd)) * 100 : NaN;


                    const lyMarginKwd = (margin.lyNetSalesKwd ?? 0) - (margin.lyCogsKwd ?? 0);
                    const marginYoY = lyMarginKwd ? ((margin.marginKwd - lyMarginKwd) / Math.abs(lyMarginKwd)) * 100 : NaN;
                    const discountPct = margin.grossKwd === 0 ? NaN : (margin.discountKwd / margin.grossKwd) * 100;

                    return (
                      <>
                        <KpiTile
                          label="Gross sales"
                          value={fmtKwd(margin.grossKwd)}
                          delta={{
                            value: (
                              <>
                                <Text style={{ color: grossYoY >= 0 ? theme.colors.green : theme.colors.red }}>{fmtPct(grossYoY)}</Text>
                                <Text style={{ color: theme.colors.text2 }}> vs LY</Text>
                              </>
                            ),
                            positive: grossYoY >= 0,
                          }}
                        />
                        <KpiTile label="Discount" value={`${fmtKwd(margin.discountKwd)}`} chip={{ label: fmtPct(discountPct) + " of Gross" }} />
                        <KpiTile label="Cost of sales"
                          value={fmtKwd(margin.cogsKwd)}
                          delta={{
                            value: (
                              <>
                                <Text style={{ color: cogsYoY >= 0 ? theme.colors.green : theme.colors.red }}>{fmtPct(cogsYoY)}</Text>
                                <Text style={{ color: theme.colors.text2 }}> vs LY</Text>
                              </>
                            ),
                            positive: cogsYoY >= 0,
                          }}
                        />
                        <KpiTile label="Margin" value={fmtKwd(margin.marginKwd)} delta={{
                          value: (
                            <>
                              <Text style={{ color: marginYoY >= 0 ? theme.colors.green : theme.colors.red }}>{fmtPct(marginYoY)}</Text>
                              <Text style={{ color: theme.colors.text2 }}> vs LY</Text>
                            </>
                          ),
                          positive: marginYoY >= 0,
                        }}
                        />

                      </>
                    );
                  })()
                }
                <KpiTile
                  label="NET SALES"
                  value={fmtKwd(margin.netSalesKwd)}
                  valueColor={theme.colors.teal}
                  subtitle="After discount & returns"
                />
                <KpiTile
                  label="YOY DEVIATION"
                  value={`${margin.marginPct - margin.marginPctLY > 0 ? '+' : ''}${(margin.marginPct - margin.marginPctLY).toFixed(1)} pp`}
                  valueColor={theme.colors.green}
                  subtitle="Margin expansion"
                />

              </View>
            </Card>
          </>
        )}

        {/* Sales Quality */}
        {quality && (
          <>
            <SectionTitle title="Sales Quality" rightLabel="Returns analysis" />
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
        )}

        {/* Channels */}
        {channels && (
          <>
            <SectionTitle title="Sales by Channel" />
            <Card>
              {(() => {
                const total = channels.instoreKwd + channels.callcenterKwd + channels.aggregatorKwd;
                const instorePct = total > 0 ? (channels.instoreKwd / total) * 100 : 0;
                const callcenterPct = total > 0 ? (channels.callcenterKwd / total) * 100 : 0;
                const aggregatorPct = total > 0 ? (channels.aggregatorKwd / total) * 100 : 0;

                return (
                  <>
                    {/* Legend with percentages */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: theme.colors.teal }} />
                        <Text style={{ fontSize: theme.fontSize.sm, color: theme.colors.text2 }}>Instore <Text style={{ fontWeight: '700', color: theme.colors.text0 }}>{instorePct.toFixed(0)}%</Text></Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: theme.colors.blue }} />
                        <Text style={{ fontSize: theme.fontSize.sm, color: theme.colors.text2 }}>Call center <Text style={{ fontWeight: '700', color: theme.colors.text0 }}>{callcenterPct.toFixed(0)}%</Text></Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: theme.colors.amber }} />
                        <Text style={{ fontSize: theme.fontSize.sm, color: theme.colors.text2 }}>Aggregator <Text style={{ fontWeight: '700', color: theme.colors.text0 }}>{aggregatorPct.toFixed(0)}%</Text></Text>
                      </View>
                    </View>

                    {/* Stacked bar */}
                    <View style={{ marginBottom: 12 }}>
                      <StackedBar
                        segments={[
                          { pct: instorePct, color: theme.colors.teal },
                          { pct: callcenterPct, color: theme.colors.blue },
                          { pct: aggregatorPct, color: theme.colors.amber },
                        ]}
                        height={12}
                      />
                    </View>

                    {/* Channel values */}
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 1, backgroundColor: theme.colors.teal }} />
                          <Text style={{ color: theme.colors.text1 }}>Instore</Text>
                        </View>
                        <Text style={{ color: theme.colors.text0, fontFamily: theme.fonts.numeric, fontWeight: '700' }}>{fmtKwd(channels.instoreKwd)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 1, backgroundColor: theme.colors.blue }} />
                          <Text style={{ color: theme.colors.text1 }}>Call center</Text>
                        </View>
                        <Text style={{ color: theme.colors.text0, fontFamily: theme.fonts.numeric, fontWeight: '700' }}>{fmtKwd(channels.callcenterKwd)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 1, backgroundColor: theme.colors.amber }} />
                          <Text style={{ color: theme.colors.text1 }}>Aggregator</Text>
                        </View>
                        <Text style={{ color: theme.colors.text0, fontFamily: theme.fonts.numeric, fontWeight: '700' }}>{fmtKwd(channels.aggregatorKwd)}</Text>
                      </View>
                    </View>
                  </>
                );
              })()}
            </Card>
          </>
        )}

        {/* Payments */}

        <SectionTitle title="Sales by Payment Type" />
        <Card>
          {payments.map(p => (

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
                {fmtKwd(p.kwd)}
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

          ))}
        </Card>


        {/* Top 10 Pharmacies */}
        <SectionTitle title="Top 10 Pharmacies" />

        {topPharm && topPharm.length > 0 ? (
          topPharm.map((p, i) => {
            // console.log(p.id, p.name, p.amtKwd, i); // 👈 Log here

            return (
              <Row
                key={p.id}
                avatar={{
                  initials: String(i + 1).padStart(2, '0'),
                  color: rankColor(i + 1),
                }}
                title={p.name}
                subtitle={`${fmtKwd(p.amtKwd)} · ${period} revenue`}
                amount={fmtKwd(p.amtKwd)}
                delta={{
                  label: '▲ ' + Math.round(8 + i * 0.5) + '%',
                  tone: 'green',
                }}
              />
            );
          })
        ) : (
          <Text style={{ color: theme.colors.text2 }}>
            No pharmacy data available
          </Text>
        )}

        {/* Discount leaderboard */}
        <SectionTitle title="Highest Discount by Pharmacy" rightLabel="Top 10" />
        <Card>
          {discounts.length > 0 && (() => {
            const maxDiscount = Math.max(...discounts.map(d => d.discountKwd), 1);
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
                    {fmtKwdSmallVal(d.discountKwd)} <Text style={styles.discPct}>({fmtPct(d.ratePct)})</Text>
                  </Text>
                </View>
                <View style={styles.discBarBg}>
                  <View style={[styles.discBarFill, { width: `${Math.round((d.discountKwd / maxDiscount) * 100)}%` }]} />
                </View>
              </View>
            ));
          })()}
        </Card>

        {/* Top 10 Categories */}
        <SectionTitle title="Top 10 Categories" />
        <Card>
          {categories.map(c => (
            <View key={c.key} style={styles.payRow2}>
              <Text style={{ color: theme.colors.text0, flex: 1 }}>{c.label}</Text>
              <Text style={{ width: 90, textAlign: 'left', color: theme.colors.text0, fontFamily: theme.fonts.numeric, fontWeight: '700' }}>{fmtKwd(c.kwd)}</Text>
              <Chip label={fmtPct(c.pct, 0)} tone="teal" />
            </View>
          ))}
        </Card>
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
          subtitle: p.id === 'all' ? '29 active branches · default scope' : `${fmtKwd(p.amtKwd)} · weekly revenue`,
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
});
