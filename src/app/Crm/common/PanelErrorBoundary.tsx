import * as React from 'react';
import { Alert, Button } from '@patternfly/react-core';

interface Props {
  /** Called on Retry, before the children are shown again (e.g. to re-create a lazy import that failed). */
  onRetry(): void;
  children: React.ReactNode;
}

/** Keeps a failed side panel (a chunk that did not load, a render exception) from taking the page down with it. */
export class PanelErrorBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <Alert
        variant="danger"
        isInline
        isPlain
        title="CRM unavailable"
        actionLinks={
          <Button
            variant="link"
            isInline
            onClick={() => {
              this.props.onRetry();
              this.setState({ failed: false });
            }}
          >
            Retry
          </Button>
        }
      />
    );
  }
}
