import { listLabels } from '@app/api/contacts';
import type { ContactLabel } from '@app/api/contacts';
import { segmentFields } from '@app/api/crm';
import type { SegmentFieldCatalog } from '@app/api/crm';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useBrandUsers } from '@app/Crm/fields/useBrandUsers';
import type { FieldUser } from '@app/Crm/common/fields/types';

/** What the builder needs once per page: the caller's field catalogue, the brand's labels, the brand's people. */
export function useSegmentFields(): {
  catalog: SegmentFieldCatalog | null;
  labels: ContactLabel[];
  users: FieldUser[];
  error: string | null;
  loading: boolean;
} {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const catalog = useLoad((tk) => segmentFields(tk, ws), [ws]);
  const labels = useLoad((tk) => listLabels(tk, ws), [ws]);
  const users = useBrandUsers();
  return {
    catalog: catalog.data ?? null,
    labels: labels.data ?? [],
    users,
    error: catalog.error ?? labels.error,
    loading: !catalog.data || (!labels.data && !labels.error),
  };
}
