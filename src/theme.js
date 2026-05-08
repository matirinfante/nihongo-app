// Material 3 — dual theme (dark default, light optional)
export const darkTheme = {
  bg:          '#141416',
  surface:     '#1E1E22',
  surface2:    '#26262C',
  surface3:    '#2E2E36',
  surfaceHigh: '#36363F',
  primary:     '#FF6B52',
  primaryDim:  'rgba(255,107,82,0.14)',
  primarySub:  'rgba(255,107,82,0.08)',
  onPrimary:   '#FFFFFF',
  secondary:   '#7C9CFF',
  secondaryDim:'rgba(124,156,255,0.14)',
  green:       '#4ADE80',
  greenDim:    'rgba(74,222,128,0.12)',
  red:         '#FF6B6B',
  redDim:      'rgba(255,107,107,0.12)',
  textPrimary: '#EEEEF2',
  textSecondary:'#9898A8',
  textDisabled:'#5A5A68',
  outline:     'rgba(255,255,255,0.08)',
  outlineVar:  'rgba(255,255,255,0.14)',
  isDark: true,
}

export const lightTheme = {
  bg:          '#F5F5F7',
  surface:     '#FFFFFF',
  surface2:    '#F0F0F5',
  surface3:    '#E8E8EF',
  surfaceHigh: '#DCDCE8',
  primary:     '#D44B30',
  primaryDim:  'rgba(212,75,48,0.10)',
  primarySub:  'rgba(212,75,48,0.06)',
  onPrimary:   '#FFFFFF',
  secondary:   '#4A6FD4',
  secondaryDim:'rgba(74,111,212,0.12)',
  green:       '#16A34A',
  greenDim:    'rgba(22,163,74,0.10)',
  red:         '#DC2626',
  redDim:      'rgba(220,38,38,0.10)',
  textPrimary: '#111118',
  textSecondary:'#6B6B80',
  textDisabled:'#AAAAB8',
  outline:     'rgba(0,0,0,0.09)',
  outlineVar:  'rgba(0,0,0,0.15)',
  isDark: false,
}

// Shared constants
export const R = { r4:4, r8:8, r10:10, r12:12, r14:14, r16:16, r20:20, r28:28, full:999 }

export const sans = "'Roboto', 'Noto Sans JP', sans-serif"
export const jp   = "'Noto Sans JP', 'Roboto', sans-serif"
export const mono = "'Roboto Mono', monospace"

export const type = {
  displayLg:  { fontSize:52, fontWeight:400, letterSpacing:-1.5, lineHeight:1.15 },
  displaySm:  { fontSize:36, fontWeight:400, letterSpacing:-0.5, lineHeight:1.2  },
  headlineLg: { fontSize:28, fontWeight:700, letterSpacing:-0.3, lineHeight:1.25 },
  headlineSm: { fontSize:22, fontWeight:700, letterSpacing:-0.2, lineHeight:1.3  },
  titleLg:    { fontSize:18, fontWeight:500, letterSpacing:-0.1, lineHeight:1.4  },
  titleSm:    { fontSize:15, fontWeight:500, letterSpacing:0,    lineHeight:1.4  },
  bodyLg:     { fontSize:16, fontWeight:400, letterSpacing:0,    lineHeight:1.6  },
  bodySm:     { fontSize:14, fontWeight:400, letterSpacing:0,    lineHeight:1.6  },
  label:      { fontSize:12, fontWeight:500, letterSpacing:0.04, lineHeight:1.4  },
  labelSm:    { fontSize:11, fontWeight:500, letterSpacing:0.08, lineHeight:1.4  },
  jpXl:       { fontSize:56, fontFamily:jp, fontWeight:700 },
  jpLg:       { fontSize:42, fontFamily:jp, fontWeight:500 },
  jpMd:       { fontSize:26, fontFamily:jp, fontWeight:400 },
  jpSm:       { fontSize:18, fontFamily:jp, fontWeight:400 },
}
