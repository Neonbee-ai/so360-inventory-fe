import React from 'react';
import { Deal, DealStage } from '../../types/crm';
import { Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { useInventoryFormatters } from '../../utils/formatters';

interface KanbanBoardProps {
    deals: Deal[];
    stages: { id: string; name: DealStage }[];
    onDealClick: (deal: Deal) => void;
    onStageChange: (deal: Deal, newStage: DealStage) => void;
}

export const KanbanBoard = ({ deals, stages, onDealClick, onStageChange }: KanbanBoardProps) => {
    const formatters = useInventoryFormatters();
    const [draggedDealId, setDraggedDealId] = React.useState<string | null>(null);
    const [dragOverStage, setDragOverStage] = React.useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent, deal: Deal) => {
        setDraggedDealId(deal.id);
        e.dataTransfer.setData('dealId', deal.id);
        e.dataTransfer.effectAllowed = 'move';

        // Add a small delay to make the card semi-transparent while dragging
        setTimeout(() => {
            const target = e.target as HTMLElement;
            target.style.opacity = '0.4';
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        setDraggedDealId(null);
        setDragOverStage(null);
        const target = e.target as HTMLElement;
        target.style.opacity = '1';
    };

    const handleDragOver = (e: React.DragEvent, stageId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverStage(stageId);
    };

    const handleDragLeave = () => {
        setDragOverStage(null);
    };

    const handleDrop = (e: React.DragEvent, targetStage: DealStage) => {
        e.preventDefault();
        setDragOverStage(null);
        const dealId = e.dataTransfer.getData('dealId');
        const deal = deals.find(d => d.id === dealId);

        if (deal && deal.stage !== targetStage) {
            onStageChange(deal, targetStage);
        }
    };

    return (
        <div className="flex gap-6 overflow-x-auto pb-6 h-full min-h-[320px] scrollbar-hide">
            {stages.map((stage) => {
                const stageDeals = deals.filter(d => d.stage === stage.name);
                const isOver = dragOverStage === stage.id;

                return (
                    <div
                        key={stage.id}
                        className="w-80 flex-shrink-0 flex flex-col gap-4"
                    >
                        {/* Stage Header */}
                        <div className="flex items-center justify-between px-2">
                            <h3 className="font-black text-fg flex items-center gap-2 text-sm">
                                {stage.name}
                                <span className="text-[10px] bg-surface-raised text-fg-muted px-2 py-0.5 rounded-full font-black">
                                    {stageDeals.length}
                                </span>
                            </h3>
                            <span className="text-[10px] text-fg-subtle font-black">
                                {formatters.formatCurrency(stageDeals.reduce((sum, d) => sum + d.value, 0))}
                            </span>
                        </div>

                        {/* Drop Zone */}
                        <div
                            onDragOver={(e) => handleDragOver(e, stage.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, stage.name)}
                            className={`flex-1 flex flex-col gap-3 rounded-2xl p-3 min-h-[200px] transition-all duration-200 ${isOver
                                    ? 'bg-primary/10 ring-2 ring-focus/50 ring-dashed border-transparent'
                                    : 'bg-surface/40 border border-line/60'
                                }`}
                        >
                            {stageDeals.map((deal) => (
                                <div
                                    key={deal.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, deal)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => onDealClick(deal)}
                                    className={`bg-surface-raised border-2 p-4 rounded-xl shadow-sm transition-all cursor-grab active:cursor-grabbing group ${draggedDealId === deal.id
                                            ? 'border-primary/50 scale-95'
                                            : 'border-line-strong/50 hover:border-primary/50 hover:shadow-xl hover:shadow-blue-900/20'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-sm text-fg group-hover:text-primary transition-colors truncate">
                                            {deal.name}
                                        </h4>
                                    </div>

                                    <p className="text-[11px] text-fg-subtle mb-4 line-clamp-1 flex items-center gap-1">
                                        <TrendingUp size={10} className="text-fg-subtle" />
                                        {deal.company_name}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-surface-high flex items-center justify-center text-[8px] font-black overflow-hidden border border-line-strong">
                                                {deal.owner.avatar_url ? (
                                                    <img src={deal.owner.avatar_url} alt={deal.owner.full_name} />
                                                ) : (
                                                    deal.owner.full_name.charAt(0)
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-fg">{formatters.formatCurrency(deal.value)}</span>
                                            </div>
                                        </div>
                                        <span className="text-[9px] text-fg-subtle font-bold flex items-center gap-1 bg-surface/50 px-1.5 py-0.5 rounded">
                                            <Calendar size={10} className="text-fg-subtle" /> {deal.expected_close_date}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {/* Empty state hint */}
                            {stageDeals.length === 0 && !isOver && (
                                <div className="flex-1 flex items-center justify-center border-2 border-dashed border-line/50 rounded-xl">
                                    <span className="text-[10px] font-black text-fg-subtle">Drop here</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
