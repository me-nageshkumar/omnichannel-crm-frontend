import * as React from 'react';
import { Spinner } from '@patternfly/react-core';
import { AddressCardIcon, FileIcon, MapMarkerAltIcon, MicrophoneIcon } from '@patternfly/react-icons';
import { apiFetchBlob } from '@app/api/client';
import { MediaView, TemplateContent, TemplateType, templateMediaUrl } from '@app/api/templates';
import { useSession } from '@app/session/SessionContext';
import { formatSize } from '@app/Templates/MediaField';
import { formatWhatsApp } from '@app/Templates/placeholders';

/** A file's name and size, for documents and audio, and for media that is loading or cannot be shown. */
const FileCard: React.FunctionComponent<{ media: MediaView; audio?: boolean; note?: string }> = ({
  media,
  audio,
  note,
}) => (
  <div className="omni-wa-card">
    {audio ? <MicrophoneIcon /> : <FileIcon />}
    <div>
      <div className="omni-wa-card__title">{media.fileName}</div>
      <div className="omni-wa-muted">{note ?? formatSize(media.size)}</div>
    </div>
  </div>
);

/** An image or video fetched with the auth header; the object URL is revoked when it goes away. */
const Thumbnail: React.FunctionComponent<{ type: TemplateType; media: MediaView }> = ({ type, media }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [src, setSrc] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!token) return undefined;
    let live = true;
    let url: string | null = null;
    setSrc(null);
    setFailed(false);
    apiFetchBlob(templateMediaUrl(ws, media.mediaId), token).then(
      (blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [token, ws, media.mediaId]);

  if (failed) return <FileCard media={media} note="Preview unavailable" />;
  if (!src) {
    return (
      <div className="omni-wa-card">
        <Spinner size="md" aria-label="Loading media" />
      </div>
    );
  }
  return type === 'VIDEO' ? (
    <video className="omni-wa-media" src={src} controls aria-label={media.fileName} />
  ) : (
    <img className="omni-wa-media" src={src} alt={media.fileName} />
  );
};

const Text: React.FunctionComponent<{ text: string | null; plain?: boolean }> = ({ text, plain }) =>
  text ? (
    <div className="omni-wa-text" style={{ whiteSpace: 'pre-wrap' }}>
      {plain ? text : formatWhatsApp(text)}
    </div>
  ) : null;

const NoFile: React.FunctionComponent = () => <div className="omni-wa-card omni-wa-muted">No file uploaded yet</div>;

/**
 * An outgoing WhatsApp message. {@code content} is already filled (placeholders replaced); the text is
 * built from React elements only, so nothing in it can run.
 */
export const TemplateBubble: React.FunctionComponent<{
  label: string;
  type: TemplateType;
  content: TemplateContent;
  media: MediaView | null;
}> = ({ label, type, content, media }) => {
  let inner: React.ReactNode;
  switch (type) {
    case 'TEXT':
      inner = <Text text={content.body} />;
      break;
    case 'IMAGE':
    case 'VIDEO':
      inner = (
        <>
          {media ? <Thumbnail type={type} media={media} /> : <NoFile />}
          <Text text={content.caption} />
        </>
      );
      break;
    case 'DOCUMENT':
      inner = (
        <>
          {media ? <FileCard media={media} /> : <NoFile />}
          <Text text={content.caption} />
        </>
      );
      break;
    case 'AUDIO':
      inner = media ? (
        <FileCard media={media} audio note={`${content.voiceNote ? 'Voice note · ' : ''}${formatSize(media.size)}`} />
      ) : (
        <NoFile />
      );
      break;
    case 'LOCATION':
      inner = (
        <div className="omni-wa-card">
          <MapMarkerAltIcon />
          <div>
            {content.name && <div className="omni-wa-card__title">{content.name}</div>}
            {content.address && <div>{content.address}</div>}
            {content.latitude !== null && content.longitude !== null && (
              <div className="omni-wa-muted">
                {content.latitude}, {content.longitude}
              </div>
            )}
          </div>
        </div>
      );
      break;
    case 'CONTACT_CARD':
      inner = (
        <div className="omni-wa-card">
          <AddressCardIcon />
          <div>
            <div className="omni-wa-card__title">{content.fullName}</div>
            {content.organization && <div>{content.organization}</div>}
            {content.phone && <div className="omni-wa-muted">+{content.phone}</div>}
            {content.email && <div className="omni-wa-muted">{content.email}</div>}
          </div>
        </div>
      );
      break;
    default: {
      const multiple = !!content.allowMultiple;
      inner = (
        <>
          <Text text={content.question} plain />
          <div className="omni-wa-muted">{multiple ? 'Select one or more' : 'Select one'}</div>
          {(content.options ?? [])
            .filter((o) => o.trim())
            .map((o, i) => (
              <label className="omni-wa-option" key={i}>
                <input type={multiple ? 'checkbox' : 'radio'} disabled name={`${label}-poll`} /> {o}
              </label>
            ))}
        </>
      );
    }
  }
  return (
    <div className="omni-wa-canvas">
      <div className="omni-wa-bubble" role="region" aria-label={label}>
        {inner}
      </div>
    </div>
  );
};
