/**
 * BDD specs: Warehouses page controls.
 *
 * Covers three reported defects on Inventory → Warehouses:
 *   - two competing "Add Warehouse" entry points visible at once
 *   - `*( *798y$` / `POI)EU)QR` / `IUEWR*)(@)@@` accepted as warehouse master data
 *   - a deleted warehouse still on screen after the delete reported success
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetLocations = vi.fn();
const mockCreateWarehouse = vi.fn();
const mockUpdateWarehouse = vi.fn();
const mockDeleteWarehouse = vi.fn();

vi.mock('../services/inventoryService', () => ({
    inventoryService: {
        getLocations: (...a: any[]) => mockGetLocations(...a),
        createWarehouse: (...a: any[]) => mockCreateWarehouse(...a),
        updateWarehouse: (...a: any[]) => mockUpdateWarehouse(...a),
        deleteWarehouse: (...a: any[]) => mockDeleteWarehouse(...a),
    },
}));

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({
        permissionsLoaded: true,
        hasPermission: () => true,
        hasAnyPermission: () => true,
        effectiveFlagsLoaded: true,
        getFeatureState: () => 'enabled',
        currentOrg: { id: 'org-1' },
    }),
    useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
    useQuota: () => ({ getQuota: () => ({ current_usage: 0, limit: 10, is_unlimited: false }) }),
}));

vi.mock('@so360/design-system', () => ({
    QuotaBar: () => null,
    QuotaGate: ({ children }: any) => <>{children}</>,
    FeatureGate: ({ children }: any) => <>{children}</>,
}));

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ can: () => true }) }));

vi.mock('../components/common/Modal', () => ({
    Modal: ({ isOpen, title, children }: any) =>
        isOpen ? (
            <div role="dialog" aria-label={title}>
                {children}
            </div>
        ) : null,
}));

vi.mock('../components/common/Skeleton', () => ({ TableSkeleton: () => null }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

import StockLocationsPage from './StockLocationsPage';

const warehouse = (over: Record<string, any> = {}) => ({
    id: 'wh-1',
    name: 'Dubai South Hub',
    code: 'DXB-01',
    address: '123 Logistics Park',
    is_active: true,
    ...over,
});

const openCreate = async () => {
    render(<StockLocationsPage />);
    await waitFor(() => expect(mockGetLocations).toHaveBeenCalled());
    fireEvent.click(screen.getByText('New Warehouse'));
    await screen.findByRole('dialog', { name: 'Register New Warehouse' });
};

const fill = (label: string, value: string) =>
    fireEvent.change(
        screen.getByRole('dialog', { name: 'Register New Warehouse' }).querySelector(
            `input[placeholder="${label}"]`,
        ) as HTMLElement,
        { target: { value } },
    );

beforeEach(() => {
    vi.clearAllMocks();
    mockGetLocations.mockResolvedValue([warehouse()]);
    mockCreateWarehouse.mockResolvedValue(warehouse({ id: 'wh-2' }));
    mockUpdateWarehouse.mockResolvedValue(warehouse());
    mockDeleteWarehouse.mockResolvedValue({ success: true });
});

describe('Given the warehouse creation entry points', () => {
    it('Given warehouses already exist / When the page renders / Then only the header button offers creation', async () => {
        render(<StockLocationsPage />);
        await waitFor(() => expect(screen.getByText('Dubai South Hub')).toBeInTheDocument());
        expect(screen.getByText('New Warehouse')).toBeInTheDocument();
        expect(screen.queryByTestId('empty-state-add-warehouse')).not.toBeInTheDocument();
    });

    it('Given no warehouses exist / When the page renders / Then the empty-state tile appears', async () => {
        mockGetLocations.mockResolvedValue([]);
        render(<StockLocationsPage />);
        await waitFor(() =>
            expect(screen.getByTestId('empty-state-add-warehouse')).toBeInTheDocument(),
        );
    });

    it('Given the empty state / When the tile is clicked / Then the creation modal opens', async () => {
        mockGetLocations.mockResolvedValue([]);
        render(<StockLocationsPage />);
        await waitFor(() => screen.getByTestId('empty-state-add-warehouse'));
        fireEvent.click(screen.getByTestId('empty-state-add-warehouse'));
        expect(
            await screen.findByRole('dialog', { name: 'Register New Warehouse' }),
        ).toBeInTheDocument();
    });
});

describe('Given the warehouse creation form', () => {
    it('Given the reported junk values / When saved / Then each field is rejected and nothing is created', async () => {
        await openCreate();
        fill('e.g. Dubai South Hub', '*( *798y$');
        fill('e.g. DXB-01', 'POI)EU)QR');
        fill('Street address', 'IUEWR*)(@)@@');

        fireEvent.click(screen.getByText('Register Warehouse'));

        await waitFor(() =>
            expect(screen.getByTestId('error-name')).toHaveTextContent(
                'Warehouse Name contains invalid characters.',
            ),
        );
        expect(screen.getByTestId('error-code')).toHaveTextContent(
            'Short Code may contain only letters, numbers, hyphens and underscores.',
        );
        expect(screen.getByTestId('error-address')).toHaveTextContent(
            'Enter a valid street address.',
        );
        expect(mockCreateWarehouse).not.toHaveBeenCalled();
    });

    it('Given a blank form / When saved / Then the required fields are named', async () => {
        await openCreate();
        fireEvent.click(screen.getByText('Register Warehouse'));

        await waitFor(() =>
            expect(screen.getByTestId('error-name')).toHaveTextContent(
                'Warehouse Name is required.',
            ),
        );
        expect(screen.getByTestId('error-code')).toHaveTextContent('Short Code is required.');
        expect(mockCreateWarehouse).not.toHaveBeenCalled();
    });

    it('Given an invalid city, contact and phone / When saved / Then each is reported beside its field', async () => {
        await openCreate();
        fill('e.g. Dubai South Hub', 'East Wing Warehouse');
        fill('e.g. DXB-01', 'EWH-01');
        fill('City', '12345');
        fill('Manager / Supervisor name', '99');
        fill('+971 50 000 0000', 'not-a-phone');

        fireEvent.click(screen.getByText('Register Warehouse'));

        await waitFor(() =>
            expect(screen.getByTestId('error-city')).toHaveTextContent(
                'Please enter a valid city name.',
            ),
        );
        expect(screen.getByTestId('error-contact_person')).toHaveTextContent(
            'Enter a valid contact person (letters only).',
        );
        expect(screen.getByTestId('error-contact_phone')).toHaveTextContent(
            'Enter a valid phone number.',
        );
        expect(mockCreateWarehouse).not.toHaveBeenCalled();
    });

    it('Given a fully valid warehouse / When saved / Then it is sent to the API', async () => {
        await openCreate();
        fill('e.g. Dubai South Hub', 'East Wing Warehouse');
        fill('e.g. DXB-01', 'EWH-01');
        fill('Street address', '123 Logistics Park');
        fill('City', 'Dubai');
        fill('Manager / Supervisor name', 'Ahmed Al Rashid');
        fill('+971 50 000 0000', '+971501234567');

        fireEvent.click(screen.getByText('Register Warehouse'));

        await waitFor(() =>
            expect(mockCreateWarehouse).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'East Wing Warehouse', code: 'EWH-01' }),
            ),
        );
    });

    it('Given optional fields left blank / When saved / Then they do not block the save', async () => {
        await openCreate();
        fill('e.g. Dubai South Hub', 'East Wing Warehouse');
        fill('e.g. DXB-01', 'EWH-01');

        fireEvent.click(screen.getByText('Register Warehouse'));

        await waitFor(() => expect(mockCreateWarehouse).toHaveBeenCalled());
    });

    it('Given a duplicate code rejected by the API / When saved / Then the API message is shown', async () => {
        mockCreateWarehouse.mockRejectedValue(new Error('This Short Code already exists.'));
        await openCreate();
        fill('e.g. Dubai South Hub', 'East Wing Warehouse');
        fill('e.g. DXB-01', 'DXB-01');

        fireEvent.click(screen.getByText('Register Warehouse'));

        await waitFor(() =>
            expect(screen.getByText('This Short Code already exists.')).toBeInTheDocument(),
        );
    });
});

describe('Given the warehouse edit form', () => {
    const openEdit = async () => {
        render(<StockLocationsPage />);
        await waitFor(() => expect(screen.getByText('Dubai South Hub')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Edit'));
        await screen.findByRole('dialog', { name: 'Edit Warehouse' });
    };

    it('Given the name is replaced with symbols / When saved / Then the update is blocked', async () => {
        await openEdit();
        const dialog = screen.getByRole('dialog', { name: 'Edit Warehouse' });
        const nameInput = dialog.querySelectorAll('input[type="text"]')[0] as HTMLElement;
        fireEvent.change(nameInput, { target: { value: ')*&(^' } });

        fireEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => expect(screen.getByTestId('error-name')).toBeInTheDocument());
        expect(mockUpdateWarehouse).not.toHaveBeenCalled();
    });

    it('Given valid edits / When saved / Then the update is sent', async () => {
        await openEdit();
        fireEvent.click(screen.getByText('Save Changes'));
        await waitFor(() =>
            expect(mockUpdateWarehouse).toHaveBeenCalledWith(
                'wh-1',
                expect.objectContaining({ name: 'Dubai South Hub' }),
            ),
        );
    });
});

describe('Given a warehouse is deleted', () => {
    it('Given the delete succeeds / When the list is stale / Then the card disappears immediately', async () => {
        // The list endpoint is cached server-side, so the refetch can still
        // return the deleted warehouse. The card must go regardless.
        mockGetLocations.mockResolvedValue([warehouse()]);
        render(<StockLocationsPage />);
        await waitFor(() => expect(screen.getByText('Dubai South Hub')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Delete'));
        // Two "Delete" buttons exist once the confirmation opens: the card's and
        // the dialog's. The dialog's is the last one mounted.
        const confirmButtons = screen.getAllByRole('button', { name: /^Delete$/ });
        fireEvent.click(confirmButtons[confirmButtons.length - 1]);

        await waitFor(() =>
            expect(screen.getByText('Warehouse deleted successfully')).toBeInTheDocument(),
        );
        expect(screen.queryByText('Dubai South Hub')).not.toBeInTheDocument();
    });

    it('Given the delete is refused / When it fails / Then the card stays and the reason is shown', async () => {
        mockDeleteWarehouse.mockRejectedValue(
            new Error('Cannot delete warehouse with existing stock. Transfer stock first.'),
        );
        render(<StockLocationsPage />);
        await waitFor(() => expect(screen.getByText('Dubai South Hub')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Delete'));
        // Two "Delete" buttons exist once the confirmation opens: the card's and
        // the dialog's. The dialog's is the last one mounted.
        const confirmButtons = screen.getAllByRole('button', { name: /^Delete$/ });
        fireEvent.click(confirmButtons[confirmButtons.length - 1]);

        await waitFor(() =>
            expect(
                screen.getByText('Cannot delete warehouse with existing stock. Transfer stock first.'),
            ).toBeInTheDocument(),
        );
        expect(screen.getByText('Dubai South Hub')).toBeInTheDocument();
    });
});
