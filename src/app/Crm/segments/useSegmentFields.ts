import { listLabels } from '@app/api/contacts';
import type { ContactLabel } from '@app/api/contacts';
import { segmentFields } from '@app/api/crm';
import type { SegmentFieldCatalog } from '@app/api/crm';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useBrandUsers } from '@app/Crm/fields/useBrandUsers';
import type { FieldUser } from '@app/Crm/common/fields/types';

/**
 * What the builder needs once per page: the caller's field catalogue, the brand's labels and the brand's people.
 * Nothing is fetched while {@code enabled} is false (a caller without the authority); a labels failure only
 * empties the label picker, since labels matter to one field.
 */
export function useSegmentFields(enabled = true): {
  catalog: SegmentFieldCatalog | null;
  labels: ContactLabel[];
  users: FieldUser[];
  error: string | null;
  loading: boolean;
} {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const catalog = useLoad((tk) => (enabled ? segmentFields(tk, ws) : Promise.resolve(null)), [ws, enabled]);
  const labels = useLoad((tk) => (enabled ? listLabels(tk, ws) : Promise.resolve([])), [ws, enabled]);
  const users = useBrandUsers();
  return {
    catalog: catalog.data ?? null,
    labels: labels.data ?? [],
    users,
    error: catalog.error,
    loading: !catalog.data || (!labels.data && !labels.error),
  };
}
