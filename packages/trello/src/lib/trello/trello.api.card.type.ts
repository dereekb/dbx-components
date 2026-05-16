import { type Maybe } from '@dereekb/util';
import { type TrelloActionId, type TrelloBoardId, type TrelloCardId, type TrelloLabelId, type TrelloListId, type TrelloMemberId } from '../trello.type';
import { type TrelloLabelColor, type TrelloMaybeDateString, type TrelloPosition } from '../shared/trello.type';

/**
 * Trello label.
 */
export interface TrelloLabel {
  readonly id: TrelloLabelId;
  readonly idBoard: TrelloBoardId;
  readonly name: string;
  readonly color: Maybe<TrelloLabelColor>;
}

/**
 * Trello card.
 *
 * @see https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-get
 */
export interface TrelloCard {
  readonly id: TrelloCardId;
  readonly name: string;
  readonly desc: string;
  readonly closed: boolean;
  readonly idBoard: TrelloBoardId;
  readonly idList: TrelloListId;
  readonly idMembers: ReadonlyArray<TrelloMemberId>;
  readonly idLabels: ReadonlyArray<TrelloLabelId>;
  readonly labels: ReadonlyArray<TrelloLabel>;
  readonly pos: number;
  readonly due: TrelloMaybeDateString;
  readonly dueComplete: boolean;
  readonly start: TrelloMaybeDateString;
  readonly url: string;
  readonly shortUrl: string;
  readonly shortLink: string;
  readonly subscribed?: boolean;
}

export interface CreateCardBody {
  /**
   * The id of the list the card should be created on. Required.
   */
  readonly idList: TrelloListId;
  /**
   * Card name (1-16384 characters).
   */
  readonly name?: string;
  /**
   * Card description.
   */
  readonly desc?: string;
  /**
   * Position on the list.
   */
  readonly pos?: TrelloPosition;
  /**
   * Optional comma-separated list of label ids.
   */
  readonly idLabels?: ReadonlyArray<TrelloLabelId>;
  /**
   * Optional comma-separated list of member ids.
   */
  readonly idMembers?: ReadonlyArray<TrelloMemberId>;
  /**
   * Optional due date as an ISO date string.
   */
  readonly due?: TrelloMaybeDateString;
  /**
   * Optional start date as an ISO date string.
   */
  readonly start?: TrelloMaybeDateString;
}

export interface UpdateCardBody {
  readonly name?: string;
  readonly desc?: string;
  readonly closed?: boolean;
  readonly idList?: TrelloListId;
  readonly idBoard?: TrelloBoardId;
  readonly idLabels?: ReadonlyArray<TrelloLabelId>;
  readonly idMembers?: ReadonlyArray<TrelloMemberId>;
  readonly due?: TrelloMaybeDateString;
  readonly dueComplete?: boolean;
  readonly start?: TrelloMaybeDateString;
  readonly pos?: TrelloPosition;
  readonly subscribed?: boolean;
}

/**
 * A Trello action (i.e. an immutable activity log entry).
 *
 * Comments are surfaced as actions with `type === 'commentCard'`.
 *
 * @see https://developer.atlassian.com/cloud/trello/rest/api-group-actions/
 */
export interface TrelloAction<D = unknown> {
  readonly id: TrelloActionId;
  readonly idMemberCreator: TrelloMemberId;
  readonly type: string;
  readonly date: string;
  readonly data: D;
}

export interface TrelloCommentCardActionData {
  readonly text: string;
  readonly card: {
    readonly id: TrelloCardId;
    readonly idShort?: number;
    readonly name?: string;
  };
  readonly board: { readonly id: TrelloBoardId; readonly name?: string };
  readonly list?: { readonly id: TrelloListId; readonly name?: string };
}

export type TrelloCommentCardAction = TrelloAction<TrelloCommentCardActionData>;
