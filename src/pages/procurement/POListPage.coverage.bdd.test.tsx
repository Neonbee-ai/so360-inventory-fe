/**
 * Full-behaviour BDD suite for the Purchase Orders list page.
 *
 * The sibling `POListPage.test.tsx` covers the regression that motivated the
 * permission work; this suite exercises every remaining branch of the page —
 * fetch/permission matrix, PR conversion, the create-PO form, the table
 * renderer and the quota/feature gates — so the page is fully covered.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import React from 'react';

const h = vi.hoisted(() => {
  const shell: any = {
    permissionsLoaded: true,
    granted: ['purchase_orders.read', 'suppliers.read'],
    hasPermission: (code: string) => shell.granted.includes(code),
  };
  return {
    shell,
    getPOs: vi.fn(),
    getPRs: vi.fn(),
    getConversionPayload: vi.fn(),
    createPO: vi.fn(),
    getVendors: vi.fn(),
    navigate: vi.fn(),
    location: { pathname: '/procurement/po', state: null as any },
    recordActivity: vi.fn(),
    getQuota: vi.fn(),
    bridge: {} as any,
    settings: null as any,
    toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
  };
});

vi.mock('../../services/procurementService', () => ({
  procurementService: {
    getPOs: (...a: any[]) => h.getPOs(...a),
    getPRs: (...a: any[]) => h.getPRs(...a),
    getConversionPayload: (...a: any[]) => h.getConversionPayload(...a),
    createPO: (...a: any[]) => h.createPO(...a),
  },
}));

vi.mock('../../services/vendorService', () => ({
  vendorService: { getVendors: (...a: any[]) => h.getVendors(...a) },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => h.navigate,
  useLocation: () => h.location,
}));

vi.mock('@so360/shell-context', async () => ({
  ShellContext: (await import('react')).createContext<any>(h.shell),
  useBusinessSettings: () => ({ settings: h.settings }),
  useActivity: () => ({ recordActivity: h.recordActivity }),
  useShellBridge: () => h.bridge,
  useQuota: () => ({ getQuota: (k: string) => h.getQuota(k), isExceeded: () => false }),
}));

vi.mock('../../utils/formatters', () => ({
  useInventoryFormatters: () => ({
    formatDate: (d: string) => d ?? '',
    formatDateTime: (d: string) => d ?? '',
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    currency: 'USD',
    locale: 'en-US',
    timezone: 'UTC',
  }),
}));

/**
 * Stand-in for the item picker: exposes two picks so the page's
 * `price ?? 0` / `tax_code_id || null` fallbacks are both reachable.
 */
vi.mock('../../components/ItemSearchSelector', () => ({
  __esModule: true,
  default: ({ onSelect, selectedName }: any) => (
    <div data-testid="item-search">
      <span data-testid="item-name">{selectedName}</span>
      <button
        type="button"
        data-testid="pick-priced"
        onClick={() => onSelect({ id: 'item-1', name: 'Widget', sku: 'SKU1', price: 25, tax_code_id: 'tax-1' })}
      >
        pick priced
      </button>
      <button
        type="button"
        data-testid="pick-bare"
        onClick={() => onSelect({ id: 'item-2', name: 'Gadget', sku: 'SKU2' })}
      >
        pick bare
      </button>
    </div>
  ),
}));

vi.mock('@so360/design-system', () => ({
  toast: h.toast,
  getErrorMessage: (err: any, fallback: string) => err?.message || fallback,
  QuotaBar: ({ label, used, limit, isUnlimited }: any) => (
    <div data-testid="quota-bar">{`${label}:${used}/${limit}:${String(isUnlimited)}`}</div>
  ),
  QuotaGate: ({ children }: any) => <>{children}</>,
  FeatureGate: ({ state, loading, onUpgradeClick, children }: any) =>
    loading ? (
      <div data-testid="flags-loading">loading flags</div>
    ) : state === 'enabled' ? (
      <>{children}</>
    ) : (
      <button type="button" onClick={onUpgradeClick}>
        Upgrade
      </button>
    ),
}));

import POListPage from './POListPage';

const makePO = (overrides: any = {}) => ({
  id: 'po-1',
  po_number: 'PO-2025-0001',
  vendor: { name: 'Acme Corp' },
  status: 'sent',
  total_amount: 1500,
  po_lines: [{ quantity: 10, received_quantity: 0 }],
  created_at: '2025-01-15T00:00:00Z',
  ...overrides,
});

const makePR = (overrides: any = {}) => ({
  id: 'pr-11111111-2222',
  status: 'approved',
  pr_lines: [{ id: 'l1' }, { id: 'l2' }],
  ...overrides,
});

const forbidden = () => Object.assign(new Error('Forbidden'), { status: 403 });

let consoleErr: any;

beforeEach(() => {
  vi.clearAllMocks();
  h.shell.permissionsLoaded = true;
  h.shell.granted = ['purchase_orders.read', 'suppliers.read'];
  h.location = { pathname: '/procurement/po', state: null };
  h.settings = { base_currency: 'USD', is_tax_inclusive_pricing: false };
  h.bridge = {
    currentOrg: { id: 'org-1', name: 'Test Org' },
    effectiveFlagsLoaded: true,
    getFeatureState: () => 'enabled',
    isFeatureEnabled: () => true,
  };
  h.getPOs.mockResolvedValue([]);
  h.getVendors.mockResolvedValue([]);
  h.getPRs.mockResolvedValue([]);
  h.getQuota.mockReturnValue(null);
  h.recordActivity.mockResolvedValue(undefined);
  h.createPO.mockResolvedValue({ id: 'po-new' });
  consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErr.mockRestore();
});

const renderPage = () => render(<POListPage />);
const settled = () => waitFor(() => expect(screen.getByText('Purchase Orders')).toBeInTheDocument());
const openForm = async () => {
  await waitFor(() => expect(screen.getByText('New PO')).toBeEnabled());
  fireEvent.click(screen.getByText('New PO'));
  await waitFor(() => expect(screen.getAllByText('Create Purchase Order').length).toBeGreaterThan(0));
};
const selects = () => Array.from(document.querySelectorAll('select')) as HTMLSelectElement[];

describe('POListPage — permission-aware loading', () => {
  describe('Given a role without purchase_orders.read', () => {
    beforeEach(() => {
      h.shell.granted = [];
    });

    it('When the page loads / Then neither the PO nor the vendor API is called', async () => {
      renderPage();
      await settled();
      expect(h.getPOs).not.toHaveBeenCalled();
      expect(h.getVendors).not.toHaveBeenCalled();
    });

    it('When the page loads / Then a purchase-order permission message is shown', async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByText(/do not have permission to view purchase orders/i)).toBeInTheDocument(),
      );
      expect(screen.queryByText(/Failed to load purchase orders/i)).not.toBeInTheDocument();
    });

    it('When the PO list is denied / Then no vendor notice is shown as well', async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByText(/do not have permission to view purchase orders/i)).toBeInTheDocument(),
      );
      expect(screen.queryByText(/permission to view vendor information/i)).not.toBeInTheDocument();
    });

    it('When the create form is opened / Then requisitions are not fetched either', async () => {
      renderPage();
      await openForm();
      expect(h.getPRs).not.toHaveBeenCalled();
      expect(screen.getByText('No purchase requisitions available')).toBeInTheDocument();
    });
  });

  describe('Given the shell has not resolved permissions yet', () => {
    it('When permissionsLoaded is false / Then the page waits and shows the loading row', async () => {
      h.shell.permissionsLoaded = false;
      renderPage();
      await settled();
      expect(h.getPOs).not.toHaveBeenCalled();
      expect(screen.getByText('Loading orders...')).toBeInTheDocument();
    });
  });

  describe('Given the APIs answer with an envelope rather than a bare array', () => {
    it('When responses are { data: [...] } / Then both POs and vendors are unwrapped', async () => {
      h.getPOs.mockResolvedValue({ data: [makePO()] });
      h.getVendors.mockResolvedValue({ data: [{ id: 'v1', name: 'Vendor One' }] });
      renderPage();
      await waitFor(() => expect(screen.getByText('#PO-2025-0001')).toBeInTheDocument());
      await openForm();
      expect(screen.getByText('Vendor One')).toBeInTheDocument();
    });

    it('When responses are neither array nor envelope / Then the lists fall back to empty', async () => {
      h.getPOs.mockResolvedValue(null);
      h.getVendors.mockResolvedValue(undefined);
      renderPage();
      await waitFor(() => expect(screen.getByText('No purchase orders found.')).toBeInTheDocument());
    });
  });

  describe('Given the vendor API fails with a server error', () => {
    beforeEach(() => {
      h.getVendors.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
    });

    it('When vendors fail / Then a transient vendor notice with Retry is shown', async () => {
      h.getPOs.mockResolvedValue([makePO()]);
      renderPage();
      await waitFor(() =>
        expect(screen.getByText(/Vendor information could not be loaded/i)).toBeInTheDocument(),
      );
      expect(screen.getByText('#PO-2025-0001')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('When vendors fail genuinely / Then the failure is logged for diagnostics', async () => {
      renderPage();
      await waitFor(() => expect(consoleErr).toHaveBeenCalledWith('Failed to fetch vendors', expect.any(Error)));
    });

    it('When Retry is clicked and vendors recover / Then the notice clears', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Retry')).toBeInTheDocument());
      h.getVendors.mockResolvedValue([{ id: 'v1', name: 'Vendor One' }]);
      fireEvent.click(screen.getByText('Retry'));
      await waitFor(() =>
        expect(screen.queryByText(/Vendor information could not be loaded/i)).not.toBeInTheDocument(),
      );
    });
  });

  describe('Given requisition loading', () => {
    it('When PRs come back as an envelope / Then approved ones are still detected', async () => {
      h.getPRs.mockResolvedValue({ data: [makePR()] });
      renderPage();
      await waitFor(() => expect(screen.getByText('Convert Approved PRs')).toBeInTheDocument());
    });

    it('When PRs are denied with 403 / Then nothing is logged and the shortcut stays hidden', async () => {
      h.getPRs.mockRejectedValue(forbidden());
      renderPage();
      await settled();
      await waitFor(() => expect(h.getPRs).toHaveBeenCalled());
      expect(consoleErr).not.toHaveBeenCalled();
      expect(screen.queryByText('Convert Approved PRs')).not.toBeInTheDocument();
    });

    it('When PRs fail for a genuine reason / Then the failure is logged', async () => {
      h.getPRs.mockRejectedValue(new Error('network down'));
      renderPage();
      await waitFor(() => expect(consoleErr).toHaveBeenCalledWith('Failed to fetch PRs', expect.any(Error)));
    });

    it('When a 403 is reported only in the message / Then it is still treated as a denial', async () => {
      h.getPRs.mockRejectedValue(new Error('Request failed (403)'));
      renderPage();
      await settled();
      await waitFor(() => expect(h.getPRs).toHaveBeenCalled());
      expect(consoleErr).not.toHaveBeenCalled();
    });

    it('When the PR response is an object with no data key / Then the list falls back to empty', async () => {
      h.getPRs.mockResolvedValue({});
      renderPage();
      await settled();
      await waitFor(() => expect(h.getPRs).toHaveBeenCalled());
      expect(screen.queryByText('Convert Approved PRs')).not.toBeInTheDocument();
    });

    it('When a rejection has no message at all / Then it is treated as a genuine failure', async () => {
      h.getPRs.mockRejectedValue(undefined);
      renderPage();
      await waitFor(() => expect(consoleErr).toHaveBeenCalledWith('Failed to fetch PRs', undefined));
    });
  });
});

describe('POListPage — purchase order table', () => {
  it('Given a PO raised from a requisition / When rendered / Then the PR reference is shown', async () => {
    h.getPOs.mockResolvedValue([makePO({ pr_id: 'pr-abcdef-99' })]);
    renderPage();
    await waitFor(() => expect(screen.getByText(/Reference: PR-/)).toBeInTheDocument());
  });

  it('Given a fully received PO / When rendered / Then progress reads 100%', async () => {
    h.getPOs.mockResolvedValue([
      makePO({ po_lines: [{ quantity: 5, received_quantity: 5 }] }),
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByText('100%')).toBeInTheDocument());
  });

  it('Given a PO with no lines / When rendered / Then progress reads 0%', async () => {
    h.getPOs.mockResolvedValue([makePO({ po_lines: undefined })]);
    renderPage();
    await waitFor(() => expect(screen.getByText('0%')).toBeInTheDocument());
  });

  it('Given a PO with no amount / When rendered / Then the amount falls back to zero', async () => {
    h.getPOs.mockResolvedValue([makePO({ total_amount: null })]);
    renderPage();
    await waitFor(() => expect(screen.getByText('$0')).toBeInTheDocument());
  });

  it.each([
    ['sent'],
    ['acknowledged'],
    ['partially_received'],
    ['received'],
    ['closed'],
    ['cancelled'],
    ['draft'],
  ])('Given a PO in %s / When rendered / Then the status badge shows it', async (status) => {
    h.getPOs.mockResolvedValue([makePO({ status })]);
    renderPage();
    await waitFor(() => expect(screen.getByText(status)).toBeInTheDocument());
  });

  it('Given a PO row / When clicked / Then it navigates to the PO detail page', async () => {
    h.getPOs.mockResolvedValue([makePO()]);
    renderPage();
    await waitFor(() => expect(screen.getByText('#PO-2025-0001')).toBeInTheDocument());
    fireEvent.click(screen.getByText('#PO-2025-0001'));
    expect(h.navigate).toHaveBeenCalledWith('/procurement/po/po-1');
  });
});

describe('POListPage — quota and feature gating', () => {
  it('Given quota data is available / When rendered / Then the quota bar reflects it', async () => {
    h.getQuota.mockReturnValue({ current_usage: 3, limit: 10, is_unlimited: false });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('quota-bar')).toHaveTextContent('Purchase Orders:3/10:false'));
  });

  it('Given no quota data / When rendered / Then no quota bar is shown', async () => {
    renderPage();
    await settled();
    expect(screen.queryByTestId('quota-bar')).not.toBeInTheDocument();
  });

  it('Given the create-PO feature is locked / When Upgrade is clicked / Then billing opens', async () => {
    h.bridge.getFeatureState = () => 'locked';
    renderPage();
    await waitFor(() => expect(screen.getByText('Upgrade')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Upgrade'));
    expect(h.navigate).toHaveBeenCalledWith('/org/billing');
  });

  it('Given effective flags are still loading / When rendered / Then the gate shows its loading state', async () => {
    h.bridge.effectiveFlagsLoaded = false;
    renderPage();
    await waitFor(() => expect(screen.getByTestId('flags-loading')).toBeInTheDocument());
  });

  it('Given the shell exposes no feature-state resolver / When rendered / Then the action defaults to enabled', async () => {
    h.bridge = { currentOrg: { id: 'org-1' }, effectiveFlagsLoaded: true };
    renderPage();
    await waitFor(() => expect(screen.getByText('New PO')).toBeInTheDocument());
  });

  it('Given no shell bridge at all / When rendered / Then the page still renders', async () => {
    h.bridge = undefined;
    renderPage();
    await settled();
    expect(screen.getByText('New PO')).toBeInTheDocument();
  });

  it('Given the Opening Balance action / When clicked / Then it navigates to opening balance', async () => {
    renderPage();
    await settled();
    fireEvent.click(screen.getByText('Opening Balance'));
    expect(h.navigate).toHaveBeenCalledWith('/procurement/opening-balance');
  });
});

describe('POListPage — converting an approved requisition', () => {
  beforeEach(() => {
    h.getPRs.mockResolvedValue([makePR()]);
  });

  it('Given approved PRs / When rendered / Then the conversion shortcut shows the count', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Convert Approved PRs')).toBeInTheDocument());
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });

  it('Given a PR already fully converted / When Convert is clicked / Then the user is warned and no form opens', async () => {
    h.getConversionPayload.mockResolvedValue({ is_fully_converted: true });
    renderPage();
    await waitFor(() => expect(screen.getByText('Convert')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Convert'));
    await waitFor(() => expect(h.toast.warning).toHaveBeenCalledWith(expect.stringMatching(/fully converted/i)));
    expect(screen.queryAllByText('Create Purchase Order').length).toBe(0);
  });

  it('Given a convertible PR / When Convert is clicked / Then the form opens prefilled with the remaining lines', async () => {
    h.getConversionPayload.mockResolvedValue({
      pr_id: 'pr-11111111-2222',
      suggested_po_number: 'PO-2025-0042',
      available_lines: [
        {
          item_id: 'i1',
          item_name: 'Bolt',
          remaining_quantity: 4,
          estimated_unit_price: 3,
          description: 'spare',
          pr_line_id: 'l1',
          tax_code_id: 'tax-1',
        },
        { item_id: 'i2', remaining_quantity: 0, estimated_unit_price: 9, pr_line_id: 'l2' },
      ],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Convert')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Convert'));
    await waitFor(() => expect(screen.getByText(/Converting from PR #/)).toBeInTheDocument());
    expect(screen.getByDisplayValue('PO-2025-0042')).toBeInTheDocument();
    // only the line with remaining quantity survives
    expect(screen.getAllByTestId('item-search')).toHaveLength(1);
    expect(screen.getByTestId('item-name')).toHaveTextContent('Bolt');
    expect(screen.getByText('Tax ✓')).toBeInTheDocument();
  });

  it('Given a payload without a suggested number or lines / When converting / Then a PO number is generated and no lines are added', async () => {
    h.getPOs.mockResolvedValue([makePO()]);
    h.getConversionPayload.mockResolvedValue({ pr_id: 'pr-11111111-2222' });
    renderPage();
    await waitFor(() => expect(screen.getByText('Convert')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Convert'));
    await waitFor(() => expect(screen.getByText(/Converting from PR #/)).toBeInTheDocument());
    expect(screen.getByDisplayValue(`PO-${new Date().getFullYear()}-0002`)).toBeInTheDocument();
    expect(screen.getByText(/No items added yet/)).toBeInTheDocument();
  });

  it('Given a converted line carries no name, description or tax code / When prefilled / Then blanks are used', async () => {
    h.getConversionPayload.mockResolvedValue({
      pr_id: 'pr-11111111-2222',
      suggested_po_number: 'PO-2025-0043',
      available_lines: [{ item_id: 'i1', remaining_quantity: 6, estimated_unit_price: 2, pr_line_id: 'l1' }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Convert')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Convert'));
    await waitFor(() => expect(screen.getByTestId('item-search')).toBeInTheDocument());
    expect(screen.getByTestId('item-name')).toHaveTextContent('');
    expect(screen.getByText('No Tax')).toBeInTheDocument();
  });

  it('Given an approved PR with no lines / When offered in the picker / Then it counts as zero items', async () => {
    h.getPRs.mockResolvedValue([makePR({ pr_lines: undefined })]);
    renderPage();
    await openForm();
    expect(within(selects()[1]).getByText(/— 0 items — approved/)).toBeInTheDocument();
  });

  it('Given the conversion call fails / When Convert is clicked / Then the reason is surfaced', async () => {
    h.getConversionPayload.mockRejectedValue(new Error('PR is locked'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Convert')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Convert'));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('PR is locked'));
  });

  it('Given the conversion fails without a message / When Convert is clicked / Then a fallback is shown', async () => {
    h.getConversionPayload.mockRejectedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText('Convert')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Convert'));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Conversion failed'));
  });
});

describe('POListPage — arriving from the PR detail page', () => {
  it('Given navigation state carries a conversion / When the page mounts / Then the form opens prefilled', async () => {
    h.location = {
      pathname: '/procurement/po',
      state: {
        convertFromPR: {
          pr_id: 'pr-99999999-aaaa',
          suggested_po_number: 'PO-2025-0777',
          available_lines: [
            {
              item_id: 'i1',
              item_name: 'Nut',
              remaining_quantity: 2,
              estimated_unit_price: 1,
              description: 'from PR',
              pr_line_id: 'l1',
              tax_code_id: 'tax-9',
            },
            { item_id: 'i2', remaining_quantity: 0, estimated_unit_price: 5, pr_line_id: 'l2' },
          ],
        },
      },
    };
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('PO-2025-0777')).toBeInTheDocument());
    expect(screen.getAllByTestId('item-search')).toHaveLength(1);
    expect(screen.getByTestId('item-name')).toHaveTextContent('Nut');
  });

  it('Given navigation state without a suggested number or lines / When the page mounts / Then the form opens empty', async () => {
    h.location = {
      pathname: '/procurement/po',
      state: { convertFromPR: { pr_id: 'pr-99999999-aaaa' } },
    };
    renderPage();
    await waitFor(() => expect(screen.getByText(/Converting from PR #/)).toBeInTheDocument());
    expect(screen.getByText(/No items added yet/)).toBeInTheDocument();
  });

  it('Given a line without a name or description / When prefilled / Then blanks are used', async () => {
    h.location = {
      pathname: '/procurement/po',
      state: {
        convertFromPR: {
          pr_id: 'pr-99999999-aaaa',
          available_lines: [{ item_id: 'i1', remaining_quantity: 1, estimated_unit_price: 2, pr_line_id: 'l1' }],
        },
      },
    };
    renderPage();
    await waitFor(() => expect(screen.getByTestId('item-search')).toBeInTheDocument());
    expect(screen.getByTestId('item-name')).toHaveTextContent('');
    expect(screen.getByText('No Tax')).toBeInTheDocument();
  });
});

describe('POListPage — the create purchase order form', () => {
  beforeEach(() => {
    h.getVendors.mockResolvedValue([{ id: 'v1', name: 'Vendor One' }]);
  });

  const fillHeader = () => {
    fireEvent.change(selects()[0], { target: { value: 'v1' } });
  };

  it('Given the form opens / When rendered / Then vendors and a generated PO number are offered', async () => {
    h.getPOs.mockResolvedValue([makePO()]);
    renderPage();
    await openForm();
    expect(screen.getByText('Vendor One')).toBeInTheDocument();
    expect(screen.getByDisplayValue(`PO-${new Date().getFullYear()}-0002`)).toBeInTheDocument();
  });

  it('Given the form is open / When × is clicked / Then it closes', async () => {
    renderPage();
    await openForm();
    fireEvent.click(screen.getByText('×'));
    expect(screen.queryAllByText('Create Purchase Order').length).toBe(0);
  });

  it('Given the form is open / When Cancel is clicked / Then it closes without creating anything', async () => {
    renderPage();
    await openForm();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryAllByText('Create Purchase Order').length).toBe(0);
    expect(h.createPO).not.toHaveBeenCalled();
  });

  it('Given no vendor is chosen / When submitted / Then the user is asked to pick one', async () => {
    renderPage();
    await openForm();
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(h.toast.warning).toHaveBeenCalledWith('Please select a vendor.'));
    expect(h.createPO).not.toHaveBeenCalled();
  });

  it('Given a blank PO number / When submitted / Then the number is demanded', async () => {
    renderPage();
    await openForm();
    fillHeader();
    fireEvent.change(screen.getByDisplayValue(`PO-${new Date().getFullYear()}-0001`), {
      target: { value: '   ' },
    });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(h.toast.warning).toHaveBeenCalledWith('PO number is required.'));
  });

  it('Given no complete item line / When submitted / Then at least one is demanded', async () => {
    renderPage();
    await openForm();
    fillHeader();
    fireEvent.click(screen.getByText('+ Add Item'));
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() =>
      expect(h.toast.warning).toHaveBeenCalledWith('Add at least one complete item line.'),
    );
  });

  it('Given an item is picked with a price and tax code / When selected / Then the line adopts them', async () => {
    renderPage();
    await openForm();
    fireEvent.click(screen.getByText('+ Add Item'));
    fireEvent.click(screen.getByTestId('pick-priced'));
    await waitFor(() => expect(screen.getByTestId('item-name')).toHaveTextContent('Widget (SKU1)'));
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
    expect(screen.getByText('Tax ✓')).toBeInTheDocument();
  });

  it('Given an item is picked without a price or tax code / When selected / Then it falls back to zero and no tax', async () => {
    renderPage();
    await openForm();
    fireEvent.click(screen.getByText('+ Add Item'));
    fireEvent.click(screen.getByTestId('pick-bare'));
    await waitFor(() => expect(screen.getByTestId('item-name')).toHaveTextContent('Gadget (SKU2)'));
    expect(screen.getByText('No Tax')).toBeInTheDocument();
  });

  it('Given an item line / When removed / Then the empty state returns', async () => {
    renderPage();
    await openForm();
    fireEvent.click(screen.getByText('+ Add Item'));
    await waitFor(() => expect(screen.getByTestId('item-search')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Remove item'));
    await waitFor(() => expect(screen.getByText(/No items added yet/)).toBeInTheDocument());
  });

  it('Given item quantities and prices / When entered / Then the totals reflect them', async () => {
    renderPage();
    await openForm();
    fireEvent.click(screen.getByText('+ Add Item'));
    fireEvent.click(screen.getByTestId('pick-priced'));
    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '4' } });
    fireEvent.change(screen.getByPlaceholderText('Unit Price'), { target: { value: '10' } });
    // subtotal and total both read $40 while tax is resolved server-side
    await waitFor(() => expect(screen.getAllByText('$40')).toHaveLength(2));
    expect(screen.getByText('Resolved on save')).toBeInTheDocument();
  });

  it('Given non-numeric quantities / When entered / Then totals treat them as zero', async () => {
    renderPage();
    await openForm();
    fireEvent.click(screen.getByText('+ Add Item'));
    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '' } });
    await waitFor(() => expect(screen.getAllByText('$0').length).toBeGreaterThan(0));
  });

  it('Given tax-inclusive pricing / When totals render / Then tax is shown as inclusive', async () => {
    h.settings = { base_currency: 'EUR', is_tax_inclusive_pricing: true };
    renderPage();
    await openForm();
    fireEvent.click(screen.getByText('+ Add Item'));
    fireEvent.click(screen.getByTestId('pick-priced'));
    await waitFor(() => expect(screen.getByText('Inclusive in price')).toBeInTheDocument());
    expect(screen.getByText('EUR')).toBeInTheDocument();
  });

  it('Given no business settings / When the form opens / Then the currency falls back to USD', async () => {
    h.settings = null;
    renderPage();
    await openForm();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('Given a complete order / When submitted / Then it is created, recorded and the list refreshes', async () => {
    renderPage();
    await openForm();
    fillHeader();
    fireEvent.change(screen.getByPlaceholderText('Payment terms, delivery conditions, etc.'), {
      target: { value: 'Net 30' },
    });
    fireEvent.change(screen.getByPlaceholderText('Delivery address for goods'), {
      target: { value: '1 Dock Road' },
    });
    fireEvent.click(screen.getByText('+ Add Item'));
    fireEvent.click(screen.getByTestId('pick-priced'));
    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '2' } });
    fireEvent.change(screen.getByPlaceholderText('Description'), { target: { value: 'urgent' } });
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => expect(h.createPO).toHaveBeenCalledTimes(1));
    expect(h.createPO).toHaveBeenCalledWith(
      expect.objectContaining({
        vendor_id: 'v1',
        total_amount: 50,
        currency: 'USD',
        terms: 'Net 30',
        shipping_address: '1 Dock Road',
        pr_id: undefined,
        items: [
          expect.objectContaining({ item_id: 'item-1', quantity: 2, unit_price: 25, description: 'urgent' }),
        ],
      }),
    );
    expect(h.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'inventory.po.created', resourceId: 'po-new' }),
    );
    await waitFor(() => expect(screen.queryAllByText('Create Purchase Order').length).toBe(0));
    expect(h.getPOs).toHaveBeenCalledTimes(2);
  });

  it('Given optional fields are left blank / When submitted / Then they are omitted from the payload', async () => {
    h.createPO.mockResolvedValue(undefined);
    renderPage();
    await openForm();
    fillHeader();
    fireEvent.click(screen.getByText('+ Add Item'));
    fireEvent.click(screen.getByTestId('pick-priced'));
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(h.createPO).toHaveBeenCalled());
    expect(h.createPO).toHaveBeenCalledWith(
      expect.objectContaining({
        terms: undefined,
        shipping_address: undefined,
        items: [expect.objectContaining({ description: undefined, pr_line_id: undefined })],
      }),
    );
    expect(h.recordActivity).toHaveBeenCalledWith(expect.objectContaining({ resourceId: undefined }));
  });

  it('Given a linked requisition / When submitted / Then the PR id rides along', async () => {
    h.getPRs.mockResolvedValue([makePR()]);
    renderPage();
    await openForm();
    fillHeader();
    await waitFor(() => expect(selects()[1].querySelectorAll('option').length).toBeGreaterThan(1));
    fireEvent.change(selects()[1], { target: { value: 'pr-11111111-2222' } });
    fireEvent.click(screen.getByText('+ Add Item'));
    fireEvent.click(screen.getByTestId('pick-priced'));
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() =>
      expect(h.createPO).toHaveBeenCalledWith(expect.objectContaining({ pr_id: 'pr-11111111-2222' })),
    );
  });

  it('Given creation is rejected / When submitted / Then the backend reason is surfaced', async () => {
    h.createPO.mockRejectedValue(new Error('Duplicate PO number'));
    renderPage();
    await openForm();
    fillHeader();
    fireEvent.click(screen.getByText('+ Add Item'));
    fireEvent.click(screen.getByTestId('pick-priced'));
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Duplicate PO number'));
    expect(screen.getAllByText('Create Purchase Order').length).toBeGreaterThan(0);
  });

  it('Given creation fails without a message / When submitted / Then a fallback is shown', async () => {
    h.createPO.mockRejectedValue({});
    renderPage();
    await openForm();
    fillHeader();
    fireEvent.click(screen.getByText('+ Add Item'));
    fireEvent.click(screen.getByTestId('pick-priced'));
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Failed to create Purchase Order'));
  });
});

describe('POListPage — the requisition picker inside the form', () => {
  it('Given approved and pending PRs / When the form opens / Then both groups are offered', async () => {
    h.getPRs.mockResolvedValue([makePR(), makePR({ id: 'pr-33333333-4444', status: 'pending_approval' })]);
    renderPage();
    await openForm();
    const picker = selects()[1];
    expect(within(picker).getByText(/2 items — approved/)).toBeInTheDocument();
    expect(picker.querySelector('optgroup[label="⏳ Pending Approval (Not Available)"]')).not.toBeNull();
  });

  it('Given only pending PRs / When the form opens / Then the user is told they must be approved first', async () => {
    h.getPRs.mockResolvedValue([makePR({ status: 'pending_approval' }), makePR({ id: 'pr-c', status: 'draft' })]);
    renderPage();
    await openForm();
    expect(screen.getByText(/You have 2 pending PR\(s\)/)).toBeInTheDocument();
  });

  it('Given a pending PR with no lines / When offered / Then it counts as zero items', async () => {
    h.getPRs.mockResolvedValue([makePR({ status: 'pending_approval', pr_lines: undefined })]);
    renderPage();
    await openForm();
    expect(within(selects()[1]).getByText(/— 0 items —/)).toBeInTheDocument();
  });

  it('Given only rejected or closed PRs / When the form opens / Then none are available', async () => {
    h.getPRs.mockResolvedValue([
      makePR({ id: 'pr-a', status: 'rejected' }),
      makePR({ id: 'pr-b', status: 'closed' }),
    ]);
    renderPage();
    await openForm();
    expect(screen.getByText('No purchase requisitions available')).toBeInTheDocument();
    expect(screen.queryByText(/You have .* pending PR/)).not.toBeInTheDocument();
  });

  it('Given approved PRs exist / When the form opens / Then no pending-PR warning is shown', async () => {
    h.getPRs.mockResolvedValue([makePR()]);
    renderPage();
    await openForm();
    expect(screen.queryByText(/You have .* pending PR/)).not.toBeInTheDocument();
  });

  it('Given the form is reopened / When opened / Then requisitions are refreshed', async () => {
    renderPage();
    await openForm();
    const callsAfterOpen = h.getPRs.mock.calls.length;
    expect(callsAfterOpen).toBeGreaterThan(1);
  });
});
