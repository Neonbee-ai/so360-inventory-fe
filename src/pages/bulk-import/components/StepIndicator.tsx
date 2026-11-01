import React from 'react';
import { Stepper } from '@so360/design-system';

interface Step { label: string; }

interface Props {
    steps: Step[];
    current: number;
}

const StepIndicator: React.FC<Props> = ({ steps, current }) => (
    <div className="mb-nb-6">
        <Stepper steps={steps} current={current} />
    </div>
);

export default StepIndicator;
