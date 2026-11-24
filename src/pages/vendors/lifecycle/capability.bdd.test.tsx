import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const getQualifications = vi.fn();
const createQualification = vi.fn();
const submitQualification = vi.fn();

vi.mock('../../../services/vendorService', () => ({
  vendorService: {
    getQualifications: (...a: any[]) => getQualifications(...a),
    createQualification: (...a: any[]) => createQualification(...a),
    submitQualification: (...a: any[]) => submitQualification(...a),
  },
}));

import VendorQualificationsPanel, { buildCapability } from './VendorQualificationsPanel';

const blank = { process: '', grades: '', brands: '', certs: '', tolerance: '', maxDim: '', leadTime: '' };

beforeEach(() => vi.clearAllMocks());

describe('buildCapability', () => {
  it('Given nothing filled in / Then no capability is sent', () => expect(buildCapability(blank)).toBeUndefined());
  it('Given a process and two grades / Then lists are trimmed', () => {
    expect(buildCapability({ ...blank, process: 'cnc', grades: ' SS304 , SS316 ,' })).toEqual({ process_family: ['cnc'], material_grade: ['SS304', 'SS316'] });
  });
  it('Given numbers as text / Then they are numbers; junk is ignored', () => {
    expect(buildCapability({ ...blank, tolerance: '0.05', maxDim: '1200', leadTime: 'abc' })).toEqual({ tolerance_mm: 0.05, max_dimension_mm: 1200 });
  });
  it('Given a zero tolerance / Then it is kept (0 is a value, not blank)', () => {
    expect(buildCapability({ ...blank, tolerance: '0' })).toEqual({ tolerance_mm: 0 });
  });
});

describe('VendorQualificationsPanel capability', () => {
  it('Given a qualification with capability / When listed / Then a readable summary shows', async () => {
    getQualifications.mockResolvedValue([{ id: 'q1', category_id: null, service_code: null, trade: null, territories: null, risk_tier: 'low', status: 'approved', valid_to: null, version: 1, is_legacy: false, capability: { process_family: ['cnc'], material_grade: ['SS304'], tolerance_mm: 0.1, lead_time_days: 14 } }]);
    render(<VendorQualificationsPanel vendorId="v" canEdit />);
    await waitFor(() => screen.getByText('cnc · SS304 · tolerance 0.1 mm · 14 day lead time'));
  });

  it('Given a legacy qualification without capability / When listed / Then a dash', async () => {
    getQualifications.mockResolvedValue([{ id: 'q1', category_id: null, service_code: null, trade: null, territories: null, risk_tier: null, status: 'approved', valid_to: null, version: 1, is_legacy: true, capability: null }]);
    render(<VendorQualificationsPanel vendorId="v" canEdit />);
    await waitFor(() => screen.getByText('All categories (legacy)'));
  });

  it('Given the add form / When grades and tolerance are filled / Then the API receives the capability', async () => {
    getQualifications.mockResolvedValue([]);
    createQualification.mockResolvedValue({ id: 'q9' });
    submitQualification.mockResolvedValue({});
    render(<VendorQualificationsPanel vendorId="v" canEdit />);
    await waitFor(() => screen.getByText('Add qualification'));
    fireEvent.click(screen.getByText('Add qualification'));
    fireEvent.change(await screen.findByLabelText('Material grades (comma separated)'), { target: { value: 'SS304' } });
    fireEvent.change(screen.getByLabelText('Tightest tolerance held (mm)'), { target: { value: '0.1' } });
    fireEvent.click(screen.getByText('Submit for approval'));
    await waitFor(() => expect(createQualification).toHaveBeenCalledWith('v', expect.objectContaining({ capability: { material_grade: ['SS304'], tolerance_mm: 0.1 } })));
    expect(submitQualification).toHaveBeenCalledWith('q9');
  });

  it('Given an invalid capability from the API / When submitted / Then the message shows', async () => {
    getQualifications.mockResolvedValue([]);
    createQualification.mockRejectedValue(new Error('unknown process_family: magic'));
    render(<VendorQualificationsPanel vendorId="v" canEdit />);
    await waitFor(() => screen.getByText('Add qualification'));
    fireEvent.click(screen.getByText('Add qualification'));
    fireEvent.click(await screen.findByText('Submit for approval'));
    await waitFor(() => screen.getByText('unknown process_family: magic'));
  });
});
