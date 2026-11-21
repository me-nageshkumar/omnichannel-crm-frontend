import type { AudienceKind, CampaignChannel, CampaignRequest, CloudSenderView, CsvPreview } from '@app/api/campaigns';
import type { CloudTemplate } from '@app/api/cloudTemplates';
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
  /** The CRM segment of a SEGMENT audience, and its name for the Review step. */
  segmentId: string;
  segmentName: string;
  file: File | null;
  /** True while {@link file}'s preview is being read; its preview and columns are null until then. */
  reading: boolean;
  /** Why the last chosen file could not be read; cleared when another file is chosen or the file is cleared. */
  previewError: string | null;
  preview: CsvPreview | null;
  phoneColumn: string | null;
  nameColumn: string | null;
  templates: TemplateView[];
  mappings: Record<string, Mapping>;
  senderIds: string[];
  /** The kind of number the campaign sends from; it decides what the Message step offers. */
  channel: CampaignChannel;
  /** The Meta template of a Cloud campaign. */
  cloudTemplate: CloudTemplate | null;
  /** The uploaded file of a Cloud template's media header, and its name for the step. */
  headerMediaId: string | null;
  headerFileName: string | null;
}

export const EMPTY_DRAFT: Draft = {
  name: '',
  kind: 'FILTER',
  filterId: '',
  filterName: '',
  segmentId: '',
  segmentName: '',
  file: null,
  reading: false,
  previewError: null,
  preview: null,
  phoneColumn: null,
  nameColumn: null,
  templates: [],
  mappings: {},
  senderIds: [],
  channel: 'WHATSAPP_WEB',
  cloudTemplate: null,
  headerMediaId: null,
  headerFileName: null,
};

/** Changing the kind of number drops everything chosen for the other kind. */
export function setChannel(d: Draft, channel: CampaignChannel): Partial<Draft> | null {
  if (d.channel === channel) return null;
  return {
    channel,
    senderIds: [],
    templates: [],
    cloudTemplate: null,
    mappings: {},
    headerMediaId: null,
    headerFileName: null,
  };
}

/** Why the chosen numbers cannot go on, or null when they can. */
export function sendersReady(d: Draft, cloud: CloudSenderView[]): string | null {
  if (d.senderIds.length === 0) return 'Choose at least one number';
  if (d.channel !== 'WHATSAPP_CLOUD_API') return null;
  const wabas = new Set(cloud.filter((s) => d.senderIds.includes(s.phoneNumberId)).map((s) => s.wabaId));
  return wabas.size > 1 ? 'Choose numbers of one WhatsApp account' : null;
}

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
  if (d.kind === 'SEGMENT') return d.segmentId !== '';
  return !d.reading && (d.file === null || d.phoneColumn !== null);
}

/** A Meta template's blanks as placeholders to map; a blank's own fill gives its default. */
export function cloudPlaceholders(t: CloudTemplate | null): PlaceholderView[] {
  if (!t) return [];
  return t.variables.map((v) => {
    const fill = t.fills?.[v.key];
    const kind = fill?.kind === 'CONTACT_FIELD' || fill?.kind === 'CONTACT_ATTRIBUTE' ? fill.kind : 'AGENT';
    return {
      name: v.key,
      kind,
      attributeKey: fill?.attributeKey ?? null,
      attributeId: null,
      attributeName: null,
      missing: false,
      label: v.key,
      example: v.example,
      required: true,
      fallback: fill?.fallback ?? null,
    };
  });
}

/** The placeholders the draft's message has: its saved templates', or its Meta template's blanks. */
export function draftPlaceholders(d: Draft): PlaceholderView[] {
  return d.channel === 'WHATSAPP_CLOUD_API' ? cloudPlaceholders(d.cloudTemplate) : distinctPlaceholders(d.templates);
}

/** Why the Cloud message cannot go on yet, or null. */
export function cloudMessageProblem(d: Draft): string | null {
  const t = d.cloudTemplate;
  if (!t) return 'Choose a WhatsApp template';
  if (!t.sendable) return 'This WhatsApp template cannot be sent';
  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(t.header.format) && !d.headerMediaId) {
    return `Choose the header ${t.header.format.toLowerCase()}`;
  }
  const { unmapped, reused } = mappingProblems(cloudPlaceholders(t), d.mappings);
  if (unmapped.length > 0) return 'Every blank needs a value';
  if (reused.length > 0) return 'A CSV column can be used only once';
  return d.kind !== 'CSV' || d.preview !== null ? null : 'Choose the CSV file in Audience to map its columns.';
}

export function messageReady(d: Draft): boolean {
  if (d.channel === 'WHATSAPP_CLOUD_API') return cloudMessageProblem(d) === null;
  const n = d.templates.length;
  if (n < 1 || n > MAX_TEMPLATES) return false;
  const { unmapped, reused } = mappingProblems(distinctPlaceholders(d.templates), d.mappings);
  if (unmapped.length > 0 || reused.length > 0) return false;
  return d.kind !== 'CSV' || d.preview !== null;
}

/** A change to the draft, or one computed from the current draft (null leaves it as it is). */
export type DraftPatch = Partial<Draft> | ((d: Draft) => Partial<Draft> | null);

/** What every wizard step receives. */
export interface StepProps {
  draft: Draft;
  update(patch: DraftPatch): void;
}

/**
 * How many recipients the audience has: the saved filter's live count, the segment's live total, or the CSV's rows;
 * null until known.
 */
export function audienceSize(d: Draft, filterCount: number | null, segmentTotal: number | null = null): number | null {
  if (d.kind === 'FILTER') return filterCount;
  if (d.kind === 'SEGMENT') return segmentTotal;
  return d.preview?.rows ?? null;
}

/** The create request for a finished draft; a CSV audience's file goes alongside it. */
export function toRequest(d: Draft, placeholders: PlaceholderView[]): CampaignRequest {
  const base: CampaignRequest = {
    name: d.name.trim(),
    audience:
      d.kind === 'FILTER'
        ? { kind: 'FILTER', filterId: d.filterId }
        : d.kind === 'SEGMENT'
          ? { kind: 'SEGMENT', segmentId: d.segmentId }
          : { kind: 'CSV', phoneColumn: d.phoneColumn ?? '', nameColumn: d.nameColumn },
    templateIds: d.templates.map((t) => t.id),
    placeholders: toPlaceholders(placeholders, d.mappings),
    senderIds: d.senderIds,
  };
  // a WhatsApp Web request stays as it always was; the server reads a missing channel as WhatsApp Web
  if (d.channel !== 'WHATSAPP_CLOUD_API') return base;
  return {
    name: base.name,
    audience: base.audience,
    channel: 'WHATSAPP_CLOUD_API',
    templateIds: [],
    cloudTemplate: d.cloudTemplate ? { cloudTemplateId: d.cloudTemplate.id, headerMediaId: d.headerMediaId } : null,
    placeholders: base.placeholders,
    senderIds: base.senderIds,
  };
}
