/**
 * Shared `<purpose>FileGroupIds` / `<purpose>StorageFileGroupIds`
 * helper-naming convention used by the storagefile validator and
 * lister.
 *
 * The validator emits a warning when a `_PURPOSE` constant has no
 * matching helper; the lister uses the same suffix list to pair a
 * helper to a purpose by best-effort camelCase prefix match.
 */

import { removeFirstMatchingSuffix } from '@dereekb/util';

/**
 * Suffixes recognised as `<purpose>...GroupIds` helper functions.
 * Order matters: the longer `StorageFileGroupIds` is matched first so
 * the shorter `FileGroupIds` does not steal the prefix.
 */
export const GROUP_IDS_FUNCTION_SUFFIXES: readonly string[] = ['StorageFileGroupIds', 'FileGroupIds'];

/**
 * Returns the prefix portion of a helper-function name with the
 * recognised group-ids suffix stripped, or the input unchanged when
 * no recognised suffix is present.
 *
 * @param name The helper-function name to inspect.
 * @returns The stripped prefix, or the input unchanged.
 */
export function stripGroupIdsSuffix(name: string): string {
  return removeFirstMatchingSuffix(name, GROUP_IDS_FUNCTION_SUFFIXES);
}
