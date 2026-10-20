import * as React from 'react';
import { Button, Popover, Stack, StackItem, Title, ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';
import { DesktopIcon, MoonIcon, SunIcon } from '@patternfly/react-icons';
import { Brand, ColorScheme, Contrast } from '@app/theme/themeStore';
import { useTheme } from '@app/theme/ThemeContext';

interface Group<T extends string> {
  label: string;
  options: Array<{ value: T; text: string }>;
}

const BRAND: Group<Brand> = {
  label: 'Theme',
  options: [
    { value: 'default', text: 'Default' },
    { value: 'felt', text: 'Project Felt' },
  ],
};
const SCHEME: Group<ColorScheme> = {
  label: 'Color scheme',
  options: [
    { value: 'system', text: 'System' },
    { value: 'light', text: 'Light' },
    { value: 'dark', text: 'Dark' },
  ],
};
const CONTRAST: Group<Contrast> = {
  label: 'Contrast',
  options: [
    { value: 'system', text: 'System' },
    { value: 'default', text: 'Default' },
    { value: 'high-contrast', text: 'High contrast' },
    { value: 'glass', text: 'Glass' },
  ],
};

function Choices<T extends string>({ group, value, onChange }: { group: Group<T>; value: T; onChange(v: T): void }) {
  const id = `theme-${group.label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <Stack hasGutter>
      <Title headingLevel="h3" size="md" id={id}>
        {group.label}
      </Title>
      <ToggleGroup aria-labelledby={id} role="group">
        {group.options.map((o) => (
          <ToggleGroupItem
            key={o.value}
            text={o.text}
            buttonId={`${id}-${o.value}`}
            isSelected={value === o.value}
            onChange={() => onChange(o.value)}
          />
        ))}
      </ToggleGroup>
    </Stack>
  );
}

const ICON: Record<ColorScheme, React.ReactNode> = {
  system: <DesktopIcon />,
  light: <SunIcon />,
  dark: <MoonIcon />,
};

/** Theme, color scheme and contrast, as on patternfly.org; for the masthead and the sign-in screens. */
export const ThemeSwitcher: React.FunctionComponent = () => {
  const { prefs, choose } = useTheme();
  return (
    <Popover
      aria-label="Theme settings"
      position="bottom-end"
      hasAutoWidth
      showClose={false}
      bodyContent={
        <Stack hasGutter>
          <StackItem>
            <Choices group={BRAND} value={prefs.brand} onChange={(brand) => choose({ brand })} />
          </StackItem>
          <StackItem>
            <Choices group={SCHEME} value={prefs.scheme} onChange={(scheme) => choose({ scheme })} />
          </StackItem>
          <StackItem>
            <Choices group={CONTRAST} value={prefs.contrast} onChange={(contrast) => choose({ contrast })} />
          </StackItem>
        </Stack>
      }
    >
      <Button variant="plain" aria-label="Theme settings" icon={ICON[prefs.scheme]} />
    </Popover>
  );
};
