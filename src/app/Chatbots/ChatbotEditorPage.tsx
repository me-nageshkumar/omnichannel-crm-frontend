import * as React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Alert, Drawer, DrawerContent, DrawerContentBody, DrawerPanelContent, Spinner } from '@patternfly/react-core';
import type { Chatbot, ChatbotOptions, NodeType, Run, SavedFlow } from '@app/api/chatbots';
import { getChatbot, getChatbotOptions, stopRun } from '@app/api/chatbots';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { useDocumentTitle } from '@app/utils/useDocumentTitle';
import { addNode, duplicateNode, isValidName, removeNode, renameNode } from '@app/Chatbots/flowModel';
import { EditorContext } from '@app/Chatbots/editor/EditorContext';
import { EditorHeader } from '@app/Chatbots/editor/EditorHeader';
import { FlowCanvas } from '@app/Chatbots/editor/FlowCanvas';
import { NodeDrawer } from '@app/Chatbots/editor/NodeDrawer';
import { NodePalette } from '@app/Chatbots/editor/NodePalette';
import { RunOverlayPanel } from '@app/Chatbots/editor/RunOverlayPanel';
import { SettingsModal } from '@app/Chatbots/editor/SettingsModal';
import { TestDialog } from '@app/Chatbots/editor/TestDialog';
import { VersionsDrawer } from '@app/Chatbots/editor/VersionsDrawer';
import { runByNode, useRunPolling } from '@app/Chatbots/editor/useRunPolling';
import { useEditorState } from '@app/Chatbots/editor/useEditorState';
import { useUnsavedGuard } from '@app/Chatbots/editor/useUnsavedGuard';
import '@app/Chatbots/nodes';

export const PUBLISHED_TEXT = 'Published chatbots cannot be edited. Move the chatbot to draft to change it.';

export const PREVIEW_TEXT = 'Previewing an older version. Exit the preview to edit.';

const Editor: React.FunctionComponent<{
  initial: Chatbot;
  options: ChatbotOptions | null;
  initialRunId: string | null;
}> = ({ initial, options, initialRunId }) => {
  const canManage = useAccess().hasInWorkspace('chatbot:manage');
  const { token, workspace } = useSession();
  const state = useEditorState(initial);
  const {
    chatbot,
    flow,
    setFlow,
    dirty,
    problems,
    byNode,
    selectedId,
    select,
    save,
    publish,
    unpublish,
    saving,
    error,
  } = state;
  const [preview, setPreview] = React.useState<SavedFlow | null>(null);
  const [versions, setVersions] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const readOnly = !canManage || chatbot.status === 'PUBLISHED' || preview !== null;
  const guard = useUnsavedGuard(dirty && !readOnly);
  const [palette, setPalette] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [runId, setRunId] = React.useState<string | null>(initialRunId);
  const polling = useRunPolling(chatbot.id, runId);
  const run: Run | null = polling.run;
  const [runError, setRunError] = React.useState<string | null>(null);
  const stopTheRun = async () => {
    if (!run || !token) return;
    try {
      await stopRun(token, workspace?.id ?? '', chatbot.id, run.id);
      polling.refresh();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    }
  };
  useDocumentTitle(`${chatbot.name} | Chatbots | Omnichannel CRM`);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!readOnly && dirty && !saving) void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly, dirty, saving, save]);

  const place =
    (connectFrom: { source: string; sourceHandle: string | null } | null, position?: { x: number; y: number }) =>
    (type: NodeType) => {
      setFlow((current) => {
        const at = position ?? { x: 120 + 60 * current.nodes.length, y: 120 + 40 * current.nodes.length };
        const added = addNode(current, type, at);
        let next = added.flow;
        if (connectFrom) {
          next = {
            ...next,
            edges: next.edges.concat([
              {
                id: `${connectFrom.source}-${connectFrom.sourceHandle ?? 'next'}-${added.id}`,
                source: connectFrom.source,
                sourceHandle: connectFrom.sourceHandle ?? 'next',
                target: added.id,
              },
            ]),
          };
        }
        return next;
      });
      setPalette(false);
    };
  const [pendingAdd, setPendingAdd] = React.useState<{
    position: { x: number; y: number };
    connectFrom: { source: string; sourceHandle: string | null } | null;
  } | null>(null);

  const actions = React.useMemo(
    () => ({
      readOnly,
      options,
      select,
      rename: (id: string, name: string) => {
        if (!isValidName(name)) return 'Use 1 to 40 letters, digits or underscores';
        if (flow.nodes.some((n) => n.id !== id && n.data.name.toLowerCase() === name.toLowerCase()))
          return 'Another node has this name';
        setFlow((current) => renameNode(current, id, name));
        return null;
      },
      duplicate: (id: string) => setFlow((current) => duplicateNode(current, id)),
      remove: (id: string) => {
        setFlow((current) => removeNode(current, id));
        if (selectedId === id) select(null);
      },
    }),
    [readOnly, options, select, flow.nodes, setFlow, selectedId],
  );

  const selected = selectedId ? (flow.nodes.find((n) => n.id === selectedId) ?? null) : null;
  const panel = versions ? (
    <DrawerPanelContent widths={{ default: 'width_100', lg: 'width_33' }}>
      <VersionsDrawer
        chatbot={chatbot}
        readOnly={!canManage || chatbot.status === 'PUBLISHED'}
        onPreview={setPreview}
        onRestored={(result) => {
          state.applySaved(result);
          setVersions(false);
        }}
        onClose={() => {
          setPreview(null);
          setVersions(false);
        }}
      />
    </DrawerPanelContent>
  ) : run ? (
    <DrawerPanelContent widths={{ default: 'width_100', lg: 'width_33' }}>
      <RunOverlayPanel run={run} flow={flow} onStop={() => void stopTheRun()} onClose={() => setRunId(null)} />
    </DrawerPanelContent>
  ) : palette || pendingAdd ? (
    <DrawerPanelContent widths={{ default: 'width_100', lg: 'width_33' }}>
      <NodePalette onPick={pendingAdd ? place(pendingAdd.connectFrom, pendingAdd.position) : place(null)} />
    </DrawerPanelContent>
  ) : selected ? (
    <DrawerPanelContent widths={{ default: 'width_100', lg: 'width_50', '2xl': 'width_33' }}>
      <NodeDrawer
        node={selected}
        flow={flow}
        chatbotId={chatbot.id}
        options={options}
        problems={byNode[selected.id] ?? []}
        readOnly={readOnly}
        onChange={(settings) =>
          setFlow((current) => ({
            ...current,
            nodes: current.nodes.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, settings } } : n)),
          }))
        }
        onClose={() => select(null)}
      />
    </DrawerPanelContent>
  ) : undefined;

  return (
    <EditorContext.Provider value={actions}>
      <div className="omni-flow-page">
        <EditorHeader
          chatbot={chatbot}
          dirty={dirty}
          saving={saving}
          canManage={canManage}
          problems={problems}
          onBack={() => guard.leave('/chatbots')}
          onSave={() => void save()}
          onPublish={() => void publish()}
          onUnpublish={() => void unpublish()}
          onAddNode={() => {
            setPendingAdd(null);
            setPalette((p) => !p);
          }}
          onTest={() => setTesting(true)}
          onRuns={() => guard.leave(`/chatbots/${chatbot.id}/runs`)}
          onVersions={() => {
            select(null);
            setPalette(false);
            setVersions(true);
          }}
          onSettings={() => setSettingsOpen(true)}
          onPickProblem={(nodeId) => {
            if (nodeId) select(nodeId);
          }}
        />
        {chatbot.status === 'PUBLISHED' && <Alert variant="info" isInline title={PUBLISHED_TEXT} />}
        {preview && <Alert variant="info" isInline title={PREVIEW_TEXT} />}
        {(runError || polling.error) && <Alert variant="danger" isInline title={runError ?? polling.error} />}
        {error && (
          <Alert
            variant="danger"
            isInline
            title={error}
            actionClose={
              <button
                type="button"
                className="pf-v6-c-button pf-m-plain"
                aria-label="Close"
                onClick={state.clearError}
              />
            }
          />
        )}
        <Drawer isExpanded={panel !== undefined} isInline position="right">
          <DrawerContent panelContent={panel}>
            <DrawerContentBody>
              <FlowCanvas
                flow={preview ?? flow}
                readOnly={readOnly}
                problems={problems}
                runByNode={runByNode(run)}
                selectedId={selectedId}
                onFlowChange={(next) => {
                  if (!readOnly) setFlow(next);
                }}
                onSelect={(id) => {
                  setPalette(false);
                  setPendingAdd(null);
                  select(id);
                }}
                onAddAt={(position, connectFrom) => setPendingAdd({ position, connectFrom })}
              />
            </DrawerContentBody>
          </DrawerContent>
        </Drawer>
        {settingsOpen && (
          <SettingsModal
            settings={chatbot.settings}
            readOnly={!canManage || chatbot.status === 'PUBLISHED'}
            onSave={(next) => {
              state.updateSettings(next);
              setSettingsOpen(false);
            }}
            onClose={() => setSettingsOpen(false)}
          />
        )}
        {testing && (
          <TestDialog
            chatbot={chatbot}
            canStart={!problems.some((p) => p.severity === 'ERROR')}
            dirty={dirty}
            onStarted={(started) => {
              setTesting(false);
              select(null);
              setRunId(started.id);
            }}
            onClose={() => setTesting(false)}
          />
        )}
        {guard.pending && (
          <ConfirmModal
            title="Leave without saving?"
            confirmLabel="Leave"
            variant="danger"
            onConfirm={guard.confirmLeave}
            onCancel={guard.stay}
          >
            Your changes to this chatbot are not saved.
          </ConfirmModal>
        )}
      </div>
    </EditorContext.Provider>
  );
};

/** The chatbot editor (spec §8.1); its canvas library lives in this lazy chunk. */
export const ChatbotEditorPage: React.FunctionComponent = () => {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const chatbot = useLoad((tk) => getChatbot(tk, ws, id as string), [ws, id]);
  const options = useLoad((tk) => getChatbotOptions(tk, ws), [ws]);
  if (chatbot.error) return <Alert variant="danger" isInline title={chatbot.error} />;
  if (!chatbot.data) return <Spinner aria-label="Loading chatbot" />;
  return (
    <Editor
      key={`${chatbot.data.id}-${chatbot.data.status}`}
      initial={chatbot.data}
      options={options.data ?? null}
      initialRunId={search.get('run')}
    />
  );
};
