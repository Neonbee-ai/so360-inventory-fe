import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import CategoryIconLibrary from './CategoryIconLibrary';

describe('CategoryIconLibrary (Comb)', () => {
  it('Given a fresh render, When shown, Then the Preset Icons toggle is a DS button and the grid is collapsed', () => {
    render(<CategoryIconLibrary onSelect={vi.fn()} />);
    expect(screen.getByText('Preset Icons')).toBeInTheDocument();
    expect(screen.queryByText('Or upload a custom image ↑')).not.toBeInTheDocument();
  });

  it('Given the toggle, When clicked twice, Then the grid opens and closes', () => {
    render(<CategoryIconLibrary onSelect={vi.fn()} />);
    fireEvent.click(screen.getByText('Preset Icons'));
    expect(screen.getByText('Or upload a custom image ↑')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Preset Icons'));
    expect(screen.queryByText('Or upload a custom image ↑')).not.toBeInTheDocument();
  });
});
