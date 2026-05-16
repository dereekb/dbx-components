import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type TrelloContext } from './trello.factory';
import { type TrelloCardId, type TrelloLabelId, type TrelloMemberId } from '../trello.type';
import { type CreateCardBody, type TrelloCard, type TrelloCommentCardAction, type UpdateCardBody } from './trello.api.card.type';

export interface GetCardInput {
  readonly cardId: TrelloCardId;
}

export type GetCardFunction = (input: GetCardInput) => Promise<TrelloCard>;

/**
 * https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-get
 *
 * @param context The Trello API context.
 * @returns A function that retrieves a card by id.
 */
export function getCard(context: TrelloContext): GetCardFunction {
  return (input) => context.fetchJson(`/cards/${input.cardId}`, 'GET');
}

export type CreateCardFunction = (input: CreateCardBody) => Promise<TrelloCard>;

/**
 * https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-post
 *
 * @param context The Trello API context.
 * @returns A function that creates a card on a list.
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
 * https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-put
 *
 * @param context The Trello API context.
 * @returns A function that updates an existing card.
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
 * https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-delete
 *
 * @param context The Trello API context.
 * @returns A function that deletes a card.
 */
export function deleteCard(context: TrelloContext): DeleteCardFunction {
  return async (input) => {
    await context.fetchJson(`/cards/${input.cardId}`, 'DELETE');
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
 * https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-actions-comments-post
 *
 * @param context The Trello API context.
 * @returns A function that adds a comment to a card.
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
 * https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-idmembers-post
 *
 * @param context The Trello API context.
 * @returns A function that adds a member to a card.
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
 * https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-idlabels-post
 *
 * @param context The Trello API context.
 * @returns A function that adds an existing label to a card.
 */
export function addLabelToCard(context: TrelloContext): AddLabelToCardFunction {
  return (input) => {
    const queryString = makeUrlSearchParams({ value: input.labelId });
    return context.fetchJson(`/cards/${input.cardId}/idLabels?${queryString}`, 'POST');
  };
}
