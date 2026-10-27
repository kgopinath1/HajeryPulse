import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { theme } from '@theme/index';
import { fmtKwd, fmtPct } from '@utils/format';
import { PanResponder, Text } from 'react-native';

interface Props {
  primary: number[];
  secondary?: number[];
  labels?: string[]; // ✅ months (Jan, Feb, etc.)
  /** Fixed width override. Omit to fill the parent's available width (responsive). */
  width?: number;
  height?: number;
  primaryColor?: string;
  secondaryColor?: string;
  /** How the tooltip shows a value: 'percent' (margin charts) or 'kwd' (revenue charts). */
  valueFormat?: 'percent' | 'kwd';
}

export function MultiSparkline({
  primary,
  secondary = [],
  labels = [],
  width,
  height = 100,
  primaryColor = theme.colors.goldSoft,
  secondaryColor = theme.colors.blue,
  valueFormat = 'percent',
}: Props) {

  const fmtValue = (v: number | undefined) =>
    v == null ? '—' : valueFormat === 'kwd' ? fmtKwd(v) : fmtPct(v);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  const onLayout = (e: { nativeEvent: { layout: { width: number } } }) =>
    setContainerWidth(e.nativeEvent.layout.width);

  // Explicit `width` still wins when a caller wants a fixed size; otherwise
  // fill whatever space the parent card gives us, so the chart matches the
  // card's actual width on both phone and tablet instead of a fixed 330px.
  const chartWidth = width ?? containerWidth;

  if (!primary.length) {
    return (
      <View onLayout={onLayout} style={{ width: '100%' }}>
        {chartWidth > 0 && <Svg width={chartWidth} height={height} />}
      </View>
    );
  }

  if (chartWidth === 0) {
    return <View onLayout={onLayout} style={{ width: '100%', height }} />;
  }

  const w = chartWidth;

  const allValues = [...primary, ...secondary];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const stepX = w / (primary.length - 1 || 1);

  const getPoint = (value: number, i: number) => {
    const x = i * stepX;
    const y = height - ((value - min) / range) * (height - 6) - 3;
    return { x, y };
  };

  const primaryPts = primary.map(getPoint);
  const secondaryPts = secondary.map(getPoint);

  const buildPath = (pts: any[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const primaryPath = buildPath(primaryPts);
  const secondaryPath = buildPath(secondaryPts);
  const areaPath = `${primaryPath} L${w},${height} L0,${height} Z`;

  // The touched index can outlive the data it was taken from (e.g. a 7-point
  // week shrinking to 1 point on a Sunday), so ignore it when out of range.
  const active =
    activeIndex !== null && activeIndex < primaryPts.length ? activeIndex : null;
  const activePt = active !== null ? primaryPts[active] : undefined;

  // Centre the tooltip on the touched point, but keep it inside the chart so
  // the first/last points (x = 0 / x = w) aren't cut off by the screen edge.
  const tooltipLeft = activePt
    ? Math.min(Math.max(activePt.x - tooltipWidth / 2, 0), Math.max(w - tooltipWidth, 0))
    : 0;

  // ✅ touch handler
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;
      const index = Math.round(x / stepX);
      setActiveIndex(Math.max(0, Math.min(index, primary.length - 1)));
    },
    onPanResponderRelease: () => setActiveIndex(null),
    // A parent ScrollView can take over the gesture, in which case Release
    // never fires — clear the highlight here too.
    onPanResponderTerminate: () => setActiveIndex(null),
  });

  return (
    <View onLayout={onLayout} style={{ width: '100%' }} {...panResponder.panHandlers}>

      <Svg width={w} height={height}>

        {/* area */}
        <Path d={areaPath} fill={primaryColor} fillOpacity={0.08} />

        {/* primary */}
        <Path d={primaryPath} stroke={primaryColor} strokeWidth={3} fill="none" />

        {/* secondary */}
        {secondary.length > 0 && (
          <Path
            d={secondaryPath}
            stroke={secondaryColor}
            strokeWidth={2}
            strokeDasharray="4 4"
            fill="none"
          />
        )}

        {/* ✅ active indicator */}
        {activePt && (
          <>
            {/* vertical line */}
            <Line
              x1={activePt.x}
              x2={activePt.x}
              y1={0}
              y2={height}
              stroke="#999"
              strokeDasharray="2 2"
            />

            {/* active dot */}
            <Circle
              cx={activePt.x}
              cy={activePt.y}
              r={5}
              fill={primaryColor}
            />
          </>
        )}
      </Svg>

      {/* ✅ tooltip */}
      {activePt && active !== null && (
        <View
          onLayout={(e) => setTooltipWidth(e.nativeEvent.layout.width)}
          style={{
            position: 'absolute',
            top: -30,
            left: tooltipLeft,
            maxWidth: w,
            backgroundColor: '#111',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
          }}
        >
         <Text style={{ color: '#fff', fontSize: 12 }} numberOfLines={1}>
  {labels[active] || `#${active}`} |{' '}
  {fmtValue(primary[active])}
  {secondary.length > active && (
    <> / {fmtValue(secondary[active])}</>
  )}
</Text>

        </View>
      )}
    </View>
  );
}