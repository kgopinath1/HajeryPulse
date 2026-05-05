/**
 * Hajery Pulse color palette.
 * Dark premium theme: navy/black surfaces with gold + teal accents.
 * These map 1:1 to the CSS custom properties in the HTML prototype.
 */
export const colors = {
  // Surfaces
  bg0:        '#0a0d14',   // page background
  bg1:        '#0f1320',   // device shell
  surface:    '#141927',   // base card
  surfaceHi:  '#1a2030',   // hover/active card
  border:     'rgba(255,255,255,0.06)',
  borderHi:   'rgba(255,255,255,0.12)',

  // Text
  text0:      '#f4f6fb',
  text1:      '#c7cbd6',
  text2:      '#7a8394',
  text3:      '#4a5063',

  // Accents
  gold:       '#d4af6a',
  goldSoft:   '#e6c98a',
  teal:       '#30e0c4',
  blue:       '#5b8cff',
  purple:     '#9a7cff',
  pink:       '#ff7cae',
  amber:      '#ffb13c',
  green:      '#5fd17a',
  red:        '#ff5c6c',
} as const;

export type ColorKey = keyof typeof colors;
