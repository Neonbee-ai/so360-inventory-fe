import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const getEvidence = vi.fn();
const reviewDocument = vi.fn();
const replaceDocument = vi.fn();
const getDocumentDownload = vi.fn();
const listRenewalTasks = vi.fn();
const updateRenewalTask = vi.fn();
const listComplianceNotifications = vi.fn();
const retryComplianceNotification = vi.fn();
const listEvidenceTemplates = vi.fn();
const createEvidenceTemplate = vi.fn();
const evidenceTemplateAction = vi.fn();

vi.mock('../../../services/vendorService', () => ({
  vendorService: {
    getEvidence: (...a: any[]) => getEvidence(...a),
    reviewDocument: (...a: any[]) => reviewDocument(...a),
    replaceDocument: (...a: any[]) => replaceDocument(...a),
    getDocumentDownload: (...a: any[]) => getDocumentDownload(...a),
    listRenewalTasks: (...a: any[]) => listRenewalTasks(...a),
    updateRenewalTask: (...a: any[]) => updateRenewalTask(...a),
    listComplianceNotifications: (...a: any[]) => listComplianceNotifications(...a),
    retryComplianceNotification: (...a: any[]) => retryComplianceNotification(...a),
    listEvidenceTemplates: (...a: any[]) => listEvidenceTemplates(...a),
    createEvidenceTemplate: (...a: any[]) => createEvidenceTemplate(...a),
    evidenceTemplateAction: (...a: any[]) => evidenceTemplateAction(...a),
  },
}));

import VendorEvidencePanel from './VendorEvidencePanel';
import ComplianceQueuePage from './ComplianceQueuePage';
import EvidenceTemplatesTab from './EvidenceTemplatesTab';

const v = (o: any = {}) => ({ id: 'd1', version: 1, review_state: 'verified', expiry_date: '2027-06-01', confidentiality: 'internal', upload_state: 'stored', ...o });
const chain = (versions: any[], effective: any = null) => ({ evidence_id: 'ev1', document_type: 'iso_certificate', latest: versions[0], effective, versions });

beforeEach(() => vi.clearAllMocks());

describe('VendorEvidencePanel', () => {
  it('Given a verified v1 and a pending v2 / When opened / Then both versions and what is in force show', async () => {
    const v1 = v(); const v2 = v({ id: 'd2', version: 2, review_state: 'submitted' });
    getEvidence.mockResolvedValue({ data: [chain([v2, v1], v1)] });
    render(<VendorEvidencePanel vendorId="v" canUpdate canReview />);
    await waitFor(() => screen.getByText('Iso certificate'));
    expect(screen.getByText('v2')).toBeTruthy();
    expect(screen.getByText('v1')).toBeTruthy(); // in force
    fireEvent.click(screen.getByText('Iso certificate'));
    await waitFor(() => screen.getByTestId('evidence-history'));
    expect(screen.getByText('Version 1')).toBeTruthy();
    expect(screen.getByText('Version 2')).toBeTruthy();
  });

  it('Given a reviewer and a pending latest version / When Review is saved / Then the API gets the decision and note', async () => {
    getEvidence.mockResolvedValue({ data: [chain([v({ review_state: 'submitted' })])] });
    reviewDocument.mockResolvedValue({});
    render(<VendorEvidencePanel vendorId="v" canUpdate canReview />);
    await waitFor(() => screen.getByText('Iso certificate'));
    fireEvent.click(screen.getByText('Iso certificate'));
    fireEvent.click(await screen.findByText('Review'));
    fireEvent.click(await screen.findByText('Save decision'));
    await waitFor(() => expect(reviewDocument).toHaveBeenCalledWith('d1', expect.objectContaining({ decision: 'verified' })));
  });

  it('Given no review permission / When opened / Then there is no Review button', async () => {
    getEvidence.mockResolvedValue({ data: [chain([v({ review_state: 'submitted' })])] });
    render(<VendorEvidencePanel vendorId="v" canUpdate canReview={false} />);
    await waitFor(() => screen.getByText('Iso certificate'));
    fireEvent.click(screen.getByText('Iso certificate'));
    await screen.findByText('Replace');
    expect(screen.queryByText('Review')).toBeNull();
  });

  it('Given a confidential redacted row / When opened / Then it explains and offers no download', async () => {
    getEvidence.mockResolvedValue({ data: [chain([{ id: 'd1', version: 1, review_state: 'verified', confidentiality: 'confidential', redacted: true }])] });
    render(<VendorEvidencePanel vendorId="v" canUpdate={false} canReview={false} />);
    await waitFor(() => screen.getByText('Iso certificate'));
    fireEvent.click(screen.getByText('Iso certificate'));
    await screen.findByText(/Details are confidential/);
    expect(screen.queryByText('Download')).toBeNull();
  });

  it('Given a version whose upload failed / When opened / Then a warning asks to send the file again', async () => {
    getEvidence.mockResolvedValue({ data: [chain([v({ upload_state: 'failed', review_state: 'submitted' })])] });
    render(<VendorEvidencePanel vendorId="v" canUpdate canReview={false} />);
    await waitFor(() => screen.getByText('Iso certificate'));
    fireEvent.click(screen.getByText('Iso certificate'));
    await screen.findByText(/file was not stored/);
  });

  it('Given no documents / When loaded / Then the empty state shows', async () => {
    getEvidence.mockResolvedValue({ data: [] });
    render(<VendorEvidencePanel vendorId="v" canUpdate canReview />);
    await waitFor(() => screen.getByText('No documents yet'));
  });

  it('Given the API fails / When loaded / Then an error shows', async () => {
    getEvidence.mockRejectedValue(new Error('x'));
    render(<VendorEvidencePanel vendorId="v" canUpdate canReview />);
    await waitFor(() => screen.getByText('Could not load documents and compliance.'));
  });
});

describe('ComplianceQueuePage', () => {
  it('Given an open renewal / When Mark done / Then the task is closed and the list reloads', async () => {
    listRenewalTasks.mockResolvedValue({ data: [{ id: 't1', vendor_id: 'v', document_type: 'insurance', due_date: '2026-12-24', status: 'open', owner_role: 'compliance_owner' }] });
    updateRenewalTask.mockResolvedValue({});
    render(<ComplianceQueuePage />);
    await waitFor(() => screen.getByText('Insurance'));
    fireEvent.click(screen.getByText('Mark done'));
    await waitFor(() => expect(updateRenewalTask).toHaveBeenCalledWith('t1', { status: 'done' }));
    expect(listRenewalTasks.mock.calls.length).toBeGreaterThan(1);
  });

  it('Given nothing open / When loaded / Then the empty state shows', async () => {
    listRenewalTasks.mockResolvedValue({ data: [] });
    render(<ComplianceQueuePage />);
    await waitFor(() => screen.getByText('Nothing to do'));
  });
});

describe('EvidenceTemplatesTab', () => {
  const t = { id: 't1', code: 'INS', name: 'Insurance', document_type: 'insurance', country: 'IN', vendor_type: null, risk_tier: null, global_mandatory: true, mandatory: true, confidentiality: 'internal', status: 'draft', version: 1, warn_horizons_days: [60, 30, 7] };

  it('Given a draft template / When Activate / Then the API activates it', async () => {
    listEvidenceTemplates.mockResolvedValue({ data: [t] });
    evidenceTemplateAction.mockResolvedValue({});
    render(<EvidenceTemplatesTab canEdit />);
    await waitFor(() => screen.getByText('Insurance (INS)'));
    fireEvent.click(screen.getByText('Activate'));
    await waitFor(() => expect(evidenceTemplateAction).toHaveBeenCalledWith('t1', 'activate'));
  });

  it('Given an active template / When viewed / Then it offers a new version, not Edit', async () => {
    listEvidenceTemplates.mockResolvedValue({ data: [{ ...t, status: 'active' }] });
    render(<EvidenceTemplatesTab canEdit />);
    await waitFor(() => screen.getByText('New version'));
    expect(screen.queryByText('Edit')).toBeNull();
  });

  it('Given no edit rights / When viewed / Then no actions show', async () => {
    listEvidenceTemplates.mockResolvedValue({ data: [t] });
    render(<EvidenceTemplatesTab canEdit={false} />);
    await waitFor(() => screen.getByText('Insurance (INS)'));
    expect(screen.queryByText('Activate')).toBeNull();
    expect(screen.queryByText('New template')).toBeNull();
  });

  it('Given the new-template form / When saved with a code / Then create is called with parsed horizons', async () => {
    listEvidenceTemplates.mockResolvedValue({ data: [] });
    createEvidenceTemplate.mockResolvedValue({});
    render(<EvidenceTemplatesTab canEdit />);
    await waitFor(() => screen.getByText('No templates yet'));
    fireEvent.click(screen.getByText('New template'));
    fireEvent.change(await screen.findByLabelText('Code'), { target: { value: 'INS' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Insurance' } });
    fireEvent.change(screen.getByLabelText('Document type'), { target: { value: 'insurance' } });
    fireEvent.click(screen.getByText('Save draft'));
    await waitFor(() => expect(createEvidenceTemplate).toHaveBeenCalledWith(expect.objectContaining({ code: 'INS', document_type: 'insurance', warn_horizons_days: [60, 30, 7] })));
  });
});
