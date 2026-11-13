import * as React from 'react';
import type { Chatbot, Problem, SavedFlow } from '@app/api/chatbots';
import { publishChatbot, saveChatbot, unpublishChatbot } from '@app/api/chatbots';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';
import { clientProblems, problemsByNode, pruneEdges, publishErrorsToProblems, signature } from '@app/Chatbots/flowModel';

export const STALE_TEXT = 'This chatbot was saved by someone else. Reload the page to continue.';

export interface EditorState {
  chatbot: Chatbot;
  flow: SavedFlow;
  setFlow(next: SavedFlow | ((current: SavedFlow) => SavedFlow)): void;
  dirty: boolean;
  problems: Problem[];
  byNode: Record<string, Problem[]>;
  flowProblems: Problem[];
  strayProblems: Problem[];
  selectedId: string | null;
  select(id: string | null): void;
  save(): Promise<Chatbot | undefined>;
  publish(): Promise<void>;
  unpublish(): Promise<void>;
  saving: boolean;
  error: string | null;
  clearError(): void;
}

/** The editor's source of truth: the saved flow, its dirtiness, the server's problems, the selected node. */
export function useEditorState(initial: Chatbot): EditorState {
  const { token, workspace } = useSession();
  const t = token as string;
  const ws = workspace?.id ?? '';
  const [chatbot, setChatbot] = React.useState<Chatbot>(initial);
  const [flow, setFlowState] = React.useState<SavedFlow>(initial.flow);
  const [savedSignature, setSavedSignature] = React.useState(() => signature(initial.flow));
  const [serverProblems, setServerProblems] = React.useState<Problem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const setFlow = React.useCallback((next: SavedFlow | ((current: SavedFlow) => SavedFlow)) => {
    setFlowState((current) => (typeof next === 'function' ? next(current) : next));
  }, []);

  const dirty = signature(flow) !== savedSignature;
  const problems = React.useMemo(
    () => (dirty ? clientProblems(flow, chatbot.id) : serverProblems.concat(clientProblems(flow, chatbot.id).filter((p) => !serverProblems.some((s) => s.nodeId === p.nodeId && s.field === p.field)))),
    [dirty, flow, serverProblems, chatbot.id],
  );
  const buckets = React.useMemo(() => problemsByNode(problems, flow), [problems, flow]);

  const save = React.useCallback(async (): Promise<Chatbot | undefined> => {
    setSaving(true);
    setError(null);
    try {
      const pruned = pruneEdges(flow);
      const result = await saveChatbot(t, ws, chatbot.id, { flow: pruned, settings: chatbot.settings, version: chatbot.version });
      setChatbot(result.chatbot);
      setFlowState(pruned);
      setSavedSignature(signature(pruned));
      setServerProblems(result.problems);
      return result.chatbot;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.code !== 'CHATBOT_PUBLISHED') setError(STALE_TEXT);
      else setError(messageFor(e));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, [flow, t, ws, chatbot]);

  const publish = React.useCallback(async () => {
    setError(null);
    let current = chatbot;
    if (dirty) {
      const saved = await save();
      if (!saved) return;
      current = saved;
    }
    setSaving(true);
    try {
      setChatbot(await publishChatbot(t, ws, current.id));
      setServerProblems([]);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'VALIDATION' && e.fields) {
        const found = publishErrorsToProblems(e.fields);
        setServerProblems(found);
        const first = found.find((p) => p.nodeId !== null);
        if (first && first.nodeId) setSelectedId(first.nodeId);
      } else {
        setError(messageFor(e));
      }
    } finally {
      setSaving(false);
    }
  }, [chatbot, dirty, save, t, ws]);

  const unpublish = React.useCallback(async () => {
    setError(null);
    try {
      setChatbot(await unpublishChatbot(t, ws, chatbot.id));
    } catch (e) {
      setError(messageFor(e));
    }
  }, [chatbot.id, t, ws]);

  return {
    chatbot,
    flow,
    setFlow,
    dirty,
    problems,
    byNode: buckets.byNode,
    flowProblems: buckets.flow,
    strayProblems: buckets.stray,
    selectedId,
    select: setSelectedId,
    save,
    publish,
    unpublish,
    saving,
    error,
    clearError: () => setError(null),
  };
}
