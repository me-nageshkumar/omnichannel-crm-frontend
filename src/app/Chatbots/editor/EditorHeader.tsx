import * as React from 'react';
import { Button, Flex, FlexItem, Label, Title } from '@patternfly/react-core';
import { ArrowLeftIcon } from '@patternfly/react-icons';
import type { Problem } from '@app/api/chatbots';
import type { Chatbot } from '@app/api/chatbots';
import { statusColor, statusLabel } from '@app/Chatbots/chatbotDisplay';
import { ProblemsPopover } from '@app/Chatbots/editor/ProblemsPopover';

/** The bar above the canvas (spec §8.1). */
export const EditorHeader: React.FunctionComponent<{
  chatbot: Chatbot;
  dirty: boolean;
  saving: boolean;
  canManage: boolean;
  problems: Problem[];
  onBack(): void;
  onSave(): void;
  onPublish(): void;
  onUnpublish(): void;
  onAddNode(): void;
  onTest(): void;
  onRuns(): void;
  onVersions(): void;
  onSettings(): void;
  onPickProblem(nodeId: string | null): void;
}> = ({ chatbot, dirty, saving, canManage, problems, onBack, onSave, onPublish, onUnpublish, onAddNode, onTest, onRuns, onVersions, onSettings, onPickProblem }) => {
  const published = chatbot.status === 'PUBLISHED';
  const editable = canManage && !published;
  return (
    <Flex className="omni-flow-header" alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
      <FlexItem>
        <Button variant="plain" aria-label="Back to chatbots" onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
      </FlexItem>
      <FlexItem>
        <Title headingLevel="h1" size="xl">
          {chatbot.name}
        </Title>
      </FlexItem>
      <FlexItem>
        <Label isCompact color={statusColor(chatbot.status)}>
          {statusLabel(chatbot.status)}
        </Label>
      </FlexItem>
      <FlexItem>
        <ProblemsPopover problems={problems} onPick={onPickProblem} />
      </FlexItem>
      <FlexItem align={{ default: 'alignRight' }}>
        <Flex gap={{ default: 'gapSm' }}>
          {editable && (
            <Button variant="secondary" onClick={onAddNode}>
              Add node
            </Button>
          )}
          {editable && (
            <Button variant="primary" isDisabled={!dirty || saving} isLoading={saving} onClick={onSave}>
              Save
            </Button>
          )}
          {canManage && !published && (
            <Button variant="secondary" isDisabled={saving} onClick={onPublish}>
              Publish
            </Button>
          )}
          {canManage && published && (
            <Button variant="secondary" onClick={onUnpublish}>
              Move to draft
            </Button>
          )}
          {canManage && (
            <Button variant="secondary" onClick={onTest}>
              Test
            </Button>
          )}
          <Button variant="link" onClick={onRuns}>
            Runs
          </Button>
          <Button variant="link" onClick={onVersions}>
            Versions
          </Button>
          {canManage && (
            <Button variant="link" onClick={onSettings}>
              Settings
            </Button>
          )}
        </Flex>
      </FlexItem>
    </Flex>
  );
};
