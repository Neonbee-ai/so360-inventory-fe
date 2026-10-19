import React from 'react';
import { Card } from '@so360/design-system';
import { TeamAgentPicker, UserAgentPicker } from './AgentPickers';
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
        <span data-testid={testId} className="block text-xs text-fg-subtle mt-1">
            {inherited ? `Inherited from ${inherited.from} (${inherited.ids.length})` : 'Not assigned'}
        </span>
    );
};

/**
 * Agents/teams override for a tower or unit. Empty means "use the nearest
 * parent's list", which the hint names.
 */
export const AssignedAgentsPanel: React.FC<AssignedAgentsPanelProps> = ({ value, onChange, inherited, disabled, scope }) => (
    <section aria-label="Assigned agents">
        <Card title="Assigned agents/teams">
        <p className="text-xs text-fg-subtle mb-3">Leave empty to use the parent&apos;s agents for this {scope}.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <UserAgentPicker value={value.assigned_user_ids} disabled={disabled}
                    onChange={(v) => onChange({ ...value, assigned_user_ids: v })} />
                <Hint own={value.assigned_user_ids} inherited={inherited.users} testId="inherited-users" />
            </div>
            <div>
                <TeamAgentPicker value={value.assigned_team_ids} disabled={disabled}
                    onChange={(v) => onChange({ ...value, assigned_team_ids: v })} />
                <Hint own={value.assigned_team_ids} inherited={inherited.teams} testId="inherited-teams" />
            </div>
        </div>
        </Card>
    </section>
);

export default AssignedAgentsPanel;
