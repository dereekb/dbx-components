import { type Maybe } from '@dereekb/util';
import { type TrelloBoardId, type TrelloCardId, type TrelloLabelId } from '../trello.type';
import { TRELLO_MAX_PAGE_LIMIT } from '../trello.api.page';
import { type TrelloContextRef } from '../trello/trello.factory';
import { listBoardLabels } from '../trello/trello.api.board';
import { addLabelToCard, getCard, removeLabelFromCard } from '../trello/trello.api.card';
import { type TrelloLabel } from '../trello/trello.api.card.type';
import { matchTrelloLabel, type TrelloBoardMissingName } from './trello.loop.board';

/**
 * Input for {@link updateTrelloCardLabels}.
 */
export interface UpdateTrelloCardLabelsInput extends TrelloContextRef {
  /**
   * The card id or shortLink.
   */
  readonly cardId: TrelloCardId;
  /**
   * Label names or ids to add.
   */
  readonly add?: Maybe<readonly string[]>;
  /**
   * Label names or ids to remove.
   */
  readonly remove?: Maybe<readonly string[]>;
  /**
   * The card's current label ids, when the caller already has them. Read from the card otherwise.
   */
  readonly currentLabelIds?: Maybe<readonly TrelloLabelId[]>;
  /**
   * The board's labels, when the caller already has them. Read from the card's board otherwise.
   */
  readonly boardLabels?: Maybe<readonly TrelloLabel[]>;
  /**
   * The card's board, used to read its labels when `boardLabels` is not passed. Read from the card otherwise.
   */
  readonly boardId?: Maybe<TrelloBoardId>;
}

/**
 * The result of {@link updateTrelloCardLabels}.
 */
export interface UpdateTrelloCardLabelsResult {
  /**
   * `false` when a reference did not resolve; nothing was written in that case.
   */
  readonly ok: boolean;
  readonly added: readonly TrelloLabel[];
  readonly removed: readonly TrelloLabel[];
  /**
   * The card's label ids after the update.
   */
  readonly labelIds: readonly TrelloLabelId[];
  readonly unresolved: readonly TrelloBoardMissingName[];
}

/**
 * Adds and removes labels on a card by name or id with one add / remove call per label, instead of replacing the
 * card's whole label set. A concurrent edit to another label on the same card is never overwritten, which a
 * read-modify-write of `idLabels` cannot promise.
 *
 * Labels already present are not re-added, and absent ones are not removed, so the call is safe to repeat. Every
 * reference is resolved before anything is written: one unknown or ambiguous name leaves the card untouched.
 *
 * @param input - The Trello context, the card, the labels to add and remove, and any state the caller already has.
 * @returns What was added and removed, the resulting label ids, and any references that did not resolve.
 */
export async function updateTrelloCardLabels(input: UpdateTrelloCardLabelsInput): Promise<UpdateTrelloCardLabelsResult> {
  const { trelloContext, cardId } = input;
  let currentLabelIds = input.currentLabelIds;
  let boardId = input.boardId;

  if (currentLabelIds == null || (input.boardLabels == null && boardId == null)) {
    const card = await getCard(trelloContext)({ cardId, fields: 'idLabels,idBoard' });
    currentLabelIds = currentLabelIds ?? card.idLabels ?? [];
    boardId = boardId ?? card.idBoard;
  }

  const boardLabels = input.boardLabels ?? (await listBoardLabels(trelloContext)({ boardId: boardId as TrelloBoardId, limit: TRELLO_MAX_PAGE_LIMIT }));
  const unresolved: TrelloBoardMissingName[] = [];

  function resolve(refs: Maybe<readonly string[]>): TrelloLabel[] {
    const labels: TrelloLabel[] = [];

    for (const ref of refs ?? []) {
      const match = matchTrelloLabel({ labels: boardLabels, label: ref });

      if (match.ok) {
        labels.push(match.label);
      } else {
        unresolved.push({ kind: 'label', name: ref, code: match.code, message: match.message });
      }
    }

    return labels;
  }

  const toAdd = resolve(input.add);
  const toRemove = resolve(input.remove);
  const labelIds = new Set(currentLabelIds);
  const added: TrelloLabel[] = [];
  const removed: TrelloLabel[] = [];

  if (unresolved.length === 0) {
    for (const label of toAdd) {
      if (!labelIds.has(label.id)) {
        await addLabelToCard(trelloContext)({ cardId, labelId: label.id });
        labelIds.add(label.id);
        added.push(label);
      }
    }

    for (const label of toRemove) {
      if (labelIds.has(label.id)) {
        await removeLabelFromCard(trelloContext)({ cardId, labelId: label.id });
        labelIds.delete(label.id);
        removed.push(label);
      }
    }
  }

  return { ok: unresolved.length === 0, added, removed, labelIds: Array.from(labelIds), unresolved };
}
