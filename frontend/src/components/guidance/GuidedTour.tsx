'use client';

import {useEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import {useMessages, useTranslations} from 'next-intl';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {useSelector} from 'react-redux';

import type {RootState} from '@/src/lib/store';

type GuideStep = {
    title: string;
    action: string;
    example?: string;
    check?: string;
};

type GuideMessage = {
    title: string;
    steps: GuideStep[];
};

type OnboardingMessage = {
    title: string;
    steps: GuideStep[];
};

type TourMessageShape = {
    guides: Record<string, GuideMessage>;
    tour: {
        badge: string;
        close: string;
        previous: string;
        next: string;
        finish: string;
        skip: string;
        example: string;
        check: string;
        interactiveHint: string;
        targetUnavailable: string;
        onboarding: OnboardingMessage;
    };
};

type HighlightRect = {
    top: number;
    left: number;
    width: number;
    height: number;
};

const GUIDE_TARGETS: Record<string, string[]> = {
    createOrder: [
        '[data-tour="orders-create"]',
        '[data-tour="order-customer"]',
        '[data-tour="order-task"]',
        '[data-tour="order-files"]',
        '[data-tour="order-review"]',
    ],
    processTask: [
        '[data-tour="employee-tasks"]',
        '[data-tour="employee-task-details"]',
        '[data-tour="employee-task-move"]',
    ],
    materials: [
        '[data-tour="employee-task-move"]',
        '[data-tour="material-report"]',
        '[data-tour="material-report"]',
    ],
    payrollPlan: [
        '[data-tour="payroll-employee"]',
        '[data-tour="payroll-plan"]',
        '[data-tour="payroll-cap"]',
        '[data-tour="payroll-carry"]',
        '[data-tour="payroll-save"]',
    ],
    payrollRules: [
        '[data-tour="payroll-rules"]',
        '[data-tour="payroll-rules"]',
        '[data-tour="payroll-rules"]',
        '[data-tour="payroll-rules"]',
        '[data-tour="payroll-rules"]',
    ],
    payrollCalculate: [
        '[data-tour="payroll-employee"]',
        '[data-tour="payroll-preview"]',
        '[data-tour="payroll-preview-result"]',
        '[data-tour="payroll-preview-result"]',
        '[data-tour="payroll-statement"]',
    ],
    payrollPayment: [
        '[data-tour="accounting-report"]',
        '[data-tour="accounting-report"]',
        '[data-tour="accounting-report"]',
        '[data-tour="accounting-report"]',
    ],
    workflow: [
        '[data-tour="work-type-create"]',
        '[data-tour="work-type-form"]',
        '[data-tour="work-type-stages"]',
        '[data-tour="work-types-list"]',
    ],
};

const ONBOARDING_TARGETS = [
    '',
    '[data-tour="app-navigation"]',
    '[data-tour="knowledge-base"]',
];

const AUTO_TOUR_VERSION = 'v1';
const SPOTLIGHT_PADDING = 8;
const CARD_WIDTH = 390;
const VIEWPORT_GAP = 16;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function rectForElement(element: Element): HighlightRect | null {
    const bounds = element.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return null;

    const top = clamp(bounds.top - SPOTLIGHT_PADDING, VIEWPORT_GAP, window.innerHeight - VIEWPORT_GAP);
    const left = clamp(bounds.left - SPOTLIGHT_PADDING, VIEWPORT_GAP, window.innerWidth - VIEWPORT_GAP);
    const right = clamp(bounds.right + SPOTLIGHT_PADDING, VIEWPORT_GAP, window.innerWidth - VIEWPORT_GAP);
    const bottom = clamp(bounds.bottom + SPOTLIGHT_PADDING, VIEWPORT_GAP, window.innerHeight - VIEWPORT_GAP);

    return {
        top,
        left,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
    };
}

function Backdrop({rect}: {rect: HighlightRect | null}) {
    const className = 'fixed z-[100] bg-slate-950/70 backdrop-blur-[1px]';

    if (!rect) {
        return <div aria-hidden="true" className={`${className} inset-0`} />;
    }

    const right = rect.left + rect.width;
    const bottom = rect.top + rect.height;

    return (
        <>
            <div aria-hidden="true" className={className} style={{inset: `0 0 auto 0`, height: rect.top}} />
            <div aria-hidden="true" className={className} style={{top: rect.top, left: 0, width: rect.left, height: rect.height}} />
            <div aria-hidden="true" className={className} style={{top: rect.top, left: right, right: 0, height: rect.height}} />
            <div aria-hidden="true" className={className} style={{top: bottom, right: 0, bottom: 0, left: 0}} />
        </>
    );
}

export default function GuidedTour() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const messages = useMessages();
    const t = useTranslations('knowledgeBase.tour');
    const userId = useSelector((state: RootState) => state.auth.id);
    const content = messages.knowledgeBase as unknown as TourMessageShape;
    const requestedTour = searchParams.get('tour');
    const [activeTourId, setActiveTourId] = useState<string | null>(null);
    const [stepIndex, setStepIndex] = useState(0);
    const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
    const dialogRef = useRef<HTMLDivElement | null>(null);

    const tour = useMemo(() => {
        if (!activeTourId) return null;
        if (activeTourId === 'welcome') {
            return {
                title: content.tour.onboarding.title,
                steps: content.tour.onboarding.steps,
                targets: ONBOARDING_TARGETS,
                isOnboarding: true,
            };
        }

        const guide = content.guides[activeTourId];
        const targets = GUIDE_TARGETS[activeTourId];
        if (!guide || !targets) return null;

        return {
            title: guide.title,
            steps: guide.steps,
            targets,
            isOnboarding: false,
        };
    }, [activeTourId, content]);

    const step = tour?.steps[stepIndex];
    const targetSelector = tour?.targets[stepIndex] ?? '';

    useEffect(() => {
        if (!requestedTour) return;
        if (requestedTour !== 'welcome' && !GUIDE_TARGETS[requestedTour]) return;
        setActiveTourId(requestedTour);
        setStepIndex(0);
    }, [requestedTour]);

    useEffect(() => {
        if (!tour || !step) return;

        let lastRect = '';
        const updateHighlight = () => {
            const element = targetSelector ? document.querySelector(targetSelector) : null;
            const nextRect = element ? rectForElement(element) : null;
            const serialized = JSON.stringify(nextRect);
            if (serialized !== lastRect) {
                lastRect = serialized;
                setHighlightRect(nextRect);
            }
        };

        const element = targetSelector ? document.querySelector(targetSelector) : null;
        if (element) {
            element.scrollIntoView({behavior: 'smooth', block: 'center', inline: 'nearest'});
        }

        updateHighlight();
        const delayedUpdate = window.setTimeout(updateHighlight, 350);
        const observer = new MutationObserver(updateHighlight);
        observer.observe(document.body, {childList: true, subtree: true, attributes: true});
        window.addEventListener('resize', updateHighlight);
        window.addEventListener('scroll', updateHighlight, true);

        return () => {
            window.clearTimeout(delayedUpdate);
            observer.disconnect();
            window.removeEventListener('resize', updateHighlight);
            window.removeEventListener('scroll', updateHighlight, true);
        };
    }, [step, targetSelector, tour]);

    useEffect(() => {
        if (!tour) return;
        dialogRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeTour();
            } else if (event.key === 'ArrowRight') {
                setStepIndex((current) => Math.min(tour.steps.length - 1, current + 1));
            } else if (event.key === 'ArrowLeft') {
                setStepIndex((current) => Math.max(0, current - 1));
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
        // closeTour is intentionally kept local to the active tour render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tour]);

    const markOnboardingSeen = () => {
        if (!tour?.isOnboarding) return;
        try {
            window.localStorage.setItem(
                `teethtech:onboarding:${AUTO_TOUR_VERSION}:${userId ?? 'user'}`,
                new Date().toISOString(),
            );
        } catch {
            // A blocked storage area should never prevent the user from closing the tour.
        }
    };

    const closeTour = () => {
        markOnboardingSeen();
        setActiveTourId(null);
        setStepIndex(0);
        setHighlightRect(null);
        if (requestedTour) {
            const nextParams = new URLSearchParams(searchParams.toString());
            nextParams.delete('tour');
            const nextUrl = nextParams.size > 0 ? `${pathname}?${nextParams.toString()}` : pathname;
            router.replace(nextUrl, {scroll: false});
        }
    };

    if (!tour || !step) return null;

    const isLastStep = stepIndex === tour.steps.length - 1;
    const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight;
    const availableCardWidth = Math.min(CARD_WIDTH, viewportWidth - VIEWPORT_GAP * 2);
    const cardStyle: CSSProperties = highlightRect && viewportWidth >= 640
        ? {
            width: availableCardWidth,
            left: clamp(
                highlightRect.left,
                VIEWPORT_GAP,
                viewportWidth - availableCardWidth - VIEWPORT_GAP,
            ),
            ...(viewportHeight - (highlightRect.top + highlightRect.height) > 330
                ? {top: highlightRect.top + highlightRect.height + 14}
                : {bottom: viewportHeight - highlightRect.top + 14}),
        }
        : {
            right: VIEWPORT_GAP,
            bottom: VIEWPORT_GAP,
            left: VIEWPORT_GAP,
        };

    return (
        <div aria-live="polite">
            <Backdrop rect={highlightRect} />
            {highlightRect && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed z-[101] rounded-2xl border-2 border-violet-400 shadow-[0_0_0_4px_rgba(139,92,246,.24),0_0_36px_rgba(139,92,246,.55)]"
                    style={highlightRect}
                />
            )}

            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={tour.title}
                tabIndex={-1}
                className="fixed z-[110] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-white/20 bg-white p-5 shadow-[0_28px_90px_-20px_rgba(15,23,42,.7)] outline-none dark:border-slate-700 dark:bg-slate-900 sm:p-6"
                style={cardStyle}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600 dark:text-violet-400">
                            {t('badge')} · {t('progress', {current: stepIndex + 1, total: tour.steps.length})}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-400">{tour.title}</p>
                    </div>
                    <button
                        type="button"
                        onClick={closeTour}
                        aria-label={t('close')}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    >
                        ×
                    </button>
                </div>

                <div className="mt-4 flex gap-1.5" aria-hidden="true">
                    {tour.steps.map((_, index) => (
                        <span
                            key={index}
                            className={`h-1.5 flex-1 rounded-full ${index <= stepIndex ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                        />
                    ))}
                </div>

                <h2 className="mt-5 text-xl font-black leading-tight text-slate-950 dark:text-white">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.action}</p>

                {step.example && (
                    <div className="mt-4 rounded-2xl bg-violet-50 px-4 py-3 dark:bg-violet-500/10">
                        <p className="text-[9px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-300">{t('example')}</p>
                        <p className="mt-1 text-xs leading-5 text-violet-950 dark:text-violet-100">{step.example}</p>
                    </div>
                )}
                {step.check && (
                    <div className="mt-2 rounded-2xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
                        <p className="text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">{t('check')}</p>
                        <p className="mt-1 text-xs leading-5 text-emerald-950 dark:text-emerald-100">{step.check}</p>
                    </div>
                )}

                <p className="mt-4 text-[11px] font-semibold leading-4 text-slate-400">
                    {highlightRect ? t('interactiveHint') : t('targetUnavailable')}
                </p>

                <div className="mt-5 flex items-center justify-between gap-2">
                    {stepIndex === 0 ? (
                        <button type="button" onClick={closeTour} className="rounded-xl px-3 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                            {t('skip')}
                        </button>
                    ) : (
                        <button type="button" onClick={() => setStepIndex((current) => current - 1)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                            ← {t('previous')}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => isLastStep ? closeTour() : setStepIndex((current) => current + 1)}
                        className="rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700"
                    >
                        {isLastStep ? t('finish') : `${t('next')} →`}
                    </button>
                </div>
            </div>
        </div>
    );
}
