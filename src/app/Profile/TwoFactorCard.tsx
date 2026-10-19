import * as React from 'react';
import { Alert, Button, Card, CardBody, CardFooter, CardTitle, Content, Flex, Label } from '@patternfly/react-core';
import { useSession } from '@app/session/SessionContext';
import { EnableTwoFactorPanel } from '@app/Profile/EnableTwoFactorPanel';
import { DisableTwoFactorModal } from '@app/Profile/DisableTwoFactorModal';

export const TwoFactorCard: React.FunctionComponent = () => {
  const { user } = useSession();
  const [enabling, setEnabling] = React.useState(false);
  const [disabling, setDisabling] = React.useState(false);
  const [success, setSuccess] = React.useState<string | null>(null);
  if (!user) return null;
  const on = user.twoFactorEnabled;

  return (
    <Card component="section" aria-labelledby="two-factor-title">
      <CardTitle id="two-factor-title">
        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
          <span>Two-factor authentication</span>
          <Label color={on ? 'green' : 'grey'}>{on ? 'On' : 'Off'}</Label>
        </Flex>
      </CardTitle>
      <CardBody>
        {success && (
          <Alert
            variant="success"
            isInline
            title={success}
            style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}
          />
        )}
        {!on && !enabling && (
          <Content component="p">Protect your account with a 6-digit code from an authenticator app on your phone.</Content>
        )}
        {on && <Content component="p">You are asked for a code from your authenticator app each time you log in.</Content>}
        {!on && enabling && (
          <EnableTwoFactorPanel
            onDone={() => {
              setEnabling(false);
              setSuccess('Two-factor authentication is on.');
            }}
            onCancel={() => setEnabling(false)}
          />
        )}
      </CardBody>
      {!enabling && (
        <CardFooter>
          {on ? (
            <Button variant="secondary" isDanger onClick={() => setDisabling(true)}>
              Disable two-factor
            </Button>
          ) : (
            <Button
              onClick={() => {
                setSuccess(null);
                setEnabling(true);
              }}
            >
              Enable two-factor
            </Button>
          )}
        </CardFooter>
      )}
      {disabling && (
        <DisableTwoFactorModal
          onDone={() => {
            setDisabling(false);
            setSuccess('Two-factor authentication is off.');
          }}
          onClose={() => setDisabling(false)}
        />
      )}
    </Card>
  );
};
