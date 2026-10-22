import type { AudienceKind, CampaignRequest, CsvPreview } from '@app/api/campaigns';
import type { ContactAttribute } from '@app/api/contacts';
import type { PlaceholderView, TemplateView } from '@app/api/templates';
import { Mapping, MappingContext, distinctPlaceholders, mappingProblems, toPlaceholders } from '@app/Campaigns/mapping';

/** Everything the new-campaign wizard has collected so far. */
export interface Draft {
  name: string;
  kind: AudienceKind;
  filterId: string;
  /** The chosen filter's name, for the Review step. */
  filterName: string;
  file: File | null;
  preview: CsvPreview | null;
  phoneColumn: string | null;
  nameColumn: string | null;
  templates: TemplateView[];
  mappings: Record<string, Mapping>;
  senderIds: string[];
}

export const EMPTY_DRAFT: Draft = {
  name: '',
  kind: 'FILTER',
  filterId: '',
  filterName: '',
  file: null,
  preview: null,
  phoneColumn: null,
  nameColumn: null,
  templates: [],
  mappings: {},
  senderIds: [],
};

export const MAX_TEMPLATES = 5;

export function mappingContext(d: Draft, attributes: ContactAttribute[]): MappingContext {
  return {
    kind: d.kind,
    headers: d.preview?.headers ?? [],
    phoneColumn: d.phoneColumn,
    nameColumn: d.nameColumn,
    attributes,
  };
}

const LINK = /https?:\/\/|www\./i;

export const hasLink = (body: string | null): boolean => body !== null && LINK.test(body);

/** A CSV audience may go on without a file, so the sample CSV can be fetched in Message first. */
export function audienceReady(d: Draft): boolean {
  if (d.name.trim() === '') return false;
  if (d.kind === 'FILTER') return d.filterId !== '';
  return d.file === null || d.phoneColumn !== null;
}

export function messageReady(d: Draft): boolean {
  const n = d.templates.length;
  if (n < 1 || n > MAX_TEMPLATES) return false;
  const { unmapped, reused } = mappingProblems(distinctPlaceholders(d.templates), d.mappings);
  if (unmapped.length > 0 || reused.length > 0) return false;
  return d.kind === 'FILTER' || d.preview !== null;
}

/** What every wizard step receives. */
export interface StepProps {
  draft: Draft;
  update(patch: Partial<Draft>): void;
}

/** How many recipients the audience has: the saved filter's live count, or the CSV's rows; null until known. */
export function audienceSize(d: Draft, filterCount: number | null): number | null {
  return d.kind === 'FILTER' ? filterCount : (d.preview?.rows ?? null);
}

/** The create request for a finished draft; a CSV audience's file goes alongside it. */
export function toRequest(d: Draft, placeholders: PlaceholderView[]): CampaignRequest {
  return {
    name: d.name.trim(),
    audience:
      d.kind === 'FILTER'
        ? { kind: 'FILTER', filterId: d.filterId }
        : { kind: 'CSV', phoneColumn: d.phoneColumn ?? '', nameColumn: d.nameColumn },
    templateIds: d.templates.map((t) => t.id),
    placeholders: toPlaceholders(placeholders, d.mappings),
    senderIds: d.senderIds,
  };
}
