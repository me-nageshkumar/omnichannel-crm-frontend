import * as React from 'react';
import type { Chatbot, ChatbotSettings, Problem, SaveResult, SavedFlow } from '@app/api/chatbots';
import { publishChatbot, saveChatbot, unpublishChatbot } from '@app/api/chatbots';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';
import {
  clientProblems,
  problemsByNode,
  pruneEdges,
  publishErrorsToProblems,
  signature,
} from '@app/Chatbots/flowModel';

export const STALE_TEXT = 'This chatbot was saved by someone else. Reload the page to continue.';

/** Each node's data as text, keyed by id. */
function nodeSignatures(flow: SavedFlow): Record<string, string> {
  const out: Record<string, string> = {};
  flow.nodes.forEach((n) => (out[n.id] = JSON.stringify(n.data)));
  return out;
}

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
  /** Changes the run settings; they travel with the flow on the next save. */
  updateSettings(next: ChatbotSettings): void;
  /** Renames the draft; the name travels with the next save. Answers an error text, or null when accepted. */
  rename(name: string): string | null;
  /** Takes a restored version (or any server save) as the new saved state. */
  applySaved(result: SaveResult): void;
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
  const [settingsDirty, setSettingsDirty] = React.useState(false);
  const [nameDirty, setNameDirty] = React.useState(false);
  // what each node looked like at the last save: a server problem outlives edits to other nodes, not to its own
  const [savedNodes, setSavedNodes] = React.useState<Record<string, string>>(() => nodeSignatures(initial.flow));

  const setFlow = React.useCallback((next: SavedFlow | ((current: SavedFlow) => SavedFlow)) => {
    setFlowState((current) => (typeof next === 'function' ? next(current) : next));
  }, []);

  const dirty = settingsDirty || nameDirty || signature(flow) !== savedSignature;
  const problems = React.useMemo(() => {
    const current = nodeSignatures(flow);
    // the server's word stands until the next save, except about a node that changed since (then it may be stale)
    const kept = serverProblems.filter((s) =>
      s.nodeId === null ? !dirty : current[s.nodeId] === savedNodes[s.nodeId],
    );
    return kept.concat(
      clientProblems(flow, chatbot.id).filter((p) => !kept.some((s) => s.nodeId === p.nodeId && s.field === p.field)),
    );
  }, [dirty, flow, serverProblems, savedNodes, chatbot.id]);
  const buckets = React.useMemo(() => problemsByNode(problems, flow), [problems, flow]);

  const save = React.useCallback(async (): Promise<Chatbot | undefined> => {
    setSaving(true);
    setError(null);
    try {
      const pruned = pruneEdges(flow);
      const result = await saveChatbot(t, ws, chatbot.id, {
        name: chatbot.name,
        flow: pruned,
        settings: chatbot.settings,
        version: chatbot.version,
      });
      setChatbot(result.chatbot);
      setFlowState(pruned);
      setSavedSignature(signature(pruned));
      setSavedNodes(nodeSignatures(pruned));
      setSettingsDirty(false);
      setNameDirty(false);
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
    updateSettings: (next) => {
      setChatbot((c) => ({ ...c, settings: next }));
      setSettingsDirty(true);
    },
    rename: (name) => {
      if (name.length === 0 || name.length > 80) return 'Use 1 to 80 characters';
      if (name !== chatbot.name) {
        setChatbot((c) => ({ ...c, name }));
        setNameDirty(true);
      }
      return null;
    },
    applySaved: (result) => {
      setChatbot(result.chatbot);
      setFlowState(result.chatbot.flow);
      setSavedSignature(signature(result.chatbot.flow));
      setSavedNodes(nodeSignatures(result.chatbot.flow));
      setSettingsDirty(false);
      setNameDirty(false);
      setServerProblems(result.problems);
      setSelectedId(null);
    },
  };
}
