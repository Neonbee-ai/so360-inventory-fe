/**
 * DeveloperCard — RFP §3 developer (a Core partner) with its linked projects (plan G1).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDeveloper = vi.fn();
const mockUpdateDeveloper = vi.fn();
vi.mock('../../services/inventoryService', () => ({
  inventoryService: {
    getDeveloper: (...a: any[]) => mockGetDeveloper(...a),
    updateDeveloper: (...a: any[]) => mockUpdateDeveloper(...a),
  },
}));

import { DeveloperCard, toDeveloperUpdate } from './DeveloperCard';
import type { DeveloperProfile } from '../../types/inventory';

const profile = (over: Partial<DeveloperProfile> = {}): DeveloperProfile => ({
  id: 'd1',
  name: 'Emaar',
  company: 'Emaar Properties PJSC',
  contact_name: 'Sara Ali',
  email: 'sales@emaar.example',
  phone: '+971 4 000 0000',
  website: 'emaar.example',
  address: 'Downtown, Dubai',
  country: 'AE',
  description: 'Master developer',
  logo_url: 'https://cdn.example.com/emaar.png',
  account_manager: 'Omar',
  account_manager_user_id: 'u-omar',
  status: 'active',
  notes: 'Key account',
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-02-03T00:00:00Z',
  ...over,
});

const empty = profile({
  company: null, contact_name: null, email: null, phone: null, website: null, address: null, country: null,
  description: null, logo_url: null, account_manager: null, account_manager_user_id: null, status: null, notes: null, created_at: null, updated_at: null,
});

const projects = [{ id: 'p1', name: 'Marina Heights' }, { id: 'p2', name: 'Sky Towers' }];

beforeEach(() => {
  mockGetDeveloper.mockReset();
  mockUpdateDeveloper.mockReset();
});

describe('Given a developer with every RFP §3 field', () => {
  beforeEach(() => mockGetDeveloper.mockResolvedValue(profile()));

  describe('When the card loads', () => {
    it('Then it fetches that partner and shows logo, status and every field', async () => {
      render(<DeveloperCard partnerId="d1" projects={projects} />);
      expect(screen.getByTestId('developer-loading')).toBeTruthy();
      const card = await screen.findByTestId('developer-card');
      expect(mockGetDeveloper).toHaveBeenCalledWith('d1');
      expect(screen.getByAltText('Emaar logo').getAttribute('src')).toBe('https://cdn.example.com/emaar.png');
      expect(screen.getByTestId('developer-status').textContent).toBe('active');
      expect(screen.getByTestId('developer-status').className).toContain('emerald');
      const text = card.textContent || '';
      for (const s of ['Emaar Properties PJSC', 'Master developer', 'Sara Ali', 'Downtown, Dubai', 'CountryAE',
        'Account managerOmar', 'NotesKey account',
        `Created${new Date('2026-01-02T00:00:00Z').toLocaleDateString()}`,
        `Modified${new Date('2026-02-03T00:00:00Z').toLocaleDateString()}`]) {
        expect(text).toContain(s);
      }
      expect(screen.getByText('+971 4 000 0000').getAttribute('href')).toBe('tel:+971 4 000 0000');
      expect(screen.getByText('sales@emaar.example').getAttribute('href')).toBe('mailto:sales@emaar.example');
      expect(screen.getByText('emaar.example').getAttribute('href')).toBe('https://emaar.example/');
    });

    it('Then its linked projects are listed and one tap selects a project', async () => {
      const onSelect = vi.fn();
      render(<DeveloperCard partnerId="d1" projects={projects} currentProjectId="p1" onSelectProject={onSelect} />);
      await screen.findByTestId('developer-card');
      expect(screen.getByText('Projects (2)')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Marina Heights' }).getAttribute('aria-current')).toBe('true');
      expect(screen.getByRole('button', { name: 'Sky Towers' }).getAttribute('aria-current')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Sky Towers' }));
      expect(onSelect).toHaveBeenCalledWith('p2');
    });

    it('Then a project tap without a handler does nothing', async () => {
      render(<DeveloperCard partnerId="d1" projects={projects} />);
      await screen.findByTestId('developer-card');
      fireEvent.click(screen.getByRole('button', { name: 'Sky Towers' }));
      expect(screen.getByTestId('developer-card')).toBeTruthy();
    });
  });

  describe('When the logo fails to load', () => {
    it('Then the initial avatar replaces it', async () => {
      render(<DeveloperCard partnerId="d1" projects={projects} />);
      fireEvent.error(await screen.findByAltText('Emaar logo'));
      expect(screen.getByTestId('developer-initial').textContent).toBe('E');
      expect(screen.queryByAltText('Emaar logo')).toBeNull();
    });
  });
});

describe('Given a developer with only a name', () => {
  describe('When the card loads with no linked projects', () => {
    it('Then only the name, initial and empty-projects hint show', async () => {
      mockGetDeveloper.mockResolvedValue(empty);
      render(<DeveloperCard partnerId="d1" projects={[]} />);
      const card = await screen.findByTestId('developer-card');
      expect(screen.getByTestId('developer-initial').textContent).toBe('E');
      expect(screen.queryByTestId('developer-status')).toBeNull();
      expect(card.textContent).not.toContain('Contact');
      expect(card.textContent).not.toContain('Created');
      expect(screen.getByText('No projects linked yet.')).toBeTruthy();
      expect(screen.queryByTestId('developer-projects')).toBeNull();
    });
  });
});

describe('Given a developer whose company equals its name, an inactive status and odd values', () => {
  describe('When the card loads', () => {
    it('Then the duplicate company is hidden, status is neutral, a bad website is plain text and a bad date is raw', async () => {
      mockGetDeveloper.mockResolvedValue(profile({
        company: 'Emaar', status: 'inactive', website: 'exa mple', created_at: 'long ago', logo_url: null,
      }));
      render(<DeveloperCard partnerId="d1" projects={projects} />);
      const card = await screen.findByTestId('developer-card');
      expect(screen.getAllByText('Emaar')).toHaveLength(1);
      expect(screen.getByTestId('developer-status').className).toContain('slate');
      expect(screen.getByText('exa mple').tagName).not.toBe('A');
      expect(card.textContent).toContain('Createdlong ago');
    });

    it('Then an explicit http website is kept as is', async () => {
      mockGetDeveloper.mockResolvedValue(profile({ website: 'http://emaar.example/about' }));
      render(<DeveloperCard partnerId="d1" projects={projects} />);
      await screen.findByTestId('developer-card');
      expect(screen.getByText('http://emaar.example/about').getAttribute('href')).toBe('http://emaar.example/about');
    });

    it('Then a script link is never rendered as an anchor', async () => {
      mockGetDeveloper.mockResolvedValue(profile({ website: 'javascript:alert(1)' }));
      render(<DeveloperCard partnerId="d1" projects={projects} />);
      await screen.findByTestId('developer-card');
      expect(screen.getByText('javascript:alert(1)').tagName).not.toBe('A');
    });
  });
});

describe('Given the developer lookup fails', () => {
  describe('When it rejects with a message', () => {
    it('Then the message shows and Retry loads the card', async () => {
      mockGetDeveloper.mockRejectedValueOnce(new Error('Request failed (404)')).mockResolvedValueOnce(profile());
      render(<DeveloperCard partnerId="d1" projects={projects} />);
      expect(await screen.findByText(/Request failed \(404\)/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
      expect(await screen.findByTestId('developer-card')).toBeTruthy();
      expect(mockGetDeveloper).toHaveBeenCalledTimes(2);
    });
  });

  describe('When it rejects without a message', () => {
    it('Then a generic error shows', async () => {
      mockGetDeveloper.mockRejectedValue({});
      render(<DeveloperCard partnerId="d1" projects={projects} />);
      expect(await screen.findByTestId('developer-error')).toBeTruthy();
      expect(screen.getByTestId('developer-error').textContent).toContain('Failed to load developer');
    });
  });

  describe('When it resolves with nothing', () => {
    it('Then the generic error shows', async () => {
      mockGetDeveloper.mockResolvedValue(null);
      render(<DeveloperCard partnerId="d1" projects={projects} />);
      expect(await screen.findByTestId('developer-error')).toBeTruthy();
    });
  });
});

describe('Given the card unmounts or the partner changes mid-request', () => {
  it('Then a late success or failure is ignored', async () => {
    let resolveFirst!: (v: DeveloperProfile) => void;
    let rejectSecond!: (e: unknown) => void;
    mockGetDeveloper
      .mockReturnValueOnce(new Promise((r) => { resolveFirst = r; }))
      .mockReturnValueOnce(new Promise((_, rej) => { rejectSecond = rej; }))
      .mockResolvedValueOnce(profile({ name: 'Sobha' }));
    const { rerender, unmount } = render(<DeveloperCard partnerId="d1" projects={projects} />);
    rerender(<DeveloperCard partnerId="d2" projects={projects} />);
    resolveFirst(profile());
    rerender(<DeveloperCard partnerId="d3" projects={projects} />);
    rejectSecond(new Error('late'));
    expect(await screen.findByText('Sobha')).toBeTruthy();
    expect(screen.queryByText('Emaar')).toBeNull();
    expect(screen.queryByText(/late/)).toBeNull();
    unmount();
    await waitFor(() => expect(mockGetDeveloper).toHaveBeenCalledTimes(3));
  });
});

describe('Given a developer with an account manager id but no name', () => {
  it('Then the id is shown as the account manager', async () => {
    mockGetDeveloper.mockResolvedValue(profile({ account_manager: null, account_manager_user_id: 'u-9' }));
    render(<DeveloperCard partnerId="d1" projects={projects} />);
    const card = await screen.findByTestId('developer-card');
    expect(card.textContent).toContain('Account manageru-9');
  });
});

describe('Given a user without edit rights', () => {
  it('Then no Edit button is offered', async () => {
    mockGetDeveloper.mockResolvedValue(profile());
    render(<DeveloperCard partnerId="d1" projects={projects} />);
    await screen.findByTestId('developer-card');
    expect(screen.queryByRole('button', { name: 'Edit developer' })).toBeNull();
  });
});

describe('Given a manager editing the developer', () => {
  describe('When they open the edit form', () => {
    it('Then it is prefilled from the developer', async () => {
      mockGetDeveloper.mockResolvedValue(profile());
      render(<DeveloperCard partnerId="d1" projects={projects} canEdit />);
      await screen.findByTestId('developer-card');
      fireEvent.click(screen.getByRole('button', { name: 'Edit developer' }));
      expect((screen.getByLabelText('Developer website') as HTMLInputElement).value).toBe('emaar.example');
      expect((screen.getByLabelText('Developer logo URL') as HTMLInputElement).value).toBe('https://cdn.example.com/emaar.png');
      expect((screen.getByLabelText('Developer status') as HTMLSelectElement).value).toBe('active');
      expect((screen.getByLabelText('Account manager user ID') as HTMLInputElement).value).toBe('u-omar');
      expect(screen.queryByRole('button', { name: 'Edit developer' })).toBeNull();
    });

    it('Then an empty or unknown status and blank fields start empty', async () => {
      mockGetDeveloper.mockResolvedValue(profile({ status: 'Archived', website: null, logo_url: null, account_manager_user_id: null }));
      render(<DeveloperCard partnerId="d1" projects={projects} canEdit />);
      await screen.findByTestId('developer-card');
      fireEvent.click(screen.getByRole('button', { name: 'Edit developer' }));
      expect((screen.getByLabelText('Developer status') as HTMLSelectElement).value).toBe('');
      expect((screen.getByLabelText('Developer website') as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText('Account manager user ID') as HTMLInputElement).value).toBe('');
    });

    it('Then a developer with no status still offers Edit', async () => {
      mockGetDeveloper.mockResolvedValue(empty);
      render(<DeveloperCard partnerId="d1" projects={[]} canEdit />);
      await screen.findByTestId('developer-card');
      expect(screen.getByRole('button', { name: 'Edit developer' })).toBeTruthy();
    });
  });

  describe('When they change fields and save', () => {
    it('Then only the set fields are sent and the card reloads', async () => {
      mockGetDeveloper.mockResolvedValue(profile({ status: null }));
      mockUpdateDeveloper.mockResolvedValue({});
      render(<DeveloperCard partnerId="d1" projects={projects} canEdit />);
      await screen.findByTestId('developer-card');
      fireEvent.click(screen.getByRole('button', { name: 'Edit developer' }));
      fireEvent.change(screen.getByLabelText('Developer website'), { target: { value: ' https://emaar.ae ' } });
      fireEvent.change(screen.getByLabelText('Developer logo URL'), { target: { value: '' } });
      fireEvent.change(screen.getByLabelText('Developer status'), { target: { value: 'inactive' } });
      fireEvent.change(screen.getByLabelText('Account manager user ID'), { target: { value: 'u-2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save developer' }));
      await waitFor(() => expect(mockUpdateDeveloper).toHaveBeenCalledWith('d1', {
        website: 'https://emaar.ae', status: 'inactive', account_manager_user_id: 'u-2',
      }));
      await waitFor(() => expect(mockGetDeveloper).toHaveBeenCalledTimes(2));
      expect(screen.queryByTestId('developer-edit')).toBeNull();
    });

    it('Then picking Not set clears the status choice', async () => {
      mockGetDeveloper.mockResolvedValue(profile());
      render(<DeveloperCard partnerId="d1" projects={projects} canEdit />);
      await screen.findByTestId('developer-card');
      fireEvent.click(screen.getByRole('button', { name: 'Edit developer' }));
      fireEvent.change(screen.getByLabelText('Developer status'), { target: { value: '' } });
      expect((screen.getByLabelText('Developer status') as HTMLSelectElement).value).toBe('');
    });
  });

  describe('When every field is blank and they save', () => {
    it('Then nothing is sent and the form closes', async () => {
      mockGetDeveloper.mockResolvedValue(empty);
      render(<DeveloperCard partnerId="d1" projects={[]} canEdit />);
      await screen.findByTestId('developer-card');
      fireEvent.click(screen.getByRole('button', { name: 'Edit developer' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save developer' }));
      expect(mockUpdateDeveloper).not.toHaveBeenCalled();
      expect(screen.queryByTestId('developer-edit')).toBeNull();
    });
  });

  describe('When the save fails', () => {
    it('Then the error shows and the form stays open', async () => {
      mockGetDeveloper.mockResolvedValue(profile());
      mockUpdateDeveloper.mockRejectedValueOnce(new Error('Request failed (403)'));
      render(<DeveloperCard partnerId="d1" projects={projects} canEdit />);
      await screen.findByTestId('developer-card');
      fireEvent.click(screen.getByRole('button', { name: 'Edit developer' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save developer' }));
      expect(await screen.findByText('Request failed (403)')).toBeTruthy();
      expect(screen.getByTestId('developer-edit')).toBeTruthy();
    });

    it('Then a failure without a message shows a generic error', async () => {
      mockGetDeveloper.mockResolvedValue(profile());
      mockUpdateDeveloper.mockRejectedValueOnce({});
      render(<DeveloperCard partnerId="d1" projects={projects} canEdit />);
      await screen.findByTestId('developer-card');
      fireEvent.click(screen.getByRole('button', { name: 'Edit developer' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save developer' }));
      expect(await screen.findByText('Failed to save developer')).toBeTruthy();
    });

    it('Then Saving… shows while the request is in flight', async () => {
      mockGetDeveloper.mockResolvedValue(profile());
      let finish!: () => void;
      mockUpdateDeveloper.mockReturnValueOnce(new Promise<void>((r) => { finish = r; }));
      render(<DeveloperCard partnerId="d1" projects={projects} canEdit />);
      await screen.findByTestId('developer-card');
      fireEvent.click(screen.getByRole('button', { name: 'Edit developer' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save developer' }));
      expect(await screen.findByText('Saving…')).toBeTruthy();
      finish();
      await waitFor(() => expect(screen.queryByTestId('developer-edit')).toBeNull());
    });
  });

  describe('When they cancel', () => {
    it('Then the form closes without saving', async () => {
      mockGetDeveloper.mockResolvedValue(profile());
      render(<DeveloperCard partnerId="d1" projects={projects} canEdit />);
      await screen.findByTestId('developer-card');
      fireEvent.click(screen.getByRole('button', { name: 'Edit developer' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByTestId('developer-edit')).toBeNull();
      expect(mockUpdateDeveloper).not.toHaveBeenCalled();
    });
  });
});

describe('Given toDeveloperUpdate', () => {
  it('Then blank values are dropped and text is trimmed', () => {
    expect(toDeveloperUpdate({ website: ' ', logo_url: ' x ', status: '', account_manager_user_id: '' })).toEqual({ logo_url: 'x' });
  });
});
