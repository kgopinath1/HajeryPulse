/**
 * Wholesale & Tender screen.
 * Mirrors the W&T tab in the HTML prototype.
 *
 * Loads the BT filter, summary, margin, sales-quality, org drill-down,
 * top-10 brands, and top-10 customers in parallel on mount and on filter change.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView, Text, View, RefreshControl, ActivityIndicator, StyleSheet,
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
import { Row } from '@components/Row';

import { salesApi } from '@api/sales';
import { defaultAsOfDate } from '@utils/date';
import { fmtKwd, fmtPct, fmtInt, fmtYoy, fmtYoyPp, initials } from '@utils/format';
import {
  BTFilter, WTSummary, MarginAnalysis, SalesQuality,
  OrgNode, TopBrand, TopCustomer,
} from '@types/domain';

export function WholesaleTenderScreen(): React.JSX.Element {
  const [asOfDate, setAsOfDate] = useState<string>(defaultAsOfDate());
  const [bt, setBT]             = useState<BTFilter>('both');

  const [summary, setSummary]   = useState<WTSummary | null>(null);
  const [margin, setMargin]     = useState<MarginAnalysis | null>(null);
  const [quality, setQuality]   = useState<SalesQuality | null>(null);
  const [org, setOrg]           = useState<OrgNode | null>(null);
  const [orgPath, setOrgPath]   = useState<string[]>(['root']);
  const [brands, setBrands]     = useState<TopBrand[]>([]);
  const [customers, setCustomers] = useState<TopCustomer[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const parent = orgPath[orgPath.length - 1] ?? 'root';
      const [s, m, q, o, b, c] = await Promise.all([
        salesApi.summary(asOfDate, bt),
        salesApi.margin(asOfDate, bt),
        salesApi.quality(asOfDate, bt),
        salesApi.org(asOfDate, bt, parent),
        salesApi.topBrands(asOfDate, bt),
        salesApi.topCustomers(asOfDate, bt),
      ]);
      setSummary(s); setMargin(m); setQuality(q);
      setOrg(o); setBrands(b); setCustomers(c);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [asOfDate, bt, orgPath]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const onDrill = (key: string) => setOrgPath(prev => [...prev, key]);
  const onUpToBreadcrumb = (i: number) => setOrgPath(prev => prev.slice(0, i + 1));

  if (loading && !summary) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={theme.colors.gold} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.gold} />}
      >
        <View style={styles.header}>
          <Text style={styles.h2}>Wholesale &amp; Tender</Text>
          <Text style={styles.subhead}>Healthcare · FMCG · P&amp;C</Text>
        </View>

        <AsOnDateBar asOfDate={asOfDate} onPress={() => { /* TODO date picker */ }} />

        {/* BT filter */}
        <SegTabs<BTFilter>
          value={bt}
          onChange={setBT}
          options={[
            { key: 'both',      label: 'Both' },
            { key: 'wholesale', label: 'Wholesale' },
            { key: 'tender',    label: 'Tender' },
          ]}
        />

        {/* Revenue card */}
        {summary && (
          <Card>
            <Text style={styles.eyebrow}>REVENUE · WEEK TO DATE</Text>
            <Text style={styles.heroValue}>{fmtKwd(summary.revenue.kwd)}</Text>
            <View style={{ marginTop: 4, flexDirection: 'row' }}>
              <Chip label={fmtYoy(summary.revenue.wow) + ' WoW'} tone={summary.revenue.wow >= 0 ? 'green' : 'red'} />
            </View>
            <View style={{ marginTop: 12 }}>
              <Sparkline values={summary.spark} height={120} color={theme.colors.gold} />
            </View>
          </Card>
        )}

        {/* KPI grid */}
        {summary && (
          <View style={styles.kpiGrid}>
            <KpiTile label="New orders" value={fmtInt(summary.kpis.newOrders)} delta={{ value: '6.4%', positive: true }} />
            <KpiTile label="Open order value" value={fmtKwd(summary.kpis.openOrderValueKwd)} delta={{ value: '4.1%', positive: true }} />
            <KpiTile label="Active tenders" value={String(summary.kpis.activeTenders)} chip={{ label: 'KWD 4.2M pipeline', tone: 'blue' }} />
            <KpiTile label="Avg. tender value" value={fmtKwd(summary.kpis.avgTenderValueKwd)} delta={{ value: '8.4%', positive: true }} />
          </View>
        )}

        {/* Margin Analysis */}
        {margin && (
          <>
            <SectionTitle title="Margin Analysis" rightLabel={btLabel(bt)} />
            <Card>
              <Text style={styles.eyebrow}>GROSS MARGIN %</Text>
              <Text style={[styles.heroValue, { color: theme.colors.goldSoft }]}>{fmtPct(margin.marginPct)}</Text>
              <Text style={styles.subtle}>vs {fmtPct(margin.marginPctLY)} last year</Text>
              <View style={{ marginTop: 8 }}>
                <Chip label={fmtYoyPp(margin.marginYoyPp) + ' YoY'} tone={margin.marginYoyPp >= 0 ? 'green' : 'red'} />
              </View>
              <View style={styles.kpiGridInner}>
                <KpiTile label="Net sales"     value={fmtKwd(margin.netSalesKwd)}    delta={{ value: '11.2%', positive: true }} />
                <KpiTile label="Cost of sales" value={fmtKwd(margin.cogsKwd)}        delta={{ value: '9.8%',  positive: false }} />
                <KpiTile label="Gross margin"  value={fmtKwd(margin.grossMarginKwd)} delta={{ value: '14.6%', positive: true }} />
                <KpiTile label="YoY deviation" value={fmtYoyPp(margin.marginYoyPp)} />
              </View>
            </Card>
          </>
        )}

        {/* Sales Quality */}
        {quality && (
          <>
            <SectionTitle title="Sales Quality" rightLabel={btLabel(bt)} />
            <Card>
              <Text style={styles.eyebrow}>GROSS → NET</Text>
              <Text style={styles.heroValue}>{fmtKwd(quality.netKwd)}</Text>
              <Text style={styles.subtle}>{fmtPct(quality.netPct)} of gross retained</Text>
              <View style={{ marginTop: 12 }}>
                <StackedBar
                  segments={[
                    { pct: quality.netPct,            color: theme.colors.teal },
                    { pct: quality.cancellationsPct,  color: theme.colors.amber },
                    { pct: quality.returnsPct,        color: theme.colors.red },
                  ]}
                />
              </View>
              <View style={{ marginTop: 12, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <Chip label={`Returns ${fmtPct(quality.returnsPct)}`} tone="red" />
                <Chip label={`Cancellations ${fmtPct(quality.cancellationsPct)}`} tone="amber" />
              </View>
            </Card>
          </>
        )}

        {/* Org structure drill-down */}
        {org && (
          <>
            <SectionTitle title="By Org Structure" rightLabel={btLabel(bt)} />
            <Card>
              <Text style={styles.eyebrow}>{org.level.toUpperCase()}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginBottom: 10 }}>
                {orgPath.map((k, i) => (
                  <Text key={k} onPress={() => onUpToBreadcrumb(i)} style={[styles.crumb, i === orgPath.length - 1 && styles.crumbCurrent]}>
                    {k === 'root' ? 'Group' : k} {i < orgPath.length - 1 ? '› ' : ''}
                  </Text>
                ))}
              </View>
              {org.children.map(child => (
                <Row
                  key={child.key}
                  title={`${child.code} · ${child.name}`}
                  subtitle={child.hasChildren ? 'Tap to drill down' : 'Department'}
                  amount={fmtKwd(child.amtW + child.amtT)}
                  delta={{ label: fmtYoy(child.yoy) + ' YoY', tone: child.yoy >= 0 ? 'green' : 'red' }}
                />
              ))}
            </Card>
          </>
        )}

        {/* Top 10 Brands */}
        <SectionTitle title="Top 10 Brands" />
        {brands.map(b => (
          <Row
            key={b.brand}
            avatar={{ initials: String(b.rank).padStart(2, '0'), color: rankColor(b.rank) }}
            title={b.brand}
            subtitle={b.segment}
            amount={fmtKwd(b.amountKwd)}
            delta={{ label: fmtYoy(b.yoyPct), tone: b.yoyPct >= 0 ? 'green' : 'red' }}
          />
        ))}

        {/* Top 10 Customers */}
        <SectionTitle title="Top 10 Customers" />
        {customers.map(c => (
          <Row
            key={c.customer}
            avatar={{ initials: initials(c.customer), color: rankColor(c.rank) }}
            title={c.customer}
            subtitle={`${c.type} · ${c.ordersThisWeek} orders`}
            amount={fmtKwd(c.amountKwd)}
            delta={{ label: fmtYoy(c.yoyPct), tone: c.yoyPct >= 0 ? 'green' : 'red' }}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function btLabel(bt: BTFilter): string {
  return bt === 'both' ? 'All channels' : bt === 'wholesale' ? 'Wholesale only' : 'Tender only';
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
  header: { marginBottom: 14 },
  h2: { fontSize: 22, fontWeight: '700', color: theme.colors.text0 },
  subhead: { fontSize: 12, color: theme.colors.text2, marginTop: 2 },
  eyebrow: {
    fontSize: 11, color: theme.colors.text2,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  heroValue: {
    fontFamily: theme.fonts.numeric,
    fontSize: 28, fontWeight: '700', color: theme.colors.text0, marginTop: 4, letterSpacing: -0.5,
  },
  subtle: { fontSize: 11, color: theme.colors.text2, marginTop: 4 },
  kpiGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  kpiGridInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  crumb:       { fontSize: 11, color: theme.colors.text2, marginRight: 4 },
  crumbCurrent:{ color: theme.colors.gold, fontWeight: '700' },
});
