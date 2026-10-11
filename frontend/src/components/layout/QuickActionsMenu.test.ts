import {createElement} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import QuickActionsMenu, {clampQuickActionsPosition} from './QuickActionsMenu';

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

vi.mock('react-redux', () => ({
    useSelector: () => 0,
}));

beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 390,
    });
    Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: 844,
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        callback(0);
        return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
    HTMLElement.prototype.releasePointerCapture = vi.fn();
});

describe('clampQuickActionsPosition', () => {
    it('keeps the launcher inside all viewport edges', () => {
        expect(clampQuickActionsPosition({x: -100, y: 900}, 390, 844)).toEqual({
            x: 12,
            y: 788,
        });
    });

    it('preserves a position that already fits inside the viewport', () => {
        expect(clampQuickActionsPosition({x: 120, y: 240}, 390, 844)).toEqual({
            x: 120,
            y: 240,
        });
    });

    it('handles a viewport narrower than the launcher safely', () => {
        expect(clampQuickActionsPosition({x: 40, y: 40}, 40, 40)).toEqual({
            x: 12,
            y: 12,
        });
    });

    it('moves the launcher without opening it and saves the new position', () => {
        render(createElement(QuickActionsMenu));

        const launcher = screen.getByRole('button', {name: 'openQuickTools'});
        const container = launcher.parentElement;

        expect(container).toHaveStyle({left: '330px', top: '780px'});

        fireEvent.pointerDown(launcher, {
            button: 0,
            clientX: 352,
            clientY: 802,
            pointerId: 1,
        });
        fireEvent.pointerMove(launcher, {
            button: 0,
            clientX: 90,
            clientY: 250,
            pointerId: 1,
        });
        fireEvent.pointerUp(launcher, {
            button: 0,
            clientX: 90,
            clientY: 250,
            pointerId: 1,
        });
        fireEvent.click(launcher);

        expect(container).toHaveStyle({left: '68px', top: '228px'});
        expect(launcher).toHaveAttribute('aria-expanded', 'false');
        expect(window.localStorage.getItem('teeth-tech-quick-actions-position')).toBe(
            JSON.stringify({x: 68, y: 228})
        );
    });
});
