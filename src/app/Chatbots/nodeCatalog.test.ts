import { describe, expect, it } from 'vitest';
import { CATALOG, PALETTE } from '@app/Chatbots/nodeCatalog';
import { LEAD_QUALIFIER, OPTIONS } from '../../test/chatbots';

describe('nodeCatalog', () => {
  it('paletteListsEveryTypeOnce', () => {
    expect(PALETTE).toHaveLength(12);
    expect(new Set(PALETTE).size).toBe(12);
    PALETTE.forEach((t) => expect(CATALOG[t].label).toBeTruthy());
  });

  it('sendMessageOutputsFollowButtons', () => {
    const s = LEAD_QUALIFIER.flow.nodes[0].data.settings;
    expect(CATALOG.send_message.outputs(s).map((o) => o.id)).toEqual(['reply:yes', 'reply:no', 'other']);
    expect(CATALOG.send_message.outputs(s).map((o) => o.label)).toEqual(['Yes', 'No', 'Other reply']);
    expect(CATALOG.send_message.outputs({ message: { type: 'text', text: { body: 'x' } } }).map((o) => o.id)).toEqual([
      'next',
    ]);
    expect(CATALOG.send_message.waitsFor(s)).toBe('WHATSAPP_REPLY');
    expect(CATALOG.send_message.waitsFor({ message: { type: 'text', text: { body: 'x' } } })).toBeNull();
  });

  it('listOutputsFollowRowsAndCtaHasNextOnly', () => {
    const list = {
      message: {
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: 'Pick' },
          action: {
            button: 'Sizes',
            sections: [
              {
                title: 'S',
                rows: [
                  { id: 's', title: 'Small' },
                  { id: 'l', title: 'Large' },
                ],
              },
            ],
          },
        },
      },
    };
    expect(CATALOG.send_message.outputs(list).map((o) => o.id)).toEqual(['reply:s', 'reply:l', 'other']);
    const cta = {
      message: {
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          body: { text: 'See' },
          action: { name: 'cta_url', parameters: { display_text: 'Open', url: 'https://x' } },
        },
      },
    };
    expect(CATALOG.send_message.outputs(cta).map((o) => o.id)).toEqual(['next']);
  });

  it('conditionOutputsPerCasePlusOtherwise', () => {
    const s = {
      cases: [
        { id: 'c1', label: 'High', conditions: null },
        { id: 'c2', label: 'Low', conditions: null },
      ],
    };
    expect(CATALOG.condition.outputs(s).map((o) => o.id)).toEqual(['case:c1', 'case:c2', 'otherwise']);
    expect(CATALOG.condition.outputs(s)[0].label).toBe('High');
  });

  it('httpSuccessFailureAndJumpHasNoOutputs', () => {
    expect(CATALOG.http_request.outputs({}).map((o) => o.id)).toEqual(['success', 'failure']);
    expect(CATALOG.jump.outputs({})).toEqual([]);
    expect(CATALOG.ask_question.outputs({}).map((o) => o.id)).toEqual(['next', 'noAnswer']);
    expect(CATALOG.ask_form.outputs({}).map((o) => o.id)).toEqual(['next']);
    expect(CATALOG.wait.waitsFor({})).toBe('TIMER');
    expect(CATALOG.ask_form.waitsFor({})).toBe('FORM');
    expect(CATALOG.update_contact.waitsFor({})).toBeNull();
  });

  it('askFormProducesFieldPaths', () => {
    const s = { fields: [{ key: 'city' }, { key: 'budget' }] };
    expect(CATALOG.ask_form.produces(s)).toEqual(['form.city', 'form.budget', 'form.submittedAt']);
    expect(CATALOG.ask_question.produces({})).toEqual(['answer']);
    expect(CATALOG.http_request.produces({})).toEqual(['response.status', 'response.body', 'response.headers']);
    expect(CATALOG.send_message.produces(LEAD_QUALIFIER.flow.nodes[0].data.settings)).toEqual([
      'reply.id',
      'reply.title',
      'reply.text',
    ]);
    expect(CATALOG.send_message.produces({ message: { type: 'text' } })).toEqual([]);
  });

  it('previewTwoLines', () => {
    const p = CATALOG.ask_question.preview({ text: 'Your budget?', answerType: 'NUMBER' }, OPTIONS);
    expect(p).toContain('Your budget?');
    expect(p.split('\n').length).toBeLessThanOrEqual(2);
    expect(CATALOG.assign_chat.preview({ mode: 'TEAM_QUEUE', teamId: 't1' }, OPTIONS)).toContain('Support');
    expect(CATALOG.jump.preview({ chatbotId: 'c2' }, OPTIONS)).toContain('Price bot');
    expect(CATALOG.wait.preview({ amount: 2, unit: 'HOURS' }, OPTIONS)).toBe('Wait 2 hours');
  });

  it('defaultSettingsAreSendable', () => {
    expect(CATALOG.ask_question.defaultSettings()).toEqual({
      text: '',
      answerType: 'TEXT',
      saveAs: '',
      attributeId: null,
      retries: 2,
      retryMessage: '',
      giveUpMessage: '',
    });
    expect(CATALOG.wait.defaultSettings()).toEqual({ amount: 1, unit: 'HOURS' });
    expect(CATALOG.ask_form.defaultSettings().linkMessage).toContain('{{form.url}}');
  });
});
