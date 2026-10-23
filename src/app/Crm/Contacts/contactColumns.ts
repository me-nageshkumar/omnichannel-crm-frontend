import type { CrmContact } from '@app/api/crm';

export const CONTACT_PAGE_SIZE = 50;
export type ContactSortField = 'firstName' | 'lastActivityAt';
export interface ContactSort {
  field: ContactSortField;
  dir: 'asc' | 'desc';
}

export interface ContactColumn {
  label: string;
  field?: ContactSortField;
  /** Only shown when the brand works more than one number. */
  multiNumberOnly?: boolean;
}

export const CONTACT_COLUMNS: ContactColumn[] = [
  { label: 'Name', field: 'firstName' },
  { label: 'WhatsApp number' },
  { label: 'Channel', multiNumberOnly: true },
  { label: 'Lifecycle' },
  { label: 'Company' },
  { label: 'Owner' },
  { label: 'Open deals' },
  { label: 'Last activity', field: 'lastActivityAt' },
];

export const DELETED_NOTICE = 'This person was deleted from Contacts; the CRM keeps what it knew.';
export const CHANNEL_TAKEN_MESSAGE = 'This person already has a CRM contact on that number.';

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "1 Oct 2026"; the text itself when it is not a date. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : DATE.format(d);
}

/** The name to show for a contact: its name, else its number. */
export const contactName = (c: Pick<CrmContact, 'name' | 'phone'>): string => c.name || c.phone || 'Contact';

/** How the contact came to be in the CRM, in a sentence. */
export function originLine(c: CrmContact): string {
  const kind = c.origin?.kind;
  if (kind === 'MANUAL') return 'Added by hand';
  if (kind === 'IMPORT') return 'Imported';
  if (kind === 'API') return 'Added through the API';
  if (kind === 'INBOUND_CHAT' || kind === 'CTWA_AD' || kind === 'FACEBOOK_LEAD' || kind === 'WEBSITE_LEAD') {
    const by = c.origin?.capturedBy?.name;
    return `Captured from a chat${by ? ` by ${by}` : ''} on ${formatDate(c.creationTime)}`;
  }
  return '';
}
