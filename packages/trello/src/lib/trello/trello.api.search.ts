import { type ArrayOrValue, asArray, type Maybe } from '@dereekb/util';
import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type TrelloContext } from './trello.factory';
import { type TrelloBoardId } from '../trello.type';
import { type TrelloSearchModelType, type TrelloSearchResult } from './trello.api.search.type';

export interface SearchTrelloInput {
  /**
   * The search query (1-16384 characters). Supports Trello's search operators, e.g. `board:"My Board" is:open`.
   */
  readonly query: string;
  /**
   * The model types to search, or `all`. Defaults to `all` server-side.
   */
  readonly modelTypes?: Maybe<'all' | ArrayOrValue<TrelloSearchModelType>>;
  /**
   * Boards to restrict the search to, or `mine`.
   */
  readonly idBoards?: Maybe<'mine' | ArrayOrValue<TrelloBoardId>>;
  /**
   * Comma-separated list of card fields to return, or `all`. Sent as `card_fields`.
   */
  readonly cardFields?: Maybe<string>;
  /**
   * Maximum number of cards to return (max 1000). Sent as `cards_limit`.
   */
  readonly cardsLimit?: Maybe<number>;
  /**
   * The page of card results (0-based, max 100). Sent as `cards_page`.
   */
  readonly cardsPage?: Maybe<number>;
  /**
   * Include each card's list. Sent as `card_list`.
   */
  readonly cardList?: Maybe<boolean>;
  /**
   * Comma-separated list of board fields to return, or `all`. Sent as `board_fields`.
   */
  readonly boardFields?: Maybe<string>;
  /**
   * Maximum number of boards to return (max 1000). Sent as `boards_limit`.
   */
  readonly boardsLimit?: Maybe<number>;
  /**
   * Maximum number of members to return (max 1000). Sent as `members_limit`.
   */
  readonly membersLimit?: Maybe<number>;
  /**
   * Match the query as a prefix of words ("partial" matching).
   */
  readonly partial?: Maybe<boolean>;
}

export type SearchTrelloFunction = (input: SearchTrelloInput) => Promise<TrelloSearchResult>;

/**
 * Https://developer.atlassian.com/cloud/trello/rest/api-group-search/#api-search-get.
 *
 * @param context - The Trello API context.
 * @returns Searches the boards, cards, members and actions the authenticated user can see.
 */
export function searchTrello(context: TrelloContext): SearchTrelloFunction {
  return (input) => {
    const { query, modelTypes, idBoards, cardFields, cardsLimit, cardsPage, cardList, boardFields, boardsLimit, membersLimit, partial } = input;
    const queryString = makeUrlSearchParams({
      query,
      modelTypes: modelTypes ? asArray(modelTypes).join(',') : undefined,
      idBoards: idBoards ? asArray(idBoards).join(',') : undefined,
      card_fields: cardFields,
      cards_limit: cardsLimit,
      cards_page: cardsPage,
      card_list: cardList,
      board_fields: boardFields,
      boards_limit: boardsLimit,
      members_limit: membersLimit,
      partial
    });

    return context.fetchJson(`/search?${queryString}`, 'GET');
  };
}
