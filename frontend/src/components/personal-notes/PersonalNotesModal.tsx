'use client';

import { useEffect, useState } from 'react';

import PersonalNotesCard from '@/src/components/settings/PersonalNotesCard';

export default function PersonalNotesModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [closeRequestId, setCloseRequestId] = useState(0);

    useEffect(() => {
        const openNotes = () => setIsOpen(true);
        const requestCloseNotes = () => {
            setCloseRequestId((current) => current + 1);
        };

        window.addEventListener('teethtech:open-notes', openNotes);
        window.addEventListener(
            'teethtech:request-close-notes',
            requestCloseNotes
        );

        return () => {
            window.removeEventListener('teethtech:open-notes', openNotes);
            window.removeEventListener(
                'teethtech:request-close-notes',
                requestCloseNotes
            );
        };
    }, []);

    if (!isOpen) return null;

    return (
        <PersonalNotesCard
            variant="modal"
            closeRequestId={closeRequestId}
            onRequestClose={() => setIsOpen(false)}
        />
    );
}
