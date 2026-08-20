/**
 * Stage 2 — confirm each collected entry's identifier is importable from its component's barrel.
 *
 * Mirrors the api-manifest generator's validator binding, including its `[no-validator]`-style
 * warning: an unbound entry is still EMITTED (so the catalog stays honest about what exists) but
 * carries `factory: undefined` and lists as non-invocable.
 */

import { isExportedFromPackage } from '../../src/lib/scan-helpers/exported-from-package.js';
import type { BoundQueryEntry, CollectedQueryEntry } from './types.js';

/**
 * Input for {@link bindQueryFactories}.
 */
export interface BindQueryFactoriesInput {
  readonly componentRoot: string;
  readonly entries: readonly CollectedQueryEntry[];
  /**
   * Injected for tests; defaults to the real barrel-chain lookup.
   */
  readonly isExported?: typeof isExportedFromPackage;
}

/**
 * Result of binding one component's entries.
 */
export interface BindQueryFactoriesResult {
  readonly bound: readonly BoundQueryEntry[];
  /**
   * Warning lines for the entries whose identifier could not be found.
   */
  readonly warnings: readonly string[];
}

/**
 * Checks each entry's identifier against the component's barrel chain.
 *
 * @param input - The component root and its collected entries.
 * @returns Each entry paired with whether it bound, plus the `[no-factory]` warning lines.
 */
export function bindQueryFactories(input: BindQueryFactoriesInput): BindQueryFactoriesResult {
  const { componentRoot, entries, isExported = isExportedFromPackage } = input;
  const bound: BoundQueryEntry[] = [];
  const warnings: string[] = [];

  for (const entry of entries) {
    const found = isExported({ packageRoot: componentRoot, identifier: entry.name });

    if (!found) {
      warnings.push(`[no-factory] ${entry.module} · ${entry.slug} → ${entry.name} not exported`);
    }

    bound.push({ entry, bound: found });
  }

  return { bound, warnings };
}
