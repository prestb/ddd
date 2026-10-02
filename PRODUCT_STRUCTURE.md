# Daily Dew Product Structure

The July devotional is sample content for building and testing the product. The app structure, interaction model, and personal features come first; editorial publishing comes later.

## Core Navigation

- **Home**: today's invitation, progress, current edition, recent activity, and the next best action.
- **Reader**: a focused devotional reading experience opened from Home, Library, Journey, or a saved entry; it is not a permanent tab.
- **Library**: browse editions and days, search/filter when multiple editions exist, and reopen saved entries.
- **Journey**: monthly progress calendar, streaks, completed days, bookmarks, and personal notes.
- **Settings**: appearance, language, reminders, audio preferences, privacy, account, and help.

## Primary User Journeys

1. Open the app, see today's devotion, start reading, reflect, pray, and mark it complete.
2. Return later, resume the current devotion, or open a previous day from the Library.
3. Save a devotion or prayer, then find it from Journey or Library.
4. Change text size, language, reminder time, or audio behavior without losing progress.
5. Use the app with no network, then automatically refresh published content when connected.

## Screen States To Build

Every cloud-backed screen needs loading, populated, empty, offline, and recoverable error states. Every personal action needs a clear saved, unsaved, and unavailable state.

## Structure-First Build Order

- [ ] Establish the final tab/navigation information architecture.
- [ ] Build a reusable screen shell, headers, cards, buttons, typography, spacing, and accessible color tokens.
- [ ] Add global loading, offline, empty, and error states.
- [ ] Complete the Reader interaction model, including section progress and resume behavior.
- [ ] Build the Journey/progress experience.
- [ ] Build prayer list and answered-prayer tracking.
- [ ] Add bookmarks and saved-content views.
- [ ] Add reminders and notification preferences.
- [ ] Add sharing and reflection export flows.
- [ ] Add account and sync boundaries without requiring sign-in for the core experience.
- [ ] Test the full structure with sample content on multiple Android screen sizes.

## Content Later

- Reusable monthly edition format and publishing dashboard.
- Editorial review of imported devotional text.
- Bible translation permissions and licensing.
- Reviewed translations.
- Ministry approval and public release content.
