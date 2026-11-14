import { type Maybe } from '@dereekb/util';
import { type TrelloBoardId, type TrelloCardId, type TrelloLabelId, type TrelloListId } from '../trello.type';
import { TRELLO_MAX_PAGE_LIMIT } from '../trello.api.page';
import { type TrelloContextRef } from '../trello/trello.factory';
import { listBoardCards, listBoardLabels, listBoardLists, type ListBoardCardsInput } from '../trello/trello.api.board';
import { type TrelloCard } from '../trello/trello.api.card.type';
import { type TrelloLabelColor } from '../shared/trello.type';

/**
 * Card fields {@link fetchTrelloBoardSnapshot} requests — just enough to fingerprint and diff a card.
 */
export const TRELLO_BOARD_SNAPSHOT_CARD_FIELDS = 'id,name,idList,idLabels,closed,dateLastActivity,shortLink,badges';

/**
 * One card as captured by a {@link TrelloBoardSnapshot}.
 */
export interface TrelloBoardSnapshotCard {
  readonly id: TrelloCardId;
  readonly shortLink: string;
  readonly name: string;
  readonly idList: TrelloListId;
  /**
   * The card's label ids, sorted so two snapshots compare without regard to Trello's ordering.
   */
  readonly idLabels: readonly TrelloLabelId[];
  readonly closed: boolean;
  readonly dateLastActivity: Maybe<string>;
  /**
   * The card's comment count (`badges.comments`). An increase between two snapshots is reported as `commented`.
   */
  readonly commentCount: number;
  /**
   * The {@link trelloCardFingerprint} of the card when it was captured.
   */
  readonly fingerprint: string;
}

/**
 * One list as captured by a {@link TrelloBoardSnapshot}.
 */
export interface TrelloBoardSnapshotList {
  readonly id: TrelloListId;
  readonly name: string;
  readonly closed: boolean;
}

/**
 * One label as captured by a {@link TrelloBoardSnapshot}.
 */
export interface TrelloBoardSnapshotLabel {
  readonly id: TrelloLabelId;
  readonly name: string;
  readonly color: Maybe<TrelloLabelColor>;
}

/**
 * A JSON-serializable picture of a board at one moment: its lists, labels and cards. Save it between runs and pass the
 * old and new snapshots to {@link diffTrelloBoardSnapshots} to learn what changed.
 */
export interface TrelloBoardSnapshot {
  readonly boardId: TrelloBoardId;
  /**
   * ISO 8601 time the snapshot was taken.
   */
  readonly fetchedAt: string;
  /**
   * The card filter the snapshot was taken with. Two snapshots taken with different filters do not diff meaningfully.
   */
  readonly cardFilter: NonNullable<ListBoardCardsInput['filter']>;
  readonly lists: readonly TrelloBoardSnapshotList[];
  readonly labels: readonly TrelloBoardSnapshotLabel[];
  /**
   * Cards sorted by id.
   */
  readonly cards: readonly TrelloBoardSnapshotCard[];
}

/**
 * Input for {@link fetchTrelloBoardSnapshot}.
 */
export interface FetchTrelloBoardSnapshotInput extends TrelloContextRef {
  readonly boardId: TrelloBoardId;
  /**
   * Which cards to capture. Defaults to `visible` (open cards on open lists), so an archived card drops out and is
   * reported as `removed`. Pass `all` to keep archived cards in the snapshot, so archiving is reported as `closed`.
   */
  readonly cardFilter?: Maybe<NonNullable<ListBoardCardsInput['filter']>>;
  /**
   * Clock override for `fetchedAt`.
   */
  readonly now?: Maybe<() => Date>;
}

/**
 * Builds the cheap per-card key that changes whenever anything mechanically interesting happens to a card: activity,
 * a list move, a label change or archival. Two equal fingerprints mean a caller can skip re-reading the card.
 *
 * @param card - The card, as returned by any card read.
 * @returns The fingerprint string.
 */
export function trelloCardFingerprint(card: Pick<TrelloCard, 'dateLastActivity' | 'idList' | 'idLabels' | 'closed'>): string {
  const labelIds = [...(card.idLabels ?? [])].sort((a, b) => a.localeCompare(b)).join(',');
  return [card.dateLastActivity ?? '', card.idList ?? '', labelIds, card.closed ? '1' : '0'].join('|');
}

/**
 * Captures one card for a {@link TrelloBoardSnapshot}.
 *
 * @param card - The card to capture.
 * @returns The snapshot entry.
 */
export function trelloBoardSnapshotCard(card: TrelloCard): TrelloBoardSnapshotCard {
  return {
    id: card.id,
    shortLink: card.shortLink,
    name: card.name,
    idList: card.idList,
    idLabels: [...(card.idLabels ?? [])].sort((a, b) => a.localeCompare(b)),
    closed: card.closed === true,
    dateLastActivity: card.dateLastActivity ?? null,
    commentCount: card.badges?.comments ?? 0,
    fingerprint: trelloCardFingerprint(card)
  };
}

/**
 * Reads a board's lists, labels and cards in parallel and captures them as a {@link TrelloBoardSnapshot}. Three
 * requests, no matter how many cards the board has.
 *
 * @param input - The Trello context, the board, and the card filter.
 * @returns The snapshot.
 */
export async function fetchTrelloBoardSnapshot(input: FetchTrelloBoardSnapshotInput): Promise<TrelloBoardSnapshot> {
  const { trelloContext, boardId } = input;
  const cardFilter = input.cardFilter ?? 'visible';
  const [lists, labels, cards] = await Promise.all([listBoardLists(trelloContext)({ boardId }), listBoardLabels(trelloContext)({ boardId, limit: TRELLO_MAX_PAGE_LIMIT }), listBoardCards(trelloContext)({ boardId, filter: cardFilter, fields: TRELLO_BOARD_SNAPSHOT_CARD_FIELDS })]);

  return {
    boardId,
    fetchedAt: (input.now?.() ?? new Date()).toISOString(),
    cardFilter,
    lists: lists.map((list) => ({ id: list.id, name: list.name, closed: list.closed === true })),
    labels: labels.map((label) => ({ id: label.id, name: label.name, color: label.color ?? null })),
    cards: cards.map(trelloBoardSnapshotCard).sort((a, b) => a.id.localeCompare(b.id))
  };
}

/**
 * The kinds of card change {@link diffTrelloBoardSnapshots} reports.
 */
export type TrelloBoardChangeType = 'added' | 'removed' | 'closed' | 'reopened' | 'moved' | 'relabeled' | 'renamed' | 'commented';

/**
 * One card change between two snapshots. A card that changed in several ways yields one change per way, in the order
 * of {@link TrelloBoardChangeType}.
 */
export interface TrelloBoardChange {
  readonly type: TrelloBoardChangeType;
  readonly cardId: TrelloCardId;
  readonly shortLink: string;
  /**
   * The card's current name (its last known name for `removed`).
   */
  readonly name: string;
  /**
   * `moved`: the list the card left. `added` / `removed`: the list it is (was) on.
   */
  readonly fromListId?: TrelloListId;
  readonly fromListName?: string;
  /**
   * `moved`: the list the card arrived on.
   */
  readonly toListId?: TrelloListId;
  readonly toListName?: string;
  /**
   * `relabeled`: label ids added and removed.
   */
  readonly addedLabelIds?: readonly TrelloLabelId[];
  readonly removedLabelIds?: readonly TrelloLabelId[];
  /**
   * `renamed`: the card's previous name.
   */
  readonly previousName?: string;
  /**
   * `commented`: how many comments were added since the previous snapshot.
   */
  readonly newCommentCount?: number;
}

/**
 * The result of {@link diffTrelloBoardSnapshots}.
 */
export interface TrelloBoardSnapshotDiff {
  readonly boardId: TrelloBoardId;
  /**
   * `fetchedAt` of the older snapshot, or `null` when there was none.
   */
  readonly from: Maybe<string>;
  /**
   * `fetchedAt` of the newer snapshot.
   */
  readonly to: string;
  readonly changes: readonly TrelloBoardChange[];
}

/**
 * Compares two snapshots of the same board and reports every card that was added, removed, closed, reopened, moved,
 * relabeled, renamed or commented on. With no previous snapshot, every card in `next` is reported as `added`.
 *
 * Changes are ordered by card id, then by change type.
 *
 * @param previous - The older snapshot, or nothing on a first run.
 * @param next - The newer snapshot.
 * @returns The changes between the two.
 */
export function diffTrelloBoardSnapshots(previous: Maybe<TrelloBoardSnapshot>, next: TrelloBoardSnapshot): TrelloBoardSnapshotDiff {
  const listNames = new Map<TrelloListId, string>();
  for (const list of [...(previous?.lists ?? []), ...next.lists]) {
    listNames.set(list.id, list.name);
  }

  const before = new Map((previous?.cards ?? []).map((card) => [card.id, card]));
  const after = new Map(next.cards.map((card) => [card.id, card]));
  const cardIds = Array.from(new Set([...before.keys(), ...after.keys()])).sort((a, b) => a.localeCompare(b));
  const changes: TrelloBoardChange[] = [];

  for (const cardId of cardIds) {
    changes.push(...diffTrelloBoardSnapshotCard(before.get(cardId), after.get(cardId), listNames));
  }

  return { boardId: next.boardId, from: previous?.fetchedAt ?? null, to: next.fetchedAt, changes };
}

function diffTrelloBoardSnapshotCard(previous: Maybe<TrelloBoardSnapshotCard>, next: Maybe<TrelloBoardSnapshotCard>, listNames: ReadonlyMap<TrelloListId, string>): TrelloBoardChange[] {
  const changes: TrelloBoardChange[] = [];
  const card = (next ?? previous) as TrelloBoardSnapshotCard;
  const base = { cardId: card.id, shortLink: card.shortLink, name: card.name };

  if (previous == null) {
    changes.push({ ...base, type: 'added', fromListId: card.idList, fromListName: listNames.get(card.idList) });
  } else if (next == null) {
    changes.push({ ...base, type: 'removed', fromListId: card.idList, fromListName: listNames.get(card.idList) });
  } else {
    if (!previous.closed && next.closed) {
      changes.push({ ...base, type: 'closed' });
    } else if (previous.closed && !next.closed) {
      changes.push({ ...base, type: 'reopened' });
    }

    if (previous.idList !== next.idList) {
      changes.push({ ...base, type: 'moved', fromListId: previous.idList, fromListName: listNames.get(previous.idList), toListId: next.idList, toListName: listNames.get(next.idList) });
    }

    const addedLabelIds = next.idLabels.filter((id) => !previous.idLabels.includes(id));
    const removedLabelIds = previous.idLabels.filter((id) => !next.idLabels.includes(id));

    if (addedLabelIds.length > 0 || removedLabelIds.length > 0) {
      changes.push({ ...base, type: 'relabeled', addedLabelIds, removedLabelIds });
    }

    if (previous.name !== next.name) {
      changes.push({ ...base, type: 'renamed', previousName: previous.name });
    }

    if (next.commentCount > previous.commentCount) {
      changes.push({ ...base, type: 'commented', newCommentCount: next.commentCount - previous.commentCount });
    }
  }

  return changes;
}
