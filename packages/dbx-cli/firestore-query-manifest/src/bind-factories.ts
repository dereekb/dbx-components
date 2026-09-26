/**
 * Stage 2 — confirm each collected entry's identifier is importable from its component's barrel.
 *
 * Mirrors the api-manifest generator's validator binding, including its `[no-validator]`-style
 * warning: an unbound entry is still EMITTED (so the catalog stays honest about what exists) but
 * carries `factory: undefined` and lists as non-invocable.
 */

import type { Maybe } from '@dereekb/util';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
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

// MARK: Packages
/**
 * Resolves the root directory of an installed package from the consuming workspace. Returns `null`
 * when the package is not installed.
 */
export type QueryFactoryPackageRootResolver = (input: { readonly cwd: string; readonly module: string }) => Maybe<string>;

/**
 * Resolves the package's main entry through Node module resolution and takes its directory.
 *
 * The entry, not `<module>/package.json`: a secondary entry point such as `@dereekb/openrouter/firebase`
 * does not export its `package.json`, while its `index.d.ts` sits beside the resolved entry for every
 * `@dereekb/*` entry point, which is exactly what the barrel lookup reads.
 *
 * @param input - The workspace cwd and the module to resolve.
 * @param input.cwd - The workspace cwd resolution starts from.
 * @param input.module - The module specifier, e.g. `@dereekb/firebase`.
 * @returns The package root directory, or null when the module does not resolve.
 */
export const defaultQueryFactoryPackageRootResolver: QueryFactoryPackageRootResolver = ({ cwd, module }) => {
  let result: Maybe<string>;
  try {
    // createRequire needs a FILE origin, not a directory — the trailing segment is never read.
    result = dirname(createRequire(resolve(cwd, 'noop.js')).resolve(module));
  } catch {
    result = null;
  }
  return result;
};

/**
 * Input for {@link bindPackageQueryFactories}.
 */
export interface BindPackageQueryFactoriesInput {
  readonly cwd: string;
  readonly entries: readonly CollectedQueryEntry[];
  /**
   * Injected for tests; defaults to Node module resolution.
   */
  readonly resolvePackageRoot?: QueryFactoryPackageRootResolver;
  /**
   * Injected for tests; defaults to the real barrel-chain lookup.
   */
  readonly isExported?: typeof isExportedFromPackage;
}

/**
 * Checks each pre-built package entry's identifier against its INSTALLED package's barrel chain.
 *
 * The component path binds against source; a package entry binds against the `.d.ts` barrel of the
 * version actually installed, so an entry the manifest names but the installed version does not export
 * (a manifest newer than the package, say) lists as non-invocable instead of emitting an import that
 * breaks the CLI build.
 *
 * @param input - The workspace cwd and the collected package entries.
 * @returns Each entry paired with whether it bound, plus the `[no-factory]` warning lines.
 */
export function bindPackageQueryFactories(input: BindPackageQueryFactoriesInput): BindQueryFactoriesResult {
  const { cwd, entries, resolvePackageRoot = defaultQueryFactoryPackageRootResolver, isExported = isExportedFromPackage } = input;
  const packageRoots = new Map<string, Maybe<string>>();
  const bound: BoundQueryEntry[] = [];
  const warnings: string[] = [];

  for (const entry of entries) {
    let packageRoot = packageRoots.get(entry.module);

    if (packageRoot === undefined) {
      packageRoot = resolvePackageRoot({ cwd, module: entry.module });
      packageRoots.set(entry.module, packageRoot);
    }

    const found = packageRoot != null && isExported({ packageRoot, identifier: entry.name });

    if (!found) {
      warnings.push(packageRoot == null ? `[no-factory] ${entry.module} · ${entry.slug} → ${entry.module} is not installed` : `[no-factory] ${entry.module} · ${entry.slug} → ${entry.name} not exported`);
    }

    bound.push({ entry, bound: found });
  }

  return { bound, warnings };
}
