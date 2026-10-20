import * as React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
  Label,
  Spinner,
  TextInput,
} from '@patternfly/react-core';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { listAttributes } from '@app/api/contacts';
import {
  MediaView,
  TEMPLATE_TYPES,
  TemplateContent,
  TemplateType,
  TemplateView,
  archiveTemplate,
  createTemplate,
  getCategories,
  getTemplate,
  unarchiveTemplate,
  updateTemplate,
  uploadTemplateMedia,
} from '@app/api/templates';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { CategoryField } from '@app/Templates/CategoryField';
import { ContentForm } from '@app/Templates/ContentForm';
import { PlaceholdersPanel } from '@app/Templates/PlaceholdersPanel';
import type { PlaceholderRef } from '@app/Templates/placeholders';
import { TYPE_META } from '@app/Templates/typeMeta';
import {
  Setting,
  Settings,
  buildRequest,
  derive,
  initialContent,
  isShownKey,
  loadedContent,
  loadedSettings,
  settingFor,
  validate,
} from '@app/Templates/editorModel';

const CONFLICT_COPY = 'This template was changed by someone else. Reload to see the latest version.';

const FieldError: React.FunctionComponent<{ text?: string }> = ({ text }) =>
  text ? (
    <FormHelperText>
      <HelperText>
        <HelperTextItem variant="error">{text}</HelperTextItem>
      </HelperText>
    </FormHelperText>
  ) : null;

const Problem: React.FunctionComponent<{ title: string }> = ({ title }) => (
  <PageShell title="Template">
    <Alert variant="danger" isInline title={title} />
    <Link to="/templates">Back to templates</Link>
  </PageShell>
);

/** The server's message for a failed save, as errors on controls (by key) and anything else as one banner. */
function serverFields(e: ApiError): Record<string, string> | null {
  const code = e.code?.toUpperCase();
  if (code === 'VALIDATION' && e.fields) return e.fields;
  if (code === 'DUPLICATE' && e.field) return { [e.field]: e.serverMessage ?? 'Already in use' };
  return null;
}

interface BodyProps {
  type: TemplateType;
  /** The loaded template; absent when creating. */
  template?: TemplateView;
}

/** The form itself; mounted once per template (or new type), so its state starts from the loaded values. */
const EditorBody: React.FunctionComponent<BodyProps> = ({ type, template }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;
  const navigate = useNavigate();
  const canManage = useAccess().hasInWorkspace('template:manage');
  const readOnly = !canManage;
  const archive = useAction();

  const [saved, setSaved] = React.useState(template);
  const [name, setName] = React.useState(template?.name ?? '');
  const [category, setCategory] = React.useState(template?.category ?? '');
  const [content, setContent] = React.useState<TemplateContent>(() =>
    template ? loadedContent(type, template.content) : initialContent(type),
  );
  const [media, setMedia] = React.useState<MediaView | null>(template?.media ?? null);
  const [settings, setSettings] = React.useState<Settings>(() => loadedSettings(template?.placeholders ?? []));
  const [attempted, setAttempted] = React.useState(false);
  const [serverErrors, setServerErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [conflict, setConflict] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const attributes = useLoad((tk) => (canManage ? listAttributes(tk, ws) : Promise.resolve([])), [ws, canManage]);
  const categories = useLoad((tk) => (canManage ? getCategories(tk, ws) : Promise.resolve([])), [ws, canManage]);

  const { refs, errors: grammar } = React.useMemo(() => derive(type, content), [type, content]);
  const problems = validate(type, name, category, content, media, refs, settings);
  const blocked = Object.keys({ ...problems, ...grammar }).length > 0;
  const shown: Record<string, string> = {
    ...serverErrors,
    ...(attempted ? problems : problems.placeholders ? { placeholders: problems.placeholders } : {}),
    ...grammar,
  };
  const knownNames = React.useMemo(() => {
    const out: Record<string, string> = {};
    (template?.placeholders ?? []).forEach((p) => {
      if (p.attributeName) out[p.name] = p.attributeName;
    });
    return out;
  }, [template]);

  const patchContent = (patch: Partial<TemplateContent>) => setContent((c) => ({ ...c, ...patch }));
  const patchSetting = (ref: PlaceholderRef, patch: Partial<Setting>) =>
    setSettings((all) => ({ ...all, [ref.name]: { ...settingFor(all, ref), ...patch } }));
  const clearServerError = (key: string) =>
    setServerErrors((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== key)));
  const onMedia = (m: MediaView) => {
    setMedia(m);
    if (!m.mimeType.startsWith('audio/ogg')) patchContent(type === 'AUDIO' ? { voiceNote: false } : {});
  };

  const onSave = async () => {
    setAttempted(true);
    setNotice(null);
    setConflict(false);
    setBanner(null);
    setServerErrors({});
    if (blocked) return;
    setBusy(true);
    try {
      const request = buildRequest(type, name, category, content, media, refs, settings, saved?.version);
      if (saved) {
        const result = await updateTemplate(t, ws, saved.id, request);
        setSaved(result);
        setNotice('Saved');
      } else {
        const created = await createTemplate(t, ws, request);
        navigate(`/templates/${created.id}`);
      }
    } catch (e) {
      const fields = e instanceof ApiError ? serverFields(e) : null;
      if (e instanceof ApiError && e.code?.toUpperCase() === 'CONFLICT') {
        setConflict(true);
      } else if (fields) {
        setServerErrors(fields);
        const hidden = Object.keys(fields).filter((k) => !isShownKey(k, type, refs));
        if (hidden.length > 0) setBanner(hidden.map((k) => `${k}: ${fields[k]}`).join('; '));
      } else {
        setBanner(messageFor(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const onArchive = async () => {
    if (!saved) return;
    const result = await archive.run(() =>
      (saved.status === 'ACTIVE' ? archiveTemplate : unarchiveTemplate)(t, ws, saved.id),
    );
    if (result) setSaved({ ...saved, status: result.status, version: result.version, warnings: result.warnings });
  };

  const meta = TYPE_META[type];
  const Icon = meta.icon;
  const title = saved ? saved.name : `New ${meta.label.toLowerCase()} template`;

  return (
    <PageShell
      title={title}
      actions={
        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem>
            <Link to="/templates">Back to templates</Link>
          </FlexItem>
          {canManage && saved && (
            <FlexItem>
              <Button variant="secondary" onClick={onArchive} isDisabled={archive.busy}>
                {saved.status === 'ACTIVE' ? 'Archive' : 'Unarchive'}
              </Button>
            </FlexItem>
          )}
          {canManage && (
            <FlexItem>
              <Button variant="primary" onClick={onSave} isDisabled={busy} isLoading={busy}>
                Save
              </Button>
            </FlexItem>
          )}
        </Flex>
      }
    >
      {conflict && <Alert variant="danger" isInline title={CONFLICT_COPY} />}
      {banner && <Alert variant="danger" isInline title={banner} />}
      {archive.error && <Alert variant="danger" isInline title={archive.error} />}
      {notice && <Alert variant="success" isInline title={notice} />}
      {saved?.warnings.map((w) => <Alert key={w} variant="warning" isInline title={w} />)}
      <Grid hasGutter>
        <GridItem lg={7}>
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              void onSave();
            }}
          >
            <FormGroup label="Name" fieldId="template-name" isRequired>
              <TextInput
                id="template-name"
                value={name}
                isDisabled={readOnly}
                validated={shown.name ? 'error' : 'default'}
                onChange={(_e, v) => {
                  setName(v);
                  clearServerError('name');
                }}
              />
              <FieldError text={shown.name} />
            </FormGroup>
            <FormGroup label="Type" fieldId="template-type">
              <Label icon={<Icon />} id="template-type">
                {meta.label}
              </Label>
            </FormGroup>
            <FormGroup label="Category" fieldId="template-category">
              <CategoryField
                id="template-category"
                value={category}
                options={categories.data ?? []}
                disabled={readOnly}
                invalid={!!shown.category}
                onChange={(v) => {
                  setCategory(v);
                  clearServerError('category');
                }}
              />
              <FieldError text={shown.category} />
            </FormGroup>
            <ContentForm
              type={type}
              content={content}
              onChange={patchContent}
              readOnly={readOnly}
              errors={shown}
              attributes={attributes.data ?? []}
              media={media}
              upload={(file) => uploadTemplateMedia(t, ws, file)}
              onMedia={onMedia}
            />
          </Form>
          <div style={{ marginTop: 16 }}>
            <PlaceholdersPanel
              refs={refs}
              settings={settings}
              onChange={patchSetting}
              readOnly={readOnly}
              errors={shown}
              attributes={attributes.data ?? []}
              knownNames={knownNames}
            />
          </div>
        </GridItem>
        <GridItem lg={5}>
          {/* TASK 4 SLOT: the WhatsApp-style preview replaces this card (it reads the draft state above). */}
          <Card isCompact>
            <CardTitle>Preview</CardTitle>
            <CardBody>The preview appears here.</CardBody>
          </Card>
        </GridItem>
      </Grid>
    </PageShell>
  );
};

/** Loads an existing template, then edits it. */
const ExistingEditor: React.FunctionComponent<{ id: string }> = ({ id }) => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const loaded = useLoad((tk) => getTemplate(tk, ws, id), [ws, id]);
  if (loaded.error) return <Problem title={loaded.error} />;
  if (!loaded.data) {
    return (
      <PageShell title="Template">
        <Spinner aria-label="Loading template" />
      </PageShell>
    );
  }
  return <EditorBody key={loaded.data.id} type={loaded.data.type} template={loaded.data} />;
};

/** `/templates/new?type=…` creates; `/templates/:id` edits (read-only without template:manage). */
export const TemplateEditorPage: React.FunctionComponent = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const canManage = useAccess().hasInWorkspace('template:manage');
  if (id) return <ExistingEditor key={id} id={id} />;
  const type = params.get('type') as TemplateType;
  if (!canManage) return <Problem title="You don't have permission to create templates" />;
  if (!TEMPLATE_TYPES.includes(type)) return <Problem title="Unknown template type" />;
  return <EditorBody key={type} type={type} />;
};
