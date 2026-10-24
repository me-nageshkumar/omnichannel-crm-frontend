export const MAX_FILES = 5;
export const MAX_BYTES = 10 * 1024 * 1024;

const OOXML = 'application/vnd.openxmlformats-officedocument.';
/** The server's accepted extensions and the types each may be sent as (no SVG). */
const TYPES: Record<string, string[]> = {
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  bmp: ['image/bmp'],
  heic: ['image/heic'],
  heif: ['image/heif'],
  tif: ['image/tiff'],
  tiff: ['image/tiff'],
  pdf: ['application/pdf'],
  txt: ['text/plain'],
  csv: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  doc: ['application/msword'],
  docx: [`${OOXML}wordprocessingml.document`],
  xls: ['application/vnd.ms-excel'],
  xlsx: [`${OOXML}spreadsheetml.sheet`],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: [`${OOXML}presentationml.presentation`],
};
const GENERIC = ['', 'application/octet-stream', 'binary/octet-stream'];

/** For the file input's {@code accept}. */
export const ACCEPT = Object.keys(TYPES)
  .map((e) => `.${e}`)
  .join(',');

/** Why the file can't be attached to a note that already holds {@code currentCount}; null when it can. */
export function rejectReason(file: File, currentCount: number): string | null {
  if (currentCount >= MAX_FILES) return `A note holds at most ${MAX_FILES} files.`;
  if (file.size > MAX_BYTES) return 'Files may be at most 10 MB.';
  const dot = file.name.lastIndexOf('.');
  const types = dot < 0 ? undefined : TYPES[file.name.slice(dot + 1).toLowerCase()];
  const type = (file.type || '').toLowerCase().split(';')[0].trim();
  if (!types || !(GENERIC.includes(type) || types.includes(type))) {
    return 'Only images, PDF, Office documents, CSV and plain text can be attached.';
  }
  return null;
}

/** "2 KB", "1.5 MB". */
export function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}
