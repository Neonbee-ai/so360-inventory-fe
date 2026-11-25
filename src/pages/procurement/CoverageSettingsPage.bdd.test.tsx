import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { toast } from '@so360/design-system';

const mockGet = vi.fn();
const mockUpdate = vi.fn();
vi.mock('../../services/procurementService', () => ({
    procurementService: { getCoverageSettings: (...a: any[]) => mockGet(...a), updateCoverageSettings: (...a: any[]) => mockUpdate(...a) },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

import CoverageSettingsPage from './CoverageSettingsPage';

beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ coverage_scope: 'warehouse', default_lead_time_days: 14, consolidation_window_days: 7 });
    mockUpdate.mockResolvedValue({ coverage_scope: 'warehouse', default_lead_time_days: 14, consolidation_window_days: 7 });
    vi.spyOn(toast, 'success').mockReturnValue('t');
    vi.spyOn(toast, 'error').mockReturnValue('t');
});

describe('CoverageSettingsPage', () => {
    it('Given saved settings, When rendered, Then the coverage card shows and Save posts the form', async () => {
        render(<CoverageSettingsPage />);
        await waitFor(() => screen.getByText('Coverage'));
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ coverage_scope: 'warehouse', default_lead_time_days: 14 })));
    });

    it('Given the load fails, When rendered, Then the error is shown', async () => {
        mockGet.mockRejectedValue(new Error('boom'));
        render(<CoverageSettingsPage />);
        await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    });
});
