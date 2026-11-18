import { describe, expect, it } from 'vitest';
import { CATALOG, PALETTE } from '@app/Chatbots/nodeCatalog';
import { LEAD_QUALIFIER, OPTIONS } from '../../test/chatbots';

describe('nodeCatalog', () => {
  it('paletteListsEveryTypeOnce', () => {
    expect(PALETTE).toHaveLength(13);
    expect(new Set(PALETTE).size).toBe(13);
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
    // spec 2026-11-18 §5.4: the hand-over ends the chatbot, as the server's AssignChatExecutor.outputs
    expect(CATALOG.assign_chat.outputs({})).toEqual([]);
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

  it('aiOutputsPerMode', () => {
    const ids = (s: Record<string, unknown>) => CATALOG.ai.outputs(s).map((o) => o.id);
    expect(ids({ mode: 'SINGLE', outcomes: [] })).toEqual(['next', 'failure']);
    const ab = [
      { id: 'a', label: 'Booked', description: '' },
      { id: 'b', label: '', description: '' },
    ];
    expect(ids({ mode: 'SINGLE', outcomes: ab })).toEqual(['outcome:a', 'outcome:b', 'failure']);
    expect(
      ids({
        mode: 'CONVERSATION',
        outcomes: [ab[0]],
        exitWords: ['stop'],
        exitCondition: {
          combinator: 'and',
          not: false,
          rules: [{ field: '{{S.json.done}}', operator: 'is', value: 'true' }],
        },
      }),
    ).toEqual(['outcome:a', 'exitWord', 'exitCondition', 'maxTurns', 'failure']);
    expect(ids({ mode: 'CONVERSATION', outcomes: [], exitWords: [], exitCondition: null })).toEqual([
      'maxTurns',
      'failure',
    ]);
    expect(CATALOG.ai.outputs({ mode: 'SINGLE', outcomes: ab }).map((o) => o.label)).toEqual([
      'Booked',
      'b',
      'Failure',
    ]);
  });

  it('aiProducesPerSettings', () => {
    expect(CATALOG.ai.produces({ mode: 'SINGLE', collect: [], replyFormat: { type: 'TEXT' } })).toEqual([
      'reply',
      'outcome',
      'turns',
      'usage.inputTokens',
      'usage.outputTokens',
      'conversationId',
      'errorCode',
    ]);
    expect(
      CATALOG.ai.produces({
        mode: 'CONVERSATION',
        collect: [{ key: 'size', description: '', type: 'TEXT' }],
        replyFormat: { type: 'JSON', schema: {}, messageField: 'message' },
      }),
    ).toEqual([
      'reply',
      'outcome',
      'turns',
      'usage.inputTokens',
      'usage.outputTokens',
      'conversationId',
      'errorCode',
      'fields.size',
      'json',
    ]);
  });

  it('aiWaitsForPerMode', () => {
    expect(CATALOG.ai.waitsFor({ mode: 'CONVERSATION' })).toBe('WHATSAPP_REPLY');
    expect(CATALOG.ai.waitsFor({ mode: 'SINGLE' })).toBe('AI_RESPONSE');
    expect(CATALOG.ai.preview({ mode: 'SINGLE', profileId: 'p1' }, OPTIONS)).toBe('Sales assistant · One call');
    expect(CATALOG.ai.preview({ mode: 'CONVERSATION', profileId: '' }, OPTIONS)).toBe('No profile yet · Conversation');
  });

  it("hand over defaults to the number's routing and says so", () => {
    expect(CATALOG.assign_chat.label).toBe('Hand over to agent');
    expect(CATALOG.assign_chat.description).toBe('Gives the chat to a person and ends the chatbot.');
    expect(CATALOG.assign_chat.defaultSettings()).toEqual({
      mode: 'NUMBER_ROUTING',
      userId: null,
      teamId: null,
      whenAway: null,
    });
    expect(CATALOG.assign_chat.preview({ mode: 'NUMBER_ROUTING' }, OPTIONS)).toBe("By the number's routing");
  });
});
