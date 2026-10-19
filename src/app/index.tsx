import * as React from 'react';
import '@patternfly/react-core/dist/styles/base.css';
import { BrowserRouter as Router } from 'react-router-dom';
import { AppShell } from '@app/AppShell';
import '@app/app.css';

const App: React.FunctionComponent = () => (
  <Router>
    <AppShell />
  </Router>
);

export default App;
