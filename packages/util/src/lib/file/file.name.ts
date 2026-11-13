import { type Maybe } from '../value/maybe.type';

/**
 * How {@link sanitizeFileName} cleans a name.
 *
 * - `strict`: keeps only ASCII letters, digits, `.`, `-`, `_` and spaces; drops leading dots. For names that must stay
 *   plain everywhere (e.g. mail attachment names).
 * - `portable`: keeps Unicode and leading dots; replaces only what a local file system rejects. For mirroring remote
 *   files (e.g. a SharePoint folder) with their names intact.
 */
export type SanitizeFileNameMode = 'strict' | 'portable';

/**
 * Default `maxLength` of {@link sanitizeFileName} in `strict` mode, in characters.
 */
export const DEFAULT_SANITIZE_FILE_NAME_STRICT_MAX_LENGTH = 80;

/**
 * Default `maxLength` of {@link sanitizeFileName} in `portable` mode, in UTF-8 bytes (the common file-system limit).
 */
export const DEFAULT_SANITIZE_FILE_NAME_PORTABLE_MAX_BYTES = 255;

/**
 * Default `fallback` of {@link sanitizeFileName}.
 */
export const DEFAULT_SANITIZE_FILE_NAME_FALLBACK = 'file';

/**
 * The longest extension (dot included) that {@link sanitizeFileName} and {@link fileNameWithSuffix} keep apart from the stem.
 */
export const SANITIZE_FILE_NAME_MAX_EXTENSION_LENGTH = 10;

export interface SanitizeFileNameConfig {
  /**
   * `strict` (default): ASCII letters, digits, `.`, `-`, `_`, space. `portable`: keeps Unicode; replaces only what a
   * local file system rejects.
   */
  readonly mode?: Maybe<SanitizeFileNameMode>;
  /**
   * `strict`: characters (default 80). `portable`: UTF-8 bytes (default 255). An extension of up to 10 characters is kept.
   */
  readonly maxLength?: Maybe<number>;
  /**
   * Returned when nothing is left. Defaults to `file`.
   */
  readonly fallback?: Maybe<string>;
}

const WINDOWS_RESERVED_FILE_NAME_REGEX = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
// eslint-disable-next-line no-control-regex
const PORTABLE_FILE_NAME_REJECTED_CHARACTERS_REGEX = /[/\\\u0000-\u001f\u007f<>:"|?*]/g;
const TRAILING_DOTS_AND_SPACES_REGEX = /[. ]+$/;

/**
 * Splits a file name at its extension: the last `.` that is not the first character, when the extension (dot included)
 * is at most {@link SANITIZE_FILE_NAME_MAX_EXTENSION_LENGTH} characters long.
 *
 * @param name - The file name.
 * @returns The stem and the extension (`''` when there is none).
 */
function splitFileNameExtension(name: string): { readonly stem: string; readonly extension: string } {
  const dot = name.lastIndexOf('.');
  const hasExtension = dot > 0 && name.length - dot <= SANITIZE_FILE_NAME_MAX_EXTENSION_LENGTH;
  return hasExtension ? { stem: name.slice(0, dot), extension: name.slice(dot) } : { stem: name, extension: '' };
}

/**
 * Cuts text to at most `maxBytes` UTF-8 bytes without splitting a code point.
 *
 * @param value - The string.
 * @param maxBytes - The most bytes to keep.
 * @returns The longest prefix that fits.
 */
function truncateToUtf8Bytes(value: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  let bytes = 0;
  let result = '';

  for (const codePoint of value) {
    const size = encoder.encode(codePoint).length;

    if (bytes + size > maxBytes) {
      break;
    }

    bytes += size;
    result += codePoint;
  }

  return result;
}

function sanitizeStrictFileName(name: string, maxLength: number, fallback: string): string {
  const cleaned = name
    .replaceAll(/[^\w.\- ]/g, '_')
    .replaceAll(/\.{2,}/g, '_')
    .replaceAll(/_+/g, '_')
    .replace(/^[._\s]+/, '')
    .trim();
  let result = cleaned || fallback;

  if (result.length > maxLength) {
    const { stem, extension } = splitFileNameExtension(result);
    result = stem.slice(0, maxLength - extension.length) + extension;
  }

  return result;
}

function sanitizePortableFileName(name: string, maxBytes: number, fallback: string): string {
  const encoder = new TextEncoder();
  let result = name.normalize('NFC').replaceAll(PORTABLE_FILE_NAME_REJECTED_CHARACTERS_REGEX, '_').replace(TRAILING_DOTS_AND_SPACES_REGEX, '');

  if (WINDOWS_RESERVED_FILE_NAME_REGEX.test(result)) {
    result = `_${result}`;
  }

  if (encoder.encode(result).length > maxBytes) {
    const split = splitFileNameExtension(result);
    const extensionBytes = encoder.encode(split.extension).length;
    const extension = extensionBytes < maxBytes ? split.extension : '';
    const stem = truncateToUtf8Bytes(extension ? split.stem : result, maxBytes - (extension ? extensionBytes : 0));
    result = extension ? stem + extension : stem.replace(TRAILING_DOTS_AND_SPACES_REGEX, '');
  }

  if (!result || result === '.' || result === '..') {
    result = fallback;
  }

  return result;
}

/**
 * Makes a name safe to use as one local file name: never a path, never empty.
 *
 * `strict` (the default) replaces path separators, control characters, `..` and anything outside ASCII letters, digits,
 * `.`, `-`, `_` and spaces with `_`, collapses repeated `_`, drops leading dots, underscores and spaces, and caps the
 * name at `maxLength` characters (default 80), keeping its extension.
 *
 * `portable` NFC-normalizes the name and replaces only what a local file system rejects (`/`, `\`, NUL and other control
 * characters, DEL, and `< > : " | ? *`) with `_`. It trims trailing dots and spaces, prefixes Windows device names
 * (`CON`, `NUL`, `COM1`, `LPT1`, …, with or without an extension) with `_`, keeps leading dots and Unicode, and caps the
 * name at `maxLength` UTF-8 bytes (default 255), keeping its extension and never splitting a code point.
 *
 * @param name - The raw name, e.g. a remote file's or an attachment's.
 * @param config - The mode, length cap and fallback.
 * @returns The safe name; `fallback` (default `file`) when nothing is left.
 *
 * @dbxUtil
 * @dbxUtilCategory file
 * @dbxUtilTags file, name, sanitize, filename, path, safe, portable
 *
 * @example
 * ```ts
 * sanitizeFileName('../../etc/passwd'); // 'etc_passwd'
 * sanitizeFileName('Résumé: draft?.docx', { mode: 'portable' }); // 'Résumé_ draft_.docx'
 * ```
 */
export function sanitizeFileName(name: Maybe<string>, config?: Maybe<SanitizeFileNameConfig>): string {
  const mode = config?.mode ?? 'strict';
  const fallback = config?.fallback ?? DEFAULT_SANITIZE_FILE_NAME_FALLBACK;
  const input = name ?? '';
  return mode === 'portable' ? sanitizePortableFileName(input, config?.maxLength ?? DEFAULT_SANITIZE_FILE_NAME_PORTABLE_MAX_BYTES, fallback) : sanitizeStrictFileName(input, config?.maxLength ?? DEFAULT_SANITIZE_FILE_NAME_STRICT_MAX_LENGTH, fallback);
}

/**
 * Inserts a suffix before a file name's extension, e.g. to tell apart two names that collide.
 * The extension is the last `.` part that is not the first character and is at most 10 characters long.
 * The result is not re-capped: sanitize with room to spare when the suffix must fit a length limit.
 *
 * @param name - The file name.
 * @param suffix - The text to insert.
 * @returns The name with the suffix before its extension.
 *
 * @dbxUtil
 * @dbxUtilCategory file
 * @dbxUtilTags file, name, suffix, extension, collision, rename
 *
 * @example
 * ```ts
 * fileNameWithSuffix('report.pdf', ' (1a2b3c4d)'); // 'report (1a2b3c4d).pdf'
 * fileNameWithSuffix('.bashrc', ' (1)'); // '.bashrc (1)'
 * ```
 */
export function fileNameWithSuffix(name: string, suffix: string): string {
  const { stem, extension } = splitFileNameExtension(name);
  return `${stem}${suffix}${extension}`;
}
