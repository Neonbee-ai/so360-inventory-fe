import React from 'react';
import { render, renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

/**
 * Data Layer (Class B) Inventory contract: edge cases of capability detection, flag
 * gating, visibility, renderer context and value formatting.
 */

const dl = vi.hoisted(() => ({
    bridge: null as any,
    schemaUndefined: false,
    fields: [] as any[],
    regs: [] as any[],
    layouts: {} as Record<string, any>,
    props: [] as any[],
}));

function Probe(props: any) {
    dl.props.push(props);
    return <div data-testid={`probe-${props.slot}`} />;
}

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => dl.bridge,
    useDatasetSchema: () => (dl.schemaUndefined ? undefined : { fields: dl.fields }),
    useSlotRenderers: (code: string, slot: string) =>
        dl.regs
            .filter((r) => r.dataset_code === code && r.slot === slot)
            .map((r, i) => ({ registration: r, Renderer: Probe, key: `k${i}` })),
    registerRecordLayout: (def: any) => {
        dl.layouts[def.entity] = def;
        return () => undefined;
    },
    getRecordLayout: (entity: string) => dl.layouts[entity] ?? null,
}));

import {
    resolveDataLayerApi, isDlVisible, useInventoryDataLayer, useInventoryCustomColumns, InventorySlotRegion,
    InventoryCreateSection, useInventoryInjectedTabs, missingRequiredCustomFields, formatCustomFieldValue,
    DATA_LAYER_CUSTOM_FIELDS_FLAG,
} from './inventoryDataLayer';

const bridgeOn = (over: any = {}) => ({
    effectiveFlagsLoaded: true,
    isAdmin: false,
    isFeatureEnabled: (k: string) => k === DATA_LAYER_CUSTOM_FIELDS_FLAG,
    ...over,
});

beforeEach(() => {
    dl.bridge = bridgeOn();
    dl.schemaUndefined = false;
    dl.fields = [];
    dl.regs = [];
    dl.layouts = {};
    dl.props = [];
});

const enabledState = (over: any = {}) => ({ enabled: true, entity: 'inventory.item' as const, profile: 'internal', isAdmin: false, fields: [], ...over });

describe('Feature: Capability detection of the shell-context dataLayer API', () => {
    describe('Scenario: invalid module values', () => {
        it('then null, undefined-like and primitive modules resolve to null', () => {
            // Given / When / Then
            expect(resolveDataLayerApi(null)).toBeNull();
            expect(resolveDataLayerApi(0)).toBeNull();
            expect(resolveDataLayerApi('shell-context')).toBeNull();
        });

        it('then an object whose export is not a function resolves to null', () => {
            const mod = { useSlotRenderers: () => [], registerRecordLayout: () => () => undefined, getRecordLayout: () => null, useDatasetSchema: 'nope' };
            expect(resolveDataLayerApi(mod)).toBeNull();
        });
    });

    describe('Scenario: a function-valued module carrying every export', () => {
        it('then it is accepted as the API', () => {
            const mod: any = () => undefined;
            mod.useSlotRenderers = () => [];
            mod.registerRecordLayout = () => () => undefined;
            mod.getRecordLayout = () => null;
            mod.useDatasetSchema = () => ({ fields: [] });
            expect(resolveDataLayerApi(mod)).toBe(mod);
        });
    });
});

describe('Feature: internal visibility profile', () => {
    it('then admins, internal and admin profiles see it and others do not', () => {
        expect(isDlVisible('internal', 'portal', true)).toBe(true);
        expect(isDlVisible('internal', 'internal', false)).toBe(true);
        expect(isDlVisible('internal', 'admin', false)).toBe(true);
        expect(isDlVisible('internal', 'portal', false)).toBe(false);
        expect(isDlVisible('portal', 'portal', false)).toBe(true);
    });
});

describe('Feature: Flag gating of useInventoryDataLayer', () => {
    describe('Given effective flags are still loading', () => {
        it('then the data layer stays disabled (no layouts registered)', () => {
            dl.bridge = bridgeOn({ effectiveFlagsLoaded: false });
            const { result } = renderHook(() => useInventoryDataLayer('inventory.item'));
            expect(result.current.enabled).toBe(false);
            expect(dl.layouts).toEqual({});
        });
    });

    describe('Given the bridge has no isFeatureEnabled', () => {
        it('then the flag is treated as off', () => {
            dl.bridge = { isAdmin: true };
            const { result } = renderHook(() => useInventoryDataLayer('inventory.item'));
            expect(result.current.enabled).toBe(false);
            expect(result.current.isAdmin).toBe(true);
            expect(result.current.profile).toBe('admin');
        });
    });

    describe('Given no bridge at all', () => {
        it('then the data layer is off and not admin', () => {
            dl.bridge = null;
            const { result } = renderHook(() => useInventoryDataLayer('inventory.item'));
            expect(result.current).toMatchObject({ enabled: false, isAdmin: false, profile: 'internal', fields: [] });
        });
    });

    describe('Given the schema hook returns nothing', () => {
        it('then the enabled layer exposes no fields but registers layouts', () => {
            dl.schemaUndefined = true;
            const { result } = renderHook(() => useInventoryDataLayer('inventory.item'));
            expect(result.current.enabled).toBe(true);
            expect(result.current.fields).toEqual([]);
            expect(Object.keys(dl.layouts).sort()).toEqual(['inventory.item']);
        });
    });
});

describe('Feature: Renderer context defaults', () => {
    describe('Given a context without version or canEdit', () => {
        it('then renderers receive version null and canEdit false', () => {
            dl.regs = [{ id: 'r1', dataset_code: 'inventory.item', slot: 'detail.section', renderer: 'custom_fields' }];
            render(<InventorySlotRegion dl={enabledState()} slot="detail.section" region="main" ctx={{ recordId: 'item-1', record: null }} />);
            expect(dl.props[0]).toMatchObject({ version: null, canEdit: false, saveMode: 'native', recordId: 'item-1' });
        });
    });

    describe('Given a detail.tab registration without id or label', () => {
        it('then the tab id uses the resolved key and the label uses the renderer name', () => {
            dl.regs = [{ dataset_code: 'inventory.item', slot: 'detail.tab', renderer: 'child_collection', props: { extra: 1 } }];
            const { result } = renderHook(() => useInventoryInjectedTabs(enabledState(), { recordId: 'item-1', record: null, version: 3, canEdit: true }));
            expect(result.current).toHaveLength(1);
            expect(result.current[0].id).toBe('dl:k0');
            expect(result.current[0].label).toBe('child_collection');
            render(<>{result.current[0].render()}</>);
            expect(dl.props[0]).toMatchObject({ slot: 'detail.tab', version: 3, canEdit: true, extra: 1 });
        });
    });

    describe('Given a create.section rendered without a recordId', () => {
        it('then the renderer gets a null record', () => {
            dl.regs = [{ id: 'c1', dataset_code: 'inventory.item', slot: 'create.section', renderer: 'custom_fields' }];
            render(<InventoryCreateSection dl={enabledState()} mode="create" values={{ a: 1 }} onValuesChange={vi.fn()} />);
            expect(dl.props[0].record).toBeNull();
            expect(dl.props[0].values).toEqual({ a: 1 });
        });
    });

    describe('Given a create.section rendered in edit mode for an existing record', () => {
        it('then the renderer gets a record view built from the id and the current values', () => {
            // Given an edit-form registration
            dl.regs = [{ id: 'c1', dataset_code: 'inventory.item', slot: 'create.section', renderer: 'custom_fields' }];
            // When rendered with a recordId
            render(<InventoryCreateSection dl={enabledState()} mode="edit" recordId="item-9" values={{ a: 2 }} onValuesChange={vi.fn()} />);
            // Then
            expect(dl.props[0].record).toEqual({ id: 'item-9', custom_fields: { a: 2 } });
            expect(dl.props[0].recordId).toBe('item-9');
            expect(dl.props[0].mode).toBe('edit');
        });
    });
});

describe('Feature: Required Class B fields in native forms', () => {
    it('then null, undefined, blank and empty-array values are all reported missing', () => {
        const state = enabledState({
            fields: [
                { field_key: 'a', label: 'A', field_type: 'text', required: true },
                { field_key: 'b', label: 'B', field_type: 'text', required: true },
                { field_key: 'c', label: 'C', field_type: 'text', required: true },
                { field_key: 'd', label: 'D', field_type: 'multi', required: true },
                { field_key: 'e', label: 'E', field_type: 'text', required: true },
                { field_key: 'f', label: 'F', field_type: 'text' },
            ],
        });
        expect(missingRequiredCustomFields(state, { a: null, c: '  ', d: [], e: 'ok' })).toEqual(['a', 'b', 'c', 'd']);
    });
});

describe('Feature: Custom columns ordering', () => {
    it('then fields without sort_order sort as 0', () => {
        const state = enabledState({
            fields: [
                { field_key: 'late', label: 'Late', field_type: 'text', sort_order: 5 },
                { field_key: 'none', label: 'None', field_type: 'text', indexed: true },
                { field_key: 'early', label: 'Early', field_type: 'text', sort_order: -1 },
            ],
        });
        const { result } = renderHook(() => useInventoryCustomColumns(state));
        expect(result.current.map((c) => c.key)).toEqual(['early', 'none', 'late']);
        expect(result.current[1]).toMatchObject({ filterable: true, sortable: true });
    });
});

describe('Feature: Grid formatting of Class B values', () => {
    it('then booleans, arrays and object shapes format for display', () => {
        expect(formatCustomFieldValue(false)).toBe('No');
        expect(formatCustomFieldValue(true)).toBe('Yes');
        expect(formatCustomFieldValue(['x', 2])).toBe('x, 2');
        expect(formatCustomFieldValue({ label: 'L' })).toBe('L');
        expect(formatCustomFieldValue({ name: 'N' })).toBe('N');
        expect(formatCustomFieldValue({ display: 'D' })).toBe('D');
        expect(formatCustomFieldValue({ id: 'I' })).toBe('I');
        expect(formatCustomFieldValue({ foo: 1 })).toBe('{"foo":1}');
        expect(formatCustomFieldValue('')).toBe('—');
    });
});
