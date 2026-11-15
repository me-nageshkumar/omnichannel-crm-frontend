import * as React from 'react';
import type { IAppRoute } from '@app/routes';
import { AiPage } from '@app/AI/AiPage';

export const aiRoutes: IAppRoute[] = [
  { path: '/ai', requires: (a) => a.hasInWorkspace('ai:view'), element: <AiPage /> },
];
