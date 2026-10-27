import React, { useState } from 'react';
import { Modal, Textarea, Button } from '@so360/design-system';
import { Deal, DealStage } from '../../types/crm';

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
            open={isOpen}
            onClose={onClose}
            title={isSpecialStage ? `Close Deal: ${newStage}` : `Move to ${newStage}`}
            footer={
                <div className="flex justify-end gap-nb-2">
                    <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
                    <Button variant={newStage === 'Lost' ? 'danger' : 'primary'} type="submit" form="stage-transition-form">
                        Confirm Transition
                    </Button>
                </div>
            }
        >
            <form id="stage-transition-form" onSubmit={handleSubmit} className="flex flex-col gap-nb-4">
                <p className="text-nb-body text-fg-muted">
                    Moving <span className="font-semibold text-fg">{deal.name}</span> to the <span className="font-semibold text-primary">{newStage}</span> stage.
                </p>

                {isSpecialStage && (
                    <Textarea
                        name="reason"
                        label={`Reason for ${newStage} *`}
                        required
                        rows={4}
                        value={reason}
                        onChange={(e: any) => setReason(e.target.value)}
                        placeholder={`Please provide a brief reason for marking this deal as ${newStage}...`}
                    />
                )}

                {!isSpecialStage && (
                    <p className="text-nb-caption text-fg-subtle">
                        Confirm the stage change for this opportunity.
                    </p>
                )}
            </form>
        </Modal>
    );
};
