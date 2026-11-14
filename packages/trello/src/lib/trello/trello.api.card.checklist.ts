import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type TrelloContext } from './trello.factory';
import { type TrelloCardId, type TrelloChecklistId, type TrelloCheckItemId } from '../trello.type';
import { type AddCheckItemToChecklistBody, type AddChecklistToCardBody, type TrelloCheckItem, type TrelloChecklist, type UpdateCardCheckItemBody, type UpdateChecklistBody } from './trello.api.card.checklist.type';

/**
 * Which check items to include with a checklist.
 */
export type TrelloChecklistCheckItemsFilter = 'all' | 'none';

export interface ListCardChecklistsInput {
  readonly cardId: TrelloCardId;
  /**
   * Whether to include each checklist's items. Defaults to `all` server-side.
   */
  readonly checkItems?: TrelloChecklistCheckItemsFilter;
  /**
   * Comma-separated list of check item fields to return, or `all`. Sent as `checkItem_fields`.
   */
  readonly checkItemFields?: string;
  /**
   * Comma-separated list of checklist fields to return, or `all`.
   */
  readonly fields?: string;
}

export type ListCardChecklistsFunction = (input: ListCardChecklistsInput) => Promise<ReadonlyArray<TrelloChecklist>>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-checklists-get.
 *
 * @param context - The Trello API context.
 * @returns Lists the checklists on a card.
 */
export function listCardChecklists(context: TrelloContext): ListCardChecklistsFunction {
  return (input) => {
    const { cardId, checkItemFields, ...query } = input;
    const queryString = makeUrlSearchParams({ ...query, checkItem_fields: checkItemFields });
    return context.fetchJson(`/cards/${cardId}/checklists?${queryString}`, 'GET');
  };
}

export interface GetChecklistInput {
  readonly checklistId: TrelloChecklistId;
  /**
   * Whether to include the checklist's items. Defaults to `all` server-side.
   */
  readonly checkItems?: TrelloChecklistCheckItemsFilter;
  /**
   * Comma-separated list of check item fields to return, or `all`. Sent as `checkItem_fields`.
   */
  readonly checkItemFields?: string;
  /**
   * Comma-separated list of checklist fields to return, or `all`.
   */
  readonly fields?: string;
}

export type GetChecklistFunction = (input: GetChecklistInput) => Promise<TrelloChecklist>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-checklists/#api-checklists-id-get.
 *
 * @param context - The Trello API context.
 * @returns Retrieves a single checklist.
 */
export function getChecklist(context: TrelloContext): GetChecklistFunction {
  return (input) => {
    const { checklistId, checkItemFields, ...query } = input;
    const queryString = makeUrlSearchParams({ ...query, checkItem_fields: checkItemFields });
    return context.fetchJson(`/checklists/${checklistId}?${queryString}`, 'GET');
  };
}

export interface AddChecklistToCardInput extends AddChecklistToCardBody {
  readonly cardId: TrelloCardId;
}

export type AddChecklistToCardFunction = (input: AddChecklistToCardInput) => Promise<TrelloChecklist>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-checklists-post.
 *
 * @param context - The Trello API context.
 * @returns Adds a new checklist to a card.
 */
export function addChecklistToCard(context: TrelloContext): AddChecklistToCardFunction {
  return (input) => {
    const { cardId, ...query } = input;
    const queryString = makeUrlSearchParams(query);
    return context.fetchJson(`/cards/${cardId}/checklists?${queryString}`, 'POST');
  };
}

export interface UpdateChecklistInput extends UpdateChecklistBody {
  readonly checklistId: TrelloChecklistId;
}

export type UpdateChecklistFunction = (input: UpdateChecklistInput) => Promise<TrelloChecklist>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-checklists/#api-checklists-id-put.
 *
 * @param context - The Trello API context.
 * @returns Renames or repositions a checklist.
 */
export function updateChecklist(context: TrelloContext): UpdateChecklistFunction {
  return (input) => {
    const { checklistId, ...body } = input;
    return context.fetchJson(`/checklists/${checklistId}`, 'PUT', body);
  };
}

export interface DeleteChecklistInput {
  readonly checklistId: TrelloChecklistId;
}

export type DeleteChecklistFunction = (input: DeleteChecklistInput) => Promise<void>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-checklists/#api-checklists-id-delete.
 *
 * @param context - The Trello API context.
 * @returns Deletes a checklist and its items.
 */
export function deleteChecklist(context: TrelloContext): DeleteChecklistFunction {
  return async (input) => {
    await context.fetchJson(`/checklists/${input.checklistId}`, 'DELETE');
  };
}

export interface AddCheckItemToChecklistInput extends AddCheckItemToChecklistBody {
  readonly checklistId: TrelloChecklistId;
}

export type AddCheckItemToChecklistFunction = (input: AddCheckItemToChecklistInput) => Promise<TrelloCheckItem>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-checklists/#api-checklists-id-checkitems-post.
 *
 * @param context - The Trello API context.
 * @returns Adds an item to a checklist.
 */
export function addCheckItemToChecklist(context: TrelloContext): AddCheckItemToChecklistFunction {
  return (input) => {
    const { checklistId, ...query } = input;
    const queryString = makeUrlSearchParams(query);
    return context.fetchJson(`/checklists/${checklistId}/checkItems?${queryString}`, 'POST');
  };
}

export interface UpdateCardCheckItemInput extends UpdateCardCheckItemBody {
  readonly cardId: TrelloCardId;
  readonly checkItemId: TrelloCheckItemId;
}

export type UpdateCardCheckItemFunction = (input: UpdateCardCheckItemInput) => Promise<TrelloCheckItem>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-checkitem-idcheckitem-put.
 *
 * @param context - The Trello API context.
 * @returns Updates (ticks, renames, moves or reassigns) an item on a card's checklist.
 */
export function updateCardCheckItem(context: TrelloContext): UpdateCardCheckItemFunction {
  return (input) => {
    const { cardId, checkItemId, ...body } = input;
    return context.fetchJson(`/cards/${cardId}/checkItem/${checkItemId}`, 'PUT', body);
  };
}

export interface DeleteCheckItemFromCardInput {
  readonly cardId: TrelloCardId;
  readonly checkItemId: TrelloCheckItemId;
}

export type DeleteCheckItemFromCardFunction = (input: DeleteCheckItemFromCardInput) => Promise<void>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-checkitem-idcheckitem-delete.
 *
 * @param context - The Trello API context.
 * @returns Deletes an item from a card's checklist.
 */
export function deleteCheckItemFromCard(context: TrelloContext): DeleteCheckItemFromCardFunction {
  return async (input) => {
    await context.fetchJson(`/cards/${input.cardId}/checkItem/${input.checkItemId}`, 'DELETE');
  };
}
