import { type TrelloBoardId, type TrelloCardId, type TrelloId, type TrelloListId, type TrelloMemberId, type TrelloOrganizationId, type TrelloWebhookId } from '@dereekb/trello';

/**
 * Trello webhook action type, e.g. `createCard`, `updateCard`, `addMemberToCard`.
 *
 * The full set is large; consult the API reference for the active list.
 *
 * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/object-definitions/#action-types
 */
export type TrelloWebhookActionType = string;

/**
 * The minimal shape of a Trello webhook action.
 */
export interface TrelloWebhookAction<D = unknown> {
  readonly id: TrelloId;
  readonly type: TrelloWebhookActionType;
  readonly date: string;
  readonly idMemberCreator: TrelloMemberId;
  readonly data: D;
}

/**
 * Trello webhook model — the object the webhook is subscribed to.
 *
 * The shape varies depending on the model type (board, card, list, member, etc.).
 */
export interface TrelloWebhookModel {
  readonly id: TrelloId;
  readonly [key: string]: unknown;
}

/**
 * Webhook configuration object included in the POST body.
 */
export interface TrelloWebhookEventWebhook {
  readonly id: TrelloWebhookId;
  readonly idModel: TrelloId;
  readonly callbackURL: string;
  readonly description: string;
  readonly active: boolean;
}

/**
 * Trello webhook POST body shape.
 *
 * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/#receiving-webhook-events
 */
export interface TrelloWebhookEvent<D = unknown> {
  readonly action: TrelloWebhookAction<D>;
  readonly model: TrelloWebhookModel;
  readonly webhook: TrelloWebhookEventWebhook;
}

export type UntypedTrelloWebhookEvent = TrelloWebhookEvent<unknown>;

// MARK: Common payload shapes
export interface TrelloWebhookCardActionData {
  readonly card: { readonly id: TrelloCardId; readonly name?: string; readonly idShort?: number };
  readonly board: { readonly id: TrelloBoardId; readonly name?: string };
  readonly list?: { readonly id: TrelloListId; readonly name?: string };
  readonly old?: Record<string, unknown>;
}

export interface TrelloWebhookCommentCardActionData extends TrelloWebhookCardActionData {
  readonly text: string;
}

export interface TrelloWebhookAddMemberToCardActionData extends TrelloWebhookCardActionData {
  readonly idMember: TrelloMemberId;
  readonly member: { readonly id: TrelloMemberId; readonly name?: string };
}

export interface TrelloWebhookBoardActionData {
  readonly board: { readonly id: TrelloBoardId; readonly name?: string };
  readonly organization?: { readonly id: TrelloOrganizationId; readonly name?: string };
}
