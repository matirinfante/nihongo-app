// Material 3 — Dark theme — Japan-inspired
export const T = {
  // Backgrounds & surfaces
  bg:         '#141416',
  surface:    '#1E1E22',
  surface2:   '#26262C',
  surface3:   '#2E2E36',
  surfaceHigh:'#36363F',

  // Primary — Vermillion (Japanese 朱色)
  primary:    '#FF6B52',
  primaryDim: 'rgba(255,107,82,0.14)',
  primarySub: 'rgba(255,107,82,0.08)',
  onPrimary:  '#FFFFFF',

  // Secondary — Indigo
  secondary:  '#7C9CFF',
  secondaryDim:'rgba(124,156,255,0.14)',
  onSecondary:'#FFFFFF',

  // Positive
  green:      '#4ADE80',
  greenDim:   'rgba(74,222,128,0.12)',

  // Error
  red:        '#FF6B6B',
  redDim:     'rgba(255,107,107,0.12)',

  // Text
  textPrimary: '#EEEEF2',
  textSecondary: '#9898A8',
  textDisabled:  '#5A5A68',

  // Outline / dividers
  outline:    'rgba(255,255,255,0.08)',
  outlineVar: 'rgba(255,255,255,0.14)',

  // Radius
  r4:  4,
  r8:  8,
  r12: 12,
  r16: 16,
  r20: 20,
  r28: 28,
  rFull: 999,

  // Font stacks
  sans: "'Roboto', 'Noto Sans JP', sans-serif",
  jp:   "'Noto Sans JP', 'Roboto', sans-serif",
  mono: "'Roboto Mono', monospace",
}

// Typography helpers
export const type = {
  displayLg:  { fontSize: 52, fontWeight: 400, letterSpacing: -1.5,  lineHeight: 1.15 },
  displaySm:  { fontSize: 36, fontWeight: 400, letterSpacing: -0.5,  lineHeight: 1.2  },
  headlineLg: { fontSize: 28, fontWeight: 700, letterSpacing: -0.3,  lineHeight: 1.25 },
  headlineSm: { fontSize: 22, fontWeight: 700, letterSpacing: -0.2,  lineHeight: 1.3  },
  titleLg:    { fontSize: 18, fontWeight: 500, letterSpacing: -0.1,  lineHeight: 1.4  },
  titleSm:    { fontSize: 15, fontWeight: 500, letterSpacing: 0,     lineHeight: 1.4  },
  bodyLg:     { fontSize: 16, fontWeight: 400, letterSpacing: 0,     lineHeight: 1.6  },
  bodySm:     { fontSize: 14, fontWeight: 400, letterSpacing: 0,     lineHeight: 1.6  },
  label:      { fontSize: 12, fontWeight: 500, letterSpacing: 0.04,  lineHeight: 1.4  },
  labelSm:    { fontSize: 11, fontWeight: 500, letterSpacing: 0.08,  lineHeight: 1.4  },
  jpLg:       { fontSize: 42, fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 500 },
  jpMd:       { fontSize: 26, fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 400 },
  jpSm:       { fontSize: 18, fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 400 },
}
