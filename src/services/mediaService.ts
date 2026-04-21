// Uploads to Core BE's DigitalOcean Spaces pipe (see
// so360-core/src/media/media.service.ts). Previously used bare `/v1/*`
// paths that only worked locally via Vite's dev proxy — in prod they
// resolved against window.location.origin (dashboard.neonbee.app) and
// 405'd on the static-asset nginx. Composing an absolute URL from
// VITE_SO360_CORE_API matches the pattern used in inventoryService.ts.
function resolveCoreOrigin(): string {
    const win = typeof window !== 'undefined' ? (window as any) : undefined;
    const env = (import.meta as any)?.env || {};
    const origin =
        (win && win.VITE_SO360_CORE_API) ||
        env.VITE_SO360_CORE_API ||
        env.VITE_API_BASE_URL ||
        'http://localhost:3000';
    return String(origin).replace(/\/$/, '');
}

class MediaService {
    private accessToken: string | null = null;
    private readonly coreOrigin = resolveCoreOrigin();

    setAccessToken(token: string) {
        this.accessToken = token;
    }

    async uploadFile(file: File): Promise<{ url: string }> {
        if (!this.accessToken) throw new Error('Access token not set');

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.coreOrigin}/v1/media/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Upload failed' }));
            throw new Error(error.message || 'Upload failed');
        }

        return response.json();
    }

    async uploadDocument(file: File, orgId: string): Promise<{ url: string; document_id: string }> {
        if (!this.accessToken) throw new Error('Access token not set');

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.coreOrigin}/v1/documents/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'x-org-id': orgId,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Document upload failed' }));
            throw new Error(error.message || 'Document upload failed');
        }

        return response.json();
    }
}

export const mediaService = new MediaService();
