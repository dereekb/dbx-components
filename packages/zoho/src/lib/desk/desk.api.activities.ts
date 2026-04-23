import { type Maybe, type ArrayOrValue, asArray, joinStringsWithCommas } from '@dereekb/util';
import { type FetchJsonInput, type FetchPage, type FetchPageFactoryOptions, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoDeskContext } from './desk.config';
import { type ZohoDeskTicketId } from './desk';
import { type ZohoDeskTicketActivity, type ZohoDeskActivityInclude } from './desk.ticket';
import { type ZohoDeskPageFilter, type ZohoDeskPageResult, zohoDeskFetchPageFactory } from './desk.api.page';

// MARK: Utility
function zohoDeskActivityApiFetchJsonInput(method: string): FetchJsonInput {
  return { method };
}

function joinActivityInclude(include: Maybe<ArrayOrValue<string>>): Maybe<string> {
  let result: Maybe<string>;

  if (include) {
    result = joinStringsWithCommas(asArray(include));
  }

  return result;
}

// MARK: List Ticket Activities
/**
 * Input parameters for listing activities on a ticket via `GET /tickets/{ticketId}/activities`.
 */
export interface ZohoDeskGetTicketActivitiesInput extends ZohoDeskPageFilter {
  readonly ticketId: ZohoDeskTicketId;
  readonly include?: ArrayOrValue<ZohoDeskActivityInclude>;
  readonly isSpam?: boolean;
  readonly isCompleted?: boolean;
}

/**
 * Response from listing ticket activities.
 */
export type ZohoDeskGetTicketActivitiesResponse = ZohoDeskPageResult<ZohoDeskTicketActivity>;

/**
 * Function that retrieves activities for a specific ticket.
 */
export type ZohoDeskGetTicketActivitiesFunction = (input: ZohoDeskGetTicketActivitiesInput) => Promise<ZohoDeskGetTicketActivitiesResponse>;

/**
 * Creates a {@link ZohoDeskGetTicketActivitiesFunction} bound to the given context.
 *
 * Retrieves a paginated list of activities (tasks, events, calls) associated with a ticket.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves activities for a ticket
 */
export function zohoDeskGetTicketActivities(context: ZohoDeskContext): ZohoDeskGetTicketActivitiesFunction {
  return (input: ZohoDeskGetTicketActivitiesInput) => {
    const { ticketId, include, ...rest } = input;
    const params = makeUrlSearchParams([{ ...rest, include: joinActivityInclude(include) }]);
    return context.fetchJson<ZohoDeskGetTicketActivitiesResponse>(`/tickets/${ticketId}/activities?${params}`, zohoDeskActivityApiFetchJsonInput('GET')).then((x) => x ?? { data: [] });
  };
}

// MARK: Page Factory
/**
 * Factory that creates paginated iterators for ticket activity queries.
 */
export type ZohoDeskGetTicketActivitiesPageFactory = (input: ZohoDeskGetTicketActivitiesInput, options?: Maybe<FetchPageFactoryOptions<ZohoDeskGetTicketActivitiesInput, ZohoDeskGetTicketActivitiesResponse>>) => FetchPage<ZohoDeskGetTicketActivitiesInput, ZohoDeskGetTicketActivitiesResponse>;

/**
 * Creates a {@link ZohoDeskGetTicketActivitiesPageFactory} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Page factory for iterating over activity results
 */
export function zohoDeskGetTicketActivitiesPageFactory(context: ZohoDeskContext): ZohoDeskGetTicketActivitiesPageFactory {
  return zohoDeskFetchPageFactory(zohoDeskGetTicketActivities(context));
}
