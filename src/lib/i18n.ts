export type AppLanguage = 'en' | 'fr';

const translations = {
  en: {
    home: 'Home', today: 'Today', library: 'Library', journey: 'Journey', saved: 'Saved',
    todaysMeditation: "Today's meditation", beginMeditation: 'Begin meditation',
    markComplete: 'Mark today complete', dayCompleted: 'Day completed',
    yourJourney: 'Your journey', keepShowingUp: 'Keep showing up.',
    comingSoon: 'COMING SOON', currentEdition: 'CURRENT EDITION',
    thisMonthsDevotional: "This month's devotional", contentWillAppear: 'Content will appear here when published',
    goodMorning: 'Good morning', goodAfternoon: 'Good afternoon', goodEvening: 'Good evening',
    rhythmSet: 'Your rhythm is set', momentAwaits: 'A moment awaits',
    content: 'Content', newsletters: 'Newsletters', analytics: 'Analytics', settings: 'Settings',
    about: 'About, privacy & support', notifications: 'Notifications', openReminderSettings: 'Open reminder settings',
    keepDailyRhythm: 'Keep your daily rhythm', dailyRhythmSet: 'Your daily rhythm is set',
    yourSpace: 'YOUR SPACE', reading: 'READING', textSize: 'Text size', adjustText: 'Adjust the meditation text for comfortable reading.',
    livePreview: 'LIVE PREVIEW', previewVerse: 'Your word is a lamp to my feet and a light to my path. — Psalm 119:105',
    dailyRhythm: 'DAILY RHYTHM', morningReminder: 'Morning reminder', language: 'LANGUAGE', appearance: 'APPEARANCE',
    readingAppearance: 'Reading appearance', chooseVisualMode: 'Choose the visual mode for Daily Dew.', community: 'COMMUNITY',
    ministryUpdates: 'Ministry updates', subscribedUpdates: 'You are subscribed to Daily Dew emails.', receiveUpdates: 'Receive occasional devotional and ministry updates.',
    accountAndSync: 'ACCOUNT & SYNC', guestUser: 'Reading as Guest', signedInDesc: 'Your reflections and bookmarks sync with your account.', signedOutDesc: 'Sign in to sync your reflections and bookmarks across devices.',
    light: 'Light', dark: 'Dark', english: 'English', french: 'Français', donate: 'Donate', login: 'Log in', logout: 'Log out', ministryDashboard: 'Ministry dashboard',
    yourWalk: 'YOUR WALK', noticeGrowth: 'Notice what God is growing in you.', yourMonth: 'Your month', savedWithIntention: 'Saved with intention', savedMoments: 'Saved moments', bookmarks: 'Bookmarks', reflections: 'Reflections', prayers: 'Prayers', nothingSaved: 'Nothing saved here yet', savedWillAppear: 'Your saved items will appear here as you move through the devotional.',
    libraryKicker: 'THE LIBRARY', currentEditionLabel: 'Current edition', yourProgress: 'YOUR PROGRESS', dailyMeditations: 'Daily meditations', searchMeditations: 'Search meditations', all: 'All', unread: 'Unread', complete: 'Complete', noMeditations: 'No meditations found', tryAnother: 'Try another search or filter.',
    openingJourney: 'Opening your journey', restoringNotes: 'Restoring your saved reflections and prayers...', dayOf: 'Day', wisdomNugget: 'WISDOM NUGGET', furtherStudies: 'Further studies', yourReflection: 'Your reflection', reflectionPrompt: 'What is God asking you to cultivate today?', reflectionPlaceholder: 'Write what is on your heart...', yourPrayer: 'Your prayer', prayerPlaceholder: 'Write a prayer for today...', declaration: 'DECLARATION', shareMoment: 'Share this moment', shareFocused: 'Share a focused moment', createShareCard: 'Create a share card', scripture: 'Scripture', reflection: 'Reflection', prayer: 'Prayer', scriptureCard: 'Scripture card', declarationCard: 'Declaration card', reflectionCard: 'Reflection card', prayerCard: 'Prayer card', meditationComplete: 'Meditation complete', completeMeditation: "Complete today's meditation", previous: 'Previous', nextDay: 'Next day', cancel: 'Cancel', shareCard: 'Share card', savedToJourney: 'Saved to your Journey', saveMeditation: 'Save this meditation', playingMeditation: 'Playing meditation', listenMeditation: 'Listen to meditation', quietWord: 'A quiet moment with the Word', listenAloud: 'Listen to this meditation aloud', dayCompletedCount: 'days completed', aSteadyStep: 'A steady step is still a step.',
    accountJourney: 'YOUR JOURNEY', yourAccount: 'Your account', keepJourney: 'Keep your journey', accountReady: 'Your Daily Dew account is ready for cross-device sync.', signInReady: 'Sign in when you are ready. Daily Dew remains useful without an account.', signedInAs: 'SIGNED IN AS', signOut: 'Sign out', emailAddress: 'Email address', password: 'Password', working: 'Working...', createAccount: 'Create account', newHere: 'New here? Create an account', alreadyAccount: 'Already have an account? Sign in', journeyYours: 'Your journey stays yours', syncAcross: 'Sign in to sync progress across devices. You can continue reading without an account.', backToDailyDew: 'Back to Daily Dew', checkEmail: 'Check your email to confirm your account.', signedIn: 'You are signed in.', invalidCredentials: 'Enter an email and a password of at least 6 characters.',
    allCaughtUp: 'All caught up for today', meditationCompleteMessage: 'Well done. Your daily meditation is complete.', reviewMeditation: 'Review meditation',
    noMeditationTodayTitle: 'No Meditation Published Yet', noMeditationTodayMsg: "The devotional for today is not available yet. Please check back shortly or explore past meditations in the Library.", exploreLibrary: 'Explore Library',
    supportMinistry: 'Support the ministry', donationIntro: 'Your gift helps make Scripture, prayer, and daily encouragement available to more people.', donationAmount: 'Donation amount', customAmount: 'Custom amount', continueDonation: 'Continue to payment', donationNote: 'Secure mobile-money payment via Orange Money or MTN MoMo.', donationUnavailable: 'Donations will be available soon.',
    back: 'Retour', aboutSupport: 'About & support', aboutApp: 'About the app', privacy: 'Privacy', contentPermissions: 'Content permissions', terms: 'Terms of use', contactSupport: 'Contact support',
    monthlyEditions: 'Monthly editions', importPdf: 'Import PDF', newMonth: 'New month', draft: 'Draft', sendToReview: 'Send to review', publish: 'Publish', noEditions: 'No editions are available yet.', pdfImportQueue: 'PDF import queue', reviewImport: 'Review import', meditations: 'Meditations', newsletterStudio: 'Newsletter studio', appAnalytics: 'App analytics', workspaceSettings: 'Workspace settings', openAppSettings: 'Open app settings', manageAccount: 'Manage account', activeReaders: 'Active readers', completions: 'Completions', readerRate: 'Reader rate', appOpens: 'App opens', dailyActivity: 'Daily activity',
  },
  fr: {
    home: 'Accueil', today: "Aujourd'hui", library: 'Bibliothèque', journey: 'Parcours', saved: 'Enregistrés',
    todaysMeditation: "Méditation du jour", beginMeditation: 'Commencer la méditation',
    markComplete: 'Marquer le jour comme terminé', dayCompleted: 'Jour terminé',
    yourJourney: 'Votre parcours', keepShowingUp: 'Continuez à avancer.',
    comingSoon: 'BIENTÔT DISPONIBLE', currentEdition: 'ÉDITION EN COURS',
    thisMonthsDevotional: 'Le dévotionnel du mois', contentWillAppear: 'Le contenu apparaîtra après publication',
    goodMorning: 'Bonjour', goodAfternoon: 'Bon après-midi', goodEvening: 'Bonsoir',
    rhythmSet: 'Votre rythme est établi', momentAwaits: 'Un moment vous attend',
    content: 'Contenu', newsletters: 'Infolettres', analytics: 'Statistiques', settings: 'Paramètres',
    about: 'À propos, confidentialité et aide', notifications: 'Notifications', openReminderSettings: 'Ouvrir les rappels',
    keepDailyRhythm: 'Gardez votre rythme quotidien', dailyRhythmSet: 'Votre rythme quotidien est établi',
    yourSpace: 'VOTRE ESPACE', reading: 'LECTURE', textSize: 'Taille du texte', adjustText: 'Ajustez le texte pour une lecture confortable.',
    livePreview: 'APERÇU EN DIRECT', previewVerse: 'Ta parole est une lampe à mes pieds, Et une lumière sur mon sentier. — Psaume 119:105',
    dailyRhythm: 'RYTHME QUOTIDIEN', morningReminder: 'Rappel quotidien', language: 'LANGUE', appearance: 'APPARENCE',
    readingAppearance: 'Apparence de lecture', chooseVisualMode: 'Choisissez le mode visuel de Daily Dew.', community: 'COMMUNAUTÉ',
    ministryUpdates: 'Actualités du ministère', subscribedUpdates: 'Vous êtes abonné aux courriels Daily Dew.', receiveUpdates: 'Recevez occasionnellement des nouvelles du dévotionnel et du ministère.',
    accountAndSync: 'COMPTE ET SYNCHRONISATION', guestUser: 'Lecture en mode invité', signedInDesc: 'Vos réflexions et signets sont synchronisés avec votre compte.', signedOutDesc: 'Connectez-vous pour synchroniser vos réflexions et signets sur tous vos appareils.',
    light: 'Clair', dark: 'Sombre', english: 'English', french: 'Français', donate: 'Faire un don', login: 'Connexion', logout: 'Déconnexion', ministryDashboard: 'Tableau de bord du ministère',
    yourWalk: 'VOTRE PARCOURS', noticeGrowth: 'Remarquez ce que Dieu fait grandir en vous.', yourMonth: 'Votre mois', savedWithIntention: 'Enregistré avec intention', savedMoments: 'Moments enregistrés', bookmarks: 'Signets', reflections: 'Réflexions', prayers: 'Prières', nothingSaved: 'Rien n’est encore enregistré', savedWillAppear: 'Vos éléments enregistrés apparaîtront au fil de votre parcours dévotionnel.',
    libraryKicker: 'LA BIBLIOTHÈQUE', currentEditionLabel: 'Édition en cours', yourProgress: 'VOTRE PROGRÈS', dailyMeditations: 'Méditations quotidiennes', searchMeditations: 'Rechercher des méditations', all: 'Tout', unread: 'Non lus', complete: 'Terminés', noMeditations: 'Aucune méditation trouvée', tryAnother: 'Essayez une autre recherche ou un autre filtre.',
    openingJourney: 'Ouverture de votre parcours', restoringNotes: 'Restauration de vos réflexions et prières enregistrées...', dayOf: 'Jour', wisdomNugget: 'PENSÉE DU JOUR', furtherStudies: 'Études complémentaires', yourReflection: 'Votre réflexion', reflectionPrompt: 'Que vous demande Dieu de cultiver aujourd’hui ?', reflectionPlaceholder: 'Écrivez ce que vous avez sur le cœur...', yourPrayer: 'Votre prière', prayerPlaceholder: 'Écrivez une prière pour aujourd’hui...', declaration: 'DÉCLARATION', shareMoment: 'Partager ce moment', shareFocused: 'Partager un moment précis', createShareCard: 'Créer une carte à partager', scripture: 'Écriture', reflection: 'Réflexion', prayer: 'Prière', scriptureCard: 'Carte d’Écriture', declarationCard: 'Carte de déclaration', reflectionCard: 'Carte de réflexion', prayerCard: 'Carte de prière', meditationComplete: 'Méditation terminée', completeMeditation: 'Terminer la méditation du jour', previous: 'Précédent', nextDay: 'Jour suivant', cancel: 'Annuler', shareCard: 'Partager la carte', savedToJourney: 'Enregistré dans votre parcours', saveMeditation: 'Enregistrer cette méditation', playingMeditation: 'Méditation en cours', listenMeditation: 'Écouter la méditation', quietWord: 'Un moment paisible dans la Parole', listenAloud: 'Écouter cette méditation à voix haute', dayCompletedCount: 'jours terminés', aSteadyStep: 'Chaque pas compte.',
    accountJourney: 'VOTRE PARCOURS', yourAccount: 'Votre compte', keepJourney: 'Continuez votre parcours', accountReady: 'Votre compte Daily Dew est prêt pour la synchronisation entre appareils.', signInReady: 'Connectez-vous quand vous le souhaitez. Daily Dew reste utile sans compte.', signedInAs: 'CONNECTÉ EN TANT QUE', signOut: 'Se déconnecter', emailAddress: 'Adresse courriel', password: 'Mot de passe', working: 'En cours...', createAccount: 'Créer un compte', newHere: 'Nouveau ici ? Créer un compte', alreadyAccount: 'Vous avez déjà un compte ? Se connecter', journeyYours: 'Votre parcours vous appartient', syncAcross: 'Connectez-vous pour synchroniser votre progression. Vous pouvez continuer à lire sans compte.', backToDailyDew: 'Retour à Daily Dew', checkEmail: 'Consultez votre courriel pour confirmer votre compte.', signedIn: 'Vous êtes connecté.', invalidCredentials: 'Saisissez un courriel et un mot de passe d’au moins 6 caractères.',
    allCaughtUp: 'Tout est à jour pour aujourd’hui', meditationCompleteMessage: 'Bravo. Votre méditation du jour est terminée.', reviewMeditation: 'Revoir la méditation',
    noMeditationTodayTitle: 'Aucune méditation publiée', noMeditationTodayMsg: "La méditation du jour n'est pas encore disponible. Veuillez revenir bientôt ou explorer la bibliothèque.", exploreLibrary: 'Explorer la bibliothèque',
    supportMinistry: 'Soutenir le ministère', donationIntro: 'Votre don aide à rendre les Écritures, la prière et l’encouragement quotidien accessibles à davantage de personnes.', donationAmount: 'Montant du don', customAmount: 'Montant personnalisé', continueDonation: 'Continuer vers le paiement', donationNote: 'Paiement mobile sécurisé via Orange Money ou MTN MoMo.', donationUnavailable: 'Les dons seront bientôt disponibles.',
    back: 'Retour', aboutSupport: 'À propos et aide', aboutApp: 'À propos de l’application', privacy: 'Confidentialité', contentPermissions: 'Droits liés au contenu', terms: 'Conditions d’utilisation', contactSupport: 'Contacter le support',
    monthlyEditions: 'Éditions mensuelles', importPdf: 'Importer un PDF', newMonth: 'Nouveau mois', draft: 'Brouillon', sendToReview: 'Envoyer en révision', publish: 'Publier', noEditions: 'Aucune édition disponible pour le moment.', pdfImportQueue: 'File d’importation PDF', reviewImport: 'Réviser l’importation', meditations: 'Méditations', newsletterStudio: 'Studio des infolettres', appAnalytics: 'Statistiques de l’application', workspaceSettings: 'Paramètres de l’espace', openAppSettings: 'Ouvrir les paramètres', manageAccount: 'Gérer le compte', activeReaders: 'Lecteurs actifs', completions: 'Lectures terminées', readerRate: 'Taux de lecture', appOpens: 'Ouvertures de l’application', dailyActivity: 'Activité quotidienne',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(language: AppLanguage, key: TranslationKey) {
  return translations[language][key];
}

export function greetingForHour(hour: number, language: AppLanguage) {
  if (hour < 12) return t(language, 'goodMorning');
  if (hour < 18) return t(language, 'goodAfternoon');
  return t(language, 'goodEvening');
}
