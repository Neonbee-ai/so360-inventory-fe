import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import React from 'react';

// Main's shared DS stub is minimal; use the full Comb-primitive stub for this spec.
vi.mock('@so360/design-system', async () => await import('../../../test/__mocks__/design-system.full'));

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockAction = vi.fn();
vi.mock('../../../services/vendorService', () => ({
    vendorService: {
        listBankAccounts: (...a: any[]) => mockList(...a),
        createBankAccount: (...a: any[]) => mockCreate(...a),
        updateBankAccount: (...a: any[]) => mockUpdate(...a),
        bankAccountAction: (...a: any[]) => mockAction(...a),
    },
}));

const mockCan = vi.hoisted(() => vi.fn((_p: string) => true));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ can: mockCan }) }));

const mockFlag = vi.hoisted(() => vi.fn((_k: string) => true));
vi.mock('@so360/shell-context', () => ({
    useShellBridge: () => ({ isFeatureEnabled: mockFlag }),
    useBusinessSettings: () => ({ settings: { base_currency: 'inr' } }),
}));
vi.mock('../../../utils/formatters', () => ({
    useInventoryFormatters: () => ({ formatDate: (d: string) => `D:${d}` }),
}));

import { VendorBankAccountsSection } from '../VendorBankAccountsSection';

const acct = (o: any = {}) => ({
    id: 'a1', vendor_id: 'v1', account_holder: 'Acme Pvt Ltd', bank_name: 'HDFC Bank',
    account_number_masked: '••••9012', iban_masked: null, ifsc: 'HDFC0001234', swift_code: null, branch: 'Fort',
    account_type: 'current', currency: 'INR', payment_method: 'neft', is_primary: true, is_active: true,
    verification_status: 'unverified', verified_by: null, verified_at: null, unverified: true, recently_changed: false,
    ...o,
});

const field = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });

beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockImplementation(() => true);
    mockFlag.mockImplementation(() => true);
    mockList.mockResolvedValue([acct()]);
    mockCreate.mockResolvedValue({ id: 'a2' });
    mockUpdate.mockResolvedValue({ id: 'a1' });
    mockAction.mockResolvedValue({});
});

describe('VendorBankAccountsSection', () => {
    describe('Given the feature flag is off', () => {
        it('When rendered / Then nothing shows and no API call is made', () => {
            mockFlag.mockImplementation(() => false);
            const { container } = render(<VendorBankAccountsSection vendorId="v1" />);
            expect(container).toBeEmptyDOMElement();
            expect(mockList).not.toHaveBeenCalled();
            expect(mockFlag).toHaveBeenCalledWith('submodule:inventory:vendor_bank_details');
        });
    });

    describe('Given the user lacks vendor_bank_accounts.read', () => {
        it('When rendered / Then nothing shows', () => {
            mockCan.mockImplementation((p) => p !== 'vendor_bank_accounts.read');
            const { container } = render(<VendorBankAccountsSection vendorId="v1" />);
            expect(container).toBeEmptyDOMElement();
            expect(mockList).not.toHaveBeenCalled();
        });
    });

    describe('Given a vendor with one unverified primary account', () => {
        it('When loaded / Then only the masked number shows with Primary and Unverified badges', async () => {
            render(<VendorBankAccountsSection vendorId="v1" />);
            expect(await screen.findByTestId('bank-masked-a1')).toHaveTextContent('••••9012');
            expect(mockList).toHaveBeenCalledWith('v1');
            expect(screen.getByText('Primary')).toBeInTheDocument();
            expect(screen.getByText('Unverified')).toBeInTheDocument();
            expect(screen.queryByText(/123456789012/)).not.toBeInTheDocument();
            expect(screen.queryByTestId('bank-primary-a1')).not.toBeInTheDocument();
        });
    });

    describe('Given a verified, recently changed secondary account', () => {
        it('When loaded / Then verified badge, verifier and date show, plus a recent-change badge', async () => {
            mockList.mockResolvedValue([acct({ id: 'a3', is_primary: false, verification_status: 'verified', verified_by: 'abcdef12-3456', verified_at: '2026-10-01', recently_changed: true, account_number_masked: null, iban_masked: '••••5432' })]);
            render(<VendorBankAccountsSection vendorId="v1" />);
            expect(await screen.findByTestId('bank-verified-a3')).toBeInTheDocument();
            expect(screen.getByText('User abcdef12')).toBeInTheDocument();
            expect(screen.getByText('D:2026-10-01')).toBeInTheDocument();
            expect(screen.getByText('Changed recently')).toBeInTheDocument();
            expect(screen.getByTestId('bank-masked-a3')).toHaveTextContent('••••5432');
            expect(screen.queryByTestId('bank-verify-a3')).not.toBeInTheDocument();
        });
    });

    describe('Given a deactivated account', () => {
        it('When loaded / Then it is marked Inactive and has no edit/deactivate/primary actions', async () => {
            mockList.mockResolvedValue([acct({ is_active: false, is_primary: false })]);
            render(<VendorBankAccountsSection vendorId="v1" />);
            expect(await screen.findByText('Inactive')).toBeInTheDocument();
            expect(screen.queryByTestId('bank-edit-a1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('bank-deactivate-a1')).not.toBeInTheDocument();
            expect(screen.queryByTestId('bank-primary-a1')).not.toBeInTheDocument();
        });
    });

    describe('Given no accounts', () => {
        it('When loaded / Then the empty state invites adding one', async () => {
            mockList.mockResolvedValue([]);
            render(<VendorBankAccountsSection vendorId="v1" />);
            expect(await screen.findByText('No bank accounts yet')).toBeInTheDocument();
        });
        it('When the API returns a non-array / Then it is treated as empty', async () => {
            mockList.mockResolvedValue({ unexpected: true });
            render(<VendorBankAccountsSection vendorId="v1" />);
            expect(await screen.findByText('No bank accounts yet')).toBeInTheDocument();
        });
    });

    describe('Given the list call fails', () => {
        it('When loaded / Then the error is shown', async () => {
            mockList.mockRejectedValue(new Error('Bank detail encryption is not configured'));
            render(<VendorBankAccountsSection vendorId="v1" />);
            expect(await screen.findByText('Bank detail encryption is not configured')).toBeInTheDocument();
        });
        it('When the error has no message / Then a fallback is shown', async () => {
            mockList.mockRejectedValue({});
            render(<VendorBankAccountsSection vendorId="v1" />);
            expect(await screen.findByText('Could not load bank accounts.')).toBeInTheDocument();
        });
    });

    describe('Given a read-only user', () => {
        it('When loaded / Then add, edit, deactivate, verify and reveal are hidden', async () => {
            mockCan.mockImplementation((p) => p === 'vendor_bank_accounts.read');
            mockList.mockResolvedValue([acct({ is_primary: false })]);
            render(<VendorBankAccountsSection vendorId="v1" />);
            await screen.findByTestId('bank-masked-a1');
            for (const id of ['bank-add', 'bank-edit-a1', 'bank-deactivate-a1', 'bank-verify-a1', 'bank-reveal-a1', 'bank-primary-a1']) {
                expect(screen.queryByTestId(id)).not.toBeInTheDocument();
            }
        });
    });

    describe('Given the add drawer', () => {
        it('When saved with mismatched numbers / Then validation blocks the API call', async () => {
            render(<VendorBankAccountsSection vendorId="v1" />);
            await screen.findByTestId('bank-masked-a1');
            fireEvent.click(screen.getByTestId('bank-add'));
            expect(field('bank_currency').value).toBe('INR');
            type('bank_account_holder', 'Acme'); type('bank_name', 'SBI');
            type('bank_account_number', '123456789'); type('bank_confirm_account_number', '123456780');
            fireEvent.click(screen.getByTestId('bank-save'));
            expect(await screen.findByText('Account numbers do not match.')).toBeInTheDocument();
            expect(mockCreate).not.toHaveBeenCalled();
        });
        it('When saved with valid details / Then it creates, closes and reloads', async () => {
            render(<VendorBankAccountsSection vendorId="v1" />);
            await screen.findByTestId('bank-masked-a1');
            fireEvent.click(screen.getByTestId('bank-add'));
            type('bank_account_holder', 'Acme'); type('bank_name', 'SBI'); type('bank_ifsc', 'sbin0001234');
            type('bank_account_number', '123456789'); type('bank_confirm_account_number', '123456789');
            fireEvent.click(screen.getByTestId('bank-save'));
            await waitFor(() => expect(mockCreate).toHaveBeenCalledWith('v1', expect.objectContaining({ ifsc: 'SBIN0001234', currency: 'INR', account_number: '123456789' })));
            expect(mockCreate.mock.calls[0][1]).not.toHaveProperty('is_primary');
            expect(await screen.findByText('Bank account added.')).toBeInTheDocument();
            expect(mockList).toHaveBeenCalledTimes(2);
        });
        it('When it is the first account / Then the primary box is pre-ticked and sent', async () => {
            mockList.mockResolvedValue([]);
            render(<VendorBankAccountsSection vendorId="v1" />);
            await screen.findByText('No bank accounts yet');
            fireEvent.click(screen.getByTestId('bank-add'));
            expect(field('bank_is_primary').checked).toBe(true);
            type('bank_account_holder', 'Acme'); type('bank_name', 'SBI');
            type('bank_account_number', '123456789'); type('bank_confirm_account_number', '123456789');
            fireEvent.click(screen.getByTestId('bank-save'));
            await waitFor(() => expect(mockCreate.mock.calls[0][1]).toMatchObject({ is_primary: true }));
        });
        it('When the API rejects the save / Then the error shows inside the drawer and it stays open', async () => {
            mockCreate.mockRejectedValue(new Error('This account number is already on file for this vendor'));
            render(<VendorBankAccountsSection vendorId="v1" />);
            await screen.findByTestId('bank-masked-a1');
            fireEvent.click(screen.getByTestId('bank-add'));
            type('bank_account_holder', 'Acme'); type('bank_name', 'SBI');
            type('bank_account_number', '123456789'); type('bank_confirm_account_number', '123456789');
            fireEvent.click(screen.getByTestId('bank-save'));
            expect(await screen.findByText('This account number is already on file for this vendor')).toBeInTheDocument();
            expect(screen.getByTestId('bank-save')).toBeInTheDocument();
        });
    });

    describe('Given the edit drawer', () => {
        it('When saved without touching the number / Then it PATCHes without secrets', async () => {
            render(<VendorBankAccountsSection vendorId="v1" />);
            fireEvent.click(await screen.findByTestId('bank-edit-a1'));
            expect(field('bank_account_number').value).toBe('');
            type('bank_branch', 'Andheri');
            fireEvent.click(screen.getByTestId('bank-save'));
            await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('v1', 'a1', expect.objectContaining({ branch: 'Andheri' })));
            expect(mockUpdate.mock.calls[0][2]).not.toHaveProperty('account_number');
            expect(await screen.findByText('Bank account updated.')).toBeInTheDocument();
        });
    });

    describe('Given row actions', () => {
        it('When deactivate is confirmed / Then the deactivate action runs and the list reloads', async () => {
            render(<VendorBankAccountsSection vendorId="v1" />);
            fireEvent.click(await screen.findByTestId('bank-deactivate-a1'));
            fireEvent.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Deactivate' }));
            await waitFor(() => expect(mockAction).toHaveBeenCalledWith('v1', 'a1', 'deactivate'));
            expect(await screen.findByText('Bank account deactivated.')).toBeInTheDocument();
        });
        it('When make primary is clicked on a secondary account / Then set-primary runs', async () => {
            mockList.mockResolvedValue([acct({ is_primary: false })]);
            render(<VendorBankAccountsSection vendorId="v1" />);
            fireEvent.click(await screen.findByTestId('bank-primary-a1'));
            await waitFor(() => expect(mockAction).toHaveBeenCalledWith('v1', 'a1', 'set-primary'));
        });
        it('When verify is confirmed / Then verify runs', async () => {
            render(<VendorBankAccountsSection vendorId="v1" />);
            fireEvent.click(await screen.findByTestId('bank-verify-a1'));
            fireEvent.click(await screen.findByRole('button', { name: 'Mark verified' }));
            await waitFor(() => expect(mockAction).toHaveBeenCalledWith('v1', 'a1', 'verify'));
            expect(await screen.findByText('Bank account marked as verified.')).toBeInTheDocument();
        });
        it('When an action fails / Then its error is shown', async () => {
            mockList.mockResolvedValue([acct({ is_primary: false })]);
            mockAction.mockRejectedValue(new Error('Deactivated bank accounts cannot be set as primary'));
            render(<VendorBankAccountsSection vendorId="v1" />);
            fireEvent.click(await screen.findByTestId('bank-primary-a1'));
            expect(await screen.findByText('Deactivated bank accounts cannot be set as primary')).toBeInTheDocument();
        });
        it('When a confirm dialog is cancelled / Then nothing runs', async () => {
            render(<VendorBankAccountsSection vendorId="v1" />);
            fireEvent.click(await screen.findByTestId('bank-deactivate-a1'));
            fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
            expect(mockAction).not.toHaveBeenCalled();
        });
    });

    describe('Given reveal', () => {
        it('When confirmed / Then the full number shows and hides again after 30 seconds', async () => {
            mockAction.mockResolvedValue({ id: 'a1', account_number: '123456789012', iban: null });
            render(<VendorBankAccountsSection vendorId="v1" />);
            fireEvent.click(await screen.findByTestId('bank-reveal-a1'));
            vi.useFakeTimers({ shouldAdvanceTime: true });
            try {
                fireEvent.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Reveal' }));
                expect(await screen.findByTestId('bank-revealed')).toHaveTextContent('123456789012');
                expect(mockAction).toHaveBeenCalledWith('v1', 'a1', 'reveal');
                await act(async () => { vi.advanceTimersByTime(30_001); });
                expect(screen.queryByTestId('bank-revealed')).not.toBeInTheDocument();
            } finally {
                vi.useRealTimers();
            }
        });
        it('When the reveal is refused / Then the error shows and nothing is revealed', async () => {
            mockAction.mockRejectedValue(new Error('Forbidden'));
            render(<VendorBankAccountsSection vendorId="v1" />);
            fireEvent.click(await screen.findByTestId('bank-reveal-a1'));
            fireEvent.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Reveal' }));
            expect(await screen.findByText('Forbidden')).toBeInTheDocument();
            expect(screen.queryByTestId('bank-revealed')).not.toBeInTheDocument();
        });
    });
});
