import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const checkEligibility = vi.fn();
const getIntegrationHealth = vi.fn();
const replayIntegration = vi.fn();
const getEligibilityPolicy = vi.fn();
const saveEligibilityPolicy = vi.fn();

vi.mock('../../../services/vendorService', () => ({
  vendorService: {
    checkEligibility: (...a: any[]) => checkEligibility(...a),
    getIntegrationHealth: (...a: any[]) => getIntegrationHealth(...a),
    replayIntegration: (...a: any[]) => replayIntegration(...a),
    getEligibilityPolicy: (...a: any[]) => getEligibilityPolicy(...a),
    saveEligibilityPolicy: (...a: any[]) => saveEligibilityPolicy(...a),
  },
}));

import VendorEligibilityPanel from './VendorEligibilityPanel';
import IntegrationHealthTab from './IntegrationHealthTab';
import EligibilityPolicyTab from './EligibilityPolicyTab';

beforeEach(() => vi.clearAllMocks());

describe('VendorEligibilityPanel', () => {
  it('Given a check / When run / Then the decision, explanation and reason codes show', async () => {
    checkEligibility.mockResolvedValue({ decision: 'ineligible', explanation: 'The vendor has no approved qualification for this scope.', reason_codes: ['NO_QUALIFICATION_FOR_SCOPE'] });
    render(<VendorEligibilityPanel vendorId="v1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(screen.getByTestId('eligibility-result')).toHaveTextContent('NO_QUALIFICATION_FOR_SCOPE'));
    expect(checkEligibility).toHaveBeenCalledWith(expect.objectContaining({ vendor_id: 'v1', module: 'procurement', action: 'po.create' }));
  });
});

describe('IntegrationHealthTab', () => {
  it('Given a consumer with dead events / When Replay dead is clicked / Then replay is requested for that consumer', async () => {
    getIntegrationHealth.mockResolvedValue({ parked_outbox: 0, consumers: [{ consumer: 'manufacturing-be', last_seq: 90, lag: 10, failed: 0, dead: 2 }] });
    replayIntegration.mockResolvedValue({ reset: 2 });
    render(<IntegrationHealthTab canReplay />);
    fireEvent.click(await screen.findByRole('button', { name: 'Replay dead' }));
    await waitFor(() => expect(replayIntegration).toHaveBeenCalledWith({ consumer: 'manufacturing-be', status: 'dead' }));
  });
  it('Given no replay permission / When rendered / Then there is no Replay button', async () => {
    getIntegrationHealth.mockResolvedValue({ parked_outbox: 0, consumers: [{ consumer: 'x', last_seq: 1, lag: 0, failed: 0, dead: 1 }] });
    render(<IntegrationHealthTab canReplay={false} />);
    await waitFor(() => expect(screen.getByText('x')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Replay dead' })).toBeNull();
  });
  it('Given parked outbox rows / When rendered / Then a warning is shown', async () => {
    getIntegrationHealth.mockResolvedValue({ parked_outbox: 3, consumers: [] });
    render(<IntegrationHealthTab canReplay />);
    await waitFor(() => expect(screen.getByText(/3 vendor event/)).toBeInTheDocument());
  });
});

describe('EligibilityPolicyTab', () => {
  it('Given a saved policy / When Save is clicked / Then the chosen mode and mandatory types are sent', async () => {
    getEligibilityPolicy.mockResolvedValue({ enforcement_mode: 'warn', doc_warn_days: 30, mandatory_document_types: ['gst_certificate'] });
    saveEligibilityPolicy.mockResolvedValue({});
    render(<EligibilityPolicyTab canEdit />);
    await waitFor(() => expect(getEligibilityPolicy).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saveEligibilityPolicy).toHaveBeenCalledWith({ enforcement_mode: 'warn', doc_warn_days: 30, mandatory_document_types: ['gst_certificate'] }));
  });
});
