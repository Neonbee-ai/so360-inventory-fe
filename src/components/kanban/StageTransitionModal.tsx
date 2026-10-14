import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Deal, DealStage } from '../../types/crm';
import { AlertCircle } from 'lucide-react';

interface StageTransitionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    deal: Deal | null;
    newStage: DealStage;
}

export const StageTransitionModal = ({ isOpen, onClose, onConfirm, deal, newStage }: StageTransitionModalProps) => {
    const [reason, setReason] = useState('');
    const isSpecialStage = newStage === 'Won' || newStage === 'Lost';

    if (!deal) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(reason);
        setReason('');
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isSpecialStage ? `Close Deal: ${newStage}` : `Move to ${newStage}`}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 bg-bg border border-line rounded-lg">
                    <p className="text-sm text-fg-muted">
                        Moving <span className="text-fg font-bold">{deal.name}</span> to the <span className="text-primary font-bold">{newStage}</span> stage.
                    </p>
                </div>

                {isSpecialStage && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-fg-muted flex items-center gap-2">
                            Reason for {newStage} *
                            <AlertCircle size={14} className="text-fg-subtle" />
                        </label>
                        <textarea
                            required
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={`Please provide a brief reason for marking this deal as ${newStage}...`}
                            className="w-full bg-bg border border-line rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-focus/50 resize-none h-24"
                        />
                    </div>
                )}

                {!isSpecialStage && (
                    <p className="text-sm text-fg-subtle italic">
                        Confirm the stage change for this opportunity.
                    </p>
                )}

                <div className="pt-4 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-lg border border-line text-fg-muted hover:bg-surface-raised transition-colors font-medium text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className={`flex-1 px-4 py-2 rounded-lg font-bold transition-all shadow-lg active:scale-95 text-sm ${newStage === 'Won' ? 'bg-success hover:bg-success text-primary-fg' :
                                newStage === 'Lost' ? 'bg-rose-600 hover:bg-rose-500 text-primary-fg' :
                                    'bg-primary hover:bg-primary-hover text-primary-fg'
                            }`}
                    >
                        Confirm Transition
                    </button>
                </div>
            </form>
        </Modal>
    );
};
