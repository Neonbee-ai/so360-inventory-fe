import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { KanbanBoard } from './KanbanBoard';

const makeStages = () => [
  { id: 'stage-1', name: 'Prospecting' as any },
  { id: 'stage-2', name: 'Qualification' as any },
];

const makeDeals = () => [
  {
    id: 'deal-1',
    name: 'Alpha Deal',
    company_name: 'Alpha Corp',
    stage: 'Prospecting' as any,
    value: 10000,
    owner: { full_name: 'Alice Smith', avatar_url: null },
    expected_close_date: '2024-12-31',
  },
  {
    id: 'deal-2',
    name: 'Beta Deal',
    company_name: 'Beta Inc',
    stage: 'Qualification' as any,
    value: 5000,
    owner: { full_name: 'Bob Jones', avatar_url: null },
    expected_close_date: '2025-01-15',
  },
];

describe('KanbanBoard', () => {
  describe('Given initial render', () => {
    it('When rendered / Then shows all stage names', () => {
      render(
        <KanbanBoard
          deals={makeDeals()}
          stages={makeStages()}
          onDealClick={vi.fn()}
          onStageChange={vi.fn()}
        />
      );
      expect(screen.getByText('Prospecting')).toBeInTheDocument();
      expect(screen.getByText('Qualification')).toBeInTheDocument();
    });

    it('When rendered / Then shows deal names in their respective columns', () => {
      render(
        <KanbanBoard
          deals={makeDeals()}
          stages={makeStages()}
          onDealClick={vi.fn()}
          onStageChange={vi.fn()}
        />
      );
      expect(screen.getByText('Alpha Deal')).toBeInTheDocument();
      expect(screen.getByText('Beta Deal')).toBeInTheDocument();
    });

    it('When stage has no deals / Then shows Drop here placeholder', () => {
      render(
        <KanbanBoard
          deals={[]}
          stages={makeStages()}
          onDealClick={vi.fn()}
          onStageChange={vi.fn()}
        />
      );
      const dropHints = screen.getAllByText('Drop here');
      expect(dropHints.length).toBe(2);
    });

    it('When rendered / Then shows deal count badge per stage', () => {
      render(
        <KanbanBoard
          deals={makeDeals()}
          stages={makeStages()}
          onDealClick={vi.fn()}
          onStageChange={vi.fn()}
        />
      );
      // Each stage with 1 deal should show "1" in badge
      const badges = screen.getAllByText('1');
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Given deal click', () => {
    it('When deal card clicked / Then calls onDealClick with the deal', () => {
      const onDealClick = vi.fn();
      render(
        <KanbanBoard
          deals={makeDeals()}
          stages={makeStages()}
          onDealClick={onDealClick}
          onStageChange={vi.fn()}
        />
      );
      fireEvent.click(screen.getByText('Alpha Deal'));
      expect(onDealClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'deal-1', name: 'Alpha Deal' }));
    });
  });

  describe('Given deal values', () => {
    it('When rendered / Then shows deal value in column header and card', () => {
      render(
        <KanbanBoard
          deals={makeDeals()}
          stages={makeStages()}
          onDealClick={vi.fn()}
          onStageChange={vi.fn()}
        />
      );
      // Value appears both in stage header total and deal card
      const values = screen.getAllByText('$10,000');
      expect(values.length).toBeGreaterThan(0);
    });
  });

  describe('Given owner with avatar', () => {
    it('When owner has avatar_url / Then renders avatar image', () => {
      const deals = [
        {
          id: 'deal-3',
          name: 'Avatar Deal',
          company_name: 'Img Corp',
          stage: 'Prospecting' as any,
          value: 3000,
          owner: { full_name: 'Carol White', avatar_url: 'http://example.com/avatar.jpg' },
          expected_close_date: '2025-06-01',
        },
      ];
      render(
        <KanbanBoard
          deals={deals}
          stages={makeStages()}
          onDealClick={vi.fn()}
          onStageChange={vi.fn()}
        />
      );
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'http://example.com/avatar.jpg');
    });
  });
});
