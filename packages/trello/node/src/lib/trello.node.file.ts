import { type Maybe } from '@dereekb/util';

/**
 * The name {@link sanitizeTrelloFileName} falls back to when nothing safe is left.
 */
export const TRELLO_FILE_NAME_FALLBACK = 'attachment';

/**
 * Makes a remote file name (an attachment's file name, a board id) safe to write as one file: strips ASCII control
 * characters, turns path separators into `-` and drops leading dots, so the result has no directory part and is never
 * hidden or `..`.
 *
 * @param name - The remote name.
 * @returns The safe file name, or `'attachment'` when nothing is left (an empty or missing name, or only dots).
 */
export function sanitizeTrelloFileName(name: Maybe<string>): string {
  const safe = (name ?? '')
    // eslint-disable-next-line no-control-regex -- strip ASCII control characters from a remote file name
    .replaceAll(/[\x00-\x1f\x7f]/g, '')
    .replaceAll(/[\\/]/g, '-')
    .replace(/^\.+/, '')
    .trim();
  return safe || TRELLO_FILE_NAME_FALLBACK;
}
