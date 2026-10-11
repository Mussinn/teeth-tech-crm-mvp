import {intlLocaleByLocale, type Locale} from './config';

type DateInput = Date | string | number;

function asDate(value: DateInput): Date | null {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

const dateStyleOptions: Record<
    NonNullable<Intl.DateTimeFormatOptions['dateStyle']>,
    Intl.DateTimeFormatOptions
> = {
    full: {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'},
    long: {day: 'numeric', month: 'long', year: 'numeric'},
    medium: {day: 'numeric', month: 'short', year: 'numeric'},
    short: {day: '2-digit', month: '2-digit', year: 'numeric'},
};

const timeStyleOptions: Record<
    NonNullable<Intl.DateTimeFormatOptions['timeStyle']>,
    Intl.DateTimeFormatOptions
> = {
    full: {hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'long'},
    long: {hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'},
    medium: {hour: '2-digit', minute: '2-digit', second: '2-digit'},
    short: {hour: '2-digit', minute: '2-digit'},
};

function resolveDateTimeOptions(
    options: Intl.DateTimeFormatOptions,
    defaults: Intl.DateTimeFormatOptions
): Intl.DateTimeFormatOptions {
    const {dateStyle, timeStyle, ...rest} = options;

    if (dateStyle !== undefined || timeStyle !== undefined) {
        return {
            ...(dateStyle ? dateStyleOptions[dateStyle] : {}),
            ...(timeStyle ? timeStyleOptions[timeStyle] : {}),
            ...rest,
        };
    }

    const hasExplicitOptions = Object.values(rest).some(
        (value) => value !== undefined
    );

    return hasExplicitOptions ? rest : defaults;
}

function formatDateValue(
    value: DateInput,
    locale: Locale,
    options: Intl.DateTimeFormatOptions,
    defaults: Intl.DateTimeFormatOptions
): string {
    const date = asDate(value);
    if (!date) return typeof value === 'string' ? value : '';

    return new Intl.DateTimeFormat(
        intlLocaleByLocale[locale],
        resolveDateTimeOptions(options, defaults)
    ).format(date);
}

export function formatDate(
    value: DateInput,
    locale: Locale,
    options: Intl.DateTimeFormatOptions = {}
): string {
    return formatDateValue(value, locale, options, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

export function formatDateTime(
    value: DateInput,
    locale: Locale,
    options: Intl.DateTimeFormatOptions = {}
): string {
    return formatDateValue(value, locale, options, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatNumber(
    value: number,
    locale: Locale,
    options: Intl.NumberFormatOptions = {}
): string {
    return new Intl.NumberFormat(intlLocaleByLocale[locale], options).format(value);
}

export function formatCurrency(
    value: number,
    locale: Locale,
    options: Intl.NumberFormatOptions = {}
): string {
    return new Intl.NumberFormat(intlLocaleByLocale[locale], {
        style: 'currency',
        currency: 'KZT',
        currencyDisplay: 'narrowSymbol',
        maximumFractionDigits: 0,
        ...options,
    }).format(value);
}

export function formatRelativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    locale: Locale,
    options: Intl.RelativeTimeFormatOptions = {}
): string {
    return new Intl.RelativeTimeFormat(intlLocaleByLocale[locale], {
        numeric: 'auto',
        ...options,
    }).format(value, unit);
}
