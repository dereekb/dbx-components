import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type TrelloContext } from './trello.factory';
import { type TrelloActionId, type TrelloCardId, type TrelloLabelId, type TrelloMemberId } from '../trello.type';
import { type CreateCardBody, type TrelloAction, type TrelloCard, type TrelloCardWithExpansions, type TrelloCommentCardAction, type UpdateCardBody } from './trello.api.card.type';

/**
 * Optional expansions and field selections for {@link getCard}. Every option maps 1:1 onto Trello's query parameter.
 *
 * @see https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-get
 */
export interface GetCardQuery {
  /**
   * Comma-separated list of card fields to return, or `all`.
   */
  readonly fields?: string;
  /**
   * Include the card's attachments: `true`, `false`, or `cover`.
   */
  readonly attachments?: boolean | 'cover';
  /**
   * Comma-separated list of attachment fields to return, or `all`. Sent as `attachment_fields`.
   */
  readonly attachmentFields?: string;
  /**
   * Include the card's checklists: `all` or `none`.
   */
  readonly checklists?: 'all' | 'none';
  /**
   * Include the card's members.
   */
  readonly members?: boolean;
  /**
   * Comma-separated list of action types to include with the card, e.g. `commentCard`.
   */
  readonly actions?: string;
  /**
   * Include the card's board.
   */
  readonly board?: boolean;
  /**
   * Include the card's list.
   */
  readonly list?: boolean;
  /**
   * Include the card's custom field items.
   */
  readonly customFieldItems?: boolean;
}

export interface GetCardInput extends GetCardQuery {
  /**
   * The card's id or its shortLink.
   */
  readonly cardId: TrelloCardId;
}

export type GetCardFunction = (input: GetCardInput) => Promise<TrelloCardWithExpansions>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-get.
 *
 * @param context - The Trello API context.
 * @returns Retrieves a card by id, with any requested expansions.
 */
export function getCard(context: TrelloContext): GetCardFunction {
  return (input) => {
    const { cardId, attachmentFields, ...query } = input;
    const queryString = makeUrlSearchParams({ ...query, attachment_fields: attachmentFields });
    return context.fetchJson(`/cards/${cardId}${queryString.size > 0 ? `?${queryString}` : ''}`, 'GET');
  };
}

export type CreateCardFunction = (input: CreateCardBody) => Promise<TrelloCard>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-post.
 *
 * @param context - The Trello API context.
 * @returns Creates a card on a list.
 */
export function createCard(context: TrelloContext): CreateCardFunction {
  return (input) => {
    const { idLabels, idMembers, ...rest } = input;
    const query: Record<string, unknown> = { ...rest };

    if (idLabels) {
      query['idLabels'] = idLabels.join(',');
    }

    if (idMembers) {
      query['idMembers'] = idMembers.join(',');
    }

    const queryString = makeUrlSearchParams(query);
    return context.fetchJson(`/cards?${queryString}`, 'POST');
  };
}

export interface UpdateCardInput extends UpdateCardBody {
  readonly cardId: TrelloCardId;
}

export type UpdateCardFunction = (input: UpdateCardInput) => Promise<TrelloCard>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-put.
 *
 * @param context - The Trello API context.
 * @returns Updates an existing card.
 */
export function updateCard(context: TrelloContext): UpdateCardFunction {
  return (input) => {
    const { cardId, idLabels, idMembers, ...rest } = input;
    const body: Record<string, unknown> = { ...rest };

    if (idLabels) {
      body['idLabels'] = idLabels.join(',');
    }

    if (idMembers) {
      body['idMembers'] = idMembers.join(',');
    }

    return context.fetchJson(`/cards/${cardId}`, 'PUT', body);
  };
}

export interface DeleteCardInput {
  readonly cardId: TrelloCardId;
}

export type DeleteCardFunction = (input: DeleteCardInput) => Promise<void>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-delete.
 *
 * @param context - The Trello API context.
 * @returns Deletes a card.
 */
export function deleteCard(context: TrelloContext): DeleteCardFunction {
  return async (input) => {
    await context.fetchJson(`/cards/${input.cardId}`, 'DELETE');
  };
}

/**
 * Trello action type identifier.
 *
 * Trello supports many action types (40+). Common card-related values: `commentCard`, `updateCard`, `createCard`,
 * `deleteCard`, `addMemberToCard`, `removeMemberFromCard`, `addAttachmentToCard`, `deleteAttachmentFromCard`,
 * `addChecklistToCard`, `removeChecklistFromCard`, `updateCheckItemStateOnCard`, `addLabelToCard`, `removeLabelFromCard`.
 *
 * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/action-types/
 */
export type TrelloActionType = string; // NOSONAR (S6564 — intentional semantic alias)

export interface ListCardActionsInput {
  readonly cardId: TrelloCardId;
  /**
   * Comma-separated list of action types to include, or `all`. Defaults to `commentCard,updateCard:idList` server-side.
   */
  readonly filter?: TrelloActionType;
  /**
   * Maximum number of actions to return. Defaults to 50 server-side; max is 1000.
   */
  readonly limit?: number;
  /**
   * Cursor: return actions before this action id (older).
   */
  readonly before?: string;
  /**
   * Cursor: return actions since this action id (newer).
   */
  readonly since?: string;
}

export type ListCardActionsFunction = <D = unknown>(input: ListCardActionsInput) => Promise<ReadonlyArray<TrelloAction<D>>>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-actions-get.
 *
 * Comments are returned as actions with `type === 'commentCard'`; pass `filter: 'commentCard'` and the generic
 * type parameter `TrelloCommentCardActionData` to get a comment-typed result.
 *
 * @param context - The Trello API context.
 * @returns Lists actions on a card.
 */
export function listCardActions(context: TrelloContext): ListCardActionsFunction {
  return (input) => {
    const { cardId, ...query } = input;
    const queryString = makeUrlSearchParams(query);
    return context.fetchJson(`/cards/${cardId}/actions?${queryString}`, 'GET');
  };
}

export interface AddCommentToCardInput {
  readonly cardId: TrelloCardId;
  /**
   * Comment text (1-16384 characters).
   */
  readonly text: string;
}

export type AddCommentToCardFunction = (input: AddCommentToCardInput) => Promise<TrelloCommentCardAction>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-actions-comments-post.
 *
 * @param context - The Trello API context.
 * @returns Adds a comment to a card.
 */
export function addCommentToCard(context: TrelloContext): AddCommentToCardFunction {
  return (input) => {
    const queryString = makeUrlSearchParams({ text: input.text });
    return context.fetchJson(`/cards/${input.cardId}/actions/comments?${queryString}`, 'POST');
  };
}

export interface AddMemberToCardInput {
  readonly cardId: TrelloCardId;
  readonly memberId: TrelloMemberId;
}

export type AddMemberToCardFunction = (input: AddMemberToCardInput) => Promise<ReadonlyArray<TrelloMemberId>>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-idmembers-post.
 *
 * @param context - The Trello API context.
 * @returns Adds a member to a card.
 */
export function addMemberToCard(context: TrelloContext): AddMemberToCardFunction {
  return (input) => {
    const queryString = makeUrlSearchParams({ value: input.memberId });
    return context.fetchJson(`/cards/${input.cardId}/idMembers?${queryString}`, 'POST');
  };
}

export interface AddLabelToCardInput {
  readonly cardId: TrelloCardId;
  readonly labelId: TrelloLabelId;
}

export type AddLabelToCardFunction = (input: AddLabelToCardInput) => Promise<ReadonlyArray<TrelloLabelId>>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-idlabels-post.
 *
 * @param context - The Trello API context.
 * @returns Adds an existing label to a card.
 */
export function addLabelToCard(context: TrelloContext): AddLabelToCardFunction {
  return (input) => {
    const queryString = makeUrlSearchParams({ value: input.labelId });
    return context.fetchJson(`/cards/${input.cardId}/idLabels?${queryString}`, 'POST');
  };
}

export interface RemoveLabelFromCardInput {
  readonly cardId: TrelloCardId;
  readonly labelId: TrelloLabelId;
}

export type RemoveLabelFromCardFunction = (input: RemoveLabelFromCardInput) => Promise<void>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-idlabels-idlabel-delete.
 *
 * Removes one label, leaving the card's other labels untouched — unlike `updateCard({ idLabels })`, which replaces
 * the whole set and so races any concurrent label change.
 *
 * @param context - The Trello API context.
 * @returns Removes a label from a card.
 */
export function removeLabelFromCard(context: TrelloContext): RemoveLabelFromCardFunction {
  return async (input) => {
    await context.fetchJson(`/cards/${input.cardId}/idLabels/${input.labelId}`, 'DELETE');
  };
}

export interface RemoveMemberFromCardInput {
  readonly cardId: TrelloCardId;
  readonly memberId: TrelloMemberId;
}

export type RemoveMemberFromCardFunction = (input: RemoveMemberFromCardInput) => Promise<void>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-idmembers-idmember-delete.
 *
 * @param context - The Trello API context.
 * @returns Removes a member from a card.
 */
export function removeMemberFromCard(context: TrelloContext): RemoveMemberFromCardFunction {
  return async (input) => {
    await context.fetchJson(`/cards/${input.cardId}/idMembers/${input.memberId}`, 'DELETE');
  };
}

export interface UpdateCommentOnCardInput {
  readonly cardId: TrelloCardId;
  /**
   * The id of the `commentCard` action to edit.
   */
  readonly actionId: TrelloActionId;
  /**
   * The new comment text (1-16384 characters).
   */
  readonly text: string;
}

export type UpdateCommentOnCardFunction = (input: UpdateCommentOnCardInput) => Promise<TrelloCommentCardAction>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-actions-idaction-comments-put.
 *
 * Only the comment's author can edit it.
 *
 * @param context - The Trello API context.
 * @returns Replaces the text of a comment on a card.
 */
export function updateCommentOnCard(context: TrelloContext): UpdateCommentOnCardFunction {
  return (input) => {
    const queryString = makeUrlSearchParams({ text: input.text });
    return context.fetchJson(`/cards/${input.cardId}/actions/${input.actionId}/comments?${queryString}`, 'PUT');
  };
}

export interface DeleteCommentOnCardInput {
  readonly cardId: TrelloCardId;
  /**
   * The id of the `commentCard` action to delete.
   */
  readonly actionId: TrelloActionId;
}

export type DeleteCommentOnCardFunction = (input: DeleteCommentOnCardInput) => Promise<void>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-actions-idaction-comments-delete.
 *
 * @param context - The Trello API context.
 * @returns Deletes a comment on a card.
 */
export function deleteCommentOnCard(context: TrelloContext): DeleteCommentOnCardFunction {
  return async (input) => {
    await context.fetchJson(`/cards/${input.cardId}/actions/${input.actionId}/comments`, 'DELETE');
  };
}
