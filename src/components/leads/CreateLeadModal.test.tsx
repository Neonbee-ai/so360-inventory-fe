import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../common/Modal', () => ({
  Modal: ({ isOpen, title, children }: any) =>
    isOpen ? <div data-testid="modal"><h3>{title}</h3>{children}</div> : null,
}));

const mockGetSettings = vi.fn();
const mockCreateLead = vi.fn();

vi.mock('../../services/crmService', () => ({
  crmService: {
    getSettings: (...args: any[]) => mockGetSettings(...args),
    createLead: (...args: any[]) => mockCreateLead(...args),
  },
}));

import { CreateLeadModal } from './CreateLeadModal';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue({ lead_custom_fields: [] });
  mockCreateLead.mockResolvedValue({ id: 'lead-1' });
});

describe('CreateLeadModal', () => {
  describe('Given modal is closed', () => {
    it('When isOpen is false / Then modal is not in DOM', () => {
      render(<CreateLeadModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  describe('Given initial render', () => {
    it('When isOpen is true / Then shows Create New Lead title', () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      expect(screen.getByText('Create New Lead')).toBeInTheDocument();
    });

    it('When isOpen is true / Then shows Company Name input', () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      expect(screen.getByPlaceholderText('e.g. Acme Corp')).toBeInTheDocument();
    });

    it('When isOpen is true / Then shows Lead Source dropdown', () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      expect(screen.getByText('Website')).toBeInTheDocument();
    });

    it('When isOpen is true / Then calls getSettings on mount', async () => {
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => {
        expect(mockGetSettings).toHaveBeenCalled();
      });
    });
  });

  describe('Given duplicate detection', () => {
    it('When company name matches existing lead / Then shows duplicate warning', () => {
      render(
        <CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={['Acme Corp']} />
      );
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), {
        target: { value: 'Acme Corp' },
      });
      expect(screen.getByText(/Potential duplicate detected/i)).toBeInTheDocument();
    });

    it('When company name does not match / Then no duplicate warning', () => {
      render(
        <CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={['Acme Corp']} />
      );
      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), {
        target: { value: 'New Company' },
      });
      expect(screen.queryByText(/Potential duplicate detected/i)).not.toBeInTheDocument();
    });
  });

  describe('Given form submission', () => {
    it('When form submitted successfully / Then calls onSuccess and onClose', async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();
      render(<CreateLeadModal isOpen={true} onClose={onClose} onSuccess={onSuccess} existingLeads={[]} />);

      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'Test Corp' } });
      // Contact Name and Email inputs (required fields)
      const inputs = screen.getAllByRole('textbox');
      // inputs[0] = company name (already filled), inputs[1] = contact name, inputs[2] = contact email
      fireEvent.change(inputs[1], { target: { value: 'John Doe' } });
      fireEvent.change(inputs[2], { target: { value: 'john@test.com' } });

      fireEvent.click(screen.getByText('Create Lead'));
      await waitFor(() => {
        expect(mockCreateLead).toHaveBeenCalledWith(expect.objectContaining({
          company_name: 'Test Corp',
          contact_name: 'John Doe',
          contact_email: 'john@test.com',
        }));
      });
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('When createLead fails / Then button re-enables after error', async () => {
      mockCreateLead.mockRejectedValue(new Error('Server error'));
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);

      fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), { target: { value: 'Test Corp' } });
      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[1], { target: { value: 'John Doe' } });
      fireEvent.change(inputs[2], { target: { value: 'john@test.com' } });

      const form = screen.getByTestId('modal').querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        // After failed submission, the submit button should re-enable (isSubmitting=false)
        expect(screen.getByText('Create Lead')).toBeInTheDocument();
      });
      expect(mockCreateLead).toHaveBeenCalled();
    });
  });

  describe('Given cancel', () => {
    it('When Cancel clicked / Then calls onClose', () => {
      const onClose = vi.fn();
      render(<CreateLeadModal isOpen={true} onClose={onClose} onSuccess={vi.fn()} existingLeads={[]} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Given custom fields', () => {
    it('When custom fields returned / Then shows additional details section', async () => {
      mockGetSettings.mockResolvedValue({
        lead_custom_fields: [
          { id: 'cf-1', label: 'Industry', type: 'text', required: false },
        ],
      });
      render(<CreateLeadModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} existingLeads={[]} />);
      await waitFor(() => {
        expect(screen.getByText('Additional Details')).toBeInTheDocument();
        expect(screen.getByText('Industry')).toBeInTheDocument();
      });
    });
  });
});
