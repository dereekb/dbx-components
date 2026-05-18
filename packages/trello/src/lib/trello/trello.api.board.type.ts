import { type Maybe } from '@dereekb/util';
import { type TrelloBoardId, type TrelloOrganizationId } from '../trello.type';
import { type TrelloMaybeDateString } from '../shared/trello.type';

/**
 * Trello board.
 *
 * Only the most commonly-used fields are typed. Use `fields=all` and a custom cast when more are required.
 *
 * @see https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-get
 */
export interface TrelloBoard {
  readonly id: TrelloBoardId;
  readonly name: string;
  readonly desc: string;
  readonly closed: boolean;
  readonly idOrganization: Maybe<TrelloOrganizationId>;
  readonly url: string;
  readonly shortUrl: string;
  readonly pinned?: boolean;
  readonly starred?: boolean;
  readonly subscribed?: boolean;
  readonly dateLastActivity: TrelloMaybeDateString;
  readonly dateLastView?: TrelloMaybeDateString;
}

/**
 * Permission level for a Trello board.
 */
export type TrelloBoardPermissionLevel = 'private' | 'org' | 'public';

/**
 * Background preset name or custom background id returned by the API.
 *
 * Common preset values: `blue`, `orange`, `green`, `red`, `purple`, `pink`, `lime`, `sky`, `grey`.
 */
export type TrelloBoardBackground = string; // NOSONAR (S6564 — intentional semantic alias)

export interface CreateBoardBody {
  /**
   * The new board's name. Required. 1-16384 characters.
   */
  readonly name: string;
  /**
   * Optional board description.
   */
  readonly desc?: string;
  /**
   * Determines whether to use the default set of lists for the board (To Do, Doing, Done).
   *
   * Defaults to true.
   */
  readonly defaultLists?: boolean;
  /**
   * Determines whether to use the default set of labels for the board.
   *
   * Defaults to true.
   */
  readonly defaultLabels?: boolean;
  /**
   * The id of the organization the board should belong to.
   */
  readonly idOrganization?: TrelloOrganizationId;
  /**
   * The permission level. Defaults to private.
   */
  readonly prefs_permissionLevel?: TrelloBoardPermissionLevel;
  /**
   * Background of the board.
   */
  readonly prefs_background?: TrelloBoardBackground;
}

export interface UpdateBoardBody {
  readonly name?: string;
  readonly desc?: string;
  readonly closed?: boolean;
  readonly subscribed?: boolean;
  readonly idOrganization?: TrelloOrganizationId;
  readonly 'prefs/permissionLevel'?: TrelloBoardPermissionLevel;
  readonly 'prefs/background'?: TrelloBoardBackground;
}
