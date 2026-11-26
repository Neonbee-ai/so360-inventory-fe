import { inventoryService } from './inventoryService';
import { notifyQuotaExceeded } from './quotaExceeded';

export const LINE_ACK_FLAG = 'action:inventory:procurement:line_acknowledgement';
export const EXPEDITING_FLAG = 'submodule:inventory:procurement_expediting';

export interface AckLineInput {
    schedule_id: string;
    response: 'accepted' | 'partially_accepted' | 'rejected' | 'proposed_change';
    confirmed_quantity?: number;
    confirmed_date?: string;
    proposed_quantity?: number;
    proposed_date?: string;
    proposed_price?: number;
    exception_reason?: string;
}

/** Supplier acknowledgement, schedules, shipments and expediting (Procurement Flow 06, Pulse a8c2a582). */
class PoScheduleService {
    private readonly baseUrl: string;

    constructor() {
        const win = typeof window !== 'undefined' ? (window as any) : undefined;
        const env = (import.meta as any).env || {};
        const resolved = (win && win.VITE_SO360_INVENTORY_API) || env.VITE_SO360_INVENTORY_API || env.VITE_API_BASE_URL || 'http://localhost:3006';
        this.baseUrl = `${String(resolved).replace(/\/$/, '')}/v1/procurement`;
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(inventoryService as any).accessToken}`,
                'X-Tenant-Id': (inventoryService as any).tenantId || '',
                'X-Org-Id': inventoryService.getOrgId() || '',
                ...options.headers,
            },
        });
        await notifyQuotaExceeded(response);
        if (!response.ok) {
            const body = await response.json().catch(() => ({ message: 'API Request failed' }));
            const raw = body.message;
            throw new Error(Array.isArray(raw) ? raw.join(', ') : (raw || 'API Request failed'));
        }
        return response.json();
    }

    schedules(poId: string) { return this.request(`/po/${poId}/schedules`); }
    acknowledgements(poId: string) { return this.request(`/po/${poId}/acknowledgements`); }
    recordAck(poId: string, dto: { po_version: number; idempotency_key?: string; contact_name?: string; evidence_url?: string; comments?: string; lines: AckLineInput[] }) {
        return this.request(`/po/${poId}/acknowledgements`, { method: 'POST', body: JSON.stringify(dto) });
    }
    decideProposal(scheduleId: string, dto: { decision: 'accept' | 'reject'; reason?: string }) {
        return this.request(`/po/schedules/${scheduleId}/proposal-decision`, { method: 'POST', body: JSON.stringify(dto) });
    }
    shipments(poId: string) { return this.request(`/po/${poId}/shipments`); }
    recordShipment(poId: string, dto: { asn_number: string; carrier?: string; tracking_ref?: string; eta?: string; dispatch_date?: string; lines: Array<{ schedule_id: string; quantity: number }> }) {
        return this.request(`/po/${poId}/shipments`, { method: 'POST', body: JSON.stringify(dto) });
    }
    followUp(scheduleId: string, dto: { owner_id?: string | null; next_follow_up_at?: string | null; delay_cause?: string | null }) {
        return this.request(`/po/schedules/${scheduleId}/follow-up`, { method: 'PATCH', body: JSON.stringify(dto) });
    }
    expediting(view?: string) { return this.request(`/expediting${view ? `?view=${encodeURIComponent(view)}` : ''}`); }
}

export const poScheduleService = new PoScheduleService();
