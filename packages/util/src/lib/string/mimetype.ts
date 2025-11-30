import { type SlashPathTypedFileExtension } from '../path/path';
import { type Maybe } from '../value/maybe.type';

/**
 * A simple mime type string with just the type/subtype and no parameters.
 *
 * I.E. "application/json"
 */
export type MimeTypeWithoutParameters = string;

/**
 * The mimetype wildcard.
 */
export type MimeTypeWildcard = '*';

/**
 * A mime type with a wildcard subtype. Has a star as the subtype.
 *
 * I.E. "application/*"
 */
export type MimeTypeWithSubtypeWildcardWithoutParameters = string;

/**
 * A mime type string that may contain additional parameters.
 *
 * I.E. "text/plain", "application/json; charset=utf-8"
 */
export type ContentTypeMimeType = string;

/**
 * Input for mimetypeForImageType().
 *
 * This is a non-exhaustive list of common image types.
 */
export type ImageFileExtension = 'jpeg' | 'jpg' | 'png' | 'webp' | 'gif' | 'svg' | 'raw' | 'heif' | 'tiff';

export const JPEG_MIME_TYPE: MimeTypeWithoutParameters = 'image/jpeg';
export const PNG_MIME_TYPE: MimeTypeWithoutParameters = 'image/png';
export const WEBP_MIME_TYPE: MimeTypeWithoutParameters = 'image/webp';
export const GIF_MIME_TYPE: MimeTypeWithoutParameters = 'image/gif';
export const HEIF_MIME_TYPE: MimeTypeWithoutParameters = 'image/heif';
export const TIFF_MIME_TYPE: MimeTypeWithoutParameters = 'image/tiff';
export const SVG_MIME_TYPE: MimeTypeWithoutParameters = 'image/svg+xml';
export const RAW_MIME_TYPE: MimeTypeWithoutParameters = 'image/raw';

/**
 * Returns the mimetype for the given image type, or undefined if the type is not known.
 */
export function mimeTypeForImageFileExtension(extension: ImageFileExtension): MimeTypeWithoutParameters;
export function mimeTypeForImageFileExtension(extension: SlashPathTypedFileExtension): Maybe<MimeTypeWithoutParameters>;
export function mimeTypeForImageFileExtension(extension: Maybe<ImageFileExtension | SlashPathTypedFileExtension>): Maybe<MimeTypeWithoutParameters>;
export function mimeTypeForImageFileExtension(extension: Maybe<ImageFileExtension | SlashPathTypedFileExtension>): Maybe<MimeTypeWithoutParameters> {
  let result: Maybe<MimeTypeWithoutParameters> = undefined;

  switch (extension) {
    case 'jpeg':
    case 'jpg':
      result = JPEG_MIME_TYPE;
      break;
    case 'png':
      result = PNG_MIME_TYPE;
      break;
    case 'webp':
      result = WEBP_MIME_TYPE;
      break;
    case 'gif':
      result = GIF_MIME_TYPE;
      break;
    case 'svg':
      result = SVG_MIME_TYPE;
      break;
    case 'raw':
      result = RAW_MIME_TYPE;
      break;
    case 'tiff':
      result = TIFF_MIME_TYPE;
      break;
    case 'heif':
      result = HEIF_MIME_TYPE;
      break;
  }

  return result;
}

export type DocumentFileExtension = 'pdf' | 'docx' | 'xlsx' | 'txt' | 'csv' | 'html' | 'xml' | 'json' | 'yaml' | 'md';

export const PDF_MIME_TYPE: MimeTypeWithoutParameters = 'application/pdf';
export const DOCX_MIME_TYPE: MimeTypeWithoutParameters = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const XLSX_MIME_TYPE: MimeTypeWithoutParameters = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const TXT_MIME_TYPE: MimeTypeWithoutParameters = 'text/plain';
export const CSV_MIME_TYPE: MimeTypeWithoutParameters = 'text/csv';
export const HTML_MIME_TYPE: MimeTypeWithoutParameters = 'text/html';
export const XML_MIME_TYPE: MimeTypeWithoutParameters = 'application/xml';
export const JSON_MIME_TYPE: MimeTypeWithoutParameters = 'application/json';
export const YAML_MIME_TYPE: MimeTypeWithoutParameters = 'application/yaml';
export const MARKDOWN_MIME_TYPE: MimeTypeWithoutParameters = 'text/markdown';

export function mimeTypeForDocumentFileExtension(extension: DocumentFileExtension): MimeTypeWithoutParameters;
export function mimeTypeForDocumentFileExtension(extension: SlashPathTypedFileExtension): Maybe<MimeTypeWithoutParameters>;
export function mimeTypeForDocumentFileExtension(extension: Maybe<DocumentFileExtension | SlashPathTypedFileExtension>): Maybe<MimeTypeWithoutParameters>;
export function mimeTypeForDocumentFileExtension(extension: Maybe<DocumentFileExtension | SlashPathTypedFileExtension>): Maybe<MimeTypeWithoutParameters> {
  let result: Maybe<MimeTypeWithoutParameters> = undefined;

  switch (extension) {
    case 'pdf':
      result = PDF_MIME_TYPE;
      break;
    case 'docx':
      result = DOCX_MIME_TYPE;
      break;
    case 'xlsx':
      result = XLSX_MIME_TYPE;
      break;
    case 'txt':
      result = TXT_MIME_TYPE;
      break;
    case 'csv':
      result = CSV_MIME_TYPE;
      break;
    case 'html':
      result = HTML_MIME_TYPE;
      break;
    case 'xml':
      result = XML_MIME_TYPE;
      break;
    case 'json':
      result = JSON_MIME_TYPE;
      break;
    case 'yaml':
      result = YAML_MIME_TYPE;
      break;
    case 'md':
      result = MARKDOWN_MIME_TYPE;
      break;
  }

  return result;
}

/**
 * List of known file extensions supported by dbx-components.
 *
 * These types are known to work with most dbx-components features related to files.
 */
export type DbxComponentsKnownFileExtension = ImageFileExtension | DocumentFileExtension;

/**
 * Returns the mimetype for the given file extension, or undefined if the extension is not known/recognized.
 *
 * @param extension The file extension to get the mimetype for.
 * @returns The mimetype for the given file extension, or undefined if the extension is not known.
 */
export function mimeTypeForFileExtension(extension: DbxComponentsKnownFileExtension): MimeTypeWithoutParameters;
export function mimeTypeForFileExtension(extension: SlashPathTypedFileExtension): Maybe<MimeTypeWithoutParameters>;
export function mimeTypeForFileExtension(extension: Maybe<DbxComponentsKnownFileExtension | SlashPathTypedFileExtension>): Maybe<MimeTypeWithoutParameters>;
export function mimeTypeForFileExtension(extension: Maybe<DbxComponentsKnownFileExtension | SlashPathTypedFileExtension>): Maybe<MimeTypeWithoutParameters> {
  let result: Maybe<MimeTypeWithoutParameters> = mimeTypeForImageFileExtension(extension) ?? mimeTypeForDocumentFileExtension(extension);
  return result;
}

// MARK: ContentDisposition
/**
 * A content disposition string, which is used to determine how the browser should show the target content.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition
 */
export type ContentDispositionString = 'inline' | 'attachment' | string;

// MARK: Compat
/**
 * @deprecated Use ImageFileExtension instead.
 */
export type MimeTypeForImageTypeInputType = ImageFileExtension;

/**
 * @deprecated Use mimeTypeForImageFileExtension instead.
 */
export const mimetypeForImageType = mimeTypeForImageFileExtension;
