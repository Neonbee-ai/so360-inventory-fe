import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PhotoAttentionIndicator from './PhotoAttentionIndicator';

describe('PhotoAttentionIndicator', () => {
  describe('Given an item whose photos need attention', () => {
    it('When rendered / Then shows the ⚠ indicator with an explanation', () => {
      render(<PhotoAttentionIndicator needsAttention />);
      const el = screen.getByTestId('photo-attention');
      expect(el).toHaveTextContent('⚠');
      expect(el.getAttribute('title')).toMatch(/under 800px/);
    });
  });

  describe('Given an item whose photos are fine, or not yet checked', () => {
    it('When needsAttention is false / Then nothing is rendered', () => {
      render(<PhotoAttentionIndicator needsAttention={false} />);
      expect(screen.queryByTestId('photo-attention')).not.toBeInTheDocument();
    });

    it('When needsAttention is missing (column not there yet) / Then nothing is rendered', () => {
      render(<PhotoAttentionIndicator />);
      expect(screen.queryByTestId('photo-attention')).not.toBeInTheDocument();
    });
  });
});
