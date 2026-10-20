import * as React from 'react';
import {
  AddressCardIcon,
  AlignLeftIcon,
  FileIcon,
  ImageIcon,
  MapMarkerAltIcon,
  MicrophoneIcon,
  PollIcon,
  VideoIcon,
} from '@patternfly/react-icons';
import type { TemplateType } from '@app/api/templates';

export interface TypeMeta {
  label: string;
  icon: React.ComponentType;
}

/** How each template type is named and drawn. */
export const TYPE_META: Record<TemplateType, TypeMeta> = {
  TEXT: { label: 'Text', icon: AlignLeftIcon },
  IMAGE: { label: 'Image', icon: ImageIcon },
  VIDEO: { label: 'Video', icon: VideoIcon },
  DOCUMENT: { label: 'Document', icon: FileIcon },
  AUDIO: { label: 'Audio', icon: MicrophoneIcon },
  LOCATION: { label: 'Location', icon: MapMarkerAltIcon },
  CONTACT_CARD: { label: 'Contact card', icon: AddressCardIcon },
  POLL: { label: 'Poll', icon: PollIcon },
};
