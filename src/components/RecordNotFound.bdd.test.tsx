import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import { RecordNotFound, isNotFoundError } from './RecordNotFound';

describe('RecordNotFound', () => {
  it('Given a missing record / When rendered / Then shows the not-found title and description', () => {
    render(<MemoryRouter><RecordNotFound listPath="/x/list" listLabel="Things" /></MemoryRouter>);
    expect(screen.getByText('Record not found')).toBeTruthy();
    expect(screen.getByText("This record doesn't exist or you don't have access to it.")).toBeTruthy();
  });

  it('Given the not-found state / When the back action is clicked / Then navigates to the list route', () => {
    mockNavigate.mockClear();
    render(<MemoryRouter><RecordNotFound listPath="/x/list" listLabel="Things" /></MemoryRouter>);
    fireEvent.click(screen.getByText('Back to Things'));
    expect(mockNavigate).toHaveBeenCalledWith('/x/list');
  });

  it.each([[{ status: 404 }], [{ status: 403 }], [{ status: 400 }], [{ response: { status: 404 } }], [new Error('Request failed with status code 403')]])(
    'Given a missing-record error %# / When classified / Then it is a not-found error',
    (err) => {
      expect(isNotFoundError(err)).toBe(true);
    },
  );

  it('Given a 500 or network error / When classified / Then it is not a not-found error', () => {
    expect(isNotFoundError({ status: 500 })).toBe(false);
    expect(isNotFoundError(new Error('Network Error'))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
  });
});
