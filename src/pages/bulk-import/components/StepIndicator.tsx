import React from 'react';
import { Check } from 'lucide-react';

interface Step { label: string; }

interface Props {
    steps: Step[];
    current: number;
}

const StepIndicator: React.FC<Props> = ({ steps, current }) => (
    <div className="flex items-center gap-0 mb-8">
        {steps.map((step, i) => {
            const done = i < current;
            const active = i === current;
            return (
                <React.Fragment key={i}>
                    <div className="flex flex-col items-center gap-1.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                            done
                                ? 'bg-success border-success text-primary-fg'
                                : active
                                    ? 'bg-primary border-primary text-primary-fg'
                                    : 'bg-surface border-line-strong text-fg-subtle'
                        }`}>
                            {done ? <Check size={14} /> : i + 1}
                        </div>
                        <span className={`text-[10px] font-medium whitespace-nowrap ${
                            active ? 'text-fg' : done ? 'text-success' : 'text-fg-subtle'
                        }`}>{step.label}</span>
                    </div>
                    {i < steps.length - 1 && (
                        <div className={`flex-1 h-px mx-2 mb-4 transition-all ${done ? 'bg-success' : 'bg-surface-raised'}`} />
                    )}
                </React.Fragment>
            );
        })}
    </div>
);

export default StepIndicator;
