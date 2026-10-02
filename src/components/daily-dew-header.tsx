import AppIcon from '@/components/app-icon';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { useContent } from '@/context/content-context';
import { useDevotional } from '@/context/devotional-context';
import { t } from '@/lib/i18n';
import AppToast from '@/components/app-toast';
import { supabase } from '@/lib/supabase';
import { DewDesign } from '@/constants/design';

export default function DailyDewHeader() {
  const { session, signOut } = useAuth();
  const { language, setLanguage, themeMode } = useSettings();
  const isDark = themeMode === 'dark';
  const { loading: contentLoading, refresh: refreshContent } = useContent();
  const { syncStatus, syncNow } = useDevotional();
  const [open, setOpen] = useState<'account' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [canManageMinistry, setCanManageMinistry] = useState(false);

  useEffect(() => {
    if (!session || !supabase) { setCanManageMinistry(false); return; }
    supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle().then(({ data }) => setCanManageMinistry(data?.role === 'admin' || data?.role === 'editor'), () => setCanManageMinistry(false));
  }, [session]);

  const closeMenu = () => {
    setOpen(null);
  };

  const toggleLanguage = () => {
    const nextLang = language === 'en' ? 'fr' : 'en';
    setLanguage(nextLang);
    setToast(nextLang === 'fr' ? 'Langue: Français' : 'Language: English');
    setTimeout(() => setToast(null), 2000);
  };

  const navigateTo = (path: '/auth' | '/settings' | '/admin') => {
    closeMenu();
    setTimeout(() => router.push(path), 50);
  };

  const openAbout = () => {
    closeMenu();
    setTimeout(() => router.push('/legal'), 50);
  };

  const openDonation = async () => {
    closeMenu();
    setTimeout(() => router.push('/donate'), 50);
  };

  const refreshData = () => {
    refreshContent();
    if (syncStatus !== 'syncing') syncNow();
    setToast(language === 'fr' ? 'Synchronisation lancée' : 'Sync started');
    setTimeout(() => setToast(null), 2200);
  };

  const iconTintColor = isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest;

  return (
    <View style={[styles.shell, isDark && styles.darkShell]}>
      <AppToast message={toast} dark={isDark} />
      <View style={styles.bar}>
        <Pressable onPress={() => router.replace('/' as any)} style={styles.brandRow} accessibilityRole="button" accessibilityLabel="Return to Daily Dew home">
          <Image source={require('../../assets/images/splash-icon.png')} style={styles.brandLogo} contentFit="contain" />
          <View>
            <Text style={styles.brand}>DAILY DEW</Text>
            <Text style={[styles.productName, isDark && styles.darkText]}>Devotional</Text>
          </View>
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            onPress={toggleLanguage}
            style={[styles.langPill, isDark && styles.darkLangPill]}
            accessibilityRole="button"
            accessibilityLabel={`Switch language, currently ${language.toUpperCase()}`}>
            <Text style={[styles.langPillText, isDark && styles.darkLangPillText]}>{language.toUpperCase()}</Text>
          </Pressable>

          <Pressable onPress={refreshData} style={[styles.iconButton, isDark && styles.darkIconButton]} accessibilityLabel="Refresh devotional data">
            <AppIcon name="refresh" size={18} tintColor={iconTintColor} />
            {contentLoading && <View style={styles.dot} />}
          </Pressable>
          <Pressable onPress={() => setOpen((value) => value === 'account' ? null : 'account')} style={[styles.avatar, isDark && styles.darkAvatar]} accessibilityLabel="Open account menu">
            <Text style={[styles.avatarText, isDark && styles.darkAvatarText]}>{session?.user.email?.charAt(0).toUpperCase() ?? 'J'}</Text>
          </Pressable>
        </View>
      </View>

      {open && <Pressable onPress={closeMenu} style={styles.dismissOverlay} />}
      {open === 'account' && (
        <View style={[styles.menu, isDark && styles.darkMenu, DewDesign.shadows.floating]}>
          <Text style={styles.menuEyebrow}>{t(language, 'about')}</Text>
          <Text style={[styles.menuTitle, isDark && styles.darkMenuText]}>Daily Dew Devotional</Text>
          <Text style={[styles.aboutText, isDark && styles.darkMenuBody]}>A quiet place for Scripture, meditation, prayer, and reflection.</Text>
          <Pressable onPress={openAbout} style={styles.menuItem}>
            <AppIcon name="info.circle" size={18} tintColor={iconTintColor} />
            <Text style={[styles.menuItemText, isDark && styles.darkMenuText]}>{t(language, 'about')}</Text>
          </Pressable>
          <Pressable onPress={() => navigateTo('/settings')} style={styles.menuItem}>
            <AppIcon name="gearshape" size={18} tintColor={iconTintColor} />
            <Text style={[styles.menuItemText, isDark && styles.darkMenuText]}>{t(language, 'settings')}</Text>
          </Pressable>
          <Pressable onPress={openDonation} style={styles.menuItem}>
            <AppIcon name="heart" size={18} tintColor={DewDesign.colors.terracotta} />
            <Text style={[styles.menuItemText, isDark && styles.darkMenuText]}>{t(language, 'donate')}</Text>
          </Pressable>
          {canManageMinistry ? (
            <Pressable onPress={() => navigateTo('/admin')} style={styles.menuItem}>
              <AppIcon name="rectangle.3.group" size={18} tintColor={iconTintColor} />
              <Text style={[styles.menuItemText, isDark && styles.darkMenuText]}>{t(language, 'ministryDashboard')}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => session ? signOut().then(closeMenu) : navigateTo('/auth')} style={styles.menuItem}>
            <AppIcon name={session ? 'rectangle.portrait.and.arrow.right' : 'person.crop.circle'} size={18} tintColor={session ? DewDesign.colors.terracotta : iconTintColor} />
            <Text style={session ? styles.menuItemDanger : [styles.menuItemText, isDark && styles.darkMenuText]}>{session ? t(language, 'logout') : t(language, 'login')}</Text>
          </Pressable>
          <Text style={[styles.aboutVersion, isDark && styles.darkMenuBody]}>Version 1.0 · Daily Dew Devotional</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { position: 'relative', zIndex: 100, paddingHorizontal: DewDesign.spacing.screen, backgroundColor: DewDesign.colors.canvas },
  darkShell: { backgroundColor: DewDesign.colors.darkCanvas },
  bar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 3 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: { width: 34, height: 34 },
  brand: { color: DewDesign.colors.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  productName: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 20, fontWeight: '700', marginTop: 1 },
  darkText: { color: DewDesign.colors.darkInk },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: DewDesign.radius.full,
    backgroundColor: DewDesign.colors.forestSoft,
    borderWidth: 1,
    borderColor: DewDesign.colors.forestMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkLangPill: {
    backgroundColor: DewDesign.colors.darkSurfaceMuted,
    borderColor: DewDesign.colors.darkLine,
  },
  langPillText: {
    color: DewDesign.colors.forest,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  darkLangPillText: {
    color: DewDesign.colors.darkInk,
  },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: DewDesign.colors.surface, borderWidth: 1, borderColor: DewDesign.colors.line, alignItems: 'center', justifyContent: 'center' },
  darkIconButton: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine },
  dot: { position: 'absolute', right: 9, top: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: DewDesign.colors.terracotta },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: DewDesign.colors.forestSoft, alignItems: 'center', justifyContent: 'center' },
  darkAvatar: { backgroundColor: DewDesign.colors.darkSurfaceMuted },
  avatarText: { color: DewDesign.colors.forest, fontSize: 15, fontWeight: '900' },
  darkAvatarText: { color: DewDesign.colors.darkInk },
  menu: { position: 'absolute', zIndex: 2, top: 62, right: DewDesign.spacing.screen, width: 280, backgroundColor: DewDesign.colors.surface, borderWidth: 1, borderColor: DewDesign.colors.line, borderRadius: DewDesign.radius.card, padding: 16 },
  darkMenu: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine },
  darkMenuText: { color: DewDesign.colors.darkInk },
  darkMenuBody: { color: DewDesign.colors.darkMuted },
  dismissOverlay: { position: 'absolute', zIndex: 1, top: 0, left: -22, right: -22, bottom: -1200 },
  menuEyebrow: { color: DewDesign.colors.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  menuTitle: { color: DewDesign.colors.ink, fontSize: 14, fontWeight: '800', marginTop: 5, marginBottom: 8 },
  menuItem: { minHeight: 44, borderTopWidth: 1, borderTopColor: DewDesign.colors.surfaceMuted, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuItemText: { flex: 1, color: DewDesign.colors.forest, fontSize: 13, fontWeight: '800' },
  menuItemDanger: { flex: 1, color: DewDesign.colors.terracotta, fontSize: 13, fontWeight: '800' },
  aboutText: { color: DewDesign.colors.body, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  aboutVersion: { color: DewDesign.colors.muted, fontSize: 10, marginTop: 8 },
});
