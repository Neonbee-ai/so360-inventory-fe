import { inventoryService } from './inventoryService';
import type { AttributeGroup, CreateAttributeGroupInput, UpdateAttributeGroupInput } from '../types/productTypes';

class ProductTypeService {
    private get orgId() {
        return inventoryService.getOrgId();
    }

    private get baseUrl() {
        return `/v1/inventory/product-types`;
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        // Reuse the inventoryService's request infrastructure
        return inventoryService.request(`/product-types${endpoint}`, options);
    }

    async getAll() {
        return this.request(`/${this.orgId}`);
    }

    async getOne(id: string) {
        return this.request(`/${this.orgId}/${id}`);
    }

    async create(data: { name: string; code: string; description?: string; icon?: string }) {
        return this.request(`/${this.orgId}`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async update(id: string, data: Partial<{ name: string; code: string; description: string; icon: string; is_active: boolean }>) {
        return this.request(`/${this.orgId}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async delete(id: string) {
        return this.request(`/${this.orgId}/${id}`, {
            method: 'DELETE',
        });
    }

    async addAttribute(typeId: string, data: any) {
        return this.request(`/${this.orgId}/${typeId}/attributes`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateAttribute(typeId: string, attrId: string, data: any) {
        return this.request(`/${this.orgId}/${typeId}/attributes/${attrId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteAttribute(typeId: string, attrId: string) {
        return this.request(`/${this.orgId}/${typeId}/attributes/${attrId}`, {
            method: 'DELETE',
        });
    }

    // ── Attribute groups ────────────────────────────────────────────────
    // A group is a heading (Dimensions, Material & Finish) with a per-surface
    // placements map; attributes join one via updateAttribute({ group_id }).

    async getAttributeGroups(typeId: string): Promise<AttributeGroup[]> {
        return this.request(`/${this.orgId}/${typeId}/attribute-groups`);
    }

    async createAttributeGroup(typeId: string, data: CreateAttributeGroupInput): Promise<AttributeGroup> {
        return this.request(`/${this.orgId}/${typeId}/attribute-groups`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /** `placements` is merged server-side, so sending one surface leaves the rest untouched. */
    async updateAttributeGroup(typeId: string, groupId: string, data: UpdateAttributeGroupInput): Promise<AttributeGroup> {
        return this.request(`/${this.orgId}/${typeId}/attribute-groups/${groupId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async deleteAttributeGroup(typeId: string, groupId: string) {
        return this.request(`/${this.orgId}/${typeId}/attribute-groups/${groupId}`, {
            method: 'DELETE',
        });
    }
}

export const productTypeService = new ProductTypeService();
