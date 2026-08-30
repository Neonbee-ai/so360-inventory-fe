/**
 * BDD specs: Storage Location and Warehouse master-data validation.
 *
 * The reported defect: `)*&(^` was accepted as a Location Name and `_( )*_`
 * as a Location Code, producing foundational inventory records that no report,
 * scanner or integration can make sense of.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@so360/shell-context', () => ({
    useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
    useShellBridge: () => ({
        permissionsLoaded: true,
        hasPermission: () => true,
        effectiveFlagsLoaded: true,
        getFeatureState: () => 'enabled',
    }),
}));

vi.mock('@so360/design-system', () => ({
    FeatureGate: ({ children }: any) => <>{children}</>,
}));

const mockGetWarehouse = vi.fn();
const mockUpdateWarehouse = vi.fn();
const mockCreateLocation = vi.fn();
const mockUpdateLocation = vi.fn();

vi.mock('../services/inventoryService', () => ({
    inventoryService: {
        getWarehouse: (...a: any[]) => mockGetWarehouse(...a),
        updateWarehouse: (...a: any[]) => mockUpdateWarehouse(...a),
        deleteWarehouse: vi.fn(),
        createLocation: (...a: any[]) => mockCreateLocation(...a),
        updateLocation: (...a: any[]) => mockUpdateLocation(...a),
        deleteLocation: vi.fn(),
    },
}));

vi.mock('react-router-dom', () => ({
    useParams: () => ({ id: 'wh-1' }),
    useNavigate: () => vi.fn(),
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

import WarehouseDetailPage from './WarehouseDetailPage';

const WAREHOUSE = {
    id: 'wh-1',
    name: 'Dubai South Hub',
    code: 'DXB-01',
    address: '123 Logistics Park',
    is_active: true,
    warehouse_locations: [{ id: 'loc-1', name: 'Zone A', code: 'ZA', warehouse_bins: [] }],
    stock_balances: [],
};

const openLocationModal = async () => {
    render(<WarehouseDetailPage />);
    await waitFor(() => expect(mockGetWarehouse).toHaveBeenCalled());
    fireEvent.click(await screen.findByText('Add Location'));
    await screen.findByRole('dialog', { name: 'Add Storage Location' });
};

const setLocation = (placeholder: string, value: string) =>
    fireEvent.change(
        screen
            .getByRole('dialog', { name: 'Add Storage Location' })
            .querySelector(`input[placeholder="${placeholder}"]`) as HTMLElement,
        { target: { value } },
    );

beforeEach(() => {
    vi.clearAllMocks();
    mockGetWarehouse.mockResolvedValue(WAREHOUSE);
    mockCreateLocation.mockResolvedValue({ id: 'loc-2' });
    mockUpdateWarehouse.mockResolvedValue(WAREHOUSE);
});

describe('Given the Add Storage Location form', () => {
    it('Given the reported symbol-only values / When saved / Then both fields are rejected and nothing is created', async () => {
        await openLocationModal();
        setLocation('e.g. Zone A, Aisle 3', ')*&(^');
        setLocation('e.g. ZA, A3', '_( )*_');

        fireEvent.click(screen.getAllByText('Add Location')[1]);

        await waitFor(() =>
            expect(screen.getByTestId('error-location-name')).toBeInTheDocument(),
        );
        expect(screen.getByTestId('error-location-code')).toBeInTheDocument();
        expect(mockCreateLocation).not.toHaveBeenCalled();
    });

    it('Given a blank form / When saved / Then both fields are reported as required', async () => {
        await openLocationModal();

        fireEvent.click(screen.getAllByText('Add Location')[1]);

        await waitFor(() =>
            expect(screen.getByTestId('error-location-name')).toHaveTextContent(
                'Location Name is required.',
            ),
        );
        expect(screen.getByTestId('error-location-code')).toHaveTextContent(
            'Location Code is required.',
        );
        expect(mockCreateLocation).not.toHaveBeenCalled();
    });

    it('Given business-friendly values / When saved / Then the location is created', async () => {
        await openLocationModal();
        setLocation('e.g. Zone A, Aisle 3', 'Raw Material Rack A');
        setLocation('e.g. ZA, A3', 'RM-01');

        fireEvent.click(screen.getAllByText('Add Location')[1]);

        await waitFor(() =>
            expect(mockCreateLocation).toHaveBeenCalledWith('wh-1', {
                name: 'Raw Material Rack A',
                code: 'RM-01',
            }),
        );
    });

    it('Given a code containing a space / When saved / Then the allowed characters are spelled out', async () => {
        await openLocationModal();
        setLocation('e.g. Zone A, Aisle 3', 'Raw Material Rack A');
        setLocation('e.g. ZA, A3', 'RM 01');

        fireEvent.click(screen.getAllByText('Add Location')[1]);

        await waitFor(() =>
            expect(screen.getByTestId('error-location-code')).toHaveTextContent(
                'Location Code may contain only letters, numbers, hyphens and underscores.',
            ),
        );
    });
});

describe('Given the warehouse edit form on the detail page', () => {
    const openEdit = async () => {
        render(<WarehouseDetailPage />);
        await waitFor(() => expect(mockGetWarehouse).toHaveBeenCalled());
        fireEvent.click(await screen.findByTitle('Edit Warehouse'));
        await screen.findByRole('dialog', { name: 'Edit Warehouse' });
    };

    it('Given the name replaced with symbols / When saved / Then the update is blocked', async () => {
        await openEdit();
        const dialog = screen.getByRole('dialog', { name: 'Edit Warehouse' });
        fireEvent.change(dialog.querySelectorAll('input[type="text"]')[0] as HTMLElement, {
            target: { value: '*( *798y$' },
        });

        fireEvent.click(screen.getByText('Save Changes'));

        await waitFor(() =>
            expect(screen.getByTestId('error-warehouse-name')).toBeInTheDocument(),
        );
        expect(mockUpdateWarehouse).not.toHaveBeenCalled();
    });

    it('Given the short code emptied / When saved / Then the code is reported as required', async () => {
        await openEdit();
        const dialog = screen.getByRole('dialog', { name: 'Edit Warehouse' });
        fireEvent.change(dialog.querySelectorAll('input[type="text"]')[1] as HTMLElement, {
            target: { value: '' },
        });

        fireEvent.click(screen.getByText('Save Changes'));

        await waitFor(() =>
            expect(screen.getByTestId('error-warehouse-code')).toHaveTextContent(
                'Short Code is required.',
            ),
        );
    });

    it('Given valid values / When saved / Then the update is sent', async () => {
        await openEdit();
        fireEvent.click(screen.getByText('Save Changes'));
        await waitFor(() =>
            expect(mockUpdateWarehouse).toHaveBeenCalledWith(
                'wh-1',
                expect.objectContaining({ name: 'Dubai South Hub', code: 'DXB-01' }),
            ),
        );
    });
});
