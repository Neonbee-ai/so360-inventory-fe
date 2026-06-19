import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import StepIndicator from './StepIndicator';

const STEPS = [
    { label: 'Upload CSV' },
    { label: 'Upload Images' },
    { label: 'Preview' },
    { label: 'Result' },
];

describe('StepIndicator', () => {
    describe('GIVEN a 4-step indicator at step 0', () => {
        it('WHEN rendered THEN all step labels are visible', () => {
            render(<StepIndicator steps={STEPS} current={0} />);
            expect(screen.getByText('Upload CSV')).toBeInTheDocument();
            expect(screen.getByText('Upload Images')).toBeInTheDocument();
            expect(screen.getByText('Preview')).toBeInTheDocument();
            expect(screen.getByText('Result')).toBeInTheDocument();
        });

        it('WHEN rendered THEN step 1 (index 0) shows number "1" (not a checkmark)', () => {
            render(<StepIndicator steps={STEPS} current={0} />);
            expect(screen.getByText('1')).toBeInTheDocument();
        });
    });

    describe('GIVEN a 4-step indicator at step 2 (Preview)', () => {
        it('WHEN rendered THEN steps 0 and 1 show the check icon (completed)', () => {
            const { container } = render(<StepIndicator steps={STEPS} current={2} />);
            // Completed steps render Check icon (svg with data-testid icon-Check via mock)
            const checks = container.querySelectorAll('[data-testid="icon-Check"]');
            expect(checks.length).toBe(2);
        });

        it('WHEN rendered THEN the active step (2) still shows its number', () => {
            render(<StepIndicator steps={STEPS} current={2} />);
            expect(screen.getByText('3')).toBeInTheDocument();
        });
    });

    describe('GIVEN a 4-step indicator at the last step (3)', () => {
        it('WHEN rendered THEN 3 checkmarks are shown for completed steps', () => {
            const { container } = render(<StepIndicator steps={STEPS} current={3} />);
            const checks = container.querySelectorAll('[data-testid="icon-Check"]');
            expect(checks.length).toBe(3);
        });
    });
});
