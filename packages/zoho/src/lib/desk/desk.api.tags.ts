import { type Maybe, type ArrayOrValue, asArray } from '@dereekb/util';
import { type FetchJsonBody, type FetchJsonInput, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoDeskContext } from './desk.config';
import { type ZohoDeskTicketId, type ZohoDeskDepartmentId } from './desk';
import { type ZohoDeskTicketTag } from './desk.ticket';
import { type ZohoDeskPageFilter, type ZohoDeskPageResult } from './desk.api.page';

// MARK: Utility
function zohoDeskTagApiFetchJsonInput(method: string, body?: Maybe<FetchJsonBody>): FetchJsonInput {
  return { method, body: body ?? undefined };
}

// MARK: List Tags for Ticket
/**
 * Input parameters for listing tags on a ticket via `GET /tickets/{ticketId}/tags`.
 */
export interface ZohoDeskGetTicketTagsInput {
  readonly ticketId: ZohoDeskTicketId;
}

/**
 * Function that retrieves tags for a specific ticket.
 */
export type ZohoDeskGetTicketTagsFunction = (input: ZohoDeskGetTicketTagsInput) => Promise<ZohoDeskTicketTag[]>;

/**
 * Creates a {@link ZohoDeskGetTicketTagsFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves tags for a ticket
 */
export function zohoDeskGetTicketTags(context: ZohoDeskContext): ZohoDeskGetTicketTagsFunction {
  return (input: ZohoDeskGetTicketTagsInput) => context.fetchJson<ZohoDeskTicketTag[]>(`/tickets/${input.ticketId}/tags`, zohoDeskTagApiFetchJsonInput('GET')).then((x) => x ?? []);
}

// MARK: Associate Tag
/**
 * Input parameters for associating tags with a ticket via `POST /tickets/{ticketId}/tags`.
 */
export interface ZohoDeskAssociateTicketTagsInput {
  readonly ticketId: ZohoDeskTicketId;
  readonly tags: ArrayOrValue<string>;
}

/**
 * Function that associates tags with a ticket.
 */
export type ZohoDeskAssociateTicketTagsFunction = (input: ZohoDeskAssociateTicketTagsInput) => Promise<ZohoDeskTicketTag[]>;

/**
 * Creates a {@link ZohoDeskAssociateTicketTagsFunction} bound to the given context.
 *
 * Associates one or more tags with a ticket. If the tag does not exist, it will be created.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that associates tags with a ticket
 */
export function zohoDeskAssociateTicketTags(context: ZohoDeskContext): ZohoDeskAssociateTicketTagsFunction {
  return (input: ZohoDeskAssociateTicketTagsInput) => {
    const body = { tags: asArray(input.tags).map((name) => ({ name })) };
    return context.fetchJson<ZohoDeskTicketTag[]>(`/tickets/${input.ticketId}/tags`, zohoDeskTagApiFetchJsonInput('POST', body)).then((x) => x ?? []);
  };
}

// MARK: Dissociate Tag
/**
 * Input parameters for removing a tag from a ticket via `DELETE /tickets/{ticketId}/tags/{tagId}`.
 */
export interface ZohoDeskDissociateTicketTagInput {
  readonly ticketId: ZohoDeskTicketId;
  readonly tagId: string;
}

/**
 * Function that removes a tag from a ticket.
 */
export type ZohoDeskDissociateTicketTagFunction = (input: ZohoDeskDissociateTicketTagInput) => Promise<void>;

/**
 * Creates a {@link ZohoDeskDissociateTicketTagFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that removes a tag from a ticket
 */
export function zohoDeskDissociateTicketTag(context: ZohoDeskContext): ZohoDeskDissociateTicketTagFunction {
  return (input: ZohoDeskDissociateTicketTagInput) => context.fetchJson<void>(`/tickets/${input.ticketId}/tags/${input.tagId}`, zohoDeskTagApiFetchJsonInput('DELETE'));
}

// MARK: Search Tags
/**
 * Input parameters for searching tags via `GET /tags/search`.
 */
export interface ZohoDeskSearchTagsInput extends ZohoDeskPageFilter {
  readonly departmentId?: ZohoDeskDepartmentId;
  readonly searchVal?: string;
}

/**
 * Function that searches for ticket tags.
 */
export type ZohoDeskSearchTagsFunction = (input: ZohoDeskSearchTagsInput) => Promise<ZohoDeskPageResult<ZohoDeskTicketTag>>;

/**
 * Creates a {@link ZohoDeskSearchTagsFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that searches for tags
 */
export function zohoDeskSearchTags(context: ZohoDeskContext): ZohoDeskSearchTagsFunction {
  return (input: ZohoDeskSearchTagsInput) => {
    const params = makeUrlSearchParams([input]);
    return context.fetchJson<ZohoDeskPageResult<ZohoDeskTicketTag>>(`/tags/search?${params}`, zohoDeskTagApiFetchJsonInput('GET')).then((x) => x ?? { data: [] });
  };
}

// MARK: List All Tags
/**
 * Input parameters for listing all ticket tags via `GET /ticketTags`.
 *
 * The Zoho Desk API requires `departmentId` for this endpoint.
 */
export interface ZohoDeskGetAllTagsInput extends ZohoDeskPageFilter {
  readonly departmentId: ZohoDeskDepartmentId;
  readonly sortBy?: ZohoDeskTicketTagSortBy;
}

/**
 * Sort keys for ticket tags.
 */
export type ZohoDeskTicketTagSortBy = 'createdTime' | 'count';

/**
 * Function that retrieves all ticket tags.
 */
export type ZohoDeskGetAllTagsFunction = (input: ZohoDeskGetAllTagsInput) => Promise<ZohoDeskPageResult<ZohoDeskTicketTag>>;

/**
 * Creates a {@link ZohoDeskGetAllTagsFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves all tags
 */
export function zohoDeskGetAllTags(context: ZohoDeskContext): ZohoDeskGetAllTagsFunction {
  return (input: ZohoDeskGetAllTagsInput) => {
    const params = makeUrlSearchParams([input]);
    return context.fetchJson<ZohoDeskPageResult<ZohoDeskTicketTag>>(`/ticketTags?${params}`, zohoDeskTagApiFetchJsonInput('GET')).then((x) => x ?? { data: [] });
  };
}
