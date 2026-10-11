'use client';

import {ReactNode, useEffect, useSyncExternalStore} from "react";
import {createPortal} from "react-dom";

const subscribe = () => () => undefined;
let openModalCount = 0;
let previousBodyOverflow = '';

interface props {
    children : ReactNode | ReactNode[];
    contentClassName?: string;
}

const Modal = ({children, contentClassName = 'max-w-xl p-4 sm:p-6'} : props) => {
    const isMounted = useSyncExternalStore(subscribe, () => true, () => false);

    useEffect(() => {
        if (!isMounted) return;

        if (openModalCount === 0) {
            previousBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        openModalCount += 1;

        return () => {
            openModalCount = Math.max(0, openModalCount - 1);
            if (openModalCount === 0) {
                document.body.style.overflow = previousBodyOverflow;
            }
        };
    }, [isMounted]);

    if (!isMounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-slate-950/55 p-0 backdrop-blur-md sm:items-center sm:p-4">
            <div className={`flex max-h-[94dvh] w-full flex-col overflow-y-auto overscroll-contain rounded-t-[28px] border border-white/60 bg-white shadow-[0_28px_90px_-24px_rgba(15,23,42,.55)] dark:border-slate-700 dark:bg-slate-900 sm:max-h-[calc(100dvh-2rem)] sm:rounded-[28px] ${contentClassName}`}>
                {children}
            </div>
        </div>,
        document.body
    );
}

export default Modal;
