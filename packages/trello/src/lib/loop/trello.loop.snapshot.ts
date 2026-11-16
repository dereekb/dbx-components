import { type Maybe } from '@dereekb/util';
import { type TrelloBoardId, type TrelloCardId, type TrelloLabelId, type TrelloListId } from '../trello.type';
import { TRELLO_MAX_PAGE_LIMIT } from '../trello.api.page';
import { type TrelloContextRef } from '../trello/trello.factory';
import { listBoardCards, listBoardLabels, listBoardLists, type ListBoardCardsInput } from '../trello/trello.api.board';
import { type TrelloCard, type TrelloLabel } from '../trello/trello.api.card.type';
import { type TrelloList } from '../trello/trello.api.list.type';
import { type TrelloLabelColor } from '../shared/trello.type';

/**
 * Card fields {@link fetchTrelloBoardSnapshot} requests — just enough to fingerprint and diff a card.
 */
export const TRELLO_BOARD_SNAPSHOT_CARD_FIELDS = 'id,name,idList,idLabels,closed,dateLastActivity,shortLink,badges';

/**
 * Which card fields {@link fetchTrelloBoardSnapshot} reads:
 *
 * - `snapshot`: only {@link TRELLO_BOARD_SNAPSHOT_CARD_FIELDS} (the default).
 * - `default`: no `fields` parameter, so Trello returns its default card fields.
 * - `all`: every card field.
 * - a list of field names: those fields plus {@link TRELLO_BOARD_SNAPSHOT_CARD_FIELDS}, so the snapshot stays complete.
 */
export type TrelloBoardSnapshotCardFields = 'snapshot' | 'default' | 'all' | readonly string[];

/**
 * A version appended to every {@link trelloCardFingerprint} as `|v<version>`. Bumping it changes every card's
 * fingerprint at once, so a caller that skips re-reading cards whose fingerprint is unchanged refreshes them all.
 */
export type TrelloCardFingerprintVersion = number | string;

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
   * The card's comment count (`badges.comments`). An increase between two snapshots is reported as `commented`, a
   * decrease as `uncommented`.
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
   * Which card fields to read. Defaults to `snapshot`. Pass `default` or `all` (or a field list) when the caller also
   * wants the full cards from {@link fetchTrelloBoardSnapshotWithCards}, so the board is read once.
   */
  readonly cardFields?: Maybe<TrelloBoardSnapshotCardFields>;
  /**
   * Version appended to every card's fingerprint. See {@link TrelloCardFingerprintVersion}.
   */
  readonly fingerprintVersion?: Maybe<TrelloCardFingerprintVersion>;
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
 * @param version - Optional version appended as `|v<version>`. See {@link TrelloCardFingerprintVersion}.
 * @returns The fingerprint string.
 */
export function trelloCardFingerprint(card: Pick<TrelloCard, 'dateLastActivity' | 'idList' | 'idLabels' | 'closed'>, version?: Maybe<TrelloCardFingerprintVersion>): string {
  const labelIds = [...(card.idLabels ?? [])].sort((a, b) => a.localeCompare(b)).join(',');
  const parts = [card.dateLastActivity ?? '', card.idList ?? '', labelIds, card.closed ? '1' : '0'];

  if (version != null) {
    parts.push(`v${version}`);
  }

  return parts.join('|');
}

/**
 * Options for {@link trelloBoardSnapshotCard}.
 */
export interface TrelloBoardSnapshotCardOptions {
  /**
   * Version appended to the card's fingerprint. See {@link TrelloCardFingerprintVersion}.
   */
  readonly fingerprintVersion?: Maybe<TrelloCardFingerprintVersion>;
}

/**
 * Captures one card for a {@link TrelloBoardSnapshot}.
 *
 * @param card - The card to capture.
 * @param options - The fingerprint version.
 * @returns The snapshot entry.
 */
export function trelloBoardSnapshotCard(card: TrelloCard, options?: Maybe<TrelloBoardSnapshotCardOptions>): TrelloBoardSnapshotCard {
  return {
    id: card.id,
    shortLink: card.shortLink,
    name: card.name,
    idList: card.idList,
    idLabels: [...(card.idLabels ?? [])].sort((a, b) => a.localeCompare(b)),
    closed: card.closed === true,
    dateLastActivity: card.dateLastActivity ?? null,
    commentCount: card.badges?.comments ?? 0,
    fingerprint: trelloCardFingerprint(card, options?.fingerprintVersion)
  };
}

/**
 * Input for {@link buildTrelloBoardSnapshot}.
 */
export interface BuildTrelloBoardSnapshotInput {
  readonly boardId: TrelloBoardId;
  /**
   * The board's cards, read with at least {@link TRELLO_BOARD_SNAPSHOT_CARD_FIELDS}.
   */
  readonly cards: readonly TrelloCard[];
  readonly lists: readonly TrelloList[];
  readonly labels: readonly TrelloLabel[];
  /**
   * When the cards were read.
   */
  readonly fetchedAt: Date | string;
  /**
   * The card filter the cards were read with. Defaults to `visible`.
   */
  readonly cardFilter?: Maybe<NonNullable<ListBoardCardsInput['filter']>>;
  /**
   * Version appended to every card's fingerprint. See {@link TrelloCardFingerprintVersion}.
   */
  readonly fingerprintVersion?: Maybe<TrelloCardFingerprintVersion>;
}

/**
 * Captures already-fetched lists, labels and cards as a {@link TrelloBoardSnapshot}, for a caller that reads the board
 * itself. Makes no requests.
 *
 * @param input - The board, its cards, lists and labels, and when they were read.
 * @returns The snapshot.
 */
export function buildTrelloBoardSnapshot(input: BuildTrelloBoardSnapshotInput): TrelloBoardSnapshot {
  const { boardId, fingerprintVersion } = input;

  return {
    boardId,
    fetchedAt: typeof input.fetchedAt === 'string' ? input.fetchedAt : input.fetchedAt.toISOString(),
    cardFilter: input.cardFilter ?? 'visible',
    lists: input.lists.map((list) => ({ id: list.id, name: list.name, closed: list.closed === true })),
    labels: input.labels.map((label) => ({ id: label.id, name: label.name, color: label.color ?? null })),
    cards: input.cards.map((card) => trelloBoardSnapshotCard(card, { fingerprintVersion })).sort((a, b) => a.id.localeCompare(b.id))
  };
}

/**
 * The result of {@link fetchTrelloBoardSnapshotWithCards}: the snapshot plus the raw reads it was built from.
 */
export interface TrelloBoardSnapshotWithCards {
  readonly snapshot: TrelloBoardSnapshot;
  /**
   * The cards as Trello returned them, with the fields `cardFields` asked for.
   */
  readonly cards: readonly TrelloCard[];
  readonly lists: readonly TrelloList[];
  readonly labels: readonly TrelloLabel[];
}

/**
 * Builds the `fields` parameter for a {@link TrelloBoardSnapshotCardFields} choice.
 *
 * @param cardFields - The choice, or nothing for `snapshot`.
 * @returns The comma-separated fields, `all`, or `undefined` for Trello's default set.
 */
export function trelloBoardSnapshotCardFieldsParam(cardFields: Maybe<TrelloBoardSnapshotCardFields>): Maybe<string> {
  let result: Maybe<string>;

  if (cardFields == null || cardFields === 'snapshot') {
    result = TRELLO_BOARD_SNAPSHOT_CARD_FIELDS;
  } else if (cardFields === 'default') {
    result = undefined;
  } else if (cardFields === 'all') {
    result = 'all';
  } else {
    result = Array.from(new Set([...TRELLO_BOARD_SNAPSHOT_CARD_FIELDS.split(','), ...cardFields.map((field) => field.trim()).filter((field) => field.length > 0)])).join(',');
  }

  return result;
}

/**
 * Reads a board's lists, labels and cards in parallel and returns both the {@link TrelloBoardSnapshot} and the raw
 * reads, so a caller that needs full cards (pass `cardFields`) reads the board once. Three requests, no matter how many
 * cards the board has.
 *
 * @param input - The Trello context, the board, the card filter and fields, and the fingerprint version.
 * @returns The snapshot and the raw cards, lists and labels.
 */
export async function fetchTrelloBoardSnapshotWithCards(input: FetchTrelloBoardSnapshotInput): Promise<TrelloBoardSnapshotWithCards> {
  const { trelloContext, boardId } = input;
  const cardFilter = input.cardFilter ?? 'visible';
  const fields = trelloBoardSnapshotCardFieldsParam(input.cardFields);
  const [lists, labels, cards] = await Promise.all([listBoardLists(trelloContext)({ boardId }), listBoardLabels(trelloContext)({ boardId, limit: TRELLO_MAX_PAGE_LIMIT }), listBoardCards(trelloContext)({ boardId, filter: cardFilter, ...(fields == null ? undefined : { fields }) })]);
  const snapshot = buildTrelloBoardSnapshot({ boardId, cards, lists, labels, cardFilter, fetchedAt: input.now?.() ?? new Date(), fingerprintVersion: input.fingerprintVersion });
  return { snapshot, cards, lists, labels };
}

/**
 * Reads a board's lists, labels and cards in parallel and captures them as a {@link TrelloBoardSnapshot}. Three
 * requests, no matter how many cards the board has. Use {@link fetchTrelloBoardSnapshotWithCards} to also keep the
 * raw cards.
 *
 * @param input - The Trello context, the board, the card filter and fields, and the fingerprint version.
 * @returns The snapshot.
 */
export async function fetchTrelloBoardSnapshot(input: FetchTrelloBoardSnapshotInput): Promise<TrelloBoardSnapshot> {
  const { snapshot } = await fetchTrelloBoardSnapshotWithCards(input);
  return snapshot;
}

/**
 * The kinds of card change {@link diffTrelloBoardSnapshots} reports.
 *
 * - `commented` / `uncommented`: the comment count rose / fell (a comment was added / deleted).
 * - `updated`: the card's activity date or fingerprint changed but nothing else was reported for it — a description,
 *   due date, checklist, attachment, member or comment edit, or a fingerprint version bump.
 */
export type TrelloBoardChangeType = 'added' | 'removed' | 'closed' | 'reopened' | 'moved' | 'relabeled' | 'renamed' | 'commented' | 'uncommented' | 'updated';

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
  /**
   * `uncommented`: how many comments were removed since the previous snapshot.
   */
  readonly removedCommentCount?: number;
  /**
   * `updated`: the card's previous and current `dateLastActivity`.
   */
  readonly previousDateLastActivity?: Maybe<string>;
  readonly dateLastActivity?: Maybe<string>;
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
 * relabeled, renamed, commented on or had a comment removed, plus `updated` for a card whose activity changed in a way
 * none of those cover. With no previous snapshot, every card in `next` is reported as `added`.
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
    } else if (next.commentCount < previous.commentCount) {
      changes.push({ ...base, type: 'uncommented', removedCommentCount: previous.commentCount - next.commentCount });
    }

    if (changes.length === 0 && (previous.fingerprint !== next.fingerprint || previous.dateLastActivity !== next.dateLastActivity)) {
      changes.push({ ...base, type: 'updated', previousDateLastActivity: previous.dateLastActivity, dateLastActivity: next.dateLastActivity });
    }
  }

  return changes;
}
