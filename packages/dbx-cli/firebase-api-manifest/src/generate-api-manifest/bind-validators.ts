/**
 * For a given Params type name (e.g. `SetProfileUsernameParams`), derives the
 * canonical arktype validator identifier (`setProfileUsernameParamsType`) by
 * naming convention and confirms it is exported from the resolved package.
 *
 * Verification is best-effort: we string-search the package's `src/index.ts`
 * and follow `export * from './...';` re-exports recursively until we find
 * the declaration of the validator. The convention everywhere in the codebase
 * is `export const <name>ParamsType = ... as Type<<Name>Params>`.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/**
 * Derives the canonical arktype validator identifier from a Params type name.
 *
 * `SetProfileUsernameParams` → `setProfileUsernameParamsType`.
 *
 * @param paramsTypeName - PascalCase Params type identifier.
 * @returns The lowerCamelCase validator identifier (or empty string for empty input).
 */
export function deriveValidatorName(paramsTypeName: string): string {
  if (!paramsTypeName) return '';
  return paramsTypeName.charAt(0).toLowerCase() + paramsTypeName.slice(1) + 'Type';
}

/** Inputs for {@link isExportedFromPackage}. */
export interface IsExportedInput {
  readonly packageRoot: string;
  readonly identifier: string;
}

/**
 * Confirms an identifier is exported from `packageRoot/src/index.ts` —
 * directly or via re-export chains.
 *
 * @param input - Package root + identifier to look up.
 * @returns `true` when the identifier is reachable from the barrel.
 */
export function isExportedFromPackage(input: IsExportedInput): boolean {
  const { packageRoot, identifier } = input;
  const indexPath = join(packageRoot, 'src', 'index.ts');
  if (!existsSync(indexPath)) return false;
  return findIdentifierInBarrelChain(indexPath, identifier, new Set());
}

const EXPORT_DECL_PATTERNS: readonly RegExp[] = [/export\s+const\s+IDENT\b/, /export\s+function\s+IDENT\b/, /export\s*\{[^}]*\bIDENT\b[^}]*\}/];

function findIdentifierInBarrelChain(filePath: string, identifier: string, visited: Set<string>): boolean {
  if (visited.has(filePath)) return false;
  visited.add(filePath);

  let text: string;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch {
    return false;
  }

  for (const pattern of EXPORT_DECL_PATTERNS) {
    const re = new RegExp(pattern.source.replace('IDENT', escapeRegExp(identifier)));
    if (re.test(text)) return true;
  }

  const dir = dirname(filePath);
  for (const reExportTarget of collectReExportTargets(text)) {
    const resolved = resolveReExport(dir, reExportTarget);
    if (!resolved) continue;
    if (findIdentifierInBarrelChain(resolved, identifier, visited)) return true;
  }

  return false;
}

function collectReExportTargets(text: string): string[] {
  const out: string[] = [];
  const re = /export\s*(?:\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    out.push(match[1]);
  }
  return out;
}

function resolveReExport(fromDir: string, target: string): string | undefined {
  if (!target.startsWith('.')) return undefined;
  const candidate = isAbsolute(target) ? target : resolve(fromDir, target);

  for (const ext of ['.ts', '.mts', '/index.ts', '/index.mts']) {
    const probe = candidate.endsWith('.ts') || candidate.endsWith('.mts') ? candidate : candidate + ext;
    if (existsSync(probe)) {
      const stat = statSync(probe);
      if (stat.isFile()) return probe;
      if (stat.isDirectory()) {
        const indexed = join(probe, 'index.ts');
        if (existsSync(indexed)) return indexed;
      }
    }
  }

  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Walks the `src/lib` tree under a package and returns the absolute file
 * paths of every `.ts` file (used as a fallback when index-chain lookup
 * misses the identifier — some packages rely on flat barrels that don't
 * `export *`).
 *
 * @param packageRoot - Absolute path to the source package's root directory.
 * @returns Absolute paths of every non-spec `.ts` file under `src`.
 */
export function listPackageTsFiles(packageRoot: string): string[] {
  const libRoot = join(packageRoot, 'src');
  if (!safeIsDirectory(libRoot)) return [];

  const out: string[] = [];
  walk(libRoot, out);
  return out;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const p = join(dir, entry);
    const stat = statSync(p);
    if (stat.isDirectory()) {
      walk(p, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts') && !entry.endsWith('.test.ts')) {
      out.push(p);
    }
  }
}

function safeIsDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
