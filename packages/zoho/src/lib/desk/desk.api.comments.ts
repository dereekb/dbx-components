import { type Maybe, type ArrayOrValue, asArray, joinStringsWithCommas } from '@dereekb/util';
import { type FetchJsonBody, type FetchJsonInput, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoDeskContext } from './desk.config';
import { type ZohoDeskTicketId } from './desk';
import { type ZohoDeskTicketComment, type ZohoDeskCommentSortBy, type ZohoDeskCommentInclude, type ZohoDeskCommentContentType } from './desk.ticket';
import { type ZohoDeskPageFilter, type ZohoDeskPageResult } from './desk.api.page';

// MARK: Utility
function zohoDeskCommentApiFetchJsonInput(method: string, body?: Maybe<FetchJsonBody>): FetchJsonInput {
  return { method, body: body ?? undefined };
}

function joinCommentInclude(include: Maybe<ArrayOrValue<string>>): Maybe<string> {
  let result: Maybe<string>;

  if (include) {
    result = joinStringsWithCommas(asArray(include));
  }

  return result;
}

// MARK: List Ticket Comments
/**
 * Input parameters for listing comments on a ticket via `GET /tickets/{ticketId}/comments`.
 */
export interface ZohoDeskGetTicketCommentsInput extends ZohoDeskPageFilter {
  readonly ticketId: ZohoDeskTicketId;
  readonly sortBy?: ZohoDeskCommentSortBy;
  readonly include?: ArrayOrValue<ZohoDeskCommentInclude>;
}

/**
 * Response from listing ticket comments.
 */
export type ZohoDeskGetTicketCommentsResponse = ZohoDeskPageResult<ZohoDeskTicketComment>;

/**
 * Function that retrieves comments for a specific ticket.
 */
export type ZohoDeskGetTicketCommentsFunction = (input: ZohoDeskGetTicketCommentsInput) => Promise<ZohoDeskGetTicketCommentsResponse>;

/**
 * Creates a {@link ZohoDeskGetTicketCommentsFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves comments for a ticket
 */
export function zohoDeskGetTicketComments(context: ZohoDeskContext): ZohoDeskGetTicketCommentsFunction {
  return (input: ZohoDeskGetTicketCommentsInput) => {
    const { ticketId, include, ...rest } = input;
    const params = makeUrlSearchParams([{ ...rest, include: joinCommentInclude(include) }]);
    return context.fetchJson<ZohoDeskGetTicketCommentsResponse>(`/tickets/${ticketId}/comments?${params}`, zohoDeskCommentApiFetchJsonInput('GET')).then((x) => x ?? { data: [] });
  };
}

// MARK: Get Ticket Comment By ID
/**
 * Input parameters for retrieving a single comment via `GET /tickets/{ticketId}/comments/{commentId}`.
 */
export interface ZohoDeskGetTicketCommentByIdInput {
  readonly ticketId: ZohoDeskTicketId;
  readonly commentId: string;
  readonly include?: ArrayOrValue<ZohoDeskCommentInclude>;
}

/**
 * Function that retrieves a single comment by ID.
 */
export type ZohoDeskGetTicketCommentByIdFunction = (input: ZohoDeskGetTicketCommentByIdInput) => Promise<ZohoDeskTicketComment>;

/**
 * Creates a {@link ZohoDeskGetTicketCommentByIdFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves a single comment
 */
export function zohoDeskGetTicketCommentById(context: ZohoDeskContext): ZohoDeskGetTicketCommentByIdFunction {
  return (input: ZohoDeskGetTicketCommentByIdInput) => {
    const { ticketId, commentId, include } = input;
    const params = makeUrlSearchParams([{ include: joinCommentInclude(include) }]);
    const queryString = params.toString();
    return context.fetchJson<ZohoDeskTicketComment>(`/tickets/${ticketId}/comments/${commentId}${queryString ? `?${queryString}` : ''}`, zohoDeskCommentApiFetchJsonInput('GET'));
  };
}

// MARK: Create Ticket Comment
/**
 * Input parameters for creating a comment on a ticket via `POST /tickets/{ticketId}/comments`.
 */
export interface ZohoDeskCreateTicketCommentInput {
  readonly ticketId: ZohoDeskTicketId;
  readonly content: string;
  readonly isPublic?: boolean;
  readonly contentType?: ZohoDeskCommentContentType;
  readonly attachmentIds?: string[];
}

/**
 * Function that creates a comment on a ticket.
 */
export type ZohoDeskCreateTicketCommentFunction = (input: ZohoDeskCreateTicketCommentInput) => Promise<ZohoDeskTicketComment>;

/**
 * Creates a {@link ZohoDeskCreateTicketCommentFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that creates a comment on a ticket
 */
export function zohoDeskCreateTicketComment(context: ZohoDeskContext): ZohoDeskCreateTicketCommentFunction {
  return (input: ZohoDeskCreateTicketCommentInput) => {
    const { ticketId, ...body } = input;
    return context.fetchJson<ZohoDeskTicketComment>(`/tickets/${ticketId}/comments`, zohoDeskCommentApiFetchJsonInput('POST', body));
  };
}

// MARK: Delete Ticket Comment
/**
 * Input parameters for deleting a comment from a ticket via `DELETE /tickets/{ticketId}/comments/{commentId}`.
 */
export interface ZohoDeskDeleteTicketCommentInput {
  readonly ticketId: ZohoDeskTicketId;
  readonly commentId: string;
}

/**
 * Function that deletes a comment from a ticket.
 */
export type ZohoDeskDeleteTicketCommentFunction = (input: ZohoDeskDeleteTicketCommentInput) => Promise<void>;

/**
 * Creates a {@link ZohoDeskDeleteTicketCommentFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that deletes a comment from a ticket
 */
export function zohoDeskDeleteTicketComment(context: ZohoDeskContext): ZohoDeskDeleteTicketCommentFunction {
  return (input: ZohoDeskDeleteTicketCommentInput) => context.fetchJson<void>(`/tickets/${input.ticketId}/comments/${input.commentId}`, zohoDeskCommentApiFetchJsonInput('DELETE'));
}
