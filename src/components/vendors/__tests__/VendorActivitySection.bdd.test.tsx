import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/** BDD: Vendor activity history rail card (Pulse 652f492e). */

const mockActivity = vi.fn();
vi.mock('../../../services/vendorService', () => ({
    vendorService: { getActivity: (...a: any[]) => mockActivity(...a) },
}));
const mockCan = vi.hoisted(() => vi.fn((_p: string) => true));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ can: mockCan }) }));
const mockFlag = vi.hoisted(() => vi.fn((_k: string) => true));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => ({ isFeatureEnabled: mockFlag }) }));
vi.mock('../../../utils/formatters', () => ({ useInventoryFormatters: () => ({ formatDateTime: (d: string) => `DT:${d}` }) }));

import { VendorActivitySection } from '../VendorActivitySection';

const item = (o: any = {}) => ({
    id: 'log:1', at: '2026-11-20T10:00:00Z', source: 'vendor', action: 'updated', description: 'Vendor updated',
    actor_id: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc', actor_name: null, changed_fields: ['vendor_profile.credit_days'], ...o,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockImplementation(() => true);
    mockFlag.mockImplementation(() => true);
    mockActivity.mockResolvedValue({ data: [item()] });
});

describe('Given vendor activity', () => {
    it('When the flag is off / Then nothing renders or loads', () => {
        mockFlag.mockReturnValue(false);
        const { container } = render(<VendorActivitySection vendorId="v1" />);
        expect(container).toBeEmptyDOMElement();
        expect(mockActivity).not.toHaveBeenCalled();
    });
    it('When the user cannot read suppliers / Then nothing renders', () => {
        mockCan.mockReturnValue(false);
        const { container } = render(<VendorActivitySection vendorId="v1" />);
        expect(container).toBeEmptyDOMElement();
    });
    it('When loaded / Then label, changed fields, actor and time show', async () => {
        render(<VendorActivitySection vendorId="v1" />);
        expect(await screen.findByText('Vendor updated')).toBeInTheDocument();
        expect(screen.getByText('Changed: credit days')).toBeInTheDocument();
        expect(screen.getByText('User 4a1832f4')).toBeInTheDocument();
        expect(screen.getByText('DT:2026-11-20T10:00:00Z')).toBeInTheDocument();
        expect(mockActivity).toHaveBeenCalledWith('v1', 20);
    });
    it('When an entry has a named actor, no fields and no time / Then the name and a dash show', async () => {
        mockActivity.mockResolvedValue({ data: [item({ actor_name: 'Asha', changed_fields: [], at: null, action: 'bank_verified' })] });
        render(<VendorActivitySection vendorId="v1" />);
        expect(await screen.findByText('Bank account verified')).toBeInTheDocument();
        expect(screen.getByText('Asha')).toBeInTheDocument();
        expect(screen.getByText('—')).toBeInTheDocument();
        expect(screen.queryByText(/Changed:/)).toBeNull();
    });
    it('When an entry has no actor / Then System', async () => {
        mockActivity.mockResolvedValue({ data: [item({ actor_id: null })] });
        render(<VendorActivitySection vendorId="v1" />);
        expect(await screen.findByText('System')).toBeInTheDocument();
    });
    it('When the response has no data / Then the empty state shows', async () => {
        mockActivity.mockResolvedValue({});
        render(<VendorActivitySection vendorId="v1" />);
        expect(await screen.findByText('No activity yet')).toBeInTheDocument();
        expect(screen.queryByTestId('activity-more')).toBeNull();
    });
    it('When a full page came back / Then Show more asks for a bigger page', async () => {
        mockActivity.mockResolvedValue({ data: Array.from({ length: 20 }, (_, i) => item({ id: `log:${i}` })) });
        render(<VendorActivitySection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('activity-more'));
        await waitFor(() => expect(mockActivity).toHaveBeenLastCalledWith('v1', 60));
    });
    it('When loading fails / Then the error and a Retry show', async () => {
        mockActivity.mockRejectedValueOnce(new Error('Down')).mockResolvedValue({ data: [] });
        render(<VendorActivitySection vendorId="v1" />);
        expect(await screen.findByText('Down')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Retry'));
        await waitFor(() => expect(mockActivity).toHaveBeenCalledTimes(2));
    });
    it('When loading fails without a message / Then a fallback shows', async () => {
        mockActivity.mockRejectedValue({});
        render(<VendorActivitySection vendorId="v1" />);
        expect(await screen.findByText('Could not load activity.')).toBeInTheDocument();
    });
});
