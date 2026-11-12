import { type ISO8601DateString, type Maybe } from '@dereekb/util';
import { type FetchJsonBody, type FetchMethod } from '@dereekb/util/fetch';
import { type MicrosoftGraphContext } from './graph.config';
import { type MicrosoftGraphDriveItem, type MicrosoftGraphEvent, type MicrosoftGraphMessage, type MicrosoftGraphPage } from './graph.type';

/**
 * Query parameters for a Graph request. `undefined`/`null` values are dropped.
 */
export type MicrosoftGraphQuery = Record<string, Maybe<string | number | boolean>>;

export interface MicrosoftGraphRequestInput {
  readonly method: FetchMethod;
  /**
   * A path relative to the Graph base URL (`/me/messages`), or an absolute URL (an `@odata.nextLink`).
   */
  readonly path: string;
  readonly query?: Maybe<MicrosoftGraphQuery>;
  readonly body?: Maybe<FetchJsonBody>;
  /**
   * Extra request headers, e.g. `Prefer` or `ConsistencyLevel`.
   */
  readonly headers?: Maybe<Record<string, string>>;
}

/**
 * Appends the query to the path, keeping any query the path already carries.
 *
 * @param path - The path or absolute URL.
 * @param query - The query values to append.
 * @returns The path with the query appended.
 */
export function microsoftGraphPathWithQuery(path: string, query: Maybe<MicrosoftGraphQuery>): string {
  const params = new URLSearchParams();

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value != null) {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();
  let result = path;

  if (queryString) {
    result = `${path}${path.includes('?') ? '&' : '?'}${queryString}`;
  }

  return result;
}

/**
 * Makes a raw Graph call as the context's user.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that performs the request and resolves the parsed JSON body.
 * @throws {MicrosoftGraphError} When Graph returns an error body.
 */
export function microsoftGraphRequest(context: MicrosoftGraphContext): <T = unknown>(input: MicrosoftGraphRequestInput) => Promise<T> {
  return async <T>(input: MicrosoftGraphRequestInput) => {
    const accessToken = await context.accessTokenGetter();

    return context.fetchJson<T>(microsoftGraphPathWithQuery(input.path, input.query), {
      method: input.method,
      body: input.body ?? undefined,
      headers: {
        ...input.headers,
        Authorization: `Bearer ${accessToken}`
      }
    });
  };
}

export interface MicrosoftGraphRequestAllPagesInput extends Omit<MicrosoftGraphRequestInput, 'method' | 'body'> {
  /**
   * Stops after this many pages. Defaults to 20.
   */
  readonly maxPages?: Maybe<number>;
}

/**
 * GETs a Graph collection and follows `@odata.nextLink` until the last page (or `maxPages`).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that follows `@odata.nextLink` (up to `maxPages`) and resolves the collected items.
 */
export function microsoftGraphRequestAllPages(context: MicrosoftGraphContext): <T = unknown>(input: MicrosoftGraphRequestAllPagesInput) => Promise<T[]> {
  const request = microsoftGraphRequest(context);

  return async <T>(input: MicrosoftGraphRequestAllPagesInput) => {
    const maxPages = input.maxPages ?? 20;
    const items: T[] = [];
    let page = await request<MicrosoftGraphPage<T>>({ method: 'GET', path: input.path, query: input.query, headers: input.headers });
    let pageCount = 1;
    items.push(...(page.value ?? []));

    while (page['@odata.nextLink'] && pageCount < maxPages) {
      page = await request<MicrosoftGraphPage<T>>({ method: 'GET', path: page['@odata.nextLink'], headers: input.headers });
      items.push(...(page.value ?? []));
      pageCount += 1;
    }

    return items;
  };
}

// MARK: Mail
/**
 * The message fields the mail helpers select.
 */
export const MICROSOFT_GRAPH_MESSAGE_SELECT = 'id,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,webLink,conversationId';

export interface MicrosoftGraphSearchMessagesInput {
  /**
   * The KQL search query, e.g. `from:ada subject:invoice`.
   */
  readonly query: string;
  readonly top?: Maybe<number>;
  /**
   * A mail folder id or well-known name (`inbox`, `sentitems`). Searches every folder when absent.
   */
  readonly folder?: Maybe<string>;
}

/**
 * Searches the user's messages (`$search`). Requires `Mail.Read`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that searches the mailbox and resolves the first page of matches.
 */
export function searchMessages(context: MicrosoftGraphContext): (input: MicrosoftGraphSearchMessagesInput) => Promise<MicrosoftGraphPage<MicrosoftGraphMessage>> {
  const request = microsoftGraphRequest(context);

  return (input) => {
    const path = input.folder ? `/me/mailFolders/${encodeURIComponent(input.folder)}/messages` : '/me/messages';
    // $search values must be double-quoted; an embedded double quote is backslash-escaped
    const escapedQuery = input.query.replaceAll('"', String.raw`\"`);
    const search = `"${escapedQuery}"`;
    return request({ method: 'GET', path, query: { $search: search, $top: input.top ?? 25, $select: MICROSOFT_GRAPH_MESSAGE_SELECT } });
  };
}

export interface MicrosoftGraphGetMessageInput {
  readonly id: string;
  /**
   * The body format to return. Defaults to `text`.
   */
  readonly format?: Maybe<'text' | 'html'>;
}

/**
 * Reads one message with its body. Requires `Mail.Read`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that loads one message by id.
 */
export function getMessage(context: MicrosoftGraphContext): (input: MicrosoftGraphGetMessageInput) => Promise<MicrosoftGraphMessage> {
  const request = microsoftGraphRequest(context);

  return (input) => request({ method: 'GET', path: `/me/messages/${encodeURIComponent(input.id)}`, query: { $select: `${MICROSOFT_GRAPH_MESSAGE_SELECT},body` }, headers: { Prefer: `outlook.body-content-type="${input.format ?? 'text'}"` } });
}

// MARK: Calendar
export interface MicrosoftGraphListCalendarViewInput {
  readonly start: ISO8601DateString;
  readonly end: ISO8601DateString;
  readonly top?: Maybe<number>;
}

/**
 * Lists the user's calendar occurrences between two instants (`/me/calendarView`), recurring
 * instances expanded. Requires `Calendars.Read`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that lists calendar events and resolves the first page.
 */
export function listCalendarView(context: MicrosoftGraphContext): (input: MicrosoftGraphListCalendarViewInput) => Promise<MicrosoftGraphPage<MicrosoftGraphEvent>> {
  const request = microsoftGraphRequest(context);

  return (input) => request({ method: 'GET', path: '/me/calendarView', query: { startDateTime: input.start, endDateTime: input.end, $top: input.top ?? 50, $orderby: 'start/dateTime', $select: 'id,subject,start,end,isAllDay,location,organizer,attendees,webLink' } });
}

// MARK: Files
export interface MicrosoftGraphSearchDriveItemsInput {
  readonly query: string;
  readonly top?: Maybe<number>;
}

/**
 * Searches the user's OneDrive (`/me/drive/root/search`). Requires `Files.Read` (or `.All`).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that searches OneDrive and resolves the first page of matches.
 */
export function searchDriveItems(context: MicrosoftGraphContext): (input: MicrosoftGraphSearchDriveItemsInput) => Promise<MicrosoftGraphPage<MicrosoftGraphDriveItem>> {
  const request = microsoftGraphRequest(context);

  return (input) => {
    // OData string literals escape a single quote by doubling it
    const q = input.query.replaceAll("'", "''");
    return request({ method: 'GET', path: `/me/drive/root/search(q='${encodeURIComponent(q)}')`, query: { $top: input.top ?? 25 } });
  };
}

export interface MicrosoftGraphGetDriveItemInput {
  /**
   * The drive item id. Takes precedence over `path`.
   */
  readonly id?: Maybe<string>;
  /**
   * The item's path from the drive root, e.g. `Documents/report.docx`.
   */
  readonly path?: Maybe<string>;
}

/**
 * Reads a drive item's metadata by id or by path. Requires `Files.Read` (or `.All`).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that loads one drive item by id or path.
 * @throws {Error} When neither an id nor a path is given.
 */
export function getDriveItem(context: MicrosoftGraphContext): (input: MicrosoftGraphGetDriveItemInput) => Promise<MicrosoftGraphDriveItem> {
  const request = microsoftGraphRequest(context);

  return (input) => {
    let path: string;

    if (input.id) {
      path = `/me/drive/items/${encodeURIComponent(input.id)}`;
    } else if (input.path) {
      const itemPath = input.path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
      path = `/me/drive/root:/${itemPath}`;
    } else {
      throw new Error('getDriveItem requires an id or a path.');
    }

    return request({ method: 'GET', path });
  };
}
