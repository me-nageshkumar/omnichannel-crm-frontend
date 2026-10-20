import type { PlaceholderView, TemplateContent, TemplateView } from '@app/api/templates';

/** A content with every field null, then {@code over}. */
export function content(over: Partial<TemplateContent> = {}): TemplateContent {
  return {
    body: null,
    linkPreview: null,
    caption: null,
    voiceNote: null,
    latitude: null,
    longitude: null,
    name: null,
    address: null,
    fullName: null,
    phone: null,
    organization: null,
    email: null,
    question: null,
    options: null,
    allowMultiple: null,
    ...over,
  };
}

/** A placeholder as the API returns it, with sensible defaults (an agent placeholder). */
export function placeholderView(over: Partial<PlaceholderView> & Pick<PlaceholderView, 'name'>): PlaceholderView {
  return {
    kind: 'AGENT',
    attributeKey: null,
    attributeId: null,
    attributeName: null,
    missing: false,
    label: null,
    example: null,
    required: false,
    fallback: null,
    ...over,
  };
}

/** A template view as the API returns it, with sensible defaults (an active text template). */
export function template(over: Partial<TemplateView> & Pick<TemplateView, 'id'>): TemplateView {
  return {
    workspaceId: 'w1',
    channel: 'WHATSAPP',
    name: 'Welcome',
    category: null,
    type: 'TEXT',
    content: content({ body: 'Hello {{contact.name}}' }),
    media: null,
    placeholders: [],
    status: 'ACTIVE',
    lastUsedAt: null,
    createdBy: { username: 'meera', name: 'Meera Manager' },
    creationTime: '2026-10-20T10:00:00Z',
    updatedBy: { username: 'meera', name: 'Meera Manager' },
    lastUpdateTime: '2026-10-20T10:00:00Z',
    version: 0,
    warnings: [],
    ...over,
  };
}
