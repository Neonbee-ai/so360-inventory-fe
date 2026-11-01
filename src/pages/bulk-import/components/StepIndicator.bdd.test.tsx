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

describe('StepIndicator (Comb Stepper)', () => {
    it('GIVEN 4 steps WHEN rendered THEN all labels are visible', () => {
        render(<StepIndicator steps={STEPS} current={0} />);
        STEPS.forEach(s => expect(screen.getByText(s.label)).toBeInTheDocument());
    });

    it('GIVEN current=0 WHEN rendered THEN first step is current', () => {
        render(<StepIndicator steps={STEPS} current={0} />);
        expect(screen.getByText('Upload CSV')).toHaveAttribute('aria-current', 'step');
    });

    it('GIVEN current=2 WHEN rendered THEN two earlier steps are done', () => {
        render(<StepIndicator steps={STEPS} current={2} />);
        expect(screen.getByText('Upload CSV')).toHaveAttribute('data-state', 'done');
        expect(screen.getByText('Upload Images')).toHaveAttribute('data-state', 'done');
        expect(screen.getByText('Preview')).toHaveAttribute('aria-current', 'step');
        expect(screen.getByText('Result')).toHaveAttribute('data-state', 'todo');
    });
});
