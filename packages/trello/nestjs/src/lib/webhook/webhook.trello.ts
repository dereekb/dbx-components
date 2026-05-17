import { handlerConfigurerFactory, handlerFactory, handlerMappedSetFunctionFactory, type Handler, type HandlerBindAccessor, type HandlerMappedSetFunction } from '@dereekb/util';
import { type TrelloWebhookAction, type TrelloWebhookActionType, type TrelloWebhookAddMemberToCardActionData, type TrelloWebhookBoardActionData, type TrelloWebhookCardActionData, type TrelloWebhookCommentCardActionData, type TrelloWebhookEvent, type UntypedTrelloWebhookEvent } from './webhook.trello.type';

/**
 * Action type emitted when a new card is created.
 */
export const TRELLO_WEBHOOK_CREATE_CARD_ACTION_TYPE = 'createCard';

/**
 * Action type emitted when a card is updated.
 */
export const TRELLO_WEBHOOK_UPDATE_CARD_ACTION_TYPE = 'updateCard';

/**
 * Action type emitted when a card is deleted.
 */
export const TRELLO_WEBHOOK_DELETE_CARD_ACTION_TYPE = 'deleteCard';

/**
 * Action type emitted when a comment is added to a card.
 */
export const TRELLO_WEBHOOK_COMMENT_CARD_ACTION_TYPE = 'commentCard';

/**
 * Action type emitted when a member is added to a card.
 */
export const TRELLO_WEBHOOK_ADD_MEMBER_TO_CARD_ACTION_TYPE = 'addMemberToCard';

/**
 * Action type emitted when a member is removed from a card.
 */
export const TRELLO_WEBHOOK_REMOVE_MEMBER_FROM_CARD_ACTION_TYPE = 'removeMemberFromCard';

/**
 * Action type emitted when a board is updated.
 */
export const TRELLO_WEBHOOK_UPDATE_BOARD_ACTION_TYPE = 'updateBoard';

/**
 * Re-narrows an UntypedTrelloWebhookEvent's payload to the given action data type.
 *
 * @param event The untyped event.
 * @returns A typed view over the same event.
 */
export function trelloWebhookEvent<D>(event: UntypedTrelloWebhookEvent): TrelloWebhookEvent<D> {
  return {
    action: event.action as TrelloWebhookAction<D>,
    model: event.model,
    webhook: event.webhook
  };
}

// MARK: Handler
export type TrelloEventHandler = Handler<UntypedTrelloWebhookEvent, TrelloWebhookActionType>;

export const trelloEventHandlerFactory = handlerFactory<UntypedTrelloWebhookEvent>((x) => x.action.type);

export type TrelloHandlerMappedSetFunction<D> = HandlerMappedSetFunction<TrelloWebhookEvent<D>>;

export interface TrelloEventHandlerConfigurer extends HandlerBindAccessor<UntypedTrelloWebhookEvent, TrelloWebhookActionType> {
  handleCreateCard: TrelloHandlerMappedSetFunction<TrelloWebhookCardActionData>;
  handleUpdateCard: TrelloHandlerMappedSetFunction<TrelloWebhookCardActionData>;
  handleDeleteCard: TrelloHandlerMappedSetFunction<TrelloWebhookCardActionData>;
  handleCommentCard: TrelloHandlerMappedSetFunction<TrelloWebhookCommentCardActionData>;
  handleAddMemberToCard: TrelloHandlerMappedSetFunction<TrelloWebhookAddMemberToCardActionData>;
  handleRemoveMemberFromCard: TrelloHandlerMappedSetFunction<TrelloWebhookAddMemberToCardActionData>;
  handleUpdateBoard: TrelloHandlerMappedSetFunction<TrelloWebhookBoardActionData>;
}

export const trelloEventHandlerConfigurerFactory = handlerConfigurerFactory<TrelloEventHandlerConfigurer, UntypedTrelloWebhookEvent>({
  configurerForAccessor: (accessor: HandlerBindAccessor<UntypedTrelloWebhookEvent, TrelloWebhookActionType>) => {
    const fnWithKey = handlerMappedSetFunctionFactory<TrelloWebhookEvent<any>, any>(accessor, trelloWebhookEvent);

    const configurer: TrelloEventHandlerConfigurer = {
      ...accessor,
      handleCreateCard: fnWithKey(TRELLO_WEBHOOK_CREATE_CARD_ACTION_TYPE),
      handleUpdateCard: fnWithKey(TRELLO_WEBHOOK_UPDATE_CARD_ACTION_TYPE),
      handleDeleteCard: fnWithKey(TRELLO_WEBHOOK_DELETE_CARD_ACTION_TYPE),
      handleCommentCard: fnWithKey(TRELLO_WEBHOOK_COMMENT_CARD_ACTION_TYPE),
      handleAddMemberToCard: fnWithKey(TRELLO_WEBHOOK_ADD_MEMBER_TO_CARD_ACTION_TYPE),
      handleRemoveMemberFromCard: fnWithKey(TRELLO_WEBHOOK_REMOVE_MEMBER_FROM_CARD_ACTION_TYPE),
      handleUpdateBoard: fnWithKey(TRELLO_WEBHOOK_UPDATE_BOARD_ACTION_TYPE)
    };

    return configurer;
  }
});
