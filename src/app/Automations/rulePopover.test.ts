import { describe, expect, it } from 'vitest';
import { nestLines } from '@app/Automations/RulePopover';

const shape = (nodes: ReturnType<typeof nestLines>): unknown =>
  nodes.map((n) => (n.children.length ? [n.text, shape(n.children)] : n.text));

describe('nestLines', () => {
  it('nestsByDepth', () => {
    expect(
      shape(
        nestLines([
          { text: 'When', depth: 0 },
          { text: 'If', depth: 0 },
          { text: 'a', depth: 1 },
          { text: 'g', depth: 1 },
          { text: 'b', depth: 2 },
          { text: 'c', depth: 1 },
          { text: 'Then', depth: 0 },
          { text: '1. x', depth: 1 },
        ]),
      ),
    ).toEqual(['When', ['If', ['a', ['g', ['b']], 'c']], ['Then', ['1. x']]]);
  });

  it('aDepthJumpKeepsOrderUnderTheNearestShallowerLine', () => {
    expect(
      shape(
        nestLines([
          { text: 'A', depth: 0 },
          { text: 'B', depth: 2 },
          { text: 'C', depth: 1 },
        ]),
      ),
    ).toEqual([['A', ['B', 'C']]]);
  });

  it('aFirstLineDeeperThanZeroIsARoot', () => {
    expect(
      shape(
        nestLines([
          { text: 'B', depth: 1 },
          { text: 'A', depth: 0 },
        ]),
      ),
    ).toEqual(['B', 'A']);
  });
});
