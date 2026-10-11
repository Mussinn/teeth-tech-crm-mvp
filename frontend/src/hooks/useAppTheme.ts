'use client';

import { useSyncExternalStore } from 'react';

export type AppTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'teethtech-theme';
export const THEME_EVENT = 'teethtech-theme-change';

function getSystemTheme(): AppTheme {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): AppTheme | null {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : null;
}

function applyTheme(theme: AppTheme) {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = theme;
}

function subscribe(callback: () => void) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const notify = () => callback();
    const handleStorage = (event: StorageEvent) => {
        if (event.key !== THEME_STORAGE_KEY) return;
        applyTheme(getStoredTheme() ?? getSystemTheme());
        callback();
    };
    const handleSystemThemeChange = () => {
        if (getStoredTheme()) return;
        applyTheme(getSystemTheme());
        callback();
    };

    window.addEventListener(THEME_EVENT, notify);
    window.addEventListener('storage', handleStorage);
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
        window.removeEventListener(THEME_EVENT, notify);
        window.removeEventListener('storage', handleStorage);
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
}

function getSnapshot(): AppTheme {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function getServerSnapshot(): AppTheme {
    return 'light';
}

export function setAppTheme(theme: AppTheme) {
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.dispatchEvent(new Event(THEME_EVENT));
}

export function useAppTheme() {
    const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    return { theme, setTheme: setAppTheme };
}
