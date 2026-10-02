# Backend Plan

The app currently uses local device storage so it works offline and remains easy to test. The next production step is a hosted backend with three responsibilities:

- Store reviewed monthly editions and translations.
- Sync a user's notes, prayers, bookmarks, progress, language, and reading preferences.
- Keep draft and review content private until the ministry publishes an edition.

The proposed schema is in `backend/supabase-schema.sql`. It separates public devotional content from private user memory and applies row-level security to user-owned data.

## Connection checklist

- Create a Supabase project owned by the ministry.
- Run the schema after review.
- Add the project URL and anonymous key to `.env`.
- Add the client connection behind a repository interface.
- Keep local storage as an offline fallback.
- Test sign-in, sync conflicts, offline edits, and account deletion before release.

Do not place a service-role key in the mobile app. Only the public anonymous key belongs in the Expo environment.
