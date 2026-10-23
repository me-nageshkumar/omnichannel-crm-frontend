import * as React from 'react';
import {
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  Tab,
  TabTitleText,
  Tabs,
  Title,
} from '@patternfly/react-core';

export interface DrawerTab {
  key: string;
  title: string;
  content: React.ReactNode;
}

/**
 * A record's side panel over the page ({@code children}): title, optional subtitle and action buttons, and tabs.
 * Full width on narrow screens. While {@code isOpen} is false only the page shows.
 */
export const RecordDrawer: React.FunctionComponent<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  tabs: DrawerTab[];
  onClose(): void;
  isOpen?: boolean;
  children?: React.ReactNode;
}> = ({ title, subtitle, actions, tabs, onClose, isOpen = true, children }) => {
  const [active, setActive] = React.useState<string>(tabs[0]?.key ?? '');
  const current = tabs.some((t) => t.key === active) ? active : (tabs[0]?.key ?? '');
  const panel = (
    <DrawerPanelContent widths={{ default: 'width_100', lg: 'width_50', '2xl': 'width_33' }}>
      <DrawerHead>
        <div>
          <Title headingLevel="h2" size="xl">
            {title}
          </Title>
          {subtitle && <div>{subtitle}</div>}
        </div>
        <DrawerActions>
          <DrawerCloseButton onClick={onClose} aria-label="Close" />
        </DrawerActions>
      </DrawerHead>
      {actions && <DrawerPanelBody>{actions}</DrawerPanelBody>}
      <DrawerPanelBody>
        <Tabs activeKey={current} onSelect={(_e, key) => setActive(String(key))} mountOnEnter unmountOnExit>
          {tabs.map((t) => (
            <Tab key={t.key} eventKey={t.key} title={<TabTitleText>{t.title}</TabTitleText>}>
              <div className="pf-v6-u-pt-md">{t.content}</div>
            </Tab>
          ))}
        </Tabs>
      </DrawerPanelBody>
    </DrawerPanelContent>
  );
  return (
    <Drawer isExpanded={isOpen} isInline>
      <DrawerContent panelContent={isOpen ? panel : undefined}>
        <DrawerContentBody>{children}</DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );
};

