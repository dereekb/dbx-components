import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type TrelloContext } from './trello.factory';
import { type TrelloBoardId, type TrelloMemberId } from '../trello.type';
import { type CreateBoardBody, type TrelloBoard, type UpdateBoardBody } from './trello.api.board.type';
import { type TrelloList } from './trello.api.list.type';
import { type TrelloAction, type TrelloCard, type TrelloLabel } from './trello.api.card.type';
import { type TrelloActionType } from './trello.api.card';
import { type TrelloMember } from './trello.api.member.type';

export interface GetBoardInput {
  readonly boardId: TrelloBoardId;
}

export type GetBoardFunction = (input: GetBoardInput) => Promise<TrelloBoard>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-get.
 *
 * @param context - The Trello API context.
 * @returns Retrieves a board by id.
 */
export function getBoard(context: TrelloContext): GetBoardFunction {
  return (input) => context.fetchJson(`/boards/${input.boardId}`, 'GET');
}

export type CreateBoardFunction = (input: CreateBoardBody) => Promise<TrelloBoard>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-post.
 *
 * @param context - The Trello API context.
 * @returns Creates a new board.
 */
export function createBoard(context: TrelloContext): CreateBoardFunction {
  return (input) => {
    const queryString = makeUrlSearchParams(input);
    return context.fetchJson(`/boards?${queryString}`, 'POST');
  };
}

export interface UpdateBoardInput extends UpdateBoardBody {
  readonly boardId: TrelloBoardId;
}

export type UpdateBoardFunction = (input: UpdateBoardInput) => Promise<TrelloBoard>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-put.
 *
 * @param context - The Trello API context.
 * @returns Updates an existing board.
 */
export function updateBoard(context: TrelloContext): UpdateBoardFunction {
  return (input) => {
    const { boardId, ...body } = input;
    return context.fetchJson(`/boards/${boardId}`, 'PUT', body);
  };
}

export type DeleteBoardFunction = (input: GetBoardInput) => Promise<void>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-delete.
 *
 * @param context - The Trello API context.
 * @returns Deletes a board.
 */
export function deleteBoard(context: TrelloContext): DeleteBoardFunction {
  return async (input) => {
    await context.fetchJson(`/boards/${input.boardId}`, 'DELETE');
  };
}

export interface ListBoardListsInput {
  readonly boardId: TrelloBoardId;
  /**
   * Whether to include all lists, only open, or only closed.
   *
   * Defaults to `open`.
   */
  readonly filter?: 'all' | 'closed' | 'none' | 'open';
}

export type ListBoardListsFunction = (input: ListBoardListsInput) => Promise<ReadonlyArray<TrelloList>>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-lists-get.
 *
 * @param context - The Trello API context.
 * @returns Lists all lists on a board.
 */
export function listBoardLists(context: TrelloContext): ListBoardListsFunction {
  return (input) => {
    const { boardId, ...query } = input;
    const queryString = makeUrlSearchParams(query);
    return context.fetchJson(`/boards/${boardId}/lists?${queryString}`, 'GET');
  };
}

export interface ListBoardCardsInput {
  readonly boardId: TrelloBoardId;
  readonly filter?: 'all' | 'closed' | 'none' | 'open' | 'visible';
}

export type ListBoardCardsFunction = (input: ListBoardCardsInput) => Promise<ReadonlyArray<TrelloCard>>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-cards-get.
 *
 * @param context - The Trello API context.
 * @returns Lists all cards on a board.
 */
export function listBoardCards(context: TrelloContext): ListBoardCardsFunction {
  return (input) => {
    const { boardId, ...query } = input;
    const queryString = makeUrlSearchParams(query);
    return context.fetchJson(`/boards/${boardId}/cards?${queryString}`, 'GET');
  };
}

export interface ListBoardLabelsInput {
  readonly boardId: TrelloBoardId;
  /**
   * Maximum number of labels to return. Defaults to 50 server-side; max is 1000.
   */
  readonly limit?: number;
}

export type ListBoardLabelsFunction = (input: ListBoardLabelsInput) => Promise<ReadonlyArray<TrelloLabel>>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-labels-get.
 *
 * @param context - The Trello API context.
 * @returns Lists every label defined on a board.
 */
export function listBoardLabels(context: TrelloContext): ListBoardLabelsFunction {
  return (input) => {
    const { boardId, ...query } = input;
    const queryString = makeUrlSearchParams(query);
    return context.fetchJson(`/boards/${boardId}/labels?${queryString}`, 'GET');
  };
}

export interface ListBoardMembersInput {
  readonly boardId: TrelloBoardId;
  /**
   * Optional member id filter. Pass to list a specific board member.
   */
  readonly memberId?: TrelloMemberId;
}

export type ListBoardMembersFunction = (input: ListBoardMembersInput) => Promise<ReadonlyArray<TrelloMember>>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-members-get.
 *
 * @param context - The Trello API context.
 * @returns Lists all members of a board.
 */
export function listBoardMembers(context: TrelloContext): ListBoardMembersFunction {
  return (input) => context.fetchJson(`/boards/${input.boardId}/members`, 'GET');
}

export interface ListBoardActionsInput {
  readonly boardId: TrelloBoardId;
  /**
   * Comma-separated list of action types to include, or `all`. Examples: `'updateCard:idList'`, `'updateCard:idList,createCard'`.
   *
   * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/action-types/
   */
  readonly filter?: TrelloActionType;
  /**
   * Maximum number of actions to return. Defaults to 50 server-side; max is 1000.
   */
  readonly limit?: number;
  /**
   * Cursor: return actions before this action id (older). Also accepts an ISO 8601 date string.
   */
  readonly before?: string;
  /**
   * Cursor: return actions since this action id (newer). Also accepts an ISO 8601 date string.
   */
  readonly since?: string;
}

export type ListBoardActionsFunction = <D = unknown>(input: ListBoardActionsInput) => Promise<ReadonlyArray<TrelloAction<D>>>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-actions-get.
 *
 * Returns the board action stream. Useful for list-movement audits via `filter: 'updateCard:idList'` paired with
 * the {@link TrelloUpdateCardIdListActionData} payload type — answers "which cards moved into list X since time Y?".
 *
 * @param context - The Trello API context.
 * @returns Lists actions on a board.
 */
export function listBoardActions(context: TrelloContext): ListBoardActionsFunction {
  return (input) => {
    const { boardId, ...query } = input;
    const queryString = makeUrlSearchParams(query);
    return context.fetchJson(`/boards/${boardId}/actions?${queryString}`, 'GET');
  };
}
