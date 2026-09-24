// Design tokens taken from the Competition Details design.
export const colors = {
  primary: '#0E7169',
  primaryDark: '#0A5A54',
  primarySoft: '#E8F3F1',
  primaryBorder: '#CFE5E1',
  referralBg: '#EAF6F0',

  text: '#1B1F22',
  textMuted: '#6B7378',
  textSubtle: '#8E969B',
  border: '#E4EAEA',
  divider: '#EEF2F2',
  background: '#F6F8F8',
  surface: '#FFFFFF',
  chip: '#F1F4F4',
  track: '#E3ECEB',

  gold: '#F2A516',
  silver: '#A5ADB5',
  bronze: '#E8762D',
  danger: '#C23A3A',
  dangerSoft: '#FBECEC',
  warningSoft: '#FFF6E5',
  razorpay: '#0C2451',
  overlay: 'rgba(10, 20, 20, 0.55)',
} as const;

export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 } as const;

export const cardShadow = {
  shadowColor: '#0A2A28',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
} as const;
