import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { theme } from '@theme/index';

interface Props {
  values: number[];        // e.g. [85, 70, 80, 55, 62, 45, 50, 30]
  width?: number;
  height?: number;
  color?: string;
  fill?:  boolean;
}

/** Inline SVG sparkline. Auto-scales to the min/max of the values. */
export function Sparkline({
  values,
  width = 330,
  height = 100,
  color = theme.colors.teal,
  fill = true,
}: Props): React.JSX.Element {
  if (!values.length) return <Svg width={width} height={height} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1 || 1);

  const pts = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return [x, y] as const;
  });

  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <Svg width={width} height={height}>
      {fill && <Path d={areaPath} fill={color} fillOpacity={0.18} />}
      <Path d={linePath} stroke={color} strokeWidth={2.2} fill="none" />
      <Circle cx={pts[pts.length - 1]![0]} cy={pts[pts.length - 1]![1]} r={4} fill={color} />
    </Svg>
  );
}
