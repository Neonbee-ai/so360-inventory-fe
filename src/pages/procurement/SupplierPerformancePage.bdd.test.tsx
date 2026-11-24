import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockPerf = vi.fn();
vi.mock('../../services/matchService', () => ({ matchService: { supplierPerformance: (...a: any[]) => mockPerf(...a) } }));

import SupplierPerformancePage from './SupplierPerformancePage';

const metric = (value: number | null, n: number, extra: any = {}) => ({ value, sample_size: n, provisional: n < 5, ...extra });
const row = (o: any = {}) => ({
    vendor_id: 'v1', vendor_name: 'Acme', segment_key: null, sample_size: 12, below_threshold: ['on_time_delivery'],
    metrics: {
        on_time_delivery: metric(75, 12, { excluded_buyer_caused: 2 }), accepted_in_full: metric(100, 12), qc_reject_rate: metric(1.5, 12), lead_time_days: metric(2, 12),
        ack_response_hours: metric(10, 3, { unacknowledged: 1 }), price_variance_pct: metric(null, 0), claim_closure_days: metric(null, 0, { open: 0 }),
    }, ...o,
});

beforeEach(() => {
    vi.clearAllMocks();
    mockPerf.mockResolvedValue({ formula_version: 'proc-v1', period_days: 90, segment: 'vendor', rows: [row()] });
});

describe('SupplierPerformancePage (Pulse 559f6d73)', () => {
    it('Given scored suppliers, Then the formula version, sample sizes and attention flags are visible', async () => {
        render(<SupplierPerformancePage />);
        expect(await screen.findByText('Acme')).toBeInTheDocument();
        expect(screen.getByText(/Formula proc-v1 - last 90 days/)).toBeInTheDocument();
        expect(screen.getByText('75%')).toBeInTheDocument();
        expect(screen.getByText('Late deliveries')).toBeInTheDocument();
        expect(screen.getAllByText(/n=12/).length).toBeGreaterThan(0);
    });
    it('Given a metric with few observations, Then it is marked as few', async () => {
        render(<SupplierPerformancePage />);
        await screen.findByText('Acme');
        expect(screen.getByText(/n=3 \(few\)/)).toBeInTheDocument();
    });
    it('Given buyer-caused delays, Then the count excluded from on-time is shown', async () => {
        render(<SupplierPerformancePage />);
        await screen.findByText('Acme');
        expect(screen.getByText('Excluded (our delay)')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
    });
    it('Given a supplier with nothing flagged, Then it shows on track', async () => {
        mockPerf.mockResolvedValue({ formula_version: 'proc-v1', period_days: 90, segment: 'vendor', rows: [row({ below_threshold: [] })] });
        render(<SupplierPerformancePage />);
        expect(await screen.findByText('On track')).toBeInTheDocument();
    });
    it('Given the default view, Then supplier / 90 days is requested', async () => {
        render(<SupplierPerformancePage />);
        await screen.findByText('Acme');
        expect(mockPerf).toHaveBeenCalledWith({ segment: 'vendor', period: '90d' });
    });
    it('Given no activity, Then the empty state shows', async () => {
        mockPerf.mockResolvedValue({ formula_version: 'proc-v1', period_days: 90, segment: 'vendor', rows: [] });
        render(<SupplierPerformancePage />);
        expect(await screen.findByText('No supplier activity in this period.')).toBeInTheDocument();
    });
    it('Given a failure, Then the error is shown', async () => {
        mockPerf.mockRejectedValue(new Error('boom'));
        render(<SupplierPerformancePage />);
        await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    });
});
