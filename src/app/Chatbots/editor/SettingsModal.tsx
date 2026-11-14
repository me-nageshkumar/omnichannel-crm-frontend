import * as React from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core';
import type { InheritedSource, SettingField, SettingsLayer } from '@app/api/chatbots';
import { LayeredSettingsForm } from '@app/Chatbots/settings/LayeredSettingsForm';
import { LayerDraft, fromDraft, layerProblems, toDraft } from '@app/Chatbots/settings/settingsLayers';

/**
 * The chatbot's own settings layer (spec 2026-11-14 §8): empty fields follow the brand's settings, or the platform
 * defaults where the brand sets nothing.
 */
export const SettingsModal: React.FunctionComponent<{
  settings: SettingsLayer;
  inherited: SettingsLayer;
  sources: Partial<Record<SettingField, InheritedSource>>;
  readOnly: boolean;
  onSave(settings: SettingsLayer): void;
  onClose(): void;
}> = ({ settings, inherited, sources, readOnly, onSave, onClose }) => {
  const [d, setD] = React.useState<LayerDraft>(() => toDraft(settings));
  const problems = layerProblems(d, false);
  const ok = Object.keys(problems).length === 0;
  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="chatbot-settings-title">
      <ModalHeader
        title="Chatbot settings"
        labelId="chatbot-settings-title"
        description="Empty fields follow the brand's chatbot settings."
      />
      <ModalBody>
        <LayeredSettingsForm
          value={d}
          onChange={setD}
          inherited={inherited}
          sources={sources}
          readOnly={readOnly}
          errors={problems}
        />
      </ModalBody>
      <ModalFooter>
        {!readOnly && (
          <Button variant="primary" isDisabled={!ok} onClick={() => onSave(fromDraft(d))}>
            Save
          </Button>
        )}
        <Button variant="link" onClick={onClose}>
          {readOnly ? 'Close' : 'Cancel'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
