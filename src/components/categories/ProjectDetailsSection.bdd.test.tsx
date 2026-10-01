import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSearchDevelopers = vi.fn();
const mockUploadFile = vi.fn();

vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    searchDevelopers: (...a: any[]) => mockSearchDevelopers(...a),
    searchOrgUsers: () => Promise.resolve([]),
    listTeams: () => Promise.resolve([]),
  },
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
  mockSearchDevelopers.mockResolvedValue([{ id: 'd1', name: 'Emaar', role: 'developer' }, { id: 'd2', name: 'Sobha', role: 'developer' }]);
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

describe('ProjectDetailsSection edge branches', () => {
  describe('Given the developer lookup is still pending', () => {
    it('Then the select shows Loading… and is disabled', () => {
      mockSearchDevelopers.mockReturnValue(new Promise(() => {}));
      render(<Harness />);
      expect(screen.getByRole('option', { name: 'Loading…' })).toBeInTheDocument();
      expect(screen.getByLabelText('Developer')).toBeDisabled();
    });
  });

  describe('Given the section unmounts before developers resolve', () => {
    it('Then the late result is ignored', async () => {
      let resolveDevs!: (v: { id: string; name: string }[]) => void;
      const pending = new Promise<{ id: string; name: string }[]>((res) => { resolveDevs = res; });
      mockSearchDevelopers.mockReturnValue(pending);
      const { unmount } = render(<Harness />);
      unmount();
      resolveDevs([{ id: 'd1', name: 'Emaar' }]);
      await pending;
      expect(screen.queryByRole('option', { name: 'Emaar' })).toBeNull();
    });
  });

  describe('Given the section unmounts before the developer lookup fails', () => {
    it('Then the late failure is ignored', async () => {
      let rejectDevs!: (e: unknown) => void;
      const pending = new Promise<never>((_res, rej) => { rejectDevs = rej; });
      mockSearchDevelopers.mockReturnValue(pending);
      const { unmount } = render(<Harness />);
      unmount();
      rejectDevs(new Error('down'));
      await pending.catch(() => undefined);
      expect(screen.queryByText('Could not load developers')).toBeNull();
    });
  });

  describe('Given the location field', () => {
    it('Then clearing it emits null', () => {
      render(<Harness initial={{ location: 'Marina' }} />);
      fireEvent.change(screen.getByLabelText('Location'), { target: { value: '' } });
      expect(onChangeSpy).toHaveBeenLastCalledWith({ location: null });
    });
  });

  describe('Given the file picker is dismissed with no file', () => {
    it('Then nothing is uploaded', async () => {
      render(<Harness />);
      fireEvent.change(screen.getByTestId('brochure-input'), { target: { files: [] } });
      await waitFor(() => expect(mockSearchDevelopers).toHaveBeenCalled());
      expect(mockUploadFile).not.toHaveBeenCalled();
      expect(onChangeSpy).not.toHaveBeenCalled();
    });
  });

  describe('Given a file with no MIME type', () => {
    it('Then it is uploaded', async () => {
      mockUploadFile.mockResolvedValue({ url: 'https://cdn/b' });
      render(<Harness />);
      const untyped = new File(['x'], 'brochure');
      fireEvent.change(screen.getByTestId('brochure-input'), { target: { files: [untyped] } });
      await waitFor(() => expect(onChangeSpy).toHaveBeenLastCalledWith({ brochure_url: 'https://cdn/b' }));
      expect(mockUploadFile).toHaveBeenCalledWith(untyped);
    });
  });

  describe('Given a PNG brochure', () => {
    it('Then it is uploaded', async () => {
      mockUploadFile.mockResolvedValue({ url: 'https://cdn/b.png' });
      render(<Harness />);
      const png = new File(['x'], 'b.png', { type: 'image/png' });
      fireEvent.change(screen.getByTestId('brochure-input'), { target: { files: [png] } });
      await waitFor(() => expect(onChangeSpy).toHaveBeenLastCalledWith({ brochure_url: 'https://cdn/b.png' }));
    });
  });

  describe('Given the upload fails without a message', () => {
    it('Then the generic upload error shows', async () => {
      mockUploadFile.mockRejectedValue({});
      render(<Harness />);
      fireEvent.change(screen.getByTestId('brochure-input'), { target: { files: [pdf()] } });
      expect(await screen.findByText('Upload failed')).toBeInTheDocument();
      expect(screen.getByText('Upload PDF')).toBeInTheDocument();
    });
  });

  describe('Given an upload in progress', () => {
    it('Then the label reads Uploading… and the input is disabled', async () => {
      let resolveUpload!: (v: { url: string }) => void;
      mockUploadFile.mockReturnValue(new Promise((res) => { resolveUpload = res; }));
      render(<Harness />);
      fireEvent.change(screen.getByTestId('brochure-input'), { target: { files: [pdf()] } });
      expect(await screen.findByText('Uploading…')).toBeInTheDocument();
      expect(screen.getByTestId('brochure-input')).toBeDisabled();
      resolveUpload({ url: 'https://cdn/x.pdf' });
      expect(await screen.findByText('View brochure')).toBeInTheDocument();
    });
  });

  describe('Given the section unmounts during an upload', () => {
    it('Then finishing the upload does not throw', async () => {
      let resolveUpload!: (v: { url: string }) => void;
      const pending = new Promise<{ url: string }>((res) => { resolveUpload = res; });
      mockUploadFile.mockReturnValue(pending);
      const { unmount } = render(<Harness />);
      fireEvent.change(screen.getByTestId('brochure-input'), { target: { files: [pdf()] } });
      await waitFor(() => expect(mockUploadFile).toHaveBeenCalled());
      unmount();
      resolveUpload({ url: 'https://cdn/x.pdf' });
      await pending;
      await waitFor(() => expect(onChangeSpy).toHaveBeenLastCalledWith({ brochure_url: 'https://cdn/x.pdf' }));
    });
  });

  describe('Given the section is disabled with no brochure', () => {
    it('Then the brochure input is disabled', async () => {
      render(<Harness disabled />);
      expect(screen.getByTestId('brochure-input')).toBeDisabled();
      expect(screen.getByLabelText('Handover')).toBeDisabled();
      await waitFor(() => expect(mockSearchDevelopers).toHaveBeenCalled());
    });
  });
});

describe('ProjectDetailsSection developer roles (G1)', () => {
  const mixed = [
    { id: 'd1', name: 'Emaar', role: 'developer' },
    { id: 'o1', name: 'Ali Hassan', role: 'property_owner' },
  ];

  describe('Given only developers load', () => {
    it('Then no filter chips are shown', async () => {
      render(<Harness />);
      await waitFor(() => expect(screen.getByRole('option', { name: 'Emaar' })).toBeInTheDocument());
      expect(screen.queryByRole('group', { name: 'Developer filter' })).toBeNull();
    });
  });

  describe('Given developers and property owners load', () => {
    it('Then owners are labelled and the chips filter the list', async () => {
      mockSearchDevelopers.mockResolvedValue(mixed);
      render(<Harness />);
      await waitFor(() => expect(screen.getByRole('option', { name: 'Ali Hassan (Property owner)' })).toBeInTheDocument());
      const group = screen.getByRole('group', { name: 'Developer filter' });
      expect(group).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(screen.getByRole('button', { name: 'Property owners' }));
      expect(screen.getByRole('button', { name: 'Property owners' }).getAttribute('aria-pressed')).toBe('true');
      expect(screen.queryByRole('option', { name: 'Emaar' })).toBeNull();
      expect(screen.getByRole('option', { name: 'Ali Hassan (Property owner)' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Developers' }));
      expect(screen.getByRole('option', { name: 'Emaar' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Ali Hassan (Property owner)' })).toBeNull();
    });

    it('When the saved developer is filtered out Then it stays selectable', async () => {
      mockSearchDevelopers.mockResolvedValue(mixed);
      render(<Harness initial={{ developer_partner_id: 'o1' }} />);
      await waitFor(() => expect(screen.getByRole('group', { name: 'Developer filter' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Developers' }));
      expect(screen.getByRole('option', { name: 'Ali Hassan (Property owner)' })).toBeInTheDocument();
      expect((screen.getByLabelText('Developer') as HTMLSelectElement).value).toBe('o1');
    });
  });
});

describe('ProjectDetailsSection payment plans', () => {
  describe('Given a legacy free-text payment plan', () => {
    it('Then it shows read-only', async () => {
      render(<Harness initial={{ payment_plan: '20/80' }} />);
      const input = screen.getByLabelText('Payment plan') as HTMLInputElement;
      expect(input.value).toBe('20/80');
      expect(input.readOnly).toBe(true);
      expect(screen.getByText('Payment plan (legacy)')).toBeInTheDocument();
      await waitFor(() => expect(mockSearchDevelopers).toHaveBeenCalled());
    });
  });

  describe('Given no legacy plan', () => {
    it('Then the legacy field is hidden and the templates editor is shown', async () => {
      render(<Harness />);
      expect(screen.queryByLabelText('Payment plan')).toBeNull();
      expect(screen.getByRole('region', { name: 'Payment plan templates' })).toBeInTheDocument();
      await waitFor(() => expect(mockSearchDevelopers).toHaveBeenCalled());
    });
  });

  describe('When a payment plan is added', () => {
    it('Then payment_plan_templates is emitted with one default template', async () => {
      render(<Harness />);
      fireEvent.click(screen.getByRole('button', { name: /Add payment plan/ }));
      const last = onChangeSpy.mock.calls[onChangeSpy.mock.calls.length - 1][0];
      expect(last.payment_plan_templates).toHaveLength(1);
      expect(last.payment_plan_templates[0].is_default).toBe(true);
      await waitFor(() => expect(mockSearchDevelopers).toHaveBeenCalled());
    });
  });
});
