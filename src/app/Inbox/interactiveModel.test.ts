import { describe, expect, it } from 'vitest';
import {
  Draft,
  KINDS,
  LIMITS,
  initialDraft,
  problems,
  slug,
  toCloudMessage,
  withTitle,
} from '@app/Inbox/interactiveModel';

function buttonDraft(over: Partial<Draft> = {}): Draft {
  return {
    ...initialDraft(),
    body: 'Hi',
    buttons: [{ id: 'yes', title: 'Yes', idEdited: false }],
    ...over,
  };
}

describe('interactive composer model', () => {
  it('starts as a reply-buttons message with one empty button and one empty row', () => {
    const d = initialDraft();
    expect(d.kind).toBe('button');
    expect(d.buttons).toHaveLength(1);
    expect(d.sections).toHaveLength(1);
    expect(d.sections[0].rows).toHaveLength(1);
    expect(d.header.type).toBe('none');
    expect(KINDS.map((k) => k.value)).toEqual(['button', 'list', 'cta_url', 'location_request_message']);
    expect(LIMITS.buttonTitle).toBe(20);
  });

  it('builds a button message in Cloud shape', () => {
    expect(toCloudMessage(buttonDraft())).toEqual({
      messaging_product: 'whatsapp-web',
      recipient_type: 'individual',
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Hi' },
        action: { buttons: [{ type: 'reply', reply: { id: 'yes', title: 'Yes' } }] },
      },
    });
  });

  it('toCloudMessageKeepsPunctuation', () => {
    const d = buttonDraft({ buttons: [withTitle({ id: '', title: '', idEdited: false }, 'Yes, & go')] });
    const m = toCloudMessage(d);
    expect(m.interactive?.action.buttons?.[0].reply).toEqual({ id: 'yes-go', title: 'Yes, & go' });
    expect(JSON.parse(JSON.stringify(m)).interactive.action.buttons[0].reply.title).toBe('Yes, & go');
  });

  it('omits header, footer and row descriptions that are blank', () => {
    const d = buttonDraft({ header: { type: 'text', text: '  ', mediaId: null, fileName: null }, footer: '  ' });
    const m = toCloudMessage(d);
    expect(m.interactive).not.toHaveProperty('header');
    expect(m.interactive).not.toHaveProperty('footer');
    const list = toCloudMessage({
      ...initialDraft(),
      kind: 'list',
      body: 'Pick',
      listButton: 'Options',
      sections: [{ title: 'S', rows: [{ id: 'r1', title: 'One', description: '', idEdited: true }] }],
    });
    expect(list.interactive?.action.sections?.[0].rows[0]).toEqual({ id: 'r1', title: 'One' });
  });

  it('builds list, cta_url and location_request_message shapes', () => {
    const list = toCloudMessage({
      ...initialDraft(),
      kind: 'list',
      header: { type: 'text', text: 'Delivery Speed', mediaId: null, fileName: null },
      body: 'Which?',
      footer: 'Store',
      listButton: 'View Options',
      sections: [
        {
          title: 'Fastest',
          rows: [{ id: 'overnight', title: 'Overnight Delivery', description: 'Arrives next morning', idEdited: true }],
        },
      ],
    });
    expect(list.interactive).toEqual({
      type: 'list',
      header: { type: 'text', text: 'Delivery Speed' },
      body: { text: 'Which?' },
      footer: { text: 'Store' },
      action: {
        button: 'View Options',
        sections: [
          {
            title: 'Fastest',
            rows: [{ id: 'overnight', title: 'Overnight Delivery', description: 'Arrives next morning' }],
          },
        ],
      },
    });
    const cta = toCloudMessage({
      ...initialDraft(),
      kind: 'cta_url',
      header: { type: 'image', text: '', mediaId: 'img1', fileName: 'a.png' },
      body: 'Tap below.',
      cta: { text: 'See Dates', url: 'https://example.com/d' },
    });
    expect(cta.interactive).toEqual({
      type: 'cta_url',
      header: { type: 'image', image: { id: 'img1' } },
      body: { text: 'Tap below.' },
      action: { name: 'cta_url', parameters: { display_text: 'See Dates', url: 'https://example.com/d' } },
    });
    const loc = toCloudMessage({ ...initialDraft(), kind: 'location_request_message', body: 'Where?' });
    expect(loc.interactive).toEqual({
      type: 'location_request_message',
      body: { text: 'Where?' },
      action: { name: 'send_location' },
    });
  });

  it('slug and withTitle follow the title until the id is edited', () => {
    expect(slug('Yes, book it!')).toBe('yes-book-it');
    expect(slug('   ')).toBe('');
    expect(slug('a'.repeat(80))).toHaveLength(50);
    const b = withTitle({ id: '', title: '', idEdited: false }, 'Call me');
    expect(b).toEqual({ id: 'call-me', title: 'Call me', idEdited: false });
    const edited = withTitle({ id: 'custom', title: 'Old', idEdited: true }, 'New');
    expect(edited).toEqual({ id: 'custom', title: 'New', idEdited: true });
  });

  it('problems reports required and over-length fields by json path', () => {
    const d = buttonDraft({
      body: '',
      buttons: [{ id: 'x', title: 't'.repeat(21), idEdited: true }],
    });
    expect(problems(d)).toEqual({
      'interactive.body.text': 'is required',
      'interactive.action.buttons.0.reply.title': 'must be at most 20 characters',
    });
    const cta = problems({ ...initialDraft(), kind: 'cta_url', body: 'x', cta: { text: 'See', url: 'http://x' } });
    expect(cta).toEqual({ 'interactive.action.parameters.url': 'must start with https://' });
    const media = problems({
      ...buttonDraft(),
      header: { type: 'image', text: '', mediaId: null, fileName: null },
    });
    expect(media).toEqual({ 'interactive.header.image.id': 'Upload a file' });
    const list = problems({
      ...initialDraft(),
      kind: 'list',
      body: 'x',
      listButton: '',
      sections: [{ title: '', rows: [] }],
    });
    expect(list).toEqual({
      'interactive.action.button': 'is required',
      'interactive.action.sections.0.title': 'is required',
      'interactive.action.sections.0.rows': 'needs at least 1 row',
    });
    expect(problems(buttonDraft())).toEqual({});
  });
});
