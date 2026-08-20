import { useContext } from 'react';
import { ShellContext } from '@so360/shell-context';
import { User } from '../types/inventory';

export const useAuth = () => {
    const shell = useContext(ShellContext) as any;
    const user = shell?.user as User | undefined;
    const permissionsLoaded = shell?.permissionsLoaded === true;

    const can = (action: string) => {
        // While shell permissions are still loading, grant optimistically to avoid a
        // flash of hidden controls; the backend enforces regardless. This is
        // transient (resolves as soon as shell.permissionsLoaded flips true).
        if (!permissionsLoaded) return true;

        // Real permission check resolved once at Shell boot (dot-notation RBAC
        // codes, wildcard-aware via shell.hasPermission). Deny by default when the
        // permission is absent — the UI must mirror what the backend will actually
        // allow, NOT grant access to any authenticated user (that produced buttons
        // the backend then rejected with 403).
        return shell?.hasPermission?.(action) ?? false;
    };

    return {
        user: shell?.user,
        org_id: shell?.currentOrg?.id,
        can,
        isLoading: !permissionsLoaded
    };
};
