import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const scorecard = vi.fn();
const riskSignals = vi.fn();
const widget = vi.fn();
const definitions = vi.fn();
vi.mock('../../../services/vendorScorecardService', () => ({
  vendorScorecardService: {
    scorecard: (...a: any[]) => scorecard(...a), riskSignals: (...a: any[]) => riskSignals(...a), widget: (...a: any[]) => widget(...a),
    definitions: (...a: any[]) => definitions(...a), setRiskSignalStatus: vi.fn(), activateDefinition: vi.fn(), createDefinition: vi.fn(),
  },
}));

import VendorPerformancePanel from './VendorPerformancePanel';
import VendorGovernancePage, { widgetItems } from './VendorGovernancePage';
import ScorecardDefinitionsPage from './ScorecardDefinitionsPage';
import { weightsTotal } from './scorecardLabels';

beforeEach(() => { vi.clearAllMocks(); riskSignals.mockResolvedValue([]); });

describe('VendorPerformancePanel (Pulse f0dace0a)', () => {
  it('Given a sufficient and an insufficient dimension, Then the score shows and the other says not enough data, with the formula version', async () => {
    scorecard.mockResolvedValue({ source: 'definition', results: [{ definition_id: 'd', formula_version: 3, period_start: '2026-09-01', period_end: '2026-11-24', overall: 92, standing: 'preferred', sample_size: 12,
      dimension_scores: { delivery_reliability: { value: 92, sample: 12, status: 'ok' }, quality_acceptance: { value: null, sample: 2, status: 'insufficient' } }, adjustments: [{ dimension: 'delivery_reliability', delta: 5, reason: 'port closure' }] }] });
    render(<VendorPerformancePanel vendorId="v1" />);
    await waitFor(() => expect(screen.getByText('Preferred')).toBeTruthy());
    expect(screen.getByText('Not enough data')).toBeTruthy();
    expect(screen.getByText(/formula v3/)).toBeTruthy();
    expect(screen.getByText(/port closure/)).toBeTruthy();
  });
  it('Given the default preset, Then the user is told no own definition is active', async () => {
    scorecard.mockResolvedValue({ source: 'preset', results: [{ definition_id: null, formula_version: 0, period_start: 'a', period_end: 'b', overall: null, standing: 'provisional', sample_size: 1, dimension_scores: {} }] });
    render(<VendorPerformancePanel vendorId="v1" />);
    await waitFor(() => expect(screen.getByText(/default scorecard/)).toBeTruthy());
    expect(screen.getByText('Provisional')).toBeTruthy();
  });
  it('Given the API fails, Then an error shows', async () => {
    scorecard.mockRejectedValue(new Error('x'));
    render(<VendorPerformancePanel vendorId="v1" />);
    await waitFor(() => expect(screen.getByText('Could not load the scorecard.')).toBeTruthy());
  });
});

describe('VendorGovernancePage', () => {
  it('Given widgets and an open signal, Then each widget shows its refresh time and the signal is listed', async () => {
    widget.mockResolvedValue({ value: { approved_active: 2 }, last_refreshed_at: '2026-11-24T10:00:00Z' });
    riskSignals.mockResolvedValue([{ id: 's1', vendor_id: 'abcdef123456', kind: 'severe_event', recommended_action: 'under_review', lifecycle_request_id: 'i1' }]);
    render(<VendorGovernancePage />);
    await waitFor(() => expect(screen.getByTestId('refreshed-state_counts')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Severe event')).toBeTruthy());
    expect(screen.getByText('Requested')).toBeTruthy();
  });
  it('Given the scenario, When it runs, Then widgetItems flattens one level of nesting', () => {
    expect(widgetItems({ a: 1, b: { c: 2 } })).toEqual([{ label: 'a', value: '1' }, { label: 'b: c', value: '2' }]);
  });
});

describe('ScorecardDefinitionsPage', () => {
  it('Given no definitions, Then the empty state explains the default', async () => {
    definitions.mockResolvedValue([]);
    render(<ScorecardDefinitionsPage />);
    await waitFor(() => expect(screen.getByText('No scorecard defined')).toBeTruthy());
  });
  it('Given the scenario, When it runs, Then weightsTotal sums and the activation rule needs 100', () => {
    expect(weightsTotal([{ weight: 40 }, { weight: '60' }])).toBe(100);
    expect(weightsTotal([{ weight: 50 }, { weight: 40 }])).toBe(90);
  });
});
