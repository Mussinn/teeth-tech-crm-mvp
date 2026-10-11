export const locales = ['ru', 'kk', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ru';
export const localeCookieName = 'teethtech-locale';

export const intlLocaleByLocale: Record<Locale, string> = {
    ru: 'ru-RU',
    kk: 'kk-KZ',
    en: 'en-US',
};

export const localeLabels: Record<Locale, string> = {
    ru: 'Русский',
    kk: 'Қазақша',
    en: 'English',
};

export const localeShortLabels: Record<Locale, string> = {
    ru: 'RU',
    kk: 'KZ',
    en: 'EN',
};

export function isLocale(value: unknown): value is Locale {
    return typeof value === 'string' && locales.includes(value as Locale);
}
