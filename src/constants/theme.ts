/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 */

import '@/global.css';

import { Platform } from 'react-native';
import { DewDesign } from './design';

export const Colors = {
  light: {
    text: DewDesign.colors.ink,
    background: DewDesign.colors.canvas,
    backgroundElement: DewDesign.colors.surfaceMuted,
    backgroundSelected: DewDesign.colors.forestSoft,
    textSecondary: DewDesign.colors.body,
  },
  dark: {
    text: DewDesign.colors.darkInk,
    background: DewDesign.colors.darkCanvas,
    backgroundElement: DewDesign.colors.darkSurfaceMuted,
    backgroundSelected: DewDesign.colors.darkForestSoft,
    textSecondary: DewDesign.colors.darkBody,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 60, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
