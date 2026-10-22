import type {
  Contact,
  ContactAttribute,
  ContactLabel,
  FilterPreview,
  LabelColor,
  RuleGroup,
  SavedFilter,
} from '@app/api/contacts';

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
  return {
    kind: 'SIMPLE',
    filter: {},
    createdBy: 'meera',
    creationTime: '2026-10-20T10:00:00Z',
    lastUpdateTime: '2026-10-20T10:00:00Z',
    ...over,
  };
}

export const LAPSED_TREE: RuleGroup = {
  combinator: 'and',
  not: false,
  rules: [
    { field: 'labels', operator: 'has', value: 'l1' },
    { field: 'lastMessageAt', operator: 'before', value: '2026-09-01' },
    {
      combinator: 'or',
      not: true,
      rules: [
        { field: 'attributes.a1', operator: 'is', value: 'Pune' },
        { field: 'source', operator: 'in', value: ['CHAT', 'IMPORT'] },
      ],
    },
  ],
};

export const LAPSED_QUERY = {
  $and: [
    { labels: 'l1' },
    { lastMessageAt: { $lt: { $date: '2026-08-31T18:30:00Z' } } },
    {
      $nor: [
        { $or: [{ 'attributes.a1': { $regex: '^Pune$', $options: 'i' } }, { source: { $in: ['CHAT', 'IMPORT'] } }] },
      ],
    },
  ],
};

/** An advanced saved filter as the API returns it, with sensible defaults. */
export function advancedFilter(over: Partial<SavedFilter> & Pick<SavedFilter, 'id' | 'name'>): SavedFilter {
  return {
    kind: 'ADVANCED',
    filter: null,
    rules: LAPSED_TREE,
    query: LAPSED_QUERY,
    uses: { attributeIds: ['a1'], labelIds: ['l1'] },
    createdBy: 'meera',
    creationTime: '2026-10-20T10:00:00Z',
    lastUpdateTime: '2026-10-21T10:00:00Z',
    ...over,
  };
}

export function filterPreview(over: Partial<FilterPreview> = {}): FilterPreview {
  return { count: 1204, sample: [], query: LAPSED_QUERY, ...over };
}
