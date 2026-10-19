import React, { useState, useEffect } from 'react';
import { inventoryService } from '../../services/inventoryService';
import { Button } from '@so360/design-system';
import {
    Shield, CheckCircle2, XCircle, ArrowRight,
    Loader2, AlertTriangle, Archive, Play, RotateCcw,
    Send, Clock
} from 'lucide-react';

interface Gate {
    name: string;
    passed: boolean;
    detail?: string;
}

interface LifecycleStatusPanelProps {
    itemId: string;
    productStatus: string;
    onStatusChange?: (newStatus: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
    draft: { label: 'Draft', color: 'text-fg-muted', bgColor: 'bg-surface-sunken', borderColor: 'border-line-strong/20' },
    pending_review: { label: 'Pending Review', color: 'text-warning', bgColor: 'bg-warning/10', borderColor: 'border-warning/20' },
    active: { label: 'Active', color: 'text-success', bgColor: 'bg-success/10', borderColor: 'border-success/20' },
    archived: { label: 'Archived', color: 'text-rose-400', bgColor: 'bg-rose-500/10', borderColor: 'border-rose-500/20' },
};

const TRANSITIONS: Record<string, Array<{ code: string; label: string; icon: React.ReactNode; variant: 'primary' | 'secondary' | 'danger' }>> = {
    draft: [
        { code: 'submit_for_review', label: 'Submit for Review', icon: <Send size={14} />, variant: 'primary' },
    ],
    pending_review: [
        { code: 'activate', label: 'Activate', icon: <Play size={14} />, variant: 'primary' },
        { code: 'reject', label: 'Return to Draft', icon: <RotateCcw size={14} />, variant: 'secondary' },
    ],
    active: [
        { code: 'archive', label: 'Archive', icon: <Archive size={14} />, variant: 'danger' },
    ],
    archived: [
        { code: 'reactivate', label: 'Reactivate', icon: <RotateCcw size={14} />, variant: 'secondary' },
    ],
};

const LifecycleStatusPanel: React.FC<LifecycleStatusPanelProps> = ({
    itemId,
    productStatus,
    onStatusChange,
}) => {
    const [gates, setGates] = useState<Gate[]>([]);
    const [isLoadingGates, setIsLoadingGates] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [transitionError, setTransitionError] = useState<string | null>(null);
    const [currentStatus, setCurrentStatus] = useState(productStatus);

    const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.draft;
    const availableTransitions = TRANSITIONS[currentStatus] || [];

    useEffect(() => {
        setCurrentStatus(productStatus);
    }, [productStatus]);

    useEffect(() => {
        loadGates();
    }, [itemId, currentStatus]);

    const loadGates = async () => {
        setIsLoadingGates(true);
        try {
            const result = await inventoryService.getLifecycleGates(itemId);
            setGates(result.gates || []);
        } catch {
            // Gates unavailable — not critical
            setGates([]);
        } finally {
            setIsLoadingGates(false);
        }
    };

    const handleTransition = async (transitionCode: string) => {
        setIsTransitioning(true);
        setTransitionError(null);
        try {
            const result = await inventoryService.transitionLifecycle(itemId, transitionCode);
            const newStatus = result.product_status || currentStatus;
            setCurrentStatus(newStatus);
            onStatusChange?.(newStatus);
        } catch (err: any) {
            setTransitionError(err.message || 'Transition failed');
        } finally {
            setIsTransitioning(false);
        }
    };

    // State machine visual
    const states = ['draft', 'pending_review', 'active', 'archived'];
    const currentIndex = states.indexOf(currentStatus);

    return (
        <div className="bg-surface/50 border border-line rounded-2xl p-6 hover:border-line-strong transition-colors">
            <div className="flex items-center gap-2 mb-4">
                <Shield size={16} className="text-primary" />
                <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider">Product Lifecycle</h3>
            </div>

            {/* Current Status Badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusConfig.bgColor} ${statusConfig.borderColor} border mb-4`}>
                <span className={`w-2 h-2 rounded-full ${currentStatus === 'active' ? 'bg-emerald-400 animate-pulse' : currentStatus === 'archived' ? 'bg-rose-400' : 'bg-fg-muted'}`} />
                <span className={`text-sm font-semibold ${statusConfig.color}`}>{statusConfig.label}</span>
            </div>

            {/* State Machine Visual */}
            <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
                {states.map((state, i) => {
                    const isActive = state === currentStatus;
                    const isPast = i < currentIndex;
                    return (
                        <React.Fragment key={state}>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                                isActive ? 'bg-primary/10 text-primary border border-primary/30'
                                : isPast ? 'text-fg-subtle line-through'
                                : 'text-fg-subtle'
                            }`}>
                                {isPast && <CheckCircle2 size={10} className="text-success" />}
                                {isActive && <Clock size={10} />}
                                {STATUS_CONFIG[state]?.label || state}
                            </div>
                            {i < states.length - 1 && (
                                <ArrowRight size={12} className="text-fg-subtle flex-shrink-0" />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Activation Gates */}
            {currentStatus !== 'active' && currentStatus !== 'archived' && (
                <div className="mb-4">
                    <h4 className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider mb-2">Activation Gates</h4>
                    {isLoadingGates ? (
                        <div className="flex items-center gap-2 text-fg-subtle text-xs">
                            <Loader2 size={12} className="animate-spin" />
                            Checking gates...
                        </div>
                    ) : gates.length > 0 ? (
                        <div className="space-y-1.5">
                            {gates.map((gate, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                    {gate.passed ? (
                                        <CheckCircle2 size={14} className="text-success flex-shrink-0" />
                                    ) : (
                                        <XCircle size={14} className="text-rose-400 flex-shrink-0" />
                                    )}
                                    <span className={gate.passed ? 'text-fg-muted' : 'text-fg-muted'}>{gate.name}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-fg-subtle">No gate information available</p>
                    )}
                </div>
            )}

            {/* Error */}
            {transitionError && (
                <div className="mb-3 p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-2">
                    <AlertTriangle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-400">{transitionError}</p>
                </div>
            )}

            {/* Transition Actions */}
            {availableTransitions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {availableTransitions.map(transition => (
                        <Button
                            key={transition.code}
                            size="sm"
                            variant={transition.variant}
                            onClick={() => handleTransition(transition.code)}
                            disabled={isTransitioning}
                            loading={isTransitioning}
                        >{isTransitioning ? undefined : transition.icon}
                            {transition.label}
                        </Button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LifecycleStatusPanel;
