import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Modal } from './Modal';

const setup = (over: Partial<React.ComponentProps<typeof Modal>> = {}) => {
  const onClose = vi.fn();
  render(
    <Modal isOpen onClose={onClose} title="Register Warehouse" {...over}>
      <div data-testid="body">Form content</div>
    </Modal>,
  );
  return { onClose };
};

describe('Given the shared Modal (Comb wrapper)', () => {
  it('Given isOpen is false / When rendered / Then nothing is mounted', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="Hidden">
        <p>x</p>
      </Modal>,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('Given isOpen is true / When rendered / Then title and children are visible', () => {
    setup();
    expect(screen.getByText('Register Warehouse')).toBeInTheDocument();
    expect(screen.getByTestId('body')).toBeInTheDocument();
  });

  it('Given an open modal / When the close button is clicked / Then onClose is called', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Given an open modal / When Escape is pressed / Then onClose is called', () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it.each(['sm', 'md', 'lg', 'xl'] as const)('Given size=%s / When rendered / Then it still opens', (size) => {
    setup({ size });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
