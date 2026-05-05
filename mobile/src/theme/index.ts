import { colors } from './colors';
import { fonts, fontSize, fontWeight } from './typography';
import { spacing, radius } from './spacing';

export const theme = {
  colors,
  fonts,
  fontSize,
  fontWeight,
  spacing,
  radius,
} as const;

export type Theme = typeof theme;
export { colors, fonts, fontSize, fontWeight, spacing, radius };
