import type { CloudTemplate } from '@app/api/cloudTemplates';

/** A WhatsApp template as the server lists it: an approved two-blank follow-up unless overridden. */
export function cloudTemplate(over: Partial<CloudTemplate> & Pick<CloudTemplate, 'id' | 'name'>): CloudTemplate {
  return {
    connectionId: 'c1',
    wabaId: '222',
    language: 'en',
    category: 'UTILITY',
    status: 'APPROVED',
    rejectedReason: null,
    parameterFormat: 'POSITIONAL',
    components: [
      { type: 'BODY', text: 'Hi {{1}}, your {{2}} admission is open' },
      { type: 'FOOTER', text: 'Bimal Institute' },
    ],
    header: { format: 'NONE' },
    variables: [
      { key: 'body:1', component: 'BODY', index: 0, example: 'Veenu' },
      { key: 'body:2', component: 'BODY', index: 1, example: 'BCA' },
    ],
    fills: {},
    supported: true,
    unsupportedReason: null,
    sendable: true,
    syncedAt: '2026-11-20T10:00:00Z',
    lastUsedAt: null,
    ...over,
  };
}
