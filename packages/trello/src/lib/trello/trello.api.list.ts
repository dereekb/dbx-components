import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type TrelloContext } from './trello.factory';
import { type TrelloListId } from '../trello.type';
import { type CreateListBody, type TrelloList, type UpdateListBody } from './trello.api.list.type';
import { type TrelloCard } from './trello.api.card.type';

export interface GetListInput {
  readonly listId: TrelloListId;
}

export type GetListFunction = (input: GetListInput) => Promise<TrelloList>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-lists/#api-lists-id-get.
 *
 * @param context - The Trello API context.
 * @returns A function that retrieves a list by id.
 */
export function getList(context: TrelloContext): GetListFunction {
  return (input) => context.fetchJson(`/lists/${input.listId}`, 'GET');
}

export type CreateListFunction = (input: CreateListBody) => Promise<TrelloList>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-lists/#api-lists-post.
 *
 * @param context - The Trello API context.
 * @returns A function that creates a new list on a board.
 */
export function createList(context: TrelloContext): CreateListFunction {
  return (input) => {
    const queryString = makeUrlSearchParams(input);
    return context.fetchJson(`/lists?${queryString}`, 'POST');
  };
}

export interface UpdateListInput extends UpdateListBody {
  readonly listId: TrelloListId;
}

export type UpdateListFunction = (input: UpdateListInput) => Promise<TrelloList>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-lists/#api-lists-id-put.
 *
 * @param context - The Trello API context.
 * @returns A function that updates an existing list.
 */
export function updateList(context: TrelloContext): UpdateListFunction {
  return (input) => {
    const { listId, ...body } = input;
    return context.fetchJson(`/lists/${listId}`, 'PUT', body);
  };
}

export interface ListCardsInListInput {
  readonly listId: TrelloListId;
  readonly filter?: 'all' | 'closed' | 'none' | 'open';
}

export type ListCardsInListFunction = (input: ListCardsInListInput) => Promise<ReadonlyArray<TrelloCard>>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-lists/#api-lists-id-cards-get.
 *
 * @param context - The Trello API context.
 * @returns A function that lists all cards on a list.
 */
export function listCardsInList(context: TrelloContext): ListCardsInListFunction {
  return (input) => {
    const { listId, ...query } = input;
    const queryString = makeUrlSearchParams(query);
    return context.fetchJson(`/lists/${listId}/cards?${queryString}`, 'GET');
  };
}
