import { describe, expect, it } from 'vitest';
import { initialDraft } from '@app/Inbox/interactiveModel';
import { emptyMessageDraft, fromCloudMessage, messageProblems, toCloudMessage } from '@app/Chatbots/nodes/messageDraft';
import { LEAD_QUALIFIER } from '../../../test/chatbots';

describe('messageDraft', () => {
  it('textToCloud', () => {
    const d = { ...emptyMessageDraft(), kind: 'text' as const, text: 'Hi {{contact.name}}' };
    expect(toCloudMessage(d)).toEqual({
      messaging_product: 'whatsapp-web',
      recipient_type: 'individual',
      type: 'text',
      text: { preview_url: false, body: 'Hi {{contact.name}}' },
    });
  });

  it('imageToCloud', () => {
    const d = {
      ...emptyMessageDraft(),
      kind: 'image' as const,
      media: { id: 'img1', caption: 'Our shop', filename: '', uploadedName: 'a.png' },
    };
    expect(toCloudMessage(d)).toMatchObject({ type: 'image', image: { id: 'img1', caption: 'Our shop' } });
    const doc = { ...d, kind: 'document' as const, media: { ...d.media, filename: 'prices.pdf' } };
    expect(toCloudMessage(doc)).toMatchObject({
      type: 'document',
      document: { id: 'img1', caption: 'Our shop', filename: 'prices.pdf' },
    });
    const audio = { ...d, kind: 'audio' as const };
    expect(toCloudMessage(audio).audio).toEqual({ id: 'img1' });
  });

  it('locationToCloud', () => {
    const d = {
      ...emptyMessageDraft(),
      kind: 'location' as const,
      location: { latitude: '12.9716', longitude: '77.5946', name: 'Store', address: '' },
    };
    expect(toCloudMessage(d)).toMatchObject({
      type: 'location',
      location: { latitude: 12.9716, longitude: 77.5946, name: 'Store' },
    });
  });

  it('interactiveDelegates', () => {
    const inter = initialDraft();
    inter.body = 'Book?';
    inter.buttons = [{ id: 'yes', title: 'Yes', idEdited: true }];
    const d = { ...emptyMessageDraft(), kind: 'interactive' as const, interactive: inter };
    const m = toCloudMessage(d);
    expect(m.type).toBe('interactive');
    expect(m.interactive?.body.text).toBe('Book?');
  });

  it('fromCloudRoundTrips', () => {
    const saved = LEAD_QUALIFIER.flow.nodes[0].data.settings.message as Record<string, unknown>;
    const d = fromCloudMessage(saved);
    expect(d.kind).toBe('interactive');
    expect(d.interactive.buttons.map((b) => b.id)).toEqual(['yes', 'no']);
    const back = toCloudMessage(d);
    expect(back.interactive).toEqual(saved.interactive);
    const text = fromCloudMessage({ type: 'text', text: { body: 'x' } });
    expect(text.kind).toBe('text');
    expect(text.text).toBe('x');
    const img = fromCloudMessage({ type: 'image', image: { id: 'i', caption: 'c' } });
    expect(img.media).toMatchObject({ id: 'i', caption: 'c' });
  });

  it('problemsRequireMediaIdAndText', () => {
    expect(messageProblems({ ...emptyMessageDraft(), kind: 'text', text: '' })).toHaveProperty('text.body');
    expect(messageProblems({ ...emptyMessageDraft(), kind: 'image' })).toHaveProperty('image.id');
    expect(messageProblems({ ...emptyMessageDraft(), kind: 'location' })).toHaveProperty('location.latitude');
    expect(messageProblems({ ...emptyMessageDraft(), kind: 'text', text: 'hi' })).toEqual({});
  });
});
