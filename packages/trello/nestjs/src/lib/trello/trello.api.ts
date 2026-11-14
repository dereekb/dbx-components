import { Inject, Injectable } from '@nestjs/common';
import {
  addAttachmentToCard,
  addCheckItemToChecklist,
  addChecklistToCard,
  addCommentToCard,
  addLabelToCard,
  addMemberToCard,
  createBoard,
  createCard,
  createList,
  createWebhook,
  deleteAttachmentFromCard,
  deleteBoard,
  deleteCard,
  deleteCheckItemFromCard,
  deleteChecklist,
  deleteCommentOnCard,
  deleteWebhook,
  downloadCardAttachment,
  getBoard,
  getCard,
  getCardAttachment,
  getChecklist,
  getList,
  getMe,
  getMember,
  getWebhook,
  listBoardActions,
  listBoardCards,
  listBoardLabels,
  listBoardLists,
  listBoardMembers,
  listCardActions,
  listCardAttachments,
  listCardChecklists,
  listCardsInList,
  listMemberBoards,
  listWebhooksForToken,
  removeLabelFromCard,
  removeMemberFromCard,
  searchTrello,
  trelloFactory,
  updateBoard,
  updateCard,
  updateCardCheckItem,
  updateChecklist,
  updateCommentOnCard,
  updateList,
  updateWebhook,
  type Trello,
  type TrelloContext
} from '@dereekb/trello';
import { TrelloServiceConfig } from './trello.config';

@Injectable()
export class TrelloApi {
  readonly trello: Trello;

  get trelloContext(): TrelloContext {
    return this.trello.trelloContext;
  }

  get trelloRateLimiter() {
    return this.trello.trelloContext.trelloRateLimiter;
  }

  constructor(@Inject(TrelloServiceConfig) readonly config: TrelloServiceConfig) {
    this.trello = trelloFactory(config.factoryConfig)(config.trello);
  }

  // MARK: Boards
  get getBoard() {
    return getBoard(this.trelloContext);
  }

  get createBoard() {
    return createBoard(this.trelloContext);
  }

  get updateBoard() {
    return updateBoard(this.trelloContext);
  }

  get deleteBoard() {
    return deleteBoard(this.trelloContext);
  }

  get listBoardLists() {
    return listBoardLists(this.trelloContext);
  }

  get listBoardCards() {
    return listBoardCards(this.trelloContext);
  }

  get listBoardMembers() {
    return listBoardMembers(this.trelloContext);
  }

  get listBoardLabels() {
    return listBoardLabels(this.trelloContext);
  }

  get listBoardActions() {
    return listBoardActions(this.trelloContext);
  }

  // MARK: Lists
  get getList() {
    return getList(this.trelloContext);
  }

  get createList() {
    return createList(this.trelloContext);
  }

  get updateList() {
    return updateList(this.trelloContext);
  }

  get listCardsInList() {
    return listCardsInList(this.trelloContext);
  }

  // MARK: Cards
  get getCard() {
    return getCard(this.trelloContext);
  }

  get createCard() {
    return createCard(this.trelloContext);
  }

  get updateCard() {
    return updateCard(this.trelloContext);
  }

  get deleteCard() {
    return deleteCard(this.trelloContext);
  }

  get addCommentToCard() {
    return addCommentToCard(this.trelloContext);
  }

  get addMemberToCard() {
    return addMemberToCard(this.trelloContext);
  }

  get addLabelToCard() {
    return addLabelToCard(this.trelloContext);
  }

  get listCardActions() {
    return listCardActions(this.trelloContext);
  }

  get removeLabelFromCard() {
    return removeLabelFromCard(this.trelloContext);
  }

  get removeMemberFromCard() {
    return removeMemberFromCard(this.trelloContext);
  }

  get updateCommentOnCard() {
    return updateCommentOnCard(this.trelloContext);
  }

  get deleteCommentOnCard() {
    return deleteCommentOnCard(this.trelloContext);
  }

  // MARK: Card Attachments
  get listCardAttachments() {
    return listCardAttachments(this.trelloContext);
  }

  get getCardAttachment() {
    return getCardAttachment(this.trelloContext);
  }

  get addAttachmentToCard() {
    return addAttachmentToCard(this.trelloContext);
  }

  get deleteAttachmentFromCard() {
    return deleteAttachmentFromCard(this.trelloContext);
  }

  get downloadCardAttachment() {
    return downloadCardAttachment(this.trelloContext);
  }

  // MARK: Card Checklists
  get listCardChecklists() {
    return listCardChecklists(this.trelloContext);
  }

  get getChecklist() {
    return getChecklist(this.trelloContext);
  }

  get addChecklistToCard() {
    return addChecklistToCard(this.trelloContext);
  }

  get updateChecklist() {
    return updateChecklist(this.trelloContext);
  }

  get deleteChecklist() {
    return deleteChecklist(this.trelloContext);
  }

  get addCheckItemToChecklist() {
    return addCheckItemToChecklist(this.trelloContext);
  }

  get updateCardCheckItem() {
    return updateCardCheckItem(this.trelloContext);
  }

  get deleteCheckItemFromCard() {
    return deleteCheckItemFromCard(this.trelloContext);
  }

  // MARK: Members
  get getMember() {
    return getMember(this.trelloContext);
  }

  get getMe() {
    return getMe(this.trelloContext);
  }

  get listMemberBoards() {
    return listMemberBoards(this.trelloContext);
  }

  // MARK: Search
  get searchTrello() {
    return searchTrello(this.trelloContext);
  }

  // MARK: Webhooks
  get createWebhook() {
    return createWebhook(this.trelloContext);
  }

  get getWebhook() {
    return getWebhook(this.trelloContext);
  }

  get updateWebhook() {
    return updateWebhook(this.trelloContext);
  }

  get deleteWebhook() {
    return deleteWebhook(this.trelloContext);
  }

  get listWebhooksForToken() {
    return listWebhooksForToken(this.trelloContext);
  }
}
