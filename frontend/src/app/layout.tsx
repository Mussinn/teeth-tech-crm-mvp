import type {Metadata} from 'next';
import {cookies, headers} from 'next/headers';
import Script from 'next/script';
import './globals.css';
import StoreProvider from './StoreProvider';
import {AppI18nProvider} from '@/src/i18n/provider';
import {localeCookieName} from '@/src/i18n/config';
import {resolveLocale} from '@/src/i18n/locale';
import {loadMessages} from '@/src/i18n/messages';

export async function generateMetadata(): Promise<Metadata> {
    const cookieStore = await cookies();
    const headerStore = await headers();
    const locale = resolveLocale(
        cookieStore.get(localeCookieName)?.value,
        headerStore.get('accept-language')
    );
    const messages = await loadMessages(locale);

    return {
        title: 'TeethTech CRM',
        description: messages.common.appDescription,
    };
}

const themeScript = `
(() => {
  try {
    const saved = localStorage.getItem('teethtech-theme');
    const dark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (_) {}
})();`;

export default async function RootLayout({
                                             children,
                                         }: Readonly<{
    children: React.ReactNode;
}>) {
    const cookieStore = await cookies();
    const headerStore = await headers();
    const nonce = headerStore.get('x-nonce') ?? undefined;
    const locale = resolveLocale(
        cookieStore.get(localeCookieName)?.value,
        headerStore.get('accept-language')
    );
    const messages = await loadMessages(locale);

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                <Script id="initial-theme" nonce={nonce} strategy="beforeInteractive">
                    {themeScript}
                </Script>
            </head>
            <body>
                <AppI18nProvider initialLocale={locale} initialMessages={messages}>
                    <StoreProvider>
                        {children}
                    </StoreProvider>
                </AppI18nProvider>
            </body>
        </html>
    );
}
