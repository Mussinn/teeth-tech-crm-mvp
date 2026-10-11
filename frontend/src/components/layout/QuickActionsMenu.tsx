'use client';
import AppIcon from '@/src/components/ui/AppIcon';
import Link from 'next/link';
import {mvpModules} from '@/src/lib/mvp';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useSelector } from 'react-redux';
import {useTranslations} from 'next-intl';

import type { RootState } from '@/src/lib/store';

const QUICK_ACTIONS_POSITION_KEY = 'teeth-tech-quick-actions-position';
const LAUNCHER_SIZE = 44;
const VIEWPORT_GAP = 12;
const DRAG_THRESHOLD = 5;

type QuickActionsPosition = {
    x: number;
    y: number;
};

type DragState = {
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
};

export function clampQuickActionsPosition(
    position: QuickActionsPosition,
    viewportWidth: number,
    viewportHeight: number
): QuickActionsPosition {
    return {
        x: Math.min(
            Math.max(position.x, VIEWPORT_GAP),
            Math.max(VIEWPORT_GAP, viewportWidth - LAUNCHER_SIZE - VIEWPORT_GAP)
        ),
        y: Math.min(
            Math.max(position.y, VIEWPORT_GAP),
            Math.max(VIEWPORT_GAP, viewportHeight - LAUNCHER_SIZE - VIEWPORT_GAP)
        ),
    };
}

function getDefaultPosition(): QuickActionsPosition {
    const horizontalGap = window.innerWidth < 640 ? 16 : 24;

    return clampQuickActionsPosition(
        {
            x: window.innerWidth - LAUNCHER_SIZE - horizontalGap,
            y: window.innerHeight - LAUNCHER_SIZE - 20,
        },
        window.innerWidth,
        window.innerHeight
    );
}

function ActionIcon({ name }: { name: 'launcher' | 'close' | 'chat' | 'note' | 'help' | 'learn' }) {
    const paths = {
        help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2M12 17h.01"/></>,
        learn: <><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1ZM12 5v15"/></>,
        launcher: <><circle cx="7" cy="7" r="1.5" /><circle cx="17" cy="7" r="1.5" /><circle cx="7" cy="17" r="1.5" /><circle cx="17" cy="17" r="1.5" /></>,
        close: <path d="m18 6-12 12M6 6l12 12" />,
        chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.6-4.8A8 8 0 1 1 21 15Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>,
        note: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v5h4M9 12h6M9 16h6" /></>,
    };

    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            {paths[name]}
        </svg>
    );
}

export default function QuickActionsMenu() {
    const t = useTranslations('header');
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState<QuickActionsPosition | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const positionRef = useRef<QuickActionsPosition | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const suppressClickUntilRef = useRef(0);
    const totalUnreadCount = useSelector(
        (state: RootState) => state.chat.totalUnreadCount
    );

    useEffect(() => {
        let initialPosition = getDefaultPosition();

        try {
            const savedPosition = window.localStorage.getItem(QUICK_ACTIONS_POSITION_KEY);

            if (savedPosition) {
                const parsed = JSON.parse(savedPosition) as Partial<QuickActionsPosition>;

                if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
                    initialPosition = clampQuickActionsPosition(
                        {x: parsed.x as number, y: parsed.y as number},
                        window.innerWidth,
                        window.innerHeight
                    );
                }
            }
        } catch {
            // A blocked or malformed localStorage value should not hide the launcher.
        }

        const animationFrameId = window.requestAnimationFrame(() => {
            positionRef.current = initialPosition;
            setPosition(initialPosition);
        });

        const keepInsideViewport = () => {
            const nextPosition = clampQuickActionsPosition(
                positionRef.current ?? getDefaultPosition(),
                window.innerWidth,
                window.innerHeight
            );

            positionRef.current = nextPosition;
            setPosition(nextPosition);
        };

        window.addEventListener('resize', keepInsideViewport);
        window.visualViewport?.addEventListener('resize', keepInsideViewport);

        return () => {
            window.cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', keepInsideViewport);
            window.visualViewport?.removeEventListener('resize', keepInsideViewport);
        };
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const updatePosition = (nextPosition: QuickActionsPosition) => {
        const clampedPosition = clampQuickActionsPosition(
            nextPosition,
            window.innerWidth,
            window.innerHeight
        );

        positionRef.current = clampedPosition;
        setPosition(clampedPosition);
    };

    const savePosition = () => {
        if (!positionRef.current) return;

        try {
            window.localStorage.setItem(
                QUICK_ACTIONS_POSITION_KEY,
                JSON.stringify(positionRef.current)
            );
        } catch {
            // Dragging must keep working even when storage is unavailable.
        }
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0 || dragRef.current) return;

        const currentPosition = positionRef.current ?? {
            x: containerRef.current?.getBoundingClientRect().left ?? event.clientX,
            y: containerRef.current?.getBoundingClientRect().top ?? event.clientY,
        };

        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: currentPosition.x,
            originY: currentPosition.y,
            moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const drag = dragRef.current;

        if (!drag || drag.pointerId !== event.pointerId) return;

        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;

        if (!drag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;

        drag.moved = true;
        setIsOpen(false);
        event.preventDefault();
        updatePosition({
            x: drag.originX + deltaX,
            y: drag.originY + deltaY,
        });
    };

    const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const drag = dragRef.current;

        if (!drag || drag.pointerId !== event.pointerId) return;

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (drag.moved) {
            suppressClickUntilRef.current = Date.now() + 400;
            savePosition();
        }
        dragRef.current = null;
    };

    const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;

        dragRef.current = null;
        suppressClickUntilRef.current = 0;
    };

    const toggleMenu = () => {
        if (Date.now() < suppressClickUntilRef.current) return;

        setIsOpen((current) => !current);
    };

    const openChat = () => {
        window.dispatchEvent(new Event('teethtech:request-close-notes'));
        window.dispatchEvent(new Event('teethtech:toggle-chat'));
        setIsOpen(false);
    };

    const openNotes = () => {
        window.dispatchEvent(new Event('teethtech:close-chat'));
        window.dispatchEvent(new Event('teethtech:open-notes'));
        setIsOpen(false);
    };

    const actionClass = 'group relative flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-500 shadow-sm transition duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:bg-slate-900';
    const openDownward = position !== null && position.y < 220;

    return (
        <div
            ref={containerRef}
            style={position ? {left: position.x, top: position.y} : undefined}
            className={`fixed z-[90] h-11 w-11 ${
                position ? '' : 'bottom-5 right-4 sm:right-6'
            }`}
        >
            <div
                aria-hidden={!isOpen}
                className={`absolute right-0 grid transition-[grid-template-rows,opacity,transform] duration-200 ease-out ${
                    openDownward
                        ? 'top-[calc(100%+0.5rem)]'
                        : 'bottom-[calc(100%+0.5rem)]'
                } ${
                    isOpen
                        ? 'grid-rows-[1fr] translate-y-0 opacity-100'
                        : `pointer-events-none grid-rows-[0fr] opacity-0 ${
                            openDownward ? '-translate-y-2' : 'translate-y-2'
                        }`
                }`}
            >
                <div className="min-h-0 overflow-visible">
                    <div className="flex flex-col gap-1.5 rounded-2xl border border-slate-200/80 bg-white/80 p-1.5 shadow-lg backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/80">
{mvpModules.chat && (                        <button
                            type="button"
                            onClick={openChat}
                            tabIndex={isOpen ? 0 : -1}
                            title={t('quickChat')}
                            aria-label={totalUnreadCount > 0 ? t('openQuickChatUnread', {count: totalUnreadCount}) : t('openQuickChat')}
                            className={`${actionClass} border-slate-200 hover:border-violet-200 hover:text-violet-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-violet-300`}
                        >
                            <ActionIcon name="chat" />
                            {totalUnreadCount > 0 && (
                                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[9px] font-black text-white dark:border-slate-900">
                                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                                </span>
                            )}
                            <span className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xl group-hover:block group-focus-visible:block">{t('quickChat')}</span>
                        </button>)}

                        <Link href="/support" onClick={()=>setIsOpen(false)} tabIndex={isOpen?0:-1} aria-label="Открыть поддержку" title="Поддержка" className={`${actionClass} border-slate-200 hover:text-violet-600`}><AppIcon name="support"/><span className="quick-action-label">Поддержка</span></Link>
                        <Link href="/training" onClick={()=>setIsOpen(false)} tabIndex={isOpen?0:-1} aria-label="Открыть обучение" title="Обучение" className={`${actionClass} border-slate-200 hover:text-violet-600`}><AppIcon name="training"/><span className="quick-action-label">Обучение</span></Link>
                        <button
                            type="button"
                            onClick={openNotes}
                            tabIndex={isOpen ? 0 : -1}
                            title={t('notes')}
                            aria-label={t('openNotes')}
                            className={`${actionClass} border-slate-200 hover:border-amber-200 hover:text-amber-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-amber-300`}
                        >
                            <AppIcon name="notes" />
                            <span className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xl group-hover:block group-focus-visible:block">{t('notes')}</span>
                        </button>
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={toggleMenu}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                aria-label={isOpen ? t('closeQuickTools') : t('openQuickTools')}
                aria-expanded={isOpen}
                title={isOpen ? t('closeQuickTools') : t('quickTools')}
                className={`group relative flex h-11 w-11 touch-none cursor-grab select-none items-center justify-center rounded-2xl border shadow-[0_8px_24px_-14px_rgba(15,23,42,.45)] backdrop-blur transition-[color,background-color,border-color,box-shadow] duration-200 active:cursor-grabbing hover:border-violet-200 hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 ${
                    isOpen
                        ? 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                        : 'border-slate-200/90 bg-white/90 text-slate-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400'
                }`}
            >
                <span className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                    <ActionIcon name={isOpen ? 'close' : 'launcher'} />
                </span>
                {!isOpen && totalUnreadCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[9px] font-black text-white dark:border-slate-900">
                        {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                    </span>
                )}
                {!isOpen && <span className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xl group-hover:block group-focus-visible:block">{t('quickTools')}</span>}
            </button>
        </div>
    );
}
