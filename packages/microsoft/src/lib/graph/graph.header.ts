import { type Maybe } from '@dereekb/util';

/**
 * Request headers for a Graph call, keyed by header name.
 */
export type MicrosoftGraphHeaders = Record<string, string>;

/**
 * The `Prefer` value that asks Outlook for immutable ids: a message's id then survives a move to another
 * folder, where a default id changes.
 *
 * @see https://learn.microsoft.com/en-us/graph/outlook-immutable-id
 */
export const MICROSOFT_GRAPH_IMMUTABLE_ID_PREFER = 'IdType="ImmutableId"';

/**
 * The `Prefer` key choosing the format of a message or event body (`text` or `html`).
 *
 * @see https://learn.microsoft.com/en-us/graph/api/message-get#request-headers
 */
export const MICROSOFT_GRAPH_BODY_CONTENT_TYPE_PREFER_KEY = 'outlook.body-content-type';

/**
 * The `Prefer` key choosing the time zone Outlook returns event times in.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/user-list-calendarview#request-headers
 */
export const MICROSOFT_GRAPH_TIMEZONE_PREFER_KEY = 'outlook.timezone';

/**
 * The body formats Outlook can return.
 */
export type MicrosoftGraphBodyContentType = 'text' | 'html';

/**
 * Returns the `Prefer` value that asks for a message or event body in the given format.
 *
 * @param contentType - The body format.
 * @returns E.g. `outlook.body-content-type="text"`.
 */
export function microsoftGraphBodyContentTypePrefer(contentType: MicrosoftGraphBodyContentType): string {
  return `${MICROSOFT_GRAPH_BODY_CONTENT_TYPE_PREFER_KEY}="${contentType}"`;
}

/**
 * Returns the `Prefer` value that asks for event times in the given time zone.
 *
 * @param timeZone - A Windows or IANA time zone name, e.g. `Pacific Standard Time`.
 * @returns E.g. `outlook.timezone="Pacific Standard Time"`.
 */
export function microsoftGraphTimeZonePrefer(timeZone: string): string {
  return `${MICROSOFT_GRAPH_TIMEZONE_PREFER_KEY}="${timeZone}"`;
}

/**
 * Combines several `Prefer` values into one header value. Graph reads a comma-separated list, and a
 * request carrying two `Prefer` headers may see only one of them.
 *
 * @param values - The `Prefer` values; empty and missing ones are skipped.
 * @returns The comma-joined value, or undefined when no value remains.
 *
 * @example
 * ```ts
 * microsoftGraphPreferHeaderValue([MICROSOFT_GRAPH_IMMUTABLE_ID_PREFER, microsoftGraphBodyContentTypePrefer('text')]);
 * // 'IdType="ImmutableId", outlook.body-content-type="text"'
 * ```
 */
export function microsoftGraphPreferHeaderValue(values: readonly Maybe<string>[]): Maybe<string> {
  const present = values.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  return present.length > 0 ? present.join(', ') : undefined;
}

/**
 * Header names whose casing the Graph client canonicalises, so a caller's header replaces the client's
 * default instead of being sent alongside it.
 */
const MICROSOFT_GRAPH_CANONICAL_HEADER_NAMES = ['Accept', 'Authorization', 'Content-Type', 'Prefer'];
const MICROSOFT_GRAPH_CANONICAL_HEADER_NAME_BY_LOWERCASE = new Map(MICROSOFT_GRAPH_CANONICAL_HEADER_NAMES.map((name) => [name.toLowerCase(), name]));

/**
 * Rewrites the names of the headers the client sets itself (`Accept`, `Content-Type`, `Prefer`,
 * `Authorization`) to their canonical casing. The client merges headers by exact name, so a caller's
 * `content-type` would otherwise go out next to the default `Content-Type` and Graph would read both.
 *
 * @param headers - The caller's headers.
 * @returns The headers with canonical names; other names are kept as given.
 */
export function canonicalizeMicrosoftGraphHeaders(headers: Maybe<MicrosoftGraphHeaders>): MicrosoftGraphHeaders {
  const result: MicrosoftGraphHeaders = {};

  Object.entries(headers ?? {}).forEach(([name, value]) => {
    result[MICROSOFT_GRAPH_CANONICAL_HEADER_NAME_BY_LOWERCASE.get(name.toLowerCase()) ?? name] = value;
  });

  return result;
}
