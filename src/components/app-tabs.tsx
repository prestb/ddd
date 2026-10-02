import { Tabs } from 'expo-router';
import AppBottomNav from '@/components/app-bottom-nav';

export default function AppTabs() {
  return <Tabs tabBar={() => <AppBottomNav />} screenOptions={{ headerShown: false }} />;
}
