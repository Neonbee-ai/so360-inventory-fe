import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetSettings = vi.fn();
const mockCreateLead = vi.fn();

vi.mock('../../services/crmService', () => ({
  crmService: {
    getSettings: (...a: any[]) => mockGetSettings(...a),
    createLead: (...a: any[]) => mockCreateLead(...a),
  },
}));

import { CreateLeadModal } from './CreateLeadModal';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue({ lead_custom_fields: [] });
  mockCreateLead.mockResolvedValue({ id: 'lead-1' });
});

const open = (o: any = {}) => ({ isOpen: true, onClose: vi.fn(), onSuccess: vi.fn(), existingLeads: [], ...o });

describe('CreateLeadModal (Comb)', () => {
  it('Given the modal is open / When rendered / Then it is a titled dialog with Cancel and primary footer actions', async () => {
    render(<CreateLeadModal {...open()} />);
    expect(screen.getByRole('dialog', { name: 'Create New Lead' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Lead' })).toHaveAttribute('form', 'create-lead-form');
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalled());
  });

  it('Given the modal is closed / When rendered / Then no dialog is present', () => {
    render(<CreateLeadModal {...open({ isOpen: false })} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Given an existing company / When the same name is typed / Then a duplicate warning shows', () => {
    render(<CreateLeadModal {...open({ existingLeads: ['Acme Corp'] })} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'Acme Corp' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Potential duplicate detected');
  });

  it('Given a company name / When the form is submitted / Then the lead is created and the modal closes', async () => {
    const p = open();
    const { container } = render(<CreateLeadModal {...p} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'Globex' } });
    fireEvent.submit(container.querySelector('#create-lead-form')!);
    await waitFor(() => expect(mockCreateLead).toHaveBeenCalled());
    expect(mockCreateLead.mock.calls[0][0]).toMatchObject({ company_name: 'Globex' });
    await waitFor(() => expect(p.onSuccess).toHaveBeenCalled());
    expect(p.onClose).toHaveBeenCalled();
  });

  it('Given the API rejects / When submitted / Then an error alert is shown', async () => {
    mockCreateLead.mockRejectedValue(new Error('x'));
    const { container } = render(<CreateLeadModal {...open()} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'Globex' } });
    fireEvent.submit(container.querySelector('#create-lead-form')!);
    expect(await screen.findByText('Failed to create lead. Please try again.')).toBeInTheDocument();
  });
});
