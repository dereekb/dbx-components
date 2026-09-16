import { existsSync } from 'node:fs';
import * as path from 'node:path';

/**
 * Resolves the on-disk path to a build-time artifact emitted into `dist/apps/demo-api`.
 *
 * The lookup has to cope with three different `process.cwd()` values:
 * - The Firebase Functions emulator + production runtime set `cwd` to the deployed
 *   function directory (the same one `main.js` was bundled into), so the artifact
 *   lives at `<cwd>/<relativePath>` — sibling to the running bundle.
 * - dbx-cli boots from the workspace root, so it lives at
 *   `<cwd>/dist/apps/demo-api/<relativePath>`.
 * - Vitest runs with `cwd` set to the project root (`apps/demo-api`, see the
 *   `run-tests` target), which is neither of the above — so the workspace-root form
 *   is also probed against each ancestor directory.
 *
 * Prior to this resolver the path was hardcoded to the workspace-root form, which
 * silently failed under the functions runtime and made the manifest-gated tools
 * (`model-info`, `model-decode`) invisible to MCP clients.
 *
 * Works for a directory as well as a file — the signed asset-download endpoint resolves its secure
 * root (`assets/secure`) through exactly this probe.
 *
 * @param relativePath - Artifact path relative to the dist output, e.g. `mcp.manifest.json` or `assets/secure`.
 * @returns The absolute path to the first candidate that exists, else the workspace-root form relative to `cwd` (so the loader logs a "missing file" warning naming that path).
 */
export function resolveDistArtifactPath(relativePath: string): string {
  const cwd = process.cwd();
  const colocatedWithBundle = path.join(cwd, relativePath);
  let result: string | undefined = existsSync(colocatedWithBundle) ? colocatedWithBundle : undefined;

  if (result == null) {
    // Walk up from cwd so a run rooted anywhere inside the workspace (vitest's projectRoot cwd,
    // for instance) still finds the dist output at the workspace root.
    let directory = cwd;

    for (;;) {
      const candidate = path.join(directory, 'dist/apps/demo-api', relativePath);

      if (existsSync(candidate)) {
        result = candidate;
        break;
      }

      const parent = path.dirname(directory);

      if (parent === directory) {
        break;
      }

      directory = parent;
    }
  }

  return result ?? path.join(cwd, 'dist/apps/demo-api', relativePath);
}
