import AppIcon from '@/components/app-icon';
import DailyDewHeader from '@/components/daily-dew-header';
import { DewDesign } from '@/constants/design';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminExtraStyles } from '@/components/admin-extra-styles';
import AdminBottomNav, { AdminTab } from '@/components/admin-bottom-nav';
import { useSettings } from '@/context/settings-context';
import { t } from '@/lib/i18n';
import { classifyAppError } from '@/lib/error-utils';
import { getPublishingIssues, validateDevotions } from '@/lib/content-validation';
import { sanitizeAndRepairExtractedDay } from '@/lib/pdf-parser';

type Edition = {
  id: string;
  slug: string;
  title: string;
  theme: string;
  introduction?: string | null;
  month: number;
  year: number;
  status: 'draft' | 'review' | 'published';
  language: string;
  updated_at: string;
  devotionCount: number;
};
type Devotion = {
  id: string;
  edition_id: string;
  day_number: number;
  devotion_date?: string | null;
  weekday: string;
  title: string;
  scripture_reference: string;
  scripture_text?: string | null;
  meditation: string;
  further_studies: string[];
  wisdom_nugget?: string | null;
  declaration?: string | null;
};
type EditionForm = { slug: string; title: string; theme: string; introduction: string; month: string; year: string; language: 'en' | 'fr' };
type ImportedDay = {
  day_number: number;
  weekday: string;
  title: string;
  scripture_reference: string;
  scripture_text?: string;
  meditation: string;
  further_studies: string[];
  wisdom_nugget?: string;
  declaration?: string;
  needs_review: boolean;
};
type PdfImport = {
  id: string;
  source_name: string;
  storage_path: string;
  status: string;
  error_message?: string | null;
  created_at?: string;
  extracted_data?: { days?: ImportedDay[]; days_found?: number; review_count?: number } | null;
};

type FinanceLedger = 'payments' | 'wallet' | 'subscriptions' | 'donations';

export default function AdminScreen() {
  const { session } = useAuth();
  const { themeMode, language } = useSettings();
  const isDark = themeMode === 'dark';

  const [role, setRole] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>('content');
  const [editions, setEditions] = useState<Edition[]>([]);
  const [devotions, setDevotions] = useState<Devotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDevotions, setLoadingDevotions] = useState(false);
  const [devotionsError, setDevotionsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(null);

  const [showComposer, setShowComposer] = useState(false);
  const [showEditionComposer, setShowEditionComposer] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  const [editingEditionId, setEditingEditionId] = useState<string | null>(null);
  const [editingDevotionId, setEditingDevotionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Users Management State
  const [usersList, setUsersList] = useState<{ id: string; role: string; email?: string | null; auth_account_missing?: boolean; profile_missing?: boolean; created_at?: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ email: '', password: '', role: 'reader' as 'reader' | 'editor' | 'admin' });
  const [editingUser, setEditingUser] = useState<{ id: string; role: string; email?: string | null } | null>(null);

  // Financials State
  const [financials, setFinancials] = useState<any>(null);
  const [financeLedger, setFinanceLedger] = useState<FinanceLedger>('payments');
  const [financePage, setFinancePage] = useState(1);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [selectedTxDetails, setSelectedTxDetails] = useState<any | null>(null);

  const [form, setForm] = useState({
    day: '',
    weekday: '',
    title: '',
    scriptureReference: '',
    scriptureText: '',
    meditation: '',
    furtherStudies: '',
    wisdom: '',
    declaration: '',
  });

  const [editionForm, setEditionForm] = useState<EditionForm>({
    slug: '',
    title: '',
    theme: '',
    introduction: '',
    month: '',
    year: '',
    language: 'en',
  });

  const [dailyOpens, setDailyOpens] = useState<{ day: string; opens: number; completions: number }[]>([]);
  const [activeReaders, setActiveReaders] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [campaigns, setCampaigns] = useState<{ id: string; subject: string; body?: string | null; status: string; created_at: string }[]>([]);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [pdfImports, setPdfImports] = useState<PdfImport[]>([]);
  const [reviewingImport, setReviewingImport] = useState<PdfImport | null>(null);
  const [reviewingDay, setReviewingDay] = useState<ImportedDay | null>(null);
  const [deletingPdf, setDeletingPdf] = useState<PdfImport | null>(null);
  const [reviewDayForm, setReviewDayForm] = useState({
    title: '',
    scriptureReference: '',
    scriptureText: '',
    meditation: '',
    wisdom: '',
    declaration: '',
    furtherStudies: '',
  });
  const [newsletter, setNewsletter] = useState({ subject: '', body: '' });
  const modalProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showEditionComposer || !editingEditionId) return;
    const selected = editions.find((e) => e.id === editingEditionId);
    if (selected) {
      setEditionForm((curr) => ({ ...curr, language: selected.language === 'fr' ? 'fr' : 'en' }));
    }
  }, [editions, editingEditionId, showEditionComposer]);

  const loadUsers = useCallback(async () => {
    if (!supabase) return;
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users');

      if (!error && data?.success && Array.isArray(data?.users)) {
        setUsersList(data.users);
        setUsersError(null);
      } else {
        const classified = classifyAppError(error ?? data?.error ?? data?.message, 'admin');
        setUsersList([]);
        setUsersError(t(language, classified.messageKey));
      }
    } catch (err: unknown) {
      const classified = classifyAppError(err, 'admin');
      setUsersList([]);
      setUsersError(t(language, classified.messageKey));
    } finally {
      setLoadingUsers(false);
    }
  }, [language]);

  const loadFinancials = useCallback(async (ledger: FinanceLedger = financeLedger, page = financePage) => {
    if (!supabase) return;
    setLoadingFinance(true);
    const { data, error } = await supabase.functions.invoke('admin-financials', {
      body: { ledger, page, pageSize: 25 },
    });
    setLoadingFinance(false);
    if (!error && data?.success) {
      setFinancials(data);
    } else {
      const classified = classifyAppError(error ?? data?.error ?? data?.message, 'admin');
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
    }
  }, [financeLedger, financePage, language]);

  useEffect(() => {
    if (adminTab === 'users') {
      loadUsers();
    } else if (adminTab === 'finance') {
      loadFinancials(financeLedger, financePage);
    }
  }, [adminTab, financeLedger, financePage, loadUsers, loadFinancials]);

  const loadDashboard = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
    setRole(profile?.role ?? null);
    if (!['editor', 'admin'].includes(profile?.role ?? '')) {
      setEditions([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('editions')
      .select('id, slug, title, theme, introduction, month, year, status, language, updated_at, devotions(count)')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) {
      const classified = classifyAppError(error, 'admin');
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
    } else {
      setEditions(
        (data ?? []).map((edition) => ({
          ...edition,
          devotionCount: Array.isArray(edition.devotions) ? Number(edition.devotions[0]?.count ?? 0) : 0,
        })) as Edition[],
      );
    }

    const nowForBoundary = new Date();
    const startDateBoundary = new Date(
      nowForBoundary.getFullYear(),
      nowForBoundary.getMonth(),
      nowForBoundary.getDate() - 29,
      0,
      0,
      0,
      0
    );

    const [{ data: eventRows }, { data: campaignRows }, { count: optedInCount }] = await Promise.all([
      supabase
        .from('app_events')
        .select('created_at, user_id, event_type, metadata')
        .in('event_type', ['app_open', 'meditation_completed'])
        .gte('created_at', startDateBoundary.toISOString()),
      supabase.from('newsletter_campaigns').select('id, subject, body, status, created_at').order('created_at', { ascending: false }),
      supabase.from('newsletter_subscribers').select('user_id', { count: 'exact', head: true }).eq('opted_in', true),
    ]);

    setSubscriberCount(optedInCount ?? 0);
    const { data: importRows } = await supabase
      .from('devotional_imports')
      .select('id, source_name, storage_path, status, error_message, created_at, extracted_data')
      .order('created_at', { ascending: false });
    setPdfImports((importRows ?? []) as PdfImport[]);

    const groupedOpens = new Map<string, number>();
    const groupedCompletions = new Map<string, number>();
    const readers = new Set<string>();
    const completedReaders = new Set<string>();
    let totalCompletions = 0;

    (eventRows ?? []).forEach((event) => {
      const metadata = event.metadata && typeof event.metadata === 'object' ? (event.metadata as { installation_id?: unknown }) : null;
      const installationId = typeof metadata?.installation_id === 'string' ? metadata.installation_id : null;
      const actorId = event.user_id ?? installationId;
      if (actorId) readers.add(actorId);

      const dayIso = event.created_at.slice(0, 10);

      if (event.event_type === 'app_open') {
        groupedOpens.set(dayIso, (groupedOpens.get(dayIso) ?? 0) + 1);
      } else if (event.event_type === 'meditation_completed') {
        totalCompletions += 1;
        groupedCompletions.set(dayIso, (groupedCompletions.get(dayIso) ?? 0) + 1);
        if (actorId) completedReaders.add(actorId);
      }
    });

    // Build explicit last-30-calendar-days dataset (populating missing days with 0 opens and 0 completions)
    const days30: { day: string; opens: number; completions: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(nowForBoundary.getFullYear(), nowForBoundary.getMonth(), nowForBoundary.getDate() - i);
      const isoKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const formatted = d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      days30.push({
        day: formatted,
        opens: groupedOpens.get(isoKey) ?? 0,
        completions: groupedCompletions.get(isoKey) ?? 0,
      });
    }

    setActiveReaders(readers.size);
    setCompletedCount(totalCompletions);
    setCompletionRate(readers.size ? Math.round((completedReaders.size / readers.size) * 100) : 0);
    setDailyOpens(days30);
    setCampaigns((campaignRows ?? []) as typeof campaigns);
    setLoading(false);
  }, [session, language]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const visible = showComposer || showEditionComposer || showJsonModal || showCreateUserModal || Boolean(editingUser) || Boolean(selectedTxDetails) || Boolean(reviewingImport) || Boolean(reviewingDay);
    Animated.spring(modalProgress, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 180,
      mass: 0.8,
    }).start();
  }, [modalProgress, showComposer, showEditionComposer, showJsonModal, showCreateUserModal, editingUser, selectedTxDetails, reviewingImport, reviewingDay]);

  const refresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    if (adminTab === 'users') await loadUsers();
    if (adminTab === 'finance') await loadFinancials(financeLedger, financePage);
    setRefreshing(false);
  };

  const loadDevotions = async (editionId: string) => {
    if (!supabase) return;
    setLoadingDevotions(true);
    setDevotionsError(null);
    const { data, error } = await supabase.from('devotions').select('*').eq('edition_id', editionId).order('day_number');
    setLoadingDevotions(false);
    if (error) {
      const classified = classifyAppError(error, 'admin');
      setDevotionsError(t(language, classified.messageKey));
      setDevotions([]);
    } else {
      setDevotions((data ?? []) as Devotion[]);
    }
  };

  const handleCreateUser = async () => {
    if (!supabase || !createUserForm.email.includes('@') || createUserForm.password.length < 6) {
      Alert.alert('Invalid credentials', 'Enter a valid email and a password of at least 6 characters.');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: createUserForm,
    });
    setSaving(false);

    if (error || !data?.success) {
      const classified = classifyAppError(
        error ?? data?.error ?? data?.message,
        'admin'
      );
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
      return;
    }

    Alert.alert('User created', `Account for ${createUserForm.email} created as ${createUserForm.role}.`);
    setShowCreateUserModal(false);
    setShowPassword(false);
    setCreateUserForm({ email: '', password: '', role: 'reader' });
    await loadUsers();
  };

  const handleUpdateUserRole = async (targetUserId: string, newRole: string) => {
    if (!supabase) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-update-user-role', {
      body: { targetUserId, newRole },
    });
    setSaving(false);

    if (error || !data?.success) {
      const classified = classifyAppError(
        error ?? data?.error ?? data?.message,
        'admin'
      );
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
      return;
    }

    Alert.alert('Role updated', 'User role updated successfully.');
    setEditingUser(null);
    await loadUsers();
  };

  const executeStatusChange = async (edition: Edition, status: Edition['status']) => {
    if (!supabase) return;
    const { error } = await supabase.from('editions').update({ status, updated_at: new Date().toISOString() }).eq('id', edition.id);
    if (error) {
      const classified = classifyAppError(error, 'admin');
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
      return;
    }
    await loadDashboard();
  };

  const changeStatus = async (edition: Edition, status: Edition['status']) => {
    if (!supabase) return;
    if (status === 'published') {
      const { data: rows, error: validationError } = await supabase
        .from('devotions')
        .select('day_number, title, scripture_reference, meditation')
        .eq('edition_id', edition.id)
        .order('day_number');

      if (validationError) {
        const classified = classifyAppError(validationError, 'admin');
        Alert.alert(
          t(language, classified.titleKey),
          t(language, classified.messageKey)
        );
        return;
      }
      const issues = getPublishingIssues(edition, rows ?? []);
      if (issues.length > 0) {
        Alert.alert('Edition is not ready', issues.slice(0, 4).join('\n'));
        return;
      }

      Alert.alert(
        'Publish Edition Live?',
        `Are you sure you want to publish "${edition.title}"? This will make all its meditations immediately available to all app readers.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Publish Now', style: 'default', onPress: () => executeStatusChange(edition, status) },
        ],
      );
      return;
    }
    await executeStatusChange(edition, status);
  };

  const saveEdition = async () => {
    if (!supabase || !editionForm.slug.trim() || !editionForm.title.trim() || !editionForm.month || !editionForm.year) {
      Alert.alert('Missing information', 'Add a slug, title, month number, and year.');
      return;
    }
    const month = Number(editionForm.month);
    const year = Number(editionForm.year);
    if (month < 1 || month > 12 || year < 2020) {
      Alert.alert('Invalid month', 'Use a month from 1 to 12 and a valid year.');
      return;
    }
    setSaving(true);
    const payload = {
      slug: editionForm.slug.trim().toLowerCase(),
      title: editionForm.title.trim(),
      theme: editionForm.theme.trim() || editionForm.title.trim(),
      introduction: editionForm.introduction.trim() || null,
      month,
      year,
      language: editionForm.language ?? 'en',
      status: 'draft',
    };
    const result = editingEditionId
      ? await supabase.from('editions').update(payload).eq('id', editingEditionId)
      : await supabase.from('editions').insert(payload);
    setSaving(false);
    if (result.error) {
      const classified = classifyAppError(result.error, 'admin');
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
      return;
    }
    setShowEditionComposer(false);
    setEditingEditionId(null);
    setEditionForm({ slug: '', title: '', theme: '', introduction: '', month: '', year: '', language: 'en' });
    await loadDashboard();
  };

  const saveMeditation = async () => {
    if (!supabase || !selectedEditionId) return;
    const editingId = editingDevotionId;
    const dayNumber = Number(form.day);
    if (!dayNumber || dayNumber < 1 || dayNumber > 31 || !form.title.trim() || !form.meditation.trim() || !form.scriptureReference.trim()) {
      Alert.alert('Missing information', 'Add a valid day number, title, Scripture reference, and meditation text.');
      return;
    }
    setSaving(true);
    const duplicateQuery = supabase.from('devotions').select('id').eq('edition_id', selectedEditionId).eq('day_number', dayNumber);
    const { data: duplicateRows, error: duplicateError } = editingId ? await duplicateQuery.neq('id', editingId) : await duplicateQuery;
    if (duplicateError) {
      setSaving(false);
      const classified = classifyAppError(duplicateError, 'admin');
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
      return;
    }
    if (duplicateRows?.length) {
      setSaving(false);
      Alert.alert('Day already exists', `Day ${dayNumber} is already in this edition. Choose a different day number.`);
      return;
    }
    const payload = {
      edition_id: selectedEditionId,
      day_number: dayNumber,
      weekday: form.weekday.trim() || 'Daily',
      title: form.title.trim(),
      scripture_reference: form.scriptureReference.trim(),
      scripture_text: form.scriptureText.trim() || null,
      meditation: form.meditation.trim(),
      further_studies: form.furtherStudies.split(',').map((item) => item.trim()).filter(Boolean),
      wisdom_nugget: form.wisdom.trim() || null,
      declaration: form.declaration.trim() || null,
    };
    const result = editingId
      ? await supabase.from('devotions').update(payload).eq('id', editingId).select('id').maybeSingle()
      : await supabase.from('devotions').insert(payload);
    setSaving(false);
    if (result.error) {
      const classified = classifyAppError(result.error, 'admin');
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
      return;
    }
    setForm({ day: '', weekday: '', title: '', scriptureReference: '', scriptureText: '', meditation: '', furtherStudies: '', wisdom: '', declaration: '' });
    setEditingDevotionId(null);
    setShowComposer(false);
    await loadDashboard();
    await loadDevotions(selectedEditionId);
    Alert.alert('Saved', `Day ${dayNumber} was ${editingId ? 'updated' : 'added'} successfully.`);
  };

  const deleteDevotion = (item: Devotion) =>
    Alert.alert('Delete meditation?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!supabase) return;
          const { error } = await supabase.from('devotions').delete().eq('id', item.id);
          if (error) {
            const classified = classifyAppError(error, 'admin');
            Alert.alert(
              t(language, classified.titleKey),
              t(language, classified.messageKey)
            );
            return;
          }
          if (selectedEditionId) await loadDevotions(selectedEditionId);
          await loadDashboard();
          Alert.alert('Deleted', 'The meditation was removed from this edition.');
        },
      },
    ]);

  const deleteEdition = (edition: Edition) =>
    Alert.alert('Delete month?', `This deletes ${edition.title} and all its meditations.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!supabase) return;
          const { error } = await supabase.from('editions').delete().eq('id', edition.id);
          if (error) {
            const classified = classifyAppError(error, 'admin');
            Alert.alert(
              t(language, classified.titleKey),
              t(language, classified.messageKey)
            );
            return;
          }
          if (selectedEditionId === edition.id) {
            setSelectedEditionId(null);
            setDevotions([]);
          }
          await loadDashboard();
          Alert.alert('Deleted', `${edition.title} and its meditations were removed.`);
        },
      },
    ]);

  const importPdf = async () => {
    if (!supabase || !session) return;
    let documentPicker: typeof import('expo-document-picker');
    try {
      documentPicker = await import('expo-document-picker');
    } catch {
      Alert.alert('PDF import needs an app update', 'Install the next development build to add the PDF picker to this device.');
      return;
    }
    const result = await documentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadingPdf(true);
    try {
      const response = await fetch(asset.uri);
      const file = await response.blob();
      const safeName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${session.user.id}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from('devotional-imports').upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (error) {
        const classified = classifyAppError(error, 'admin');
        Alert.alert(
          t(language, classified.titleKey),
          t(language, classified.messageKey)
        );
        return;
      }
      const { error: jobError } = await supabase.from('devotional_imports').insert({ owner_id: session.user.id, storage_path: path, source_name: asset.name, status: 'uploaded' });
      if (jobError) {
        await supabase.storage.from('devotional-imports').remove([path]);
        const classified = classifyAppError(jobError, 'admin');
        Alert.alert(
          t(language, classified.titleKey),
          t(language, classified.messageKey)
        );
        return;
      }
      await loadDashboard();
      Alert.alert('PDF uploaded for review', 'The file is stored privately. Run the importer review step before creating or publishing an edition.');
    } catch (errorValue: unknown) {
      const classified = classifyAppError(errorValue, 'admin');
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
    } finally {
      setUploadingPdf(false);
    }
  };

  const extractPdf = async (importId: string) => {
    if (!supabase) return;
    setUploadingPdf(true);
    const { data, error } = await supabase.functions.invoke('parse-devotional-pdf', { body: { importId } });
    setUploadingPdf(false);
    if (error) {
      await loadDashboard();
      const classified = classifyAppError(error, 'admin');
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
    } else {
      await loadDashboard();
      Alert.alert('PDF ready for review', `${data?.daysFound ?? 0} daily records extracted. Review is required before importing.`);
    }
  };

  const deletePdf = async () => {
    if (!supabase || !deletingPdf) return;
    const file = deletingPdf;
    setDeletingPdf(null);
    const { error } = await supabase.functions.invoke('delete-devotional-pdf', { body: { importId: file.id } });
    if (error) {
      const classified = classifyAppError(error, 'admin');
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
      return;
    }
    await loadDashboard();
  };

  const openImportReview = async (file: PdfImport) => {
    if (!supabase) return;
    const { data, error } = await supabase.from('devotional_imports').select('id, source_name, storage_path, status, error_message, created_at, extracted_data').eq('id', file.id).single();
    if (error) {
      const classified = classifyAppError(error, 'admin');
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
      return;
    }
    if (!data) {
      Alert.alert('Could not open review', 'The import record could not be found.');
      return;
    }
    const rawDays = data.extracted_data?.days ?? [];
    const repairedDays = rawDays.map((d: any) => sanitizeAndRepairExtractedDay(d) as ImportedDay);
    const repairedData = {
      ...data.extracted_data,
      days: repairedDays,
      review_count: repairedDays.filter((d: ImportedDay) => d.needs_review).length,
    };
    setReviewingImport({ ...data, extracted_data: repairedData } as PdfImport);
  };

  const openDayReview = (day: ImportedDay) => {
    const repaired = sanitizeAndRepairExtractedDay(day) as ImportedDay;
    setReviewingDay(repaired);
    setReviewDayForm({
      title: repaired.title ?? '',
      scriptureReference: repaired.scripture_reference ?? '',
      scriptureText: repaired.scripture_text ?? '',
      meditation: repaired.meditation ?? '',
      wisdom: repaired.wisdom_nugget ?? '',
      declaration: repaired.declaration ?? '',
      furtherStudies: (repaired.further_studies ?? []).join(', '),
    });
  };

  const saveDayReview = async () => {
    if (!supabase || !reviewingImport || !reviewingDay) return;
    const days = reviewingImport.extracted_data?.days ?? [];
    const nextDay: ImportedDay = {
      ...reviewingDay,
      title: reviewDayForm.title.trim(),
      scripture_reference: reviewDayForm.scriptureReference.trim(),
      scripture_text: reviewDayForm.scriptureText.trim(),
      meditation: reviewDayForm.meditation.trim(),
      wisdom_nugget: reviewDayForm.wisdom.trim(),
      declaration: reviewDayForm.declaration.trim(),
      further_studies: reviewDayForm.furtherStudies.split(',').map((i) => i.trim()).filter(Boolean),
      needs_review: !reviewDayForm.title.trim() || !reviewDayForm.scriptureReference.trim() || !reviewDayForm.meditation.trim() || !reviewDayForm.declaration.trim(),
    };
    const nextDays = days.map((day) => (day.day_number === reviewingDay.day_number ? nextDay : day));
    const nextData = { ...(reviewingImport.extracted_data ?? {}), days: nextDays, review_count: nextDays.filter((day) => day.needs_review).length };
    setSaving(true);
    const { error } = await supabase.from('devotional_imports').update({ extracted_data: nextData, updated_at: new Date().toISOString() }).eq('id', reviewingImport.id);
    setSaving(false);
    if (error) {
      const classified = classifyAppError(error, 'admin');
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
      return;
    }
    setReviewingImport({ ...reviewingImport, extracted_data: nextData });
    setReviewingDay(null);
    await loadDashboard();
  };

  const approveImport = async (targetEditionId: string) => {
    if (!supabase || !reviewingImport) return;
    const days = reviewingImport.extracted_data?.days ?? [];
    if (!days.length) {
      Alert.alert('Nothing to import', 'This PDF did not produce any daily records.');
      return;
    }
    const invalid = days.filter((day) => day.needs_review || !day.title?.trim() || !day.scripture_reference?.trim() || !day.meditation?.trim());
    if (invalid.length) {
      Alert.alert('Review required', `${invalid.length} extracted day${invalid.length === 1 ? '' : 's'} still need editorial review before import.`);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('devotions').upsert(
      days.map((day) => ({
        edition_id: targetEditionId,
        day_number: day.day_number,
        weekday: day.weekday || 'Daily',
        title: day.title,
        scripture_reference: day.scripture_reference,
        scripture_text: day.scripture_text || null,
        meditation: day.meditation,
        further_studies: day.further_studies ?? [],
        wisdom_nugget: day.wisdom_nugget || null,
        declaration: day.declaration || null,
      })),
      { onConflict: 'edition_id,day_number' },
    );
    if (!error) await supabase.from('devotional_imports').update({ status: 'imported', updated_at: new Date().toISOString() }).eq('id', reviewingImport.id);
    setSaving(false);
    if (error) {
      const classified = classifyAppError(error, 'admin');
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
      return;
    }
    setReviewingImport(null);
    await loadDashboard();
    Alert.alert('Import complete', `${days.length} meditations were added to the draft edition.`);
  };

  const editNewsletter = (campaign: { id: string; subject: string; body?: string | null }) => {
    setEditingCampaignId(campaign.id);
    setNewsletter({
      subject: campaign.subject,
      body: campaign.body ?? '',
    });
  };

  const deleteNewsletter = (campaign: { id: string; subject: string }) => {
    Alert.alert('Delete newsletter draft?', campaign.subject, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!supabase) return;
          const { error } = await supabase.from('newsletter_campaigns').delete().eq('id', campaign.id);
          if (error) {
            const classified = classifyAppError(error, 'admin');
            Alert.alert(
              t(language, classified.titleKey),
              t(language, classified.messageKey)
            );
            return;
          }
          if (editingCampaignId === campaign.id) {
            setEditingCampaignId(null);
            setNewsletter({ subject: '', body: '' });
          }
          await loadDashboard();
          Alert.alert('Deleted', 'Newsletter draft deleted.');
        },
      },
    ]);
  };

  const saveNewsletter = async () => {
    if (!supabase || !newsletter.subject.trim() || !newsletter.body.trim()) {
      Alert.alert('Missing information', 'Add a subject and message.');
      return;
    }
    setSaving(true);
    const payload = {
      subject: newsletter.subject.trim(),
      body: newsletter.body.trim(),
    };

    const { error } = editingCampaignId
      ? await supabase.from('newsletter_campaigns').update(payload).eq('id', editingCampaignId)
      : await supabase.from('newsletter_campaigns').insert({ ...payload, created_by: session?.user.id, status: 'draft' });

    setSaving(false);
    if (error) {
      const classified = classifyAppError(error, 'admin');
      Alert.alert(
        t(language, classified.titleKey),
        t(language, classified.messageKey)
      );
    } else {
      setNewsletter({ subject: '', body: '' });
      setEditingCampaignId(null);
      await loadDashboard();
      Alert.alert('Saved', editingCampaignId ? 'Newsletter updated.' : 'Newsletter draft saved.');
    }
  };

  const sendNewsletter = async (campaignId: string) => {
    if (!supabase) return;
    const client = supabase;
    Alert.alert('Send newsletter?', 'This will send the campaign to opted-in subscribers.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send now',
        onPress: async () => {
          const { error } = await client.functions.invoke('send-newsletter', { body: { campaignId } });
          if (error) {
            const classified = classifyAppError(error, 'admin');
            Alert.alert(
              t(language, classified.titleKey),
              t(language, classified.messageKey)
            );
          } else {
            Alert.alert('Newsletter sent', 'Delivery has been started.');
            await loadDashboard();
          }
        },
      },
    ]);
  };

  if (!session) {
    return (
      <View style={[styles.screen, isDark && styles.darkScreen]}>
        <SafeAreaView style={[styles.center, isDark && styles.darkScreen]}>
          <AppIcon name="lock" size={28} tintColor={DewDesign.colors.forest} />
          <Text style={[styles.emptyTitle, isDark && styles.darkInk]}>Editor sign-in required</Text>
          <Pressable onPress={() => router.push('/auth')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, isDark && styles.darkScreen]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.darkScreen]}>
        <DailyDewHeader />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={DewDesign.colors.forest} />}>
          <View style={styles.pageIntro}>
            <Text style={styles.eyebrow}>{language === 'fr' ? 'ESPACE DU MINISTÈRE' : 'MINISTRY WORKSPACE'}</Text>
            <Text style={[styles.title, isDark && styles.darkInk]}>{language === 'fr' ? 'Tableau de contenu' : 'Content dashboard'}</Text>
            <Text style={[styles.subtitle, isDark && styles.darkMuted]}>{language === 'fr' ? 'Préparez, révisez et publiez chaque édition mensuelle.' : 'Prepare, review, and publish each monthly edition.'}</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={DewDesign.colors.forest} style={styles.loader} />
          ) : role === 'editor' || role === 'admin' ? (
            <>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, isDark && styles.darkCard]}>
                  <Text style={[styles.summaryValue, isDark && styles.darkInk]}>{editions.length}</Text>
                  <Text style={[styles.summaryLabel, isDark && styles.darkMuted]}>{language === 'fr' ? 'Éditions' : 'Editions'}</Text>
                </View>
                <View style={[styles.summaryCard, isDark && styles.darkCard]}>
                  <Text style={[styles.summaryValue, isDark && styles.darkInk]}>{editions.filter((e) => e.status === 'published').length}</Text>
                  <Text style={[styles.summaryLabel, isDark && styles.darkMuted]}>{language === 'fr' ? 'Publiées' : 'Published'}</Text>
                </View>
                <View style={[styles.summaryCard, isDark && styles.darkCard]}>
                  <Text style={[styles.summaryValue, isDark && styles.darkInk]}>{editions.filter((e) => e.status === 'review').length}</Text>
                  <Text style={[styles.summaryLabel, isDark && styles.darkMuted]}>{language === 'fr' ? 'À réviser' : 'In review'}</Text>
                </View>
              </View>

              {/* TAB 1: CONTENT MANAGEMENT & PDF IMPORTS */}
              {adminTab === 'content' ? (
                <>
                  <View style={styles.composerHeader}>
                    <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>Published Editions</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        disabled={uploadingPdf}
                        onPress={importPdf}
                        style={[styles.iconPillButton, isDark && styles.darkIconPillButton]}
                        accessibilityRole="button"
                        accessibilityLabel="Import PDF">
                        {uploadingPdf ? (
                          <ActivityIndicator size="small" color={DewDesign.colors.forest} />
                        ) : (
                          <AppIcon name="arrow.up.doc" size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setEditingEditionId(null);
                          setEditionForm({ slug: '', title: '', theme: '', introduction: '', month: '', year: '', language: 'en' });
                          setShowEditionComposer(true);
                        }}
                        style={[styles.iconPillButton, isDark && styles.darkIconPillButton]}
                        accessibilityRole="button"
                        accessibilityLabel="New Month">
                        <AppIcon name="plus" size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                      </Pressable>
                    </View>
                  </View>

                  {/* PDF Import Queue */}
                  {pdfImports.length > 0 && (
                    <View style={[adminExtraStyles.adminPanel, isDark && styles.darkCard, { marginBottom: 20 }]}>
                      <Text style={[styles.sectionTitle, isDark && styles.darkInk, { fontSize: 16 }]}>PDF Import Queue</Text>
                      {pdfImports.map((item) => (
                        <View key={item.id} style={[styles.editionCard, isDark && styles.darkCard, { marginBottom: 8 }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.editionTitle, isDark && styles.darkInk]} numberOfLines={1}>{item.source_name}</Text>
                              <Text style={[styles.editionMeta, isDark && styles.darkMuted]}>{`Status: ${item.status.toUpperCase()} · ${item.extracted_data?.days_found ?? 0} days found`}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                              {item.status === 'review' || item.status === 'extracted' ? (
                                <Pressable onPress={() => openImportReview(item)} style={styles.actionBtnPill}>
                                  <AppIcon name="eye" size={12} tintColor={DewDesign.colors.forest} />
                                  <Text style={styles.actionBtnLabel}>Review</Text>
                                </Pressable>
                              ) : item.status === 'uploaded' ? (
                                <Pressable onPress={() => extractPdf(item.id)} style={styles.actionBtnPill}>
                                  <AppIcon name="play.fill" size={12} tintColor={DewDesign.colors.forest} />
                                  <Text style={styles.actionBtnLabel}>Extract</Text>
                                </Pressable>
                              ) : null}
                              <Pressable onPress={() => setDeletingPdf(item)} style={styles.actionBtnPill}>
                                <AppIcon name="trash" size={12} tintColor={DewDesign.colors.terracotta} />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {editions.map((editionItem) => {
                    const isSelected = selectedEditionId === editionItem.id;
                    return (
                      <View key={editionItem.id} style={[styles.editionCard, isDark && styles.darkCard, isSelected && { borderColor: DewDesign.colors.forest, borderWidth: 2 }]}>
                        <View style={styles.editionHeader}>
                          <View style={styles.editionIcon}>
                            <AppIcon name="book.closed" size={20} tintColor={DewDesign.colors.terracotta} />
                          </View>
                          <View style={styles.editionCopy}>
                            <Text style={[styles.editionTitle, isDark && styles.darkInk]}>{editionItem.title}</Text>
                            <Text style={[styles.editionMeta, isDark && styles.darkMuted]}>{editionItem.theme}</Text>
                          </View>
                          <Pressable onPress={() => changeStatus(editionItem, editionItem.status === 'published' ? 'draft' : 'published')} style={[styles.statusButton, editionItem.status === 'published' && styles.publishButton]}>
                            <Text style={[styles.statusButtonText, editionItem.status === 'published' && styles.publishButtonText]}>{editionItem.status.toUpperCase()}</Text>
                          </Pressable>
                        </View>

                        <View style={styles.editionDetails}>
                          <Text style={[styles.detailText, isDark && styles.darkMuted]}>{`${editionItem.devotionCount} meditations`}</Text>
                          <Text style={[styles.detailText, isDark && styles.darkMuted]}>{`${editionItem.month}/${editionItem.year}`}</Text>
                        </View>

                        <View style={styles.statusActions}>
                          <Pressable
                            onPress={() => {
                              if (isSelected) {
                                setSelectedEditionId(null);
                              } else {
                                setSelectedEditionId(editionItem.id);
                                loadDevotions(editionItem.id);
                              }
                            }}
                            style={[styles.actionBtnPill, isSelected && { backgroundColor: DewDesign.colors.forest }]}>
                            <AppIcon name="list.bullet" size={14} tintColor={isSelected ? '#FFFFFF' : DewDesign.colors.forest} />
                            <Text style={[styles.actionBtnLabel, isSelected && { color: '#FFFFFF' }]}>
                              {isSelected ? 'Close Meditations' : 'Meditations'}
                            </Text>
                          </Pressable>
                          <Pressable onPress={() => { setEditingEditionId(editionItem.id); setEditionForm({ slug: editionItem.slug, title: editionItem.title, theme: editionItem.theme, introduction: editionItem.introduction ?? '', month: String(editionItem.month), year: String(editionItem.year), language: editionItem.language as 'en' | 'fr' }); setShowEditionComposer(true); }} style={styles.actionBtnPill}>
                            <AppIcon name="pencil" size={14} tintColor={DewDesign.colors.forest} />
                            <Text style={styles.actionBtnLabel}>Edit</Text>
                          </Pressable>
                          <Pressable onPress={() => deleteEdition(editionItem)} style={styles.actionBtnPill}>
                            <AppIcon name="trash" size={14} tintColor={DewDesign.colors.terracotta} />
                            <Text style={[styles.actionBtnLabel, { color: DewDesign.colors.terracotta }]}>Delete</Text>
                          </Pressable>
                        </View>

                        {/* RENDERED SELECTED MEDITATIONS LIST BELOW SELECTED EDITION */}
                        {isSelected && (
                          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: isDark ? DewDesign.colors.darkLine : DewDesign.colors.line }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                              <Text style={[styles.sectionTitle, isDark && styles.darkInk, { fontSize: 15, marginBottom: 0 }]}>
                                {`Meditations (${devotions.length})`}
                              </Text>
                              <Pressable
                                onPress={() => {
                                  setForm({ day: String(devotions.length + 1), weekday: 'Daily', title: '', scriptureReference: '', scriptureText: '', meditation: '', furtherStudies: '', wisdom: '', declaration: '' });
                                  setEditingDevotionId(null);
                                  setShowComposer(true);
                                }}
                                style={styles.actionBtnPill}>
                                <AppIcon name="plus" size={12} tintColor={DewDesign.colors.forest} />
                                <Text style={styles.actionBtnLabel}>Add Meditation</Text>
                              </Pressable>
                            </View>

                            {loadingDevotions ? (
                              <ActivityIndicator size="small" color={DewDesign.colors.forest} style={{ marginVertical: 14 }} />
                            ) : devotionsError ? (
                              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                                <Text style={[styles.errorText, { marginBottom: 10 }]}>{devotionsError}</Text>
                                <Pressable onPress={() => loadDevotions(editionItem.id)} style={styles.actionBtnPill}>
                                  <AppIcon name="refresh" size={12} tintColor={DewDesign.colors.forest} />
                                  <Text style={styles.actionBtnLabel}>Retry</Text>
                                </Pressable>
                              </View>
                            ) : devotions.length === 0 ? (
                              <Text style={[styles.emptyText, isDark && styles.darkMuted, { marginVertical: 12, textAlign: 'left' }]}>
                                No meditations have been added to this edition yet. Tap &quot;+ Add Meditation&quot; or &quot;Import PDF&quot; to add content.
                              </Text>
                            ) : (
                              devotions.map((devotionItem) => (
                                <View key={devotionItem.id} style={[styles.editionCard, isDark && styles.darkCard, { marginBottom: 8, padding: 12 }]}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                      <Text style={[styles.editionTitle, isDark && styles.darkInk, { fontSize: 14 }]}>
                                        {`Day ${devotionItem.day_number}: ${devotionItem.title}`}
                                      </Text>
                                      <Text style={[styles.editionMeta, isDark && styles.darkMuted]}>
                                        {devotionItem.scripture_reference}
                                      </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                      <Pressable
                                        onPress={() => {
                                          setEditingDevotionId(devotionItem.id);
                                          setForm({
                                            day: String(devotionItem.day_number),
                                            weekday: devotionItem.weekday,
                                            title: devotionItem.title,
                                            scriptureReference: devotionItem.scripture_reference,
                                            scriptureText: devotionItem.scripture_text ?? '',
                                            meditation: devotionItem.meditation,
                                            furtherStudies: (devotionItem.further_studies ?? []).join(', '),
                                            wisdom: devotionItem.wisdom_nugget ?? '',
                                            declaration: devotionItem.declaration ?? '',
                                          });
                                          setShowComposer(true);
                                        }}
                                        style={styles.actionBtnPill}>
                                        <AppIcon name="pencil" size={12} tintColor={DewDesign.colors.forest} />
                                      </Pressable>
                                      <Pressable onPress={() => deleteDevotion(devotionItem)} style={styles.actionBtnPill}>
                                        <AppIcon name="trash" size={12} tintColor={DewDesign.colors.terracotta} />
                                      </Pressable>
                                    </View>
                                  </View>
                                </View>
                              ))
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              ) : adminTab === 'newsletters' ? (
                /* TAB 2: NEWSLETTER STUDIO */
                <View style={[adminExtraStyles.adminPanel, isDark && styles.darkCard]}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>Newsletter Studio</Text>
                  <Text style={[adminExtraStyles.panelIntro, isDark && styles.darkMuted]}>
                    {`${subscriberCount} opted-in subscribers ready to receive devotional campaigns.`}
                  </Text>

                  {/* Newsletter Composer */}
                  <TextInput
                    value={newsletter.subject}
                    onChangeText={(v) => setNewsletter((c) => ({ ...c, subject: v }))}
                    placeholder="Campaign Subject"
                    placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                    style={[styles.formInput, isDark && styles.darkFormInput]}
                  />
                  <TextInput
                    value={newsletter.body}
                    onChangeText={(v) => setNewsletter((c) => ({ ...c, body: v }))}
                    placeholder="Newsletter content / devotional reflection..."
                    placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                    multiline
                    style={[styles.formInput, styles.formTextAreaLarge, isDark && styles.darkFormInput]}
                  />

                  <Pressable disabled={saving} onPress={saveNewsletter} style={[styles.saveButton, saving && styles.disabledButton, { marginBottom: 20 }]}>
                    <Text style={styles.publishButtonText}>{saving ? 'Saving...' : editingCampaignId ? 'Update Draft' : 'Save Draft'}</Text>
                  </Pressable>

                  {/* Campaign History */}
                  <Text style={[adminExtraStyles.panelHeading, isDark && styles.darkInk]}>Campaign History</Text>
                  {campaigns.map((campaign) => (
                    <View key={campaign.id} style={[styles.editionCard, isDark && styles.darkCard]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.editionTitle, isDark && styles.darkInk]} numberOfLines={1}>{campaign.subject}</Text>
                          <Text style={[styles.editionMeta, isDark && styles.darkMuted]}>{`Status: ${campaign.status.toUpperCase()} · ${new Date(campaign.created_at).toLocaleDateString()}`}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <Pressable onPress={() => editNewsletter(campaign)} style={styles.actionBtnPill}>
                            <AppIcon name="pencil" size={12} tintColor={DewDesign.colors.forest} />
                          </Pressable>
                          <Pressable onPress={() => deleteNewsletter(campaign)} style={styles.actionBtnPill}>
                            <AppIcon name="trash" size={12} tintColor={DewDesign.colors.terracotta} />
                          </Pressable>
                          {campaign.status === 'draft' ? (
                            <Pressable onPress={() => sendNewsletter(campaign.id)} style={[styles.actionBtnPill, { backgroundColor: DewDesign.colors.forest }]}>
                              <AppIcon name="paperplane.fill" size={12} tintColor="#FFFFFF" />
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  ))}
                  {!campaigns.length && (
                    <Text style={[styles.emptyText, isDark && styles.darkMuted]}>No newsletter drafts yet.</Text>
                  )}
                </View>
              ) : adminTab === 'users' ? (
                /* TAB 3: USER MANAGEMENT (ADMIN ONLY) */
                <View style={[adminExtraStyles.adminPanel, isDark && styles.darkCard]}>
                  <View style={styles.composerHeader}>
                    <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>User Accounts & Roles</Text>
                    {role === 'admin' ? (
                      <Pressable
                        onPress={() => setShowCreateUserModal(true)}
                        style={[styles.iconPillButton, isDark && styles.darkIconPillButton]}
                        accessibilityRole="button"
                        accessibilityLabel="Create User">
                        <AppIcon name="plus" size={18} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                      </Pressable>
                    ) : null}
                  </View>

                  {loadingUsers ? (
                    <ActivityIndicator size="small" color={DewDesign.colors.forest} style={{ marginVertical: 20 }} />
                  ) : usersError ? (
                    <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                      <Text style={[styles.errorText, { marginBottom: 12 }]}>{usersError}</Text>
                      <Pressable onPress={loadUsers} style={styles.actionBtnPill}>
                        <AppIcon name="refresh" size={12} tintColor={DewDesign.colors.forest} />
                        <Text style={styles.actionBtnLabel}>Retry</Text>
                      </Pressable>
                    </View>
                  ) : usersList.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                      <Text style={[styles.emptyTitle, isDark && styles.darkInk, { fontSize: 16 }]}>No user accounts found</Text>
                      <Text style={[styles.emptyText, isDark && styles.darkMuted, { marginBottom: 14 }]}>Tap &quot;Create User&quot; to add an account.</Text>
                      {role === 'admin' ? (
                        <Pressable onPress={() => setShowCreateUserModal(true)} style={styles.primaryButton}>
                          <Text style={styles.primaryButtonText}>Create User</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    usersList.map((userItem) => {
                      const isProfileOnly = userItem.auth_account_missing;
                      const isAuthOnly = (userItem as any).profile_missing;
                      return (
                        <View key={userItem.id} style={[styles.editionCard, isDark && styles.darkCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={[styles.editionTitle, isDark && styles.darkInk, isProfileOnly && styles.warningText]}>
                              {userItem.email ?? (language === 'fr' ? 'Compte d’authentification manquant' : 'Authentication account missing')}
                            </Text>
                            <Text style={[styles.editionMeta, isDark && styles.darkMuted]}>
                              {isProfileOnly
                                ? 'PROFILE ONLY / AUTH MISSING'
                                : isAuthOnly
                                ? 'AUTH ONLY / PROFILE MISSING'
                                : `Role: ${userItem.role.toUpperCase()}`}
                            </Text>
                          </View>
                          {role === 'admin' && !isAuthOnly ? (
                            <Pressable
                              onPress={() => setEditingUser({ id: userItem.id, role: userItem.role, email: userItem.email })}
                              style={styles.actionBtnPill}>
                              <AppIcon name="pencil" size={12} tintColor={DewDesign.colors.forest} />
                              <Text style={styles.actionBtnLabel}>Role</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </View>
              ) : adminTab === 'finance' ? (
                /* TAB 4: FINANCIAL LEDGER (ADMIN ONLY) */
                <View style={[adminExtraStyles.adminPanel, isDark && styles.darkCard]}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>Financial Ledgers & Revenue</Text>

                  {/* Summary Metric Cards in 2x2 Grid */}
                  {financials?.summary ? (
                    <View style={adminExtraStyles.metricGrid}>
                      <View style={adminExtraStyles.metricCard}>
                        <Text style={adminExtraStyles.metricValue}>{`${(financials.summary.totalSuccessfulDepositXaf || 0).toLocaleString()} XAF`}</Text>
                        <Text style={adminExtraStyles.metricLabel}>Total Wallet Deposits</Text>
                      </View>
                      <View style={adminExtraStyles.metricCard}>
                        <Text style={adminExtraStyles.metricValue}>{`${(financials.summary.totalDonationsXaf || 0).toLocaleString()} XAF`}</Text>
                        <Text style={adminExtraStyles.metricLabel}>Total Voluntary Gifts</Text>
                      </View>
                      <View style={adminExtraStyles.metricCard}>
                        <Text style={adminExtraStyles.metricValue}>{`${(financials.summary.totalSubscriptionRevenueXaf || 0).toLocaleString()} XAF`}</Text>
                        <Text style={adminExtraStyles.metricLabel}>Subscription Revenue</Text>
                      </View>
                      <View style={adminExtraStyles.metricCard}>
                        <Text style={adminExtraStyles.metricValue}>{financials.summary.activeSubscribersCount || 0}</Text>
                        <Text style={adminExtraStyles.metricLabel}>Active Subscribers</Text>
                      </View>
                    </View>
                  ) : loadingFinance ? (
                    <ActivityIndicator color={DewDesign.colors.forest} style={{ marginVertical: 20 }} />
                  ) : null}

                  {/* Segmented Ledger Switcher */}
                  <View style={{ flexDirection: 'row', gap: 6, marginVertical: 14 }}>
                    {(['payments', 'wallet', 'subscriptions', 'donations'] as const).map((led) => (
                      <Pressable
                        key={led}
                        onPress={() => { setFinanceLedger(led); setFinancePage(1); }}
                        style={[styles.statusButton, financeLedger === led && styles.publishButton, { flex: 1, alignItems: 'center' }]}>
                        <Text style={[styles.statusButtonText, financeLedger === led && styles.publishButtonText]}>{led.toUpperCase()}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={[adminExtraStyles.panelHeading, isDark && styles.darkInk, { marginTop: 0 }]}>
                      {`${financeLedger.toUpperCase()} LEDGER (${financials?.total ?? 0} total)`}
                    </Text>
                    {loadingFinance ? <ActivityIndicator size="small" color={DewDesign.colors.forest} /> : null}
                  </View>

                  {/* Paginated Ledger Rows */}
                  {(financials?.rows ?? []).map((row: any) => (
                    <Pressable
                      key={row.id}
                      onPress={() => setSelectedTxDetails(row)}
                      style={[styles.editionCard, isDark && styles.darkCard]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.editionTitle, isDark && styles.darkInk]}>
                            {`${(row.amount || 0).toLocaleString()} ${row.currency ?? 'XAF'}`}
                          </Text>
                          <Text style={[styles.editionMeta, isDark && styles.darkMuted]} numberOfLines={1}>
                            {row.purpose
                              ? `Purpose: ${row.purpose} · ${new Date(row.created_at).toLocaleDateString()}`
                              : row.type
                              ? `Type: ${row.type.toUpperCase()} · ${new Date(row.created_at).toLocaleDateString()}`
                              : new Date(row.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                        {row.status ? (
                          <View style={[styles.statusButton, row.status === 'successful' && styles.publishButton]}>
                            <Text style={[styles.statusButtonText, row.status === 'successful' && styles.publishButtonText]}>{String(row.status).toUpperCase()}</Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}

                  {/* Pagination Controls */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                    <Pressable
                      disabled={financePage <= 1 || loadingFinance}
                      onPress={() => setFinancePage((p) => Math.max(1, p - 1))}
                      style={[styles.actionBtnPill, (financePage <= 1 || loadingFinance) && styles.disabledButton]}>
                      <AppIcon name="chevron.left" size={14} tintColor={DewDesign.colors.forest} />
                      <Text style={styles.actionBtnLabel}>Previous</Text>
                    </Pressable>

                    <Text style={[styles.editionMeta, isDark && styles.darkMuted]}>{`Page ${financials?.page ?? 1} of ${Math.ceil((financials?.total ?? 1) / (financials?.pageSize ?? 25)) || 1}`}</Text>

                    <Pressable
                      disabled={!financials?.hasMore || loadingFinance}
                      onPress={() => setFinancePage((p) => p + 1)}
                      style={[styles.actionBtnPill, (!financials?.hasMore || loadingFinance) && styles.disabledButton]}>
                      <Text style={styles.actionBtnLabel}>Next</Text>
                      <AppIcon name="chevron.right" size={14} tintColor={DewDesign.colors.forest} />
                    </Pressable>
                  </View>
                </View>
              ) : adminTab === 'analytics' ? (
                /* TAB 5: APP ANALYTICS & DAILY STATS */
                <View style={[adminExtraStyles.adminPanel, isDark && styles.darkCard]}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'appAnalytics')}</Text>
                  <Text style={[adminExtraStyles.panelIntro, isDark && styles.darkMuted]}>
                    Aggregate reader activity from the last 30 days.
                  </Text>
                  <View style={adminExtraStyles.metricGrid}>
                    <View style={adminExtraStyles.metricCard}>
                      <Text style={adminExtraStyles.metricValue}>{activeReaders}</Text>
                      <Text style={adminExtraStyles.metricLabel}>Active readers</Text>
                    </View>
                    <View style={adminExtraStyles.metricCard}>
                      <Text style={adminExtraStyles.metricValue}>{completedCount}</Text>
                      <Text style={adminExtraStyles.metricLabel}>Completions</Text>
                    </View>
                    <View style={adminExtraStyles.metricCard}>
                      <Text style={adminExtraStyles.metricValue}>{completionRate}%</Text>
                      <Text style={adminExtraStyles.metricLabel}>Reader rate</Text>
                    </View>
                  </View>

                  <Text style={[adminExtraStyles.panelHeading, isDark && styles.darkInk, { marginTop: 18 }]}>Daily Activity (30 Days)</Text>
                  {dailyOpens.map((item) => (
                    <View key={item.day} style={[adminExtraStyles.activityRow, isDark && { borderColor: DewDesign.colors.darkLine }]}>
                      <Text style={[styles.detailText, isDark && styles.darkMuted]}>{item.day}</Text>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Text style={[styles.detailText, isDark && styles.darkMuted]}>{`${item.opens} opens`}</Text>
                        <Text style={[styles.detailText, { color: DewDesign.colors.forest, fontWeight: '700' }]}>{`${item.completions} completions`}</Text>
                      </View>
                    </View>
                  ))}
                  {!dailyOpens.length && (
                    <Text style={[styles.emptyText, isDark && styles.darkMuted]}>
                      {language === 'fr' ? 'Les statistiques apparaîtront lorsque les lecteurs ouvriront l’application.' : 'Analytics will appear as readers open the app.'}
                    </Text>
                  )}
                </View>
              ) : null}
            </>
          ) : (
            <View style={[styles.denied, isDark && styles.darkCard]}>
              <AppIcon name="lock" size={24} tintColor={DewDesign.colors.terracotta} />
              <Text style={[styles.emptyTitle, isDark && styles.darkInk]}>Editor access required</Text>
            </View>
          )}
        </ScrollView>

        <AdminBottomNav activeTab={adminTab} onChange={setAdminTab} />

        {/* Transaction Details Modal */}
        <Modal visible={Boolean(selectedTxDetails)} transparent animationType="slide" onRequestClose={() => setSelectedTxDetails(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={adminExtraStyles.modalBackdrop}>
            <View style={[adminExtraStyles.modalPanel, isDark && styles.darkCard]}>
              <ScrollView style={adminExtraStyles.modalScroll} contentContainerStyle={adminExtraStyles.modalContent}>
                <View style={styles.composerHeader}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>Transaction Details</Text>
                  <Pressable onPress={() => setSelectedTxDetails(null)}>
                    <AppIcon name="xmark" size={18} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                  </Pressable>
                </View>

                <View style={[styles.editionCard, isDark && styles.darkCard]}>
                  <Text style={[styles.fieldLabel, isDark && styles.darkMuted]}>{`ID: ${selectedTxDetails?.id}`}</Text>
                  <Text style={[styles.fieldLabel, isDark && styles.darkMuted]}>{`User ID: ${selectedTxDetails?.user_id}`}</Text>
                  <Text style={[styles.fieldLabel, isDark && styles.darkMuted]}>{`Amount: ${(selectedTxDetails?.amount || 0).toLocaleString()} ${selectedTxDetails?.currency ?? 'XAF'}`}</Text>
                  <Text style={[styles.fieldLabel, isDark && styles.darkMuted]}>{`Status: ${selectedTxDetails?.status ?? 'N/A'}`}</Text>
                  <Text style={[styles.fieldLabel, isDark && styles.darkMuted]}>{`Created: ${new Date(selectedTxDetails?.created_at || Date.now()).toLocaleString()}`}</Text>
                  {selectedTxDetails?.provider_transaction_id ? (
                    <Text style={[styles.fieldLabel, isDark && styles.darkMuted]}>{`Provider Ref: ${selectedTxDetails.provider_transaction_id}`}</Text>
                  ) : null}
                  {selectedTxDetails?.external_reference ? (
                    <Text style={[styles.fieldLabel, isDark && styles.darkMuted]}>{`External Ref: ${selectedTxDetails.external_reference}`}</Text>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Create User Modal */}
        <Modal visible={showCreateUserModal} transparent animationType="slide" onRequestClose={() => { setShowCreateUserModal(false); setShowPassword(false); }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={adminExtraStyles.modalBackdrop}>
            <View style={[adminExtraStyles.modalPanel, isDark && styles.darkCard]}>
              <ScrollView style={adminExtraStyles.modalScroll} contentContainerStyle={adminExtraStyles.modalContent}>
                <View style={styles.composerHeader}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>Create New User Account</Text>
                  <Pressable onPress={() => { setShowCreateUserModal(false); setShowPassword(false); }}>
                    <AppIcon name="xmark" size={18} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                  </Pressable>
                </View>

                <TextInput
                  value={createUserForm.email}
                  onChangeText={(v) => setCreateUserForm((c) => ({ ...c, email: v }))}
                  placeholder="User Email"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  keyboardType="email-address"
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />
                <View style={{ position: 'relative', marginBottom: 10 }}>
                  <TextInput
                    value={createUserForm.password}
                    onChangeText={(v) => setCreateUserForm((c) => ({ ...c, password: v }))}
                    placeholder="Temporary Password (min 6 chars)"
                    placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                    secureTextEntry={!showPassword}
                    style={[styles.formInput, isDark && styles.darkFormInput, { paddingRight: 48, marginBottom: 0 }]}
                  />
                  <Pressable
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={{ position: 'absolute', right: 0, top: 0, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                    <AppIcon name={showPassword ? 'eye' : 'eye.slash'} size={18} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                  </Pressable>
                </View>

                <Text style={[styles.fieldLabel, isDark && styles.darkMuted]}>Account Role</Text>
                <View style={styles.formRow}>
                  {(['reader', 'editor', 'admin'] as const).map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setCreateUserForm((c) => ({ ...c, role: r }))}
                      style={[styles.langChoicePill, createUserForm.role === r && styles.activeLangChoice]}>
                      <Text style={[styles.langChoiceText, createUserForm.role === r && styles.activeLangChoiceText]}>{r.toUpperCase()}</Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable disabled={saving} onPress={handleCreateUser} style={[styles.saveButton, saving && styles.disabledButton]}>
                  <Text style={styles.publishButtonText}>{saving ? 'Creating...' : 'Create User'}</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Edit User Role Modal */}
        <Modal visible={Boolean(editingUser)} transparent animationType="slide" onRequestClose={() => setEditingUser(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={adminExtraStyles.modalBackdrop}>
            <View style={[adminExtraStyles.modalPanel, isDark && styles.darkCard]}>
              <ScrollView style={adminExtraStyles.modalScroll} contentContainerStyle={adminExtraStyles.modalContent}>
                <View style={styles.composerHeader}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>Update User Role</Text>
                  <Pressable onPress={() => setEditingUser(null)}>
                    <AppIcon name="xmark" size={18} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                  </Pressable>
                </View>

                <Text style={[styles.fieldLabel, isDark && styles.darkMuted]}>Select Role</Text>
                <View style={styles.formRow}>
                  {(['reader', 'editor', 'admin'] as const).map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setEditingUser((c) => (c ? { ...c, role: r } : null))}
                      style={[styles.langChoicePill, editingUser?.role === r && styles.activeLangChoice]}>
                      <Text style={[styles.langChoiceText, editingUser?.role === r && styles.activeLangChoiceText]}>{r.toUpperCase()}</Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable disabled={saving} onPress={() => editingUser && handleUpdateUserRole(editingUser.id, editingUser.role)} style={[styles.saveButton, saving && styles.disabledButton]}>
                  <Text style={styles.publishButtonText}>{saving ? 'Updating...' : 'Update Role'}</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* PDF Import Review Modal */}
        <Modal visible={Boolean(reviewingImport)} transparent animationType="slide" onRequestClose={() => setReviewingImport(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={adminExtraStyles.modalBackdrop}>
            <View style={[adminExtraStyles.modalPanel, isDark && styles.darkCard]}>
              <ScrollView style={adminExtraStyles.modalScroll} contentContainerStyle={adminExtraStyles.modalContent}>
                <View style={styles.composerHeader}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkInk]} numberOfLines={1}>{`Review PDF: ${reviewingImport?.source_name}`}</Text>
                  <Pressable onPress={() => setReviewingImport(null)}>
                    <AppIcon name="xmark" size={18} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                  </Pressable>
                </View>

                <Text style={[styles.fieldLabel, isDark && styles.darkMuted]}>{`${reviewingImport?.extracted_data?.days?.length ?? 0} days extracted`}</Text>
                {(reviewingImport?.extracted_data?.days ?? []).map((day) => (
                  <View key={day.day_number} style={[styles.editionCard, isDark && styles.darkCard, { marginBottom: 8 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.editionTitle, isDark && styles.darkInk]}>{`Day ${day.day_number}: ${day.title}`}</Text>
                        <Text style={[styles.editionMeta, isDark && styles.darkMuted]}>{day.scripture_reference}</Text>
                      </View>
                      <Pressable onPress={() => openDayReview(day)} style={styles.actionBtnPill}>
                        <AppIcon name="pencil" size={12} tintColor={DewDesign.colors.forest} />
                        <Text style={styles.actionBtnLabel}>Review Day</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}

                {selectedEditionId ? (
                  <Pressable disabled={saving} onPress={() => approveImport(selectedEditionId)} style={[styles.saveButton, { marginTop: 12 }, saving && styles.disabledButton]}>
                    <Text style={styles.publishButtonText}>{saving ? 'Importing...' : 'Approve & Import to Edition'}</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.fieldLabel, { color: DewDesign.colors.terracotta, marginTop: 12 }]}>Select an edition on the Content tab to import into.</Text>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Single Day Review Modal */}
        <Modal visible={Boolean(reviewingDay)} transparent animationType="slide" onRequestClose={() => setReviewingDay(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={adminExtraStyles.modalBackdrop}>
            <View style={[adminExtraStyles.modalPanel, isDark && styles.darkCard]}>
              <ScrollView style={adminExtraStyles.modalScroll} contentContainerStyle={adminExtraStyles.modalContent}>
                <View style={styles.composerHeader}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{`Edit Day ${reviewingDay?.day_number}`}</Text>
                  <Pressable onPress={() => setReviewingDay(null)}>
                    <AppIcon name="xmark" size={18} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                  </Pressable>
                </View>

                <TextInput
                  value={reviewDayForm.title}
                  onChangeText={(v) => setReviewDayForm((c) => ({ ...c, title: v }))}
                  placeholder="Day Title"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={reviewDayForm.scriptureReference}
                  onChangeText={(v) => setReviewDayForm((c) => ({ ...c, scriptureReference: v }))}
                  placeholder="Scripture Reference"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={reviewDayForm.meditation}
                  onChangeText={(v) => setReviewDayForm((c) => ({ ...c, meditation: v }))}
                  placeholder="Meditation Text"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  multiline
                  style={[styles.formInput, styles.formTextArea, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={reviewDayForm.wisdom}
                  onChangeText={(v) => setReviewDayForm((c) => ({ ...c, wisdom: v }))}
                  placeholder="Wisdom Nugget"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={reviewDayForm.declaration}
                  onChangeText={(v) => setReviewDayForm((c) => ({ ...c, declaration: v }))}
                  placeholder="Declaration"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />

                <Pressable disabled={saving} onPress={saveDayReview} style={[styles.saveButton, saving && styles.disabledButton]}>
                  <Text style={styles.publishButtonText}>{saving ? 'Saving...' : 'Save Day Review'}</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Delete PDF Confirmation Modal */}
        <Modal visible={Boolean(deletingPdf)} transparent animationType="fade" onRequestClose={() => setDeletingPdf(null)}>
          <View style={adminExtraStyles.modalBackdrop}>
            <View style={[adminExtraStyles.modalPanel, isDark && styles.darkCard, { padding: 22 }]}>
              <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>Delete PDF Import?</Text>
              <Text style={[styles.emptyText, isDark && styles.darkMuted, { marginBottom: 18 }]}>{`Are you sure you want to delete "${deletingPdf?.source_name}"?`}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => setDeletingPdf(null)} style={[styles.actionBtnPill, { flex: 1, justifyContent: 'center' }]}>
                  <Text style={styles.actionBtnLabel}>Cancel</Text>
                </Pressable>
                <Pressable onPress={deletePdf} style={[styles.actionBtnPill, { flex: 1, justifyContent: 'center', backgroundColor: DewDesign.colors.terracotta }]}>
                  <Text style={[styles.actionBtnLabel, { color: '#FFFFFF' }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Edition Composer Modal */}
        <Modal visible={showEditionComposer} transparent animationType="slide" onRequestClose={() => setShowEditionComposer(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={adminExtraStyles.modalBackdrop}>
            <View style={[adminExtraStyles.modalPanel, isDark && styles.darkCard]}>
              <ScrollView style={adminExtraStyles.modalScroll} contentContainerStyle={adminExtraStyles.modalContent}>
                <View style={styles.composerHeader}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{editingEditionId ? 'Edit month' : 'Create new month'}</Text>
                  <Pressable onPress={() => setShowEditionComposer(false)}>
                    <AppIcon name="xmark" size={18} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                  </Pressable>
                </View>

                {/* Integrated Language Switcher inside form */}
                <Text style={[styles.fieldLabel, isDark && styles.darkMuted]}>Language</Text>
                <View style={styles.formRow}>
                  <Pressable
                    onPress={() => setEditionForm((c) => ({ ...c, language: 'en' }))}
                    style={[styles.langChoicePill, editionForm.language === 'en' && styles.activeLangChoice]}>
                    <Text style={[styles.langChoiceText, editionForm.language === 'en' && styles.activeLangChoiceText]}>English</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditionForm((c) => ({ ...c, language: 'fr' }))}
                    style={[styles.langChoicePill, editionForm.language === 'fr' && styles.activeLangChoice]}>
                    <Text style={[styles.langChoiceText, editionForm.language === 'fr' && styles.activeLangChoiceText]}>Français</Text>
                  </Pressable>
                </View>

                <TextInput
                  value={editionForm.slug}
                  onChangeText={(v) => setEditionForm((c) => ({ ...c, slug: v }))}
                  placeholder="Edition slug (e.g. shiloh-2026)"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={editionForm.title}
                  onChangeText={(v) => setEditionForm((c) => ({ ...c, title: v }))}
                  placeholder="Month title (e.g. July 2026)"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={editionForm.theme}
                  onChangeText={(v) => setEditionForm((c) => ({ ...c, theme: v }))}
                  placeholder="Theme (e.g. Walking in Grace)"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={editionForm.introduction}
                  onChangeText={(v) => setEditionForm((c) => ({ ...c, introduction: v }))}
                  placeholder="Theme introduction shown on Home"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  multiline
                  style={[styles.formInput, styles.formTextArea, isDark && styles.darkFormInput]}
                />
                <View style={styles.formRow}>
                  <TextInput
                    value={editionForm.month}
                    onChangeText={(v) => setEditionForm((c) => ({ ...c, month: v }))}
                    placeholder="Month (1-12)"
                    placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                    keyboardType="number-pad"
                    style={[styles.formInput, styles.formHalf, isDark && styles.darkFormInput]}
                  />
                  <TextInput
                    value={editionForm.year}
                    onChangeText={(v) => setEditionForm((c) => ({ ...c, year: v }))}
                    placeholder="Year (e.g. 2026)"
                    placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                    keyboardType="number-pad"
                    style={[styles.formInput, styles.formHalf, isDark && styles.darkFormInput]}
                  />
                </View>

                <Pressable disabled={saving} onPress={saveEdition} style={[styles.saveButton, saving && styles.disabledButton]}>
                  <Text style={styles.publishButtonText}>{saving ? 'Saving...' : 'Save month'}</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Meditation Composer Modal */}
        <Modal visible={showComposer} transparent animationType="slide" onRequestClose={() => setShowComposer(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={adminExtraStyles.modalBackdrop}>
            <View style={[adminExtraStyles.modalPanel, isDark && styles.darkCard]}>
              <ScrollView style={adminExtraStyles.modalScroll} contentContainerStyle={adminExtraStyles.modalContent}>
                <View style={styles.composerHeader}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{editingDevotionId ? 'Edit Meditation' : 'Add Meditation'}</Text>
                  <Pressable onPress={() => setShowComposer(false)}>
                    <AppIcon name="xmark" size={18} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                  </Pressable>
                </View>

                <View style={styles.formRow}>
                  <TextInput
                    value={form.day}
                    onChangeText={(v) => setForm((c) => ({ ...c, day: v }))}
                    placeholder="Day #"
                    placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                    keyboardType="number-pad"
                    style={[styles.formInput, styles.formHalf, isDark && styles.darkFormInput]}
                  />
                  <TextInput
                    value={form.weekday}
                    onChangeText={(v) => setForm((c) => ({ ...c, weekday: v }))}
                    placeholder="Weekday (e.g. Monday)"
                    placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                    style={[styles.formInput, styles.formHalf, isDark && styles.darkFormInput]}
                  />
                </View>

                <TextInput
                  value={form.title}
                  onChangeText={(v) => setForm((c) => ({ ...c, title: v }))}
                  placeholder="Meditation Title"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={form.scriptureReference}
                  onChangeText={(v) => setForm((c) => ({ ...c, scriptureReference: v }))}
                  placeholder="Scripture Reference (e.g. Psalm 119:105)"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={form.scriptureText}
                  onChangeText={(v) => setForm((c) => ({ ...c, scriptureText: v }))}
                  placeholder="Full Scripture Passages (Optional)"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  multiline
                  style={[styles.formInput, styles.formTextArea, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={form.meditation}
                  onChangeText={(v) => setForm((c) => ({ ...c, meditation: v }))}
                  placeholder="Meditation Body"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  multiline
                  style={[styles.formInput, styles.formTextAreaLarge, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={form.wisdom}
                  onChangeText={(v) => setForm((c) => ({ ...c, wisdom: v }))}
                  placeholder="Wisdom Nugget"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={form.declaration}
                  onChangeText={(v) => setForm((c) => ({ ...c, declaration: v }))}
                  placeholder="Declaration"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={form.furtherStudies}
                  onChangeText={(v) => setForm((c) => ({ ...c, furtherStudies: v }))}
                  placeholder="Further Studies (comma separated)"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />

                <Pressable disabled={saving} onPress={saveMeditation} style={[styles.saveButton, saving && styles.disabledButton]}>
                  <Text style={styles.publishButtonText}>{saving ? 'Saving...' : 'Save Meditation'}</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DewDesign.colors.canvas },
  safeArea: { flex: 1 },
  darkScreen: { backgroundColor: DewDesign.colors.darkCanvas },
  darkCard: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine },
  darkInk: { color: DewDesign.colors.darkInk },
  darkMuted: { color: DewDesign.colors.darkMuted },
  content: { paddingHorizontal: DewDesign.spacing.screen, paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  pageIntro: { paddingTop: 22, paddingBottom: 24 },
  eyebrow: { color: DewDesign.colors.terracotta, fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: DewDesign.colors.ink, fontFamily: 'serif', fontSize: 34, fontWeight: '700', marginTop: 8 },
  subtitle: { color: DewDesign.colors.body, fontSize: 15, lineHeight: 23, marginTop: 8 },
  loader: { marginTop: 40 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  summaryCard: { flex: 1, backgroundColor: DewDesign.colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: DewDesign.colors.line },
  summaryValue: { color: DewDesign.colors.forest, fontSize: 24, fontWeight: '900' },
  summaryLabel: { color: DewDesign.colors.muted, fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: DewDesign.colors.ink, fontSize: 20, fontWeight: '900', marginBottom: 12 },
  editionCard: { backgroundColor: DewDesign.colors.surface, borderRadius: 16, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: DewDesign.colors.line },
  editionHeader: { flexDirection: 'row', alignItems: 'center' },
  editionIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: DewDesign.colors.terracottaSoft, alignItems: 'center', justifyContent: 'center' },
  editionCopy: { flex: 1, marginLeft: 11 },
  editionTitle: { color: DewDesign.colors.ink, fontSize: 16, fontWeight: '900' },
  editionMeta: { color: DewDesign.colors.muted, fontSize: 11, marginTop: 4 },
  statusPill: { display: 'none' },
  statusPublished: { backgroundColor: DewDesign.colors.forestSoft },
  statusReview: { backgroundColor: DewDesign.colors.terracottaSoft },
  statusText: { color: DewDesign.colors.forest, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  editionDetails: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: DewDesign.colors.line, flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingVertical: 11 },
  detailText: { color: DewDesign.colors.body, fontSize: 12, fontWeight: '700' },
  warningText: { color: DewDesign.colors.terracotta },
  statusActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 12, alignItems: 'center' },
  statusButton: { minHeight: 34, borderRadius: 9, backgroundColor: DewDesign.colors.surfaceMuted, justifyContent: 'center', paddingHorizontal: 11 },
  statusButtonText: { color: DewDesign.colors.forest, fontSize: 11, fontWeight: '800' },
  publishButton: { backgroundColor: DewDesign.colors.forest },
  publishButtonText: { color: DewDesign.colors.white, fontSize: 11, fontWeight: '800' },
  actionBtnPill: {
    height: 36,
    borderRadius: DewDesign.radius.full,
    backgroundColor: DewDesign.colors.forestSoft,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  darkActionBtnPill: { backgroundColor: DewDesign.colors.darkSurfaceMuted },
  iconPillButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: DewDesign.colors.forestSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkIconPillButton: {
    backgroundColor: DewDesign.colors.darkSurfaceMuted,
  },
  actionBtnLabel: { color: DewDesign.colors.forest, fontSize: 12, fontWeight: '800' },
  actionBtnLabelWhite: { color: DewDesign.colors.white, fontSize: 12, fontWeight: '800' },
  denied: { backgroundColor: DewDesign.colors.surface, borderRadius: 16, alignItems: 'center', padding: 28, marginTop: 24, borderWidth: 1, borderColor: DewDesign.colors.line },
  emptyTitle: { color: DewDesign.colors.ink, fontSize: 18, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  emptyText: { color: DewDesign.colors.body, fontSize: 13, lineHeight: 20, marginTop: 7, textAlign: 'center' },
  errorText: { color: DewDesign.colors.terracotta, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  primaryButton: { backgroundColor: DewDesign.colors.forest, borderRadius: 11, marginTop: 18, minHeight: 44, paddingHorizontal: 22, justifyContent: 'center' },
  primaryButtonText: { color: DewDesign.colors.white, fontSize: 13, fontWeight: '800' },
  addButton: { backgroundColor: DewDesign.colors.terracotta },
  composerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  composerMeta: { color: DewDesign.colors.terracotta, fontSize: 12, fontWeight: '800' },
  fieldLabel: { color: DewDesign.colors.body, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  langChoicePill: { flex: 1, height: 38, borderRadius: 10, backgroundColor: DewDesign.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  activeLangChoice: { backgroundColor: DewDesign.colors.forest },
  langChoiceText: { color: DewDesign.colors.forest, fontSize: 12, fontWeight: '800' },
  activeLangChoiceText: { color: DewDesign.colors.white },
  formRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  formHalf: { flex: 1 },
  formInput: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: DewDesign.colors.line, backgroundColor: DewDesign.colors.surface, color: DewDesign.colors.ink, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginBottom: 10 },
  darkFormInput: { backgroundColor: DewDesign.colors.darkSurface, borderColor: DewDesign.colors.darkLine, color: DewDesign.colors.darkInk },
  formTextArea: { minHeight: 80, textAlignVertical: 'top' },
  formTextAreaLarge: { minHeight: 150, textAlignVertical: 'top' },
  saveButton: { minHeight: 46, borderRadius: 11, backgroundColor: DewDesign.colors.forest, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  disabledButton: { opacity: 0.6 },
  cancelEditLink: { color: DewDesign.colors.terracotta, fontSize: 12, fontWeight: '800' },
});
