import { type EmailAddress, type Maybe } from '@dereekb/util';
import { type MicrosoftGraphQuery, microsoftGraphPathWithQuery, microsoftGraphRequest } from './graph.api';
import { microsoftGraphBatch } from './graph.batch.api';
import { type MicrosoftGraphContext } from './graph.config';
import { type MicrosoftGraphErrorData } from './graph.error.api';
import { MICROSOFT_GRAPH_IMMUTABLE_ID_PREFER, type MicrosoftGraphBodyContentType, type MicrosoftGraphHeaders, microsoftGraphBodyContentTypePrefer, microsoftGraphPreferHeaderValue } from './graph.header';
import { type MicrosoftGraphRawResponse, microsoftGraphRequestRaw } from './graph.raw.api';
import { type MicrosoftGraphMessage, type MicrosoftGraphPage } from './graph.type';

/**
 * The message fields the mail helpers select by default.
 */
export const MICROSOFT_GRAPH_MESSAGE_SELECT = 'id,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,webLink,conversationId';

/**
 * The page size `listMessages` / `searchMessages` ask for when none is given.
 */
export const DEFAULT_MICROSOFT_GRAPH_MESSAGE_PAGE_SIZE = 25;

/**
 * The lower bound `microsoftGraphMessageListFilter` puts first in a `$filter` that has no date bound of its
 * own. Outlook answers `InefficientFilter` unless the `$orderby` property (`receivedDateTime`) also leads
 * the `$filter`.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/user-list-messages#using-filter-and-orderby-in-the-same-query
 */
export const MICROSOFT_GRAPH_MESSAGE_FILTER_EARLIEST = '1900-01-01T00:00:00Z';

/**
 * Which mailbox a mail call reads or writes, and which id type it returns.
 */
export interface MicrosoftGraphMailboxInput {
  /**
   * A shared or delegated mailbox's address. The signed-in user's own mailbox (`/me`) when absent.
   *
   * Another user's mailbox needs the `*.Shared` scopes (`Mail.Read.Shared`, `Mail.ReadWrite.Shared`) and an
   * Exchange permission on that mailbox. Graph cannot list the mailboxes a user may open, so the address
   * must be known.
   *
   * @see https://learn.microsoft.com/en-us/graph/outlook-share-messages-folders
   */
  readonly mailbox?: Maybe<EmailAddress>;
  /**
   * Whether to ask for immutable ids (`Prefer: IdType="ImmutableId"`), which survive a move to another
   * folder. Defaults to true.
   *
   * @see https://learn.microsoft.com/en-us/graph/outlook-immutable-id
   */
  readonly immutableIds?: Maybe<boolean>;
}

/**
 * A GET the mail helpers build: the path, query and headers, ready for `microsoftGraphRequest` or
 * `microsoftGraphRequestAllPages`.
 */
export interface MicrosoftGraphMailRequest {
  readonly path: string;
  readonly query: MicrosoftGraphQuery;
  readonly headers: Maybe<MicrosoftGraphHeaders>;
}

/**
 * Returns the root path of a mailbox: `/me`, or `/users/{address}` for another mailbox.
 *
 * @param mailbox - The mailbox address, if not the signed-in user's own.
 * @returns The root path.
 */
export function microsoftGraphMailboxPath(mailbox: Maybe<EmailAddress>): string {
  return mailbox ? `/users/${encodeURIComponent(mailbox)}` : '/me';
}

/**
 * Returns the messages collection path of a mailbox, optionally limited to one folder.
 *
 * @param input - The mailbox and folder.
 * @param input.mailbox - The mailbox address, if not the signed-in user's own.
 * @param input.folder - A mail folder id or well-known name (`inbox`, `sentitems`, `deleteditems`).
 * @returns The collection path.
 */
export function microsoftGraphMessagesPath(input: { readonly mailbox?: Maybe<EmailAddress>; readonly folder?: Maybe<string> }): string {
  const root = microsoftGraphMailboxPath(input.mailbox);
  return input.folder ? `${root}/mailFolders/${encodeURIComponent(input.folder)}/messages` : `${root}/messages`;
}

/**
 * Returns the path of one message.
 *
 * @param input - The mailbox and message id.
 * @param input.mailbox - The mailbox address, if not the signed-in user's own.
 * @param input.id - The message id.
 * @returns The message path.
 */
export function microsoftGraphMessagePath(input: { readonly mailbox?: Maybe<EmailAddress>; readonly id: string }): string {
  return `${microsoftGraphMailboxPath(input.mailbox)}/messages/${encodeURIComponent(input.id)}`;
}

/**
 * Builds the `Prefer` header a mail call sends: immutable ids unless turned off, and the body format when given.
 *
 * @param input - The id type and body format.
 * @param input.immutableIds - Whether to ask for immutable ids. Defaults to true.
 * @param input.format - The body format to ask for.
 * @returns The headers, or undefined when there is nothing to prefer.
 */
export function microsoftGraphMailHeaders(input: { readonly immutableIds?: Maybe<boolean>; readonly format?: Maybe<MicrosoftGraphBodyContentType> }): Maybe<MicrosoftGraphHeaders> {
  const prefer = microsoftGraphPreferHeaderValue([input.immutableIds === false ? undefined : MICROSOFT_GRAPH_IMMUTABLE_ID_PREFER, input.format ? microsoftGraphBodyContentTypePrefer(input.format) : undefined]);
  return prefer ? { Prefer: prefer } : undefined;
}

/**
 * Formats an instant as an OData `DateTimeOffset` literal (`2026-01-01T00:00:00Z`), without milliseconds.
 *
 * @param date - The instant.
 * @returns The literal.
 * @throws {Error} When the date is invalid.
 */
export function microsoftGraphDateTimeLiteral(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Invalid date.');
  }

  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Escapes a value for an OData string literal: a single quote is doubled.
 *
 * @param value - The raw value.
 * @returns The value, quoted.
 */
export function microsoftGraphODataStringLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/**
 * The `mail list` filters. Every one is optional; together they are and-ed.
 */
export interface MicrosoftGraphMessageListFilterInput {
  /**
   * Received at or after this instant.
   */
  readonly since?: Maybe<Date>;
  /**
   * Received before this instant.
   */
  readonly until?: Maybe<Date>;
  /**
   * The sender's address.
   */
  readonly from?: Maybe<EmailAddress>;
  /**
   * Only unread messages.
   */
  readonly unread?: Maybe<boolean>;
  /**
   * Only messages with file attachments.
   */
  readonly hasAttachments?: Maybe<boolean>;
}

/**
 * Builds the `$filter` for a message list ordered by `receivedDateTime desc`.
 *
 * `receivedDateTime` always comes first, because Outlook answers `InefficientFilter` when the `$orderby`
 * property does not lead the `$filter`. A filter with no date bound gets {@link MICROSOFT_GRAPH_MESSAGE_FILTER_EARLIEST}
 * as its lower bound for that reason.
 *
 * @param input - The filters.
 * @returns The `$filter`, or undefined when no filter is set.
 *
 * @example
 * ```ts
 * microsoftGraphMessageListFilter({ from: 'ada@example.com', unread: true });
 * // "receivedDateTime ge 1900-01-01T00:00:00Z and from/emailAddress/address eq 'ada@example.com' and isRead eq false"
 * ```
 *
 * @see https://learn.microsoft.com/en-us/graph/api/user-list-messages#using-filter-and-orderby-in-the-same-query
 */
export function microsoftGraphMessageListFilter(input: MicrosoftGraphMessageListFilterInput): Maybe<string> {
  const others: string[] = [];

  if (input.from) {
    others.push(`from/emailAddress/address eq ${microsoftGraphODataStringLiteral(input.from)}`);
  }

  if (input.unread) {
    others.push('isRead eq false');
  }

  if (input.hasAttachments) {
    others.push('hasAttachments eq true');
  }

  const dates: string[] = [];

  if (input.since) {
    dates.push(`receivedDateTime ge ${microsoftGraphDateTimeLiteral(input.since)}`);
  }

  if (input.until) {
    dates.push(`receivedDateTime lt ${microsoftGraphDateTimeLiteral(input.until)}`);
  }

  if (dates.length === 0 && others.length > 0) {
    dates.push(`receivedDateTime ge ${MICROSOFT_GRAPH_MESSAGE_FILTER_EARLIEST}`);
  }

  const terms = [...dates, ...others];
  return terms.length > 0 ? terms.join(' and ') : undefined;
}

// MARK: List
export interface MicrosoftGraphListMessagesInput extends MicrosoftGraphMailboxInput, MicrosoftGraphMessageListFilterInput {
  /**
   * A mail folder id or well-known name (`inbox`, `sentitems`). Every folder when absent.
   */
  readonly folder?: Maybe<string>;
  /**
   * Comma-separated fields to select. Defaults to {@link MICROSOFT_GRAPH_MESSAGE_SELECT}.
   */
  readonly select?: Maybe<string>;
  /**
   * The page size. Defaults to {@link DEFAULT_MICROSOFT_GRAPH_MESSAGE_PAGE_SIZE}.
   */
  readonly top?: Maybe<number>;
}

/**
 * Builds the GET for a message list, newest first (`$orderby=receivedDateTime desc`).
 *
 * @param input - The mailbox, folder, filters and fields.
 * @returns The request.
 */
export function microsoftGraphListMessagesRequest(input: MicrosoftGraphListMessagesInput): MicrosoftGraphMailRequest {
  return {
    path: microsoftGraphMessagesPath(input),
    query: {
      $filter: microsoftGraphMessageListFilter(input),
      $orderby: 'receivedDateTime desc',
      $top: input.top ?? DEFAULT_MICROSOFT_GRAPH_MESSAGE_PAGE_SIZE,
      $select: input.select ?? MICROSOFT_GRAPH_MESSAGE_SELECT
    },
    headers: microsoftGraphMailHeaders(input)
  };
}

/**
 * Lists messages newest first, filtered by date, sender, read state and attachments. Requires `Mail.Read`
 * (`Mail.Read.Shared` for another mailbox).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that resolves the first page; follow `@odata.nextLink` for more.
 */
export function listMessages(context: MicrosoftGraphContext): (input: MicrosoftGraphListMessagesInput) => Promise<MicrosoftGraphPage<MicrosoftGraphMessage>> {
  const request = microsoftGraphRequest(context);
  return (input) => request({ method: 'GET', ...microsoftGraphListMessagesRequest(input) });
}

// MARK: Search
export interface MicrosoftGraphSearchMessagesInput extends MicrosoftGraphMailboxInput {
  /**
   * The KQL search query, e.g. `from:ada subject:invoice`.
   */
  readonly query: string;
  readonly top?: Maybe<number>;
  /**
   * A mail folder id or well-known name (`inbox`, `sentitems`). Searches every folder when absent.
   */
  readonly folder?: Maybe<string>;
  /**
   * Comma-separated fields to select. Defaults to {@link MICROSOFT_GRAPH_MESSAGE_SELECT}.
   */
  readonly select?: Maybe<string>;
}

/**
 * Builds the GET for a `$search`. The query is double-quoted, with embedded double quotes escaped.
 *
 * `$search` cannot be combined with `$filter`, and results come back by relevance; use KQL terms
 * (`received>=2026-01-01`, `from:ada`) to narrow a search, or {@link microsoftGraphListMessagesRequest} to filter.
 *
 * @param input - The query, mailbox, folder and fields.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/search-query-parameter#using-search-on-message-collections
 */
export function microsoftGraphSearchMessagesRequest(input: MicrosoftGraphSearchMessagesInput): MicrosoftGraphMailRequest {
  const escapedQuery = input.query.replaceAll('"', String.raw`\"`);

  return {
    path: microsoftGraphMessagesPath(input),
    query: { $search: `"${escapedQuery}"`, $top: input.top ?? DEFAULT_MICROSOFT_GRAPH_MESSAGE_PAGE_SIZE, $select: input.select ?? MICROSOFT_GRAPH_MESSAGE_SELECT },
    headers: microsoftGraphMailHeaders(input)
  };
}

/**
 * Searches the user's messages (`$search`). Requires `Mail.Read` (`Mail.Read.Shared` for another mailbox).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that searches the mailbox and resolves the first page of matches.
 */
export function searchMessages(context: MicrosoftGraphContext): (input: MicrosoftGraphSearchMessagesInput) => Promise<MicrosoftGraphPage<MicrosoftGraphMessage>> {
  const request = microsoftGraphRequest(context);
  return (input) => request({ method: 'GET', ...microsoftGraphSearchMessagesRequest(input) });
}

// MARK: Get
export interface MicrosoftGraphGetMessageInput extends MicrosoftGraphMailboxInput {
  readonly id: string;
  /**
   * The body format to return. Defaults to `text`.
   */
  readonly format?: Maybe<MicrosoftGraphBodyContentType>;
  /**
   * Comma-separated fields to select. Defaults to {@link MICROSOFT_GRAPH_MESSAGE_SELECT} plus `body`.
   */
  readonly select?: Maybe<string>;
}

/**
 * Builds the GET for one message with its body.
 *
 * @param input - The message id, mailbox, body format and fields.
 * @returns The request.
 */
export function microsoftGraphGetMessageRequest(input: MicrosoftGraphGetMessageInput): MicrosoftGraphMailRequest {
  return {
    path: microsoftGraphMessagePath(input),
    query: { $select: input.select ?? `${MICROSOFT_GRAPH_MESSAGE_SELECT},body` },
    headers: microsoftGraphMailHeaders({ immutableIds: input.immutableIds, format: input.format ?? 'text' })
  };
}

/**
 * Reads one message with its body. Requires `Mail.Read` (`Mail.Read.Shared` for another mailbox).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that loads one message by id.
 */
export function getMessage(context: MicrosoftGraphContext): (input: MicrosoftGraphGetMessageInput) => Promise<MicrosoftGraphMessage> {
  const request = microsoftGraphRequest(context);
  return (input) => request({ method: 'GET', ...microsoftGraphGetMessageRequest(input) });
}

export interface MicrosoftGraphGetMessageMimeInput extends Pick<MicrosoftGraphMailboxInput, 'mailbox'> {
  readonly id: string;
}

/**
 * Reads one message's MIME content (`/$value`) through the raw path; the JSON client cannot represent it.
 * Requires `Mail.Read` (`Mail.Read.Shared` for another mailbox).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that resolves the raw response; its body is the RFC 822 message.
 *
 * @see https://learn.microsoft.com/en-us/graph/outlook-get-mime-message
 */
export function getMessageMime(context: MicrosoftGraphContext): (input: MicrosoftGraphGetMessageMimeInput) => Promise<MicrosoftGraphRawResponse> {
  const requestRaw = microsoftGraphRequestRaw(context);
  return (input) => requestRaw({ method: 'GET', path: `${microsoftGraphMessagePath(input)}/$value` });
}

// MARK: Get Many
export interface MicrosoftGraphGetMessagesInput extends Omit<MicrosoftGraphGetMessageInput, 'id'> {
  readonly ids: readonly string[];
  /**
   * Waits between `$batch` retries of throttled items. Defaults to a real timer; a spec passes a fake.
   */
  readonly wait?: Maybe<(ms: number) => Promise<unknown>>;
}

/**
 * One message read by {@link getMessages}: the message, or the error Graph answered for its id.
 */
export interface MicrosoftGraphGetMessagesItem {
  /**
   * The id that was asked for.
   */
  readonly id: string;
  readonly status: number;
  readonly message?: Maybe<MicrosoftGraphMessage>;
  readonly error?: Maybe<MicrosoftGraphErrorData>;
}

/**
 * Reads several messages through `$batch` (20 GETs per HTTP call), in the order the ids were given. One
 * id's failure (a 404, a 403) does not fail the others; throttled items are re-sent after `Retry-After`.
 * Requires `Mail.Read` (`Mail.Read.Shared` for another mailbox).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that resolves one item per id, in order.
 *
 * @see https://learn.microsoft.com/en-us/graph/json-batching
 */
export function getMessages(context: MicrosoftGraphContext): (input: MicrosoftGraphGetMessagesInput) => Promise<MicrosoftGraphGetMessagesItem[]> {
  const batch = microsoftGraphBatch(context);

  return async (input) => {
    const requests = input.ids.map((id, index) => {
      const { path, query, headers } = microsoftGraphGetMessageRequest({ ...input, id });
      return { id: String(index), method: 'GET' as const, url: microsoftGraphPathWithQuery(path, query), headers };
    });

    const { responses } = await batch<MicrosoftGraphMessage | { readonly error?: MicrosoftGraphErrorData }>({ requests, wait: input.wait });

    return responses.map((response, index) => {
      const id = input.ids[index];
      const ok = response.status >= 200 && response.status < 300;
      const body = response.body;
      let result: MicrosoftGraphGetMessagesItem;

      if (ok) {
        result = { id, status: response.status, message: body as MicrosoftGraphMessage };
      } else {
        result = { id, status: response.status, error: (body as Maybe<{ readonly error?: MicrosoftGraphErrorData }>)?.error ?? { code: 'BatchItemFailed' } };
      }

      return result;
    });
  };
}
