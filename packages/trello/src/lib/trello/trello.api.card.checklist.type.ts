import { type Maybe } from '@dereekb/util';
import { type TrelloBoardId, type TrelloCardId, type TrelloChecklistId, type TrelloCheckItemId, type TrelloMemberId } from '../trello.type';
import { type TrelloMaybeDateString, type TrelloPosition } from '../shared/trello.type';

/**
 * The state of a checklist item.
 */
export type TrelloCheckItemState = 'complete' | 'incomplete';

/**
 * A single item on a Trello checklist.
 *
 * @see https://developer.atlassian.com/cloud/trello/rest/api-group-checklists/#api-checklists-id-checkitems-get
 */
export interface TrelloCheckItem {
  readonly id: TrelloCheckItemId;
  readonly idChecklist: TrelloChecklistId;
  readonly name: string;
  readonly pos: number;
  readonly state: TrelloCheckItemState;
  readonly due?: TrelloMaybeDateString;
  /**
   * Minutes before `due` to send a reminder, or `null`/`-1` for none.
   */
  readonly dueReminder?: Maybe<number>;
  /**
   * The member the item is assigned to, if any.
   */
  readonly idMember?: Maybe<TrelloMemberId>;
  /**
   * Trello's rich-name metadata (emoji, mentions). Shape is undocumented.
   */
  readonly nameData?: unknown;
}

/**
 * A Trello checklist on a card.
 *
 * @see https://developer.atlassian.com/cloud/trello/rest/api-group-checklists/#api-checklists-id-get
 */
export interface TrelloChecklist {
  readonly id: TrelloChecklistId;
  readonly name: string;
  readonly idBoard: TrelloBoardId;
  readonly idCard: TrelloCardId;
  readonly pos: number;
  /**
   * The checklist's items. Omitted when the request asked for `checkItems: 'none'`.
   */
  readonly checkItems?: ReadonlyArray<TrelloCheckItem>;
}

export interface AddChecklistToCardBody {
  readonly name?: string;
  readonly pos?: TrelloPosition;
  /**
   * An existing checklist to copy into the new one.
   */
  readonly idChecklistSource?: TrelloChecklistId;
}

export interface UpdateChecklistBody {
  readonly name?: string;
  readonly pos?: TrelloPosition;
}

export interface AddCheckItemToChecklistBody {
  readonly name: string;
  readonly pos?: TrelloPosition;
  /**
   * Whether the new item starts complete.
   */
  readonly checked?: boolean;
  readonly due?: TrelloMaybeDateString;
  readonly dueReminder?: Maybe<number>;
  readonly idMember?: Maybe<TrelloMemberId>;
}

export interface UpdateCardCheckItemBody {
  readonly name?: string;
  readonly state?: TrelloCheckItemState;
  /**
   * Moves the item to another checklist on the same card.
   */
  readonly idChecklist?: TrelloChecklistId;
  readonly pos?: TrelloPosition;
  /**
   * ISO date string, or `null` to clear it.
   */
  readonly due?: TrelloMaybeDateString;
  /**
   * Minutes before the due date to send a reminder, or `null` to clear it.
   */
  readonly dueReminder?: Maybe<number>;
  /**
   * The member assigned to the item, or `null` to clear it.
   */
  readonly idMember?: Maybe<TrelloMemberId>;
}
