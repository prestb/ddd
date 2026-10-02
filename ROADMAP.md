# Daily Dew Mobile App Roadmap

This is the working checklist for turning the Daily Dew hard-copy devotional into a global mobile experience.

Legend: `[x]` complete, `[~]` in progress, `[ ]` planned.

## Phase 1: Foundation

- [x] Confirm the product direction: an interactive daily devotional, not a PDF reader.
- [x] Choose the initial platform approach: Expo React Native with TypeScript.
- [x] Install the local development tools and Expo Go.
- [x] Create the Android-ready Expo project.
- [x] Set up a working Expo tunnel for Android testing.

## Phase 2: Interactive Prototype

- [x] Create the Daily Dew visual direction and home screen.
- [x] Add the monthly theme card and reading progress.
- [x] Add a seven-day journey preview.
- [x] Add the daily meditation reader.
- [x] Add scripture, meditation, further studies, wisdom nugget, and declaration sections.
- [x] Add reflection and prayer input fields.
- [x] Add the meditation completion action.
- [x] Add working navigation from Home to Read.
- [x] Test the complete daily flow on a real Android phone.

## Phase 3: Personal Memory

- [x] Save reflections, prayers, completion progress, and bookmarks on the device.
- [x] Restore saved data when the app is reopened.
- [x] Add a personal prayer list with answered-prayer status.
- [x] Add a progress calendar and monthly history.

## Phase 4: Product Structure And UX

- [x] Define the product direction: an interactive daily devotional, not a PDF reader.
  - [x] Define the first navigation model and core user journeys.
  - [x] Keep Reader contextual and remove the redundant permanent Read tab.
- [~] Complete the reusable screen shell, UI tokens, and interaction states; the main shell and visual system are implemented, with final polish still remaining.
- [x] Complete the Reader interaction model with progress, day navigation, and continuation controls.
- [x] Add the first Journey/progress experience with a monthly completion calendar.
  - [x] Add prayer list and answered-prayer tracking inside Journey.
  - [x] Add saved-content views for bookmarks, reflections, and prayers inside Journey.
  - [x] Add Library search and filters for unread, completed, and saved meditations.
  - [x] Add persisted reminder and notification preferences in Settings.
  - [x] Add native sharing for devotional moments, declarations, reflections, and prayers.
- [ ] Test the structure with sample content on multiple Android screen sizes.

## Phase 5: Real Devotional Content

- [ ] Confirm digital publishing permission for the devotional.
- [ ] Confirm Bible translation licensing, especially NKJV usage.
- [x] Extract the first complete monthly edition into structured content.
- [x] Separate public devotional content from internal ministry information.
- [x] Add the full first edition to the app; editorial and rights review remain before public release.
- [ ] Create a reusable monthly edition content format.

## Phase 6: Audio And Daily Habit

- [x] Add audio playback controls using spoken devotional text.
- [x] Decide between recorded narration and text-to-speech for the first release: use text-to-speech initially.
- [~] Add daily reminder scheduling at 7:00 AM; Expo Go requires a development build for Android notifications.
- [x] Add offline access by caching the latest published monthly edition on the device.
- [x] Add shareable scripture, prayer, declaration, and personal reflection cards.

## Phase 7: Content Management And Global Reach

- [x] Prepare and apply the secure content database schema.
- [x] Seed and publish the first monthly edition after review.
- [x] Connect the app to published Supabase content with an offline fallback.
- [~] Add a simple ministry content dashboard for monthly releases; edition status controls and new-meditation authoring are implemented, pending the editor-role and authoring migrations.
- [~] Add optional user accounts; email sign-in/sign-up, persistent sessions, and continuous core data sync are ready. Answered-prayer sync is implemented and awaits applying the Supabase migration.
- [x] Prepare English and French content workflows; reviewed French entries are still required before enabling French content.
- [x] Add accessibility settings such as font size and contrast; text-size control is confirmed on Android.
- [ ] Add moderated testimony submission if the ministry wants it.

## Phase 8: Quality And Release

- [ ] Test on several Android screen sizes and Android versions.
  - [ ] Test offline behavior, notifications, audio, and saved content.
- [ ] Review theology, spelling, scripture references, and translations.
- [~] Add privacy policy, terms, and content permissions; the in-app trust and support surface is in place, pending ministry/legal review and final published URLs.
- [ ] Prepare app icon, screenshots, store description, and support contact.
- [ ] Create an Android release build.
- [ ] Publish a closed beta for ministry testers.
- [ ] Publish the first public release.

## Current Next Step

Apply the answered-prayer migration, then move into multi-device and multi-screen-size QA using the July edition.
