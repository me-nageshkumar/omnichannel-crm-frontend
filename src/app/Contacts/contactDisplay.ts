import type { Contact, ContactSource } from '@app/api/contacts';
import { shown } from '@app/api/phoneNumbers';

export const SOURCE_TEXT: Record<ContactSource, string> = { CHAT: 'Chat', IMPORT: 'Import', MANUAL: 'Manual' };

/** "+919812345678", or "Number hidden" when WhatsApp did not reveal it. */
export const phoneText = (c: Contact): string => (c.phone ? shown(c.phone) : 'Number hidden');

/** The name, else the phone number, else "Number hidden". */
export const displayName = (c: Contact): string => c.name || phoneText(c);
