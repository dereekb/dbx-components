import { type Maybe } from '@dereekb/util';
import { type TrelloActionId, type TrelloBoardId, type TrelloCardId, type TrelloChecklistId, type TrelloLabelId, type TrelloListId, type TrelloMemberId } from '../trello.type';
import { type TrelloLabelColor, type TrelloMaybeDateString, type TrelloPosition } from '../shared/trello.type';
import { type TrelloMember } from './trello.api.member.type';
import { type TrelloAttachment } from './trello.api.card.attachment.type';
import { type TrelloChecklist } from './trello.api.card.checklist.type';
import { type TrelloBoard } from './trello.api.board.type';
import { type TrelloList } from './trello.api.list.type';

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
  readonly name?: string | undefined;
  /**
   * Card description.
   */
  readonly desc?: string | undefined;
  /**
   * Position on the list.
   */
  readonly pos?: TrelloPosition | undefined;
  /**
   * Optional comma-separated list of label ids.
   */
  readonly idLabels?: ReadonlyArray<TrelloLabelId> | undefined;
  /**
   * Optional comma-separated list of member ids.
   */
  readonly idMembers?: ReadonlyArray<TrelloMemberId> | undefined;
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
  readonly name?: string | undefined;
  readonly desc?: string | undefined;
  readonly closed?: boolean | undefined;
  readonly idList?: TrelloListId | undefined;
  readonly idBoard?: TrelloBoardId | undefined;
  readonly idLabels?: ReadonlyArray<TrelloLabelId> | undefined;
  readonly idMembers?: ReadonlyArray<TrelloMemberId> | undefined;
  /**
   * ISO date string, or `null` to clear it.
   */
  readonly due?: TrelloMaybeDateString;
  readonly dueComplete?: boolean | undefined;
  /**
   * ISO date string, or `null` to clear it.
   */
  readonly start?: TrelloMaybeDateString;
  readonly pos?: TrelloPosition | undefined;
  readonly subscribed?: boolean | undefined;
}

/**
 * A Trello action (i.e. an immutable activity log entry).
 *
 * Comments are surfaced as actions with `type === 'commentCard'`.
 *
 * @see https://developer.atlassian.com/cloud/trello/rest/api-group-actions/
 */
/**
 * A custom field value on a card.
 *
 * @see https://developer.atlassian.com/cloud/trello/rest/api-group-customfielditems/
 */
export interface TrelloCustomFieldItem {
  readonly id: string;
  readonly idCustomField: string;
  readonly idModel: string;
  readonly value?: Maybe<Record<string, string>>;
  readonly idValue?: Maybe<string>;
}

/**
 * A card plus the nested resources `getCard` can expand. Each expansion is present only when it was requested.
 */
export interface TrelloCardWithExpansions extends TrelloCard {
  readonly attachments?: ReadonlyArray<TrelloAttachment>;
  readonly checklists?: ReadonlyArray<TrelloChecklist>;
  readonly members?: ReadonlyArray<TrelloMember>;
  readonly actions?: ReadonlyArray<TrelloAction>;
  readonly board?: TrelloBoard;
  readonly list?: TrelloList;
  readonly customFieldItems?: ReadonlyArray<TrelloCustomFieldItem>;
}

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
  /**
   * The app (Power-Up or REST client) that created the action, or `null` when a person acted in Trello itself.
   */
  readonly appCreator?: Maybe<TrelloActionAppCreator>;
}

/**
 * The app that created a {@link TrelloAction}.
 */
export interface TrelloActionAppCreator {
  readonly id: string;
  readonly name?: Maybe<string>;
  readonly idPlugin?: Maybe<string>;
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

/**
 * Payload of an `updateCard:idList` action — emitted by Trello whenever a card moves between lists.
 *
 * Pair with `listBoardActions(...)<TrelloUpdateCardIdListActionData>({ filter: 'updateCard:idList', ... })`
 * to audit list movements.
 */
export interface TrelloUpdateCardIdListActionData {
  readonly card: {
    readonly id: TrelloCardId;
    readonly idShort?: number;
    readonly name?: string;
    readonly shortLink?: string;
  };
  readonly old?: { readonly idList?: TrelloListId };
  readonly listAfter?: { readonly id: TrelloListId; readonly name?: string };
  readonly listBefore?: { readonly id: TrelloListId; readonly name?: string };
  readonly board?: { readonly id: TrelloBoardId; readonly name?: string };
}

export type TrelloUpdateCardIdListAction = TrelloAction<TrelloUpdateCardIdListActionData>;
