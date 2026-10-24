import * as React from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@patternfly/react-core';
import { getUserPipelines, listPipelines, putUserPipelines } from '@app/api/crm';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';

/** Picks the CRM pipelines one user of the current brand may use. */
export const UserPipelinesModal: React.FunctionComponent<{
  user: { id: string; name: string };
  onClose(): void;
}> = ({ user, onClose }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const loaded = useLoad(
    async (t) => {
      const [pipelines, assigned] = await Promise.all([listPipelines(t, ws), getUserPipelines(t, ws, user.id)]);
      return { pipelines, assigned: assigned.pipelineIds };
    },
    [ws, user.id],
  );
  const [selected, setSelected] = React.useState<string[]>([]);
  const action = useAction();

  React.useEffect(() => {
    if (loaded.data) setSelected(loaded.data.assigned);
  }, [loaded.data]);

  const toggle = (id: string, on: boolean) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const saved = await action.run(() => putUserPipelines(token as string, ws, user.id, selected));
    if (saved) onClose();
  };

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-labelledby="user-pipelines-title">
      <ModalHeader title={`CRM pipelines for ${user.name}`} labelId="user-pipelines-title" />
      <ModalBody>
        {(loaded.error || action.error) && (
          <Alert variant="danger" isInline isPlain title={loaded.error ?? action.error} />
        )}
        {loaded.loading && !loaded.data ? (
          <Spinner aria-label="Loading pipelines" />
        ) : (
          <Form id="user-pipelines-form" onSubmit={onSubmit}>
            <FormGroup role="group" label="Pipelines" fieldId="user-pipelines-list">
              {(loaded.data?.pipelines ?? []).map((p) => (
                <Checkbox
                  key={p.id}
                  id={`user-pipeline-${p.id}`}
                  label={
                    p.active ? (
                      p.name
                    ) : (
                      <>
                        {p.name}{' '}
                        <Label isCompact color="grey">
                          Inactive
                        </Label>
                      </>
                    )
                  }
                  isChecked={selected.includes(p.id)}
                  onChange={(_e, on) => toggle(p.id, on)}
                />
              ))}
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{"Users with 'see every pipeline' access see all pipelines anyway."}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          </Form>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="user-pipelines-form" isDisabled={action.busy || !loaded.data}>
          Save
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
