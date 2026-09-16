/**
 * Makes ts-morph type text reproducible across checkouts.
 *
 * TypeScript emits `import("<absolute path>").Type` for any type it cannot name
 * from the enclosing scope, and ts-morph surfaces that text verbatim. The path is
 * machine-specific: it is the host checkout on a developer's machine and `/code`
 * inside the build container's bind mount.
 *
 * That difference is not cosmetic. The generated manifests are tracked files under
 * `packages/dbx-cli/generated`, which is inside `dbx-cli`'s project root, and the
 * workspace's `default` named input is `{projectRoot}/**\/*`. So an absolute path
 * baked into a manifest invalidates the Nx cache for `dbx-cli` — and everything
 * downstream of it — on every alternation between a host build and a container
 * build, and leaves the git tree permanently dirty.
 *
 * Rewriting the path to be workspace-relative makes the emitted bytes identical
 * everywhere the workspace is checked out.
 */

import { isAbsolute, relative } from 'node:path';

/**
 * Matches the `import("<path>")` form TypeScript emits for a non-nameable type.
 * Captures the quoted path so only that segment is rewritten.
 */
const INLINE_TYPE_IMPORT_PATTERN = /import\("([^"]*)"\)/g;

/**
 * Input to {@link sanitizeTypeText}.
 */
export interface SanitizeTypeTextInput {
  /**
   * Type text as reported by the type checker, possibly containing one or more
   * `import("<absolute path>")` segments.
   */
  readonly typeText: string;
  /**
   * Absolute path to the workspace root that emitted paths are made relative to.
   */
  readonly workspaceRoot: string;
}

/**
 * Rewrites every absolute `import("…")` path in `typeText` to a workspace-relative,
 * forward-slashed path.
 *
 * Paths that are already relative, or that resolve outside `workspaceRoot`, are left
 * untouched — there is no stable shorter form for them, and rewriting to a `../`
 * chain would reintroduce the machine dependence this exists to remove.
 *
 * @param input - The type text and the workspace root to relativize against.
 * @returns The type text with workspace-internal absolute paths relativized.
 */
export function sanitizeTypeText(input: SanitizeTypeTextInput): string {
  const { typeText, workspaceRoot } = input;
  return typeText.replaceAll(INLINE_TYPE_IMPORT_PATTERN, (match, importPath: string) => {
    let replacement: string;
    if (isAbsolute(importPath)) {
      const relativePath = relative(workspaceRoot, importPath).replaceAll('\\', '/');
      replacement = relativePath.length > 0 && !relativePath.startsWith('..') ? `import("${relativePath}")` : match;
    } else {
      replacement = match;
    }
    return replacement;
  });
}
