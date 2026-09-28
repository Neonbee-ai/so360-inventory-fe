import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSearchDevelopers = vi.fn();
const mockUploadFile = vi.fn();

vi.mock('../../services/inventoryService', () => ({
  inventoryService: { searchDevelopers: (...a: any[]) => mockSearchDevelopers(...a) },
}));
vi.mock('../../services/mediaService', () => ({
  mediaService: { uploadFile: (...a: any[]) => mockUploadFile(...a) },
}));

import { ProjectDetailsSection } from './ProjectDetailsSection';
import type { CategoryMetadata } from '../../types/inventory';

const onChangeSpy = vi.fn();

const Harness: React.FC<{ initial?: CategoryMetadata; disabled?: boolean }> = ({ initial = {}, disabled }) => {
  const [value, setValue] = useState<CategoryMetadata>(initial);
  return (
    <ProjectDetailsSection
      value={value}
      disabled={disabled}
      onChange={(next) => { onChangeSpy(next); setValue(next); }}
    />
  );
};

const pdf = (size = 1000) => {
  const f = new File(['x'], 'brochure.pdf', { type: 'application/pdf' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

beforeEach(() => {
  mockSearchDevelopers.mockReset();
  mockUploadFile.mockReset();
  onChangeSpy.mockReset();
  mockSearchDevelopers.mockResolvedValue([{ id: 'd1', name: 'Emaar' }, { id: 'd2', name: 'Sobha' }]);
});

describe('ProjectDetailsSection', () => {
  describe('Given developers load from Core', () => {
    describe('When the section renders', () => {
      it('Then the developer select lists them', async () => {
        render(<Harness />);
        expect(screen.getByText('Project details')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('option', { name: 'Emaar' })).toBeInTheDocument());
        expect(screen.getByRole('option', { name: 'Sobha' })).toBeInTheDocument();
        expect(mockSearchDevelopers).toHaveBeenCalledTimes(1);
      });
    });

    describe('When a developer is picked', () => {
      it('Then developer_partner_id is emitted', async () => {
        render(<Harness initial={{ location: 'Marina' }} />);
        await waitFor(() => expect(screen.getByRole('option', { name: 'Emaar' })).toBeInTheDocument());
        fireEvent.change(screen.getByLabelText('Developer'), { target: { value: 'd1' } });
        expect(onChangeSpy).toHaveBeenLastCalledWith({ location: 'Marina', developer_partner_id: 'd1' });
      });
    });

    describe('When the developer is cleared', () => {
      it('Then developer_partner_id becomes null', async () => {
        render(<Harness initial={{ developer_partner_id: 'd1' }} />);
        await waitFor(() => expect(screen.getByRole('option', { name: 'Emaar' })).toBeInTheDocument());
        fireEvent.change(screen.getByLabelText('Developer'), { target: { value: '' } });
        expect(onChangeSpy).toHaveBeenLastCalledWith({ developer_partner_id: null });
      });
    });
  });

  describe('Given a saved developer the lookup did not return', () => {
    it('Then it stays selectable as the current developer', async () => {
      render(<Harness initial={{ developer_partner_id: 'gone' }} />);
      await waitFor(() => expect(screen.getByRole('option', { name: 'Current developer' })).toBeInTheDocument());
      expect((screen.getByLabelText('Developer') as HTMLSelectElement).value).toBe('gone');
    });
  });

  describe('Given the developer lookup fails', () => {
    it('Then an inline error shows and the rest of the form still works', async () => {
      mockSearchDevelopers.mockRejectedValue(new Error('down'));
      render(<Harness />);
      await waitFor(() => expect(screen.getByText('Could not load developers')).toBeInTheDocument());
      fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'JVC' } });
      expect(onChangeSpy).toHaveBeenLastCalledWith({ location: 'JVC' });
    });
  });

  describe('Given the location and handover fields', () => {
    describe('When they are typed and then cleared', () => {
      it('Then values are emitted and blanks become null', async () => {
        render(<Harness />);
        fireEvent.change(screen.getByLabelText('Handover'), { target: { value: 'Q4 2027' } });
        expect(onChangeSpy).toHaveBeenLastCalledWith({ handover: 'Q4 2027' });
        fireEvent.change(screen.getByLabelText('Handover'), { target: { value: '' } });
        expect(onChangeSpy).toHaveBeenLastCalledWith({ handover: null });
        await waitFor(() => expect(mockSearchDevelopers).toHaveBeenCalled());
      });
    });
  });

  describe('Given no brochure yet', () => {
    describe('When a PDF is uploaded', () => {
      it('Then the uploaded URL is emitted as brochure_url and a view link shows', async () => {
        mockUploadFile.mockResolvedValue({ url: 'https://cdn/x.pdf' });
        render(<Harness />);
        fireEvent.change(screen.getByTestId('brochure-input'), { target: { files: [pdf()] } });
        await waitFor(() => expect(onChangeSpy).toHaveBeenLastCalledWith({ brochure_url: 'https://cdn/x.pdf' }));
        expect(screen.getByText('View brochure').getAttribute('href')).toBe('https://cdn/x.pdf');
      });
    });

    describe('When the file is too large', () => {
      it('Then it is rejected without uploading', async () => {
        render(<Harness />);
        fireEvent.change(screen.getByTestId('brochure-input'), { target: { files: [pdf(11 * 1024 * 1024)] } });
        expect(await screen.findByText('Max 10 MB')).toBeInTheDocument();
        expect(mockUploadFile).not.toHaveBeenCalled();
      });
    });

    describe('When the file type is not allowed', () => {
      it('Then it is rejected without uploading', async () => {
        render(<Harness />);
        const exe = new File(['x'], 'a.exe', { type: 'application/x-msdownload' });
        fireEvent.change(screen.getByTestId('brochure-input'), { target: { files: [exe] } });
        expect(await screen.findByText('PDF or image only')).toBeInTheDocument();
        expect(mockUploadFile).not.toHaveBeenCalled();
      });
    });

    describe('When the upload fails', () => {
      it('Then the error message shows', async () => {
        mockUploadFile.mockRejectedValue(new Error('Quota exceeded'));
        render(<Harness />);
        fireEvent.change(screen.getByTestId('brochure-input'), { target: { files: [pdf()] } });
        expect(await screen.findByText('Quota exceeded')).toBeInTheDocument();
      });
    });
  });

  describe('Given a brochure already saved', () => {
    describe('When Remove is clicked', () => {
      it('Then brochure_url is emitted as null', async () => {
        render(<Harness initial={{ brochure_url: 'https://cdn/old.pdf' }} />);
        fireEvent.click(screen.getByLabelText('Remove brochure'));
        expect(onChangeSpy).toHaveBeenLastCalledWith({ brochure_url: null });
        await waitFor(() => expect(mockSearchDevelopers).toHaveBeenCalled());
      });
    });
  });

  describe('Given the section is disabled', () => {
    it('Then the inputs are disabled and remove is hidden', async () => {
      render(<Harness disabled initial={{ brochure_url: 'https://cdn/old.pdf' }} />);
      expect(screen.getByLabelText('Location')).toBeDisabled();
      expect(screen.queryByLabelText('Remove brochure')).toBeNull();
      await waitFor(() => expect(mockSearchDevelopers).toHaveBeenCalled());
    });
  });
});
