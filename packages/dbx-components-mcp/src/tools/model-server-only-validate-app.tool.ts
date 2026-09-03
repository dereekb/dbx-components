/**
 * `dbx_model_server_only_validate_app` tool.
 *
 * Asserts that the THREE independent declarations of "no client may read this model" agree:
 *
 *   1. `@dbxModelServerOnly` on the model interface — carried onto `CliModelManifestEntry.serverOnly`,
 *      so the CLI can refuse before it chooses a transport.
 *   2. `serverOnly: true` on the `firebaseModelServiceFactory` config — what `ModelApiGetService`
 *      reads before `useModel`, and therefore what actually refuses the read.
 *   3. The rules-derived verdict from `firestore.rules` — no match block, or read grants that are all
 *      constant-`false`.
 *
 * The reason all three exist is that the model API authorizes reads via `roleMapForModel` under the
 * Admin SDK and never consults `firestore.rules`. A model the rules refuse outright is therefore
 * reachable through the API unless the runtime flag says otherwise — which is the leak this validator
 * exists to catch. The static rules scan is the routing source;
 * `apps/demo-api/src/test/tests/firestore.rules.spec.ts` remains the dynamic oracle.
 *
 * Scope is MODEL-LEVEL reachability only. It deliberately does not reconcile document-level
 * divergence (e.g. `gb` grants `resourceIsPublished()` in the rules while `roleMapForModel` also
 * grants the creator and admins read on an unpublished guestbook) — those are both real per-document
 * policies and reconciling them is a separate design question.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { Tool } from '@modelcontextprotocol/server';
import { type } from 'arktype';
import { ensurePathInsideCwd } from '@dereekb/dbx-cli/validate';
import { scanFirestoreRules } from '@dereekb/dbx-cli/firestore-rules';
import { extractModelsFromSource } from '@dereekb/dbx-cli/manifest-extract';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { extractModelServiceFlags } from './model-server-only-validate-app/extract-service-flags.js';
import { formatModelServerOnlyReportAsJson, formatModelServerOnlyReportAsMarkdown } from './model-server-only-validate-app/format.js';
import { validateModelServerOnly, type ServerOnlyIdentityFact, type ServerOnlyInterfaceFact } from './model-server-only-validate-app/validate.js';

// MARK: Args
const ValidateAppArgsType = type({
  componentDir: 'string',
  'rulesFile?': 'string',
  'serviceFile?': 'string',
  'modelDirs?': 'string[]',
  'manifestFile?': 'string',
  'format?': "'markdown' | 'json'"
});

const DEFAULT_RULES_FILE = 'firestore.rules';

/**
 * Framework model home, added to the scan surface when it exists. Most `@dbxModel` interfaces a
 * downstream component registers services for (`notification`, `systemState`, `storageFile`, …) are
 * declared here rather than in the component itself, so without it the rules leg would be
 * unresolvable for the majority of a real app's models.
 */
const DEFAULT_UPSTREAM_MODEL_DIRS = ['packages/firebase/src/lib/model'];

const TOOL: Tool = {
  name: 'dbx_model_server_only_validate_app',
  description: [
    'Reconcile the three independent declarations of "no client may read this model" for every registered model service.',
    '',
    '1. `@dbxModelServerOnly` on the model interface — carried onto the generated model manifest, so the CLI refuses the read locally before choosing a transport.',
    '2. `serverOnly: true` on the `firebaseModelServiceFactory` config — what `ModelApiGetService` reads before `useModel`, and therefore what actually refuses the read (`MODEL_IS_SERVER_ONLY`).',
    '3. The rules-derived verdict from `firestore.rules` — a collection with no match block, or whose read grants are all constant-`false`, is server-only.',
    '',
    'Why all three matter: the model API authorizes via `roleMapForModel` under the Admin SDK and NEVER consults `firestore.rules`. A model the rules refuse outright is still reachable through the API unless the runtime flag says otherwise — that leak is the thing this validator catches.',
    '',
    'Provide:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `rulesFile` (optional): relative path to the rules file. Defaults to `firestore.rules` at the server cwd.',
    '- `serviceFile` (optional): relative path to the model service file. Defaults to `<componentDir>/src/lib/model/service.ts`.',
    "- `modelDirs` (optional): extra dirs scanned for `firestoreModelIdentity(...)` declarations and model interfaces. The component and `packages/firebase/src/lib/model` are always included when they exist — widen this when a model's identity lives elsewhere (e.g. `packages/openrouter/firebase/src/lib`).",
    '- `manifestFile` (optional): relative path to a generated CLI model manifest (e.g. `apps/demo-cli/src/lib/manifest/api.manifest.generated.ts`). When supplied, server-only models absent from it are reported — the runtime gate still covers them, but the CLI-side local refusal cannot fire.',
    '- `format` (optional): `markdown` (default) or `json`.',
    '',
    'Paths escaping the server cwd are rejected.',
    '',
    'Scope is MODEL-LEVEL reachability. Document-level divergence between the rules and `roleMapForModel` (both real per-document policies) is deliberately out of scope.',
    '',
    'Codes: `MODEL_SERVER_ONLY_MISSING_RUNTIME_FLAG` (error — live leak), `MODEL_SERVER_ONLY_RULES_ALLOW_READ` (error), `MODEL_SERVER_ONLY_TAG_FLAG_MISMATCH` (error), `MODEL_SERVER_ONLY_MISSING_TAG`, `MODEL_SERVER_ONLY_TAG_WITHOUT_MODEL_TAG`, `MODEL_SERVER_ONLY_NO_INTERFACE`, `MODEL_SERVER_ONLY_UNRESOLVED_IDENTITY`, `MODEL_SERVER_ONLY_NOT_IN_MANIFEST`. Pass any of them to `dbx_explain_rule`.',
    '',
    'Pair with `dbx_firestore_rules_scan` to see the raw per-collection read posture the rules leg is derived from.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the `-firebase` component package.' },
      rulesFile: { type: 'string', description: 'Relative path to `firestore.rules`. Defaults to `firestore.rules` at the server cwd.' },
      serviceFile: { type: 'string', description: 'Relative path to the model service file. Defaults to `<componentDir>/src/lib/model/service.ts`.' },
      modelDirs: { type: 'array', items: { type: 'string' }, description: 'Extra dirs scanned for model identities + interfaces.' },
      manifestFile: { type: 'string', description: 'Relative path to a generated CLI model manifest to cross-check.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['componentDir']
  }
};

interface ScannedModelFacts {
  readonly interfaces: readonly ServerOnlyInterfaceFact[];
  readonly identities: readonly ServerOnlyIdentityFact[];
}

/**
 * Walks the supplied dirs for `.ts` sources and reduces them to the interface + identity facts the
 * reconciliation joins against. Reuses the same `extractModelsFromSource` the api-manifest generator
 * runs, so the tags this reads are exactly the tags that reach the manifest.
 *
 * @param input - The absolute workspace root and the workspace-relative dirs to scan.
 * @param input.cwd - Absolute workspace root.
 * @param input.dirs - Workspace-relative dirs to walk.
 * @returns The collected facts, first declaration winning on a name collision.
 */
async function scanModelFacts(input: { readonly cwd: string; readonly dirs: readonly string[] }): Promise<ScannedModelFacts> {
  const interfaces = new Map<string, ServerOnlyInterfaceFact>();
  const identities = new Map<string, ServerOnlyIdentityFact>();

  for (const dir of input.dirs) {
    for (const filePath of await walkTypeScriptFiles(resolve(input.cwd, dir))) {
      const text = await readFile(filePath, 'utf8');

      if (!text.includes('firestoreModelIdentity(') && !text.includes('@dbxModel')) continue;

      const relativePath = relative(input.cwd, filePath);
      const extraction = extractModelsFromSource({ name: filePath, text });

      for (const iface of extraction.interfaces) {
        if (!interfaces.has(iface.name)) {
          interfaces.set(iface.name, { name: iface.name, serverOnly: iface.dbxModelServerOnly === true, hasModelTag: iface.hasDbxModelTag, file: relativePath });
        }
      }

      for (const identity of extraction.identities) {
        if (identity.collectionPrefix !== undefined && !identities.has(identity.modelType)) {
          identities.set(identity.modelType, { modelType: identity.modelType, collection: identity.collectionPrefix });
        }
      }
    }
  }

  return { interfaces: Array.from(interfaces.values()), identities: Array.from(identities.values()) };
}

async function walkTypeScriptFiles(dir: string): Promise<readonly string[]> {
  const out: string[] = [];
  let entries: readonly string[] = [];

  try {
    entries = (await readdir(dir)).sort();
  } catch {
    // unreadable directory — leave `entries` empty so the walk contributes nothing for it
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist') continue;

    const path = join(dir, entry);
    const info = await stat(path).catch(() => undefined);

    if (info?.isDirectory()) {
      out.push(...(await walkTypeScriptFiles(path)));
    } else if (info?.isFile() && entry.endsWith('.ts') && !entry.endsWith('.spec.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      out.push(path);
    }
  }

  return out;
}

/**
 * Reads the `modelType: '<x>'` keys out of a generated model manifest source. A textual read on
 * purpose — the generated file is a TS module the MCP server cannot import at runtime, and the only
 * thing needed from it is the set of model types it covers.
 *
 * @param source - The generated manifest source.
 * @returns The model types the manifest declares.
 */
function readManifestModelTypes(source: string): readonly string[] {
  return Array.from(source.matchAll(/modelType:\s*'([^']+)'/g)).map((m) => m[1] as string);
}

async function readOptionalFile(path: string): Promise<string | undefined> {
  return readFile(path, 'utf8').catch(() => undefined);
}

async function isDirectory(path: string): Promise<boolean> {
  return stat(path)
    .then((x) => x.isDirectory())
    .catch(() => false);
}

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = ValidateAppArgsType(rawArgs);

  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }

  const cwd = process.cwd();
  const rulesFile = parsed.rulesFile ?? DEFAULT_RULES_FILE;
  const serviceFile = parsed.serviceFile ?? `${parsed.componentDir.replace(/[/\\]+$/, '')}/src/lib/model/service.ts`;
  let failure: string | undefined;

  try {
    for (const path of [parsed.componentDir, rulesFile, serviceFile, ...(parsed.modelDirs ?? []), ...(parsed.manifestFile === undefined ? [] : [parsed.manifestFile])]) {
      ensurePathInsideCwd(path, cwd);
    }
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err);
  }

  if (failure !== undefined) {
    return toolError(failure);
  }

  const rulesSource = await readOptionalFile(resolve(cwd, rulesFile));

  if (rulesSource === undefined) {
    return toolError(`Failed to read rules file \`${rulesFile}\`.`);
  }

  const serviceSource = await readOptionalFile(resolve(cwd, serviceFile));

  if (serviceSource === undefined) {
    return toolError(`Failed to read service file \`${serviceFile}\`. Pass \`serviceFile\` when the component does not use the conventional \`src/lib/model/service.ts\` path.`);
  }

  const requestedDirs = [`${parsed.componentDir.replace(/[/\\]+$/, '')}/src/lib`, ...DEFAULT_UPSTREAM_MODEL_DIRS, ...(parsed.modelDirs ?? [])];
  const modelDirs: string[] = [];

  for (const dir of requestedDirs) {
    if (!modelDirs.includes(dir) && (await isDirectory(resolve(cwd, dir)))) {
      modelDirs.push(dir);
    }
  }

  const manifestSource = parsed.manifestFile === undefined ? undefined : await readOptionalFile(resolve(cwd, parsed.manifestFile));

  if (parsed.manifestFile !== undefined && manifestSource === undefined) {
    return toolError(`Failed to read model manifest \`${parsed.manifestFile}\`.`);
  }

  const facts = await scanModelFacts({ cwd, dirs: modelDirs });
  const report = validateModelServerOnly({
    componentDir: parsed.componentDir,
    serviceFile,
    rulesFile,
    modelDirs,
    ...(parsed.manifestFile === undefined ? {} : { manifestFile: parsed.manifestFile, manifestModelTypes: readManifestModelTypes(manifestSource as string) }),
    services: extractModelServiceFlags(serviceSource),
    interfaces: facts.interfaces,
    identities: facts.identities,
    rulesScan: scanFirestoreRules(rulesSource)
  });

  const text = parsed.format === 'json' ? formatModelServerOnlyReportAsJson(report) : formatModelServerOnlyReportAsMarkdown(report);
  return { content: [{ type: 'text', text }], ...(report.failed ? { isError: true } : {}) };
}

export const MODEL_SERVER_ONLY_VALIDATE_APP_TOOL: DbxTool = { definition: TOOL, run };
