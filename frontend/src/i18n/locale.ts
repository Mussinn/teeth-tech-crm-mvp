import {
    defaultLocale,
    isLocale,
    localeCookieName,
    type Locale,
} from './config';

const oneYearInSeconds = 60 * 60 * 24 * 365;

function localeFromLanguageTag(languageTag: string): Locale | null {
    const primaryLanguage = languageTag.trim().toLowerCase().split('-')[0];
    return isLocale(primaryLanguage) ? primaryLanguage : null;
}

export function resolveLocale(
    savedLocale: string | null | undefined,
    acceptedLanguages?: string | null
): Locale {
    if (savedLocale !== null && savedLocale !== undefined) {
        return isLocale(savedLocale) ? savedLocale : defaultLocale;
    }

    if (acceptedLanguages) {
        for (const entry of acceptedLanguages.split(',')) {
            const [languageTag] = entry.trim().split(';');
            const locale = localeFromLanguageTag(languageTag);
            if (locale) return locale;
        }
    }

    return defaultLocale;
}

export function persistLocale(locale: Locale): void {
    if (typeof document === 'undefined') return;

    const attributes = [
        `${localeCookieName}=${locale}`,
        'Path=/',
        `Max-Age=${oneYearInSeconds}`,
        'SameSite=Lax',
    ];
    if (window.location.protocol === 'https:') attributes.push('Secure');

    document.cookie = attributes.join('; ');
}
