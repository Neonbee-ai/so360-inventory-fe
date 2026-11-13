import { useNavigate } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { EmptyState } from '@so360/design-system';

interface RecordNotFoundProps {
  /** Route of the list page the action navigates back to. */
  listPath: string;
  /** Human label of the list, e.g. "Orders". */
  listLabel: string;
}

/** Shared not-found state for detail pages (404/403/null record, e.g. a foreign-org id). */
export function RecordNotFound({ listPath, listLabel }: RecordNotFoundProps) {
  const navigate = useNavigate();
  return (
    <EmptyState
      name="record-not-found"
      icon={SearchX}
      title="Record not found"
      description="This record doesn't exist or you don't have access to it."
      action={{ label: `Back to ${listLabel}`, onClick: () => navigate(listPath) }}
    />
  );
}

/** Sentinel stored in a page's `error` state when the record is missing or not accessible. */
export const NOT_FOUND_ERROR = '__record_not_found__';

/** True for 400/403/404 responses (malformed, foreign-org or deleted ids) and not-found style messages. */
export function isNotFoundError(err: unknown): boolean {
  const e = err as { status?: number; response?: { status?: number }; message?: string } | null;
  const status = e?.status ?? e?.response?.status;
  if (status === 400 || status === 403 || status === 404) return true;
  return /not found|forbidden|no access|access denied|\b(403|404)\b/i.test(e?.message ?? '');
}
