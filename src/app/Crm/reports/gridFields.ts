import type {
  FieldDefinition,
  GridDateField,
  GridEntityType,
  GridMetric,
  GridRequest,
  ReportBucket,
  ReportFilter,
} from '@app/api/crm';

export interface Option<K extends string = string> {
  key: K;
  label: string;
}

export const ENTITIES: Option<GridEntityType>[] = [
  { key: 'DEAL', label: 'Deals' },
  { key: 'CONTACT', label: 'Contacts' },
  { key: 'COMPANY', label: 'Companies' },
];

/** The built-in groups the server accepts, per record type, in menu order; the first is the default. */
export const GROUP_BY: Record<GridEntityType, Option[]> = {
  DEAL: [
    { key: 'stage', label: 'Stage' },
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'status', label: 'Status' },
    { key: 'owner', label: 'Owner' },
    { key: 'source', label: 'Source' },
    { key: 'number', label: 'WhatsApp number' },
    { key: 'currency', label: 'Currency' },
    { key: 'lostReason', label: 'Lost reason' },
  ],
  CONTACT: [
    { key: 'lifecycle', label: 'Lifecycle' },
    { key: 'owner', label: 'Owner' },
    { key: 'source', label: 'Source' },
    { key: 'origin', label: 'Origin' },
    { key: 'number', label: 'WhatsApp number' },
  ],
  COMPANY: [
    { key: 'industry', label: 'Industry' },
    { key: 'size', label: 'Size' },
    { key: 'owner', label: 'Owner' },
  ],
};

/** Groups whose values keep their own order (lane or picklist order) instead of being ranked. */
export const ORDERED_GROUPS = new Set(['stage', 'lifecycle']);

export const METRICS: Option<GridMetric>[] = [
  { key: 'COUNT', label: 'Count' },
  { key: 'SUM', label: 'Sum of' },
  { key: 'AVG', label: 'Average of' },
];

export const BUCKETS: Option<ReportBucket | ''>[] = [
  { key: '', label: 'No date split' },
  { key: 'DAY', label: 'By day' },
  { key: 'WEEK', label: 'By week' },
  { key: 'MONTH', label: 'By month' },
];

export const DATE_FIELDS: Option<GridDateField>[] = [
  { key: 'creationTime', label: 'Created' },
  { key: 'closedAt', label: 'Closed' },
];

const GROUPABLE = new Set(['SELECT', 'BOOLEAN', 'USER', 'TEXT']);
const NUMERIC = new Set(['NUMBER', 'CURRENCY']);
export const CUSTOM = 'custom:';

const active = (defs: FieldDefinition[], entity: GridEntityType) =>
  defs.filter((d) => d.active && d.entityType === entity);

/** The active custom fields a record type can be grouped by. */
export const customGroupOptions = (defs: FieldDefinition[], entity: GridEntityType): Option[] =>
  active(defs, entity)
    .filter((d) => GROUPABLE.has(d.type))
    .map((d) => ({ key: CUSTOM + d.key, label: d.label }));

/** The active custom fields a sum or average can run over. */
export const customValueOptions = (defs: FieldDefinition[], entity: GridEntityType): Option[] =>
  active(defs, entity)
    .filter((d) => NUMERIC.has(d.type))
    .map((d) => ({ key: CUSTOM + d.key, label: d.label }));

/** "Amount" for deals, then the numeric custom fields. */
export const valueOptions = (defs: FieldDefinition[], entity: GridEntityType): Option[] => [
  ...(entity === 'DEAL' ? [{ key: 'amount', label: 'Amount' }] : []),
  ...customValueOptions(defs, entity),
];

/** Whether a sum or average over {@code field} is money (the amount, or a currency field of deals). */
export const isMoneyField = (defs: FieldDefinition[], entity: GridEntityType, field: string): boolean =>
  entity === 'DEAL' &&
  (field === 'amount' || active(defs, entity).some((d) => CUSTOM + d.key === field && d.type === 'CURRENCY'));

export interface GridState {
  entity: GridEntityType;
  by: string;
  metric: GridMetric;
  field: string;
  bucket: ReportBucket | '';
  date: GridDateField;
}

export const DEFAULT_GRID: GridState = {
  entity: 'DEAL',
  by: 'stage',
  metric: 'COUNT',
  field: '',
  bucket: '',
  date: 'creationTime',
};

const has = <K extends string>(options: Option<K>[], key: string | null): key is K =>
  options.some((o) => o.key === key);

/** The grid settings the URL's g.* keys describe; unknown values fall back to the defaults. */
export function gridFromSearch(params: URLSearchParams): GridState {
  const entity = params.get('g.entity');
  const metric = params.get('g.metric');
  const bucket = params.get('g.bucket');
  const date = params.get('g.date');
  const e: GridEntityType = has(ENTITIES, entity) ? entity : 'DEAL';
  return {
    entity: e,
    by: params.get('g.by') || GROUP_BY[e][0].key,
    metric: has(METRICS, metric) ? metric : 'COUNT',
    field: params.get('g.field') ?? '',
    bucket: has(BUCKETS, bucket) ? bucket : '',
    date: has(DATE_FIELDS, date) ? date : 'creationTime',
  };
}

/** {@code state} with every setting valid for its record type and the known custom fields. */
export function normalizeGrid(state: GridState, defs: FieldDefinition[]): GridState {
  const next = { ...state };
  const groups = [...GROUP_BY[next.entity], ...customGroupOptions(defs, next.entity)];
  if (!has(groups, next.by)) next.by = GROUP_BY[next.entity][0].key;
  const values = valueOptions(defs, next.entity);
  if (next.metric === 'COUNT' || values.length === 0) {
    next.metric = 'COUNT';
    next.field = '';
  } else if (!has(values, next.field)) {
    next.field = values[0].key;
  }
  if (next.entity !== 'DEAL' || !next.bucket) next.date = 'creationTime';
  return next;
}

/** {@code prev} with its g.* keys replaced by the settings that differ from the defaults. */
export function gridToSearch(prev: URLSearchParams, state: GridState): URLSearchParams {
  const sp = new URLSearchParams(prev);
  Array.from(sp.keys())
    .filter((k) => k.startsWith('g.'))
    .forEach((k) => sp.delete(k));
  if (state.entity !== 'DEAL') sp.set('g.entity', state.entity);
  if (state.by !== GROUP_BY[state.entity][0].key) sp.set('g.by', state.by);
  if (state.metric !== 'COUNT') {
    sp.set('g.metric', state.metric);
    sp.set('g.field', state.field);
  }
  if (state.bucket) sp.set('g.bucket', state.bucket);
  if (state.bucket && state.entity === 'DEAL' && state.date !== 'creationTime') sp.set('g.date', state.date);
  return sp;
}

/** The request for the settings over the page's filter. */
export function gridRequest(state: GridState, body: ReportFilter): GridRequest {
  const req: GridRequest = { ...body, entityType: state.entity, groupBy: state.by, metric: state.metric };
  if (state.metric !== 'COUNT') req.field = state.field;
  if (state.bucket) {
    req.dateBucket = state.bucket;
    if (state.entity === 'DEAL') req.dateField = state.date;
  }
  return req;
}
