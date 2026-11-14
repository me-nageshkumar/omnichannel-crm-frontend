import * as React from 'react';
import { Bullseye, Spinner } from '@patternfly/react-core';
import type { IAppRoute } from '@app/routes';
import { ChatbotDefaultsPage } from '@app/Chatbots/ChatbotDefaultsPage';
import { ChatbotSettingsPage } from '@app/Chatbots/ChatbotSettingsPage';

// The editor and its canvas library are their own chunk, fetched only when a chatbot is opened.
const ChatbotEditorPage = React.lazy(() =>
  import('@app/Chatbots/ChatbotEditorPage').then((m) => ({ default: m.ChatbotEditorPage })),
);
const ChatbotRunsPage = React.lazy(() =>
  import('@app/Chatbots/ChatbotRunsPage').then((m) => ({ default: m.ChatbotRunsPage })),
);

const lazyPage = (Page: React.LazyExoticComponent<React.FunctionComponent>): React.ReactElement => (
  <React.Suspense
    fallback={
      <Bullseye>
        <Spinner aria-label="Loading" />
      </Bullseye>
    }
  >
    <Page />
  </React.Suspense>
);

export const chatbotRoutes: IAppRoute[] = [
  { path: '/chatbots/settings', requires: (a) => a.hasInWorkspace('chatbot:view'), element: <ChatbotSettingsPage /> },
  {
    path: '/platform/chatbot-settings',
    requires: (a) => a.has('chatbot-defaults:manage'),
    element: <ChatbotDefaultsPage />,
  },
  { path: '/chatbots/:id', requires: (a) => a.hasInWorkspace('chatbot:view'), element: lazyPage(ChatbotEditorPage) },
  { path: '/chatbots/:id/runs', requires: (a) => a.hasInWorkspace('chatbot:view'), element: lazyPage(ChatbotRunsPage) },
];
