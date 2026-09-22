import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BUNDLED_FILENAMES } from './load-utils-registry.js';

const PACKAGE_ROOT = resolve(__dirname, '..', '..', '..', '..');
const MANIFESTS_DIR = resolve(PACKAGE_ROOT, 'generated');
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, '..', '..');
const CONFIG_PATH = resolve(WORKSPACE_ROOT, 'dbx-mcp.config.json');

interface UtilsScanSection {
  readonly utils?: { readonly scan?: readonly { readonly out: string }[] };
}

/**
 * Guards the one drift that makes a correctly-tagged export silently invisible to `dbx_util_lookup` /
 * `dbx_util_search`: a `utils.scan` entry in `dbx-mcp.config.json` generates a manifest that
 * {@link DEFAULT_BUNDLED_FILENAMES} never names, so the server simply never loads it.
 *
 * Bundled manifests load non-strict (missing file warns and skips), so this failure mode produces no error
 * anywhere — only a lookup that returns "no utility matched" for an export that is right there in the JSON.
 */
describe('bundled @dereekb/* utils manifests', () => {
  it('names every utils.scan output from dbx-mcp.config.json', () => {
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as UtilsScanSection;
    const generated = (config.utils?.scan ?? []).map((scan) => basename(scan.out));

    expect(generated.length).toBeGreaterThan(0);
    expect([...DEFAULT_BUNDLED_FILENAMES].sort()).toEqual([...generated].sort());
  });

  it('names only manifests that exist in the generated directory', () => {
    const missing = DEFAULT_BUNDLED_FILENAMES.filter((filename) => !existsSync(resolve(MANIFESTS_DIR, filename)));
    expect(missing).toEqual([]);
  });
});
