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
import AdminBottomNav from '@/components/admin-bottom-nav';
import { useSettings } from '@/context/settings-context';
import { t } from '@/lib/i18n';
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
type AdminTab = 'content' | 'newsletters' | 'analytics';
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

export default function AdminScreen() {
  const { session } = useAuth();
  const { themeMode, language } = useSettings();
  const isDark = themeMode === 'dark';

  const [role, setRole] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>('content');
  const [editions, setEditions] = useState<Edition[]>([]);
  const [devotions, setDevotions] = useState<Devotion[]>([]);
  const [loading, setLoading] = useState(true);
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

  const [dailyOpens, setDailyOpens] = useState<{ day: string; count: number }[]>([]);
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
      Alert.alert('Dashboard unavailable', error.message);
    } else {
      setEditions(
        (data ?? []).map((edition) => ({
          ...edition,
          devotionCount: Array.isArray(edition.devotions) ? Number(edition.devotions[0]?.count ?? 0) : 0,
        })) as Edition[],
      );
    }

    const [{ data: eventRows }, { data: campaignRows }, { count: optedInCount }] = await Promise.all([
      supabase
        .from('app_events')
        .select('created_at, user_id, event_type, metadata')
        .in('event_type', ['app_open', 'meditation_completed'])
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      supabase.from('newsletter_campaigns').select('id, subject, body, status, created_at').order('created_at', { ascending: false }),
      supabase.from('newsletter_subscribers').select('user_id', { count: 'exact', head: true }).eq('opted_in', true),
    ]);

    setSubscriberCount(optedInCount ?? 0);
    const { data: importRows } = await supabase
      .from('devotional_imports')
      .select('id, source_name, storage_path, status, error_message, created_at, extracted_data')
      .order('created_at', { ascending: false });
    setPdfImports((importRows ?? []) as PdfImport[]);

    const grouped = new Map<string, number>();
    const readers = new Set<string>();
    const completedReaders = new Set<string>();
    let completions = 0;

    (eventRows ?? []).forEach((event) => {
      const metadata = event.metadata && typeof event.metadata === 'object' ? (event.metadata as { installation_id?: unknown }) : null;
      const installationId = typeof metadata?.installation_id === 'string' ? metadata.installation_id : null;
      const actorId = event.user_id ?? installationId;
      if (actorId) readers.add(actorId);
      if (event.event_type === 'app_open') grouped.set(event.created_at.slice(0, 10), (grouped.get(event.created_at.slice(0, 10)) ?? 0) + 1);
      if (event.event_type === 'meditation_completed') {
        completions += 1;
        if (actorId) completedReaders.add(actorId);
      }
    });

    setActiveReaders(readers.size);
    setCompletedCount(completions);
    setCompletionRate(readers.size ? Math.round((completedReaders.size / readers.size) * 100) : 0);
    setDailyOpens(Array.from(grouped.entries()).map(([day, count]) => ({ day, count })).sort((a, b) => b.day.localeCompare(a.day)));
    setCampaigns((campaignRows ?? []) as typeof campaigns);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const visible = showComposer || showEditionComposer || showJsonModal;
    Animated.spring(modalProgress, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 180,
      mass: 0.8,
    }).start();
  }, [modalProgress, showComposer, showEditionComposer, showJsonModal]);

  const refresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const loadDevotions = async (editionId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.from('devotions').select('*').eq('edition_id', editionId).order('day_number');
    if (error) Alert.alert('Could not load meditations', error.message);
    else setDevotions((data ?? []) as Devotion[]);
  };

  const executeStatusChange = async (edition: Edition, status: Edition['status']) => {
    if (!supabase) return;
    const { error } = await supabase.from('editions').update({ status, updated_at: new Date().toISOString() }).eq('id', edition.id);
    if (error) {
      Alert.alert('Could not update edition', error.message);
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
        Alert.alert('Could not validate edition', validationError.message);
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
      Alert.alert('Could not save month', result.error.message);
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
      Alert.alert('Could not validate day', duplicateError.message);
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
      Alert.alert('Could not save meditation', result.error.message);
      return;
    }
    setForm({ day: '', weekday: '', title: '', scriptureReference: '', scriptureText: '', meditation: '', furtherStudies: '', wisdom: '', declaration: '' });
    setEditingDevotionId(null);
    setShowComposer(false);
    await loadDashboard();
    await loadDevotions(selectedEditionId);
    Alert.alert('Saved', `Day ${dayNumber} was ${editingId ? 'updated' : 'added'} successfully.`);
  };

  const importBulkJson = async () => {
    if (!supabase || !selectedEditionId || !jsonInput.trim()) return;
    try {
      const parsed = JSON.parse(jsonInput.trim());
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      const { valid, invalidDays } = validateDevotions(rows);
      if (invalidDays.length > 0) {
        Alert.alert('Validation Error', `Invalid records found for day(s): ${invalidDays.join(', ')}.`);
        return;
      }
      setSaving(true);
      const payload = valid.map((item) => ({
        edition_id: selectedEditionId,
        day_number: item.day,
        weekday: item.weekday || 'Daily',
        title: item.title,
        scripture_reference: item.scripture,
        scripture_text: (item as any).scriptureText || null,
        meditation: item.meditation,
        further_studies: item.furtherStudies ?? [],
        wisdom_nugget: item.wisdom || null,
        declaration: item.declaration || null,
      }));

      const { error } = await supabase.from('devotions').upsert(payload, { onConflict: 'edition_id,day_number' });
      setSaving(false);
      if (error) {
        Alert.alert('Could not import JSON', error.message);
        return;
      }
      setShowJsonModal(false);
      setJsonInput('');
      await loadDashboard();
      await loadDevotions(selectedEditionId);
      Alert.alert('Bulk Import Success', `${valid.length} devotions imported/updated successfully.`);
    } catch {
      Alert.alert('Invalid JSON', 'Please enter a valid JSON array of devotional objects.');
    }
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
            Alert.alert('Could not delete meditation', error.message);
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
            Alert.alert('Could not delete month', error.message);
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

  const duplicateEdition = async (edition: Edition) => {
    if (!supabase) return;
    setSaving(true);
    const slug = `${edition.slug}-copy-${Date.now().toString().slice(-4)}`;
    const { data: copiedEdition, error: editionError } = await supabase
      .from('editions')
      .insert({
        slug,
        title: `${edition.title} copy`,
        theme: edition.theme,
        introduction: edition.introduction ?? null,
        month: edition.month,
        year: edition.year,
        language: edition.language,
        status: 'draft',
      })
      .select('id')
      .single();

    if (editionError || !copiedEdition) {
      setSaving(false);
      Alert.alert('Could not duplicate month', editionError?.message ?? 'The new edition was not created.');
      return;
    }
    const { data: sourceDevotions, error: devotionError } = await supabase
      .from('devotions')
      .select('day_number, devotion_date, weekday, title, scripture_reference, scripture_text, meditation, further_studies, wisdom_nugget, declaration')
      .eq('edition_id', edition.id)
      .order('day_number');

    if (devotionError) {
      await supabase.from('editions').delete().eq('id', copiedEdition.id);
      setSaving(false);
      Alert.alert('Could not copy meditations', devotionError.message);
      return;
    }
    if (sourceDevotions?.length) {
      const { error: copyError } = await supabase.from('devotions').insert(sourceDevotions.map((d) => ({ ...d, edition_id: copiedEdition.id })));
      if (copyError) {
        await supabase.from('editions').delete().eq('id', copiedEdition.id);
        setSaving(false);
        Alert.alert('Could not copy meditations', copyError.message);
        return;
      }
    }
    setSaving(false);
    await loadDashboard();
    Alert.alert('Month duplicated', `${edition.title} was copied as a new draft.`);
  };

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
        Alert.alert('Could not upload PDF', error.message);
        return;
      }
      const { error: jobError } = await supabase.from('devotional_imports').insert({ owner_id: session.user.id, storage_path: path, source_name: asset.name, status: 'uploaded' });
      if (jobError) {
        await supabase.storage.from('devotional-imports').remove([path]);
        Alert.alert('Could not create import review', jobError.message);
        return;
      }
      await loadDashboard();
      Alert.alert('PDF uploaded for review', 'The file is stored privately. Run the importer review step before creating or publishing an edition.');
    } catch (errorValue: unknown) {
      Alert.alert('Could not upload PDF', errorValue instanceof Error ? errorValue.message : 'The selected file could not be read.');
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
      let detail = error.message;
      try {
        const response = (error as { context?: Response }).context;
        const body = response ? ((await response.clone().json()) as { error?: string }) : null;
        if (body?.error) detail = body.error;
      } catch {
        // Keep message
      }
      await loadDashboard();
      Alert.alert('Could not extract PDF', detail);
    } else {
      await loadDashboard();
      Alert.alert('PDF ready for review', `${data?.daysFound ?? 0} daily records extracted. Review is required before importing.`);
    }
  };

  const retryPdf = async (importId: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('devotional_imports').update({ status: 'uploaded', error_message: null, updated_at: new Date().toISOString() }).eq('id', importId);
    if (error) {
      Alert.alert('Could not retry import', error.message);
      return;
    }
    await extractPdf(importId);
  };

  const deletePdf = async () => {
    if (!supabase || !deletingPdf) return;
    const file = deletingPdf;
    setDeletingPdf(null);
    const { error } = await supabase.functions.invoke('delete-devotional-pdf', { body: { importId: file.id } });
    if (error) {
      Alert.alert('Could not delete PDF', error.message);
      return;
    }
    await loadDashboard();
  };

  const openImportReview = async (file: PdfImport) => {
    if (!supabase) return;
    const { data, error } = await supabase.from('devotional_imports').select('id, source_name, storage_path, status, error_message, created_at, extracted_data').eq('id', file.id).single();
    if (error || !data) {
      Alert.alert('Could not open review', error?.message ?? 'The import record could not be found.');
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
      Alert.alert('Could not save review', error.message);
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
      Alert.alert('Could not import meditations', error.message);
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
            Alert.alert('Could not delete draft', error.message);
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
      Alert.alert('Could not save newsletter', error.message);
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
          if (error) Alert.alert('Could not send newsletter', error.message);
          else {
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

              {adminTab === 'content' ? (
                <>
                  <View style={styles.composerHeader}>
                    <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>Monthly editions</Text>
                    <View style={styles.statusActions}>
                      <Pressable
                        disabled={uploadingPdf}
                        onPress={importPdf}
                        style={[styles.iconPillButton, isDark && styles.darkIconPillButton]}
                        accessibilityRole="button"
                        accessibilityLabel="Import PDF">
                        <AppIcon name="arrow.up.doc" size={16} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          setEditingEditionId(null);
                          setEditionForm({ slug: '', title: '', theme: '', introduction: '', month: '', year: '', language: 'en' });
                          setShowEditionComposer(true);
                        }}
                        style={[styles.iconPillButton, styles.addButton]}
                        accessibilityRole="button"
                        accessibilityLabel="Add new month">
                        <AppIcon name="plus" size={16} tintColor={DewDesign.colors.white} />
                      </Pressable>
                    </View>
                  </View>

                  {editions.map((edition) => (
                    <View key={edition.id} style={[styles.editionCard, isDark && styles.darkCard]}>
                      <View style={styles.editionHeader}>
                        <View style={styles.editionIcon}>
                          <AppIcon name="book.closed" size={20} tintColor={DewDesign.colors.terracotta} />
                        </View>
                        <View style={styles.editionCopy}>
                          <Text style={[styles.editionTitle, isDark && styles.darkInk]}>{edition.title}</Text>
                          <Text style={[styles.editionMeta, isDark && styles.darkMuted]}>{edition.slug} · {edition.language.toUpperCase()}</Text>
                        </View>
                        <View style={[styles.statusPill, edition.status === 'published' && styles.statusPublished, edition.status === 'review' && styles.statusReview]}>
                          <Text style={styles.statusText}>{edition.status}</Text>
                        </View>
                      </View>

                      <View style={[styles.editionDetails, isDark && { borderColor: DewDesign.colors.darkLine }]}>
                        <Text style={[styles.detailText, isDark && styles.darkMuted]}>{edition.theme}</Text>
                        <Text style={[styles.detailText, isDark && styles.darkMuted]}>{edition.devotionCount} daily meditations</Text>
                      </View>

                      <View style={styles.statusActions}>
                        <Pressable
                          accessibilityLabel="Edit month"
                          onPress={() => {
                            setEditingEditionId(edition.id);
                            setEditionForm({
                              slug: edition.slug,
                              title: edition.title,
                              theme: edition.theme,
                              introduction: edition.introduction ?? '',
                              month: String(edition.month),
                              year: String(edition.year),
                              language: (edition.language === 'fr' ? 'fr' : 'en') as 'en' | 'fr',
                            });
                            setShowEditionComposer(true);
                          }}
                          style={adminExtraStyles.rowIcon}>
                          <AppIcon name="pencil" size={16} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                        </Pressable>

                        <Pressable
                          accessibilityLabel="Duplicate month"
                          disabled={saving}
                          onPress={() => duplicateEdition(edition)}
                          style={adminExtraStyles.rowIcon}>
                          <AppIcon name="doc.on.doc" size={16} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                        </Pressable>

                        <Pressable accessibilityLabel="Delete month" onPress={() => deleteEdition(edition)} style={adminExtraStyles.rowIcon}>
                          <AppIcon name="trash" size={16} tintColor={DewDesign.colors.terracotta} />
                        </Pressable>

                        <Pressable
                          accessibilityLabel="Manage meditations"
                          onPress={() => {
                            setSelectedEditionId(edition.id);
                            loadDevotions(edition.id);
                          }}
                          style={adminExtraStyles.rowIcon}>
                          <AppIcon name="list.bullet" size={16} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                        </Pressable>

                        <Pressable
                          accessibilityLabel="Add meditation"
                          onPress={() => {
                            setSelectedEditionId(edition.id);
                            setShowComposer(true);
                          }}
                          style={[adminExtraStyles.rowIcon, styles.addButton]}>
                          <AppIcon name="plus" size={16} tintColor={DewDesign.colors.white} />
                        </Pressable>

                        {edition.status !== 'draft' && (
                          <Pressable onPress={() => changeStatus(edition, 'draft')} style={styles.statusButton}>
                            <Text style={styles.statusButtonText}>{t(language, 'draft')}</Text>
                          </Pressable>
                        )}
                        {edition.status !== 'review' && (
                          <Pressable onPress={() => changeStatus(edition, 'review')} style={styles.statusButton}>
                            <Text style={styles.statusButtonText}>{t(language, 'sendToReview')}</Text>
                          </Pressable>
                        )}
                        {edition.status !== 'published' && (
                          <Pressable onPress={() => changeStatus(edition, 'published')} style={[styles.statusButton, styles.publishButton]}>
                            <Text style={styles.publishButtonText}>{t(language, 'publish')}</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))}

                  {!editions.length && <Text style={[styles.emptyText, isDark && styles.darkMuted]}>{t(language, 'noEditions')}</Text>}

                  {/* PDF Imports Queue */}
                  <View style={[adminExtraStyles.adminPanel, isDark && styles.darkCard]}>
                    <View style={styles.composerHeader}>
                      <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'pdfImportQueue')}</Text>
                      <Text style={styles.composerMeta}>{pdfImports.length} uploaded</Text>
                    </View>
                    <Text style={[adminExtraStyles.panelIntro, isDark && styles.darkMuted]}>
                      Uploaded source files stay private while they are being extracted and reviewed.
                    </Text>
                    {pdfImports.map((file) => (
                      <View key={file.id} style={[adminExtraStyles.campaignRow, isDark && { borderColor: DewDesign.colors.darkLine }]}>
                        <View style={adminExtraStyles.campaignIcon}>
                          <AppIcon name="doc.on.doc" size={14} tintColor={DewDesign.colors.terracotta} />
                        </View>
                        <View style={styles.editionCopy}>
                          <Text style={[styles.editionTitle, isDark && styles.darkInk]} numberOfLines={1}>{file.source_name}</Text>
                          <Text style={[styles.editionMeta, isDark && styles.darkMuted]}>
                            {file.status === 'failed'
                              ? file.error_message ?? 'Import failed'
                              : `${file.status === 'uploaded' ? 'Awaiting extraction' : file.status === 'review' ? 'Ready for review' : file.status}`}
                            {file.created_at ? ` · ${new Date(file.created_at).toLocaleDateString()}` : ''}
                          </Text>
                        </View>
                        {file.status === 'uploaded' && (
                          <Pressable disabled={uploadingPdf} onPress={() => extractPdf(file.id)} style={adminExtraStyles.sendButton}>
                            <AppIcon name="play.fill" size={13} tintColor={DewDesign.colors.white} />
                          </Pressable>
                        )}
                        {file.status === 'failed' && (
                          <Pressable disabled={uploadingPdf} accessibilityLabel="Retry PDF import" onPress={() => retryPdf(file.id)} style={adminExtraStyles.sendButton}>
                            <AppIcon name="refresh" size={13} tintColor={DewDesign.colors.white} />
                          </Pressable>
                        )}
                        {file.status === 'review' && (
                          <Pressable accessibilityLabel="Review PDF import" onPress={() => openImportReview(file)} style={adminExtraStyles.sendButton}>
                            <AppIcon name="eye" size={13} tintColor={DewDesign.colors.white} />
                          </Pressable>
                        )}
                        <Pressable accessibilityLabel="Delete PDF import" onPress={() => setDeletingPdf(file)} style={adminExtraStyles.deleteButton}>
                          <AppIcon name="trash" size={13} tintColor={DewDesign.colors.terracotta} />
                        </Pressable>
                      </View>
                    ))}
                    {!pdfImports.length && (
                      <Text style={[styles.emptyText, isDark && styles.darkMuted]}>
                        {language === 'fr' ? 'Aucun PDF importé pour le moment.' : 'No PDF imports uploaded yet.'}
                      </Text>
                    )}
                  </View>

                  {/* Devotions List for Selected Edition */}
                  {selectedEditionId ? (
                    <View style={[adminExtraStyles.devotionList, isDark && styles.darkCard]}>
                      <View style={styles.composerHeader}>
                        <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'meditations')}</Text>
                        <View style={styles.statusActions}>
                          <Pressable onPress={() => setShowJsonModal(true)} style={[styles.actionBtnPill, isDark && styles.darkActionBtnPill]}>
                            <AppIcon name="square.and.arrow.down" size={14} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                            <Text style={[styles.actionBtnLabel, isDark && styles.darkInk]}>JSON Bulk Import</Text>
                          </Pressable>
                        </View>
                      </View>
                      {devotions.map((item) => (
                        <View key={item.id} style={[adminExtraStyles.devotionRow, isDark && { borderColor: DewDesign.colors.darkLine }]}>
                          <View style={adminExtraStyles.dayBadge}>
                            <Text style={adminExtraStyles.dayBadgeText}>{item.day_number}</Text>
                          </View>
                          <View style={styles.editionCopy}>
                            <Text style={[styles.editionTitle, isDark && styles.darkInk]}>{item.title}</Text>
                            <Text style={[styles.editionMeta, isDark && styles.darkMuted]}>{item.weekday} · {item.scripture_reference}</Text>
                          </View>
                          <Pressable
                            onPress={() => {
                              setEditingDevotionId(item.id);
                              setForm({
                                day: String(item.day_number),
                                weekday: item.weekday,
                                title: item.title,
                                scriptureReference: item.scripture_reference,
                                scriptureText: item.scripture_text ?? '',
                                meditation: item.meditation,
                                furtherStudies: (item.further_studies ?? []).join(', '),
                                wisdom: item.wisdom_nugget ?? '',
                                declaration: item.declaration ?? '',
                              });
                              setShowComposer(true);
                            }}
                            style={adminExtraStyles.rowIcon}>
                            <AppIcon name="pencil" size={15} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                          </Pressable>
                          <Pressable onPress={() => deleteDevotion(item)} style={adminExtraStyles.rowIcon}>
                            <AppIcon name="trash" size={15} tintColor={DewDesign.colors.terracotta} />
                          </Pressable>
                        </View>
                      ))}
                      {!devotions.length && (
                        <Text style={[styles.emptyText, isDark && styles.darkMuted]}>
                          {language === 'fr' ? 'Aucune méditation ajoutée à cette édition.' : 'No meditations added to this edition yet.'}
                        </Text>
                      )}
                    </View>
                  ) : null}
                </>
              ) : adminTab === 'newsletters' ? (
                <View style={[adminExtraStyles.adminPanel, isDark && styles.darkCard]}>
                  <View style={styles.composerHeader}>
                    <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'newsletterStudio')}</Text>
                    {editingCampaignId ? (
                      <Pressable
                        onPress={() => {
                          setEditingCampaignId(null);
                          setNewsletter({ subject: '', body: '' });
                        }}>
                        <Text style={styles.cancelEditLink}>Cancel editing</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={[adminExtraStyles.panelIntro, isDark && styles.darkMuted]}>
                    Prepare a message for the devotional community. Current opted-in audience: {subscriberCount} subscriber{subscriberCount === 1 ? '' : 's'}.
                  </Text>
                  <TextInput
                    value={newsletter.subject}
                    onChangeText={(v) => setNewsletter((c) => ({ ...c, subject: v }))}
                    placeholder="Subject"
                    placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                    style={[styles.formInput, isDark && styles.darkFormInput]}
                  />
                  <TextInput
                    value={newsletter.body}
                    onChangeText={(v) => setNewsletter((c) => ({ ...c, body: v }))}
                    placeholder="Write your message"
                    placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                    multiline
                    style={[styles.formInput, styles.formTextAreaLarge, isDark && styles.darkFormInput]}
                  />
                  <Pressable disabled={saving} onPress={saveNewsletter} style={[styles.saveButton, saving && styles.disabledButton]}>
                    <AppIcon name="envelope" size={15} tintColor={DewDesign.colors.white} />
                    <Text style={styles.publishButtonText}>
                      {saving ? 'Saving...' : editingCampaignId ? 'Update draft' : language === 'fr' ? 'Enregistrer le brouillon' : 'Save draft'}
                    </Text>
                  </Pressable>

                  <Text style={[adminExtraStyles.panelHeading, isDark && styles.darkInk]}>Recent campaigns</Text>
                  {campaigns.map((campaign) => (
                    <View key={campaign.id} style={[adminExtraStyles.campaignRow, isDark && { borderColor: DewDesign.colors.darkLine }]}>
                      <View style={adminExtraStyles.campaignIcon}>
                        <AppIcon name="envelope" size={14} tintColor={DewDesign.colors.terracotta} />
                      </View>
                      <View style={styles.editionCopy}>
                        <Text style={[styles.editionTitle, isDark && styles.darkInk]}>{campaign.subject}</Text>
                        <Text style={[styles.editionMeta, isDark && styles.darkMuted]}>{campaign.status} · {new Date(campaign.created_at).toLocaleDateString()}</Text>
                      </View>
                      {campaign.status !== 'sent' && (
                        <>
                          <Pressable
                            accessibilityLabel="Edit draft"
                            onPress={() => editNewsletter(campaign)}
                            style={adminExtraStyles.rowIcon}>
                            <AppIcon name="pencil" size={15} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                          </Pressable>
                          <Pressable
                            accessibilityLabel="Delete draft"
                            onPress={() => deleteNewsletter(campaign)}
                            style={adminExtraStyles.rowIcon}>
                            <AppIcon name="trash" size={15} tintColor={DewDesign.colors.terracotta} />
                          </Pressable>
                          <Pressable
                            accessibilityLabel="Send newsletter"
                            onPress={() => sendNewsletter(campaign.id)}
                            style={adminExtraStyles.sendButton}>
                            <AppIcon name="paperplane.fill" size={13} tintColor={DewDesign.colors.white} />
                          </Pressable>
                        </>
                      )}
                    </View>
                  ))}
                  {!campaigns.length && (
                    <Text style={[styles.emptyText, isDark && styles.darkMuted]}>
                      {language === 'fr' ? 'Aucun brouillon d’infolettre.' : 'No newsletter drafts yet.'}
                    </Text>
                  )}
                </View>
              ) : adminTab === 'analytics' ? (
                <View style={[adminExtraStyles.adminPanel, isDark && styles.darkCard]}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{t(language, 'appAnalytics')}</Text>
                  <Text style={[adminExtraStyles.panelIntro, isDark && styles.darkMuted]}>
                    Aggregate activity from the last 30 days, including anonymous readers.
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
                  <Text style={[adminExtraStyles.panelHeading, isDark && styles.darkInk]}>{t(language, 'dailyActivity')}</Text>
                  {dailyOpens.map((item) => (
                    <View key={item.day} style={[adminExtraStyles.activityRow, isDark && { borderColor: DewDesign.colors.darkLine }]}>
                      <Text style={[styles.detailText, isDark && styles.darkMuted]}>{item.day}</Text>
                      <Text style={[styles.detailText, isDark && styles.darkMuted]}>{item.count} opens</Text>
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
              <Text style={[styles.emptyText, isDark && styles.darkMuted]}>Ask the ministry administrator to assign your account an editor role.</Text>
            </View>
          )}
        </ScrollView>

        <AdminBottomNav activeTab={adminTab} onChange={setAdminTab} />

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
                  <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>{editingDevotionId ? 'Edit meditation' : 'Add meditation'}</Text>
                  <Pressable onPress={() => { setShowComposer(false); setEditingDevotionId(null); }}>
                    <AppIcon name="xmark" size={18} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                  </Pressable>
                </View>
                <View style={styles.formRow}>
                  <TextInput
                    value={form.day}
                    onChangeText={(v) => setForm((c) => ({ ...c, day: v }))}
                    placeholder="Day number"
                    placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                    keyboardType="number-pad"
                    style={[styles.formInput, styles.formHalf, isDark && styles.darkFormInput]}
                  />
                  <TextInput
                    value={form.weekday}
                    onChangeText={(v) => setForm((c) => ({ ...c, weekday: v }))}
                    placeholder="Custom day name"
                    placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                    style={[styles.formInput, styles.formHalf, isDark && styles.darkFormInput]}
                  />
                </View>
                <TextInput
                  value={form.title}
                  onChangeText={(v) => setForm((c) => ({ ...c, title: v }))}
                  placeholder="Meditation title"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={form.scriptureReference}
                  onChangeText={(v) => setForm((c) => ({ ...c, scriptureReference: v }))}
                  placeholder="Scripture reference"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={form.scriptureText}
                  onChangeText={(v) => setForm((c) => ({ ...c, scriptureText: v }))}
                  placeholder="Scripture text"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  multiline
                  style={[styles.formInput, styles.formTextArea, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={form.meditation}
                  onChangeText={(v) => setForm((c) => ({ ...c, meditation: v }))}
                  placeholder="Meditation text"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  multiline
                  style={[styles.formInput, styles.formTextAreaLarge, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={form.furtherStudies}
                  onChangeText={(v) => setForm((c) => ({ ...c, furtherStudies: v }))}
                  placeholder="Further studies, separated by commas"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  style={[styles.formInput, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={form.wisdom}
                  onChangeText={(v) => setForm((c) => ({ ...c, wisdom: v }))}
                  placeholder="Wisdom nugget"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  multiline
                  style={[styles.formInput, styles.formTextArea, isDark && styles.darkFormInput]}
                />
                <TextInput
                  value={form.declaration}
                  onChangeText={(v) => setForm((c) => ({ ...c, declaration: v }))}
                  placeholder="Declaration"
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  multiline
                  style={[styles.formInput, styles.formTextArea, isDark && styles.darkFormInput]}
                />
                <Pressable disabled={saving} onPress={saveMeditation} style={[styles.saveButton, saving && styles.disabledButton]}>
                  <Text style={styles.publishButtonText}>{saving ? 'Saving...' : 'Save meditation'}</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Review Day Modal */}
        <Modal visible={Boolean(reviewingDay)} transparent animationType="slide" onRequestClose={() => setReviewingDay(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={adminExtraStyles.modalBackdrop}>
            <View style={[adminExtraStyles.modalPanel, isDark && styles.darkCard]}>
              <ScrollView style={adminExtraStyles.modalScroll} contentContainerStyle={adminExtraStyles.modalContent}>
                <View style={styles.composerHeader}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>Review day {reviewingDay?.day_number}</Text>
                  <Pressable onPress={() => setReviewingDay(null)}>
                    <AppIcon name="xmark" size={18} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                  </Pressable>
                </View>
                <TextInput value={reviewDayForm.title} onChangeText={(v) => setReviewDayForm((c) => ({ ...c, title: v }))} placeholder="Meditation title" placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} style={[styles.formInput, isDark && styles.darkFormInput]} />
                <TextInput value={reviewDayForm.scriptureReference} onChangeText={(v) => setReviewDayForm((c) => ({ ...c, scriptureReference: v }))} placeholder="Scripture reference" placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} style={[styles.formInput, isDark && styles.darkFormInput]} />
                <TextInput value={reviewDayForm.scriptureText} onChangeText={(v) => setReviewDayForm((c) => ({ ...c, scriptureText: v }))} placeholder="Scripture text" placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} multiline style={[styles.formInput, styles.formTextArea, isDark && styles.darkFormInput]} />
                <TextInput value={reviewDayForm.meditation} onChangeText={(v) => setReviewDayForm((c) => ({ ...c, meditation: v }))} placeholder="Meditation text" placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} multiline style={[styles.formInput, styles.formTextAreaLarge, isDark && styles.darkFormInput]} />
                <TextInput value={reviewDayForm.furtherStudies} onChangeText={(v) => setReviewDayForm((c) => ({ ...c, furtherStudies: v }))} placeholder="Further studies, separated by commas" placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} style={[styles.formInput, isDark && styles.darkFormInput]} />
                <TextInput value={reviewDayForm.wisdom} onChangeText={(v) => setReviewDayForm((c) => ({ ...c, wisdom: v }))} placeholder="Wisdom nugget" placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} multiline style={[styles.formInput, styles.formTextArea, isDark && styles.darkFormInput]} />
                <TextInput value={reviewDayForm.declaration} onChangeText={(v) => setReviewDayForm((c) => ({ ...c, declaration: v }))} placeholder="Declaration" placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} multiline style={[styles.formInput, styles.formTextArea, isDark && styles.darkFormInput]} />
                <Pressable disabled={saving} onPress={saveDayReview} style={[styles.saveButton, saving && styles.disabledButton]}>
                  <Text style={styles.publishButtonText}>{saving ? 'Saving...' : 'Save reviewed day'}</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Review Import Modal */}
        {reviewingImport ? (
          <Modal visible={Boolean(reviewingImport)} transparent animationType="slide" onRequestClose={() => setReviewingImport(null)}>
            <View style={adminExtraStyles.modalBackdrop}>
              <View style={[adminExtraStyles.modalPanel, isDark && styles.darkCard]}>
                <ScrollView style={adminExtraStyles.modalScroll} contentContainerStyle={adminExtraStyles.modalContent}>
                  <View style={styles.composerHeader}>
                    <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>Review import</Text>
                    <Pressable onPress={() => setReviewingImport(null)}>
                      <AppIcon name="xmark" size={18} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                    </Pressable>
                  </View>
                  <Text style={[styles.editionMeta, isDark && styles.darkMuted]}>
                    {reviewingImport.source_name} · {reviewingImport.extracted_data?.days_found ?? reviewingImport.extracted_data?.days?.length ?? 0} records · {reviewingImport.extracted_data?.review_count ?? 0} need review
                  </Text>
                  <Text style={[adminExtraStyles.panelHeading, isDark && styles.darkInk]}>Choose a draft edition</Text>
                  {editions.filter((e) => e.status !== 'published').map((e) => (
                    <Pressable key={e.id} disabled={saving} onPress={() => approveImport(e.id)} style={[adminExtraStyles.panelButton, isDark && styles.darkCard]}>
                      <AppIcon name="arrow.down.doc" size={16} tintColor={isDark ? DewDesign.colors.darkInk : DewDesign.colors.forest} />
                      <Text style={[adminExtraStyles.panelButtonText, isDark && styles.darkInk]}>Import into {e.title}</Text>
                    </Pressable>
                  ))}
                  <Text style={[adminExtraStyles.panelHeading, isDark && styles.darkInk]}>Extracted days</Text>
                  {(reviewingImport.extracted_data?.days ?? []).map((day) => (
                    <Pressable key={`${day.day_number}-${day.title}`} onPress={() => openDayReview(day)} style={[adminExtraStyles.activityRow, isDark && { borderColor: DewDesign.colors.darkLine }]}>
                      <Text style={[styles.detailText, isDark && styles.darkMuted]}>Day {day.day_number}</Text>
                      <Text style={[styles.detailText, isDark && styles.darkMuted, day.needs_review && styles.warningText]} numberOfLines={1}>
                        {day.title}
                      </Text>
                      {day.needs_review ? <AppIcon name="pencil" size={14} tintColor={DewDesign.colors.terracotta} /> : <AppIcon name="chevron.right" size={14} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        ) : null}

        {/* Delete PDF Confirmation Modal */}
        <Modal visible={Boolean(deletingPdf)} transparent animationType="fade" onRequestClose={() => setDeletingPdf(null)}>
          <Pressable style={adminExtraStyles.dialogBackdrop} onPress={() => setDeletingPdf(null)}>
            <Pressable style={[adminExtraStyles.dialog, isDark && styles.darkCard]} onPress={(e) => e.stopPropagation()}>
              <Text style={[adminExtraStyles.dialogTitle, isDark && styles.darkInk]}>Delete PDF?</Text>
              <Text style={[adminExtraStyles.dialogBody, isDark && styles.darkMuted]}>{deletingPdf?.source_name} will be removed from private storage.</Text>
              <View style={adminExtraStyles.dialogActions}>
                <Pressable onPress={() => setDeletingPdf(null)} style={adminExtraStyles.dialogCancel}>
                  <Text style={adminExtraStyles.dialogCancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={deletePdf} style={adminExtraStyles.dialogDelete}>
                  <Text style={adminExtraStyles.dialogDeleteText}>Delete</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* JSON Bulk Import Modal */}
        <Modal visible={showJsonModal} transparent animationType="slide" onRequestClose={() => setShowJsonModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={adminExtraStyles.modalBackdrop}>
            <View style={[adminExtraStyles.modalPanel, isDark && styles.darkCard]}>
              <ScrollView style={adminExtraStyles.modalScroll} contentContainerStyle={adminExtraStyles.modalContent}>
                <View style={styles.composerHeader}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkInk]}>JSON Bulk Import</Text>
                  <Pressable onPress={() => setShowJsonModal(false)}>
                    <AppIcon name="xmark" size={18} tintColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted} />
                  </Pressable>
                </View>
                <Text style={[styles.fieldLabel, isDark && styles.darkMuted]}>
                  Paste JSON array of devotions (with day, title, scripture, meditation fields):
                </Text>
                <TextInput
                  value={jsonInput}
                  onChangeText={setJsonInput}
                  placeholder={`[{"day": 1, "title": "Day 1", "scripture": "John 3:16", "meditation": "..."}]`}
                  placeholderTextColor={isDark ? DewDesign.colors.darkMuted : DewDesign.colors.muted}
                  multiline
                  style={[styles.formInput, styles.formTextAreaLarge, isDark && styles.darkFormInput]}
                />
                <Pressable disabled={saving} onPress={importBulkJson} style={[styles.saveButton, saving && styles.disabledButton]}>
                  <Text style={styles.publishButtonText}>{saving ? 'Importing...' : 'Bulk Import Devotions'}</Text>
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
