import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// Lazy arrow factory — the module is imported below, so the mock must not
// capture anything defined after hoisting.
vi.mock('../../services/inventoryService', () => ({
    inventoryService: {
        getCategoryChannels: vi.fn(),
        setCategoryChannels: vi.fn(),
    },
}));

import CategoryChannelsPanel from './CategoryChannelsPanel';
import { inventoryService } from '../../services/inventoryService';

const svc = inventoryService as unknown as {
    getCategoryChannels: ReturnType<typeof vi.fn>;
    setCategoryChannels: ReturnType<typeof vi.fn>;
};

const rows = (overrides: Record<string, Partial<{ is_visible: boolean; inherited_from_depth: number }>> = {}) =>
    ['web', 'mobile', 'neura', 'whatsapp', 'instagram', 'facebook', 'pos'].map(channel => ({
        category_id: 'cat-1',
        channel,
        is_visible: overrides[channel]?.is_visible ?? true,
        inherited_from_depth: overrides[channel]?.inherited_from_depth ?? 0,
    }));

beforeEach(() => {
    vi.clearAllMocks();
    svc.getCategoryChannels.mockResolvedValue(rows());
    svc.setCategoryChannels.mockResolvedValue([]);
});

describe('Given a category published to every channel', () => {
    describe('When the panel loads', () => {
        it('Then every channel switch reads as on', async () => {
            render(<CategoryChannelsPanel categoryId="cat-1" canManage />);

            await waitFor(() => expect(screen.getByLabelText('Web store')).toBeTruthy());
            expect(screen.getByLabelText('Web store').getAttribute('aria-checked')).toBe('true');
            expect(screen.getByLabelText('Neura AI').getAttribute('aria-checked')).toBe('true');
        });

        it('Then Neura is offered as its own channel, separate from the web store', async () => {
            render(<CategoryChannelsPanel categoryId="cat-1" canManage />);

            await waitFor(() => expect(screen.getByLabelText('Neura AI')).toBeTruthy());
        });

        it('Then Save is disabled until something actually changes', async () => {
            render(<CategoryChannelsPanel categoryId="cat-1" canManage />);

            await waitFor(() => expect(screen.getByText('Save channels')).toBeTruthy());
            expect(
                (screen.getByText('Save channels').closest('button') as HTMLButtonElement).disabled,
            ).toBe(true);
        });
    });
});

describe('Given a merchant withholds a category from the AI agent', () => {
    describe('When Neura is switched off and saved', () => {
        it('Then only the Neura flag is sent as false', async () => {
            render(<CategoryChannelsPanel categoryId="cat-1" canManage />);
            await waitFor(() => expect(screen.getByLabelText('Neura AI')).toBeTruthy());

            fireEvent.click(screen.getByLabelText('Neura AI'));
            fireEvent.click(screen.getByText('Save channels'));

            await waitFor(() => expect(svc.setCategoryChannels).toHaveBeenCalled());
            const [categoryId, channels, applyToChildren] = svc.setCategoryChannels.mock.calls[0];
            expect(categoryId).toBe('cat-1');
            expect(channels.find((c: any) => c.channel === 'neura').is_visible).toBe(false);
            expect(channels.find((c: any) => c.channel === 'web').is_visible).toBe(true);
            expect(applyToChildren).toBe(false);
        });

        it('Then the caller is notified so the page can log the activity', async () => {
            const onSaved = vi.fn();
            render(<CategoryChannelsPanel categoryId="cat-1" canManage onSaved={onSaved} />);
            await waitFor(() => expect(screen.getByLabelText('Neura AI')).toBeTruthy());

            fireEvent.click(screen.getByLabelText('Neura AI'));
            fireEvent.click(screen.getByText('Save channels'));

            await waitFor(() => expect(onSaved).toHaveBeenCalled());
            expect(onSaved.mock.calls[0][0].neura).toBe(false);
        });
    });

    describe('When "apply to every subcategory" is ticked', () => {
        it('Then the cascade flag is sent to the backend', async () => {
            render(<CategoryChannelsPanel categoryId="cat-1" canManage />);
            await waitFor(() => expect(screen.getByLabelText('Neura AI')).toBeTruthy());

            fireEvent.click(screen.getByLabelText('Neura AI'));
            fireEvent.click(screen.getByText('Also apply to every subcategory'));
            fireEvent.click(screen.getByText('Save channels'));

            await waitFor(() => expect(svc.setCategoryChannels).toHaveBeenCalled());
            expect(svc.setCategoryChannels.mock.calls[0][2]).toBe(true);
        });
    });
});

describe('Given a subcategory with no channel rows of its own', () => {
    beforeEach(() => {
        svc.getCategoryChannels.mockResolvedValue(
            rows({ neura: { is_visible: false, inherited_from_depth: 2 } }),
        );
    });

    describe('When the panel loads', () => {
        it('Then the inherited channel is labelled so the merchant knows the value came from an ancestor', async () => {
            render(<CategoryChannelsPanel categoryId="cat-1" canManage />);

            await waitFor(() => expect(screen.getByLabelText('Neura AI')).toBeTruthy());
            expect(screen.getAllByText('inherited').length).toBe(1);
        });

        it('Then the inherited value is still shown as the effective state', async () => {
            render(<CategoryChannelsPanel categoryId="cat-1" canManage />);

            await waitFor(() => expect(screen.getByLabelText('Neura AI')).toBeTruthy());
            expect(screen.getByLabelText('Neura AI').getAttribute('aria-checked')).toBe('false');
        });
    });
});

describe('Given a user without manage permission', () => {
    describe('When the panel loads', () => {
        it('Then no save control is offered', async () => {
            render(<CategoryChannelsPanel categoryId="cat-1" canManage={false} />);

            await waitFor(() => expect(screen.getByLabelText('Web store')).toBeTruthy());
            expect(screen.queryByText('Save channels')).toBeNull();
        });

        it('Then the switches cannot be toggled', async () => {
            render(<CategoryChannelsPanel categoryId="cat-1" canManage={false} />);

            await waitFor(() => expect(screen.getByLabelText('Neura AI')).toBeTruthy());
            fireEvent.click(screen.getByLabelText('Neura AI'));

            expect(screen.getByLabelText('Neura AI').getAttribute('aria-checked')).toBe('true');
        });
    });
});

describe('Given the backend rejects the write', () => {
    describe('When saving fails', () => {
        it('Then the error is surfaced instead of a false success', async () => {
            svc.setCategoryChannels.mockRejectedValue(new Error('Forbidden'));
            render(<CategoryChannelsPanel categoryId="cat-1" canManage />);
            await waitFor(() => expect(screen.getByLabelText('Neura AI')).toBeTruthy());

            fireEvent.click(screen.getByLabelText('Neura AI'));
            fireEvent.click(screen.getByText('Save channels'));

            await waitFor(() => expect(screen.getByText('Forbidden')).toBeTruthy());
        });
    });

    describe('When loading fails', () => {
        it('Then the load error is shown rather than an empty panel', async () => {
            svc.getCategoryChannels.mockRejectedValue(new Error('Network down'));
            render(<CategoryChannelsPanel categoryId="cat-1" canManage />);

            await waitFor(() => expect(screen.getByText('Network down')).toBeTruthy());
        });
    });
});
