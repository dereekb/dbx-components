import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type TrelloContext } from './trello.factory';
import { type TrelloBoardId, type TrelloMemberId } from '../trello.type';
import { type CreateBoardBody, type TrelloBoard, type UpdateBoardBody } from './trello.api.board.type';
import { type TrelloList } from './trello.api.list.type';
import { type TrelloCard, type TrelloLabel } from './trello.api.card.type';
import { type TrelloMember } from './trello.api.member.type';

export interface GetBoardInput {
  readonly boardId: TrelloBoardId;
}

export type GetBoardFunction = (input: GetBoardInput) => Promise<TrelloBoard>;

/**
 * https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-get
 *
 * @param context The Trello API context.
 * @returns A function that retrieves a board by id.
 */
export function getBoard(context: TrelloContext): GetBoardFunction {
  return (input) => context.fetchJson(`/boards/${input.boardId}`, 'GET');
}

export type CreateBoardFunction = (input: CreateBoardBody) => Promise<TrelloBoard>;

/**
 * https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-post
 *
 * @param context The Trello API context.
 * @returns A function that creates a new board.
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
 * https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-put
 *
 * @param context The Trello API context.
 * @returns A function that updates an existing board.
 */
export function updateBoard(context: TrelloContext): UpdateBoardFunction {
  return (input) => {
    const { boardId, ...body } = input;
    return context.fetchJson(`/boards/${boardId}`, 'PUT', body);
  };
}

export type DeleteBoardFunction = (input: GetBoardInput) => Promise<void>;

/**
 * https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-delete
 *
 * @param context The Trello API context.
 * @returns A function that deletes a board.
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
 * https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-lists-get
 *
 * @param context The Trello API context.
 * @returns A function that lists all lists on a board.
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
 * https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-cards-get
 *
 * @param context The Trello API context.
 * @returns A function that lists all cards on a board.
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
 * https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-labels-get
 *
 * @param context The Trello API context.
 * @returns A function that lists every label defined on a board.
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
 * https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-members-get
 *
 * @param context The Trello API context.
 * @returns A function that lists all members of a board.
 */
export function listBoardMembers(context: TrelloContext): ListBoardMembersFunction {
  return (input) => context.fetchJson(`/boards/${input.boardId}/members`, 'GET');
}
