import React from 'react';
import { render, renderHook, screen } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';

/**
 * Neonbee Data Layer (Class B) — Inventory side contract.
 * The Shell owns renderers + the slot registry; Inventory only declares layouts,
 * places slots, and hands renderers entity + record + version context.
 */

// One mutable state object, read lazily by the mock factories (vi.mock hoisting).
const dl = vi.hoisted(() => ({
    flag: true,
    isAdmin: false,
    fields: [] as any[],
    regs: [] as any[],
    layouts: {} as Record<string, any>,
    slotCalls: [] as any[],
}));

const api = vi.hoisted(() => ({
    inventory: { updateItem: vi.fn() },
}));

vi.mock('../services/inventoryService', () => ({
    inventoryService: api.inventory,
}));

function Probe(props: any) {
    return (
        <div
            data-testid={`probe-${props.slot}-${props.registration.id}`}
            data-entity={props.datasetCode}
            data-record-id={props.recordId}
            data-version={String(props.version)}
            data-save-mode={props.saveMode}
            data-mode={props.mode ?? ''}
        />
    );
}

vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({
        effectiveFlagsLoaded: true,
        isAdmin: dl.isAdmin,
        isFeatureEnabled: (k: string) => (k === 'submodule:data_layer:custom_fields' ? dl.flag : true),
    }),
    useDatasetSchema: () => ({ fields: dl.fields }),
    useSlotRenderers: (code: string, slot: string, opts: any) => {
        dl.slotCalls.push({ code, slot, opts });
        return dl.regs
            .filter((r) => r.dataset_code === code && r.slot === slot)
            .map((r) => ({ registration: r, Renderer: r.renderer === 'missing' ? null : Probe, key: r.id }));
    },
    registerRecordLayout: (def: any) => {
        dl.layouts[def.entity] = def;
        return () => { delete dl.layouts[def.entity]; };
    },
    getRecordLayout: (entity: string) => dl.layouts[entity] ?? null,
}));

import {
    resolveDataLayerApi, ensureInventoryRecordLayouts, isDlVisible, useInventoryDataLayer, useInventorySlot,
    useInventoryCustomColumns, InventorySlotRegion, InventoryRecordScope, InventoryCreateSection, useInventoryInjectedTabs,
    missingRequiredCustomFields, formatCustomFieldValue, isDataLayerAvailable, DATA_LAYER_CUSTOM_FIELDS_FLAG,
} from './inventoryDataLayer';
import { saveClassBCustomFields, currentClassBValues, recordVersion, wireVersion, isVersionConflict } from './classBSave';

beforeEach(() => {
    dl.flag = true;
    dl.isAdmin = false;
    dl.fields = [];
    dl.regs = [];
    dl.layouts = {};
    dl.slotCalls = [];
    api.inventory.updateItem.mockReset();
});

const reg = (over: any) => ({ id: 'r1', dataset_code: 'inventory.item', slot: 'detail.section', renderer: 'custom_fields', ...over });
const ctx = { recordId: 'item-1', record: { id: 'item-1', custom_fields: {} }, version: 7, canEdit: true };

describe('Given the flag key', () => {
    test('When read / Then it is the spec flag submodule:data_layer:custom_fields', () => {
        expect(DATA_LAYER_CUSTOM_FIELDS_FLAG).toBe('submodule:data_layer:custom_fields');
    });
});

describe('Given capability detection of the shell-context dataLayer API', () => {
    test('When the Shell exposes the API / Then it is available', () => {
        expect(isDataLayerAvailable()).toBe(true);
    });
    test('When an older Shell lacks the exports / Then the API resolves to null', () => {
        expect(resolveDataLayerApi({ useShellBridge: () => ({}) })).toBeNull();
        expect(resolveDataLayerApi(null)).toBeNull();
    });
    test('When an export exists but is not a function / Then the API resolves to null', () => {
        expect(resolveDataLayerApi({ useSlotRenderers: 1, registerRecordLayout: vi.fn(), getRecordLayout: vi.fn(), useDatasetSchema: vi.fn() })).toBeNull();
    });
});

describe('Given the Inventory record layouts', () => {
    test('When ensured / Then inventory.item is registered with a History tab', () => {
        expect(ensureInventoryRecordLayouts()).toBe(true);
        for (const entity of ['inventory.item']) {
            const def = dl.layouts[entity];
            expect(def.entity).toBe(entity);
            expect(def.regions).toMatchObject({ main: true, sidebar: true, tabs: true, actions: true });
            expect(def.tabOrder).toContain('history');
            expect(def.slots).toEqual(expect.arrayContaining(['detail.section', 'detail.sidebar', 'detail.tab', 'create.section', 'list.column']));
        }
    });
    test('When ensured twice / Then an existing registration is not replaced', () => {
        dl.layouts['inventory.item'] = { entity: 'inventory.item', marker: 'shell-owned' };
        ensureInventoryRecordLayouts();
        expect(dl.layouts['inventory.item'].marker).toBe('shell-owned');
    });
    test('When the API is unavailable / Then nothing is registered', () => {
        expect(ensureInventoryRecordLayouts(null)).toBe(false);
    });
    test('When useInventoryDataLayer mounts with the flag on / Then layouts are registered', () => {
        renderHook(() => useInventoryDataLayer('inventory.item'));
        expect(dl.layouts['inventory.item']).toBeTruthy();
    });
    test('When useInventoryDataLayer mounts with the flag off / Then no layout is registered', () => {
        dl.flag = false;
        renderHook(() => useInventoryDataLayer('inventory.item'));
        expect(dl.layouts['inventory.item']).toBeUndefined();
    });
});

describe('Given visibility_profile rules', () => {
    test('When profile values vary / Then they mirror the Shell rule', () => {
        expect(isDlVisible(undefined, 'internal', false)).toBe(true);
        expect(isDlVisible('all', 'internal', false)).toBe(true);
        expect(isDlVisible('hidden', 'admin', true)).toBe(false);
        expect(isDlVisible('admin', 'internal', false)).toBe(false);
        expect(isDlVisible('admin', 'admin', true)).toBe(true);
        expect(isDlVisible('internal', 'internal', false)).toBe(true);
        expect(isDlVisible('portal', 'internal', false)).toBe(false);
        expect(isDlVisible('portal', 'portal', false)).toBe(true);
    });
    test('When a registration is hidden / Then useInventorySlot drops it even if the Shell returned it', () => {
        dl.regs = [reg({ id: 'a' }), reg({ id: 'b', visibility_profile: 'hidden' })];
        const { result } = renderHook(() => useInventorySlot(useInventoryDataLayer('inventory.item'), 'detail.section'));
        expect(result.current.map((r) => r.key)).toEqual(['a']);
    });
    test('When a user is not admin / Then admin-only registrations are dropped and profile=internal is sent', () => {
        dl.regs = [reg({ id: 'a', visibility_profile: 'admin' })];
        const { result } = renderHook(() => useInventorySlot(useInventoryDataLayer('inventory.item'), 'detail.section'));
        expect(result.current).toEqual([]);
        expect(dl.slotCalls.at(-1).opts).toEqual({ profile: 'internal', isAdmin: false });
    });
    test('When the user is an admin / Then admin-only registrations show and profile=admin is sent', () => {
        dl.isAdmin = true;
        dl.regs = [reg({ id: 'a', visibility_profile: 'admin' })];
        const { result } = renderHook(() => useInventorySlot(useInventoryDataLayer('inventory.item'), 'detail.section'));
        expect(result.current.map((r) => r.key)).toEqual(['a']);
        expect(dl.slotCalls.at(-1).opts).toEqual({ profile: 'admin', isAdmin: true });
    });
    test('When a registration has no Renderer / Then it is skipped', () => {
        dl.regs = [reg({ id: 'a', renderer: 'missing' })];
        const { result } = renderHook(() => useInventorySlot(useInventoryDataLayer('inventory.item'), 'detail.section'));
        expect(result.current).toEqual([]);
    });
    test('When hidden schema fields exist / Then they are excluded from the entity fields', () => {
        dl.fields = [{ field_key: 'a', label: 'A', field_type: 'text' }, { field_key: 'h', label: 'H', field_type: 'text', visibility_profile: 'hidden' }];
        const { result } = renderHook(() => useInventoryDataLayer('inventory.item'));
        expect(result.current.fields.map((f) => f.field_key)).toEqual(['a']);
    });
});

describe('Given InventorySlotRegion', () => {
    function Host({ slot = 'detail.section' as any }) {
        const state = useInventoryDataLayer('inventory.item');
        return <InventorySlotRegion dl={state} slot={slot} region="main" ctx={ctx} />;
    }
    test('When the flag is off / Then it renders nothing', () => {
        dl.flag = false;
        dl.regs = [reg({})];
        const { container } = render(<Host />);
        expect(container.innerHTML).toBe('');
    });
    test('When the flag is on but nothing is registered / Then it renders nothing', () => {
        const { container } = render(<Host />);
        expect(container.innerHTML).toBe('');
    });
    test('When a renderer is registered / Then it receives entity, record id and version with native save mode', () => {
        dl.regs = [reg({})];
        const { container } = render(<Host />);
        const region = container.querySelector('[data-dl-slot="detail.section"]')!;
        expect(region.getAttribute('data-dl-entity')).toBe('inventory.item');
        expect(region.getAttribute('data-dl-record-id')).toBe('item-1');
        expect(region.getAttribute('data-region')).toBe('main');
        const probe = screen.getByTestId('probe-detail.section-r1');
        expect(probe.getAttribute('data-entity')).toBe('inventory.item');
        expect(probe.getAttribute('data-record-id')).toBe('item-1');
        expect(probe.getAttribute('data-version')).toBe('7');
        expect(probe.getAttribute('data-save-mode')).toBe('native');
    });
    test('When registrations belong to another entity / Then they are not rendered', () => {
        dl.regs = [reg({ dataset_code: 'crm.deal' })];
        const { container } = render(<Host />);
        expect(container.innerHTML).toBe('');
    });
});

describe('Given InventoryRecordScope', () => {
    function Host() {
        const state = useInventoryDataLayer('inventory.item');
        return <InventoryRecordScope dl={state} recordId="item-1"><p>native</p></InventoryRecordScope>;
    }
    test('When disabled / Then children render with no wrapper', () => {
        dl.flag = false;
        dl.regs = [reg({})];
        const { container } = render(<Host />);
        expect(container.innerHTML).toBe('<p>native</p>');
    });
    test('When enabled without any detail registration / Then children render with no wrapper', () => {
        const { container } = render(<Host />);
        expect(container.innerHTML).toBe('<p>native</p>');
    });
    test('When enabled with a registration / Then the page is marked with the entity layout', () => {
        dl.regs = [reg({ slot: 'detail.sidebar' })];
        const { container } = render(<Host />);
        const scope = container.querySelector('[data-record-layout="inventory.item"]')!;
        expect(scope.getAttribute('data-record-id')).toBe('item-1');
        expect(scope.textContent).toBe('native');
    });
});

describe('Given detail.tab registrations', () => {
    test('When resolved / Then each becomes a dl:-prefixed injected tab rendering the Shell renderer', () => {
        dl.regs = [reg({ id: 'hist', slot: 'detail.tab', renderer: 'field_history', label: 'History' })];
        const { result } = renderHook(() => useInventoryInjectedTabs(useInventoryDataLayer('inventory.item'), ctx));
        expect(result.current.map((t) => [t.id, t.label])).toEqual([['dl:hist', 'History']]);
        render(<>{result.current[0].render()}</>);
        expect(screen.getByTestId('probe-detail.tab-hist').getAttribute('data-record-id')).toBe('item-1');
    });
    test('When the flag is off / Then there are no injected tabs', () => {
        dl.flag = false;
        dl.regs = [reg({ id: 'hist', slot: 'detail.tab' })];
        const { result } = renderHook(() => useInventoryInjectedTabs(useInventoryDataLayer('inventory.item'), ctx));
        expect(result.current).toEqual([]);
    });
});

describe('Given InventoryCreateSection in a native form', () => {
    function Host({ mode = 'create' as 'create' | 'edit' }) {
        const state = useInventoryDataLayer('inventory.item');
        return <InventoryCreateSection dl={state} mode={mode} values={{}} onValuesChange={() => {}} />;
    }
    test('When the flag is off / Then no inputs are injected', () => {
        dl.flag = false;
        dl.regs = [reg({ dataset_code: 'inventory.item', slot: 'create.section' })];
        const { container } = render(<Host />);
        expect(container.innerHTML).toBe('');
    });
    test('When a create.section renderer exists / Then it renders in create mode with native save', () => {
        dl.regs = [reg({ dataset_code: 'inventory.item', slot: 'create.section' })];
        render(<Host />);
        const probe = screen.getByTestId('probe-create.section-r1');
        expect(probe.getAttribute('data-mode')).toBe('create');
        expect(probe.getAttribute('data-entity')).toBe('inventory.item');
        expect(probe.getAttribute('data-save-mode')).toBe('native');
    });
    test('When required custom fields are empty / Then they are reported as missing', () => {
        dl.fields = [
            { field_key: 'vin', label: 'VIN', field_type: 'text', required: true },
            { field_key: 'km', label: 'KM', field_type: 'number', required: true },
            { field_key: 'opt', label: 'Opt', field_type: 'text' },
        ];
        const { result } = renderHook(() => useInventoryDataLayer('inventory.item'));
        expect(missingRequiredCustomFields(result.current, { vin: '  ', km: 12 })).toEqual(['vin']);
    });
    test('When the data layer is disabled / Then nothing is reported missing', () => {
        dl.flag = false;
        dl.fields = [{ field_key: 'vin', label: 'VIN', field_type: 'text', required: true }];
        const { result } = renderHook(() => useInventoryDataLayer('inventory.item'));
        expect(missingRequiredCustomFields(result.current, {})).toEqual([]);
    });
});

describe('Given list custom-field columns', () => {
    beforeEach(() => {
        dl.fields = [
            { field_key: 'plate', label: 'Plate', field_type: 'text', indexed: true, sort_order: 2 },
            { field_key: 'colour', label: 'Colour', field_type: 'text', sort_order: 1 },
            { field_key: 'secret', label: 'Secret', field_type: 'text', indexed: true, visibility_profile: 'hidden' },
        ];
    });
    test('When the flag is on / Then visible fields become columns in sort order', () => {
        const { result } = renderHook(() => useInventoryCustomColumns(useInventoryDataLayer('inventory.item')));
        expect(result.current.map((c) => c.key)).toEqual(['colour', 'plate']);
    });
    test('When a field is indexed / Then it is filterable and sortable; otherwise display-only', () => {
        const { result } = renderHook(() => useInventoryCustomColumns(useInventoryDataLayer('inventory.item')));
        const byKey = Object.fromEntries(result.current.map((c) => [c.key, c]));
        expect(byKey.plate).toMatchObject({ filterable: true, sortable: true });
        expect(byKey.colour).toMatchObject({ filterable: false, sortable: false });
    });
    test('When the flag is off / Then there are no custom columns', () => {
        dl.flag = false;
        const { result } = renderHook(() => useInventoryCustomColumns(useInventoryDataLayer('inventory.item')));
        expect(result.current).toEqual([]);
    });
    test('When values are formatted / Then they are display strings', () => {
        expect(formatCustomFieldValue(null)).toBe('—');
        expect(formatCustomFieldValue(true)).toBe('Yes');
        expect(formatCustomFieldValue(['a', 2])).toBe('a, 2');
        expect(formatCustomFieldValue({ label: 'Red' })).toBe('Red');
        expect(formatCustomFieldValue(42)).toBe('42');
    });
});

describe('Given the Class B native save path', () => {
    const httpError = (status: number, body: any) => Object.assign(new Error(body?.message ?? `HTTP ${status}`), { status, body, code: body?.code });

    test('When an item saves / Then only the changed keys are PATCHed via inventoryService.updateItem (backend merges)', async () => {
        api.inventory.updateItem.mockResolvedValue({ id: 'item-1', custom_fields: { a: 1, b: 2 }, custom_fields_version: 2 });
        const res = await saveClassBCustomFields('item-1', { id: 'item-1', custom_fields: { a: 1 }, custom_fields_version: 1 }, { b: 2 });
        expect(api.inventory.updateItem).toHaveBeenCalledWith('item-1', { custom_fields: { b: 2 }, version: 1 });
        expect(res.ok).toBe(true);
        expect(res.record?.custom_fields).toEqual({ a: 1, b: 2 });
        expect(res.record?.custom_fields_version).toBe(2);
    });
    test('When the API wraps the row in { data } / Then the saved row is unwrapped', async () => {
        api.inventory.updateItem.mockResolvedValue({ data: { id: 'item-1', custom_fields: { a: 9 }, custom_fields_version: 5 } });
        const res = await saveClassBCustomFields('item-1', { id: 'item-1', custom_fields: { a: 1 } }, { a: 9 });
        expect(res.record).toMatchObject({ id: 'item-1', custom_fields: { a: 9 }, custom_fields_version: 5 });
    });
    test('When the saved row omits custom_fields / Then the locally merged values are kept', async () => {
        api.inventory.updateItem.mockResolvedValue({ id: 'item-1', custom_fields_version: 6 });
        const res = await saveClassBCustomFields('item-1', { id: 'item-1', custom_fields: { a: 1 } }, { b: 2 });
        expect(res.record).toMatchObject({ custom_fields_version: 6, custom_fields: { a: 1, b: 2 } });
    });
    test('When the item has no custom_fields yet / Then only the changed keys are sent', async () => {
        api.inventory.updateItem.mockResolvedValue(null);
        const res = await saveClassBCustomFields('item-1', null, { z: 3 });
        expect(api.inventory.updateItem).toHaveBeenCalledWith('item-1', { custom_fields: { z: 3 } });
        expect(res.record?.custom_fields).toEqual({ z: 3 });
    });
    test('When the item has product-type custom_attributes / Then the save never sends them', async () => {
        api.inventory.updateItem.mockResolvedValue(null);
        await saveClassBCustomFields('item-1', { id: 'item-1', custom_attributes: { size: 'L' }, custom_fields: {} }, { z: 3 });
        expect(api.inventory.updateItem.mock.calls[0][1]).toEqual({ custom_fields: { z: 3 } });
    });
    test('When an explicit version is passed / Then it wins over the row version', async () => {
        api.inventory.updateItem.mockResolvedValue({ id: 'item-1', custom_fields: { b: 2 } });
        await saveClassBCustomFields('item-1', { custom_fields: {}, custom_fields_version: 4 }, { b: 2 }, 8);
        expect(api.inventory.updateItem).toHaveBeenCalledWith('item-1', { custom_fields: { b: 2 }, version: 8 });
    });
    test('When only updated_at is available / Then no version is sent', async () => {
        api.inventory.updateItem.mockResolvedValue({ id: 'item-1', custom_fields: { b: 2 } });
        await saveClassBCustomFields('item-1', { custom_fields: {}, updated_at: '2026-09-30T08:00:00Z' }, { b: 2 });
        expect(api.inventory.updateItem).toHaveBeenCalledWith('item-1', { custom_fields: { b: 2 } });
    });
    test('When a value is cleared / Then null is sent and the key is dropped locally', async () => {
        api.inventory.updateItem.mockResolvedValue({ id: 'item-1' });
        const res = await saveClassBCustomFields('item-1', { custom_fields: { a: 1, b: 2 } }, { b: null });
        expect(api.inventory.updateItem).toHaveBeenCalledWith('item-1', { custom_fields: { b: null } });
        expect(res.record?.custom_fields).toEqual({ a: 1 });
    });
    test('When the backend answers 409 DATASET_VERSION_CONFLICT / Then the result is a conflict, not a thrown error', async () => {
        api.inventory.updateItem.mockRejectedValue(httpError(409, { code: 'DATASET_VERSION_CONFLICT', message: 'Record changed' }));
        const res = await saveClassBCustomFields('item-1', { custom_fields: {}, custom_fields_version: 3 }, { b: 2 });
        expect(res).toMatchObject({ ok: false, conflict: true });
    });
    test('When the backend answers 400 DATASET_FIELD_UNKNOWN / Then its message is returned verbatim', async () => {
        api.inventory.updateItem.mockRejectedValue(httpError(400, { code: 'DATASET_FIELD_UNKNOWN', message: 'Unknown custom field "colour"' }));
        const res = await saveClassBCustomFields('item-1', {}, { colour: 'red' });
        expect(res).toEqual({ ok: false, error: 'Unknown custom field "colour"' });
    });
    test('When the native API fails / Then the result is not ok with the error message', async () => {
        api.inventory.updateItem.mockRejectedValue(new Error('boom'));
        const res = await saveClassBCustomFields('item-1', {}, { y: 2 });
        expect(res).toEqual({ ok: false, error: 'boom' });
    });
    test('When reading current values / Then only an object custom_fields counts', () => {
        expect(currentClassBValues({ custom_fields: { a: 1 } })).toEqual({ a: 1 });
        expect(currentClassBValues({ custom_fields: [1] })).toEqual({});
        expect(currentClassBValues(null)).toEqual({});
    });
    test('When deriving the version / Then custom_fields_version wins over updated_at', () => {
        expect(recordVersion({ custom_fields_version: 3, updated_at: 't' })).toBe(3);
        expect(recordVersion({ updated_at: 't' })).toBe('t');
        expect(recordVersion(null)).toBeNull();
    });
    test('When deriving the wire version / Then only integers (or digit strings) are sent', () => {
        expect(wireVersion(4)).toBe(4);
        expect(wireVersion('4')).toBe(4);
        expect(wireVersion('2026-09-30T08:00:00Z')).toBeUndefined();
        expect(wireVersion(null)).toBeUndefined();
    });
    test('When classifying errors / Then 409 or the conflict code is a version conflict', () => {
        expect(isVersionConflict({ status: 409 })).toBe(true);
        expect(isVersionConflict({ code: 'DATASET_VERSION_CONFLICT' })).toBe(true);
        expect(isVersionConflict({ status: 400, body: { code: 'DATASET_FIELD_UNKNOWN' } })).toBe(false);
    });
});
