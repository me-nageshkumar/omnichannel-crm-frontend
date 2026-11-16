import * as React from 'react';
import { Alert, Button, Title } from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';
import type { ChatbotOptions, Problem, SavedFlow, SavedNode } from '@app/api/chatbots';
import { CATALOG } from '@app/Chatbots/nodeCatalog';

export interface NodeFieldsProps {
  settings: Record<string, unknown>;
  onChange(next: Record<string, unknown>): void;
  options: ChatbotOptions | null;
  errors: Record<string, string>;
  isDisabled: boolean;
  flow: SavedFlow;
  node: SavedNode;
  chatbotId: string;
}

/** Registered by Task 5: one form per node type; until then the drawer shows the node's problems. */
export const FIELDS: Partial<Record<SavedNode['type'], React.FunctionComponent<NodeFieldsProps>>> = {};

/** The right-hand panel with a node's settings and problems (spec §8.1). */
export const NodeDrawer: React.FunctionComponent<{
  node: SavedNode;
  flow: SavedFlow;
  chatbotId: string;
  options: ChatbotOptions | null;
  problems: Problem[];
  readOnly: boolean;
  onChange(settings: Record<string, unknown>): void;
  onClose(): void;
}> = ({ node, flow, chatbotId, options, problems, readOnly, onChange, onClose }) => {
  const meta = CATALOG[node.type];
  const Icon = meta.icon;
  const Fields = FIELDS[node.type];
  // Only errors mark a field; warnings are listed in the alert above, in its warning colour.
  const errors: Record<string, string> = {};
  problems.forEach((p) => {
    if (p.severity === 'ERROR' && !errors[p.field]) errors[p.field] = p.message;
  });
  return (
    <section className="omni-drawer nokey" role="dialog" aria-label={node.data.name}>
      <div className="omni-drawer__head">
        <span aria-hidden="true">
          <Icon />
        </span>
        <Title headingLevel="h2" size="lg">
          {node.data.name}
        </Title>
        <small>{meta.label}</small>
        <Button variant="plain" aria-label="Close" onClick={onClose}>
          <TimesIcon />
        </Button>
      </div>
      {problems.length > 0 && (
        <Alert
          variant={problems.some((p) => p.severity === 'ERROR') ? 'danger' : 'warning'}
          isInline
          title="This node has problems"
        >
          <ul>
            {problems.map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
        </Alert>
      )}
      {Fields ? (
        <Fields
          settings={node.data.settings}
          onChange={onChange}
          options={options}
          errors={errors}
          isDisabled={readOnly}
          flow={flow}
          node={node}
          chatbotId={chatbotId}
        />
      ) : (
        <p className="pf-v6-u-color-200">{meta.description}</p>
      )}
    </section>
  );
};
