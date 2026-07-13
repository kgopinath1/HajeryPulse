/**
 * Wholesale & Tender screen.
 * Mirrors the W&T tab in the HTML prototype.
 *
 * Loads the BT filter, summary, margin, sales-quality, org drill-down,
 * top-10 brands, and top-10 customers in parallel on mount and on filter change.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView, Text, View, RefreshControl, ActivityIndicator, StyleSheet, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@theme/index';
import { Card } from '@components/Card';
import { Chip } from '@components/Chip';
import { KpiTile } from '@components/KpiTile';
import { SectionTitle } from '@components/SectionTitle';
import { AsOnDateModal } from '@components/AsOnDateModal';
import { SegTabs } from '@components/SegTabs';
import { Sparkline } from '@components/Sparkline';
import { StackedBar } from '@components/StackedBar';
import { AsOnDateBar } from '@components/AsOnDateBar';
import { Row } from '@components/Row';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { NoDataCard } from '@components/NoDataCard';
import { salesApi } from '@api/sales';
import { defaultAsOfDate } from '@utils/date';
import { getTrendLabels, getPeriodLabel, btLabel } from '@utils/labels';
import { MultiSparkline } from '@components/MultiSparkline';
import { fmtKwd, fmtPct, fmtInt, fmtYoy, fmtYoyPp, initials, fmtKwdAsIs } from '@utils/format';
import {
  BTFilter, WTSummary, MarginAnalysis, SalesQuality,
  OrgNode, TopBrand, TopCustomer,
} from '@types/domain';

export function WholesaleTenderScreen(): React.JSX.Element {
  const [asOfDate, setAsOfDate] = useState<string>(defaultAsOfDate());
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [bt, setBT] = useState<BTFilter>('both');
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'ytd'>('week');
  const [summary, setSummary] = useState<WTSummary | null>(null);
  const [margin, setMargin] = useState<MarginAnalysis | null>(null);
  const [quality, setQuality] = useState<SalesQuality | null>(null);
  const [org, setOrg] = useState<OrgNode | null>(null);
  const [orgPath, setOrgPath] = useState<string[]>(['root']);
  const [brands, setBrands] = useState<TopBrand[]>([]);
  const [customers, setCustomers] = useState<TopCustomer[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const parent = orgPath[orgPath.length - 1] ?? 'root';
      const [s, m, q, o, b, c] = await Promise.all([
        salesApi.summary(asOfDate, bt, period),
        salesApi.margin(asOfDate, bt,period),
        salesApi.quality(asOfDate, bt, period),
        salesApi.org(asOfDate, bt, parent,period),
        salesApi.topBrands(asOfDate, bt, period,10,parent),
        salesApi.topCustomers(asOfDate, bt, period,10,parent),
      ]);
      setSummary(s); setMargin(m); setQuality(q);
      setOrg(o); setBrands(b); setCustomers(c);
      console.log('=== SALES API RESPONSES ===', { s, m, q, o, b, c });
      console.log(period)
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [asOfDate, bt, orgPath, period]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };
  const periodLabel = getPeriodLabel(period);
  const onDrill = (key: string) => setOrgPath(prev => [...prev, key]);
  const onUpToBreadcrumb = (i: number) => setOrgPath(prev => prev.slice(0, i + 1));


  const hasData =
  (summary?.revenue?.kwd ?? 0) > 0 ||
  (summary?.kpis?.newOrders ?? 0) > 0 ||

  (margin && (margin.netSalesKwd ?? 0) > 0) ||

  (quality && (quality.grossKwd ?? 0) > 0) ||

  (org && org.children?.some(c => (c.total ?? 0) > 0)) ||

  brands.some(b => (b.amountKwd ?? 0) > 0) ||

  customers.some(c => (c.amountKwd ?? 0) > 0);

const showNoData = !loading && !hasData;


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





        {/* Date Picker */}
        <AsOnDateBar
          asOfDate={asOfDate}
          onPress={() => setDateModalVisible(true)}
        />

        {/* BT filter */}
        <SegTabs<BTFilter>
          value={bt}
          onChange={setBT}
          options={[
            {
              key: 'both',
              label: 'Both',
              icon: (
                <Ionicons
                  name="link-outline"
                  size={14}
                  color={bt === 'both' ? theme.colors.gold : theme.colors.text2}
                />
              ),
            },
            {
              key: 'wholesale',
              label: 'Wholesale',
              icon: (
                <Ionicons
                  name="layers-outline"
                  size={14}
                  color={bt === 'wholesale' ? theme.colors.gold : theme.colors.text2}
                />
              ),
            },
            {
              key: 'tender',
              label: 'Tender',
              icon: (
                <Ionicons
                  name="checkbox-outline"
                  size={14}
                  color={bt === 'tender' ? theme.colors.gold : theme.colors.text2}
                />
              ),
            },
          ]}
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
<SectionTitle title="Revenue" />
{summary ? (
  <Card>
    <Text style={styles.eyebrow}>REVENUE · {period.toUpperCase()}  TO DATE</Text>
    <Text style={styles.heroValue}>{fmtKwd(summary.revenue.kwd)}</Text>
    <View style={{ marginTop: 4, flexDirection: 'row' }}>
      <Chip label={fmtYoy(summary.revenue.wow, summary.revenue.growthType)} tone={summary.revenue.wow >= 0 ? 'green' : 'red'} />
    </View>

    {period !== 'day' && (
      <View style={{ marginTop: 12 }}>
        <MultiSparkline
          primary={summary.spark ?? []}
          secondary={summary.sparkLY ?? []}
          primaryColor={theme.colors.goldSoft}
          secondaryColor={theme.colors.blue}
          labels={getTrendLabels(period, summary.spark?.length ?? 0)}
          height={120}
        />
        <View style={styles.marginLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.goldSoft }]} />
            <Text style={styles.legendText}>Current Period</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.blue }]} />
            <Text style={styles.legendText}>Last Period</Text>
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
    <KpiTile
      label="Total Orders"
      value={fmtInt(summary.kpis.newOrders)}
      delta={{ value: `${summary.revenue.wow?.toFixed(1) || 0}%`, positive: summary.revenue.wow >= 0 }} />
    <KpiTile label="Avg. order value" value={fmtKwdAsIs(summary.kpis.avgOrderValueKwd)} delta={{
      value: `${summary.kpis.avgOrderValuePct?.toFixed(1)}%`,
      positive: summary.kpis.avgOrderValuePct >= 0
    }} />
    <KpiTile label="Active tenders" value={String(summary.kpis.activeTenders)} chip={{
      label: `${fmtKwd(summary.kpis.pipelineAmount)} pipeline`,
      tone: 'blue'
    }} />
    <KpiTile label="Avg. tender value" value={fmtKwd(summary.kpis.avgTenderValueKwd)}
      delta={{ value: `${summary.kpis.avgTenderValuePct?.toFixed(1) || 0}%`, positive: summary.kpis.avgTenderValuePct >= 0 }} />
  </View>
) : (
  <Card>
    <Text style={styles.emptyText}>No KPI data available</Text>
  </Card>
)}

      {/* Margin Analysis */}
<SectionTitle title="Margin Analysis" rightLabel={btLabel(bt)} />
{margin ? (
  <Card>
    <Text style={styles.eyebrow}>GROSS MARGIN % - {period} DATA</Text>
    <Text style={[styles.heroValue, { color: theme.colors.goldSoft }]}>{fmtPct(margin.marginPct)}</Text>
    <View style={styles.marginHeaderRow}>
      <Text style={styles.subtle}>vs {fmtPct(margin.marginPctLY)} last period selected</Text>
      <Chip label={`${fmtYoyPp(margin.marginYoyPp)} ${periodLabel}`} tone={margin.marginYoyPp >= 0 ? 'green' : 'red'} />
    </View>

    {period !== 'day' && (
      <View style={styles.marginTrend}>
        <MultiSparkline
          primary={margin.trend12mo ?? []}
          secondary={margin.trend12moLY ?? []}
          primaryColor={theme.colors.goldSoft}
          secondaryColor={theme.colors.blue}
          labels={getTrendLabels(period, margin.trend12mo?.length ?? 0)}
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
      <KpiTile label="Net sales" value={fmtKwd(margin.netSalesKwd)} delta={{
        value: (
          <>
            <Text style={{ color: margin.salesYoyPct >= 0 ? theme.colors.green : theme.colors.red }}>{fmtPct(margin.salesYoyPct)}</Text>
            <Text style={{ color: theme.colors.text2 }}> {periodLabel}</Text>
          </>
        ),
        positive: margin.salesYoyPct >= 0,
      }} />

      <KpiTile label="Cost of sales" value={fmtKwd(margin.cogsKwd)} delta={{
        value: (
          <>
            <Text style={{ color: margin.cogsYoyPct >= 0 ? theme.colors.green : theme.colors.red }}>{fmtPct(margin.cogsYoyPct)}</Text>
            <Text style={{ color: theme.colors.text2 }}> {periodLabel}</Text>
          </>
        ),
        positive: margin.cogsYoyPct >= 0,
      }} />

      <KpiTile label="Gross margin" value={fmtKwd(margin.grossMarginKwd)} delta={{
        value: (
          <>
            <Text style={{ color: margin.grossMarginYoyPct >= 0 ? theme.colors.green : theme.colors.red }}>{fmtPct(margin.grossMarginYoyPct)}</Text>
            <Text style={{ color: theme.colors.text2 }}> {periodLabel}</Text>
          </>
        ),
        positive: margin.grossMarginYoyPct >= 0,
      }} />

      <KpiTile
        label={`${periodLabel} deviation`}
        value={fmtYoyPp(margin.marginYoyPp)}
        valueColor={
          margin.marginYoyPp > 0
            ? theme.colors.green
            : margin.marginYoyPp < 0
              ? theme.colors.red
              : theme.colors.text2
        }
        subtitle={
          margin.marginYoyPp > 0
            ? 'Margin expansion'
            : margin.marginYoyPp < 0
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
       <SectionTitle title="Sales Quality" rightLabel={btLabel(bt)} />
{quality ? (
  <Card>
    <Text style={styles.eyebrow}>GROSS → NET</Text>
    <View style={styles.marginHeaderRow}>
      <View>
        <Text style={styles.heroValue}>{fmtKwd(quality.netKwd)}</Text>
        <Text style={styles.subtle}>
          {fmtPct(quality.netPct)} of gross retained
        </Text>
      </View>
      <Chip
        label={`${fmtYoyPp(quality.netPctDelta)} ${periodLabel}`}
        tone={quality.netPctDelta >= 0 ? 'green' : 'red'}
      />
    </View>

    <View style={{ marginTop: 16, gap: 12 }}>
      <View style={styles.qualityRow}>
        <Text style={styles.qualityLabel}>Gross sales</Text>
        <View style={styles.qualityBar}>
          <View style={[styles.qualityFill, { width: '100%', backgroundColor: theme.colors.goldSoft }]} />
        </View>
        <Text style={styles.qualityValue}>{fmtKwd(quality.grossKwd)}</Text>
      </View>

      <View style={styles.qualityRow}>
        <Text style={[styles.qualityLabel, { color: theme.colors.red }]}>Sales returns</Text>
        <View style={styles.qualityBar}>
          <View style={[styles.qualityFill, { width: `${quality.returnsPct}%`, backgroundColor: theme.colors.red }]} />
        </View>
        <Text style={[styles.qualityValue, { color: theme.colors.red }]}>{fmtKwd(quality.returnsKwd)}</Text>
      </View>

      <View style={styles.qualityRow}>
        <Text style={[styles.qualityLabel, { color: theme.colors.teal }]}>Net sales</Text>
        <View style={styles.qualityBar}>
          <View style={[styles.qualityFill, { width: `${quality.netPct}%`, backgroundColor: theme.colors.teal }]} />
        </View>
        <Text style={[styles.qualityValue, { color: theme.colors.teal }]}>{fmtKwd(quality.netKwd)}</Text>
      </View>
    </View>

    <View style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
      <Chip
        label={`Returns ${fmtPct(quality.returnsPct)} of gross`}
        tone={quality.returnsPct > 0 ? 'red' : 'green'}
      />
      <Chip
        label={`${fmtYoyPp(quality.returnsPctDelta)} returns ${periodLabel}`}
        tone={quality.returnsPctDelta <= 0 ? 'green' : 'red'}
      />
    </View>
  </Card>
) : (
  <Card>
    <Text style={styles.emptyText}>No sales quality data available</Text>
  </Card>
)}
        {/* Org structure drill-down */}

<SectionTitle title="By Org Structure" rightLabel={btLabel(bt)} />
{org ? (
  <Card>
    <Text style={styles.eyebrow}>{org.level?.toUpperCase()}</Text>

    <View style={styles.breadcrumbWrap}>
      {orgPath.map((k, i) => (
        <Text
          key={k}
          onPress={() => onUpToBreadcrumb(i)}
          style={[styles.crumb, i === orgPath.length - 1 && styles.crumbCurrent]}
        >
          {k === 'root' ? 'Group' : k}
          {i < orgPath.length - 1 ? ' › ' : ''}
        </Text>
      ))}
    </View>

    {org.children && org.children.length > 0 ? (
      org.children.map((child) => {
        const total = child.total;
        const share = child.sharePct;

        return (
          <TouchableOpacity
            key={child.key}
            activeOpacity={child.hasChildren ? 0.7 : 1}
            onPress={() => child.hasChildren && onDrill(child.key)}
            style={styles.rowCard}
          >
            <View style={styles.rowTop}>
              <View style={styles.rowLeft}>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeText}>{child.key}</Text>
                </View>
                <Text style={styles.title}>{child.name}</Text>
                {child.hasChildren && <Text style={styles.chevron}>›</Text>}
              </View>
              <Text style={styles.amount}>{fmtKwdAsIs(total)}</Text>
            </View>

            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#34D399', '#22D3EE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${Math.min(Math.max(share, 0), 100)}%` }]}
              />
            </View>

            <View style={styles.rowBottom}>
              <Text style={styles.shareText}>{share.toFixed(1)}% share</Text>
              <Text style={[styles.yoy, { color: child.yoyPct >= 0 ? theme.colors.green : theme.colors.red }]}>
                {fmtYoy(child.yoyPct)} {child.growthType}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })
    ) : (
      <Text style={styles.emptyText}>No org breakdown available for this level</Text>
    )}
  </Card>
) : (
  <Card>
    <Text style={styles.emptyText}>No org structure data available</Text>
  </Card>
)}


       {/* Top 10 Brands */}
<SectionTitle title="Top 10 Brands" />
<Card>
  {brands.length > 0 ? (
    brands.map(b => (
      <Row
        key={b.brandCode}
        avatar={{ initials: String(b.rank).padStart(2, '0'), color: rankColor(b.rank) }}
        title={b.brand}
        subtitle={b.segment}
        amount={fmtKwdAsIs(b.amountKwd)}
        delta={{ label: fmtYoy(b.yoyPct), tone: b.yoyPct >= 0 ? 'green' : 'red' }}
      />
    ))
  ) : (
    <Text style={styles.emptyText}>No brand data available</Text>
  )}
</Card>

       {/* Top 10 Customers */}
<SectionTitle title="Top 10 Customers" />
<Card>
  {customers.length > 0 ? (
    customers.map(c => (
      <Row
        key={c.customer}
        avatar={{ initials: String(c.rank).padStart(2, '0'), color: rankColor(c.rank) }}
        title={c.customer}
        subtitle={`${c.type} · ${c.ordersThisPeriod} orders`}
        amount={fmtKwdAsIs(c.amountKwd)}
        delta={{ label: fmtYoy(c.yoyPct), tone: c.yoyPct >= 0 ? 'green' : 'red' }}
      />
    ))
  ) : (
    <Text style={styles.emptyText}>No customer data available</Text>
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
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  kpiGridInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  marginHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },

  crumb: { fontSize: 11, color: theme.colors.text2, marginRight: 4 },
  crumbCurrent: { color: theme.colors.gold, fontWeight: '700' },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
emptyText: {
  color: theme.colors.text2,
  fontSize: theme.fontSize.sm,
  textAlign: 'center',
  paddingVertical: theme.spacing.lg,
},
  qualityLabel: {
    width: 95,
    fontSize: 12,
    color: theme.colors.text1,
  },

  qualityBar: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.bg2,
    overflow: 'hidden',
    marginHorizontal: 10,
  },

  qualityFill: {
    height: '100%',
    borderRadius: 999,
  },

  codeBadge: {
    backgroundColor: '#3A3320',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10
  },

  codeText: {
    color: '#FACC15',
    fontSize: 11,
    fontWeight: '600'
  },

  qualityValue: {
    width: 80,
    textAlign: 'right',
    fontWeight: '700',
    color: theme.colors.text0,
  },
  marginTrend: {
    marginTop: 16,
    marginBottom: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
  },

  marginLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 6,
  },

  legendText: {
    color: theme.colors.text2,
    fontSize: 11,
  },

  breadcrumbWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    marginBottom: 12,
  },
  rowCard: {
    backgroundColor: theme.colors.bg1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankBadge: {
    backgroundColor: theme.colors.bg2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  rankText: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    color: theme.colors.text0,
    fontWeight: '600',
    fontSize: 14,
  },


  chevron: {
    color: '#6B7280',
    fontSize: 18,
    marginLeft: 6
  },

  deptTag: {
    color: theme.colors.text2,
    fontSize: 11,
    marginTop: 2,
  }, amount: {
    color: theme.colors.text0,
    fontWeight: '700',
  },
  progressTrack: {
    height: 4,
    backgroundColor: theme.colors.bg2,
    borderRadius: 4,
    marginTop: 8,
    overflow: 'hidden',
  },

  progressFill: {
    height: 4,
    backgroundColor: theme.colors.teal,
    borderRadius: 4,
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },





  shareText: {
    color: theme.colors.text2,
    fontSize: 12,
  },


  shareSub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2
  },


  yoy: {
    fontSize: 12,
    fontWeight: '600',
  },



});
