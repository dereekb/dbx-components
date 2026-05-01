#!/usr/bin/env node
/**
 * Generates bundled manifest JSON files for the @dereekb/* packages
 * shipped with @dereekb/dbx-components-mcp. The set of bundled scans is
 * driven by the workspace-root `dbx-mcp.config.json` — one entry per
 * `<cluster>.scan[]` array (semanticTypes, uiComponents, forgeFields,
 * pipes, actions, filters).
 *
 * Run from the workspace root (that's what `nx run dbx-components-mcp:generate-manifests`
 * guarantees). Each scan invokes the canonical `runScanCli` entry point from
 * `src/scan/*-cli.ts` so this script and the user-facing binary stay in lockstep.
 *
 * Forwarded flags
 *   --check    Fail with exit code 1 when any committed manifest is stale.
 *
 * Mirrors the spirit of `scripts/extract-firebase-models.mjs`. Uses ts-node's
 * ESM loader so the script can `import` the package's TypeScript source
 * directly without a prior build step.
 */

import { readFile as nodeReadFile } from 'node:fs/promises';
import { register } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(SCRIPT_DIR, '..');
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, '..', '..');
const ROOT_CONFIG_PATH = resolve(WORKSPACE_ROOT, 'dbx-mcp.config.json');

// Register ts-node so we can import the canonical TypeScript entry point.
register('ts-node/esm', pathToFileURL(`${WORKSPACE_ROOT}/`));

const { runScanCli } = await import(`${pathToFileURL(PACKAGE_ROOT).href}/src/scan/cli.ts`);
const { runUiComponentsScanCli } = await import(`${pathToFileURL(PACKAGE_ROOT).href}/src/scan/ui-components-cli.ts`);
const { runForgeFieldsScanCli } = await import(`${pathToFileURL(PACKAGE_ROOT).href}/src/scan/forge-fields-cli.ts`);
const { runPipesScanCli } = await import(`${pathToFileURL(PACKAGE_ROOT).href}/src/scan/pipes-cli.ts`);
const { runActionsScanCli } = await import(`${pathToFileURL(PACKAGE_ROOT).href}/src/scan/actions-cli.ts`);
const { runFiltersScanCli } = await import(`${pathToFileURL(PACKAGE_ROOT).href}/src/scan/filters-cli.ts`);

/**
 * Bundled manifests stamp a fixed `generatedAt` so the produced JSON is
 * byte-stable across runs. Without a deterministic timestamp every scan would
 * dirty the working tree and `--check` mode (CI freshness gate) would never
 * match. Sentinel value: epoch zero, intentionally meaningless as a wall-clock
 * date — bundled manifests are versioned by git, not by their generatedAt.
 */
const BUNDLED_GENERATED_AT = () => new Date(0);

const argv = process.argv.slice(2);

const rootConfigRaw = await nodeReadFile(ROOT_CONFIG_PATH, 'utf-8');
const rootConfig = JSON.parse(rootConfigRaw);
if (rootConfig.version !== 1) {
  console.error(`generate-manifests: unsupported dbx-mcp.config.json version: ${rootConfig.version}`);
  process.exit(1);
}

/**
 * Cluster-CLI dispatch table. Each entry maps the root-config cluster key
 * to the per-cluster CLI runner, the legacy section key the CLI expects
 * inside `dbx-mcp.scan.json`, and a shape flag — semantic-types entries
 * are flattened at the JSON root, every other cluster nests inside a
 * `<sectionKey>` block.
 */
const CLUSTER_DISPATCH = {
  semanticTypes: { run: runScanCli, sectionKey: null, label: 'semantic-types' },
  uiComponents: { run: runUiComponentsScanCli, sectionKey: 'uiComponents', label: 'ui-components' },
  forgeFields: { run: runForgeFieldsScanCli, sectionKey: 'forgeFields', label: 'forge-fields' },
  pipes: { run: runPipesScanCli, sectionKey: 'pipes', label: 'pipes' },
  actions: { run: runActionsScanCli, sectionKey: 'actions', label: 'actions' },
  filters: { run: runFiltersScanCli, sectionKey: 'filters', label: 'filters' }
};

const results = [];
for (const [clusterKey, dispatch] of Object.entries(CLUSTER_DISPATCH)) {
  const cluster = rootConfig[clusterKey];
  const scanEntries = cluster && Array.isArray(cluster.scan) ? cluster.scan : [];
  for (const entry of scanEntries) {
    const projectAbs = resolve(WORKSPACE_ROOT, entry.project);
    const outAbs = resolve(WORKSPACE_ROOT, entry.out);
    const outRel = relative(projectAbs, outAbs).replaceAll('\\', '/');

    // Build the legacy per-package shape the cluster CLI expects to read
    // from `<projectRoot>/dbx-mcp.scan.json`. semantic-types is flat at
    // the JSON root; every other cluster nests under its section key.
    const sectionPayload = {
      ...(entry.source !== undefined ? { source: entry.source } : {}),
      ...(entry.topicNamespace !== undefined ? { topicNamespace: entry.topicNamespace } : {}),
      ...(entry.module !== undefined ? { module: entry.module } : {}),
      ...(entry.include !== undefined ? { include: entry.include } : {}),
      ...(entry.exclude !== undefined ? { exclude: entry.exclude } : {}),
      out: outRel,
      ...(entry.declaredTopics !== undefined ? { declaredTopics: entry.declaredTopics } : {})
    };
    const inlineConfig = dispatch.sectionKey === null ? { version: 1, ...sectionPayload } : { version: 1, [dispatch.sectionKey]: sectionPayload };
    const inlineConfigJson = JSON.stringify(inlineConfig);
    const inlineConfigPath = resolve(projectAbs, 'dbx-mcp.scan.json');

    // Wrap readFile so the cluster CLI's "load scan config" step picks
    // up the inline JSON instead of the (now-deleted) on-disk file.
    const wrappedReadFile = async (path) => {
      if (path === inlineConfigPath) {
        return inlineConfigJson;
      }
      return nodeReadFile(path, 'utf-8');
    };

    const result = await dispatch.run({
      argv: ['--project', entry.project, ...argv],
      cwd: WORKSPACE_ROOT,
      generator: '@dereekb/dbx-components-mcp/scripts/generate-manifests.mjs',
      now: BUNDLED_GENERATED_AT,
      readFile: wrappedReadFile
    });
    results.push({ project: entry.project, cluster: dispatch.label, exitCode: result.exitCode });
  }
}

const failed = results.filter((r) => r.exitCode !== 0);
if (failed.length > 0) {
  for (const f of failed) {
    console.error(`generate-manifests: ${f.cluster} ${f.project} exited ${f.exitCode}`);
  }
  process.exit(1);
}
