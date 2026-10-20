import * as React from 'react';
import { Button, Card, CardBody, CardTitle, Tooltip } from '@patternfly/react-core';
import type { MediaView, TemplateContent, TemplateType } from '@app/api/templates';
import { useAccess } from '@app/session/useAccess';
import { Settings, fillContent, previewValues } from '@app/Templates/editorModel';
import type { PlaceholderRef } from '@app/Templates/placeholders';
import { PreviewWithContactModal } from '@app/Templates/PreviewWithContactModal';
import { TemplateBubble } from '@app/Templates/TemplateBubble';

const SAVE_FIRST = 'Save first to preview with a contact';

/**
 * The right column of the editor: the draft as a WhatsApp message, with examples and fallbacks standing in
 * for the placeholders, and a way to render the saved template for a real contact.
 */
export const TemplatePreview: React.FunctionComponent<{
  type: TemplateType;
  content: TemplateContent;
  media: MediaView | null;
  refs: PlaceholderRef[];
  settings: Settings;
  /** The saved template's id; absent while creating. */
  templateId?: string;
  /** The draft differs from the saved template. */
  dirty: boolean;
}> = ({ type, content, media, refs, settings, templateId, dirty }) => {
  const canContacts = useAccess().hasInWorkspace('contact:view');
  const [open, setOpen] = React.useState(false);
  const filled = React.useMemo(
    () => fillContent(type, content, previewValues(refs, settings)),
    [type, content, refs, settings],
  );
  const enabled = !!templateId && !dirty;

  return (
    <Card isCompact>
      <CardTitle>Preview</CardTitle>
      <CardBody>
        <TemplateBubble label="Message preview" type={type} content={filled} media={media} />
        {canContacts && (
          <div style={{ marginTop: 16 }}>
            <Tooltip content={SAVE_FIRST} trigger={enabled ? 'manual' : 'mouseenter focus'}>
              <Button
                variant="secondary"
                isAriaDisabled={!enabled}
                onClick={() => {
                  if (enabled) setOpen(true);
                }}
              >
                Preview with a contact
              </Button>
            </Tooltip>
          </div>
        )}
        {open && templateId && (
          <PreviewWithContactModal
            templateId={templateId}
            refs={refs}
            settings={settings}
            onClose={() => setOpen(false)}
          />
        )}
      </CardBody>
    </Card>
  );
};
