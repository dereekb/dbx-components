/**
 * The one atomic file write every `@dereekb/llm/node` writer uses (the model config file, the compiled craft-notes
 * module). PRIVATE to the package: not exported from the barrel.
 */

import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Config for {@link writeLlmFileAtomic}.
 */
export interface WriteLlmFileAtomicConfig {
  /**
   * The file to write. Its parent folder is created when missing.
   */
  readonly filePath: string;
  /**
   * The full text to write (UTF-8).
   */
  readonly text: string;
}

/**
 * Write a file ATOMICALLY: to a sibling temp file (`<filePath>.<pid>.writing`), then rename it over the target — so an
 * interrupted write can never leave a truncated file, which every reader would fail loud on until someone repaired it
 * by hand. A failed write or rename removes the temp file and rethrows.
 *
 * @param config - The path and the text.
 * @throws {Error} When the folder cannot be created, or the write or rename fails.
 */
export function writeLlmFileAtomic(config: WriteLlmFileAtomicConfig): void {
  const { filePath, text } = config;
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.writing`;

  try {
    writeFileSync(tempPath, text, 'utf8');
    renameSync(tempPath, filePath);
  } catch (e) {
    rmSync(tempPath, { force: true });
    throw e;
  }
}
