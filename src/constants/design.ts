export const DewDesign = {
  colors: {
    // Light Mode Canvas & Surfaces
    canvas: '#F6F3EC',
    surface: '#FFFFFF',
    surfaceMuted: '#EDEAE1',
    surfaceElevated: '#FFFFFF',

    // Dark Mode Canvas & Surfaces
    darkCanvas: '#141E18',
    darkSurface: '#1D2A22',
    darkSurfaceMuted: '#27382E',
    darkSurfaceElevated: '#304438',

    // Primary Accents
    forest: '#2C4A38',
    forestMuted: '#3D614B',
    forestSoft: '#E2EBE2',
    darkForestSoft: '#2B3D31',

    terracotta: '#BA663B',
    terracottaSoft: '#F6E8DF',
    darkTerracottaSoft: '#3D281F',

    brass: '#C29B48',
    brassSoft: '#F8F1DF',
    darkBrassSoft: '#39301B',

    // Ink & Text Neutral
    ink: '#1A241E',
    body: '#525E56',
    muted: '#818C84',
    line: '#E2DEC3',
    white: '#FFFFFF',

    darkInk: '#F5F1E9',
    darkBody: '#D0D8D1',
    darkMuted: '#9EA8A0',
    darkLine: '#33483B',
  },
  radius: {
    xs: 6,
    sm: 10,
    control: 12,
    card: 18,
    feature: 24,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    screen: 22,
    section: 26,
  },
  shadows: {
    subtle: {
      shadowColor: '#1A241E',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    card: {
      shadowColor: '#1A241E',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    floating: {
      shadowColor: '#1A241E',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
      elevation: 8,
    },
  },
} as const;
