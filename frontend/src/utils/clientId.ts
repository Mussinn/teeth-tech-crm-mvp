let fallbackCounter = 0;

export function createClientId(prefix = 'client') {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    fallbackCounter += 1;

    return [
        prefix,
        Date.now().toString(36),
        fallbackCounter.toString(36),
        Math.random().toString(36).slice(2),
    ].join('-');
}
