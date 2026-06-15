/**
 * Shared package-root resolver for the MCP-scan registry loaders.
 *
 * Every `load-*-registry.ts` resolves the bundled manifest it ships in its
 * package's `generated/` directory by walking up from the module's own URL
 * until a `package.json` appears. Centralizing the walk here keeps each
 * loader free of the duplicated traversal.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Walks up from the directory of `startUrl` until it finds a directory that
 * contains a `package.json`, returning that directory.
 *
 * @param startUrl - An `import.meta.url` from a module inside the package.
 * @returns The absolute path of the nearest ancestor directory holding a `package.json`.
 * @throws {Error} If no `package.json` is found before reaching the filesystem root.
 */
export function findPackageRoot(startUrl: string): string {
  const startPath = fileURLToPath(startUrl);
  let dir = dirname(startPath);
  let result: string | undefined;
  while (result === undefined) {
    if (existsSync(resolve(dir, 'package.json'))) {
      result = dir;
    } else {
      const parent = dirname(dir);
      if (parent === dir) {
        throw new Error(`findPackageRoot: no package.json found above ${startPath}`);
      }
      dir = parent;
    }
  }
  return result;
}
