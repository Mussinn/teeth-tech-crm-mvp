import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import Modal from './Modal';

describe('Modal', () => {
    it('renders outside of the component container', async () => {
        const taskCard = document.createElement('article');
        document.body.appendChild(taskCard);

        const {unmount} = render(
            <Modal>
                <div data-testid="modal-content">Material reconciliation</div>
            </Modal>,
            {container: taskCard}
        );

        const content = await screen.findByTestId('modal-content');
        const overlay = content.parentElement?.parentElement;

        expect(content.closest('article')).toBeNull();
        expect(overlay?.parentElement).toBe(document.body);

        unmount();
        taskCard.remove();
    });
});
