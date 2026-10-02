export type SupportedLanguage = 'en' | 'fr';

export type LocalizedText = {
  en: string;
  fr?: string;
};

export type LocalizedDevotion = {
  day: number;
  weekday: LocalizedText;
  title: LocalizedText;
  scripture: LocalizedText;
  preview: LocalizedText;
  meditation: LocalizedText;
  furtherStudies: string[];
  wisdom: LocalizedText;
  declaration: LocalizedText;
};

export function getLocalizedText(text: LocalizedText, language: SupportedLanguage) {
  return text[language] ?? text.en;
}
