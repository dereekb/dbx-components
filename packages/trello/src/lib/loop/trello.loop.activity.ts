import { type Maybe } from '@dereekb/util';
import { type TrelloActionId, type TrelloBoardId } from '../trello.type';
import { TRELLO_MAX_PAGE_LIMIT } from '../trello.api.page';
import { type TrelloContextRef } from '../trello/trello.factory';
import { listBoardActions } from '../trello/trello.api.board';
import { type TrelloAction } from '../trello/trello.api.card.type';
import { type TrelloActionType } from '../trello/trello.api.card';

/**
 * Default page count cap for {@link listTrelloBoardActivitySince}.
 */
export const DEFAULT_TRELLO_BOARD_ACTIVITY_MAX_PAGES = 5;

/**
 * Input for {@link listTrelloBoardActivitySince}.
 */
export interface ListTrelloBoardActivitySinceInput extends TrelloContextRef {
  readonly boardId: TrelloBoardId;
  /**
   * The watermark from the previous call (an action id), or an ISO 8601 date. Only newer actions are returned. When
   * omitted, the newest page of actions is returned.
   */
  readonly since?: Maybe<string>;
  /**
   * Comma-separated action types, e.g. `commentCard,updateCard:idList`. Defaults to every type.
   */
  readonly filter?: Maybe<TrelloActionType>;
  /**
   * Actions per request. Defaults to (and is capped at) {@link TRELLO_MAX_PAGE_LIMIT}.
   */
  readonly pageSize?: Maybe<number>;
  /**
   * The most requests to make. Defaults to {@link DEFAULT_TRELLO_BOARD_ACTIVITY_MAX_PAGES}. When the cap is hit before
   * the `since` cursor is reached, the result is `truncated`.
   */
  readonly maxPages?: Maybe<number>;
}

/**
 * The result of {@link listTrelloBoardActivitySince}.
 */
export interface TrelloBoardActivity<D = unknown> {
  /**
   * The actions newer than `since`, oldest first.
   */
  readonly actions: readonly TrelloAction<D>[];
  /**
   * The id of the newest action seen, or the input `since` when there were none. Pass it as `since` next time.
   */
  readonly watermark: Maybe<TrelloActionId | string>;
  /**
   * `true` when the page cap stopped the walk before every action since the watermark was read. The oldest actions in
   * the window are the ones missing; the watermark is still the newest action, so a caller that needs every action
   * should re-snapshot the board instead of trusting the activity feed.
   */
  readonly truncated: boolean;
}

/**
 * Reads a board's activity feed since a watermark, walking back with Trello's `before` cursor until the watermark is
 * reached or the page cap is hit.
 *
 * Trello answers `since` with the NEWEST actions first, so a busy window spans several pages: the first page holds the
 * newest actions and each following page (`before` = the oldest id so far) goes further back toward `since`.
 *
 * @param input - The Trello context, the board, the watermark, and the paging limits.
 * @returns The actions (oldest first), the next watermark, and whether the walk was truncated.
 */
export async function listTrelloBoardActivitySince<D = unknown>(input: ListTrelloBoardActivitySinceInput): Promise<TrelloBoardActivity<D>> {
  const { trelloContext, boardId, since } = input;
  const pageSize = Math.min(Math.max(1, input.pageSize ?? TRELLO_MAX_PAGE_LIMIT), TRELLO_MAX_PAGE_LIMIT);
  const maxPages = Math.max(1, input.maxPages ?? DEFAULT_TRELLO_BOARD_ACTIVITY_MAX_PAGES);
  const filter = input.filter ?? undefined;
  const newestFirst: TrelloAction<D>[] = [];
  const seen = new Set<TrelloActionId>();
  let before: Maybe<TrelloActionId>;
  let pages = 0;
  let exhausted = false;

  while (!exhausted && pages < maxPages) {
    const page = await listBoardActions(trelloContext)<D>({ boardId, filter, limit: pageSize, since: since ?? undefined, before: before ?? undefined });
    pages += 1;

    for (const action of page) {
      if (!seen.has(action.id) && action.id !== since) {
        seen.add(action.id);
        newestFirst.push(action);
      }
    }

    // Without a `since` there is nothing to walk back to: the newest page is the answer.
    exhausted = page.length < pageSize || since == null;
    before = page.at(-1)?.id;
  }

  const watermark = newestFirst[0]?.id ?? since ?? null;
  return { actions: newestFirst.toReversed(), watermark, truncated: !exhausted };
}
