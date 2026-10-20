import * as React from 'react';
import { Alert, Button, FileUpload, FormHelperText, HelperText, HelperTextItem } from '@patternfly/react-core';
import type { MediaView, TemplateType } from '@app/api/templates';
import { MAX_MEDIA_BYTES } from '@app/Templates/editorModel';
import { messageFor } from '@app/api/messages';

const ACCEPT: Partial<Record<TemplateType, Record<string, string[]>>> = {
  IMAGE: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
  VIDEO: { 'video/mp4': ['.mp4'], 'video/3gpp': ['.3gp'] },
  DOCUMENT: {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'application/zip': ['.zip'],
  },
  AUDIO: {
    'audio/mpeg': ['.mp3'],
    'audio/mp4': ['.m4a'],
    'audio/aac': ['.aac'],
    'audio/ogg': ['.ogg', '.opus'],
  },
};

const NOUN: Partial<Record<TemplateType, string>> = {
  IMAGE: 'a JPEG or PNG image',
  VIDEO: 'an MP4 or 3GPP video',
  DOCUMENT: 'a PDF, Office, text, CSV or ZIP file',
  AUDIO: 'an MP3, M4A/AAC or OGG audio file',
};

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The upload drop zone for a media template, and the current file with a Replace button. The type is
 * only a first check (the browser's); the server decides from the file's bytes.
 */
export const MediaField: React.FunctionComponent<{
  type: TemplateType;
  media: MediaView | null;
  /** Hides Upload and Replace. */
  readOnly: boolean;
  upload(file: File): Promise<MediaView>;
  onUploaded(media: MediaView): void;
  /** A server error on `mediaId`, or the client's "Upload a file". */
  error?: string;
}> = ({ type, media, readOnly, upload, onUploaded, error }) => {
  const [replacing, setReplacing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  const accepted = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setProblem(null);
    setBusy(true);
    try {
      onUploaded(await upload(file));
      setReplacing(false);
    } catch (e) {
      setProblem(messageFor(e));
    } finally {
      setBusy(false);
    }
  };
  const rejected = (rejections: ReadonlyArray<{ errors: ReadonlyArray<{ code: string }> }>) => {
    const tooBig = rejections.some((r) => r.errors.some((e) => e.code === 'file-too-large'));
    setProblem(tooBig ? 'That file is larger than 16 MB.' : `Choose ${NOUN[type] ?? 'a supported file'}.`);
  };

  const showDropZone = !readOnly && (!media || replacing);
  return (
    <div>
      {media && (
        <div>
          <strong>{media.fileName}</strong> · {formatSize(media.size)}
          {!readOnly && !replacing && (
            <Button variant="link" onClick={() => setReplacing(true)}>
              Replace
            </Button>
          )}
        </div>
      )}
      {showDropZone && (
        <FileUpload
          id={`media-${type}`}
          filename=""
          filenamePlaceholder={`Drag ${NOUN[type] ?? 'a file'} here, or browse`}
          browseButtonText="Browse"
          hideDefaultPreview
          isLoading={busy}
          onClearClick={() => setReplacing(false)}
          dropzoneProps={{
            accept: ACCEPT[type],
            maxSize: MAX_MEDIA_BYTES,
            onDropAccepted: (files) => void accepted(files),
            onDropRejected: rejected,
          }}
        />
      )}
      {problem && <Alert variant="danger" isInline isPlain title={problem} />}
      {error && !problem && (
        <FormHelperText>
          <HelperText>
            <HelperTextItem variant="error">{error}</HelperTextItem>
          </HelperText>
        </FormHelperText>
      )}
    </div>
  );
};
