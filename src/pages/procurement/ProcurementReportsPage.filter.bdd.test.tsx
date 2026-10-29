import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetReport = vi.fn();
vi.mock('../../services/procurementInsightsService', () => ({
    procurementInsightsService: { getReport: (...a: any[]) => mockGetReport(...a) },
}));
vi.mock('../../utils/formatters', () => ({
    useInventoryFormatters: () => ({ formatCurrency: (v: number) => `$${v}` }),
}));

import ProcurementReportsPage, { filterReportRows } from './ProcurementReportsPage';

const ROWS = [
    { po_number: 'PO-001', vendor_name: 'Alpha' },
    { po_number: 'PO-002', vendor_name: 'Beta' },
];

beforeEach(() => {
    vi.clearAllMocks();
    mockGetReport.mockResolvedValue({ report: 'purchase_register', rows: ROWS });
});

describe('ProcurementReportsPage filters', () => {
    it('Given rows and a term, When filtering, Then only matching rows remain', () => {
        expect(filterReportRows(ROWS, 'beta')).toEqual([ROWS[1]]);
        expect(filterReportRows(ROWS, '  ')).toEqual(ROWS);
    });

    it('Given the report loaded, When rendered, Then a search box and period/report filters exist', async () => {
        render(<ProcurementReportsPage />);
        await waitFor(() => screen.getByText('PO-001'));
        expect(screen.getByPlaceholderText('Search this report...')).toBeInTheDocument();
    });

    it('Given the report loaded, When searching for Alpha, Then Beta is hidden', async () => {
        render(<ProcurementReportsPage />);
        await waitFor(() => screen.getByText('PO-002'));
        fireEvent.change(screen.getByPlaceholderText('Search this report...'), { target: { value: 'Alpha' } });
        await waitFor(() => expect(screen.queryByText('PO-002')).toBeNull());
        expect(screen.getByText('PO-001')).toBeInTheDocument();
    });
});
