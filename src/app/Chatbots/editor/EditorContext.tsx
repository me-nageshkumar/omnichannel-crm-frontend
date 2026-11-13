import * as React from 'react';
import type { ChatbotOptions } from '@app/api/chatbots';

/** What a node card may do; React Flow node components take no props of ours, so they read this. */
export interface EditorActions {
  readOnly: boolean;
  options: ChatbotOptions | null;
  select(id: string): void;
  rename(id: string, name: string): string | null;
  duplicate(id: string): void;
  remove(id: string): void;
}

export const EditorContext = React.createContext<EditorActions>({
  readOnly: true,
  options: null,
  select: () => undefined,
  rename: () => null,
  duplicate: () => undefined,
  remove: () => undefined,
});
