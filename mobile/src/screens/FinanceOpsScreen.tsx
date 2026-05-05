/**
 * Finance & Ops dashboard.
 * Margin donut, AR/AP days, working capital, ops KPIs.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

import { theme } from '@theme/index';
import { Card } from '@components/Card';
import { KpiTile } from '@components/KpiTile';
import { SectionTitle } from '@components/SectionTitle';
import { AsOnDateBar } from '@components/AsOnDateBar';
import { financeApi, FinanceHealth, OpsSummary } from '@api/finance';
import { defaultAsOfDate } from '@utils/date';
import { fmtKwd, fmtPct, fmtInt } from '@utils/format';

export function FinanceOpsScreen(): React.JSX.Element {
  const [asOfDate] = useState(defaultAsOfDate());
  const [health, setHealth] = useState<FinanceHealth | null>(null);
  const [ops, setOps]       = useState<OpsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([financeApi.health(asOfDate), financeApi.ops(asOfDate)])
      .then(([h, o]) => { setHealth(h); setOps(o); })
      .finally(() => setLoading(false));
  }, [asOfDate]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={theme.colors.gold} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h2}>Finance &amp; Ops</Text>
        <Text style={styles.subhead}>Margin · AR/AP · SLA</Text>

        <AsOnDateBar asOfDate={asOfDate} />

        {/* Donut */}
        {health && (
          <>
            <SectionTitle title="Financial Health" rightLabel="Details" />
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Donut pct={health.grossMarginPct} />
                <View style={{ flex: 1 }}>
                  <KpiRow label="Target"   value={fmtPct(health.targetPct)} />
                  <KpiRow label="Previous" value={fmtPct(health.previousPct)} />
                  <KpiRow label="Cash"     value={fmtKwd(health.cashOnHandKwd)} />
                </View>
              </View>
              <View style={styles.kpiGrid}>
                <KpiTile label="AR days"          value={String(health.arDaysOutstanding) + 'd'} />
                <KpiTile label="AP days"          value={String(health.apDaysOutstanding) + 'd'} />
                <KpiTile label="Working capital"  value={fmtKwd(health.workingCapitalKwd)} />
                <KpiTile label="Cash on hand"     value={fmtKwd(health.cashOnHandKwd)} />
              </View>
            </Card>
          </>
        )}

        {/* Ops */}
        {ops && (
          <>
            <SectionTitle title="Operations" />
            <View style={styles.kpiGrid}>
              <KpiTile label="Fill rate"      value={fmtPct(ops.fillRatePct)} delta={{ value: '0.6 pp', positive: true }} />
              <KpiTile label="SLA compliance" value={fmtPct(ops.slaCompliancePct)} delta={{ value: '1.2 pp', positive: true }} />
              <KpiTile label="Avg dispatch"   value={`${ops.avgDispatchHours.toFixed(1)}h`} />
              <KpiTile label="Open tickets"   value={fmtInt(ops.openServiceTickets)} delta={{ value: '4', positive: false }} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Donut({ pct }: { pct: number }): React.JSX.Element {
  const r = 44, c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <Svg width={110} height={110}>
      <Circle cx={55} cy={55} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={14} />
      <Circle cx={55} cy={55} r={r} fill="none" stroke={theme.colors.gold} strokeWidth={14}
        strokeDasharray={`${c} ${c}`} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 55 55)"
      />
      <SvgText x={55} y={52} textAnchor="middle" fill={theme.colors.text0} fontFamily="Space Grotesk" fontSize={18} fontWeight="700">
        {fmtPct(pct)}
      </SvgText>
      <SvgText x={55} y={68} textAnchor="middle" fill={theme.colors.text2} fontSize={9}>gross margin</SvgText>
    </Svg>
  );
}

function KpiRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ color: theme.colors.text2, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: theme.colors.text0, fontWeight: '600', fontSize: 12 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.colors.bg0 },
  center: { flex: 1, backgroundColor: theme.colors.bg0, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 14, paddingBottom: 80 },
  h2:      { fontSize: 22, fontWeight: '700', color: theme.colors.text0 },
  subhead: { fontSize: 12, color: theme.colors.text2, marginTop: 2, marginBottom: 14 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
});
