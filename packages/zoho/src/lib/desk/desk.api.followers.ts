import { type Maybe, type ArrayOrValue, asArray } from '@dereekb/util';
import { type FetchJsonBody, type FetchJsonInput } from '@dereekb/util/fetch';
import { type ZohoDeskContext } from './desk.config';
import { type ZohoDeskTicketId, type ZohoDeskAgentId } from './desk';
import { type ZohoDeskTicketFollower } from './desk.ticket';

// MARK: Utility
function zohoDeskFollowerApiFetchJsonInput(method: string, body?: Maybe<FetchJsonBody>): FetchJsonInput {
  return { method, body: body ?? undefined };
}

// MARK: Get Ticket Followers
/**
 * Input parameters for listing followers of a ticket via `GET /tickets/{ticketId}/followers`.
 */
export interface ZohoDeskGetTicketFollowersInput {
  readonly ticketId: ZohoDeskTicketId;
}

/**
 * Function that retrieves followers for a specific ticket.
 */
export type ZohoDeskGetTicketFollowersFunction = (input: ZohoDeskGetTicketFollowersInput) => Promise<ZohoDeskTicketFollower[]>;

/**
 * Creates a {@link ZohoDeskGetTicketFollowersFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves followers for a ticket
 */
export function zohoDeskGetTicketFollowers(context: ZohoDeskContext): ZohoDeskGetTicketFollowersFunction {
  return (input: ZohoDeskGetTicketFollowersInput) => context.fetchJson<ZohoDeskTicketFollower[]>(`/tickets/${input.ticketId}/followers`, zohoDeskFollowerApiFetchJsonInput('GET')).then((x) => x ?? []);
}

// MARK: Add Ticket Followers
/**
 * Input parameters for adding followers to a ticket via `POST /tickets/{ticketId}/followers`.
 */
export interface ZohoDeskAddTicketFollowersInput {
  readonly ticketId: ZohoDeskTicketId;
  readonly agentIds: ArrayOrValue<ZohoDeskAgentId>;
}

/**
 * Function that adds followers to a ticket.
 */
export type ZohoDeskAddTicketFollowersFunction = (input: ZohoDeskAddTicketFollowersInput) => Promise<void>;

/**
 * Creates a {@link ZohoDeskAddTicketFollowersFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that adds followers to a ticket
 */
export function zohoDeskAddTicketFollowers(context: ZohoDeskContext): ZohoDeskAddTicketFollowersFunction {
  return (input: ZohoDeskAddTicketFollowersInput) => {
    const body = { ids: asArray(input.agentIds) };
    return context.fetchJson<void>(`/tickets/${input.ticketId}/followers`, zohoDeskFollowerApiFetchJsonInput('POST', body));
  };
}

// MARK: Remove Ticket Followers
/**
 * Input parameters for removing followers from a ticket via `DELETE /tickets/{ticketId}/followers`.
 */
export interface ZohoDeskRemoveTicketFollowersInput {
  readonly ticketId: ZohoDeskTicketId;
  readonly agentIds: ArrayOrValue<ZohoDeskAgentId>;
}

/**
 * Function that removes followers from a ticket.
 */
export type ZohoDeskRemoveTicketFollowersFunction = (input: ZohoDeskRemoveTicketFollowersInput) => Promise<void>;

/**
 * Creates a {@link ZohoDeskRemoveTicketFollowersFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that removes followers from a ticket
 */
export function zohoDeskRemoveTicketFollowers(context: ZohoDeskContext): ZohoDeskRemoveTicketFollowersFunction {
  return (input: ZohoDeskRemoveTicketFollowersInput) => {
    const body = { ids: asArray(input.agentIds) };
    return context.fetchJson<void>(`/tickets/${input.ticketId}/followers`, zohoDeskFollowerApiFetchJsonInput('DELETE', body));
  };
}
