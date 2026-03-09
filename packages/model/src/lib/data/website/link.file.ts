import { filterFalsyAndEmptyValues, type ModelTypeString, splitJoinRemainder } from '@dereekb/util';
import { type } from 'arktype';
import { type WebsiteLink, type WebsiteLinkEncodedData, WEBSITE_LINK_ENCODED_DATA_MAX_LENGTH, WEBSITE_LINK_TYPE_MAX_LENGTH, WEBSITE_LINK_TYPE_REGEX } from './link';

/**
 * Short string identifier for categorizing different kinds of file links.
 */
export type WebsiteFileLinkType = ModelTypeString;

/**
 * Maximum character length for a {@link WebsiteFileLinkType}. Matches {@link WEBSITE_LINK_TYPE_MAX_LENGTH}.
 */
export const WEBSITE_FILE_LINK_TYPE_MAX_LENGTH = WEBSITE_LINK_TYPE_MAX_LENGTH;

/**
 * Validation regex for {@link WebsiteFileLinkType}. Matches {@link WEBSITE_LINK_TYPE_REGEX}.
 */
export const WEBSITE_FILE_LINK_TYPE_REGEX = WEBSITE_LINK_TYPE_REGEX;

/**
 * MIME type string for a file link (e.g., "image/png", "application/pdf").
 */
export type WebsiteFileLinkMimeType = string;

/**
 * Maximum character length for a {@link WebsiteFileLinkMimeType}.
 */
export const WEBSITE_FILE_LINK_MIME_TYPE_MAX_LENGTH = 128;

/**
 * Regex pattern that validates a MIME type string (e.g., "text/plain", "application/vnd.api+json").
 */
export const WEBSITE_FILE_LINK_MIME_TYPE_REGEX = /^\w+\/[-+.\w]+$/;

/**
 * Display name for a file link. Has no pattern restriction.
 */
export type WebsiteFileLinkName = string;

/**
 * Maximum character length for a {@link WebsiteFileLinkName}.
 */
export const WEBSITE_FILE_LINK_NAME_MAX_LENGTH = 128;

/**
 * The data payload of a file link, typically a URL pointing to the file.
 */
export type WebsiteFileLinkData = string;

/**
 * Maximum character length for {@link WebsiteFileLinkData}, derived from the total encoded data budget
 * minus the separator characters, type, MIME type, and name fields.
 */
export const WEBSITE_FILE_LINK_DATA_MAX_LENGTH = WEBSITE_LINK_ENCODED_DATA_MAX_LENGTH - 3 - WEBSITE_FILE_LINK_TYPE_MAX_LENGTH - WEBSITE_FILE_LINK_MIME_TYPE_MAX_LENGTH - WEBSITE_FILE_LINK_NAME_MAX_LENGTH;

/**
 * Regex pattern for file link data — disallows the pipe character since it is used as the encoding separator.
 */
export const WEBSITE_FILE_LINK_DATA_REGEX = /^[^|]+$/;

/**
 * A decoded representation of a {@link WebsiteLink} that points to a file.
 *
 * Contains optional metadata (type, MIME, display name) alongside the required data payload.
 */
export interface WebsiteFileLink {
  /**
   * Arbitrary file type that can be used for identification.
   */
  type?: WebsiteFileLinkType;
  /**
   * File Type, if applicable
   */
  mime?: WebsiteFileLinkMimeType;
  /**
   * Display name, if applicable.
   */
  name?: WebsiteFileLinkName;
  /**
   * Arbitrary data.
   */
  data: WebsiteFileLinkData;
}

/**
 * ArkType schema for a {@link WebsiteFileLink}.
 */
export const websiteFileLinkType = type({
  'type?': [WEBSITE_FILE_LINK_TYPE_REGEX, '&', `string <= ${WEBSITE_LINK_TYPE_MAX_LENGTH}`] as const,
  'mime?': [WEBSITE_FILE_LINK_MIME_TYPE_REGEX, '&', `string <= ${WEBSITE_FILE_LINK_MIME_TYPE_MAX_LENGTH}`] as const,
  'name?': `string <= ${WEBSITE_FILE_LINK_NAME_MAX_LENGTH}`,
  data: [WEBSITE_FILE_LINK_DATA_REGEX, '&', `0 < string <= ${WEBSITE_FILE_LINK_DATA_MAX_LENGTH}`] as const
});

/**
 * A pipe-separated encoded string representation of a {@link WebsiteFileLink}.
 */
export type EncodedWebsiteFileLink = WebsiteLinkEncodedData;

/**
 * The {@link WebsiteLinkType} code used to identify a {@link WebsiteLink} as a file link.
 */
export const WEBSITE_FILE_LINK_WEBSITE_LINK_TYPE = 'f';

/**
 * Converts a {@link WebsiteFileLink} to a {@link WebsiteLink} by encoding its fields into the data string.
 *
 * @param input - the file link to convert
 * @returns a WebsiteLink with type "f" and pipe-encoded data
 *
 * @example
 * ```typescript
 * const fileLink: WebsiteFileLink = { type: 't', mime: 'text/plain', data: 'https://example.com/file.txt', name: 'file' };
 * const link = websiteFileLinkToWebsiteLink(fileLink);
 * // link.t === 'f'
 * ```
 */
export function websiteFileLinkToWebsiteLink(input: WebsiteFileLink): WebsiteLink {
  return {
    t: WEBSITE_FILE_LINK_WEBSITE_LINK_TYPE,
    d: encodeWebsiteFileLinkToWebsiteLinkEncodedData(input)
  };
}

/**
 * Converts a {@link WebsiteLink} back to a {@link WebsiteFileLink} by decoding the pipe-separated data string.
 *
 * @param input - a WebsiteLink whose data field contains an encoded file link
 * @returns the decoded file link with type, MIME, name, and data fields
 *
 * @example
 * ```typescript
 * const link: WebsiteLink = { t: 'f', d: 't|text/plain|https://example.com/file.txt|file' };
 * const fileLink = websiteLinkToWebsiteLinkFile(link);
 * // fileLink.data === 'https://example.com/file.txt'
 * ```
 */
export function websiteLinkToWebsiteLinkFile(input: WebsiteLink): WebsiteFileLink {
  const encodedData = input.d;
  return decodeWebsiteLinkEncodedDataToWebsiteFileLink(encodedData);
}

/**
 * Separator character used when encoding/decoding file link fields into a single string.
 */
export const WEBSITE_FILE_LINK_ENCODE_SEPARATOR = '|';

/**
 * Encodes a {@link WebsiteFileLink} into a pipe-separated string suitable for storage in a {@link WebsiteLink}'s data field.
 *
 * Fields are encoded in order: type, MIME, data, name. Empty/undefined fields become empty strings.
 *
 * @param input - the file link to encode
 * @returns a pipe-separated encoded string
 *
 * @example
 * ```typescript
 * const encoded = encodeWebsiteFileLinkToWebsiteLinkEncodedData({
 *   type: 't',
 *   mime: 'test/test',
 *   name: 'test-name',
 *   data: 'https://example.com/'
 * });
 * // encoded === 't|test/test|https://example.com/|test-name'
 * ```
 */
export function encodeWebsiteFileLinkToWebsiteLinkEncodedData(input: WebsiteFileLink): EncodedWebsiteFileLink {
  const encoded = [input.type, input.mime, input.data, input.name].map((x) => x || '').join(WEBSITE_FILE_LINK_ENCODE_SEPARATOR);
  return encoded;
}

/**
 * Decodes a pipe-separated encoded string back into a {@link WebsiteFileLink}.
 *
 * Empty fields in the encoded string are omitted from the result (falsy values are filtered out).
 *
 * @param input - the pipe-separated encoded string
 * @returns the decoded file link
 *
 * @example
 * ```typescript
 * const fileLink = decodeWebsiteLinkEncodedDataToWebsiteFileLink('t|test/test|https://example.com/|test-name');
 * // fileLink.type === 't'
 * // fileLink.mime === 'test/test'
 * // fileLink.data === 'https://example.com/'
 * // fileLink.name === 'test-name'
 * ```
 */
export function decodeWebsiteLinkEncodedDataToWebsiteFileLink(input: EncodedWebsiteFileLink): WebsiteFileLink {
  const [type, mime, data, name] = splitJoinRemainder(input, WEBSITE_FILE_LINK_ENCODE_SEPARATOR, 4);

  return filterFalsyAndEmptyValues<WebsiteFileLink>({
    type,
    mime,
    name,
    data
  });
}
