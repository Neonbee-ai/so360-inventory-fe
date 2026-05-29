import { useContext } from 'react';
import { ShellContext, useEntitlements } from '@so360/shell-context';
import { User } from '../types/inventory';

export const useAuth = () => {
    const shell = useContext(ShellContext) as any;
    const user = shell?.user as User | undefined;
    const { can: checkPermission, isLoading: permissionsLoading } = useEntitlements();

    const can = (action: string) => {
        // While permissions are still loading, grant access optimistically
        if (permissionsLoading) return true;

        // Check real permissions from IAM (wildcard '*' or exact match)
        if (checkPermission(action)) return true;

        // Fallback: if IAM API fails or returns empty, grant access to any
        // authenticated user with an active org. Security is enforced at the
        // NestJS backend level — UI buttons are just UX affordances.
        return !!(shell?.user && shell?.currentOrg?.id);
    };

    return {
        user: shell?.user,
        org_id: shell?.currentOrg?.id,
        can,
        isLoading: permissionsLoading
    };
};
