# TeethTech MVP frontend

Next.js / React frontend с существующим полным процессом заказов, рабочей зоной, заметками, KPI и обучением. Запуск всего продукта описан в [../README.md](../README.md).

`npm ci`, `npm run typecheck`, `npm test`, `npm run build`.

`src/lib/mvp.ts` определяет доступность модулей. Warehouse/finance по умолчанию выключены. На сервере cookies и доступ к API проходят через Next.js; публичный URL backend не требуется. KPI выполняет серверную проверку прав.
