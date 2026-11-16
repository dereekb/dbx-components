import { type ISO8601DateString, type Maybe } from '@dereekb/util';
import { type MicrosoftGraphRequestInput } from './graph.api';
import { type MicrosoftGraphChatMessageFrom, MICROSOFT_GRAPH_CHANNEL_MESSAGE_READ_SCOPE } from './graph.teams.api';
import { type MicrosoftGraphEmailAddress } from './graph.type';

/**
 * The Microsoft Search endpoint.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/search-query
 */
export const MICROSOFT_GRAPH_SEARCH_QUERY_PATH = '/search/query';

/**
 * The most results one search request returns. Graph documents 25 as the page maximum for `message` and `event`,
 * and 25 is its default page size; it states no other limit for `chatMessage`, so this package asks for no more.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/search-api-overview
 */
export const MICROSOFT_GRAPH_CHAT_MESSAGE_SEARCH_MAX_SIZE = 25;

/**
 * The most results Graph pages through for one query (`from` + `size`).
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/search-api-overview
 */
export const MICROSOFT_GRAPH_SEARCH_MAX_RESULTS = 1000;

/**
 * The admin-consent scope a Teams message search needs on top of `Chat.Read` / `Chat.ReadWrite`, even when it only
 * returns 1:1 and group chat messages. Live (2026-11-14), a Read + Write token holding `Chat.Read` and
 * `Chat.ReadWrite` was refused with 403: "Access to ChatMessage in Graph API requires the following permissions:
 * Chat.Read or Chat.ReadWrite, ChannelMessage.Read.All".
 */
export const MICROSOFT_GRAPH_CHAT_MESSAGE_SEARCH_ADMIN_SCOPE = MICROSOFT_GRAPH_CHANNEL_MESSAGE_READ_SCOPE;

export type MicrosoftGraphSearchEntityType = 'chatMessage' | 'message' | 'event' | 'drive' | 'driveItem' | 'list' | 'listItem' | 'site' | 'externalItem';

/**
 * Input to {@link microsoftGraphChatMessageSearchRequest}.
 */
export interface MicrosoftGraphChatMessageSearchInput {
  /**
   * KQL, e.g. `budget from:bob sent>2026-11-01`. Teams messages take `from`, `to`, `hasAttachment`, `IsRead`,
   * `IsMentioned`, `mentions` and `sent`.
   */
  readonly queryString: string;
  /**
   * The 0-based offset of the first result.
   */
  readonly from?: Maybe<number>;
  /**
   * Results per page, at most {@link MICROSOFT_GRAPH_CHAT_MESSAGE_SEARCH_MAX_SIZE}.
   */
  readonly size?: Maybe<number>;
}

/**
 * Builds the POST that searches the signed-in user's Teams messages (1:1, group, meeting and channel messages they
 * can see). Delegated only: needs `Chat.Read` (or `Chat.ReadWrite`) and
 * {@link MICROSOFT_GRAPH_CHAT_MESSAGE_SEARCH_ADMIN_SCOPE}, which only a tenant admin can consent to. Results come
 * by relevance; Graph cannot sort them, and `chatMessage` cannot be combined with another entity type.
 *
 * @param input - The KQL query, offset and page size.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/search-concept-chat-messages
 */
export function microsoftGraphChatMessageSearchRequest(input: MicrosoftGraphChatMessageSearchInput): MicrosoftGraphRequestInput {
  const size = Math.max(1, Math.min(input.size ?? MICROSOFT_GRAPH_CHAT_MESSAGE_SEARCH_MAX_SIZE, MICROSOFT_GRAPH_CHAT_MESSAGE_SEARCH_MAX_SIZE));
  return { method: 'POST', path: MICROSOFT_GRAPH_SEARCH_QUERY_PATH, body: { requests: [{ entityTypes: ['chatMessage'], query: { queryString: input.queryString }, from: Math.max(0, input.from ?? 0), size }] } };
}

/**
 * The `resource` of a `chatMessage` search hit: a subset of the message, without its body (the hit's `summary`
 * carries a snippet). Graph's examples show `from.emailAddress` and `webLink`, while its schema names a
 * `chatMessageFromIdentitySet` and `webUrl`, so both are typed.
 */
export interface MicrosoftGraphChatMessageSearchResource {
  readonly '@odata.type'?: Maybe<string>;
  readonly id?: Maybe<string>;
  readonly chatId?: Maybe<string>;
  readonly channelIdentity?: Maybe<{ readonly teamId?: Maybe<string>; readonly channelId?: Maybe<string> }>;
  readonly createdDateTime?: Maybe<ISO8601DateString>;
  readonly lastModifiedDateTime?: Maybe<ISO8601DateString>;
  readonly subject?: Maybe<string>;
  readonly importance?: Maybe<string>;
  readonly replyToId?: Maybe<string>;
  readonly etag?: Maybe<string>;
  readonly webLink?: Maybe<string>;
  readonly webUrl?: Maybe<string>;
  readonly from?: Maybe<MicrosoftGraphChatMessageFrom & { readonly emailAddress?: Maybe<MicrosoftGraphEmailAddress> }>;
}

/**
 * One search hit. `summary` is a snippet with the matched terms wrapped in `<c0>…</c0>` and cuts marked `<ddd/>`.
 */
export interface MicrosoftGraphSearchHit<T> {
  readonly hitId?: Maybe<string>;
  readonly rank?: Maybe<number>;
  readonly summary?: Maybe<string>;
  readonly resource?: Maybe<T>;
}

/**
 * A page of hits for one entity type. `total` is the number of hits on this page, not of every match.
 */
export interface MicrosoftGraphSearchHitsContainer<T> {
  readonly hits?: Maybe<MicrosoftGraphSearchHit<T>[]>;
  readonly total?: Maybe<number>;
  readonly moreResultsAvailable?: Maybe<boolean>;
}

/**
 * The response of {@link MICROSOFT_GRAPH_SEARCH_QUERY_PATH}: one result per request sent.
 */
export interface MicrosoftGraphSearchResponse<T> {
  readonly value?: Maybe<{ readonly searchTerms?: Maybe<string[]>; readonly hitsContainers?: Maybe<MicrosoftGraphSearchHitsContainer<T>[]> }[]>;
}

/**
 * The hits of a search response's first request, from every hits container, and whether Graph has more.
 */
export interface MicrosoftGraphSearchResponsePage<T> {
  readonly hits: MicrosoftGraphSearchHit<T>[];
  readonly moreResultsAvailable: boolean;
}

/**
 * Reads the hits of a search response's first request.
 *
 * @param response - The response.
 * @returns The hits, in rank order, and whether more are available.
 */
export function readMicrosoftGraphSearchResponsePage<T>(response: Maybe<MicrosoftGraphSearchResponse<T>>): MicrosoftGraphSearchResponsePage<T> {
  const containers = response?.value?.[0]?.hitsContainers ?? [];
  return { hits: containers.flatMap((x) => x.hits ?? []), moreResultsAvailable: containers.some((x) => x.moreResultsAvailable === true) };
}

/**
 * Turns a search hit's `summary` into plain text: the `<c0>` highlight tags are dropped and each `<ddd/>` cut becomes
 * an ellipsis.
 *
 * @param summary - The hit's summary.
 * @returns The text, trimmed; empty when there is none.
 */
export function microsoftGraphSearchSummaryText(summary: Maybe<string>): string {
  return (summary ?? '')
    .replaceAll(/<ddd\s*\/>/gi, '…')
    .replaceAll(/<\/?c\d+>/gi, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}
