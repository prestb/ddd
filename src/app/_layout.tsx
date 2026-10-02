import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';

import { DevotionalProvider } from '@/context/devotional-context';
import { ContentProvider } from '@/context/content-context';
import { SettingsProvider, useSettings } from '@/context/settings-context';
import { AuthProvider } from '@/context/auth-context';
import { StatusBar } from 'expo-status-bar';

export default function TabLayout() {
  return <AuthProvider><SettingsProvider><DevotionalProvider><ContentProvider><ThemedRouter /></ContentProvider></DevotionalProvider></SettingsProvider></AuthProvider>;
}

function ThemedRouter() {
  const { themeMode } = useSettings();
  const isDark = themeMode === 'dark';
  return <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}><StatusBar style={isDark ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false }} /></ThemeProvider>;
}
