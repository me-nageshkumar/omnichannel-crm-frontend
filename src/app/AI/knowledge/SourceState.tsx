import * as React from 'react';
import { Label } from '@patternfly/react-core';
import { type KnowledgeSource, isAdding } from '@app/api/aiKnowledge';

/** A source's state as the brand user reads it: Adding, Ready, Failed: <reason>, Removing. */
export const SourceState: React.FunctionComponent<{ source: KnowledgeSource }> = ({ source }) => {
  if (isAdding(source.state)) return <Label color="blue">Adding</Label>;
  if (source.state === 'READY') return <Label color="green">Ready</Label>;
  if (source.state === 'REMOVING') return <Label color="grey">Removing</Label>;
  return <Label color="red">{`Failed: ${source.error ?? 'unknown reason'}`}</Label>;
};

/** "14.0 MB", "18 KB", "–" when unknown. */
export function sizeText(bytes: number | null): string {
  if (!bytes) return '–';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const KIND_TEXT = { FILE: 'File', WEB_PAGE: 'Web page', NOTE: 'Note' } as const;
