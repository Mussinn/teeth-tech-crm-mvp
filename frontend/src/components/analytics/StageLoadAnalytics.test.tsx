import { fireEvent, render as rtlRender, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {NextIntlClientProvider} from 'next-intl';

import StageLoadAnalytics from './StageLoadAnalytics';
import ruMessages from '@/src/messages/ru';

function render(ui: ReactNode) {
    return rtlRender(ui, {
        wrapper: ({children}) => (
            <NextIntlClientProvider locale="ru" messages={ruMessages}>
                {children}
            </NextIntlClientProvider>
        ),
    });
}

vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
    AreaChart: ({ children, data }: { children: ReactNode; data: Array<{ key: string }> }) => (
        <div data-testid="stage-load-chart" data-stage-keys={data.map((item) => item.key).join(',')}>
            {children}
        </div>
    ),
    Area: () => null,
    CartesianGrid: () => null,
    ReferenceLine: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
}));

beforeEach(() => {
    window.localStorage.clear();
});

describe('StageLoadAnalytics', () => {
    it('filters x-axis stages and recalculates the visible summary', () => {
        render(<StageLoadAnalytics stageLoads={{ TODO: 2, MODELING: 5, DONE: 1 }} userId="user-1" />);

        expect(screen.getByTestId('stage-load-chart')).toHaveAttribute('data-stage-keys', 'TODO,MODELING,DONE');

        fireEvent.click(screen.getByRole('checkbox', { name: /Моделирование/ }));

        expect(screen.getByTestId('stage-load-chart')).toHaveAttribute('data-stage-keys', 'TODO,DONE');
        expect(screen.getByText('2/3')).toBeInTheDocument();
        expect(within(screen.getByText('Всего на этапах').parentElement!).getByText('3')).toBeInTheDocument();
        expect(within(screen.getByText('Пиковый этап').parentElement!).getByText('Новые')).toBeInTheDocument();
    });

    it('shows an empty filtered state and restores all stages', () => {
        render(<StageLoadAnalytics stageLoads={{ TODO: 2, MODELING: 5 }} userId="user-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Скрыть' }));

        expect(screen.queryByTestId('stage-load-chart')).not.toBeInTheDocument();
        expect(screen.getByText('Все этапы скрыты')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Показать все этапы' }));

        expect(screen.getByTestId('stage-load-chart')).toHaveAttribute('data-stage-keys', 'TODO,MODELING');
        expect(screen.queryByText('Все этапы скрыты')).not.toBeInTheDocument();
    });

    it('restores the saved filter for the same user without affecting another user', () => {
        const firstView = render(
            <StageLoadAnalytics stageLoads={{ TODO: 2, MODELING: 5, DONE: 1 }} userId="user-1" />
        );

        fireEvent.click(screen.getByRole('checkbox', { name: /Моделирование/ }));
        expect(window.localStorage.getItem('teethtech:analytics:stage-load:hidden:user-1')).toBe('["MODELING"]');

        firstView.unmount();
        const savedUserView = render(
            <StageLoadAnalytics stageLoads={{ TODO: 2, MODELING: 5, DONE: 1 }} userId="user-1" />
        );
        expect(screen.getByTestId('stage-load-chart')).toHaveAttribute('data-stage-keys', 'TODO,DONE');

        savedUserView.rerender(
            <StageLoadAnalytics stageLoads={{ TODO: 2, MODELING: 5, DONE: 1 }} userId="user-2" />
        );
        expect(screen.getByTestId('stage-load-chart')).toHaveAttribute('data-stage-keys', 'TODO,MODELING,DONE');
    });
});
