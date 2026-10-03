/**
 * BDD spec — Stock Movement Register: Losses tab, conversions, scan filter
 * (design §8, §9, §9a — Inventory adds no new pages).
 *
 * Invariants:
 *   - Losses is a tab of the register (loss_yield flag); tapping a loss row
 *     returns to Movements filtered to that row, with a clearable chip
 *   - Conversions are their own movement type (badge + type filter)
 *   - "+ New conversion" opens a side panel (no modal) reusing the conversion form
 *   - Scanning (barcode flag) filters the register to the scanned item
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const h = vi.hoisted(() => ({ flags: {} as Record<string, boolean>, rows: [] as any[] }));

vi.mock('../services/inventoryService', () => ({
    inventoryService: {
        getMovements: vi.fn(),
        getLocations: vi.fn(),
        getOrgDefaultLogic: vi.fn(),
        searchProjects: vi.fn(),
        searchWorkOrders: vi.fn(),
        getItems: vi.fn(),
        getStockAvailability: vi.fn(),
        getLossReasons: vi.fn(),
    },
}));

vi.mock('@so360/shell-context', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@so360/shell-context')>();
    return {
        ...actual,
        useShellBridge: () => ({
            effectiveFlagsLoaded: true,
            permissionsLoaded: true,
            hasPermission: () => true,
            hasAnyPermission: () => true,
            getFeatureState: () => 'enabled',
            isFeatureEnabled: (f: string) => h.flags[f] === true,
            currentOrg: { id: 'org-1' },
        }),
    };
});

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ can: () => true }) }));

// Reused components are stubbed to their contracts (their own specs cover them).
vi.mock('./LossReportPage', () => ({
    default: ({ embedded, onRowSelect }: any) => (
        <div data-testid="loss-report" data-embedded={String(!!embedded)}>
            <button onClick={() => onRowSelect('reason', { key: 'SPOIL', label: 'Spoiled' }, { from: '2026-09-01', to: '2026-09-30' })}>
                Show movements for Spoiled
            </button>
        </div>
    ),
}));
vi.mock('./StockConversionsPage', () => ({
    default: ({ embedded, onCancel, onRecorded }: any) => (
        <div data-testid="conversion-form" data-embedded={String(!!embedded)}>
            <button onClick={onCancel}>Cancel</button>
            <button onClick={() => onRecorded({ id: 'x-1' })}>Record</button>
        </div>
    ),
}));
vi.mock('../components/ScanInput', () => ({
    default: ({ onScan, label }: any) => (
        <button aria-label={label} onClick={() => onScan({ id: 'i-2', name: 'Widget B' })}>scan</button>
    ),
}));

import StockMovementRegisterPage from './StockMovementRegisterPage';
import { inventoryService } from '../services/inventoryService';

const inv = inventoryService as any;

const mv = (over: Record<string, any>) => ({
    id: `mv-${Math.random()}`, item_id: 'i-1', warehouse_id: 'w-1', movement_type: 'adjustment', quantity: -1,
    created_at: '2026-09-10T09:00:00Z', transaction_date: '2026-09-10', reference_number: null,
    items: { name: 'Widget A' }, warehouses: { name: 'Main' }, ...over,
});

const Where = () => {
    const l = useLocation();
    return <div data-testid="where">{l.search}</div>;
};
const renderAt = (url = '/') => render(
    <MemoryRouter initialEntries={[url]}>
        <StockMovementRegisterPage />
        <Where />
    </MemoryRouter>,
);
const where = () => new URLSearchParams(screen.getByTestId('where').textContent || '');
const badges = () => screen.queryAllByTestId('movement-type-badge').map((b) => b.textContent);
const lastQuery = () => inv.getMovements.mock.calls[inv.getMovements.mock.calls.length - 1][0];

beforeEach(() => {
    vi.clearAllMocks();
    h.flags = { 'submodule:inventory:loss_yield': true };
    h.rows = [
        mv({ id: 'c-out', quantity: -5, reason_code: 'CONVERSION', source_label: 'stock_conversion:k1', movement_type: 'outbound' }),
        mv({ id: 'c-in', item_id: 'i-2', quantity: 4, source_label: 'stock_conversion:k1', movement_type: 'inbound', items: { name: 'Widget B' } }),
        mv({ id: 'spoil', quantity: -2, reason_code: 'SPOIL', movement_type: 'adjustment' }),
        mv({ id: 'recv', quantity: 10, reason_code: 'PURCHASE_RECEIPT', movement_type: 'inbound' }),
    ];
    inv.getMovements.mockImplementation(() => Promise.resolve({ data: h.rows, total: h.rows.length, limit: 100, offset: 0, has_more: false }));
    inv.getLocations.mockResolvedValue([]);
    inv.getOrgDefaultLogic.mockResolvedValue(null);
    inv.searchProjects.mockResolvedValue([]);
    inv.searchWorkOrders.mockResolvedValue([]);
    inv.getItems.mockResolvedValue({ data: [] });
    inv.getLossReasons.mockResolvedValue([]);
});

describe('Given movements written by a conversion', () => {
    it('When the register loads Then they are listed as their own CONVERSION type', async () => {
        renderAt();
        await waitFor(() => expect(badges()).toEqual(['CONVERSION', 'CONVERSION', 'ADJUSTMENT', 'RECEIPT']));
    });
    it('When the Conversion type filter is chosen Then only conversion rows show and the server is not asked for that type', async () => {
        renderAt();
        await waitFor(() => expect(badges()).toHaveLength(4));
        fireEvent.click(screen.getByText('Filters'));
        fireEvent.change(screen.getByLabelText('Filter movement type'), { target: { value: 'conversion' } });
        await waitFor(() => expect(badges()).toEqual(['CONVERSION', 'CONVERSION']));
        expect(lastQuery()).toEqual({ limit: 500 });
    });
});

describe('Given loss & yield is enabled', () => {
    it('When Losses is tapped Then the embedded loss report replaces the movements table', async () => {
        renderAt();
        fireEvent.click(await screen.findByRole('tab', { name: 'Losses' }));
        expect(screen.getByTestId('loss-report').getAttribute('data-embedded')).toBe('true');
        expect(where().get('tab')).toBe('losses');
        expect(screen.queryByTestId('movement-type-badge')).toBeNull();
    });
    it('When a loss row is tapped Then Movements opens filtered to it with a clearable chip', async () => {
        renderAt('/?tab=losses');
        fireEvent.click(await screen.findByText('Show movements for Spoiled'));
        await waitFor(() => expect(badges()).toEqual(['ADJUSTMENT']));
        expect(screen.getByRole('tab', { name: 'Movements' }).getAttribute('aria-selected')).toBe('true');
        expect(screen.getByTestId('loss-filter-chip').textContent).toContain('Spoiled');
        expect(lastQuery()).toEqual({ date_from: '2026-09-01', date_to: '2026-09-30', limit: 500 });
        fireEvent.click(screen.getByLabelText('Clear loss filter'));
        await waitFor(() => expect(badges()).toHaveLength(4));
        expect(where().get('loss_key')).toBeNull();
    });
    it('When "+ New conversion" is tapped Then the conversion form opens in a side panel, not a modal', async () => {
        renderAt();
        fireEvent.click(await screen.findByText('+ New conversion'));
        const panel = screen.getByRole('complementary', { name: 'New conversion' });
        expect(within(panel).getByTestId('conversion-form').getAttribute('data-embedded')).toBe('true');
        expect(screen.queryByRole('dialog')).toBeNull();
        fireEvent.click(within(panel).getByText('Cancel'));
        expect(screen.queryByRole('complementary', { name: 'New conversion' })).toBeNull();
    });
    it('When a conversion is recorded Then the panel closes and the register reloads', async () => {
        renderAt('/?panel=conversion');
        await waitFor(() => expect(inv.getMovements).toHaveBeenCalled());
        const before = inv.getMovements.mock.calls.length;
        fireEvent.click(screen.getByText('Record'));
        await waitFor(() => expect(inv.getMovements.mock.calls.length).toBeGreaterThan(before));
        expect(screen.queryByRole('complementary', { name: 'New conversion' })).toBeNull();
    });
});

describe('Given loss & yield is disabled', () => {
    it('When the old loss and conversion links are opened Then no tabs, panel or conversion button show', async () => {
        h.flags = {};
        renderAt('/?tab=losses&panel=conversion');
        await waitFor(() => expect(badges()).toHaveLength(4));
        expect(screen.queryByRole('tablist')).toBeNull();
        expect(screen.queryByTestId('loss-report')).toBeNull();
        expect(screen.queryByRole('complementary')).toBeNull();
        expect(screen.queryByText('+ New conversion')).toBeNull();
    });
});

describe('Given barcode scanning (design §9a)', () => {
    it('When an item is scanned Then the register is filtered to it with a clearable chip', async () => {
        h.flags['submodule:inventory:barcode_scanning'] = true;
        renderAt();
        fireEvent.click(await screen.findByLabelText('Scan to filter by item'));
        await waitFor(() => expect(lastQuery()).toEqual({ item_id: 'i-2' }));
        expect(screen.getByTestId('scan-filter-chip').textContent).toContain('Widget B');
        fireEvent.click(screen.getByLabelText('Clear item filter'));
        await waitFor(() => expect(lastQuery()).toEqual({}));
    });
    it('When scanning is off Then no scan field shows', async () => {
        renderAt();
        await waitFor(() => expect(badges()).toHaveLength(4));
        expect(screen.queryByLabelText('Scan to filter by item')).toBeNull();
    });
});
