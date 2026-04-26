import { type SlashPathTypedFileExtension } from '../path/path';
import { type Maybe } from '../value/maybe.type';
import { invertStringRecord } from './record';

/**
 * A simple mime type string with just the type/subtype and no parameters.
 *
 * I.E. "application/json"
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-util:mime
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
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-util:mime
 */
export type MimeTypeWithSubtypeWildcardWithoutParameters = string;

/**
 * A mime type string that may contain additional parameters.
 *
 * I.E. "text/plain", "application/json; charset=utf-8"
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-util:mime
 */
export type ContentTypeMimeType = string;

/**
 * Input for mimetypeForImageType().
 *
 * This is a non-exhaustive list of common image types.
 */
export type ImageFileExtension = 'jpeg' | 'jpg' | 'png' | 'webp' | 'gif' | 'svg' | 'raw' | 'heif' | 'tiff';

/**
 * MIME type for JPEG images.
 */
export const JPEG_MIME_TYPE: MimeTypeWithoutParameters = 'image/jpeg';
/**
 * MIME type for PNG images.
 */
export const PNG_MIME_TYPE: MimeTypeWithoutParameters = 'image/png';
/**
 * MIME type for WebP images.
 */
export const WEBP_MIME_TYPE: MimeTypeWithoutParameters = 'image/webp';
/**
 * MIME type for GIF images.
 */
export const GIF_MIME_TYPE: MimeTypeWithoutParameters = 'image/gif';
/**
 * MIME type for HEIF images.
 */
export const HEIF_MIME_TYPE: MimeTypeWithoutParameters = 'image/heif';
/**
 * MIME type for TIFF images.
 */
export const TIFF_MIME_TYPE: MimeTypeWithoutParameters = 'image/tiff';
/**
 * MIME type for SVG images.
 */
export const SVG_MIME_TYPE: MimeTypeWithoutParameters = 'image/svg+xml';
/**
 * MIME type for RAW images.
 */
export const RAW_MIME_TYPE: MimeTypeWithoutParameters = 'image/raw';

/**
 * Maps image file extensions to their corresponding MIME types.
 */
export const IMAGE_FILE_EXTENSION_TO_MIME_TYPES_RECORD: Record<ImageFileExtension, MimeTypeWithoutParameters> = {
  jpeg: JPEG_MIME_TYPE,
  jpg: JPEG_MIME_TYPE,
  png: PNG_MIME_TYPE,
  webp: WEBP_MIME_TYPE,
  gif: GIF_MIME_TYPE,
  svg: SVG_MIME_TYPE,
  raw: RAW_MIME_TYPE,
  heif: HEIF_MIME_TYPE,
  tiff: TIFF_MIME_TYPE
};

/**
 * Maps image MIME types back to their corresponding file extensions.
 */
export const IMAGE_MIME_TYPES_TO_FILE_EXTENSIONS_RECORD: Record<MimeTypeWithoutParameters, ImageFileExtension> = invertStringRecord(IMAGE_FILE_EXTENSION_TO_MIME_TYPES_RECORD);

/**
 * Returns the MIME type for the given image file extension, or undefined if the extension is not recognized.
 *
 * @param extension - the image file extension to look up
 * @returns the corresponding MIME type, or undefined if the extension is not known
 */
export function mimeTypeForImageFileExtension(extension: ImageFileExtension): MimeTypeWithoutParameters;
export function mimeTypeForImageFileExtension(extension: SlashPathTypedFileExtension): Maybe<MimeTypeWithoutParameters>;
export function mimeTypeForImageFileExtension(extension: Maybe<ImageFileExtension | SlashPathTypedFileExtension>): Maybe<MimeTypeWithoutParameters>;
export function mimeTypeForImageFileExtension(extension: Maybe<ImageFileExtension | SlashPathTypedFileExtension>): Maybe<MimeTypeWithoutParameters> {
  return extension ? IMAGE_FILE_EXTENSION_TO_MIME_TYPES_RECORD[extension as ImageFileExtension] : undefined;
}

/**
 * Returns the image file extension for the given MIME type, or undefined if the MIME type is not a known image type.
 *
 * @param mimeType - the MIME type to look up
 * @returns the corresponding image file extension, or undefined if not recognized
 */
export function imageFileExtensionForMimeType(mimeType: Maybe<MimeTypeWithoutParameters>): Maybe<ImageFileExtension> {
  return mimeType ? IMAGE_MIME_TYPES_TO_FILE_EXTENSIONS_RECORD[mimeType] : undefined;
}

/**
 * Non-exhaustive list of common document file extensions.
 */
export type DocumentFileExtension = 'pdf' | 'docx' | 'xlsx' | 'txt' | 'csv' | 'html' | 'xml' | 'json' | 'yaml' | 'md';

/**
 * MIME type for PDF documents.
 */
export const PDF_MIME_TYPE: MimeTypeWithoutParameters = 'application/pdf';
/**
 * MIME type for DOCX (Word) documents.
 */
export const DOCX_MIME_TYPE: MimeTypeWithoutParameters = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
/**
 * MIME type for XLSX (Excel) spreadsheets.
 */
export const XLSX_MIME_TYPE: MimeTypeWithoutParameters = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/**
 * MIME type for plain text files.
 */
export const TXT_MIME_TYPE: MimeTypeWithoutParameters = 'text/plain';
/**
 * MIME type for CSV files.
 */
export const CSV_MIME_TYPE: MimeTypeWithoutParameters = 'text/csv';
/**
 * MIME type for HTML files.
 */
export const HTML_MIME_TYPE: MimeTypeWithoutParameters = 'text/html';
/**
 * MIME type for XML files.
 */
export const XML_MIME_TYPE: MimeTypeWithoutParameters = 'application/xml';
/**
 * MIME type for JSON files.
 */
export const JSON_MIME_TYPE: MimeTypeWithoutParameters = 'application/json';
/**
 * MIME type for YAML files.
 */
export const YAML_MIME_TYPE: MimeTypeWithoutParameters = 'application/yaml';
/**
 * MIME type for Markdown files.
 */
export const MARKDOWN_MIME_TYPE: MimeTypeWithoutParameters = 'text/markdown';

/**
 * Maps document file extensions to their corresponding MIME types.
 */
export const DOCUMENT_FILE_EXTENSION_TO_MIME_TYPES_RECORD: Record<DocumentFileExtension, MimeTypeWithoutParameters> = {
  pdf: PDF_MIME_TYPE,
  docx: DOCX_MIME_TYPE,
  xlsx: XLSX_MIME_TYPE,
  txt: TXT_MIME_TYPE,
  csv: CSV_MIME_TYPE,
  html: HTML_MIME_TYPE,
  xml: XML_MIME_TYPE,
  json: JSON_MIME_TYPE,
  yaml: YAML_MIME_TYPE,
  md: MARKDOWN_MIME_TYPE
};

/**
 * Maps document MIME types back to their corresponding file extensions.
 */
export const DOCUMENT_MIME_TYPES_TO_FILE_EXTENSIONS_RECORD: Record<MimeTypeWithoutParameters, DocumentFileExtension> = invertStringRecord(DOCUMENT_FILE_EXTENSION_TO_MIME_TYPES_RECORD);

/**
 * Returns the mimetype for the given document file extension, or undefined if the extension is not known/recognized.
 *
 * @param extension The document file extension to get the mimetype for.
 * @returns The mimetype for the given document file extension, or undefined if the extension is not known.
 */
export function mimeTypeForDocumentFileExtension(extension: DocumentFileExtension): MimeTypeWithoutParameters;
export function mimeTypeForDocumentFileExtension(extension: SlashPathTypedFileExtension): Maybe<MimeTypeWithoutParameters>;
export function mimeTypeForDocumentFileExtension(extension: Maybe<DocumentFileExtension | SlashPathTypedFileExtension>): Maybe<MimeTypeWithoutParameters>;
export function mimeTypeForDocumentFileExtension(extension: Maybe<DocumentFileExtension | SlashPathTypedFileExtension>): Maybe<MimeTypeWithoutParameters> {
  return extension ? DOCUMENT_FILE_EXTENSION_TO_MIME_TYPES_RECORD[extension as DocumentFileExtension] : undefined;
}

/**
 * Returns the document file extension for the given mimetype, or undefined if the mimetype is not known/recognized.
 *
 * @param mimeType The mimetype to get the document file extension for.
 * @returns The document file extension for the given mimetype, or undefined if the mimetype is not known.
 */
export function documentFileExtensionForMimeType(mimeType: Maybe<MimeTypeWithoutParameters>): Maybe<DocumentFileExtension> {
  return mimeType ? DOCUMENT_MIME_TYPES_TO_FILE_EXTENSIONS_RECORD[mimeType] : undefined;
}

/**
 * Non-exhaustive list of common application file extensions.
 */
export type ApplicationFileExtension = 'zip';

/**
 * MIME type for ZIP archive files.
 */
export const ZIP_FILE_MIME_TYPE: MimeTypeWithoutParameters = 'application/zip';

/**
 * Maps application file extensions to their corresponding MIME types.
 */
export const APPLICATION_FILE_EXTENSION_TO_MIME_TYPES_RECORD: Record<ApplicationFileExtension, MimeTypeWithoutParameters> = {
  zip: ZIP_FILE_MIME_TYPE
};

/**
 * Maps application MIME types back to their corresponding file extensions.
 */
export const APPLICATION_MIME_TYPES_TO_FILE_EXTENSIONS_RECORD: Record<MimeTypeWithoutParameters, ApplicationFileExtension> = invertStringRecord(APPLICATION_FILE_EXTENSION_TO_MIME_TYPES_RECORD);

/**
 * Returns the mimetype for the given application file extension, or undefined if the extension is not known/recognized.
 *
 * @param extension The application file extension to get the mimetype for.
 * @returns The mimetype for the given application file extension, or undefined if the extension is not known.
 */
export function mimeTypeForApplicationFileExtension(extension: ApplicationFileExtension): MimeTypeWithoutParameters;
export function mimeTypeForApplicationFileExtension(extension: SlashPathTypedFileExtension): Maybe<MimeTypeWithoutParameters>;
export function mimeTypeForApplicationFileExtension(extension: Maybe<ApplicationFileExtension | SlashPathTypedFileExtension>): Maybe<MimeTypeWithoutParameters>;
export function mimeTypeForApplicationFileExtension(extension: Maybe<ApplicationFileExtension | SlashPathTypedFileExtension>): Maybe<MimeTypeWithoutParameters> {
  return extension ? APPLICATION_FILE_EXTENSION_TO_MIME_TYPES_RECORD[extension as ApplicationFileExtension] : undefined;
}

/**
 * Returns the application file extension for the given MIME type, or undefined if the MIME type is not a known application type.
 *
 * @param mimeType - the MIME type to look up
 * @returns the corresponding application file extension, or undefined if not recognized
 */
export function applicationFileExtensionForMimeType(mimeType: Maybe<MimeTypeWithoutParameters>): Maybe<ApplicationFileExtension> {
  return mimeType ? APPLICATION_MIME_TYPES_TO_FILE_EXTENSIONS_RECORD[mimeType] : undefined;
}

/**
 * List of known file extensions supported by dbx-components.
 *
 * These types are known to work with most dbx-components features related to files.
 */
export type DbxComponentsKnownFileExtension = ImageFileExtension | DocumentFileExtension | ApplicationFileExtension;

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
  const result: Maybe<MimeTypeWithoutParameters> = mimeTypeForImageFileExtension(extension) ?? mimeTypeForDocumentFileExtension(extension);
  return result;
}

/**
 * Returns the file extension for the given MIME type by checking image, document, and application types in order.
 *
 * @param mimeType - the MIME type to look up
 * @returns the corresponding file extension, or undefined if the MIME type is not recognized
 */
export function fileExtensionForMimeType(mimeType: Maybe<MimeTypeWithoutParameters>): Maybe<DbxComponentsKnownFileExtension> {
  const result: Maybe<DbxComponentsKnownFileExtension> = imageFileExtensionForMimeType(mimeType) ?? documentFileExtensionForMimeType(mimeType) ?? applicationFileExtensionForMimeType(mimeType);
  return result;
}

// MARK: ContentDisposition
/**
 * A content disposition string, which is used to determine how the browser should show the target content.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition
 */
export type ContentDispositionString = 'inline' | 'attachment' | string;
