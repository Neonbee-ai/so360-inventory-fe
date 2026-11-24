import { inventoryService } from './inventoryService';
import { notifyQuotaExceeded } from './quotaExceeded';

class VendorService {
    private readonly origin: string;
    private readonly baseUrl: string;
    private userId: string | null = null;

    constructor() {
        const win = typeof window !== 'undefined' ? (window as any) : undefined;
        /* v8 ignore next -- import.meta.env is always present under Vite/vitest; the `|| {}` only guards non-Vite bundlers and is unreachable in tests */
        // Bare `import.meta.env` — see procurementService for why the
        // optional-chained form silently ships localhost.
        const env = (import.meta as any).env || {};
        // Hostname-aware smart default: on any *.neonbee.app deployment the
        // correct gateway is always api.neonbee.app/inventory, regardless of
        // whether the shell's window-global injection fired correctly.
        const getDefault = (): string => {
            if (!win?.location) return 'http://localhost:3006';
            const { hostname } = win.location;
            if (hostname === 'neonbee.app' || hostname.endsWith('.neonbee.app')) {
                return 'https://api.neonbee.app/inventory';
            }
            return 'http://localhost:3006';
        };
        const resolved =
            (win && win.VITE_SO360_INVENTORY_API) ||
            env.VITE_SO360_INVENTORY_API ||
            getDefault();
        this.origin = String(resolved).replace(/\/$/, '');
        this.baseUrl = `${this.origin}/v1/vendors`;
    }

    setUserId(id: string) {
        this.userId = id;
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        const orgId = inventoryService.getOrgId();
        const tenantId = (inventoryService as any).tenantId;
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                // Multipart bodies set their own boundary header.
                ...(typeof FormData !== 'undefined' && options.body instanceof FormData
                    ? {}
                    : { 'Content-Type': 'application/json' }),
                'Authorization': `Bearer ${(inventoryService as any).accessToken}`,
                'X-Tenant-Id': tenantId || '',
                'X-Org-Id': orgId || '',
                'x-user-id': this.userId || '',
                ...options.headers,
            },
        });
        await notifyQuotaExceeded(response);

        if (!response.ok) {
            let message: string;
            let body: any;
            try {
                body = await response.json();
                message = body.message || body.error || `Request failed (${response.status})`;
            } catch {
                message = response.status === 405
                    ? 'Vendor API endpoint not reachable — please contact support.'
                    : `Request failed (${response.status} ${response.statusText})`;
            }
            // Carry the HTTP status on the Error so callers can tell an expected
            // authorization denial (403) apart from a genuine server/network
            // failure and message the user accordingly.
            // The parsed body rides along so a form can show structured detail
            // (e.g. the Vendor Master's `missing` list on a refused activation).
            throw Object.assign(new Error(message), { status: response.status, body });
        }

        return response.json();
    }

    async getVendors() {
        return this.request(`/${inventoryService.getOrgId()}`);
    }

    /**
     * Paged read. A BE that knows `include_total` answers `{ data, total }`;
     * an older BE ignores the params and returns the bare array, which is
     * reported as `legacy: true` so callers can page it client-side.
     */
    async getVendorsPage(opts: { limit: number; offset: number; search?: string }): Promise<{ data: any[]; total: number; legacy: boolean }> {
        const qs = new URLSearchParams({ include_total: 'true', limit: String(opts.limit), offset: String(opts.offset) });
        if (opts.search && opts.search.trim()) qs.set('search', opts.search.trim());
        const res = await this.request(`/${inventoryService.getOrgId()}?${qs.toString()}`);
        if (Array.isArray(res)) return { data: res, total: res.length, legacy: true };
        const data = Array.isArray(res?.data) ? res.data : [];
        return { data, total: typeof res?.total === 'number' ? res.total : data.length, legacy: false };
    }

    async createVendor(dto: any) {
        return this.request('', {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async getVendorDetail(id: string) {
        return this.request(`/detail/${id}`);
    }

    /** Vendor Master snapshot + onboarding gaps (Pulse 652f492e). No bank numbers. */
    async getVendorMaster(id: string) {
        return this.request(`/${id}/master`);
    }
    /** Vendor 360 — POs, goods receipts and payables, composed by the API. */
    async getVendor360<T = any>(id: string): Promise<T> {
        return this.request(`/${id}/360`);
    }

    // ── Lifecycle, qualifications, restrictions (Pulse 97d03c26) ──
    async getLifecycle<T = any>(id: string): Promise<T> {
        return this.request(`/${id}/lifecycle`);
    }
    async transitionVendor(id: string, dto: { to_state: string; reason_code: string; reason_text?: string }) {
        return this.request(`/${id}/lifecycle/transition`, { method: 'POST', body: JSON.stringify(dto) });
    }
    async getReviewQueue<T = any>(params: { state?: string; risk?: string; limit?: number; offset?: number } = {}): Promise<T> {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
        const q = qs.toString();
        return this.request(`/lifecycle/review-queue${q ? `?${q}` : ''}`);
    }
    // Vendor 10 (Pulse 91b5ff86): outcome facts and receipt/return integration exceptions.
    async getOutcomes<T = any>(id: string, params: { source_type?: string; from?: string; to?: string; limit?: number } = {}): Promise<T> {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
        const q = qs.toString();
        return this.request(`/${id}/outcomes${q ? `?${q}` : ''}`);
    }
    async getIntegrationExceptions<T = any>(params: { status?: string; vendor_id?: string; source_module?: string } = {}): Promise<T> {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
        const q = qs.toString();
        return this.request(`/integration-exceptions${q ? `?${q}` : ''}`);
    }
    async resolveIntegrationException(id: string, dto: { status: 'resolved' | 'ignored'; resolution_note?: string; vendor_id?: string }) {
        return this.request(`/integration-exceptions/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
    }
    // ── Supplier quality & corrective actions (Pulse aa067321) ──
    async getQualityHistory<T = any>(vendorId: string): Promise<T> {
        return this.request(`/${vendorId}/quality-history`);
    }
    async listCorrectiveActions<T = any>(params: { vendor_id?: string; status?: string } = {}): Promise<T> {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
        const q = qs.toString();
        return this.request(`/corrective-actions${q ? `?${q}` : ''}`);
    }
    async getCorrectiveAction<T = any>(id: string): Promise<T> {
        return this.request(`/corrective-actions/${id}`);
    }
    async transitionCorrectiveAction(id: string, dto: Record<string, any>) {
        return this.request(`/corrective-actions/${id}/transition`, { method: 'POST', body: JSON.stringify(dto) });
    }
    async closeCorrectiveAction(id: string, dto: Record<string, any>) {
        return this.request(`/corrective-actions/${id}/close`, { method: 'POST', body: JSON.stringify(dto) });
    }
    async addCorrectiveActionEvidence(id: string, dto: { title: string; file_url?: string; document_id?: string; note?: string }) {
        return this.request(`/corrective-actions/${id}/evidence`, { method: 'POST', body: JSON.stringify(dto) });
    }
    async decideRestrictionDraft(restrictionId: string, dto: { decision: 'approve' | 'reject'; note?: string }) {
        return this.request(`/restrictions/${restrictionId}/draft-decision`, { method: 'POST', body: JSON.stringify(dto) });
    }
    // ── Vendor evidence & compliance (Pulse f777120a) ──
    async getEvidence<T = any>(vendorId: string): Promise<T> {
        return this.request(`/${vendorId}/evidence`);
    }
    async replaceDocument(docId: string, file: File, meta: Record<string, string | undefined>) {
        const form = new FormData();
        form.append('file', file);
        for (const [k, v] of Object.entries(meta)) if (v !== undefined && v !== '') form.append(k, v);
        return this.request(`/documents/${docId}/replace`, { method: 'POST', body: form });
    }
    async retryDocumentUpload(docId: string, file: File) {
        const form = new FormData();
        form.append('file', file);
        return this.request(`/documents/${docId}/retry-upload`, { method: 'POST', body: form });
    }
    async reviewDocument(docId: string, dto: { decision: string; note?: string; method?: string }) {
        return this.request(`/documents/${docId}/review`, { method: 'POST', body: JSON.stringify(dto) });
    }
    async getDocumentDownload<T = { url: string }>(docId: string): Promise<T> {
        return this.request(`/documents/${docId}/download`);
    }
    async listEvidenceTemplates<T = any>(status?: string): Promise<T> {
        return this.request(`/evidence-templates${status ? `?status=${status}` : ''}`);
    }
    async createEvidenceTemplate(dto: Record<string, unknown>) {
        return this.request('/evidence-templates', { method: 'POST', body: JSON.stringify(dto) });
    }
    async updateEvidenceTemplate(id: string, dto: Record<string, unknown>) {
        return this.request(`/evidence-templates/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
    }
    async evidenceTemplateAction(id: string, action: 'activate' | 'new-version' | 'retire') {
        return this.request(`/evidence-templates/${id}/${action}`, { method: 'POST' });
    }
    async listComplianceNotifications<T = any>(status?: string): Promise<T> {
        return this.request(`/compliance/notifications${status ? `?status=${status}` : ''}`);
    }
    async retryComplianceNotification(id: string) {
        return this.request(`/compliance/notifications/${id}/retry`, { method: 'POST' });
    }
    async listRenewalTasks<T = any>(params: { status?: string; assignee?: string } = {}): Promise<T> {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
        const q = qs.toString();
        return this.request(`/renewal-tasks${q ? `?${q}` : ''}`);
    }
    async updateRenewalTask(id: string, dto: { status?: string; assignee_user_id?: string | null }) {
        return this.request(`/renewal-tasks/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
    }
    async getQualifications<T = any[]>(id: string): Promise<T> {
        return this.request(`/${id}/qualifications`);
    }
    async createQualification(id: string, dto: Record<string, unknown>) {
        return this.request(`/${id}/qualifications`, { method: 'POST', body: JSON.stringify(dto) });
    }
    async updateQualification(qid: string, dto: Record<string, unknown>) {
        return this.request(`/qualifications/${qid}`, { method: 'PATCH', body: JSON.stringify(dto) });
    }
    async submitQualification(qid: string) {
        return this.request(`/qualifications/${qid}/submit`, { method: 'POST' });
    }
    async decideQualification(qid: string, dto: { decision: string; comment?: string; valid_to?: string; conditions?: unknown[] }) {
        return this.request(`/qualifications/${qid}/decision`, { method: 'POST', body: JSON.stringify(dto) });
    }
    async updateQualificationCondition(cid: string, dto: { status: string; evidence_refs?: string[] }) {
        return this.request(`/qualification-conditions/${cid}`, { method: 'PATCH', body: JSON.stringify(dto) });
    }
    async getRestrictions<T = any[]>(id: string): Promise<T> {
        return this.request(`/${id}/restrictions`);
    }
    async applyRestriction(id: string, dto: Record<string, unknown>) {
        return this.request(`/${id}/restrictions`, { method: 'POST', body: JSON.stringify(dto) });
    }
    async liftRestriction(rid: string, reason: string) {
        return this.request(`/restrictions/${rid}/lift`, { method: 'POST', body: JSON.stringify({ reason }) });
    }
    async getCommitmentReviews<T = any[]>(id: string): Promise<T> {
        return this.request(`/${id}/commitment-reviews`);
    }
    async decideCommitmentReview(crid: string, dto: { status: string; note?: string }) {
        return this.request(`/commitment-reviews/${crid}`, { method: 'PATCH', body: JSON.stringify(dto) });
    }

    // ── Eligibility, policy, integration health (Pulse 66b329c3) ──
    async checkEligibility<T = any>(dto: Record<string, unknown>): Promise<T> {
        return this.request('/eligibility/check', { method: 'POST', body: JSON.stringify(dto) });
    }
    async getEligibilityPolicy<T = any>(): Promise<T> {
        return this.request('/eligibility-policy');
    }
    async saveEligibilityPolicy<T = any>(dto: Record<string, unknown>): Promise<T> {
        return this.request('/eligibility-policy', { method: 'PUT', body: JSON.stringify(dto) });
    }
    async getIntegrationHealth<T = any>(): Promise<T> {
        return this.request('/integration-health');
    }
    async replayIntegration(dto: { consumer: string; status?: 'dead' | 'failed'; event_ids?: string[] }) {
        return this.request('/integration-health/replay', { method: 'POST', body: JSON.stringify(dto) });
    }

    async updateVendor(id: string, dto: any) {
        return this.request(`/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    async deleteVendor(id: string) {
        return this.request(`/${id}`, {
            method: 'DELETE',
        });
    }

    async getContracts() {
        return this.request(`/contracts/${inventoryService.getOrgId()}`);
    }

    async createContract(dto: any) {
        return this.request('/contracts', {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async rateVendor(vendorId: string, rating: number) {
        return this.request(`/${vendorId}/rate`, {
            method: 'POST',
            body: JSON.stringify({ rating }),
        });
    }

    async getVendorRating(vendorId: string) {
        return this.request(`/${vendorId}/rating`);
    }

    // ── Vendor bank accounts (masked in every response; reveal is audited) ──
    // ── Compliance documents + activity (Pulse 3fc12200, flag vendor_master) ──

    async listDocuments(vendorId: string) {
        return this.request(`/${vendorId}/documents`);
    }

    async uploadDocument(vendorId: string, file: File, meta: Record<string, string | undefined>) {
        const form = new FormData();
        form.append('file', file);
        for (const [k, v] of Object.entries(meta)) {
            if (v !== undefined && v !== '') form.append(k, v);
        }
        return this.request(`/${vendorId}/documents`, { method: 'POST', body: form });
    }

    async verifyDocument(vendorId: string, docId: string, status: 'verified' | 'rejected', reason?: string) {
        return this.request(`/${vendorId}/documents/${docId}/verify`, {
            method: 'POST',
            body: JSON.stringify(reason ? { status, reason } : { status }),
        });
    }

    async archiveDocument(vendorId: string, docId: string) {
        return this.request(`/${vendorId}/documents/${docId}`, { method: 'DELETE' });
    }

    async getActivity(vendorId: string, limit = 50) {
        return this.request(`/${vendorId}/activity?limit=${limit}`);
    }

    async listBankAccounts(vendorId: string, activeOnly = false) {
        return this.request(`/${vendorId}/bank-accounts${activeOnly ? '?active=true' : ''}`);
    }

    async createBankAccount(vendorId: string, dto: Record<string, unknown>) {
        return this.request(`/${vendorId}/bank-accounts`, {
            method: 'POST',
            body: JSON.stringify(dto),
        });
    }

    async updateBankAccount(vendorId: string, accountId: string, dto: Record<string, unknown>) {
        return this.request(`/${vendorId}/bank-accounts/${accountId}`, {
            method: 'PATCH',
            body: JSON.stringify(dto),
        });
    }

    async bankAccountAction(
        vendorId: string,
        accountId: string,
        action: 'deactivate' | 'set-primary' | 'verify' | 'reveal',
        body: Record<string, unknown> = {},
    ) {
        return this.request(`/${vendorId}/bank-accounts/${accountId}/${action}`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    // Pulse 5d23afa0: Finance-controlled payee / bank change requests and the Vendor 360 Finance card.
    async submitPayeeChange(vendorId: string, body: Record<string, unknown>) {
        return this.request(`/${vendorId}/payee-change-requests`, { method: 'POST', body: JSON.stringify(body) });
    }

    async listVendorPayeeChanges(vendorId: string, status?: string) {
        return this.request(`/${vendorId}/payee-change-requests${status ? `?status=${encodeURIComponent(status)}` : ''}`);
    }

    async listPayeeChangeQueue(params: { status?: string; vendor_id?: string } = {}) {
        const q = new URLSearchParams();
        if (params.status) q.set('status', params.status);
        if (params.vendor_id) q.set('vendor_id', params.vendor_id);
        const qs = q.toString();
        return this.request(`/finance/payee-change-requests${qs ? `?${qs}` : ''}`);
    }

    async getPayeeChange(requestId: string) {
        return this.request(`/payee-change-requests/${requestId}`);
    }

    async verifyPayeeChange(requestId: string, body: { method: string; note?: string }) {
        return this.request(`/payee-change-requests/${requestId}/verify`, { method: 'POST', body: JSON.stringify(body) });
    }

    async decidePayeeChange(requestId: string, body: { decision: 'approve' | 'reject'; note?: string }) {
        return this.request(`/payee-change-requests/${requestId}/decision`, { method: 'POST', body: JSON.stringify(body) });
    }

    async cancelPayeeChange(requestId: string) {
        return this.request(`/payee-change-requests/${requestId}/cancel`, { method: 'POST', body: JSON.stringify({}) });
    }

    async getFinanceSummary(vendorId: string) {
        return this.request(`/${vendorId}/finance-summary`);
    }

    async setupFinanceAccount(vendorId: string) {
        return this.request(`/${vendorId}/finance-account`, { method: 'POST', body: JSON.stringify({}) });
    }
}

export const vendorService = new VendorService();
