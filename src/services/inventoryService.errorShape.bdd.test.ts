import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { inventoryService } from './inventoryService';

/**
 * Non-OK responses throw an Error that carries status, the parsed body and a
 * string `code`, so the Class B save path can branch on 409
 * DATASET_VERSION_CONFLICT and 400 DATASET_FIELD_* without parsing messages.
 */

const mockFetch = vi.fn();
const failing = (status: number, json: () => Promise<any>) => Promise.resolve({ ok: false, status, json } as any);

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  inventoryService.setOrgId('org-1');
  inventoryService.setTenantId('t-1');
  inventoryService.setAccessToken('tok');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function caught(p: Promise<unknown>): Promise<any> {
  try { await p; } catch (e) { return e; }
  throw new Error('expected the request to reject');
}

describe('Feature: inventory API error shape', () => {
  describe('Scenario: a 409 version conflict on PATCH /items/:id', () => {
    it('then the error carries status 409, the body and the string code', async () => {
      // Given the backend rejects a stale custom_fields_version
      const body = { message: 'Record was modified', code: 'DATASET_VERSION_CONFLICT', current_version: 4 };
      mockFetch.mockReturnValue(failing(409, () => Promise.resolve(body)));
      // When the item is updated
      const e = await caught(inventoryService.updateItem('item-1', { custom_fields: { grade: 'A' }, version: 3 }));
      // Then the error exposes the conflict without message parsing
      expect(e).toBeInstanceOf(Error);
      expect(e.message).toBe('Record was modified');
      expect(e.status).toBe(409);
      expect(e.code).toBe('DATASET_VERSION_CONFLICT');
      expect(e.body).toEqual(body);
      expect(mockFetch.mock.calls[0][0]).toContain('/items/item-1');
    });
  });

  describe('Scenario: a 400 DATASET_FIELD_* validation error', () => {
    it('then the field code is carried through', async () => {
      // Given a field validation failure
      mockFetch.mockReturnValue(failing(400, () => Promise.resolve({ message: 'grade must be one of A,B', code: 'DATASET_FIELD_INVALID_OPTION' })));
      // When the item is updated
      const e = await caught(inventoryService.updateItem('item-1', { custom_fields: { grade: 'Z' } }));
      // Then status and code are present
      expect(e.status).toBe(400);
      expect(e.code).toBe('DATASET_FIELD_INVALID_OPTION');
      expect(e.message).toBe('grade must be one of A,B');
    });
  });

  describe('Scenario: the body has a non-string code and no message', () => {
    it('then code is undefined and the message falls back', async () => {
      // Given a body with a numeric code and no message
      mockFetch.mockReturnValue(failing(500, () => Promise.resolve({ code: 500 })));
      // When the item is updated
      const e = await caught(inventoryService.updateItem('item-1', {}));
      // Then the generic message is used and code is not forwarded
      expect(e.message).toBe('API Request failed');
      expect(e.code).toBeUndefined();
      expect(e.status).toBe(500);
      expect(e.body).toEqual({ code: 500 });
    });
  });

  describe('Scenario: the error body is not JSON', () => {
    it('then the fallback body is used and the status is still exposed', async () => {
      // Given a response whose json() rejects
      mockFetch.mockReturnValue(failing(502, () => Promise.reject(new SyntaxError('Unexpected token <'))));
      // When the item is updated
      const e = await caught(inventoryService.updateItem('item-1', {}));
      // Then the error is well-formed
      expect(e.message).toBe('API Request failed');
      expect(e.status).toBe(502);
      expect(e.body).toEqual({ message: 'API Request failed' });
      expect(e.code).toBeUndefined();
    });
  });
});
