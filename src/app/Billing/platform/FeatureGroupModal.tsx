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
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Radio,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { type FeatureGroup, type GroupCategory, createGroup, updateGroup } from '@app/api/billing';
import { listAuthorities } from '@app/api/authorities';
import { AuthorityPicker } from '@app/admin/AuthorityPicker';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';

const FIELDS = ['code', 'name', 'category', 'authorities', 'requires'];
const CORE = 'core';

const FieldError: React.FunctionComponent<{ message?: string }> = ({ message }) =>
  message ? (
    <FormHelperText>
      <HelperText>
        <HelperTextItem variant="error">{message}</HelperTextItem>
      </HelperText>
    </FormHelperText>
  ) : null;

/** Creates a feature group, or edits one. The server decides what is allowed; its answers show beside the field. */
export const FeatureGroupModal: React.FunctionComponent<{
  group: FeatureGroup | null;
  groups: FeatureGroup[];
  onSaved(group: FeatureGroup): void;
  onCancel(): void;
}> = ({ group, groups, onSaved, onCancel }) => {
  const { token } = useSession();
  const [code, setCode] = React.useState(group?.code ?? '');
  const [name, setName] = React.useState(group?.name ?? '');
  const [description, setDescription] = React.useState(group?.description ?? '');
  const [category, setCategory] = React.useState<GroupCategory>(group?.category ?? 'PAID');
  const [authorities, setAuthorities] = React.useState<string[]>(group?.authorities ?? []);
  const [requires, setRequires] = React.useState<string[]>(group?.requires ?? []);
  const action = useAction(FIELDS);
  const catalogue = useLoad(listAuthorities);

  const others = groups.filter((g) => g.code !== group?.code);
  // A customer can only ever hold company and brand permissions.
  const offered = (catalogue.data ?? []).filter((a) => a.level !== 'PLATFORM');
  const taken: Record<string, string> = {};
  others.forEach((g) => g.authorities.forEach((a) => (taken[a] = `In group ${g.name}`)));
  const isCore = group?.code === CORE;

  const save = async () => {
    const body = {
      name,
      description,
      category,
      authorities,
      requires,
      sortOrder: group?.sortOrder ?? Math.max(0, ...groups.map((g) => g.sortOrder)) + 10,
    };
    const saved = await action.run(() =>
      group
        ? updateGroup(token as string, group.code, { ...body, version: group.version })
        : createGroup(token as string, { ...body, code: code.trim() }),
    );
    if (saved) onSaved(saved);
  };

  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="feature-group-title">
      <ModalHeader title={group ? `Edit ${group.name}` : 'Add feature group'} labelId="feature-group-title" />
      <ModalBody>
        <Form
          id="feature-group-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {action.error && <Alert variant="danger" isInline title={action.error} />}
          {catalogue.error && <Alert variant="danger" isInline title={catalogue.error} />}
          {!group && (
            <FormGroup label="Code" isRequired fieldId="feature-group-code">
              <TextInput id="feature-group-code" isRequired value={code} onChange={(_e, v) => setCode(v)} />
              <FieldError message={action.fieldErrors.code} />
              {!action.fieldErrors.code && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>Small letters, digits and hyphens. It cannot be changed later.</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>
          )}
          <FormGroup label="Name" isRequired fieldId="feature-group-name">
            <TextInput id="feature-group-name" isRequired value={name} onChange={(_e, v) => setName(v)} />
            <FieldError message={action.fieldErrors.name} />
          </FormGroup>
          <FormGroup label="Description" fieldId="feature-group-description">
            <TextArea
              id="feature-group-description"
              value={description}
              maxLength={300}
              onChange={(_e, v) => setDescription(v)}
            />
          </FormGroup>
          <FormGroup role="radiogroup" label="Category" fieldId="feature-group-category" isInline>
            <Radio
              id="feature-group-default"
              name="feature-group-category"
              label="Default"
              description="In every plan, at no charge"
              isChecked={category === 'DEFAULT'}
              isDisabled={isCore}
              onChange={() => setCategory('DEFAULT')}
            />
            <Radio
              id="feature-group-paid"
              name="feature-group-category"
              label="Paid"
              description="Included in a plan or bought as an add-on"
              isChecked={category === 'PAID'}
              isDisabled={isCore}
              onChange={() => setCategory('PAID')}
            />
            <FieldError message={action.fieldErrors.category} />
          </FormGroup>
          {others.length > 0 && (
            <FormGroup role="group" label="Requires" fieldId="feature-group-requires" isInline>
              {others.map((g) => (
                <Checkbox
                  key={g.code}
                  id={`feature-group-requires-${g.code}`}
                  label={g.name}
                  isChecked={requires.includes(g.code)}
                  onChange={(_e, on) =>
                    setRequires((r) =>
                      on ? [...r.filter((c) => c !== g.code), g.code] : r.filter((c) => c !== g.code),
                    )
                  }
                />
              ))}
              <FieldError message={action.fieldErrors.requires} />
            </FormGroup>
          )}
          <FormGroup role="group" label="Permissions" fieldId="feature-group-authorities">
            <FieldError message={action.fieldErrors.authorities} />
            <AuthorityPicker
              authorities={offered}
              selected={authorities}
              onChange={setAuthorities}
              disabledCodes={taken}
              idPrefix="feature-group-auth"
            />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="feature-group-form" isDisabled={action.busy}>
          {group ? 'Save' : 'Create'}
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
