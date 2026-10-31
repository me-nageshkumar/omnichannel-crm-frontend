import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ActionGroup,
  Alert,
  AlertActionLink,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
  Spinner,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { createSegment, getSegment, updateSegment } from '@app/api/crm';
import type { ContactLabel } from '@app/api/contacts';
import type { Segment, SegmentFieldCatalog, SegmentRuleGroup } from '@app/api/crm';
import { ApiError } from '@app/api/client';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import type { FieldUser } from '@app/Crm/common/fields/types';
import { crmMessage } from '@app/Crm/errors';
import { PERMISSION_TEXT } from '@app/Crm/segments/SegmentsPage';
import { SegmentPreview } from '@app/Crm/segments/SegmentPreview';
import { SegmentRuleEditor } from '@app/Crm/segments/SegmentRuleEditor';
import { cleanRules, emptyGroup, isComplete, splitErrors } from '@app/Crm/segments/segmentModel';
import { useSegmentFields } from '@app/Crm/segments/useSegmentFields';
import { useCrmCan } from '@app/Crm/status/CrmStatusContext';

const LIST = '/crm/segments';
export const MAX_NAME = 80;
export const MAX_DESCRIPTION = 500;
export const CONFLICT_TEXT = 'Someone changed this segment; reload to see their version';

const EditorForm: React.FunctionComponent<{
  existing?: Segment;
  catalog: SegmentFieldCatalog;
  labels: ContactLabel[];
  users: FieldUser[];
  onReload(): void;
}> = ({ existing, catalog, labels, users, onReload }) => {
  const { token, workspace } = useSession();
  const t = token as string;
  const ws = workspace?.id ?? '';
  const navigate = useNavigate();
  const [name, setName] = React.useState(existing?.name ?? '');
  const [description, setDescription] = React.useState(existing?.description ?? '');
  const [rules, setRules] = React.useState<SegmentRuleGroup>(() => existing?.rules ?? emptyGroup());
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [ruleErrors, setRuleErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [conflict, setConflict] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const changeRules = (next: SegmentRuleGroup) => {
    setRules(next);
    setRuleErrors({});
    setError(null);
  };

  const saveDisabled = saving || name.trim() === '' || !isComplete(rules, catalog);

  const onSave = async () => {
    if (saveDisabled) return;
    setSaving(true);
    setNameError(null);
    setRuleErrors({});
    setError(null);
    setConflict(false);
    const body = { name: name.trim(), description: description.trim(), rules: cleanRules(rules) };
    try {
      if (existing) await updateSegment(t, ws, existing.id, { ...body, version: existing.version });
      else await createSegment(t, ws, body);
      navigate(LIST);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'SEGMENT_NAME_TAKEN') {
        setNameError(e.serverMessage ?? 'A segment with this name already exists');
      } else if (e instanceof ApiError && e.code === 'INVALID_SEGMENT') {
        const split = splitErrors(e.extra ?? {}, rules);
        setRuleErrors(split.byPath);
        if (split.name) setNameError(split.name);
        const other = split.other.filter((m) => !m.startsWith('description:'));
        const description = split.other.find((m) => m.startsWith('description:'));
        setError([description, ...other].filter(Boolean).join('; ') || null);
      } else if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') {
        setConflict(true);
      } else {
        setError(crmMessage(e));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      {conflict && (
        <Alert
          variant="warning"
          isInline
          title={CONFLICT_TEXT}
          actionLinks={<AlertActionLink onClick={onReload}>Reload</AlertActionLink>}
        />
      )}
      <FormGroup label="Name" isRequired fieldId="segment-name">
        <TextInput
          id="segment-name"
          isRequired
          value={name}
          maxLength={MAX_NAME}
          isDisabled={saving}
          validated={nameError ? 'error' : 'default'}
          aria-invalid={nameError ? 'true' : 'false'}
          onChange={(_e, v) => {
            setName(v);
            setNameError(null);
          }}
        />
        {nameError && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{nameError}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>
      <FormGroup label="Description" fieldId="segment-description">
        <TextArea
          id="segment-description"
          value={description}
          maxLength={MAX_DESCRIPTION}
          isDisabled={saving}
          resizeOrientation="vertical"
          onChange={(_e, v) => setDescription(v)}
        />
      </FormGroup>
      <Grid hasGutter>
        <GridItem md={8}>
          <SegmentRuleEditor
            value={rules}
            onChange={changeRules}
            catalog={catalog}
            labels={labels}
            users={users}
            errors={ruleErrors}
            isDisabled={saving}
          />
        </GridItem>
        <GridItem md={4}>
          <SegmentPreview rules={rules} catalog={catalog} onRuleErrors={setRuleErrors} />
        </GridItem>
      </Grid>
      {error && <Alert variant="danger" isInline title={error} />}
      <ActionGroup>
        <Button variant="primary" isDisabled={saveDisabled} isLoading={saving} onClick={() => void onSave()}>
          Save
        </Button>
        <Button variant="link" onClick={() => navigate(LIST)}>
          Cancel
        </Button>
      </ActionGroup>
    </Form>
  );
};

/** Builds a new segment or edits one (spec C18): name, description, the rule builder and the live preview. */
export const SegmentEditorPage: React.FunctionComponent = () => {
  const { id } = useParams();
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const canUse = useCrmCan('crm:segments');
  const fields = useSegmentFields(canUse);
  const segment = useLoad(
    (tk) => (id && canUse ? getSegment(tk, ws, id) : Promise.resolve(undefined)),
    [ws, id, canUse],
  );
  const [generation, setGeneration] = React.useState(0);
  const title = id ? 'Edit segment' : 'New segment';

  if (!canUse) {
    return (
      <PageShell title={title}>
        <Alert variant="info" isInline title={PERMISSION_TEXT} />
      </PageShell>
    );
  }
  const error = segment.error ?? fields.error;
  const ready = fields.catalog && (!id || segment.data);
  return (
    <PageShell title={title}>
      {error ? (
        <Alert variant="danger" isInline title={error} />
      ) : !ready ? (
        <Spinner aria-label="Loading segment" />
      ) : (
        <EditorForm
          key={`${id ?? 'new'}-${segment.data?.version ?? 'n'}-${generation}`}
          existing={segment.data ?? undefined}
          catalog={fields.catalog as SegmentFieldCatalog}
          labels={fields.labels}
          users={fields.users}
          onReload={() => {
            // forget the stale version first, so the form remounts from the re-fetched one, not from this one
            segment.setData(() => undefined);
            segment.reload();
            setGeneration((g) => g + 1);
          }}
        />
      )}
    </PageShell>
  );
};
