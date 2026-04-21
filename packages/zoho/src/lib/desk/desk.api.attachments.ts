import { type Maybe, type ArrayOrValue, asArray, joinStringsWithCommas } from '@dereekb/util';
import { type FetchJsonBody, type FetchJsonInput, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoDeskContext } from './desk.config';
import { type ZohoDeskTicketId } from './desk';
import { type ZohoDeskTicketAttachment, type ZohoDeskAttachmentSortBy, type ZohoDeskAttachmentInclude } from './desk.ticket';
import { type ZohoDeskPageFilter, type ZohoDeskPageResult } from './desk.api.page';

// MARK: Utility
function zohoDeskAttachmentApiFetchJsonInput(method: string, body?: Maybe<FetchJsonBody>): FetchJsonInput {
  return { method, body: body ?? undefined };
}

function joinAttachmentInclude(include: Maybe<ArrayOrValue<string>>): Maybe<string> {
  let result: Maybe<string>;

  if (include) {
    result = joinStringsWithCommas(asArray(include));
  }

  return result;
}

// MARK: List Ticket Attachments
/**
 * Input parameters for listing attachments on a ticket via `GET /tickets/{ticketId}/attachments`.
 */
export interface ZohoDeskGetTicketAttachmentsInput extends ZohoDeskPageFilter {
  readonly ticketId: ZohoDeskTicketId;
  readonly sortBy?: ZohoDeskAttachmentSortBy;
  readonly include?: ArrayOrValue<ZohoDeskAttachmentInclude>;
  readonly isPublic?: boolean;
}

/**
 * Response from listing ticket attachments.
 */
export type ZohoDeskGetTicketAttachmentsResponse = ZohoDeskPageResult<ZohoDeskTicketAttachment>;

/**
 * Function that retrieves attachments for a specific ticket.
 */
export type ZohoDeskGetTicketAttachmentsFunction = (input: ZohoDeskGetTicketAttachmentsInput) => Promise<ZohoDeskGetTicketAttachmentsResponse>;

/**
 * Creates a {@link ZohoDeskGetTicketAttachmentsFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves attachments for a ticket
 */
export function zohoDeskGetTicketAttachments(context: ZohoDeskContext): ZohoDeskGetTicketAttachmentsFunction {
  return (input: ZohoDeskGetTicketAttachmentsInput) => {
    const { ticketId, include, ...rest } = input;
    const params = makeUrlSearchParams([{ ...rest, include: joinAttachmentInclude(include) }]);
    return context.fetchJson<ZohoDeskGetTicketAttachmentsResponse>(`/tickets/${ticketId}/attachments?${params}`, zohoDeskAttachmentApiFetchJsonInput('GET')).then((x) => x ?? { data: [] });
  };
}

// MARK: Delete Ticket Attachment
/**
 * Input parameters for deleting an attachment from a ticket via `DELETE /tickets/{ticketId}/attachments/{attachmentId}`.
 */
export interface ZohoDeskDeleteTicketAttachmentInput {
  readonly ticketId: ZohoDeskTicketId;
  readonly attachmentId: string;
}

/**
 * Function that deletes an attachment from a ticket.
 */
export type ZohoDeskDeleteTicketAttachmentFunction = (input: ZohoDeskDeleteTicketAttachmentInput) => Promise<void>;

/**
 * Creates a {@link ZohoDeskDeleteTicketAttachmentFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that deletes a ticket attachment
 */
export function zohoDeskDeleteTicketAttachment(context: ZohoDeskContext): ZohoDeskDeleteTicketAttachmentFunction {
  return (input: ZohoDeskDeleteTicketAttachmentInput) => context.fetchJson<void>(`/tickets/${input.ticketId}/attachments/${input.attachmentId}`, zohoDeskAttachmentApiFetchJsonInput('DELETE'));
}
