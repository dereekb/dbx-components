import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type TrelloContext } from './trello.factory';
import { type TrelloCardId, type TrelloLabelId, type TrelloMemberId } from '../trello.type';
import { type CreateCardBody, type TrelloAction, type TrelloCard, type TrelloCommentCardAction, type UpdateCardBody } from './trello.api.card.type';

export interface GetCardInput {
  readonly cardId: TrelloCardId;
}

export type GetCardFunction = (input: GetCardInput) => Promise<TrelloCard>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-get.
 *
 * @param context - The Trello API context.
 * @returns Retrieves a card by id.
 */
export function getCard(context: TrelloContext): GetCardFunction {
  return (input) => context.fetchJson(`/cards/${input.cardId}`, 'GET');
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
      query.idLabels = idLabels.join(',');
    }

    if (idMembers) {
      query.idMembers = idMembers.join(',');
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
      body.idLabels = idLabels.join(',');
    }

    if (idMembers) {
      body.idMembers = idMembers.join(',');
    }

    return context.fetchJson(`/cards/${cardId}`, 'PUT', body);
  };
}

export type DeleteCardFunction = (input: GetCardInput) => Promise<void>;

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
