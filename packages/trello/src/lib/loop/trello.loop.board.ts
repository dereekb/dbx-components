import { type Maybe } from '@dereekb/util';
import { type TrelloBoardId, type TrelloLabelId, type TrelloListId } from '../trello.type';
import { TRELLO_MAX_PAGE_LIMIT } from '../trello.api.page';
import { type TrelloContextRef } from '../trello/trello.factory';
import { listBoardLabels, listBoardLists } from '../trello/trello.api.board';
import { type TrelloLabel } from '../trello/trello.api.card.type';
import { type TrelloList } from '../trello/trello.api.list.type';

/**
 * Normalizes a list name for comparison: drops a trailing parenthetical, trims, collapses inner whitespace and
 * lowercases, so `"Up  next (max 5)"` and `"up next"` compare equal. A board owner annotating a column in the UI then
 * does not silently break a config that names it.
 *
 * @param name - The raw list name, or nothing.
 * @returns The normalized form, or `''` when there is no name.
 */
export function normalizeTrelloListName(name: Maybe<string>): string {
  return (name ?? '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
    .replaceAll(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Why {@link matchTrelloList} or {@link matchTrelloLabel} found no single match.
 */
export type TrelloBoardNameProblemCode = 'unknown_list' | 'ambiguous_list' | 'unknown_label' | 'ambiguous_label';

/**
 * A list or label a {@link TrelloBoardNameProblem} names as a candidate.
 */
export interface TrelloBoardNameCandidate {
  readonly id: string;
  readonly name: string;
}

/**
 * A failed match, with a message that names the candidates.
 */
export interface TrelloBoardNameProblem {
  readonly ok: false;
  readonly code: TrelloBoardNameProblemCode;
  readonly message: string;
  /**
   * For an `ambiguous_*` problem, the lists/labels the name matched. For an `unknown_*` problem, every list/label on
   * the board, so a caller can build its own (e.g. capped) hint.
   */
  readonly candidates: readonly TrelloBoardNameCandidate[];
}

/**
 * What {@link matchTrelloList} / {@link matchTrelloLabel} do when a name matches several lists/labels:
 *
 * - `refuse`: report an `ambiguous_*` problem (the default).
 * - `first`: take the first match in the order the board returned them (for lists, the leftmost).
 */
export type TrelloBoardNameDuplicates = 'refuse' | 'first';

/**
 * Options for {@link matchTrelloList}.
 */
export interface MatchTrelloListOptions {
  /**
   * What to do when a name matches several lists. Defaults to `refuse`.
   */
  readonly duplicates?: Maybe<TrelloBoardNameDuplicates>;
}

/**
 * Options for {@link matchTrelloLabel}.
 */
export interface MatchTrelloLabelOptions {
  /**
   * What to do when a name exactly matches several labels. Defaults to `refuse`.
   */
  readonly duplicates?: Maybe<TrelloBoardNameDuplicates>;
  /**
   * Whether a name with no exact (case-sensitive) match falls back to a case-insensitive one. The fallback is a guess,
   * so it only ever takes a unique match, whatever {@link duplicates} says. Defaults to `true`.
   */
  readonly caseInsensitiveFallback?: Maybe<boolean>;
}

/**
 * The result of {@link matchTrelloList}.
 */
export type TrelloListMatch = { readonly ok: true; readonly list: TrelloList } | TrelloBoardNameProblem;

/**
 * Input for {@link matchTrelloList}.
 */
export interface MatchTrelloListInput extends MatchTrelloListOptions {
  /**
   * The board's lists.
   */
  readonly lists: readonly TrelloList[];
  /**
   * A list id or name.
   */
  readonly list: string;
}

/**
 * Matches a list reference against a board's lists: an exact id first, then a {@link normalizeTrelloListName} match.
 * A name that matches several lists is refused rather than guessed, unless `duplicates` is `first`.
 *
 * @param input - The lists, the reference and the match options.
 * @returns The list, or an `unknown_list` / `ambiguous_list` problem.
 */
export function matchTrelloList(input: MatchTrelloListInput): TrelloListMatch {
  const { lists } = input;
  const ref = input.list.trim();
  const byId = lists.find((list) => list.id === ref);
  const named = byId == null ? lists.filter((list) => normalizeTrelloListName(list.name) === normalizeTrelloListName(ref)) : [];
  let result: TrelloListMatch;

  if (byId != null) {
    result = { ok: true, list: byId };
  } else if (named.length === 1 || (named.length > 1 && input.duplicates === 'first')) {
    result = { ok: true, list: named[0] };
  } else if (named.length > 1) {
    result = { ok: false, code: 'ambiguous_list', message: `"${ref}" matches ${named.length} lists: ${named.map((list) => `"${list.name}" (${list.id})`).join(', ')}. Pass the list id instead.`, candidates: named.map(trelloBoardNameCandidate) };
  } else {
    result = { ok: false, code: 'unknown_list', message: `No list "${ref}" on the board. Lists: ${lists.map((list) => `"${list.name}"`).join(', ') || '(none)'}.`, candidates: lists.map(trelloBoardNameCandidate) };
  }

  return result;
}

/**
 * The result of {@link matchTrelloLabel}.
 */
export type TrelloLabelMatch = { readonly ok: true; readonly label: TrelloLabel } | TrelloBoardNameProblem;

/**
 * Input for {@link matchTrelloLabel}.
 */
export interface MatchTrelloLabelInput extends MatchTrelloLabelOptions {
  /**
   * The board's labels.
   */
  readonly labels: readonly TrelloLabel[];
  /**
   * A label id or name.
   */
  readonly label: string;
}

/**
 * Matches a label reference against a board's labels: an exact id, then an exact name, then (unless
 * `caseInsensitiveFallback` is `false`) a unique case-insensitive name. A name shared by several labels is refused
 * rather than guessed, unless `duplicates` is `first`, which takes the first exact match.
 *
 * @param input - The labels, the reference and the match options.
 * @returns The label, or an `unknown_label` / `ambiguous_label` problem.
 */
export function matchTrelloLabel(input: MatchTrelloLabelInput): TrelloLabelMatch {
  const { labels } = input;
  const ref = input.label.trim();
  const byId = labels.find((label) => label.id === ref);
  const exact = labels.filter((label) => label.name === ref);
  const insensitive = exact.length === 0 && input.caseInsensitiveFallback !== false ? labels.filter((label) => label.name.toLowerCase() === ref.toLowerCase()) : [];
  const named = exact.length > 0 ? exact : insensitive;
  let result: TrelloLabelMatch;

  if (byId != null) {
    result = { ok: true, label: byId };
  } else if (named.length === 1 || (exact.length > 1 && input.duplicates === 'first')) {
    result = { ok: true, label: named[0] };
  } else if (named.length > 1) {
    result = { ok: false, code: 'ambiguous_label', message: `"${ref}" matches ${named.length} labels: ${named.map((label) => `${label.color ?? 'no color'} (${label.id})`).join(', ')}. Pass the label id instead.`, candidates: named.map(trelloBoardNameCandidate) };
  } else {
    result = { ok: false, code: 'unknown_label', message: `No label "${ref}" on the board. Labels: ${labels.map((label) => `"${label.name}"`).join(', ') || '(none)'}.`, candidates: labels.map(trelloBoardNameCandidate) };
  }

  return result;
}

function trelloBoardNameCandidate(item: TrelloList | TrelloLabel): TrelloBoardNameCandidate {
  return { id: item.id, name: item.name };
}

/**
 * Input for {@link resolveTrelloBoardNames}.
 */
export interface ResolveTrelloBoardNamesInput extends TrelloContextRef {
  readonly boardId: TrelloBoardId;
  /**
   * List names (or ids) the caller's config refers to.
   */
  readonly lists?: Maybe<readonly string[]>;
  /**
   * Label names (or ids) the caller's config refers to.
   */
  readonly labels?: Maybe<readonly string[]>;
  /**
   * How list names are matched. Defaults to refusing a name several lists share.
   */
  readonly listMatch?: Maybe<MatchTrelloListOptions>;
  /**
   * How label names are matched. Defaults to refusing a name several labels share, with a case-insensitive fallback.
   */
  readonly labelMatch?: Maybe<MatchTrelloLabelOptions>;
}

/**
 * A name {@link resolveTrelloBoardNames} could not resolve.
 */
export interface TrelloBoardMissingName {
  readonly kind: 'list' | 'label';
  readonly name: string;
  readonly code: TrelloBoardNameProblemCode;
  readonly message: string;
  /**
   * See {@link TrelloBoardNameProblem.candidates}.
   */
  readonly candidates: readonly TrelloBoardNameCandidate[];
}

/**
 * The result of {@link resolveTrelloBoardNames}. `ok` is `false` when any name is missing or ambiguous; the names
 * that did resolve are still returned.
 */
export interface TrelloBoardNames {
  readonly ok: boolean;
  readonly boardId: TrelloBoardId;
  /**
   * Each requested list reference → the resolved list id.
   */
  readonly listIds: Readonly<Record<string, TrelloListId>>;
  /**
   * Each requested label reference → the resolved label id.
   */
  readonly labelIds: Readonly<Record<string, TrelloLabelId>>;
  readonly missing: readonly TrelloBoardMissingName[];
  readonly lists: readonly TrelloList[];
  readonly labels: readonly TrelloLabel[];
}

/**
 * Resolves the list and label names a config refers to against the board in two requests, reporting every name that
 * is missing or ambiguous at once — so a misconfigured board fails up front, naming what to create, rather than
 * stranding cards one by one later.
 *
 * @param input - The Trello context, the board, and the names to resolve.
 * @returns The resolved ids, the board's lists and labels, and what is missing.
 */
export async function resolveTrelloBoardNames(input: ResolveTrelloBoardNamesInput): Promise<TrelloBoardNames> {
  const { trelloContext, boardId } = input;
  const [lists, labels] = await Promise.all([listBoardLists(trelloContext)({ boardId }), listBoardLabels(trelloContext)({ boardId, limit: TRELLO_MAX_PAGE_LIMIT })]);
  const listIds: Record<string, TrelloListId> = {};
  const labelIds: Record<string, TrelloLabelId> = {};
  const missing: TrelloBoardMissingName[] = [];

  for (const name of input.lists ?? []) {
    const match = matchTrelloList({ ...input.listMatch, lists, list: name });

    if (match.ok) {
      listIds[name] = match.list.id;
    } else {
      missing.push({ kind: 'list', name, code: match.code, message: match.message, candidates: match.candidates });
    }
  }

  for (const name of input.labels ?? []) {
    const match = matchTrelloLabel({ ...input.labelMatch, labels, label: name });

    if (match.ok) {
      labelIds[name] = match.label.id;
    } else {
      missing.push({ kind: 'label', name, code: match.code, message: match.message, candidates: match.candidates });
    }
  }

  return { ok: missing.length === 0, boardId, listIds, labelIds, missing, lists, labels };
}
