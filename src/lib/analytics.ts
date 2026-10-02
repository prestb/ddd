import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

const INSTALLATION_KEY = 'daily-dew-analytics-installation-v1';

async function getInstallationId() {
  const existing = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (existing) return existing;

  const installationId = `install-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(INSTALLATION_KEY, installationId);
  return installationId;
}

export async function recordAnalyticsEvent(
  eventType: string,
  metadata: Record<string, number | string> = {},
  userId?: string | null,
) {
  if (!supabase) return;

  const installationId = await getInstallationId();
  await supabase.from('app_events').insert({
    user_id: userId ?? null,
    event_type: eventType,
    metadata: { ...metadata, installation_id: installationId },
  });
}
