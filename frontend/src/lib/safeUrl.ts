const TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me']);

function isLoopbackHost(hostname: string) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function getSafeExternalUrl(value: string, allowedHosts?: ReadonlySet<string>) {
    try {
        const url = new URL(value);
        const allowsDevelopmentHttp =
            process.env.NODE_ENV !== 'production' &&
            url.protocol === 'http:' &&
            isLoopbackHost(url.hostname);

        if (url.protocol !== 'https:' && !allowsDevelopmentHttp) return null;
        if (allowedHosts && !allowedHosts.has(url.hostname)) return null;

        return url.toString();
    } catch {
        return null;
    }
}

export function getSafeObjectUrl(value: string) {
    try {
        return new URL(value).protocol === 'blob:' ? value : null;
    } catch {
        return null;
    }
}

export function openSafeExternalUrl(value: string, allowedHosts?: ReadonlySet<string>) {
    const safeUrl = getSafeExternalUrl(value, allowedHosts);

    return safeUrl
        ? window.open(safeUrl, '_blank', 'noopener,noreferrer')
        : null;
}

export function isTelegramUrl(value: string) {
    return getSafeExternalUrl(value, TELEGRAM_HOSTS);
}
