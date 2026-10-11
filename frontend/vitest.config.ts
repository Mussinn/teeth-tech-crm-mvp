import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('.', import.meta.url)),
        },
    },
    test: {
        // Node 25's native storage conflicts with jsdom's browser storage.
        execArgv: Number(process.versions.node.split('.')[0]) >= 25
            ? ['--no-experimental-webstorage'] : [],
        environment: 'jsdom',
        environmentOptions: { jsdom: { url: 'http://localhost/' } },
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
    },
});
