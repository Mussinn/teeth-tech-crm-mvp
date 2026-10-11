'use client';

import {
    createContext,
    startTransition,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import {NextIntlClientProvider} from 'next-intl';

import {isLocale, type Locale} from './config';
import {
    formatCurrency,
    formatDate,
    formatDateTime,
    formatNumber,
    formatRelativeTime,
} from './formats';
import {persistLocale} from './locale';
import type {AppMessages} from './messages';

type LocaleContextValue = {
    locale: Locale;
    isChangingLocale: boolean;
    setLocale: (locale: Locale) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

type AppI18nProviderProps = {
    children: ReactNode;
    initialLocale: Locale;
    initialMessages: AppMessages;
};

export function AppI18nProvider({
    children,
    initialLocale,
    initialMessages,
}: AppI18nProviderProps) {
    const [locale, setCurrentLocale] = useState(initialLocale);
    const [messages, setMessages] = useState(initialMessages);
    const [isChangingLocale, setIsChangingLocale] = useState(false);
    const requestIdRef = useRef(0);

    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    const setLocale = useCallback(async (nextLocale: Locale) => {
        if (nextLocale === locale || isChangingLocale) return;

        const requestId = ++requestIdRef.current;
        setIsChangingLocale(true);

        try {
            const response = await fetch(`/api/i18n/${nextLocale}`, {
                cache: 'no-store',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(`Unable to load locale ${nextLocale}`);
            }

            const payload = (await response.json()) as {
                locale?: unknown;
                messages?: AppMessages;
            };

            if (
                requestId !== requestIdRef.current
                || !isLocale(payload.locale)
                || !payload.messages
            ) {
                return;
            }

            persistLocale(payload.locale);
            startTransition(() => {
                setCurrentLocale(payload.locale as Locale);
                setMessages(payload.messages as AppMessages);
            });
        } catch (error) {
            console.error('Locale change failed:', error);
        } finally {
            if (requestId === requestIdRef.current) {
                setIsChangingLocale(false);
            }
        }
    }, [isChangingLocale, locale]);

    const contextValue = useMemo(
        () => ({locale, isChangingLocale, setLocale}),
        [isChangingLocale, locale, setLocale]
    );

    return (
        <LocaleContext.Provider value={contextValue}>
            <NextIntlClientProvider
                locale={locale}
                messages={messages}
                onError={(error) => {
                    if (process.env.NODE_ENV === 'development') {
                        console.warn('[i18n]', error);
                    }
                }}
                getMessageFallback={({namespace, key}) => (
                    namespace ? `${namespace}.${key}` : key
                )}
            >
                {children}
            </NextIntlClientProvider>
        </LocaleContext.Provider>
    );
}

export function useAppLocale(): LocaleContextValue {
    const value = useContext(LocaleContext);
    if (!value) {
        throw new Error('useAppLocale must be used inside AppI18nProvider');
    }
    return value;
}

export function useAppFormatters() {
    const {locale} = useAppLocale();

    return useMemo(() => ({
        date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
            formatDate(value, locale, options),
        dateTime: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
            formatDateTime(value, locale, options),
        number: (value: number, options?: Intl.NumberFormatOptions) =>
            formatNumber(value, locale, options),
        currency: (value: number, options?: Intl.NumberFormatOptions) =>
            formatCurrency(value, locale, options),
        relativeTime: (
            value: number,
            unit: Intl.RelativeTimeFormatUnit,
            options?: Intl.RelativeTimeFormatOptions
        ) => formatRelativeTime(value, unit, locale, options),
    }), [locale]);
}
