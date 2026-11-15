import * as React from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Content,
  FormFieldGroup,
  FormFieldGroupHeader,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
} from '@patternfly/react-core';
import type { AiCapabilities, McpAuth, McpConnectBy, McpServer, McpToolInfo } from '@app/api/ai';
import { SecretField } from '@app/AI/SecretField';
import { FieldError } from '@app/AI/ConnectionModal';

/** One MCP server row as the form edits it: the stored view plus the secret being typed. */
export interface McpRow {
  /** Stable key for React; equals the server id once saved. */
  key: string;
  id?: string;
  label: string;
  url: string;
  connectBy: McpConnectBy;
  auth: McpAuth;
  headerName: string;
  secret: string;
  secretHint: string | null;
  secretSetAt: string | null;
  /** The stored auth, url and connect-by: a stored secret is kept only while these stay the same (the server rule). */
  stored?: Pick<McpServer, 'auth' | 'url' | 'connectBy' | 'headerName'>;
  /** Allowed tool names as typed, comma separated; empty allows all. */
  toolsText: string;
}

export const toolsOf = (r: McpRow): string[] =>
  r.toolsText
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '');

export const rowOf = (s: McpServer): McpRow => ({
  key: s.id,
  id: s.id,
  label: s.label,
  url: s.url,
  connectBy: s.connectBy,
  auth: s.auth,
  headerName: s.headerName ?? '',
  secret: '',
  secretHint: s.secretHint,
  secretSetAt: s.secretSetAt,
  stored: { auth: s.auth, url: s.url, connectBy: s.connectBy, headerName: s.headerName },
  toolsText: s.allowedTools.join(', '),
});

let counter = 0;
export const newRow = (connectBy: McpConnectBy): McpRow => ({
  key: `new-${++counter}`,
  label: '',
  url: '',
  connectBy,
  auth: 'NONE',
  headerName: '',
  secret: '',
  secretHint: null,
  secretSetAt: null,
  toolsText: '',
});

/** The stored secret's hint while it still applies (same auth and destination), else null so a new one is asked for. */
function keptHint(r: McpRow): string | null {
  if (!r.secretHint || !r.stored) return null;
  const same =
    r.stored.auth === r.auth &&
    r.stored.url === r.url &&
    r.stored.connectBy === r.connectBy &&
    (r.auth !== 'HEADER' || (r.stored.headerName ?? '') === r.headerName);
  return same ? r.secretHint : null;
}

export const McpServersFields: React.FunctionComponent<{
  rows: McpRow[];
  onChange(rows: McpRow[]): void;
  caps: AiCapabilities | null;
  providerLabel: string;
  /** Errors keyed like the server's (`mcpServers.1.url`), client problems included. */
  errors: Record<string, string>;
  /** Lists a saved APP server's tools; absent for a profile not saved yet. */
  loadTools?: (serverId: string) => Promise<McpToolInfo[]>;
  isDisabled?: boolean;
}> = ({ rows, onChange, caps, providerLabel, errors, loadTools, isDisabled }) => {
  const [tools, setTools] = React.useState<Record<string, McpToolInfo[]>>({});
  const [toolError, setToolError] = React.useState<Record<string, string>>({});
  const hosted = caps?.hostedMcp ?? true;
  const set = (i: number, patch: Partial<McpRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const load = async (r: McpRow) => {
    if (!loadTools || !r.id) return;
    setToolError((t) => ({ ...t, [r.key]: '' }));
    try {
      const list = await loadTools(r.id);
      setTools((t) => ({ ...t, [r.key]: list }));
    } catch (e) {
      setToolError((t) => ({ ...t, [r.key]: e instanceof Error ? e.message : 'The tools could not be loaded.' }));
    }
  };

  return (
    <FormFieldGroup header={<FormFieldGroupHeader titleText={{ text: 'MCP servers', id: 'ai-mcp-title' }} />}>
      <Content component="small">
        Tools run with this server&apos;s own access. Give it only what the bot needs, and list the allowed tools.
      </Content>
      {!hosted && <Content component="small">{providerLabel} cannot connect to MCP servers itself.</Content>}
      {rows.map((r, i) => {
        const n = i + 1;
        const e = (f: string) => errors[`mcpServers.${i}.${f}`];
        const listed = tools[r.key];
        return (
          <FormGroup
            key={r.key}
            role="group"
            aria-label={`Server ${n}`}
            label={`Server ${n}`}
            fieldId={`mcp-${r.key}-label`}
          >
            <div className="omni-form-field__row">
              <TextInput
                id={`mcp-${r.key}-label`}
                aria-label={`Server ${n} label`}
                placeholder="Label, e.g. calendar"
                value={r.label}
                isDisabled={isDisabled}
                validated={e('label') ? 'error' : 'default'}
                onChange={(_ev, v) => set(i, { label: v })}
              />
              <Button
                variant="link"
                isDanger
                aria-label={`Remove server ${n}`}
                isDisabled={isDisabled}
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
            <FieldError error={e('label')} />
            <TextInput
              aria-label={`Server ${n} URL`}
              placeholder="https://…"
              value={r.url}
              isDisabled={isDisabled}
              validated={e('url') ? 'error' : 'default'}
              onChange={(_ev, v) => set(i, { url: v })}
            />
            <FieldError error={e('url')} />
            <FormSelect
              aria-label={`Server ${n} connect by`}
              value={r.connectBy}
              isDisabled={isDisabled}
              validated={e('connectBy') ? 'error' : 'default'}
              onChange={(_ev, v) => set(i, { connectBy: v as McpConnectBy })}
            >
              <FormSelectOption value="APP" label="Our app" />
              <FormSelectOption value="PROVIDER" label="Provider" isDisabled={!hosted} />
            </FormSelect>
            <FieldError error={e('connectBy')} />
            <FormSelect
              aria-label={`Server ${n} auth`}
              value={r.auth}
              isDisabled={isDisabled}
              onChange={(_ev, v) => set(i, { auth: v as McpAuth })}
            >
              <FormSelectOption value="NONE" label="No authentication" />
              <FormSelectOption value="BEARER" label="Bearer token" />
              <FormSelectOption value="HEADER" label="Header" />
            </FormSelect>
            {r.auth === 'HEADER' && (
              <>
                <TextInput
                  aria-label={`Server ${n} header name`}
                  placeholder="Header name, e.g. X-Api-Key"
                  value={r.headerName}
                  isDisabled={isDisabled}
                  validated={e('headerName') ? 'error' : 'default'}
                  onChange={(_ev, v) => set(i, { headerName: v })}
                />
                <FieldError error={e('headerName')} />
              </>
            )}
            {r.auth !== 'NONE' && (
              <SecretField
                id={`mcp-${r.key}-secret`}
                label={`Server ${n} secret`}
                hint={keptHint(r)}
                setAt={keptHint(r) ? r.secretSetAt : null}
                value={r.secret}
                onChange={(v) => set(i, { secret: v })}
                isDisabled={isDisabled}
                error={e('secret')}
                replaceLabel="Replace secret"
              />
            )}
            {r.connectBy === 'APP' && r.id && loadTools && !isDisabled && (
              <Button variant="secondary" size="sm" aria-label={`Load tools for server ${n}`} onClick={() => load(r)}>
                Load tools
              </Button>
            )}
            {toolError[r.key] && <Alert variant="danger" isInline isPlain title={toolError[r.key]} />}
            {listed && (
              <div role="group" aria-label={`Server ${n} allowed tools`}>
                {listed.map((t) => (
                  <Checkbox
                    key={t.name}
                    id={`mcp-${r.key}-tool-${t.name}`}
                    label={t.name}
                    description={t.description ?? undefined}
                    isChecked={toolsOf(r).includes(t.name)}
                    isDisabled={isDisabled}
                    onChange={(_ev, on) => {
                      const now = toolsOf(r).filter((x) => x !== t.name);
                      set(i, { toolsText: (on ? [...now, t.name] : now).join(', ') });
                    }}
                  />
                ))}
              </div>
            )}
            {!listed && (
              <TextInput
                aria-label={`Server ${n} allowed tools (comma separated)`}
                placeholder="Allowed tools, comma separated (empty: all)"
                value={r.toolsText}
                isDisabled={isDisabled}
                onChange={(_ev, v) => set(i, { toolsText: v })}
              />
            )}
            <FieldError error={e('allowedTools')} />
          </FormGroup>
        );
      })}
      <Button variant="link" isInline isDisabled={isDisabled} onClick={() => onChange([...rows, newRow('APP')])}>
        Add MCP server
      </Button>
    </FormFieldGroup>
  );
};
