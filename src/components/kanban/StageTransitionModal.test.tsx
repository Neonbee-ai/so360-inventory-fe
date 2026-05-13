import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../common/Modal', () => ({
  Modal: ({ isOpen, title, children }: any) =>
    isOpen ? <div data-testid="modal"><h3>{title}</h3>{children}</div> : null,
}));

import { StageTransitionModal } from './StageTransitionModal';

const makeDeal = (overrides: any = {}) => ({
  id: 'deal-1',
  name: 'Big Deal',
  company_name: 'Acme Corp',
  stage: 'Prospecting' as any,
  value: 5000,
  owner: { full_name: 'Alice', avatar_url: null },
  expected_close_date: '2024-12-31',
  ...overrides,
});

describe('StageTransitionModal', () => {
  describe('Given modal is closed', () => {
    it('When isOpen is false / Then modal is not in DOM', () => {
      render(
        <StageTransitionModal
          isOpen={false}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          deal={makeDeal()}
          newStage="Qualification"
        />
      );
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  describe('Given deal is null', () => {
    it('When deal is null / Then renders nothing', () => {
      render(
        <StageTransitionModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          deal={null}
          newStage="Qualification"
        />
      );
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  describe('Given non-special stage transition', () => {
    it('When newStage is not Won/Lost / Then shows move to stage title', () => {
      render(
        <StageTransitionModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          deal={makeDeal()}
          newStage="Qualification"
        />
      );
      expect(screen.getByText('Move to Qualification')).toBeInTheDocument();
    });

    it('When newStage is not Won/Lost / Then shows confirm stage change text', () => {
      render(
        <StageTransitionModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          deal={makeDeal()}
          newStage="Proposal"
        />
      );
      expect(screen.getByText('Confirm the stage change for this opportunity.')).toBeInTheDocument();
    });

    it('When newStage is not Won/Lost / Then does not show reason textarea', () => {
      render(
        <StageTransitionModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          deal={makeDeal()}
          newStage="Negotiation"
        />
      );
      expect(screen.queryByRole('textbox', { name: /reason/i })).not.toBeInTheDocument();
    });
  });

  describe('Given Won or Lost special stage', () => {
    it('When newStage is Won / Then shows Close Deal: Won title', () => {
      render(
        <StageTransitionModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          deal={makeDeal()}
          newStage="Won"
        />
      );
      expect(screen.getByText('Close Deal: Won')).toBeInTheDocument();
    });

    it('When newStage is Lost / Then shows reason textarea', () => {
      render(
        <StageTransitionModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          deal={makeDeal()}
          newStage="Lost"
        />
      );
      expect(screen.getByPlaceholderText(/reason for marking this deal as Lost/i)).toBeInTheDocument();
    });

    it('When reason entered and form submitted / Then calls onConfirm with reason', () => {
      const onConfirm = vi.fn();
      render(
        <StageTransitionModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={onConfirm}
          deal={makeDeal()}
          newStage="Won"
        />
      );
      fireEvent.change(screen.getByPlaceholderText(/reason for marking this deal as Won/i), {
        target: { value: 'Customer signed contract' },
      });
      fireEvent.click(screen.getByText('Confirm Transition'));
      expect(onConfirm).toHaveBeenCalledWith('Customer customer signed contract'.replace('Customer customer signed contract', 'Customer signed contract'));
      expect(onConfirm).toHaveBeenCalledWith('Customer signed contract');
    });
  });

  describe('Given cancel action', () => {
    it('When Cancel clicked / Then calls onClose', () => {
      const onClose = vi.fn();
      render(
        <StageTransitionModal
          isOpen={true}
          onClose={onClose}
          onConfirm={vi.fn()}
          deal={makeDeal()}
          newStage="Qualification"
        />
      );
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Given deal name display', () => {
    it('When modal open / Then shows deal name in message', () => {
      render(
        <StageTransitionModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          deal={makeDeal({ name: 'My Special Deal' })}
          newStage="Proposal"
        />
      );
      expect(screen.getByText('My Special Deal')).toBeInTheDocument();
    });
  });
});
