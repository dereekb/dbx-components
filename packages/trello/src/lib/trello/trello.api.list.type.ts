import { type TrelloBoardId, type TrelloListId } from '../trello.type';
import { type TrelloPosition } from '../shared/trello.type';

/**
 * Trello list.
 *
 * @see https://developer.atlassian.com/cloud/trello/rest/api-group-lists/#api-lists-id-get
 */
export interface TrelloList {
  readonly id: TrelloListId;
  readonly name: string;
  readonly closed: boolean;
  readonly idBoard: TrelloBoardId;
  readonly pos: number;
  readonly subscribed?: boolean;
}

export interface CreateListBody {
  /**
   * Name of the list (1-16384 characters).
   */
  readonly name: string;
  /**
   * The id of the board the list belongs to. Required.
   */
  readonly idBoard: TrelloBoardId;
  /**
   * The id of the list to copy from. Cannot be used with `idBoard`.
   */
  readonly idListSource?: TrelloListId;
  /**
   * Position of the list (top, bottom, or a positive number).
   */
  readonly pos?: TrelloPosition;
}

export interface UpdateListBody {
  readonly name?: string;
  readonly closed?: boolean;
  readonly idBoard?: TrelloBoardId;
  readonly pos?: TrelloPosition;
  readonly subscribed?: boolean;
}
