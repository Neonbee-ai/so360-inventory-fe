import React from 'react';
import { render, renderHook } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

/**
 * Data Layer on an older Shell: shell-context exposes none of the dataLayer
 * exports (nor useShellBridge), so Inventory pages must render natively.
 */

vi.mock('@so360/shell-context', () => ({}));

import {
    isDataLayerAvailable, useInventoryDataLayer, useInventorySlot, InventorySlotRegion, InventoryCreateSection,
    useInventoryInjectedTabs, ensureInventoryRecordLayouts,
} from './inventoryDataLayer';

describe('Feature: Data layer on a Shell without the dataLayer API', () => {
    describe('Given shell-context has no dataLayer exports', () => {
        it('then the capability check reports unavailable and layouts are not registered', () => {
            // When / Then
            expect(isDataLayerAvailable()).toBe(false);
            expect(ensureInventoryRecordLayouts()).toBe(false);
        });

        it('then useInventoryDataLayer is disabled with no fields', () => {
            const { result } = renderHook(() => useInventoryDataLayer('inventory.item'));
            expect(result.current).toEqual({ enabled: false, entity: 'inventory.item', profile: 'internal', isAdmin: false, fields: [] });
        });

        it('then slots resolve empty even for a state claiming to be enabled', () => {
            const state = { enabled: true, entity: 'inventory.item' as const, profile: 'internal', isAdmin: false, fields: [] };
            const { result } = renderHook(() => useInventorySlot(state, 'detail.section'));
            expect(result.current).toEqual([]);
            const tabs = renderHook(() => useInventoryInjectedTabs(state, { recordId: 'item-1', record: null }));
            expect(tabs.result.current).toEqual([]);
            const { container } = render(
                <div>
                    <InventorySlotRegion dl={state} slot="detail.section" region="main" ctx={{ recordId: 'item-1', record: null }} />
                    <InventoryCreateSection dl={state} mode="create" values={{}} onValuesChange={vi.fn()} />
                </div>,
            );
            expect(container.firstChild?.childNodes.length).toBe(0);
        });
    });
});
