/**
 * A simple mime type string with just the type/subtype and no parameters.
 *
 * I.E. "application/json"
 */
export type MimeTypeWithoutParameters = string;

/**
 * A mime type string that may contain additional parameters.
 *
 * I.E. "text/plain", "application/json; charset=utf-8"
 */
export type ContentTypeMimeType = string;
