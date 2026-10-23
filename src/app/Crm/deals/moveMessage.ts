import { ApiError } from '@app/api/client';
import { crmMessage } from '@app/Crm/errors';

/** The error of a failed move in the user's words. */
export function moveMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 404) return 'This deal is no longer in a pipeline you can see.';
    if (e.status === 409 && e.code === 'VERSION_CONFLICT') return 'Someone else moved this deal. Refresh to see the board.';
    if (e.serverMessage) return e.serverMessage;
  }
  return crmMessage(e);
}
