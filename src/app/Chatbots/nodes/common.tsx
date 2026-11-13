import * as React from 'react';
import { FormHelperText, HelperText, HelperTextItem } from '@patternfly/react-core';
import type { NodeFieldsProps } from '@app/Chatbots/editor/NodeDrawer';
import { variableSchema } from '@app/Chatbots/variables';
import type { VariableGroup } from '@app/Chatbots/variables';

export const ErrorLine: React.FunctionComponent<{ message?: string }> = ({ message }) =>
  message ? (
    <FormHelperText>
      <HelperText>
        <HelperTextItem variant="error">{message}</HelperTextItem>
      </HelperText>
    </FormHelperText>
  ) : null;

/** The variables this node's form may insert: everything upstream first. */
export function useVariables(p: NodeFieldsProps): VariableGroup[] {
  return React.useMemo(() => variableSchema(p.flow, p.node.id, p.options, 'any'), [p.flow, p.node.id, p.options]);
}

export const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
export const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);
export const asMap = (v: unknown): Record<string, string> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};
