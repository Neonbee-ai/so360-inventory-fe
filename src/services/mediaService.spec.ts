import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mediaService } from './mediaService';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mediaService.setAccessToken('tok');
  mediaService.setTenantId('t-1');
  mediaService.setOrgId('org-1');
});

afterEach(() => {
  vi.restoreAllMocks();
});

const jsonOk = (body: any) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as any);

const jsonFail = (status: number, message: string) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve({ message }) } as any);

const makeFile = (name = 'test.jpg', type = 'image/jpeg') =>
  new File(['content'], name, { type });

describe('mediaService', () => {
  describe('Given uploadFile', () => {
    it('When called with file / Then sends POST to /v1/media/upload', async () => {
      mockFetch.mockReturnValue(jsonOk({ url: 'https://cdn.example.com/test.jpg' }));
      const file = makeFile();
      const result = await mediaService.uploadFile(file);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/media/upload');
      expect(opts.method).toBe('POST');
      expect(opts.body).toBeInstanceOf(FormData);
      expect(result.url).toBe('https://cdn.example.com/test.jpg');
    });

    it('When called / Then includes Authorization header', async () => {
      mockFetch.mockReturnValue(jsonOk({ url: 'https://cdn.example.com/img.png' }));
      await mediaService.uploadFile(makeFile('img.png', 'image/png'));
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers['Authorization']).toBe('Bearer tok');
    });

    it('When called with tenant and org / Then includes tenant and org headers', async () => {
      mockFetch.mockReturnValue(jsonOk({ url: 'https://cdn.example.com/img.png' }));
      await mediaService.uploadFile(makeFile());
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers['X-Tenant-Id']).toBe('t-1');
      expect(opts.headers['X-Org-Id']).toBe('org-1');
    });

    it('When upload fails / Then throws error with message', async () => {
      mockFetch.mockReturnValue(jsonFail(413, 'File too large'));
      await expect(mediaService.uploadFile(makeFile())).rejects.toThrow('File too large');
    });

    it('When upload fails with unparseable error / Then throws Upload failed', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error('parse fail')) } as any)
      );
      await expect(mediaService.uploadFile(makeFile())).rejects.toThrow('Upload failed');
    });

    it('When access token not set / Then throws Access token not set', async () => {
      mediaService.setAccessToken(null as any);
      await expect(mediaService.uploadFile(makeFile())).rejects.toThrow('Access token not set');
    });
  });

  describe('Given uploadDocument', () => {
    it('When called / Then sends POST to /v1/documents/upload', async () => {
      mockFetch.mockReturnValue(jsonOk({ url: 'https://cdn.example.com/doc.pdf', document_id: 'doc1' }));
      const file = makeFile('doc.pdf', 'application/pdf');
      const result = await mediaService.uploadDocument(file, 'org-1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/documents/upload');
      expect(opts.method).toBe('POST');
      expect(opts.body).toBeInstanceOf(FormData);
      expect(result.document_id).toBe('doc1');
    });

    it('When called / Then sends x-org-id header', async () => {
      mockFetch.mockReturnValue(jsonOk({ url: 'https://cdn.example.com/doc.pdf', document_id: 'doc1' }));
      await mediaService.uploadDocument(makeFile('doc.pdf', 'application/pdf'), 'org-99');
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers['x-org-id']).toBe('org-99');
      expect(opts.headers['Authorization']).toBe('Bearer tok');
    });

    it('When upload fails / Then throws error message', async () => {
      mockFetch.mockReturnValue(jsonFail(400, 'Invalid document format'));
      await expect(mediaService.uploadDocument(makeFile(), 'org-1')).rejects.toThrow('Invalid document format');
    });

    it('When upload fails with unparseable error / Then throws Document upload failed', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error('parse fail')) } as any)
      );
      await expect(mediaService.uploadDocument(makeFile(), 'org-1')).rejects.toThrow('Document upload failed');
    });

    it('When access token not set / Then throws Access token not set', async () => {
      mediaService.setAccessToken(null as any);
      await expect(mediaService.uploadDocument(makeFile(), 'org-1')).rejects.toThrow('Access token not set');
    });
  });

  describe('Given setters', () => {
    it('When setAccessToken called / Then new token used in requests', async () => {
      mediaService.setAccessToken('new-token-xyz');
      mockFetch.mockReturnValue(jsonOk({ url: 'https://cdn.example.com/img.png' }));
      await mediaService.uploadFile(makeFile());
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers['Authorization']).toBe('Bearer new-token-xyz');
    });

    it('When tenant not set / Then X-Tenant-Id header not included', async () => {
      mediaService.setTenantId(null as any);
      mockFetch.mockReturnValue(jsonOk({ url: 'https://cdn.example.com/img.png' }));
      await mediaService.uploadFile(makeFile());
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers['X-Tenant-Id']).toBeUndefined();
    });

    it('When orgId not set / Then X-Org-Id header not included', async () => {
      mediaService.setOrgId(null as any);
      mockFetch.mockReturnValue(jsonOk({ url: 'https://cdn.example.com/img.png' }));
      await mediaService.uploadFile(makeFile());
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers['X-Org-Id']).toBeUndefined();
    });
  });
});
