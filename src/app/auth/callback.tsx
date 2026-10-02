import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/auth-context';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const { session } = useAuth();
  useEffect(() => {
    Linking.getInitialURL().then(async (url) => {
      if (url && supabase) {
        const parsed = Linking.parse(url);
        const hash = url.split('#')[1] ?? '';
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
        if (code) await supabase.auth.exchangeCodeForSession(code);
      }
    }).catch(() => undefined);
  }, []);
  useEffect(() => { if (session) router.replace('/' as any); }, [session]);
  return <View style={styles.screen}><ActivityIndicator color="#31543F" /><Text style={styles.text}>{session ? 'Signed in' : 'Completing sign in...'}</Text></View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F1E9', gap: 12 }, text: { color: '#31543F', fontWeight: '800' } });
