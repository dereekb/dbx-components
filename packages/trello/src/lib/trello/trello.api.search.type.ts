import { type TrelloBoard } from './trello.api.board.type';
import { type TrelloAction, type TrelloCard } from './trello.api.card.type';
import { type TrelloMember } from './trello.api.member.type';

/**
 * A model type {@link searchTrello} can search.
 */
export type TrelloSearchModelType = 'actions' | 'boards' | 'cards' | 'members' | 'organizations';

/**
 * The result of a Trello search. Each collection is present only when its model type was searched.
 *
 * @see https://developer.atlassian.com/cloud/trello/rest/api-group-search/#api-search-get
 */
export interface TrelloSearchResult {
  readonly options?: unknown;
  readonly cards?: ReadonlyArray<TrelloCard>;
  readonly boards?: ReadonlyArray<TrelloBoard>;
  readonly members?: ReadonlyArray<TrelloMember>;
  readonly actions?: ReadonlyArray<TrelloAction>;
  readonly organizations?: ReadonlyArray<unknown>;
}
