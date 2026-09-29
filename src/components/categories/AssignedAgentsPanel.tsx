import React from 'react';
import { Users } from 'lucide-react';
import { ListInput } from './ProjectDetailsSection';
import type { UnitAllocation } from '../../types/inventory';
import type { InheritedAllocation, InheritedList } from '../../utils/unitAllocation';

interface AssignedAgentsPanelProps {
    value: UnitAllocation;
    onChange: (next: UnitAllocation) => void;
    inherited: InheritedAllocation;
    disabled?: boolean;
    /** Where the override is stored, for the heading ("tower" / "unit"). */
    scope: string;
}

const Hint: React.FC<{ own: string[] | null; inherited: InheritedList | null; testId: string }> = ({ own, inherited, testId }) => {
    if (own && own.length) return null;
    return (
        <span data-testid={testId} className="block text-[11px] text-slate-500 mt-1">
            {inherited ? `Inherited from ${inherited.from} (${inherited.ids.length})` : 'Not assigned'}
        </span>
    );
};

/**
 * Agents/teams override for a tower or unit. Empty means "use the nearest
 * parent's list", which the hint names.
 */
export const AssignedAgentsPanel: React.FC<AssignedAgentsPanelProps> = ({ value, onChange, inherited, disabled, scope }) => (
    <section className="space-y-3 border border-slate-800 rounded-xl p-4" aria-label="Assigned agents">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Users size={16} className="text-blue-400" /> Assigned agents/teams
        </h3>
        <p className="text-[11px] text-slate-500">Leave empty to use the parent&apos;s agents for this {scope}.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <ListInput label="Assigned user IDs" value={value.assigned_user_ids} disabled={disabled}
                    onCommit={(v) => onChange({ ...value, assigned_user_ids: v })} />
                <Hint own={value.assigned_user_ids} inherited={inherited.users} testId="inherited-users" />
            </div>
            <div>
                <ListInput label="Assigned team IDs" value={value.assigned_team_ids} disabled={disabled}
                    onCommit={(v) => onChange({ ...value, assigned_team_ids: v })} />
                <Hint own={value.assigned_team_ids} inherited={inherited.teams} testId="inherited-teams" />
            </div>
        </div>
    </section>
);

export default AssignedAgentsPanel;
