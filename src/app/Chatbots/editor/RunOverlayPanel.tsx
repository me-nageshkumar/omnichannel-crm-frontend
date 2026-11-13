import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button, ExpandableSection, Label, Title, TreeView } from '@patternfly/react-core';
import type { TreeViewDataItem } from '@patternfly/react-core';
import {
  CheckCircleIcon,
  CopyIcon,
  ExclamationCircleIcon,
  HourglassHalfIcon,
  TimesIcon,
} from '@patternfly/react-icons';
import type { Run, RunStep, SavedFlow } from '@app/api/chatbots';
import { runStatusColor, runStatusLabel, waitingLabel } from '@app/Chatbots/chatbotDisplay';

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString() : '');

const OUTCOME_ICON: Record<RunStep['outcome'], React.ReactNode> = {
  DONE: <CheckCircleIcon color="var(--pf-t--global--icon--color--status--success--default)" aria-label="Done" />,
  WAITING: <HourglassHalfIcon color="var(--pf-t--global--icon--color--status--info--default)" aria-label="Waiting" />,
  FAILED: (
    <ExclamationCircleIcon color="var(--pf-t--global--icon--color--status--danger--default)" aria-label="Failed" />
  ),
};

/** `run.variables` as a tree; leaves carry a button that copies their `{{path}}`. */
export function variableTree(value: unknown, path: string[] = []): TreeViewDataItem[] {
  if (!value || typeof value !== 'object') return [];
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);
  return entries.map(([key, v]) => {
    const here = path.concat([key]);
    const ref = `{{${here.join('.')}}}`;
    if (v && typeof v === 'object' && Object.keys(v as object).length > 0) {
      return {
        id: here.join('.'),
        name: key,
        children: variableTree(v, here),
        defaultExpanded: path.length === 0,
      } as TreeViewDataItem;
    }
    const shown = v === null || v === undefined ? '—' : typeof v === 'object' ? '{}' : String(v);
    return {
      id: here.join('.'),
      name: (
        <span className="omni-var-leaf">
          <strong>{key}</strong> <span className="pf-v6-u-color-200">{shown}</span>
        </span>
      ),
      action: (
        <Button variant="plain" aria-label={`Copy ${ref}`} onClick={() => void navigator.clipboard?.writeText(ref)}>
          <CopyIcon />
        </Button>
      ),
    } as TreeViewDataItem;
  });
}

/** The right-hand panel of a live or finished run on the canvas (spec §8.2). */
export const RunOverlayPanel: React.FunctionComponent<{
  run: Run;
  flow: SavedFlow;
  /** When given, a "Show on canvas" link to the editor with this run (needs a router). */
  canvasHref?: string;
  onStop(): void;
  onClose(): void;
}> = ({ run, flow, canvasHref, onStop, onClose }) => {
  const [varsOpen, setVarsOpen] = React.useState(false);
  const activeRun = run.status === 'RUNNING' || run.status === 'WAITING';
  const nodeName = (s: RunStep) =>
    flow.nodes.some((n) => n.id === s.nodeId) ? (s.nodeName ?? s.nodeId) : `${s.nodeName ?? s.nodeId} (removed)`;
  const who = run.contact?.name ?? (run.contact?.phone ? `+${run.contact.phone}` : 'the contact');
  return (
    <section className="omni-drawer omni-run nokey" role="dialog" aria-label="Run">
      <div className="omni-drawer__head">
        <Title headingLevel="h2" size="lg">
          {run.test ? 'Test run' : 'Run'} with {who}
        </Title>
        <Label isCompact color={runStatusColor(run.status)}>
          {runStatusLabel(run.status)}
        </Label>
        {activeRun && (
          <Button variant="danger" size="sm" onClick={onStop}>
            Stop
          </Button>
        )}
        <Button variant="plain" aria-label="Close" onClick={onClose}>
          <TimesIcon />
        </Button>
      </div>
      {run.status === 'WAITING' && run.waiting && (
        <p>
          waiting at {run.currentNodeName ?? run.currentNodeId} {waitingLabel(run.waiting)}
        </p>
      )}
      {run.endReason && <p className="pf-v6-u-color-200">{run.endReason}</p>}
      {canvasHref && <Link to={canvasHref}>Show on canvas</Link>}
      <ol className="omni-run__steps" aria-label="Steps">
        {run.steps.map((s) => (
          <li key={s.index} className={`omni-run__step omni-run__step--${s.outcome.toLowerCase()}`}>
            <span className="omni-run__icon">{OUTCOME_ICON[s.outcome]}</span>
            <span className="omni-run__name">{nodeName(s)}</span>
            <span className="omni-run__summary">{s.error ?? s.summary ?? ''}</span>
            <time className="pf-v6-u-color-200">{time(s.finishedAt ?? s.startedAt)}</time>
          </li>
        ))}
      </ol>
      <ExpandableSection toggleText="Variables" isExpanded={varsOpen} onToggle={(_e, open) => setVarsOpen(open)}>
        <TreeView data={variableTree(run.variables)} hasGuides aria-label="Variables" />
      </ExpandableSection>
    </section>
  );
};
