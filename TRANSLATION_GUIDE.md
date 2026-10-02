# Daily Dew Translation Workflow

English is the source language for the first release. French content will be added as a reviewed translation, not published automatically.

## Per-entry workflow

1. Translate the title, weekday label, preview, meditation, wisdom nugget, and declaration.
2. Keep Bible references unchanged.
3. Confirm the Bible translation used for the French scripture text before adding quoted verses.
4. Preserve the spiritual meaning, tone, and prayer language of the approved English source.
5. Have a ministry reviewer approve the entry before it becomes selectable in the app.

## Content shape

```ts
{
  title: { en: 'The Blessing Before The Command', fr: '...' },
  meditation: { en: '...', fr: '...' },
  wisdom: { en: '...', fr: '...' },
  declaration: { en: '...', fr: '...' }
}
```

Until a French entry has been reviewed, the app falls back to English rather than showing an incomplete translation.
