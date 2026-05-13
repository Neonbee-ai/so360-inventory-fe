import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockCreateVendorInvoice = vi.fn();
const mockUploadDocument = vi.fn();
const mockGetOrgId = vi.fn();

vi.mock('../../services/procurementService', () => ({
  procurementService: {
    createVendorInvoice: (...args: any[]) => mockCreateVendorInvoice(...args),
  },
}));

vi.mock('../../services/mediaService', () => ({
  mediaService: {
    uploadDocument: (...args: any[]) => mockUploadDocument(...args),
  },
}));

vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getOrgId: () => mockGetOrgId(),
  },
}));

vi.mock('../common/Modal', () => ({
  Modal: ({ isOpen, title, children }: any) =>
    isOpen ? <div data-testid="modal"><h3>{title}</h3>{children}</div> : null,
}));

import { CreateInvoiceModal } from './CreateInvoiceModal';

const makeProps = (overrides: any = {}) => ({
  isOpen: true,
  onClose: vi.fn(),
  vendorId: 'vendor-1',
  vendorPOs: [
    { id: 'po-1', po_number: 'PO-2024-001', status: 'sent', total_amount: 1000 },
  ],
  onSuccess: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateVendorInvoice.mockResolvedValue({ id: 'inv-1' });
  mockUploadDocument.mockResolvedValue({ url: 'http://example.com/doc.pdf' });
  mockGetOrgId.mockReturnValue('org-1');
});

describe('CreateInvoiceModal', () => {
  describe('Given modal is closed', () => {
    it('When isOpen is false / Then modal not in DOM', () => {
      render(<CreateInvoiceModal {...makeProps({ isOpen: false })} />);
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  describe('Given modal is open', () => {
    it('When isOpen is true / Then shows Create Vendor Invoice title', () => {
      render(<CreateInvoiceModal {...makeProps()} />);
      expect(screen.getByText('Create Vendor Invoice')).toBeInTheDocument();
    });

    it('When rendered / Then shows Invoice Number input', () => {
      render(<CreateInvoiceModal {...makeProps()} />);
      expect(screen.getByPlaceholderText('e.g. INV-2026-001')).toBeInTheDocument();
    });

    it('When rendered / Then shows Total Amount input', () => {
      render(<CreateInvoiceModal {...makeProps()} />);
      expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
    });

    it('When rendered / Then shows PO selector with vendor POs', () => {
      render(<CreateInvoiceModal {...makeProps()} />);
      // PO renders as "PO-2024-001 — $1,000 (sent)"
      expect(screen.getByText(/PO-2024-001/)).toBeInTheDocument();
    });

    it('When rendered / Then shows file upload area', () => {
      render(<CreateInvoiceModal {...makeProps()} />);
      expect(screen.getByText(/PDF, PNG, JPG/i)).toBeInTheDocument();
    });
  });

  describe('Given form submission', () => {
    it('When valid form submitted / Then calls createVendorInvoice', async () => {
      render(<CreateInvoiceModal {...makeProps()} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. INV-2026-001'), {
        target: { value: 'INV-001' },
      });
      fireEvent.change(screen.getByPlaceholderText('0.00'), {
        target: { value: '500' },
      });
      fireEvent.click(screen.getByText('Create Invoice'));
      await waitFor(() => {
        expect(mockCreateVendorInvoice).toHaveBeenCalled();
      });
    });

    it('When invoice created successfully / Then calls onSuccess', async () => {
      const onSuccess = vi.fn();
      render(<CreateInvoiceModal {...makeProps({ onSuccess })} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. INV-2026-001'), {
        target: { value: 'INV-001' },
      });
      fireEvent.change(screen.getByPlaceholderText('0.00'), {
        target: { value: '500' },
      });
      fireEvent.click(screen.getByText('Create Invoice'));
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('When createVendorInvoice fails / Then shows error message', async () => {
      mockCreateVendorInvoice.mockRejectedValue(new Error('Server error'));
      render(<CreateInvoiceModal {...makeProps()} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. INV-2026-001'), {
        target: { value: 'INV-001' },
      });
      fireEvent.change(screen.getByPlaceholderText('0.00'), {
        target: { value: '500' },
      });
      fireEvent.click(screen.getByText('Create Invoice'));
      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });
  });

  describe('Given cancel', () => {
    it('When Cancel button clicked / Then calls onClose', () => {
      const onClose = vi.fn();
      render(<CreateInvoiceModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
