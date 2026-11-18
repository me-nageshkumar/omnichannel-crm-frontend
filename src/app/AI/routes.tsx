import * as React from 'react';
import type { IAppRoute } from '@app/routes';
import { AiPage } from '@app/AI/AiPage';
import { KnowledgeBasePage } from '@app/AI/knowledge/KnowledgeBasePage';

export const aiRoutes: IAppRoute[] = [
  { path: '/ai', requires: (a) => a.hasInWorkspace('ai:view'), element: <AiPage /> },
  { path: '/ai/knowledge/:id', requires: (a) => a.hasInWorkspace('ai:view'), element: <KnowledgeBasePage /> },
];
