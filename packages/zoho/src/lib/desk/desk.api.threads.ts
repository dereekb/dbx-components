import { type Maybe, type ArrayOrValue, asArray, joinStringsWithCommas } from '@dereekb/util';
import { type FetchJsonInput, type FetchPage, type FetchPageFactoryOptions, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoDeskContext } from './desk.config';
import { type ZohoDeskTicketId } from './desk';
import { type ZohoDeskTicketThread, type ZohoDeskThreadInclude } from './desk.ticket';
import { type ZohoDeskPageFilter, type ZohoDeskPageResult, zohoDeskFetchPageFactory } from './desk.api.page';

// MARK: Utility
function zohoDeskThreadApiFetchJsonInput(method: string): FetchJsonInput {
  return { method };
}

function joinThreadInclude(include: Maybe<ArrayOrValue<string>>): Maybe<string> {
  let result: Maybe<string>;

  if (include) {
    result = joinStringsWithCommas(asArray(include));
  }

  return result;
}

// MARK: List Ticket Threads
/**
 * Input parameters for listing threads on a ticket via `GET /tickets/{ticketId}/threads`.
 */
export interface ZohoDeskGetTicketThreadsInput extends ZohoDeskPageFilter {
  readonly ticketId: ZohoDeskTicketId;
  readonly include?: ArrayOrValue<ZohoDeskThreadInclude>;
}

/**
 * Response from listing ticket threads.
 */
export type ZohoDeskGetTicketThreadsResponse = ZohoDeskPageResult<ZohoDeskTicketThread>;

/**
 * Function that retrieves threads for a specific ticket.
 */
export type ZohoDeskGetTicketThreadsFunction = (input: ZohoDeskGetTicketThreadsInput) => Promise<ZohoDeskGetTicketThreadsResponse>;

/**
 * Creates a {@link ZohoDeskGetTicketThreadsFunction} bound to the given context.
 *
 * Retrieves a paginated list of conversation threads (emails, replies, notes) for a ticket.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves threads for a ticket
 */
export function zohoDeskGetTicketThreads(context: ZohoDeskContext): ZohoDeskGetTicketThreadsFunction {
  return (input: ZohoDeskGetTicketThreadsInput) => {
    const { ticketId, include, ...rest } = input;
    const params = makeUrlSearchParams([{ ...rest, include: joinThreadInclude(include) }]);
    return context.fetchJson<ZohoDeskGetTicketThreadsResponse>(`/tickets/${ticketId}/threads?${params}`, zohoDeskThreadApiFetchJsonInput('GET')).then((x) => x ?? { data: [] });
  };
}

// MARK: Get Thread By ID
/**
 * Input parameters for retrieving a single thread via `GET /tickets/{ticketId}/threads/{threadId}`.
 */
export interface ZohoDeskGetTicketThreadByIdInput {
  readonly ticketId: ZohoDeskTicketId;
  readonly threadId: string;
  readonly include?: ArrayOrValue<ZohoDeskThreadInclude>;
}

/**
 * Function that retrieves a single thread by ID.
 */
export type ZohoDeskGetTicketThreadByIdFunction = (input: ZohoDeskGetTicketThreadByIdInput) => Promise<ZohoDeskTicketThread>;

/**
 * Creates a {@link ZohoDeskGetTicketThreadByIdFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves a single thread
 */
export function zohoDeskGetTicketThreadById(context: ZohoDeskContext): ZohoDeskGetTicketThreadByIdFunction {
  return (input: ZohoDeskGetTicketThreadByIdInput) => {
    const { ticketId, threadId, include } = input;
    const params = makeUrlSearchParams([{ include: joinThreadInclude(include) }]);
    const queryString = params.toString();
    return context.fetchJson<ZohoDeskTicketThread>(`/tickets/${ticketId}/threads/${threadId}${queryString ? `?${queryString}` : ''}`, zohoDeskThreadApiFetchJsonInput('GET'));
  };
}

// MARK: Page Factory
/**
 * Factory that creates paginated iterators for ticket thread queries.
 */
export type ZohoDeskGetTicketThreadsPageFactory = (input: ZohoDeskGetTicketThreadsInput, options?: Maybe<FetchPageFactoryOptions<ZohoDeskGetTicketThreadsInput, ZohoDeskGetTicketThreadsResponse>>) => FetchPage<ZohoDeskGetTicketThreadsInput, ZohoDeskGetTicketThreadsResponse>;

/**
 * Creates a {@link ZohoDeskGetTicketThreadsPageFactory} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Page factory for iterating over thread results
 */
export function zohoDeskGetTicketThreadsPageFactory(context: ZohoDeskContext): ZohoDeskGetTicketThreadsPageFactory {
  return zohoDeskFetchPageFactory(zohoDeskGetTicketThreads(context));
}
