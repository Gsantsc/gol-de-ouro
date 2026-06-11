export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48
} as const;

export const layout = {
  mobileGutter: spacing[4],
  desktopGutter: spacing[8],
  maxContent: 1280,
  bottomNavHeight: 72
} as const;
