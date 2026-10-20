import * as React from 'react';
import { Dropdown, DropdownItem, DropdownList, MenuToggle } from '@patternfly/react-core';
import { DesktopIcon, MoonIcon, SunIcon } from '@patternfly/react-icons';
import { ThemeChoice } from '@app/theme/themeStore';
import { useTheme } from '@app/theme/ThemeContext';

const OPTIONS: { choice: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  { choice: 'light', label: 'Light', icon: <SunIcon /> },
  { choice: 'dark', label: 'Dark', icon: <MoonIcon /> },
  { choice: 'system', label: 'Match my computer', icon: <DesktopIcon /> },
];

/** Light / Dark / Match my computer, for the masthead and the sign-in screens. */
export const ThemeSwitcher: React.FunctionComponent = () => {
  const { choice, choose } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);
  const current = OPTIONS.find((o) => o.choice === choice) ?? OPTIONS[2];
  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onSelect={() => setIsOpen(false)}
      popperProps={{ position: 'right' }}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          variant="plain"
          icon={current.icon}
          aria-label={`Theme: ${current.label}`}
          isExpanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
        />
      )}
    >
      <DropdownList>
        {OPTIONS.map((o) => (
          <DropdownItem key={o.choice} icon={o.icon} isSelected={o.choice === choice} onClick={() => choose(o.choice)}>
            {o.label}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};
