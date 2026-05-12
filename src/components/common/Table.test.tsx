import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('./Skeleton', () => ({
  TableSkeleton: () => <div data-testid="skeleton">Loading skeleton</div>,
}));

import { Table } from './Table';

const columns = [
  { header: 'Name', accessor: (item: any) => item.name },
  { header: 'Value', accessor: (item: any) => item.value },
];

describe('Table', () => {
  describe('Given loading state', () => {
    it('When isLoading is true / Then renders skeleton', () => {
      render(<Table data={[]} columns={columns} isLoading={true} />);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });
  });

  describe('Given empty data', () => {
    it('When data is empty / Then shows default empty message', () => {
      render(<Table data={[]} columns={columns} isLoading={false} />);
      expect(screen.getByText('No records found')).toBeInTheDocument();
    });

    it('When custom empty message provided / Then shows custom message', () => {
      render(<Table data={[]} columns={columns} isLoading={false} emptyMessage="Nothing here" />);
      expect(screen.getByText('Nothing here')).toBeInTheDocument();
    });
  });

  describe('Given data rows', () => {
    it('When data exists / Then renders column headers', () => {
      render(<Table data={[{ id: '1', name: 'A', value: 10 }]} columns={columns} />);
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
    });

    it('When data exists / Then renders row content', () => {
      render(<Table data={[{ id: '1', name: 'Widget', value: 42 }]} columns={columns} />);
      expect(screen.getByText('Widget')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('When onRowClick provided / Then calls handler on row click', () => {
      const handler = vi.fn();
      render(<Table data={[{ id: '1', name: 'A', value: 1 }]} columns={columns} onRowClick={handler} />);
      fireEvent.click(screen.getByText('A'));
      expect(handler).toHaveBeenCalledWith({ id: '1', name: 'A', value: 1 });
    });
  });
});
