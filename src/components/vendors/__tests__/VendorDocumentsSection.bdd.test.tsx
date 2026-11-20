import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/** BDD: Compliance documents card on the vendor profile (Pulse 3fc12200). */

const mockList = vi.fn();
const mockUpload = vi.fn();
const mockVerify = vi.fn();
const mockArchive = vi.fn();
vi.mock('../../../services/vendorService', () => ({
    vendorService: {
        listDocuments: (...a: any[]) => mockList(...a),
        uploadDocument: (...a: any[]) => mockUpload(...a),
        verifyDocument: (...a: any[]) => mockVerify(...a),
        archiveDocument: (...a: any[]) => mockArchive(...a),
    },
}));
const mockCan = vi.hoisted(() => vi.fn((_p: string) => true));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ can: mockCan }) }));
const mockFlag = vi.hoisted(() => vi.fn((_k: string) => true));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => ({ isFeatureEnabled: mockFlag }) }));
vi.mock('../../../utils/formatters', () => ({ useInventoryFormatters: () => ({ formatDate: (d: string) => `D:${d}` }) }));

import { VendorDocumentsSection } from '../VendorDocumentsSection';

const doc = (o: any = {}) => ({
    id: 'd1', document_type: 'gst_certificate', document_number: '32ABCDE1234F1Z5', file_name: 'gst.pdf',
    expiry_date: '2026-12-01', expiry_state: 'expiring_soon', days_to_expiry: 11,
    verification_status: 'pending', rejection_reason: null, ...o,
});
const listed = (rows: any[], summary = { expired: 0, expiring_soon: 0 }) => mockList.mockResolvedValue({ data: rows, summary });
const field = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement;
const pickFile = (name = 'pan.pdf', size = 100) => {
    const f = new File(['x'], name, { type: 'application/pdf' });
    Object.defineProperty(f, 'size', { value: size });
    fireEvent.change(screen.getByTestId('doc-file'), { target: { files: [f] } });
    return f;
};

beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockImplementation(() => true);
    mockFlag.mockImplementation(() => true);
    listed([doc()]);
});

describe('Given the flag or permission is missing', () => {
    it('When the flag is off / Then nothing renders and nothing loads', () => {
        mockFlag.mockReturnValue(false);
        const { container } = render(<VendorDocumentsSection vendorId="v1" />);
        expect(container).toBeEmptyDOMElement();
        expect(mockList).not.toHaveBeenCalled();
    });
    it('When the user cannot read suppliers / Then nothing renders', () => {
        mockCan.mockImplementation((p: string) => p !== 'suppliers.read');
        const { container } = render(<VendorDocumentsSection vendorId="v1" />);
        expect(container).toBeEmptyDOMElement();
    });
    it('When the flag check throws / Then the card stays hidden', () => {
        mockFlag.mockImplementation(() => { throw new Error('x'); });
        const { container } = render(<VendorDocumentsSection vendorId="v1" />);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('Given documents are listed', () => {
    it('When loaded / Then type, number, expiry and review state show', async () => {
        render(<VendorDocumentsSection vendorId="v1" />);
        expect(await screen.findByText('GST certificate')).toBeInTheDocument();
        expect(screen.getByText('32ABCDE1234F1Z5')).toBeInTheDocument();
        expect(screen.getByText('D:2026-12-01')).toBeInTheDocument();
        expect(screen.getByTestId('doc-expiry-d1')).toHaveTextContent('Expires in 11 days');
        expect(screen.getByTestId('doc-review-d1')).toHaveTextContent('Pending review');
        expect(mockList).toHaveBeenCalledWith('v1');
    });
    it('When a document has no number or dates / Then the file name and dashes show', async () => {
        listed([doc({ document_number: null, expiry_date: null, expiry_state: 'no_expiry' })]);
        render(<VendorDocumentsSection vendorId="v1" />);
        expect(await screen.findByText('gst.pdf')).toBeInTheDocument();
        expect(screen.getByTestId('doc-expiry-d1')).toHaveTextContent('No expiry');
    });
    it('When it has neither number nor file name / Then a dash', async () => {
        listed([doc({ document_number: null, file_name: null })]);
        render(<VendorDocumentsSection vendorId="v1" />);
        await screen.findByText('GST certificate');
        expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });
    it('When some are expired or expiring / Then a warning summarises them', async () => {
        listed([doc()], { expired: 1, expiring_soon: 2 });
        render(<VendorDocumentsSection vendorId="v1" />);
        expect(await screen.findByTestId('doc-expiry-alert')).toHaveTextContent('1 expired and 2 expiring within 30 days');
    });
    it('When a rejected document has a reason / Then the reason shows and Reject is not offered', async () => {
        listed([doc({ verification_status: 'rejected', rejection_reason: 'Blurry copy' })]);
        render(<VendorDocumentsSection vendorId="v1" />);
        expect(await screen.findByText('Blurry copy')).toBeInTheDocument();
        expect(screen.queryByTestId('doc-reject-d1')).toBeNull();
    });
    it('When verified / Then Verify is not offered', async () => {
        listed([doc({ verification_status: 'verified', expiry_state: 'valid' })]);
        render(<VendorDocumentsSection vendorId="v1" />);
        expect(await screen.findByTestId('doc-review-d1')).toHaveTextContent('Verified');
        expect(screen.queryByTestId('doc-verify-d1')).toBeNull();
    });
    it('When the API returns no data array or summary / Then the empty state shows', async () => {
        mockList.mockResolvedValue({});
        render(<VendorDocumentsSection vendorId="v1" />);
        expect(await screen.findByText('No documents yet')).toBeInTheDocument();
    });
    it('When loading fails / Then the error shows', async () => {
        mockList.mockRejectedValue(new Error('Nope'));
        render(<VendorDocumentsSection vendorId="v1" />);
        expect(await screen.findByText('Nope')).toBeInTheDocument();
    });
    it('When loading fails without a message / Then a fallback shows', async () => {
        mockList.mockRejectedValue({});
        render(<VendorDocumentsSection vendorId="v1" />);
        expect(await screen.findByText('Could not load documents.')).toBeInTheDocument();
    });
    it('When the user can only read / Then no add or row actions show', async () => {
        mockCan.mockImplementation((p: string) => p === 'suppliers.read');
        render(<VendorDocumentsSection vendorId="v1" />);
        await screen.findByText('GST certificate');
        expect(screen.queryByTestId('doc-add')).toBeNull();
        expect(screen.queryByTestId('doc-verify-d1')).toBeNull();
    });
});

describe('Given a document is added', () => {
    it('When saved empty / Then type and file errors show and nothing uploads', async () => {
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('doc-add'));
        fireEvent.click(screen.getByTestId('doc-save'));
        expect(await screen.findByText('Choose the document type.')).toBeInTheDocument();
        expect(screen.getByText('Choose a file to upload.')).toBeInTheDocument();
        expect(mockUpload).not.toHaveBeenCalled();
    });
    it('When valid / Then it uploads with the metadata, closes and reloads', async () => {
        mockUpload.mockResolvedValue({ id: 'd2' });
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('doc-add'));
        fireEvent.change(field('document_type'), { target: { value: 'pan_card' } });
        fireEvent.change(field('document_number'), { target: { value: 'ABCDE1234F' } });
        fireEvent.change(field('issue_date'), { target: { value: '2026-01-01' } });
        fireEvent.change(field('expiry_date'), { target: { value: '2030-01-01' } });
        fireEvent.change(field('notes'), { target: { value: 'Self-attested' } });
        const f = pickFile();
        expect(screen.getByTestId('doc-file-name')).toHaveTextContent('pan.pdf');
        fireEvent.click(screen.getByTestId('doc-save'));
        await waitFor(() => expect(mockUpload).toHaveBeenCalledWith('v1', f, {
            document_type: 'pan_card', document_number: 'ABCDE1234F', issue_date: '2026-01-01', expiry_date: '2030-01-01', notes: 'Self-attested',
        }));
        expect(await screen.findByText('Document added. It is pending review.')).toBeInTheDocument();
        expect(mockList).toHaveBeenCalledTimes(2);
        expect(screen.queryByTestId('drawer-vendor-document')).toBeNull();
    });
    it('When the empty-state action is used / Then the drawer opens', async () => {
        listed([]);
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('empty-state-action'));
        expect(screen.getByTestId('drawer-vendor-document')).toBeInTheDocument();
    });
    it('When the upload fails / Then the drawer shows the error and stays open', async () => {
        mockUpload.mockRejectedValue(new Error('Storage quota exceeded'));
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('doc-add'));
        fireEvent.change(field('document_type'), { target: { value: 'other' } });
        pickFile();
        fireEvent.click(screen.getByTestId('doc-save'));
        expect(await screen.findByText('Storage quota exceeded')).toBeInTheDocument();
        expect(screen.getByTestId('drawer-vendor-document')).toBeInTheDocument();
    });
    it('When the upload fails without a message / Then a fallback shows', async () => {
        mockUpload.mockRejectedValue({});
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('doc-add'));
        fireEvent.change(field('document_type'), { target: { value: 'other' } });
        pickFile();
        fireEvent.click(screen.getByTestId('doc-save'));
        expect(await screen.findByText('Could not upload the document.')).toBeInTheDocument();
    });
    it('When cancelled / Then the drawer closes', async () => {
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('doc-add'));
        fireEvent.click(screen.getByText('Cancel'));
        expect(screen.queryByTestId('drawer-vendor-document')).toBeNull();
    });
    it('When the picker returns a file then the label says Change file', async () => {
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('doc-add'));
        expect(screen.getByText('Choose file')).toBeInTheDocument();
        pickFile();
        expect(screen.getByText('Change file')).toBeInTheDocument();
    });
});

describe('Given a review decision', () => {
    it('When verified after confirming / Then the API is called and the list reloads', async () => {
        mockVerify.mockResolvedValue({});
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('doc-verify-d1'));
        fireEvent.click(screen.getByText('Mark verified'));
        await waitFor(() => expect(mockVerify).toHaveBeenCalledWith('v1', 'd1', 'verified'));
        expect(await screen.findByText('Document marked as verified.')).toBeInTheDocument();
    });
    it('When the confirmation is cancelled / Then nothing is called', async () => {
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('doc-verify-d1'));
        fireEvent.click(screen.getByText('Cancel'));
        expect(mockVerify).not.toHaveBeenCalled();
    });
    it('When removed after confirming / Then it is archived', async () => {
        mockArchive.mockResolvedValue({});
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('doc-remove-d1'));
        expect(screen.getByText('Remove document?')).toBeInTheDocument();
        fireEvent.click(screen.getAllByText('Remove').at(-1)!);
        await waitFor(() => expect(mockArchive).toHaveBeenCalledWith('v1', 'd1'));
        expect(await screen.findByText('Document removed.')).toBeInTheDocument();
    });
    it('When the action fails / Then the error shows', async () => {
        mockArchive.mockRejectedValue({});
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('doc-remove-d1'));
        fireEvent.click(screen.getAllByText('Remove').at(-1)!);
        expect(await screen.findByText('The action could not be completed.')).toBeInTheDocument();
    });
    it('When rejecting / Then a reason is required before Reject is enabled', async () => {
        mockVerify.mockResolvedValue({});
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('doc-reject-d1'));
        expect(screen.getByTestId('doc-reject-confirm')).toBeDisabled();
        fireEvent.change(field('reject_reason'), { target: { value: '  Expired copy ' } });
        fireEvent.click(screen.getByTestId('doc-reject-confirm'));
        await waitFor(() => expect(mockVerify).toHaveBeenCalledWith('v1', 'd1', 'rejected', 'Expired copy'));
        expect(await screen.findByText('Document rejected.')).toBeInTheDocument();
    });
    it('When the reject call fails / Then the error shows', async () => {
        mockVerify.mockRejectedValue(new Error('Denied'));
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('doc-reject-d1'));
        fireEvent.change(field('reject_reason'), { target: { value: 'x' } });
        fireEvent.click(screen.getByTestId('doc-reject-confirm'));
        expect(await screen.findByText('Denied')).toBeInTheDocument();
    });
    it('When the reject call fails without a message / Then a fallback shows', async () => {
        mockVerify.mockRejectedValue({});
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('doc-reject-d1'));
        fireEvent.change(field('reject_reason'), { target: { value: 'x' } });
        fireEvent.click(screen.getByTestId('doc-reject-confirm'));
        expect(await screen.findByText('Could not reject the document.')).toBeInTheDocument();
    });
    it('When the reject dialog is cancelled / Then nothing is sent', async () => {
        render(<VendorDocumentsSection vendorId="v1" />);
        fireEvent.click(await screen.findByTestId('doc-reject-d1'));
        fireEvent.click(screen.getAllByText('Cancel').at(-1)!);
        expect(mockVerify).not.toHaveBeenCalled();
    });
});
