import * as React from 'react';
import {
  Alert,
  Button,
  CodeBlock,
  CodeBlockCode,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@patternfly/react-core';
import { aiMessage } from '@app/AI/aiMessages';

/** The stored text of a web page or note, as the AI reads it. */
export const SourceTextModal: React.FunctionComponent<{ title: string; load(): Promise<string>; onClose(): void }> = ({
  title,
  load,
  onClose,
}) => {
  const [text, setText] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    load().then(setText, (e: unknown) => setError(aiMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Modal isOpen variant="large" onClose={onClose} aria-labelledby="kb-text-title">
      <ModalHeader title={title} labelId="kb-text-title" description="The text the AI answers from." />
      <ModalBody>
        {error && <Alert variant="danger" isInline isPlain title={error} />}
        {text === null && !error && <Spinner aria-label="Loading text" />}
        {text !== null && (
          <CodeBlock>
            <CodeBlockCode style={{ whiteSpace: 'pre-wrap' }}>{text}</CodeBlockCode>
          </CodeBlock>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};
