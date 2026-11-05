import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import ItemCreatePage from './ItemCreatePage';

const started: string[] = [];
const never = (name: string) => () => { started.push(name); return new Promise(() => {}); };

vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getSettings: () => never('settings')(),
    getLocations: () => never('locations')(),
    getNumberingSettings: () => never('numbering')(),
    getTaxCodes: () => never('taxCodes')(),
    checkSkuAvailable: vi.fn().mockResolvedValue({ available: true }),
    getAttributeDefinitions: vi.fn().mockResolvedValue([]),
    createItem: vi.fn(),
  },
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/inventory/items/new', search: '', hash: '' }),
}));
vi.mock('../../utils/formatters', () => ({ useInventoryCurrencySymbol: () => '$' }));
vi.mock('@so360/shell-context', () => ({ useActivity: () => ({ recordActivity: vi.fn() }) }));

describe('ItemCreatePage - setup data loads in parallel (BDD)', () => {
  beforeEach(() => { started.length = 0; });

  it('Given all setup calls are slow, When the page mounts, Then every call starts without waiting for the others', () => {
    render(<ItemCreatePage />);
    expect(started).toEqual(expect.arrayContaining(['settings', 'locations', 'numbering', 'taxCodes']));
  });
});
