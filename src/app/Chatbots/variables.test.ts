import { describe, expect, it } from 'vitest';
import { completeAt, insertAt, variableSchema } from '@app/Chatbots/variables';
import { LEAD_QUALIFIER, OPTIONS } from '../../test/chatbots';

describe('variables', () => {
  it('schemaListsUpstreamNodesFirst', () => {
    const groups = variableSchema(LEAD_QUALIFIER.flow, 'n3', OPTIONS, 'any');
    const labels = groups.map((g) => g.label);
    expect(labels.slice(0, 5)).toEqual(['Contact', 'Chat', 'Event', 'Trigger', 'Now']);
    const nodeGroups = groups.slice(5);
    expect(nodeGroups.map((g) => g.label)).toEqual(['AskBudget', 'Welcome']);
    expect(nodeGroups[0].paths.map((p) => p.path)).toEqual(['AskBudget.answer']);
    expect(nodeGroups[1].paths.map((p) => p.path)).toEqual([
      'Welcome.reply.id',
      'Welcome.reply.title',
      'Welcome.reply.text',
    ]);
    expect(groups.some((g) => g.paths.some((p) => p.path === 'High.reply.id'))).toBe(false);
  });

  it('attributesComeFromOptionsAndEventFieldsFromTheKind', () => {
    const groups = variableSchema(LEAD_QUALIFIER.flow, null, OPTIONS, 'MESSAGE_RECEIVED');
    const contact = groups.find((g) => g.label === 'Contact')!;
    expect(contact.paths.map((p) => p.path)).toEqual([
      'contact.name',
      'contact.phone',
      'contact.attributes.city',
      'contact.attributes.budget',
      'contact.labels',
      'contact.doNotContact',
    ]);
    const event = groups.find((g) => g.label === 'Event')!;
    expect(event.paths.map((p) => p.path)).toContain('event.message.text');
    expect(event.paths.map((p) => p.path)).not.toContain('event.deal.title');
    const lane = variableSchema(LEAD_QUALIFIER.flow, null, OPTIONS, 'DEAL_LANE_CHANGED').find(
      (g) => g.label === 'Event',
    )!;
    expect(lane.paths.map((p) => p.path)).toContain('event.toLane.name');
  });

  it('completeAtDetectsOpenBraces', () => {
    expect(completeAt('Hi {{con', 8)).toEqual({ query: 'con', start: 3 });
    expect(completeAt('Hi {{contact.name}} x', 21)).toBeNull();
    expect(completeAt('{{', 2)).toEqual({ query: '', start: 0 });
    expect(completeAt('a }} {{b', 8)).toEqual({ query: 'b', start: 5 });
    expect(completeAt('plain', 5)).toBeNull();
  });

  it('insertAtClosesBraces', () => {
    expect(insertAt('Hi {{con', 3, 8, 'contact.name')).toEqual({ text: 'Hi {{contact.name}}', caret: 19 });
    expect(insertAt('Hello', 5, 5, 'AskBudget.answer')).toEqual({ text: 'Hello{{AskBudget.answer}}', caret: 25 });
  });

  it('aiNodeVariablesFlowDownstream', () => {
    const flow = {
      nodes: [
        {
          id: 'a1',
          type: 'ai' as const,
          position: { x: 0, y: 0 },
          data: {
            name: 'Sales',
            settings: { mode: 'CONVERSATION', collect: [{ key: 'size', description: '', type: 'TEXT' }] },
          },
        },
        {
          id: 't1',
          type: 'send_message' as const,
          position: { x: 300, y: 0 },
          data: { name: 'Thanks', settings: { message: { type: 'text', text: { body: '' } } } },
        },
      ],
      edges: [{ id: 'e1', source: 'a1', sourceHandle: 'outcome:x', target: 't1' }],
    };
    const paths = variableSchema(flow, 't1', OPTIONS, 'any').flatMap((g) => g.paths.map((p) => p.path));
    expect(paths).toContain('Sales.fields.size');
    expect(paths).toContain('Sales.reply');
  });
});
