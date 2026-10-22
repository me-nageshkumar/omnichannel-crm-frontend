import * as React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  ActionGroup,
  Alert,
  Button,
  Card,
  CardBody,
  CodeBlock,
  CodeBlockCode,
  Content,
  Flex,
  Form,
  FormGroup,
  FormHelperText,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
  Spinner,
  Tab,
  TabTitleText,
  Tabs,
  TextInput,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import {
  Contact,
  ContactAttribute,
  ContactLabel,
  FILTER_SAMPLE_SIZE,
  FilterPreview,
  RuleGroup,
  SavedFilter,
  createFilter,
  getFilter,
  isAdvanced,
  listAttributes,
  listLabels,
  previewFilter,
  updateFilter,
} from '@app/api/contacts';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { NotFound } from '@app/NotFound/NotFound';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { LabelChip } from '@app/Contacts/LabelChip';
import { displayName, phoneText } from '@app/Contacts/contactDisplay';
import { countText } from '@app/Contacts/filterSpec';
import { RuleTreeEditor } from '@app/Contacts/Filters/RuleTreeEditor';
import { cleanRules, emptyGroup, isComplete, missingIds, splitErrors } from '@app/Contacts/Filters/filterModel';

const SAVED_FILTERS = '/contacts/filters';
const GAP: React.CSSProperties = { marginTop: 'var(--pf-t--global--spacer--md)' };

/** The answer of the last preview, for the tree whose cleaned JSON is {@code key}. */
interface Checked {
  key: string;
  count: number;
  query: Record<string, unknown>;
  sample: Contact[] | null;
}

const SampleTable: React.FunctionComponent<{ sample: Contact[]; labels: ContactLabel[] }> = ({ sample, labels }) => {
  const labelById = new Map(labels.map((l) => [l.id, l]));
  return (
    <Table aria-label="Sample contacts" variant="compact">
      <Thead>
        <Tr>
          <Th>Name</Th>
          <Th>Phone</Th>
          <Th>Labels</Th>
        </Tr>
      </Thead>
      <Tbody>
        {sample.map((c) => (
          <Tr key={c.id}>
            <Td dataLabel="Name">{displayName(c)}</Td>
            <Td dataLabel="Phone">{phoneText(c)}</Td>
            <Td dataLabel="Labels">
              {c.labels.map((id) => labelById.get(id)).map((l) => l && <LabelChip key={l.id} label={l} />)}
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};

const FilterBuilderForm: React.FunctionComponent<{
  existing?: SavedFilter;
  labels: ContactLabel[];
  attributes: ContactAttribute[];
}> = ({ existing, labels, attributes }) => {
  const { token, workspace } = useSession();
  const t = token as string;
  const ws = workspace?.id ?? '';
  const navigate = useNavigate();
  const save = useAction(['name']);
  const [name, setName] = React.useState(existing?.name ?? '');
  const [rules, setRules] = React.useState<RuleGroup>(() => existing?.rules ?? emptyGroup());
  const [tab, setTab] = React.useState<'rules' | 'query'>('rules');
  const [checked, setChecked] = React.useState<Checked | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [ruleErrors, setRuleErrors] = React.useState<Record<string, string>>({});
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  const key = JSON.stringify(cleanRules(rules));
  // The tree in view now, for dropping a preview answer that was sent for an older tree.
  const keyRef = React.useRef(key);
  keyRef.current = key;

  const missing = React.useMemo(() => missingIds(rules, labels, attributes), [rules, labels, attributes]);
  const blocked = !isComplete(rules) || missing.attributeIds.length + missing.labelIds.length > 0;
  const busy = previewing || save.busy;
  const current = checked?.key === key ? checked : null;
  const query = checked?.query ?? existing?.query ?? null;
  const shownNameError = nameError ?? save.fieldErrors.name;

  const changeRules = (next: RuleGroup) => {
    setRules(next);
    setRuleErrors({});
    setPreviewError(null);
  };

  const runPreview = async (sample?: number): Promise<FilterPreview | undefined> => {
    const sent = key;
    const body = cleanRules(rules);
    setPreviewing(true);
    setRuleErrors({});
    setNameError(null);
    setPreviewError(null);
    try {
      const answer = await previewFilter(t, ws, body, sample);
      if (keyRef.current !== sent) return undefined;
      setChecked((prev) => ({
        key: sent,
        count: answer.count,
        query: answer.query,
        // A count alone keeps the sample already shown for the same tree.
        sample: sample !== undefined ? answer.sample : prev?.key === sent ? prev.sample : null,
      }));
      return answer;
    } catch (e) {
      if (keyRef.current !== sent) return undefined;
      if (e instanceof ApiError && e.code === 'VALIDATION' && e.fields) {
        const split = splitErrors(e.fields, body);
        setRuleErrors(split.byPath);
        setNameError(split.name ?? null);
        setPreviewError(split.other.length > 0 ? split.other.join('; ') : null);
      } else {
        setPreviewError(messageFor(e));
      }
      return undefined;
    } finally {
      setPreviewing(false);
    }
  };

  const onSave = async () => {
    if (checked?.key !== key && !(await runPreview())) return;
    const body = { name: name.trim(), rules: cleanRules(rules) };
    const saved = await save.run(() => (existing ? updateFilter(t, ws, existing.id, body) : createFilter(t, ws, body)));
    if (saved) navigate(SAVED_FILTERS);
  };

  const saveDisabled = name.trim() === '' || blocked || busy;

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        if (!saveDisabled) void onSave();
      }}
    >
      <FormGroup label="Name" isRequired fieldId="filter-name">
        <TextInput
          id="filter-name"
          isRequired
          value={name}
          validated={shownNameError ? 'error' : 'default'}
          onChange={(_e, v) => {
            setName(v);
            setNameError(null);
          }}
        />
        {shownNameError && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{shownNameError}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>
      <Grid hasGutter>
        <GridItem md={8}>
          <Tabs activeKey={tab} onSelect={(_e, k) => setTab(k as 'rules' | 'query')} aria-label="Filter">
            <Tab eventKey="rules" title={<TabTitleText>Rules</TabTitleText>}>
              <div style={GAP}>
                <RuleTreeEditor
                  value={rules}
                  onChange={changeRules}
                  labels={labels}
                  attributes={attributes}
                  errors={ruleErrors}
                />
              </div>
            </Tab>
            <Tab eventKey="query" title={<TabTitleText>Query</TabTitleText>}>
              <div style={GAP}>
                {query ? (
                  <CodeBlock>
                    <CodeBlockCode>{JSON.stringify(query, null, 2)}</CodeBlockCode>
                  </CodeBlock>
                ) : (
                  <Content component="p">Check the count to see the query.</Content>
                )}
              </div>
            </Tab>
          </Tabs>
        </GridItem>
        <GridItem md={4}>
          <Card isCompact>
            <CardBody>
              <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
                <div>
                  <Button variant="secondary" isDisabled={blocked || busy} onClick={() => void runPreview()}>
                    Check count
                  </Button>
                </div>
                {current && <Content component="p">{countText(current.count)}</Content>}
                <div>
                  <Button
                    variant="secondary"
                    isDisabled={blocked || busy}
                    onClick={() => void runPreview(FILTER_SAMPLE_SIZE)}
                  >
                    Show sample
                  </Button>
                </div>
                {current?.sample && <SampleTable sample={current.sample} labels={labels} />}
                {previewError && <Alert variant="danger" isInline title={previewError} />}
              </Flex>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
      {save.error && <Alert variant="danger" isInline title={save.error} />}
      <ActionGroup>
        <Button type="submit" variant="primary" isDisabled={saveDisabled} isLoading={save.busy}>
          Save
        </Button>
        <Button variant="link" onClick={() => navigate(SAVED_FILTERS)}>
          Cancel
        </Button>
      </ActionGroup>
    </Form>
  );
};

const FilterBuilderLoader: React.FunctionComponent = () => {
  const { id } = useParams();
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const filter = useLoad((tk) => (id ? getFilter(tk, ws, id) : Promise.resolve(undefined)), [ws, id]);
  const labels = useLoad((tk) => listLabels(tk, ws), [ws]);
  const attributes = useLoad((tk) => listAttributes(tk, ws), [ws]);

  // A simple filter has no rules to edit: it opens on the Contacts page instead.
  if (id && filter.data && !isAdvanced(filter.data)) {
    return <Navigate to="/contacts" replace state={{ filterId: id }} />;
  }
  const error = filter.error ?? labels.error ?? attributes.error;
  return (
    <PageShell title={id ? 'Edit filter' : 'New filter'}>
      {error ? (
        <Alert variant="danger" isInline title={error} />
      ) : filter.loading || !labels.data || !attributes.data ? (
        <Spinner aria-label="Loading filter" />
      ) : (
        <FilterBuilderForm key={id ?? 'new'} existing={filter.data} labels={labels.data} attributes={attributes.data} />
      )}
    </PageShell>
  );
};

/** Builds a new advanced filter, or edits one, with a live count, sample and compiled query. */
export const FilterBuilderPage: React.FunctionComponent = () => {
  const allowed = useAccess().hasInWorkspace('contact:bulk');
  // Checked before the loader mounts, so nothing is fetched for a user who may not build filters.
  if (!allowed) return <NotFound />;
  return <FilterBuilderLoader />;
};
