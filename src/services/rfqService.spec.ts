import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./inventoryService', () => ({
    inventoryService: {
        getOrgId: () => 'org-1',
        accessToken: 'tok',
        tenantId: 't-1',
    },
}));

import { rfqService } from './rfqService';

const mockFetch = vi.fn();
const jsonOk = (body: any) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as any);

beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as any;
});

describe('rfqService', () => {
    describe('Given the RFQ list is requested', () => {
        it('When no filters are given / Then it fetches the org list without a query string', async () => {
            mockFetch.mockReturnValue(jsonOk([]));
            await rfqService.getRFQs();
            const [url] = mockFetch.mock.calls[0];
            expect(url).toContain('/v1/procurement/rfq/list/org-1');
            expect(url).not.toContain('?');
        });

        it('When filters are given / Then status and search ride as query params', async () => {
            mockFetch.mockReturnValue(jsonOk([]));
            await rfqService.getRFQs({ status: 'sent', search: 'cement', limit: 10 });
            const [url] = mockFetch.mock.calls[0];
            expect(url).toContain('status=sent');
            expect(url).toContain('search=cement');
            expect(url).toContain('limit=10');
        });
    });

    describe('Given an RFQ is created', () => {
        it('When createRFQ is called / Then it POSTs the payload to the RFQ root', async () => {
            mockFetch.mockReturnValue(jsonOk({ id: 'rfq-1', rfq_number: 'RFQ-2026-0001' }));
            const result = await rfqService.createRFQ({ title: 'Cement', vendor_ids: ['v1'] });

            const [url, opts] = mockFetch.mock.calls[0];
            expect(url).toMatch(/\/v1\/procurement\/rfq$/);
            expect(opts.method).toBe('POST');
            expect(JSON.parse(opts.body)).toEqual({ title: 'Cement', vendor_ids: ['v1'] });
            expect(result.rfq_number).toBe('RFQ-2026-0001');
        });
    });

    describe('Given vendors need the RFQ', () => {
        it('When sendRFQ is called / Then it PATCHes the send route', async () => {
            mockFetch.mockReturnValue(jsonOk({}));
            await rfqService.sendRFQ('rfq-1', { message: 'Please quote' });
            const [url, opts] = mockFetch.mock.calls[0];
            expect(url).toContain('/v1/procurement/rfq/rfq-1/send');
            expect(opts.method).toBe('PATCH');
            expect(JSON.parse(opts.body).message).toBe('Please quote');
        });
    });

    describe('Given a quotation arrives', () => {
        it('When recordQuotation is called / Then it POSTs under the RFQ', async () => {
            mockFetch.mockReturnValue(jsonOk({ id: 'q-1' }));
            await rfqService.recordQuotation('rfq-1', { vendor_id: 'v1', items: [] });
            const [url, opts] = mockFetch.mock.calls[0];
            expect(url).toContain('/v1/procurement/rfq/rfq-1/quotation');
            expect(opts.method).toBe('POST');
        });

        it('When gradeQuotation is called / Then it PATCHes the quotation status route', async () => {
            mockFetch.mockReturnValue(jsonOk({}));
            await rfqService.gradeQuotation('q-1', { status: 'shortlisted' });
            const [url, opts] = mockFetch.mock.calls[0];
            expect(url).toContain('/v1/procurement/rfq/quotation/q-1/status');
            expect(opts.method).toBe('PATCH');
        });
    });

    describe('Given the buyer compares and awards', () => {
        it('When getComparison is called / Then it fetches the comparison route', async () => {
            mockFetch.mockReturnValue(jsonOk({ quotations: [] }));
            await rfqService.getComparison('rfq-1');
            const [url] = mockFetch.mock.calls[0];
            expect(url).toContain('/v1/procurement/rfq/rfq-1/comparison');
        });

        it('When awardRFQ is called / Then the winning quotation and justification are sent', async () => {
            mockFetch.mockReturnValue(jsonOk({ rfq: {}, po: { id: 'po-1' } }));
            await rfqService.awardRFQ('rfq-1', { quotation_id: 'q-2', justification: 'Better lead time' });
            const [url, opts] = mockFetch.mock.calls[0];
            expect(url).toContain('/v1/procurement/rfq/rfq-1/award');
            expect(opts.method).toBe('PATCH');
            expect(JSON.parse(opts.body)).toEqual({
                quotation_id: 'q-2',
                justification: 'Better lead time',
            });
        });
    });

    describe('Given the API rejects a request', () => {
        it('When the body carries a validation array / Then the messages are joined into one error', async () => {
            mockFetch.mockReturnValue(Promise.resolve({
                ok: false,
                json: () => Promise.resolve({ message: ['vendor_id must be a UUID', 'items should not be empty'] }),
            } as any));

            await expect(rfqService.recordQuotation('rfq-1', {})).rejects.toThrow(
                'vendor_id must be a UUID, items should not be empty',
            );
        });
    });

    describe('Given every request', () => {
        it('When it is sent / Then auth, tenant and org headers are attached', async () => {
            mockFetch.mockReturnValue(jsonOk([]));
            await rfqService.getRFQs();
            const [, opts] = mockFetch.mock.calls[0];
            expect(opts.headers['Authorization']).toBe('Bearer tok');
            expect(opts.headers['X-Tenant-Id']).toBe('t-1');
            expect(opts.headers['X-Org-Id']).toBe('org-1');
        });
    });
});
