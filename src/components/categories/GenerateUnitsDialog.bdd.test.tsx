import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateUnits = vi.fn();
vi.mock('../../services/inventoryService', () => ({
  inventoryService: { generateUnits: (...a: any[]) => mockGenerateUnits(...a) },
}));

import { GenerateUnitsDialog, suggestSkuPrefix } from './GenerateUnitsDialog';

const tower = { id: 'tower-1', name: 'Tower A' };
const onClose = vi.fn();
const onGenerated = vi.fn();

const renderDialog = (isOpen = true) =>
  render(<GenerateUnitsDialog isOpen={isOpen} onClose={onClose} tower={tower} onGenerated={onGenerated} />);

const createButton = () => screen.getByRole('button', { name: /^Create \d+ units$/ });

beforeEach(() => {
  mockGenerateUnits.mockReset();
  onClose.mockReset();
  onGenerated.mockReset();
});

describe('GenerateUnitsDialog', () => {
  describe('Given the dialog is closed', () => {
    it('Then nothing renders', () => {
      renderDialog(false);
      expect(screen.queryByText(/Generate units/)).toBeNull();
    });
  });

  describe('Given the dialog opens on a tower', () => {
    describe('When it renders with defaults', () => {
      it('Then it previews floors 1–10 × 4 units with example numbers', () => {
        renderDialog();
        expect(screen.getByText('Generate units — Tower A')).toBeInTheDocument();
        expect(screen.getByTestId('preview-count')).toHaveTextContent('Preview: 40 units');
        expect(screen.getByText('(101 … 1004)')).toBeInTheDocument();
        expect((screen.getByLabelText('SKU prefix') as HTMLInputElement).value).toBe('TOWERA');
        expect(screen.getAllByLabelText(/^Stack \d+ bedrooms$/)).toHaveLength(4);
      });
    });

    describe('When units per floor changes', () => {
      it('Then the stack rows and preview follow, keeping typed values', () => {
        renderDialog();
        fireEvent.change(screen.getByLabelText('Stack 01 bedrooms'), { target: { value: '3' } });
        fireEvent.change(screen.getByLabelText('Units per floor'), { target: { value: '2' } });
        expect(screen.getAllByLabelText(/^Stack \d+ bedrooms$/)).toHaveLength(2);
        expect((screen.getByLabelText('Stack 01 bedrooms') as HTMLInputElement).value).toBe('3');
        expect(screen.getByTestId('preview-count')).toHaveTextContent('Preview: 20 units');
      });
    });

    describe('When the floor range is inverted', () => {
      it('Then the preview is 0 and Create is disabled', () => {
        renderDialog();
        fireEvent.change(screen.getByLabelText('Floor from'), { target: { value: '12' } });
        fireEvent.change(screen.getByLabelText('Floor to'), { target: { value: '3' } });
        expect(screen.getByTestId('preview-count')).toHaveTextContent('Preview: 0 units');
        expect(createButton()).toBeDisabled();
      });
    });

    describe('When the run would exceed the per-run cap', () => {
      it('Then a warning shows and Create is disabled', () => {
        renderDialog();
        fireEvent.change(screen.getByLabelText('Floor to'), { target: { value: '1000' } });
        expect(screen.getByText(/At most 2000 units per run/)).toBeInTheDocument();
        expect(createButton()).toBeDisabled();
      });
    });

    describe('When the SKU prefix is blank', () => {
      it('Then Create is disabled', () => {
        renderDialog();
        fireEvent.change(screen.getByLabelText('SKU prefix'), { target: { value: '  ' } });
        expect(createButton()).toBeDisabled();
      });
    });

    describe('When Create is clicked with stack details', () => {
      it('Then it sends the generate payload and shows created/skipped in place', async () => {
        mockGenerateUnits.mockResolvedValue({ created: 18, skipped: 2 });
        renderDialog();
        fireEvent.change(screen.getByLabelText('Floor from'), { target: { value: '1' } });
        fireEvent.change(screen.getByLabelText('Floor to'), { target: { value: '5' } });
        fireEvent.change(screen.getByLabelText('Units per floor'), { target: { value: '4' } });
        fireEvent.change(screen.getByLabelText('SKU prefix'), { target: { value: ' TA ' } });
        fireEvent.change(screen.getByLabelText('Stack 01 bedrooms'), { target: { value: '2' } });
        fireEvent.change(screen.getByLabelText('Stack 01 area'), { target: { value: '1100' } });
        fireEvent.change(screen.getByLabelText('Stack 01 view'), { target: { value: ' Sea ' } });
        fireEvent.change(screen.getByLabelText('Stack 01 price'), { target: { value: '150000' } });
        fireEvent.click(createButton());

        await waitFor(() => expect(screen.getByTestId('generate-result')).toBeInTheDocument());
        expect(mockGenerateUnits).toHaveBeenCalledWith('tower-1', {
          floor_from: 1,
          floor_to: 5,
          units_per_floor: 4,
          numbering_pattern: '{floor}{stack:02}',
          sku_prefix: 'TA',
          stacks: [
            { stack: '01', bedrooms: 2, area_sqft: 1100, view: 'Sea', price: 150000 },
            { stack: '02', bedrooms: null, area_sqft: null, view: null, price: null },
            { stack: '03', bedrooms: null, area_sqft: null, view: null, price: null },
            { stack: '04', bedrooms: null, area_sqft: null, view: null, price: null },
          ],
        });
        expect(screen.getByTestId('generate-result')).toHaveTextContent('18 units created, 2 skipped');
        expect(onGenerated).toHaveBeenCalledWith({ created: 18, skipped: 2 });

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onClose).toHaveBeenCalled();
      });
    });

    describe('When the numbering pattern is blanked', () => {
      it('Then the default pattern is sent', async () => {
        mockGenerateUnits.mockResolvedValue({ created: 40, skipped: 0 });
        renderDialog();
        fireEvent.change(screen.getByLabelText('Numbering pattern'), { target: { value: '' } });
        fireEvent.click(createButton());
        await waitFor(() => expect(mockGenerateUnits).toHaveBeenCalled());
        expect(mockGenerateUnits.mock.calls[0][1].numbering_pattern).toBe('{floor}{stack:02}');
        await waitFor(() => expect(screen.getByTestId('generate-result')).toHaveTextContent('40 units created.'));
      });
    });

    describe('When the backend rejects the run', () => {
      it('Then the error shows and the form stays open', async () => {
        mockGenerateUnits.mockRejectedValue(new Error('Tower has no product type'));
        renderDialog();
        fireEvent.click(createButton());
        expect(await screen.findByText('Tower has no product type')).toBeInTheDocument();
        expect(screen.queryByTestId('generate-result')).toBeNull();
        expect(onGenerated).not.toHaveBeenCalled();
      });
    });

    describe('When Cancel is clicked', () => {
      it('Then onClose fires', () => {
        renderDialog();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalled();
      });
    });
  });
});

describe('suggestSkuPrefix', () => {
  describe('Given a tower name with spaces and symbols', () => {
    it('Then it keeps up to 6 uppercase letters/digits', () => {
      expect(suggestSkuPrefix('Tower B-2 (East)')).toBe('TOWERB');
    });
  });
  describe('Given an empty name', () => {
    it('Then it falls back to UNIT', () => {
      expect(suggestSkuPrefix('')).toBe('UNIT');
    });
  });
});

describe('GenerateUnitsDialog edge branches', () => {
  describe('Given units per floor is set to 0', () => {
    it('Then no stack table or examples show and Create is disabled', () => {
      renderDialog();
      fireEvent.change(screen.getByLabelText('Units per floor'), { target: { value: '0' } });
      expect(screen.queryAllByLabelText(/^Stack \d+ bedrooms$/)).toHaveLength(0);
      expect(screen.queryByRole('columnheader', { name: 'Stack' })).toBeNull();
      expect(screen.getByTestId('preview-count')).toHaveTextContent('Preview: 0 units');
      expect(screen.queryByText(/\(.*….*\)/)).toBeNull();
      expect(createButton()).toBeDisabled();
    });
  });

  describe('Given units per floor grows from 4 to 6', () => {
    it('Then two empty stack rows are added', () => {
      renderDialog();
      fireEvent.change(screen.getByLabelText('Units per floor'), { target: { value: '6' } });
      expect(screen.getAllByLabelText(/^Stack \d+ bedrooms$/)).toHaveLength(6);
      expect((screen.getByLabelText('Stack 06 bedrooms') as HTMLInputElement).value).toBe('');
      expect(screen.getByText('(101 … 1006)')).toBeInTheDocument();
    });
  });

  describe('Given a single floor with a single unit', () => {
    it('Then only one example number shows', () => {
      renderDialog();
      fireEvent.change(screen.getByLabelText('Floor to'), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText('Units per floor'), { target: { value: '1' } });
      expect(screen.getByTestId('preview-count')).toHaveTextContent('Preview: 1 units');
      expect(screen.getByText('(101)')).toBeInTheDocument();
    });
  });

  describe('Given the backend rejects without a message', () => {
    it('Then the generic error shows', async () => {
      mockGenerateUnits.mockRejectedValue({});
      renderDialog();
      fireEvent.click(createButton());
      expect(await screen.findByText('Failed to generate units')).toBeInTheDocument();
    });
  });

  describe('Given no onGenerated callback', () => {
    it('Then a successful run still shows the result', async () => {
      mockGenerateUnits.mockResolvedValue({ created: 40, skipped: 0 });
      render(<GenerateUnitsDialog isOpen onClose={onClose} tower={tower} />);
      fireEvent.click(createButton());
      expect(await screen.findByTestId('generate-result')).toHaveTextContent('40 units created.');
    });
  });

  describe('Given a run that is still in flight', () => {
    it('Then Create is disabled until it settles', async () => {
      let resolveRun!: (v: { created: number; skipped: number }) => void;
      mockGenerateUnits.mockReturnValue(new Promise((res) => { resolveRun = res; }));
      renderDialog();
      fireEvent.click(createButton());
      await waitFor(() => expect(createButton()).toBeDisabled());
      fireEvent.click(createButton());
      expect(mockGenerateUnits).toHaveBeenCalledTimes(1);
      resolveRun({ created: 40, skipped: 0 });
      expect(await screen.findByTestId('generate-result')).toBeInTheDocument();
    });
  });

  describe('Given the dialog is closed and reopened', () => {
    it('Then the form and result are reset', async () => {
      mockGenerateUnits.mockResolvedValue({ created: 40, skipped: 0 });
      const { rerender } = renderDialog();
      fireEvent.change(screen.getByLabelText('SKU prefix'), { target: { value: 'ZZ' } });
      fireEvent.change(screen.getByLabelText('Floor to'), { target: { value: '3' } });
      fireEvent.click(createButton());
      await screen.findByTestId('generate-result');

      rerender(<GenerateUnitsDialog isOpen={false} onClose={onClose} tower={tower} onGenerated={onGenerated} />);
      rerender(<GenerateUnitsDialog isOpen onClose={onClose} tower={tower} onGenerated={onGenerated} />);

      expect(screen.queryByTestId('generate-result')).toBeNull();
      expect((screen.getByLabelText('SKU prefix') as HTMLInputElement).value).toBe('TOWERA');
      expect(screen.getByTestId('preview-count')).toHaveTextContent('Preview: 40 units');
    });
  });

  describe('Given a stack price that overflows to Infinity', () => {
    it('Then the price is sent as null', async () => {
      mockGenerateUnits.mockResolvedValue({ created: 40, skipped: 0 });
      renderDialog();
      fireEvent.change(screen.getByLabelText('Stack 01 price'), { target: { value: '1e999' } });
      fireEvent.click(createButton());
      await waitFor(() => expect(mockGenerateUnits).toHaveBeenCalled());
      expect(mockGenerateUnits.mock.calls[0][1].stacks[0].price).toBeNull();
    });
  });
});
