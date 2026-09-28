/**
 * ProjectDetailsSection — RFP §4 project fields (plan G2) BDD specs.
 * Every field writes into the controlled metadata draft; blanks become null.
 */
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSearchDevelopers = vi.fn();
vi.mock('../../services/inventoryService', () => ({
  inventoryService: { searchDevelopers: (...a: any[]) => mockSearchDevelopers(...a) },
}));
vi.mock('../../services/mediaService', () => ({ mediaService: { uploadFile: vi.fn() } }));

import { ProjectDetailsSection, numberOrNull, parseList } from './ProjectDetailsSection';
import type { CategoryMetadata } from '../../types/inventory';

const onChangeSpy = vi.fn();

const Harness: React.FC<{ initial?: CategoryMetadata; disabled?: boolean }> = ({ initial = {}, disabled }) => {
  const [value, setValue] = useState<CategoryMetadata>(initial);
  return (
    <ProjectDetailsSection value={value} disabled={disabled} onChange={(next) => { onChangeSpy(next); setValue(next); }} />
  );
};

const last = () => onChangeSpy.mock.calls[onChangeSpy.mock.calls.length - 1][0] as CategoryMetadata;
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  mockSearchDevelopers.mockReset();
  mockSearchDevelopers.mockResolvedValue([]);
  onChangeSpy.mockReset();
});

describe('Given the parsing helpers', () => {
  it('Then numberOrNull reads numbers and maps blank or invalid text to null', () => {
    expect(numberOrNull('2.5')).toBe(2.5);
    expect(numberOrNull('0')).toBe(0);
    expect(numberOrNull('  ')).toBeNull();
    expect(numberOrNull('abc')).toBeNull();
  });

  it('Then parseList trims entries, drops blanks and maps an empty list to null', () => {
    expect(parseList(' Pool , Gym,, ')).toEqual(['Pool', 'Gym']);
    expect(parseList(' , ')).toBeNull();
    expect(parseList('')).toBeNull();
  });
});

describe('Given an empty project draft', () => {
  describe('When the text fields are typed and then cleared', () => {
    it.each([
      ['Project code', 'project_code', 'SKY-01'],
      ['City', 'city', 'Dubai'],
      ['Country', 'country', 'AE'],
      ['Payment plan', 'payment_plan', '20/80'],
      ['Description', 'description', 'Waterfront towers'],
    ])('Then %s writes %s and a blank clears it', async (label, key, text) => {
      render(<Harness />);
      type(label, text);
      expect(last()).toEqual({ [key]: text });
      type(label, '   ');
      expect(last()).toEqual({ [key]: null });
      await waitFor(() => expect(mockSearchDevelopers).toHaveBeenCalled());
    });
  });

  describe('When a project status is picked and then unset', () => {
    it('Then every lifecycle status is offered and the choice is written', () => {
      render(<Harness />);
      const select = screen.getByLabelText('Project status') as HTMLSelectElement;
      expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
        'Not set', 'Planned', 'Launched', 'Under construction', 'Ready', 'Completed', 'On hold',
      ]);
      type('Project status', 'under_construction');
      expect(last()).toEqual({ project_status: 'under_construction' });
      type('Project status', '');
      expect(last()).toEqual({ project_status: null });
    });
  });

  describe('When launch and completion dates are set and cleared', () => {
    it('Then ISO dates are written and a blank clears them', () => {
      render(<Harness />);
      type('Launch date', '2026-01-15');
      type('Completion date', '2028-06-30');
      expect(last()).toEqual({ launch_date: '2026-01-15', completion_date: '2028-06-30' });
      type('Launch date', '');
      expect(last()).toEqual({ launch_date: null, completion_date: '2028-06-30' });
    });
  });

  describe('When a price range is entered and emptied', () => {
    it('Then both bounds are kept and an all-blank range becomes null', () => {
      render(<Harness />);
      type('Price from', '1200000');
      type('Price to', '4500000');
      expect(last()).toEqual({ price_range: { min: 1200000, max: 4500000 } });
      type('Price from', '');
      expect(last()).toEqual({ price_range: { min: null, max: 4500000 } });
      type('Price to', '');
      expect(last()).toEqual({ price_range: null });
    });
  });

  describe('When a commission is entered and cleared', () => {
    it('Then the number is written and a blank is null', () => {
      render(<Harness />);
      type('Commission %', '2.5');
      expect(last()).toEqual({ commission_percent: 2.5 });
      type('Commission %', '');
      expect(last()).toEqual({ commission_percent: null });
    });
  });

  describe('When a map pin is entered and emptied', () => {
    it('Then lat, lng and url are kept and an all-blank pin becomes null', () => {
      render(<Harness />);
      type('Map latitude', '25.08');
      type('Map longitude', '55.14');
      type('Map link', ' https://maps.example.com/?q=sky ');
      expect(last()).toEqual({ map: { lat: 25.08, lng: 55.14, url: 'https://maps.example.com/?q=sky' } });
      type('Map latitude', '');
      type('Map longitude', '');
      type('Map link', ' ');
      expect(last()).toEqual({ map: null });
    });
  });

  describe('When a list field is typed', () => {
    it.each([
      ['Property types', 'property_types', 'Apartment, Penthouse', ['Apartment', 'Penthouse']],
      ['Amenities', 'amenities', 'Pool,Gym', ['Pool', 'Gym']],
      ['Image URLs', 'images', 'https://cdn/a.jpg', ['https://cdn/a.jpg']],
      ['Video URLs', 'videos', 'https://v/1, https://v/2', ['https://v/1', 'https://v/2']],
      ['Floor plan URLs', 'floor_plans', 'https://cdn/fp.pdf', ['https://cdn/fp.pdf']],
      ['Document URLs', 'documents', 'https://cdn/spa.pdf', ['https://cdn/spa.pdf']],
      ['Assigned user IDs', 'assigned_user_ids', 'u-1, u-2', ['u-1', 'u-2']],
      ['Assigned team IDs', 'assigned_team_ids', 't-1', ['t-1']],
    ])('Then %s commits the parsed %s only on blur', (label, key, text, list) => {
      render(<Harness />);
      type(label, `${text}, `);
      expect(onChangeSpy).not.toHaveBeenCalled();
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(`${text}, `);
      fireEvent.blur(screen.getByLabelText(label));
      expect(last()).toEqual({ [key]: list });
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(list.join(', '));
    });
  });
});

describe('Given a saved project with every field', () => {
  const saved: CategoryMetadata = {
    project_code: 'SKY-01',
    project_status: 'ready',
    launch_date: '2026-01-15T00:00:00Z',
    completion_date: '2028-06-30',
    city: 'Dubai',
    country: 'AE',
    price_range: { min: 1, max: 2 },
    payment_plan: '20/80',
    commission_percent: 2.5,
    description: 'Towers',
    amenities: ['Pool', 'Gym'],
    map: { lat: 25, lng: 55, url: 'https://m' },
  };

  describe('When the section renders', () => {
    it('Then each input shows the stored value (dates trimmed to the day)', () => {
      render(<Harness initial={saved} />);
      const val = (l: string) => (screen.getByLabelText(l) as HTMLInputElement).value;
      expect(val('Project code')).toBe('SKY-01');
      expect(val('Project status')).toBe('ready');
      expect(val('Launch date')).toBe('2026-01-15');
      expect(val('Completion date')).toBe('2028-06-30');
      expect(val('Price from')).toBe('1');
      expect(val('Price to')).toBe('2');
      expect(val('Commission %')).toBe('2.5');
      expect(val('Amenities')).toBe('Pool, Gym');
      expect(val('Map latitude')).toBe('25');
      expect(val('Map link')).toBe('https://m');
      expect(val('Description')).toBe('Towers');
    });
  });

  describe('When a list is cleared and blurred', () => {
    it('Then the list is stored as null and other fields are kept', () => {
      render(<Harness initial={saved} />);
      type('Amenities', '');
      fireEvent.blur(screen.getByLabelText('Amenities'));
      expect(last()).toEqual({ ...saved, amenities: null });
    });
  });

  describe('When one price bound changes', () => {
    it('Then the other bound is preserved', () => {
      render(<Harness initial={saved} />);
      type('Price to', '9');
      expect(last().price_range).toEqual({ min: 1, max: 9 });
    });
  });

  describe('When the section is disabled', () => {
    it('Then the new inputs are disabled', () => {
      render(<Harness initial={saved} disabled />);
      for (const l of ['Project code', 'Project status', 'Launch date', 'Price from', 'Commission %', 'Amenities', 'Map link', 'Description']) {
        expect(screen.getByLabelText(l)).toBeDisabled();
      }
    });
  });
});
