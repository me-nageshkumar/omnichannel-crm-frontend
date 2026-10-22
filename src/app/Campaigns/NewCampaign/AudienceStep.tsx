import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  FileUpload,
  Flex,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Radio,
  Spinner,
  TextInput,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { previewCsv } from '@app/api/campaigns';
import { countContacts, listFilters } from '@app/api/contacts';
import { messageFor } from '@app/api/messages';
import { useLoad } from '@app/admin/useLoad';
import { countText } from '@app/Contacts/filterSpec';
import type { Draft, StepProps } from '@app/Campaigns/NewCampaign/draft';
import { SampleCsvLinks } from '@app/Campaigns/NewCampaign/SampleCsvLinks';
import { useSession } from '@app/session/SessionContext';

const CSV_NOTE =
  'Rows need a phone column; other columns can fill template placeholders. 10-digit numbers get the default country code.';

const SAMPLE_ROWS = 5;
const NO_FILE: Partial<Draft> = { file: null, preview: null, phoneColumn: null, nameColumn: null, reading: false };

/** The live size of the chosen saved filter. */
const FilterCount: React.FunctionComponent<{ filterId: string }> = ({ filterId }) => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const count = useLoad((tk) => countContacts(tk, ws, { filterId }), [ws, filterId]);
  if (count.error) return <HelperTextItem variant="error">{count.error}</HelperTextItem>;
  if (!count.data) return <Spinner size="sm" aria-label="Counting contacts" />;
  return <HelperTextItem>{countText(count.data.count)}</HelperTextItem>;
};

const FilterAudience: React.FunctionComponent<StepProps> = ({ draft, update }) => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const filters = useLoad((tk) => listFilters(tk, ws), [ws]);

  return (
    <FormGroup label="Saved contact filter" fieldId="audience-filter">
      {filters.error && <Alert variant="danger" isInline isPlain title={filters.error} />}
      <FormSelect
        id="audience-filter"
        value={draft.filterId}
        onChange={(_e, v) => update({ filterId: v, filterName: filters.data?.find((f) => f.id === v)?.name ?? '' })}
      >
        <FormSelectOption value="" label="Choose a filter" isPlaceholder />
        {(filters.data ?? []).map((f) => (
          <FormSelectOption key={f.id} value={f.id} label={f.name} />
        ))}
      </FormSelect>
      <FormHelperText>
        <Flex gap={{ default: 'gapMd' }} alignItems={{ default: 'alignItemsCenter' }}>
          {draft.filterId && (
            <HelperText>
              <FilterCount filterId={draft.filterId} />
            </HelperText>
          )}
          <Link to="/contacts">Manage filters</Link>
        </Flex>
      </FormHelperText>
    </FormGroup>
  );
};

const CsvAudience: React.FunctionComponent<StepProps> = ({ draft, update }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  // Bumped after a failed preview to reset the browser's file input, so the same file can be chosen again.
  const [inputKey, setInputKey] = React.useState(0);
  // The file last chosen here, to ignore FileUpload reporting one choice twice.
  const latest = React.useRef<File | null>(null);

  const choose = (file: File) => {
    // FileUpload reports one choice twice (the input change and the dropzone drop).
    if (file === latest.current) return;
    latest.current = file;
    // The draft holds the new file at once, so nothing reads the old one's columns while this one is read.
    update({ ...NO_FILE, file, reading: true, previewError: null });
    // Only the draft's current file takes the answer; one chosen earlier, or cleared since, is ignored.
    const ifCurrent = (patch: Partial<Draft>) => update((d) => (d.file === file ? patch : null));
    previewCsv(token as string, ws, file).then(
      (p) =>
        ifCurrent({
          reading: false,
          preview: p,
          phoneColumn: p.suggested.phone,
          nameColumn: p.headers.find((h) => h.trim().toLowerCase() === 'name') ?? null,
        }),
      (e) => {
        ifCurrent({ ...NO_FILE, previewError: messageFor(e) });
        setInputKey((k) => k + 1);
      },
    );
  };

  const clear = () => {
    latest.current = null;
    update({ ...NO_FILE, previewError: null });
  };

  const p = draft.preview;
  return (
    <>
      <FormGroup label="File" fieldId="audience-csv">
        <FileUpload
          key={inputKey}
          id="audience-csv"
          filename={draft.file?.name ?? ''}
          browseButtonText="Choose file"
          hideDefaultPreview
          onFileInputChange={(_e, f) => choose(f)}
          onClearClick={clear}
          dropzoneProps={{ accept: { 'text/csv': ['.csv'] } }}
        />
        <FormHelperText>
          <HelperText>
            {draft.previewError && <HelperTextItem variant="error">{draft.previewError}</HelperTextItem>}
            <HelperTextItem>{CSV_NOTE}</HelperTextItem>
          </HelperText>
        </FormHelperText>
        {draft.reading && <Spinner size="md" aria-label="Reading the file" />}
        {!draft.file && <SampleCsvLinks templates={draft.templates} />}
      </FormGroup>
      {p && (
        <>
          <div>
            <p>{`${p.rows.toLocaleString('en-US')} rows`}</p>
            <p>{`Columns: ${p.headers.join(', ')}`}</p>
          </div>
          {p.sample.length > 0 && (
            <Table aria-label="First rows of the file" variant="compact">
              <Thead>
                <Tr>
                  {p.headers.map((h) => (
                    <Th key={h}>{h}</Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {p.sample.slice(0, SAMPLE_ROWS).map((row, i) => (
                  <Tr key={i}>
                    {p.headers.map((h, j) => (
                      <Td key={h} dataLabel={h}>
                        {row[j] ?? ''}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
          <FormGroup label="Phone column" isRequired fieldId="audience-phone-column">
            <FormSelect
              id="audience-phone-column"
              value={draft.phoneColumn ?? ''}
              onChange={(_e, v) => update({ phoneColumn: v || null })}
            >
              <FormSelectOption value="" label="Choose a column" isPlaceholder />
              {p.headers.map((h) => (
                <FormSelectOption key={h} value={h} label={h} />
              ))}
            </FormSelect>
          </FormGroup>
          <FormGroup label="Name column" fieldId="audience-name-column">
            <FormSelect
              id="audience-name-column"
              value={draft.nameColumn ?? ''}
              onChange={(_e, v) => update({ nameColumn: v || null })}
            >
              <FormSelectOption value="" label="None" />
              {p.headers.map((h) => (
                <FormSelectOption key={h} value={h} label={h} />
              ))}
            </FormSelect>
          </FormGroup>
        </>
      )}
    </>
  );
};

/** Name the campaign and choose who receives it: a saved contact filter or an uploaded CSV. */
export const AudienceStep: React.FunctionComponent<StepProps> = ({ draft, update }) => (
  <Form onSubmit={(e) => e.preventDefault()}>
    <FormGroup label="Name" isRequired fieldId="campaign-name">
      <TextInput id="campaign-name" isRequired value={draft.name} onChange={(_e, name) => update({ name })} />
    </FormGroup>
    <FormGroup label="Audience" role="radiogroup" isInline fieldId="audience-kind">
      <Radio
        id="audience-kind-filter"
        name="audience-kind"
        label="Saved contact filter"
        isChecked={draft.kind === 'FILTER'}
        onChange={() => update({ kind: 'FILTER' })}
      />
      <Radio
        id="audience-kind-csv"
        name="audience-kind"
        label="CSV file"
        isChecked={draft.kind === 'CSV'}
        onChange={() => update({ kind: 'CSV' })}
      />
    </FormGroup>
    {draft.kind === 'FILTER' ? (
      <FilterAudience draft={draft} update={update} />
    ) : (
      <CsvAudience draft={draft} update={update} />
    )}
  </Form>
);
