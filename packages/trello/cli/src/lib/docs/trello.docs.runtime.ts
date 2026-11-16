import { type EmbeddedPackageRefs } from '@dereekb/dbx-cli';
import { type Maybe } from '@dereekb/util';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The refs `@dereekb/trello` ships, by name, as paths relative to the `refs/` directory.
 */
export const TRELLO_CLI_PACKAGE_REF_NAMES: readonly string[] = ['trello-cli'];

/**
 * Where `refs/` sits relative to this module: next to the built library (`dist/packages/trello/cli/index.esm.js` →
 * `dist/packages/trello/refs`), or, when running from source, four directories up (`packages/trello/refs`).
 */
const TRELLO_CLI_REFS_DIR_CANDIDATES: readonly string[] = ['../refs/', '../../../../refs/'];

/**
 * Reads the refs `@dereekb/trello` ships from the installed package, for the `docs` command of a CLI built with
 * `runTrelloCli` from the library (the stock binary embeds them instead).
 *
 * @param moduleUrl - The url to resolve `refs/` against. Defaults to this module's.
 * @returns The refs found; an empty list when the package's `refs/` directory is not there.
 */
export function loadTrelloCliPackageRefs(moduleUrl: string = import.meta.url): EmbeddedPackageRefs {
  const refs: { name: string; content: string }[] = [];

  for (const name of TRELLO_CLI_PACKAGE_REF_NAMES) {
    let content: Maybe<string>;

    for (const dir of TRELLO_CLI_REFS_DIR_CANDIDATES) {
      if (content == null) {
        try {
          content = readFileSync(fileURLToPath(new URL(`${dir}${name}/REF.md`, moduleUrl)), 'utf8');
        } catch {
          content = undefined;
        }
      }
    }

    if (content != null) {
      refs.push({ name, content });
    }
  }

  return { packageName: '@dereekb/trello', refs };
}
