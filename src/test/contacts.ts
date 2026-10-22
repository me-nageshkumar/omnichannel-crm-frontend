import type { Contact, ContactAttribute, ContactLabel, LabelColor, SavedFilter } from '@app/api/contacts';

/** A label as the API returns it, with sensible defaults. */
export function label(over: Partial<ContactLabel> & Pick<ContactLabel, 'id' | 'name'>): ContactLabel {
  return { color: 'blue' as LabelColor, description: null, contactCount: 0, ...over };
}

export function attribute(over: Partial<ContactAttribute> & Pick<ContactAttribute, 'id' | 'name'>): ContactAttribute {
  return { key: over.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), description: null, contactCount: 0, ...over };
}

/** A contact view as the API returns it, with sensible defaults. */
export function contact(over: Partial<Contact> & Pick<Contact, 'id'>): Contact {
  return {
    name: null,
    phone: null,
    waId: null,
    numberHidden: false,
    doNotContact: null,
    labels: [],
    attributes: {},
    source: 'CHAT',
    lastMessageAt: null,
    creationTime: '2026-10-20T10:00:00Z',
    lastUpdateTime: '2026-10-20T10:00:00Z',
    ...over,
  };
}

export function savedFilter(over: Partial<SavedFilter> & Pick<SavedFilter, 'id' | 'name'>): SavedFilter {
  return { filter: {}, createdBy: 'meera', creationTime: '2026-10-20T10:00:00Z', ...over };
}
