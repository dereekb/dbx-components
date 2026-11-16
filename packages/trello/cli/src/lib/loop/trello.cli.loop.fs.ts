import { type CliJsonStore, createCliJsonStore } from '@dereekb/dbx-cli';
import { type TrelloActionId, type TrelloBoardId, type TrelloBoardSnapshot } from '@dereekb/trello';
import { sanitizeTrelloFileName } from '@dereekb/trello/node';
import { type Maybe } from '@dereekb/util';
import { join } from 'node:path';

/**
 * What trello-cli saves per board for the loop commands.
 */
export interface TrelloCliBoardState {
  /**
   * The snapshot `board changes --save` / `board snapshot --save` stored last.
   */
  readonly snapshot?: Maybe<TrelloBoardSnapshot>;
  /**
   * The newest action id `board activity --save` has read.
   */
  readonly activityWatermark?: Maybe<TrelloActionId | string>;
  /**
   * The newest mention `board mentions --save` has reported.
   */
  readonly mentionWatermark?: Maybe<TrelloActionId>;
}

/**
 * Input for {@link trelloCliBoardStateStore}.
 */
export interface TrelloCliBoardStateStoreInput {
  /**
   * The command's state directory (`ctx.stateDir()`).
   */
  readonly stateDir: string;
  readonly boardId: TrelloBoardId;
}

/**
 * The saved state of one board: `<stateDir>/boards/<board>.json` (mode 0600), written atomically.
 *
 * @param input - The state directory and the board.
 * @returns The store.
 */
export function trelloCliBoardStateStore(input: TrelloCliBoardStateStoreInput): CliJsonStore<TrelloCliBoardState> {
  return createCliJsonStore<TrelloCliBoardState>({ filePath: join(input.stateDir, 'boards', `${sanitizeTrelloFileName(input.boardId)}.json`) });
}
