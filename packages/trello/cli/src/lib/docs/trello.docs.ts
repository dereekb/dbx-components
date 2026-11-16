import { type EmbeddedPackageRefs } from '@dereekb/dbx-cli';
import trelloCliRef from '../../../../refs/trello-cli/REF.md?raw';

/**
 * The agent docs (dbx-claude refs) `@dereekb/trello` ships under `refs/`, embedded in the trello-cli binary for
 * `trello-cli docs`. Every file under `packages/trello/refs/` is imported here; `trello.docs.spec.ts` fails when one is
 * missing.
 *
 * Imported only by the binary entry (`main.ts`): the `@dereekb/trello/cli` library reads the same files from the
 * installed package at runtime instead (see `loadTrelloCliPackageRefs`).
 */
export const TRELLO_CLI_PACKAGE_REFS: EmbeddedPackageRefs = {
  packageName: '@dereekb/trello',
  refs: [{ name: 'trello-cli', content: trelloCliRef }]
};
