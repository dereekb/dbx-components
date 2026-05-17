import { type Maybe } from '@dereekb/util';
import { type TrelloActionId, type TrelloBoardId, type TrelloCardId, type TrelloChecklistId, type TrelloLabelId, type TrelloListId, type TrelloMemberId } from '../trello.type';
import { type TrelloLabelColor, type TrelloMaybeDateString, type TrelloPosition } from '../shared/trello.type';
import { type TrelloMember } from './trello.api.member.type';

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
 * Card `badges` summary block. Trello populates ~12 fields here; only the
 * most commonly-read ones are typed. Cast for additional fields.
 *
 * @see https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-get
 */
export interface TrelloCardBadges {
  readonly attachments?: number;
  readonly comments?: number;
  readonly checkItems?: number;
  readonly checkItemsChecked?: number;
  readonly description?: boolean;
  readonly subscribed?: boolean;
  readonly votes?: number;
}

/**
 * Trello card.
 *
 * Only the most commonly-used fields are typed. Use `fields=all` and a custom cast when more are required.
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
  readonly idChecklists: ReadonlyArray<TrelloChecklistId>;
  readonly labels: ReadonlyArray<TrelloLabel>;
  readonly pos: number;
  readonly due: TrelloMaybeDateString;
  readonly dueComplete: boolean;
  readonly start: TrelloMaybeDateString;
  readonly url: string;
  readonly shortUrl: string;
  readonly shortLink: string;
  readonly dateLastActivity: TrelloMaybeDateString;
  readonly badges?: TrelloCardBadges;
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
  /**
   * Member who created the action. Populated when the request includes
   * `member=true` (the default). Omitted otherwise.
   */
  readonly memberCreator?: TrelloMember;
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
