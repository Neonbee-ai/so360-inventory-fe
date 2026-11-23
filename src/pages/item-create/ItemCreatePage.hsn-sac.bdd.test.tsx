import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockCreateItem = vi.fn();
const mockNavigate = vi.fn();
const mockWarn = vi.fn();
let flagOn = true;
const asked: string[] = [];

vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getSettings: vi.fn().mockResolvedValue({ categories: [], uoms: [] }),
    getLocations: vi.fn().mockResolvedValue([]),
    getTaxCodes: vi.fn().mockResolvedValue([]),
    createItem: (...a: any[]) => mockCreateItem(...a),
    getAttributeDefinitions: vi.fn().mockResolvedValue([]),
    getNumberingSettings: vi.fn().mockResolvedValue({ sku: { enabled: true } }),
    getNextNumber: vi.fn().mockResolvedValue({ number: 'SKU-00001' }),
  },
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/inventory/items/new', search: '', hash: '' }),
}));
vi.mock('../../utils/formatters', () => ({ useInventoryCurrencySymbol: () => '$' }));
vi.mock('@so360/shell-context', () => ({
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: () => ({ isFeatureEnabled: (k: string) => { asked.push(k); return flagOn; } }),
}));
vi.mock('@so360/design-system', async (orig) => {
  const mod: any = await orig();
  return { ...mod, toast: { ...mod.toast, warning: (...a: any[]) => mockWarn(...a) } };
});
vi.mock('./components/TabNavigation', () => ({
  __esModule: true,
  default: ({ onTabChange }: any) => (
    <div>{['basic', 'category', 'pricing'].map((t) => <button key={t} data-testid={`tab-${t}`} onClick={() => onTabChange(t)}>{t}</button>)}</div>
  ),
}));
vi.mock('./tabs/BasicInfoTab', () => ({
  __esModule: true,
  default: ({ name, sku, unit_id, updateField }: any) => (
    <div>
      <input data-testid="item-name" value={name} onChange={(e) => updateField('name', e.target.value)} />
      <input data-testid="item-sku" value={sku} onChange={(e) => updateField('sku', e.target.value)} />
      <input data-testid="item-unit" value={unit_id} onChange={(e) => updateField('unit_id', e.target.value)} />
    </div>
  ),
}));
vi.mock('./tabs/CategoryTab', () => ({
  __esModule: true,
  default: ({ category_id, updateField }: any) => <input data-testid="item-category" value={category_id} onChange={(e) => updateField('category_id', e.target.value)} />,
}));
vi.mock('./tabs/PricingTab', () => ({
  __esModule: true,
  default: (p: any) => (
    <div data-testid="pricing-tab" data-master={String(p.hsnSacMaster)} data-type={p.itemType}>
      <button data-testid="set-hsn" onClick={() => { p.updateField('hsn_code', '9403'); p.updateField('hsn_sac_kind', 'goods'); }}>set</button>
    </div>
  ),
}));
vi.mock('./tabs/MediaTab', () => ({ __esModule: true, default: () => <div /> }));
vi.mock('./tabs/StockTrackingTab', () => ({ __esModule: true, default: () => <div /> }));
vi.mock('./tabs/ShippingTab', () => ({ __esModule: true, default: () => <div /> }));
vi.mock('./tabs/AttributesTab', () => ({ __esModule: true, default: () => <div /> }));

import ItemCreatePage from './ItemCreatePage';

async function fillAndSave(withHsn: boolean) {
  render(<ItemCreatePage />);
  await waitFor(() => screen.getByTestId('item-name'));
  fireEvent.change(screen.getByTestId('item-name'), { target: { value: 'Test Widget' } });
  fireEvent.change(screen.getByTestId('item-sku'), { target: { value: 'TW-001' } });
  fireEvent.change(screen.getByTestId('item-unit'), { target: { value: 'uom-1' } });
  fireEvent.click(screen.getByTestId('tab-category'));
  fireEvent.change(screen.getByTestId('item-category'), { target: { value: 'cat-1' } });
  if (withHsn) {
    fireEvent.click(screen.getByTestId('tab-pricing'));
    fireEvent.click(screen.getByTestId('set-hsn'));
  }
  fireEvent.click(screen.getByTestId('tab-basic'));
  await waitFor(() => expect(screen.getAllByText('Save Item')[0]).not.toBeDisabled());
  fireEvent.click(screen.getAllByText('Save Item')[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  asked.length = 0;
  flagOn = true;
  mockCreateItem.mockResolvedValue({ id: 'item-new' });
});

describe('ItemCreatePage — HSN/SAC master flag', () => {
  it('Given the flag is on / When the pricing tab shows / Then the picker mode is enabled with the item type', async () => {
    render(<ItemCreatePage />);
    await waitFor(() => screen.getByTestId('tab-pricing'));
    fireEvent.click(screen.getByTestId('tab-pricing'));
    expect(screen.getByTestId('pricing-tab').getAttribute('data-master')).toBe('true');
    expect(asked).toContain('submodule:accounting:hsn_sac_master');
  });
  it('Given the flag is off / Then the free-text mode stays', async () => {
    flagOn = false;
    render(<ItemCreatePage />);
    await waitFor(() => screen.getByTestId('tab-pricing'));
    fireEvent.click(screen.getByTestId('tab-pricing'));
    expect(screen.getByTestId('pricing-tab').getAttribute('data-master')).toBe('false');
  });
  it('Given the flag is on and a kind + code are chosen / When saved / Then both go to the API', async () => {
    await fillAndSave(true);
    await waitFor(() => expect(mockCreateItem).toHaveBeenCalledWith(expect.objectContaining({ hsn_code: '9403', hsn_sac_kind: 'goods' })));
  });
  it('Given the flag is off and a code is typed / When saved / Then hsn_sac_kind is not sent', async () => {
    flagOn = false;
    await fillAndSave(true);
    await waitFor(() => expect(mockCreateItem).toHaveBeenCalled());
    const dto = mockCreateItem.mock.calls[0][0];
    expect(dto.hsn_code).toBe('9403');
    expect(dto).not.toHaveProperty('hsn_sac_kind');
  });
  it('Given the server saved without checking the code / Then the warning is shown and the user still lands on the item', async () => {
    mockCreateItem.mockResolvedValue({ id: 'item-new', hsn_validation_warning: 'Could not check the code.' });
    await fillAndSave(true);
    await waitFor(() => expect(mockWarn).toHaveBeenCalledWith('Could not check the code.'));
    expect(mockNavigate).toHaveBeenCalledWith('/inventory/items/item-new');
  });
  it('Given no warning from the server / Then no warning toast is shown', async () => {
    await fillAndSave(true);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/inventory/items/item-new'));
    expect(mockWarn).not.toHaveBeenCalled();
  });
});
