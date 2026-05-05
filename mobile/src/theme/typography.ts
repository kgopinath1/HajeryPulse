/**
 * Typography tokens — match the prototype's two-font system:
 *   Inter for body text, Space Grotesk for numbers (KWD amounts, percentages).
 *
 * On iOS we lean on system fonts (San Francisco) where the variable fonts aren't
 * registered; React Native auto-falls-back. For production, register the actual
 * Inter and Space Grotesk font files in ios/HajeryPulse/Info.plist and
 * android/app/src/main/assets/fonts.
 */
import { Platform } from 'react-native';

export const fonts = {
  body:    Platform.select({ ios: 'Inter', android: 'Inter', default: 'System' })!,
  numeric: Platform.select({ ios: 'Space Grotesk', android: 'SpaceGrotesk-Bold', default: 'System' })!,
};

export const fontSize = {
  xs:   10,
  sm:   11,
  md:   12,
  base: 13,
  lg:   14,
  xl:   18,
  xxl:  22,
  hero: 28,
  display: 30,
} as const;

export const fontWeight = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
} as const;
