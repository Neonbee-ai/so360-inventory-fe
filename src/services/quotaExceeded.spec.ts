import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { inventoryService } from './inventoryService';

/**
 * BDD: the Inventory API client surfaces a 402 (quota exceeded) to the Shell's
 * upgrade modal through the shared `__so360_quota_exceeded` event, and stays
 * silent for every other failure status.
 */
const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Feature: quota-exceeded interceptor on the Inventory API client', () => {
    let received: CustomEvent[];
    const listener = (e: Event) => { received.push(e as CustomEvent); };

    beforeEach(() => {
        received = [];
        inventoryService.setTenantId('3cf1c619-c8f6-49ac-9207-447418d5beee');
        inventoryService.setOrgId('8317fe18-6ac4-4ac4-b71d-dc13122a905d');
        inventoryService.setAccessToken('token');
        window.addEventListener('__so360_quota_exceeded', listener);
    });
    afterEach(() => {
        window.removeEventListener('__so360_quota_exceeded', listener);
        vi.unstubAllGlobals();
    });

    describe('Given the backend answers 402 with a resolution hint', () => {
        it('When inventoryService.request runs / Then __so360_quota_exceeded is dispatched with the resolution and the call still rejects', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(402, {
                code: 'QUOTA_EXCEEDED', message: 'Quota exceeded', resolution: { action: 'upgrade', plan: 'growth' },
            })));

            await expect(inventoryService.request('/warehouses')).rejects.toThrow('Quota exceeded');

            expect(received).toHaveLength(1);
            expect(received[0].detail).toEqual({ action: 'upgrade', plan: 'growth' });
        });
    });

    describe('Given the backend answers 402 without a resolution', () => {
        it('When the Core business-settings read runs / Then the raw body is the event detail and the call still rejects', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(402, { code: 'QUOTA_EXCEEDED' })));

            await expect(inventoryService.getBusinessSettings()).rejects.toThrow('Failed to fetch business settings');

            expect(received).toHaveLength(1);
            expect(received[0].detail).toEqual({ code: 'QUOTA_EXCEEDED' });
        });
    });

    describe('Given the backend answers 500', () => {
        it('When inventoryService.request runs / Then no quota event is dispatched and the error propagates', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { message: 'boom' })));

            await expect(inventoryService.request('/warehouses')).rejects.toThrow('boom');

            expect(received).toHaveLength(0);
        });
    });
});
