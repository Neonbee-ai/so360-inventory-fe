import { useContext } from 'react';
import { ShellContext, useEntitlements } from '@so360/shell-context';
import { User } from '../types/inventory';

export const useAuth = () => {
    const shell = useContext(ShellContext) as any;
    const user = shell?.user as User | undefined;
    const { can: checkPermission, isLoading: permissionsLoading } = useEntitlements();

    const can = (action: string) => {
        // While permissions are still loading, grant optimistically to avoid a
        // flash of hidden controls; the backend enforces regardless. This is
        // transient (resolves as soon as entitlements load).
        if (permissionsLoading) return true;

        // Real permission check from IAM (supports '*' and 'resource.*' wildcards).
        // Deny by default when the permission is absent — the UI must mirror what
        // the backend will actually allow, NOT grant access to any authenticated
        // user (that produced buttons the backend then rejected with 403).
        return checkPermission(action);
    };

    return {
        user: shell?.user,
        org_id: shell?.currentOrg?.id,
        can,
        isLoading: permissionsLoading
    };
};
