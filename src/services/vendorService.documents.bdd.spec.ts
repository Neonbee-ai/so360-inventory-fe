import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vendorService } from './vendorService';
import { inventoryService } from './inventoryService';

/** BDD: vendor compliance documents + activity API calls (Pulse 3fc12200). */

const mockFetch = vi.fn();
const ok = (body: any = {}) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as any);

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    mockFetch.mockReturnValue(ok());
    inventoryService.setOrgId('org-1');
    inventoryService.setTenantId('t-1');
    inventoryService.setAccessToken('tok');
});
afterEach(() => vi.restoreAllMocks());

const call = (i = 0) => mockFetch.mock.calls[i] as [string, any];

describe('Given vendor documents', () => {
    it('When listed / Then GET /vendors/:id/documents with JSON headers', async () => {
        await vendorService.listDocuments('v1');
        expect(call()[0]).toMatch(/\/v1\/vendors\/v1\/documents$/);
        expect(call()[1].headers['Content-Type']).toBe('application/json');
    });

    it('When uploaded / Then multipart without a JSON content type, empty fields dropped', async () => {
        const file = new File(['x'], 'gst.pdf', { type: 'application/pdf' });
        await vendorService.uploadDocument('v1', file, { document_type: 'gst_certificate', document_number: '', expiry_date: undefined, notes: 'n' });
        const [url, opts] = call();
        expect(url).toMatch(/\/v1\/vendors\/v1\/documents$/);
        expect(opts.method).toBe('POST');
        expect(opts.headers['Content-Type']).toBeUndefined();
        expect(opts.headers['X-Org-Id']).toBe('org-1');
        const body = opts.body as FormData;
        expect(body.get('file')).toBeInstanceOf(File);
        expect(body.get('document_type')).toBe('gst_certificate');
        expect(body.get('notes')).toBe('n');
        expect(body.has('document_number')).toBe(false);
        expect(body.has('expiry_date')).toBe(false);
    });

    it('When verified / Then POST verify with only the status', async () => {
        await vendorService.verifyDocument('v1', 'd1', 'verified');
        expect(call()[0]).toMatch(/\/v1\/vendors\/v1\/documents\/d1\/verify$/);
        expect(JSON.parse(call()[1].body)).toEqual({ status: 'verified' });
    });

    it('When rejected with a reason / Then the reason is sent', async () => {
        await vendorService.verifyDocument('v1', 'd1', 'rejected', 'blurry');
        expect(JSON.parse(call()[1].body)).toEqual({ status: 'rejected', reason: 'blurry' });
    });

    it('When removed / Then DELETE the document', async () => {
        await vendorService.archiveDocument('v1', 'd1');
        expect(call()[0]).toMatch(/\/v1\/vendors\/v1\/documents\/d1$/);
        expect(call()[1].method).toBe('DELETE');
    });
});

describe('Given vendor activity', () => {
    it('When read with defaults / Then limit=50', async () => {
        await vendorService.getActivity('v1');
        expect(call()[0]).toMatch(/\/v1\/vendors\/v1\/activity\?limit=50$/);
    });
    it('When read with a limit / Then that limit is sent', async () => {
        await vendorService.getActivity('v1', 20);
        expect(call()[0]).toMatch(/limit=20$/);
    });
});
