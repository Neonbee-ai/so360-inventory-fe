import React, { useMemo, useState } from 'react';
import { SettingsPageTemplate, Tabs } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import EligibilityPolicyTab from './eligibility/EligibilityPolicyTab';
import IntegrationHealthTab from './eligibility/IntegrationHealthTab';

/** Vendor configuration: horizontal sub-tabs (Pulse 66b329c3). */
export default function VendorConfigurationPage() {
  const shell = useShellBridge();
  const [tab, setTab] = useState('policy');
  const can = useMemo(() => (p: string) => shell?.hasPermission?.(p) ?? false, [shell]);

  return (
    <SettingsPageTemplate trail={[]} title="Vendor configuration" description="How vendor eligibility is enforced and how vendor events reach other modules.">
      <Tabs
        name="vendor-config-tabs"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'policy', label: 'Eligibility policy' },
          { id: 'health', label: 'Integration health' },
        ]}
      >
        {(active) =>
          active === 'health'
            ? <IntegrationHealthTab canReplay={can('vendors.admin')} />
            : <EligibilityPolicyTab canEdit={can('vendors.admin')} />}
      </Tabs>
    </SettingsPageTemplate>
  );
}
