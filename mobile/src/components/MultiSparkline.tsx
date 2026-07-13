import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { theme } from '@theme/index';
import { PanResponder, Text } from 'react-native';

interface Props {
  primary: number[];
  secondary?: number[];
  labels?: string[]; // ✅ months (Jan, Feb, etc.)
  width?: number;
  height?: number;
  primaryColor?: string;
  secondaryColor?: string;
}

export function MultiSparkline({
  primary,
  secondary = [],
  labels = [],
  width = 330,
  height = 100,
  primaryColor = theme.colors.goldSoft,
  secondaryColor = theme.colors.blue,
}: Props) {

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!primary.length) return <Svg width={width} height={height} />;

  const allValues = [...primary, ...secondary];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const stepX = width / (primary.length - 1 || 1);

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
  const areaPath = `${primaryPath} L${width},${height} L0,${height} Z`;

  // ✅ touch handler
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;
      const index = Math.round(x / stepX);
      setActiveIndex(Math.max(0, Math.min(index, primary.length - 1)));
    },
    onPanResponderRelease: () => setActiveIndex(null),
  });

  return (
    <View {...panResponder.panHandlers}>

      <Svg width={width} height={height}>

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
        {activeIndex !== null && (
          <>
            {/* vertical line */}
            <Line
              x1={primaryPts[activeIndex].x}
              x2={primaryPts[activeIndex].x}
              y1={0}
              y2={height}
              stroke="#999"
              strokeDasharray="2 2"
            />

            {/* active dot */}
            <Circle
              cx={primaryPts[activeIndex].x}
              cy={primaryPts[activeIndex].y}
              r={5}
              fill={primaryColor}
            />
          </>
        )}
      </Svg>

      {/* ✅ tooltip */}
      {activeIndex !== null && (
        <View
          style={{
            position: 'absolute',
            top: -30,
            left: primaryPts[activeIndex].x - 40,
            backgroundColor: '#111',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
          }}
        >
         <Text style={{ color: '#fff', fontSize: 12 }}>
  {labels[activeIndex] || `#${activeIndex}`} |{' '}
  {primary[activeIndex]?.toFixed(1)}% 
  {secondary.length > activeIndex && (
    <> / {secondary[activeIndex]?.toFixed(1)}%</>
  )}
</Text>

        </View>
      )}
    </View>
  );
}