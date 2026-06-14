/**
 * Minimal, idempotent `.env` editing for add-ons. `.env` files are line-oriented
 * `KEY=value` text (not JSON), so this lives apart from `json-edit.ts`. The only
 * operation add-ons need is "ensure a key is present", appending it when absent.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { type Maybe } from '@dereekb/util';

/**
 * The outcome of ensuring an env var.
 */
export type EnvVarEditStatus = 'added' | 'present' | 'created' | 'file-missing';

/**
 * The result of ensuring an env var.
 */
export interface EnvVarEditResult {
  readonly status: EnvVarEditStatus;
}

/**
 * Whether an env file already declares `KEY=` on some line.
 *
 * @param content - The `.env` file contents.
 * @param key - The env var name.
 * @returns `true` when a `KEY=` line is present.
 */
function envHasKey(content: string, key: string): boolean {
  return content.split('\n').some((line) => line.trimStart().startsWith(`${key}=`));
}

/**
 * Ensures `KEY=value` is present in an env file, appending it when absent. When
 * the file is absent it is created only if `createIfMissing` is set; otherwise
 * the edit is reported as `file-missing` (the add-on prints a manual note).
 *
 * @param path - Absolute path to the `.env` file.
 * @param input - The key/value to ensure.
 * @param input.key - The env var name.
 * @param input.value - The value written when the key is appended.
 * @param options - `dryRun` suppresses the write; `createIfMissing` creates an absent file.
 * @returns The edit status.
 */
export function ensureEnvVar(path: string, input: { readonly key: string; readonly value: string }, options?: Maybe<{ readonly dryRun?: Maybe<boolean>; readonly createIfMissing?: Maybe<boolean> }>): EnvVarEditResult {
  let result: EnvVarEditResult;
  const exists = existsSync(path);

  if (!exists && !options?.createIfMissing) {
    result = { status: 'file-missing' };
  } else {
    const content = exists ? readFileSync(path, 'utf8') : '';
    if (exists && envHasKey(content, input.key)) {
      result = { status: 'present' };
    } else {
      const needsNewline = content.length > 0 && !content.endsWith('\n');
      const next = `${content}${needsNewline ? '\n' : ''}${input.key}=${input.value}\n`;
      if (!options?.dryRun) {
        writeFileSync(path, next);
      }
      result = { status: exists ? 'added' : 'created' };
    }
  }

  return result;
}
