import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {useTranslations} from 'next-intl';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useState} from 'react';

import {AppI18nProvider, useAppLocale} from './provider';
import enMessages from '@/src/messages/en';
import kkMessages from '@/src/messages/kk';
import ruMessages from '@/src/messages/ru';

function LocaleProbe() {
    const t = useTranslations('navigation');
    const {locale, setLocale} = useAppLocale();

    return (
        <div>
            <span>{locale}</span>
            <strong>{t('orders')}</strong>
            <button type="button" onClick={() => void setLocale('en')}>en</button>
            <button type="button" onClick={() => void setLocale('kk')}>kk</button>
        </div>
    );
}

describe('AppI18nProvider', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('switches RU → EN → KK without remounting application state', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            const locale = url.endsWith('/kk') ? 'kk' : 'en';
            return new Response(JSON.stringify({
                locale,
                messages: locale === 'kk' ? kkMessages : enMessages,
            }), {status: 200});
        }));

        function StatefulProbe() {
            const [localState, setLocalState] = useState(0);
            return (
                <>
                    <LocaleProbe />
                    <button type="button" onClick={() => setLocalState((value) => value + 1)}>state</button>
                    <span data-testid="state">{localState}</span>
                </>
            );
        }

        render(
            <AppI18nProvider initialLocale="ru" initialMessages={ruMessages}>
                <StatefulProbe />
            </AppI18nProvider>
        );

        expect(screen.getByText('Заказы')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'state'}));
        fireEvent.click(screen.getByRole('button', {name: 'en'}));
        await screen.findByText('Orders');
        fireEvent.click(screen.getByRole('button', {name: 'kk'}));
        await screen.findByText('Тапсырыстар');

        await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('1'));
    });
});
