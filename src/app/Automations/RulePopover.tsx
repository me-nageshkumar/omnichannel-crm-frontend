import * as React from 'react';
import { Tooltip } from '@patternfly/react-core';
import type { AutomationOptions, RuleSummary } from '@app/api/automations';
import type { RuleLine } from '@app/Automations/automationModel';
import { describeRule } from '@app/Automations/automationModel';

const NUMBERED = /^\d+\. /;

type LineNode = { text: string; children: LineNode[] };

/** The flat lines as a tree: a line belongs to the last line one level shallower. */
export function nestLines(lines: RuleLine[]): LineNode[] {
  const roots: LineNode[] = [];
  const last: LineNode[] = [];
  lines.forEach((l) => {
    const node: LineNode = { text: l.text, children: [] };
    const parent = l.depth > 0 ? last[l.depth - 1] : undefined;
    (parent ? parent.children : roots).push(node);
    last[l.depth] = node;
    last.length = l.depth + 1;
  });
  return roots;
}

const Lines: React.FunctionComponent<{ nodes: LineNode[]; nested: boolean }> = ({ nodes, nested }) => (
  <ul className={nested ? 'omni-rule-words__nested' : undefined}>
    {nodes.map((n, i) => (
      <li key={i} className={NUMBERED.test(n.text) ? 'omni-rule-words__step' : undefined}>
        <span>{n.text}</span>
        {n.children.length > 0 && <Lines nodes={n.children} nested />}
      </li>
    ))}
  </ul>
);

/**
 * The lines, built only when the summary is shown, so a rule the describer cannot read never blanks the list; a
 * group's conditions are a list inside its item, so screen readers hear the nesting.
 */
const RuleWords: React.FunctionComponent<{ rule: RuleSummary; options: AutomationOptions | null }> = ({
  rule,
  options,
}) => (
  <div className="omni-rule-words">
    <strong>{rule.name}</strong>
    <Lines nodes={nestLines(describeRule(rule, options))} nested={false} />
  </div>
);

/**
 * The rule in words on hover or keyboard focus of its name in the rules list (rule-hover-summary spec): a tooltip, so
 * screen readers read it with the link (aria-describedby) and nothing pretends to be a modal dialog.
 */
export const RulePopover: React.FunctionComponent<{
  rule: RuleSummary;
  options: AutomationOptions | null;
  children: React.ReactElement;
}> = ({ rule, options, children }) => (
  <Tooltip
    content={<RuleWords rule={rule} options={options} />}
    isContentLeftAligned
    maxWidth="32rem"
    aria="describedby"
  >
    {children}
  </Tooltip>
);
