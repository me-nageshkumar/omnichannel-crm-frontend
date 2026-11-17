import { saveFile } from '@app/api/contacts';

/** Hands a file to the browser as a download. */
export const saveBlob = (blob: Blob, fileName: string): void => saveFile(blob, fileName);
