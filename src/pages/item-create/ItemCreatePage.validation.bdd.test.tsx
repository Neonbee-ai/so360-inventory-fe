/**
 * BDD specs: Item master minimum-information rules.
 *
 * The reported defect: items saved and shown as Active with `*&**HKJ` as a
 * name, `L:OU+*&%^*&` as a SKU, `kjhjfhdsraeraz` as a barcode, "Unit: Not Set"
 * and "Category: Uncategorized" — while the item's own lifecycle panel listed
 * unmet activation requirements.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetSettings = vi.fn();
const mockGetLocations = vi.fn();
const mockGetTaxCodes = vi.fn();
const mockCreateItem = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../services/inventoryService', () => ({
    inventoryService: {
        getSettings: (...a: any[]) => mockGetSettings(...a),
        getLocations: (...a: any[]) => mockGetLocations(...a),
        getTaxCodes: (...a: any[]) => mockGetTaxCodes(...a),
        createItem: (...a: any[]) => mockCreateItem(...a),
        createCategory: vi.fn(),
        createUom: vi.fn(),
        getAttributeDefinitions: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('../../utils/formatters', () => ({ useInventoryCurrencySymbol: () => '$' }));
vi.mock('@so360/shell-context', () => ({
    useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
}));

// Stubs expose only the fields these specs drive, and echo back the errors the
// page hands down so the assertions read the real error map, not a copy.
vi.mock('./components/TabNavigation', () => ({
    __esModule: true,
    default: ({ onTabChange }: any) => (
        <div>
            {['basic', 'category'].map((tab) => (
                <button key={tab} data-testid={`tab-${tab}`} onClick={() => onTabChange(tab)}>
                    {tab}
                </button>
            ))}
        </div>
    ),
}));

vi.mock('./tabs/BasicInfoTab', () => ({
    __esModule: true,
    default: ({ name, sku, unit_id, barcode, brand, updateField, errors, showErrors }: any) => (
        <div>
            {['name', 'sku', 'unit_id', 'barcode', 'brand'].map((field) => (
                <input
                    key={field}
                    data-testid={`field-${field}`}
                    value={{ name, sku, unit_id, barcode, brand }[field as string]}
                    onChange={(e) => updateField(field, e.target.value)}
                />
            ))}
            {showErrors &&
                Object.entries(errors || {}).map(([field, message]) =>
                    message ? (
                        <p key={field} data-testid={`error-${field}`}>
                            {message as string}
                        </p>
                    ) : null,
                )}
        </div>
    ),
}));

vi.mock('./tabs/CategoryTab', () => ({
    __esModule: true,
    default: ({ category_id, updateField, error }: any) => (
        <div>
            <input
                data-testid="field-category_id"
                value={category_id}
                onChange={(e) => updateField('category_id', e.target.value)}
            />
            {error && <p data-testid="error-category_id">{error}</p>}
        </div>
    ),
}));

vi.mock('./tabs/MediaTab', () => ({ __esModule: true, default: () => null }));
vi.mock('./tabs/PricingTab', () => ({ __esModule: true, default: () => null }));
vi.mock('./tabs/StockTrackingTab', () => ({ __esModule: true, default: () => null }));
vi.mock('./tabs/ShippingTab', () => ({ __esModule: true, default: () => null }));
vi.mock('./tabs/AttributesTab', () => ({ __esModule: true, default: () => null }));

import ItemCreatePage from './ItemCreatePage';

const save = () => fireEvent.click(screen.getAllByText('Save Item')[0]);

const setField = (field: string, value: string) =>
    fireEvent.change(screen.getByTestId(`field-${field}`), { target: { value } });

const setCategory = (value: string) => {
    fireEvent.click(screen.getByTestId('tab-category'));
    fireEvent.change(screen.getByTestId('field-category_id'), { target: { value } });
    fireEvent.click(screen.getByTestId('tab-basic'));
};

const renderReady = async () => {
    render(<ItemCreatePage />);
    await waitFor(() => expect(mockGetTaxCodes).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByText('Save Item')[0]).not.toBeDisabled());
};

const fillValidItem = () => {
    setField('name', 'Office Chair');
    setField('sku', 'CHAIR-BLK-01');
    setField('unit_id', 'uom-each');
    setCategory('cat-furniture');
};

beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({ categories: [], uoms: [] });
    mockGetLocations.mockResolvedValue([]);
    mockGetTaxCodes.mockResolvedValue([{ id: 'tax-1', name: 'Standard' }]);
    mockCreateItem.mockResolvedValue({ id: 'item-new' });
});

describe('Given the minimum information an item needs', () => {
    it('Given every mandatory field is blank / When saved / Then each is reported and nothing is created', async () => {
        await renderReady();
        save();

        await waitFor(() =>
            expect(screen.getByTestId('error-name')).toHaveTextContent('Item Name is required.'),
        );
        expect(screen.getByTestId('error-sku')).toHaveTextContent('SKU is required.');
        expect(screen.getByTestId('error-unit_id')).toHaveTextContent(
            'Unit of Measure is required.',
        );
        expect(mockCreateItem).not.toHaveBeenCalled();
    });

    it('Given no category is chosen / When saved / Then the category tab reports it', async () => {
        await renderReady();
        setField('name', 'Office Chair');
        setField('sku', 'CHAIR-BLK-01');
        setField('unit_id', 'uom-each');
        save();

        fireEvent.click(screen.getByTestId('tab-category'));
        await waitFor(() =>
            expect(screen.getByTestId('error-category_id')).toHaveTextContent(
                'Please select a category.',
            ),
        );
        expect(mockCreateItem).not.toHaveBeenCalled();
    });

    it('Given a complete item / When saved / Then SKU, unit and category all reach the API', async () => {
        await renderReady();
        fillValidItem();
        save();

        await waitFor(() =>
            expect(mockCreateItem).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Office Chair',
                    sku: 'CHAIR-BLK-01',
                    unit_id: 'uom-each',
                    category_id: 'cat-furniture',
                    type: 'product',
                }),
            ),
        );
    });

    it('Given a complete item / When creation succeeds / Then the browser moves to the new item', async () => {
        await renderReady();
        fillValidItem();
        save();

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('/inventory/items/item-new'),
        );
    });
});

describe('Given the reported junk item values', () => {
    it.each([
        ['name', '*&**HKJ', 'Item Name contains invalid characters.'],
        ['sku', 'L:OU+*&%^*&', 'SKU may contain only letters, numbers, hyphens and underscores.'],
        ['barcode', 'kjhjfhdsraeraz', 'Enter a valid barcode (digits only).'],
        ['brand', 'U(^(^(^', 'Brand contains invalid characters.'],
    ])(
        'Given %s set to %s / When saved / Then it is rejected beside its field',
        async (field, value, message) => {
            await renderReady();
            fillValidItem();
            setField(field, value);
            save();

            await waitFor(() =>
                expect(screen.getByTestId(`error-${field}`)).toHaveTextContent(message),
            );
            expect(mockCreateItem).not.toHaveBeenCalled();
        },
    );

    it('Given a numeric-only item name / When saved / Then letters are demanded', async () => {
        await renderReady();
        fillValidItem();
        setField('name', '123456');
        save();

        await waitFor(() =>
            expect(screen.getByTestId('error-name')).toHaveTextContent(
                'Item Name must contain letters, not only numbers or symbols.',
            ),
        );
    });

    it('Given a valid EAN-13 barcode and brand / When saved / Then both reach the API', async () => {
        await renderReady();
        fillValidItem();
        setField('barcode', '8901234567890');
        setField('brand', 'Apple');
        save();

        await waitFor(() =>
            expect(mockCreateItem).toHaveBeenCalledWith(
                expect.objectContaining({ barcode: '8901234567890', brand: 'Apple' }),
            ),
        );
    });

    it('Given barcode and brand left blank / When saved / Then they do not block the save', async () => {
        await renderReady();
        fillValidItem();
        save();

        await waitFor(() => expect(mockCreateItem).toHaveBeenCalled());
        expect(mockCreateItem.mock.calls[0][0]).not.toHaveProperty('barcode');
        expect(mockCreateItem.mock.calls[0][0]).not.toHaveProperty('brand');
    });
});
