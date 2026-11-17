import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';

/** Why a feature group could not be changed or deleted, naming the plans in the way when the server gave them. */
export function groupError(e: unknown): string {
  if (e instanceof ApiError && e.code === 'GROUP_IN_USE') {
    return e.extra?.plans ? `Used by plans: ${e.extra.plans}` : 'A customer holds this group; it cannot be deleted.';
  }
  return messageFor(e);
}
