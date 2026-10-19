import * as React from 'react';
import {
  ActionGroup,
  Alert,
  Bullseye,
  Button,
  ClipboardCopy,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  ExpandableSection,
  Form,
  List,
  ListItem,
  Spinner,
  clipboardCopyFunc,
} from '@patternfly/react-core';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { TwoFactorSetup, confirmTwoFactor, initiateTwoFactor } from '@app/api/users';
import { useSession } from '@app/session/SessionContext';
import { CodeField } from '@app/Profile/CodeField';

const APPS = [
  {
    name: 'Google Authenticator',
    appStore: 'https://apps.apple.com/app/google-authenticator/id388497605',
    googlePlay: 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2',
  },
  {
    name: 'Microsoft Authenticator',
    appStore: 'https://apps.apple.com/app/microsoft-authenticator/id983156458',
    googlePlay: 'https://play.google.com/store/apps/details?id=com.azure.authenticator',
  },
];

const StoreLink: React.FunctionComponent<{ href: string; children: string }> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

/** "ABCDEFGH..." as "ABCD EFGH ..." so it is easier to type into an app. */
export const groupInFours = (secret: string) => secret.replace(/(.{4})(?=.)/g, '$1 ');

/** Guided authenticator setup: install an app, scan the code, confirm with a code. */
export const EnableTwoFactorPanel: React.FunctionComponent<{ onDone(): void; onCancel(): void }> = ({
  onDone,
  onCancel,
}) => {
  const { token, refreshUser } = useSession();
  const [setup, setSetup] = React.useState<TwoFactorSetup | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [keyShown, setKeyShown] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    initiateTwoFactor(token)
      .then((s) => !cancelled && setSetup(s))
      .catch(async (e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.code === 'TWO_FACTOR_STATE') {
          await refreshUser().catch(() => undefined);
          onCancel();
          return;
        }
        setLoadError(messageFor(e));
      });
    return () => {
      cancelled = true;
    };
    // initiate once per opening of the panel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !setup) return;
    setError(null);
    setBusy(true);
    try {
      await confirmTwoFactor(token, setup.secret, code.trim());
      await refreshUser();
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'TWO_FACTOR_STATE') {
        await refreshUser().catch(() => undefined);
        onCancel();
        return;
      }
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return <Alert variant="danger" isInline title={loadError} />;
  }
  if (!setup) {
    return (
      <Bullseye>
        <Spinner size="lg" aria-label="Preparing two-factor setup" />
      </Bullseye>
    );
  }

  return (
    <List component="ol">
      <ListItem>
        <Content component="h3">Install an authenticator app</Content>
        <Content component="p">Install one of these free apps on your phone:</Content>
        <List>
          {APPS.map((app) => (
            <ListItem key={app.name}>
              {app.name} — <StoreLink href={app.appStore}>App Store</StoreLink> ·{' '}
              <StoreLink href={app.googlePlay}>Google Play</StoreLink>
            </ListItem>
          ))}
        </List>
      </ListItem>
      <ListItem>
        <Content component="h3">Add your account</Content>
        <Content component="p">Open the app, tap +, choose Scan a QR code, and scan this code.</Content>
        <img alt="QR code for two-factor setup" src={setup.qrCodeDataUri} width={200} height={200} />
        <ExpandableSection
          toggleText="Can't scan the code?"
          isExpanded={keyShown}
          onToggle={(_e, expanded) => setKeyShown(expanded)}
        >
          <Content component="p">Choose Enter a setup key, select Time based, and enter:</Content>
          <DescriptionList isCompact isHorizontal>
            <DescriptionListGroup>
              <DescriptionListTerm>Account</DescriptionListTerm>
              <DescriptionListDescription>{setup.username}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Issuer</DescriptionListTerm>
              <DescriptionListDescription>{setup.issuer}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Key</DescriptionListTerm>
              <DescriptionListDescription>
                <ClipboardCopy isReadOnly hoverTip="Copy" clickTip="Copied" onCopy={(e) => clipboardCopyFunc(e, setup.secret)}>
                  {groupInFours(setup.secret)}
                </ClipboardCopy>
              </DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        </ExpandableSection>
      </ListItem>
      <ListItem>
        <Content component="h3">Enter the 6-digit code</Content>
        <Form onSubmit={onSubmit}>
          <CodeField id="enable-otp" value={code} onChange={setCode} error={error} />
          <ActionGroup>
            <Button type="submit" isDisabled={busy || code.trim().length === 0}>
              Turn on
            </Button>
            <Button variant="link" onClick={onCancel}>
              Cancel
            </Button>
          </ActionGroup>
        </Form>
      </ListItem>
    </List>
  );
};
