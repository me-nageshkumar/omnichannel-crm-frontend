import { apiFetch, apiFetchFile } from '@app/api/client';

export { NUMBER_PATTERN, normaliseNumber } from '@app/api/phoneNumbers';

export type LabelColor = 'blue' | 'teal' | 'green' | 'orange' | 'purple' | 'red' | 'orangered' | 'yellow' | 'grey';
export const LABEL_COLORS: LabelColor[] = [
  'blue',
  'teal',
  'green',
  'orange',
  'purple',
  'red',
  'orangered',
  'yellow',
  'grey',
];

export type ContactSource = 'CHAT' | 'IMPORT' | 'MANUAL';
export const SOURCES: ContactSource[] = ['CHAT', 'IMPORT', 'MANUAL'];
export type ContactSort = 'LAST_MESSAGE' | 'NAME' | 'CREATED';
export type AttributeOp = 'EQUALS' | 'CONTAINS' | 'EXISTS' | 'NOT_EXISTS';

export interface ContactLabel {
  id: string;
  name: string;
  color: LabelColor;
  description: string | null;
  contactCount: number;
}

export interface ContactAttribute {
  id: string;
  /** The immutable name used in templates: {{contact.attributes.<key>}}. */
  key: string;
  name: string;
  description: string | null;
  contactCount: number;
}

export interface Contact {
  id: string;
  name: string | null;
  phone: string | null;
  waId: string | null;
  numberHidden: boolean;
  doNotContact: { at: string; reason: 'STOP_REPLY' | 'MANUAL'; campaignId: string | null } | null;
  labels: string[];
  attributes: Record<string, string>;
  source: ContactSource;
  lastMessageAt: string | null;
  creationTime: string;
  lastUpdateTime: string;
}

export interface ContactNote {
  id: string;
  contactId: string;
  text: string;
  createdBy: { username: string; name: string };
  creationTime: string;
  lastUpdateTime: string;
  mine: boolean;
}

export interface AttributeCondition {
  attributeId: string;
  op: AttributeOp;
  value?: string;
}

/** The structured filter; every part is optional and the parts are ANDed. */
export interface ContactFilterSpec {
  q?: string;
  labelsAny?: string[];
  labelsAll?: string[];
  labelsNone?: string[];
  attributes?: AttributeCondition[];
  source?: ContactSource[];
  numberHidden?: boolean;
  doNotContact?: boolean;
  createdFrom?: string;
  createdTo?: string;
  lastMessageFrom?: string;
  lastMessageTo?: string;
}

export type Combinator = 'and' | 'or';

export interface Rule {
  field: string;
  operator: string;
  value: string | string[] | null;
}

export interface RuleGroup {
  combinator: Combinator;
  not: boolean;
  rules: (Rule | RuleGroup)[];
}

export type FilterKind = 'SIMPLE' | 'ADVANCED';

/** The labels and attributes a filter's rules refer to. */
export interface FilterUses {
  attributeIds: string[];
  labelIds: string[];
}

export interface SavedFilter {
  id: string;
  name: string;
  /** Null or absent on filters saved before advanced filters existed: those are simple. */
  kind?: FilterKind | null;
  filter: ContactFilterSpec | null;
  rules?: RuleGroup | null;
  query?: Record<string, unknown> | null;
  uses?: FilterUses | null;
  createdBy: string | { username: string; name: string };
  creationTime: string;
  lastUpdateTime?: string | null;
}

export const isAdvanced = (f: Pick<SavedFilter, 'kind'>): boolean => f.kind === 'ADVANCED';

export interface FilterPreview {
  count: number;
  sample: Contact[];
  query: Record<string, unknown>;
}

export const FILTER_SAMPLE_SIZE = 10;

export type FilterBody = { name: string; filter: ContactFilterSpec } | { name: string; rules: RuleGroup };

/** One of: explicit ids, an inline filter, a saved filter, or a saved filter ANDed with an inline filter. */
export type Selection =
  | { ids: string[] }
  | { filter: ContactFilterSpec }
  | { filterId: string }
  | { filterId: string; filter: ContactFilterSpec };

export interface ContactPage {
  items: Contact[];
  total: number;
  page: number;
}

export const CONTACT_PAGE_SIZE = 50;

const base = (workspaceId: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}`;
const send = <T>(token: string, method: string, path: string, body?: unknown) =>
  apiFetch<T>(path, { method, token, body });

// Labels and attributes

export const listLabels = (token: string, ws: string) =>
  apiFetch<ContactLabel[]>(`${base(ws)}/contact-labels`, { token });
export const createLabel = (token: string, ws: string, body: Pick<ContactLabel, 'name' | 'color' | 'description'>) =>
  send<ContactLabel>(token, 'POST', `${base(ws)}/contact-labels`, body);
export const updateLabel = (
  token: string,
  ws: string,
  id: string,
  body: Pick<ContactLabel, 'name' | 'color' | 'description'>,
) => send<ContactLabel>(token, 'PUT', `${base(ws)}/contact-labels/${id}`, body);
export const deleteLabel = (token: string, ws: string, id: string) =>
  send<void>(token, 'DELETE', `${base(ws)}/contact-labels/${id}`);

export const listAttributes = (token: string, ws: string) =>
  apiFetch<ContactAttribute[]>(`${base(ws)}/contact-attributes`, { token });
export const createAttribute = (token: string, ws: string, body: Pick<ContactAttribute, 'name' | 'description'>) =>
  send<ContactAttribute>(token, 'POST', `${base(ws)}/contact-attributes`, body);
export const updateAttribute = (
  token: string,
  ws: string,
  id: string,
  body: Pick<ContactAttribute, 'name' | 'description'>,
) => send<ContactAttribute>(token, 'PUT', `${base(ws)}/contact-attributes/${id}`, body);
export const deleteAttribute = (token: string, ws: string, id: string) =>
  send<void>(token, 'DELETE', `${base(ws)}/contact-attributes/${id}`);

// Contacts

export const searchContacts = (
  token: string,
  ws: string,
  body: { filter?: ContactFilterSpec; filterId?: string; sort?: ContactSort; page?: number },
) => send<ContactPage>(token, 'POST', `${base(ws)}/contacts/search`, body);
export const getContact = (token: string, ws: string, id: string) =>
  apiFetch<Contact>(`${base(ws)}/contacts/${id}`, { token });
export const createContact = (
  token: string,
  ws: string,
  body: { name: string | null; phone: string; labels?: string[]; attributes?: Record<string, string> },
) => send<Contact>(token, 'POST', `${base(ws)}/contacts`, body);
export const updateContact = (
  token: string,
  ws: string,
  id: string,
  body: { name?: string | null; attributes?: Record<string, string> },
) => send<Contact>(token, 'PUT', `${base(ws)}/contacts/${id}`, body);
export const deleteContact = (token: string, ws: string, id: string) =>
  send<void>(token, 'DELETE', `${base(ws)}/contacts/${id}`);
export const addContactLabel = (token: string, ws: string, id: string, labelId: string) =>
  send<Contact>(token, 'POST', `${base(ws)}/contacts/${id}/labels/${labelId}`);
export const removeContactLabel = (token: string, ws: string, id: string, labelId: string) =>
  send<Contact>(token, 'DELETE', `${base(ws)}/contacts/${id}/labels/${labelId}`);

export const markDoNotContact = (token: string, ws: string, id: string) =>
  send<Contact>(token, 'PUT', `${base(ws)}/contacts/${id}/do-not-contact`);
export const clearDoNotContact = (token: string, ws: string, id: string) =>
  send<Contact>(token, 'DELETE', `${base(ws)}/contacts/${id}/do-not-contact`);

// Notes

export const listNotes = (token: string, ws: string, id: string) =>
  apiFetch<ContactNote[]>(`${base(ws)}/contacts/${id}/notes`, { token });
export const addNote = (token: string, ws: string, id: string, text: string) =>
  send<ContactNote>(token, 'POST', `${base(ws)}/contacts/${id}/notes`, { text });
export const updateNote = (token: string, ws: string, id: string, noteId: string, text: string) =>
  send<ContactNote>(token, 'PUT', `${base(ws)}/contacts/${id}/notes/${noteId}`, { text });
export const deleteNote = (token: string, ws: string, id: string, noteId: string) =>
  send<void>(token, 'DELETE', `${base(ws)}/contacts/${id}/notes/${noteId}`);

// Saved filters

export const listFilters = (token: string, ws: string) =>
  apiFetch<SavedFilter[]>(`${base(ws)}/contact-filters`, { token });
export const getFilter = (token: string, ws: string, id: string) =>
  apiFetch<SavedFilter>(`${base(ws)}/contact-filters/${id}`, { token });
export const createFilter = (token: string, ws: string, body: FilterBody) =>
  send<SavedFilter>(token, 'POST', `${base(ws)}/contact-filters`, body);
export const updateFilter = (token: string, ws: string, id: string, body: FilterBody) =>
  send<SavedFilter>(token, 'PUT', `${base(ws)}/contact-filters/${id}`, body);
export const previewFilter = (token: string, ws: string, rules: RuleGroup, sample?: number) =>
  send<FilterPreview>(
    token,
    'POST',
    `${base(ws)}/contact-filters/preview`,
    sample === undefined ? { rules } : { rules, sample },
  );
export const deleteFilter = (token: string, ws: string, id: string) =>
  send<void>(token, 'DELETE', `${base(ws)}/contact-filters/${id}`);

// Count and bulk

export type BulkAction = 'ADD_LABELS' | 'REMOVE_LABELS' | 'SET_ATTRIBUTE' | 'CLEAR_ATTRIBUTE' | 'DELETE';

export interface BulkRequest {
  selection: Selection;
  action: BulkAction;
  labelIds?: string[];
  attributeId?: string;
  value?: string;
}

export const countContacts = (token: string, ws: string, selection: Selection) =>
  send<{ count: number }>(token, 'POST', `${base(ws)}/contacts/count`, { selection });
export const bulkContacts = (token: string, ws: string, body: BulkRequest) =>
  send<{ matched: number; changed: number }>(token, 'POST', `${base(ws)}/contacts/bulk`, body);

// Import and export

export interface ImportResult {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  problems: Array<{ row: number; reason: string }>;
  unknownColumns: string[];
  unknownLabels: string[];
}

export const importContacts = async (token: string, ws: string, file: File): Promise<ImportResult> => {
  const body = new FormData();
  body.append('file', file);
  const res = await apiFetchFile(`${base(ws)}/contacts/import`, { token, body });
  return (await res.json()) as ImportResult;
};

/** The file name in a Content-Disposition header, or a plain default. */
export function fileNameOf(disposition: string | null): string {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : 'contacts.csv';
}

/** Exports the contacts of an inline filter or a saved filter as a CSV file. */
export async function exportContacts(
  token: string,
  ws: string,
  scope: { filter: ContactFilterSpec } | { filterId: string } | { filterId: string; filter: ContactFilterSpec },
): Promise<{ blob: Blob; fileName: string }> {
  const res = await apiFetchFile(`${base(ws)}/contacts/export`, { token, body: scope, json: true });
  return { blob: await res.blob(), fileName: fileNameOf(res.headers.get('Content-Disposition')) };
}

/** Hands the file to the browser as a download. */
export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
