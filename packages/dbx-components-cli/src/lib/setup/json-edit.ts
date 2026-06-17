/**
 * In-process replacements for the `npx json -I -f … -e "this.x = {…}"` edits in
 * `setup-project.sh`. Done as pure transforms over parsed JSON (plus a small I/O
 * helper) so the edits are deterministic and unit-testable without the `json`
 * CLI dependency.
 *
 * Covered edits:
 * - nx.json: `workspaceLayout`, `targetDefaults` (build-base / build / vitest), `tui`
 * - firebase.json: `functions`, `firestore`, `emulators`
 * - tsconfig.base.json: `compilerOptions`
 * - api tsconfig.json: `compilerOptions.esModuleInterop = false`
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { type Maybe } from '@dereekb/util';
import { type SetupNaming } from './naming.js';

/**
 * A parsed JSON object.
 */
export type JsonObject = Record<string, unknown>;

const FIREBASE_IGNORE = ['firebase.json', '**/.*', '**/node_modules/**'];

/**
 * Returns a shallow copy of `obj` with the given keys removed (pure; never mutates the input).
 *
 * @param obj - The source object.
 * @param keys - The keys to drop.
 * @returns A new object without those keys.
 */
function withoutKeys(obj: JsonObject, keys: readonly string[]): JsonObject {
  return Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));
}

/**
 * Applies the nx.json edits (script lines 244, 495-504). Also strips any
 * `nxCloudId` left by `create-nx-workspace` — the workspace is created with
 * `--nxCloud=skip`, so the project never connects to Nx Cloud.
 *
 * @param nxJson - The parsed nx.json.
 * @param naming - Derived naming (for the workspace layout dirs).
 * @returns A new nx.json object with the edits applied.
 */
export function applyNxJsonEdits(nxJson: JsonObject, naming: SetupNaming): JsonObject {
  const targetDefaults = { ...(nxJson.targetDefaults as JsonObject) };
  targetDefaults['build-base'] = { cache: true };
  targetDefaults['build'] = { dependsOn: ['^build'], inputs: ['production', '^production'], cache: true };
  targetDefaults['@nx/vitest:test'] = {
    cache: true,
    dependsOn: ['^build'],
    inputs: ['default', '^production', '{workspaceRoot}/vitest.preset.config.mts', '{workspaceRoot}/vitest.setup.*.ts'],
    configurations: { ci: { ci: true, codeCoverage: true } }
  };
  return {
    ...withoutKeys(nxJson, ['nxCloudId']),
    workspaceLayout: { appsDir: naming.appsFolder, libsDir: naming.componentsFolder },
    targetDefaults,
    tui: { enabled: false }
  };
}

/**
 * Dependency versions pinned to align a scaffolded project with the
 * `@dereekb/*` 13.18.0 peer ranges, so a strict (non-`--force`) `npm install`
 * resolves: the Angular framework packages to 21.2.11 (`@dereekb/dbx-analytics`),
 * express 5 (`@dereekb/calcom`), `@typescript-eslint` 8.59.3 (`@dereekb/firebase`),
 * and analogjs 2.5.0 (`@dereekb/vitest`). The Angular build/devkit/CLI packages
 * keep their own 21.2.x line and are intentionally not listed.
 */
export const DBX_PEER_ALIGNED_DEPENDENCY_VERSIONS: Readonly<Record<string, string>> = {
  '@angular/common': '21.2.11',
  '@angular/compiler': '21.2.11',
  '@angular/core': '21.2.11',
  '@angular/forms': '21.2.11',
  '@angular/platform-browser': '21.2.11',
  '@angular/platform-server': '21.2.11',
  '@angular/router': '21.2.11',
  '@angular/compiler-cli': '21.2.11',
  '@angular/language-service': '21.2.11',
  express: '^5.2.1',
  '@types/express': '^5.0.0',
  'typescript-eslint': '^8.59.3',
  '@typescript-eslint/utils': '^8.59.3',
  '@analogjs/vite-plugin-angular': '~2.5.0',
  '@analogjs/vitest-angular': '~2.5.0'
};

/**
 * Pins the dependency versions in {@link DBX_PEER_ALIGNED_DEPENDENCY_VERSIONS} on
 * whichever `dependencies` / `devDependencies` section already declares them
 * (never adds a package that is not present). Pure. This replaces the `overrides`
 * block / `.npmrc legacy-peer-deps` workarounds — aligning the declared versions
 * with the `@dereekb` peers is the real fix.
 *
 * @param pkg - The parsed package.json.
 * @returns A new package.json with the aligned versions.
 */
export function alignDbxPeerDependencies(pkg: JsonObject): JsonObject {
  const next: JsonObject = { ...pkg };
  for (const section of ['dependencies', 'devDependencies']) {
    const deps = next[section];
    if (deps != null && typeof deps === 'object') {
      const updated: JsonObject = { ...(deps as JsonObject) };
      for (const name of Object.keys(updated)) {
        const pinned = DBX_PEER_ALIGNED_DEPENDENCY_VERSIONS[name];
        if (pinned !== undefined) {
          updated[name] = pinned;
        }
      }
      next[section] = updated;
    }
  }
  return next;
}

/**
 * Removes the verdaccio local-registry config that `create-nx-workspace`
 * scaffolds for publishable libraries: the `verdaccio` dependency (in either
 * `dependencies` or `devDependencies`) and the `local-registry` script. Pure;
 * the `.verdaccio/` directory itself is removed by the workspace module.
 *
 * @param pkg - The parsed package.json.
 * @returns A new package.json object without the verdaccio config.
 */
export function removeVerdaccioFromPackageJson(pkg: JsonObject): JsonObject {
  const next: JsonObject = { ...pkg };
  for (const depKey of ['dependencies', 'devDependencies']) {
    const deps = next[depKey];
    if (deps != null && typeof deps === 'object') {
      next[depKey] = withoutKeys(deps as JsonObject, ['verdaccio']);
    }
  }
  const scripts = next['scripts'];
  if (scripts != null && typeof scripts === 'object') {
    next['scripts'] = withoutKeys(scripts as JsonObject, ['local-registry']);
  }
  return next;
}

/**
 * Applies the firebase.json `functions`/`firestore`/`emulators` edits (script
 * lines 340-346). The project-id + dist-folder placeholders are handled
 * separately by the per-file token pass.
 *
 * @param firebaseJson - The parsed firebase.json (after token substitution).
 * @param naming - Derived naming (ports, dist folders, localhost).
 * @param nodeVersion - Functions runtime node version (e.g. `24`).
 * @returns A new firebase.json object with the edits applied.
 */
export function applyFirebaseJsonEdits(firebaseJson: JsonObject, naming: SetupNaming, nodeVersion: string): JsonObject {
  return {
    ...firebaseJson,
    functions: {
      source: naming.apiAppDistFolder,
      runtime: `nodejs${nodeVersion}`,
      engines: { node: nodeVersion },
      ignore: [...FIREBASE_IGNORE]
    },
    firestore: { rules: 'firestore.rules', indexes: 'firestore.indexes.json' },
    emulators: {
      singleProjectMode: false,
      ui: { host: naming.localhost, enabled: true, port: naming.emulatorUiPort },
      hosting: { host: naming.localhost, port: naming.emulatorHostingPort },
      functions: { host: naming.localhost, port: naming.emulatorFunctionsPort },
      auth: { host: naming.localhost, port: naming.emulatorAuthPort },
      firestore: { host: naming.localhost, port: naming.emulatorFirestorePort, websocketPort: naming.emulatorFirestoreWebsocketPort },
      pubsub: { host: naming.localhost, port: naming.emulatorPubsubPort },
      storage: { host: naming.localhost, port: naming.emulatorStoragePort }
    }
  };
}

/**
 * Applies the tsconfig.base.json `compilerOptions` merge (script line 609).
 *
 * @param tsconfig - The parsed tsconfig.base.json.
 * @returns A new tsconfig object with merged compiler options.
 */
export function applyTsconfigBaseEdits(tsconfig: JsonObject): JsonObject {
  return {
    ...tsconfig,
    compilerOptions: {
      ...(tsconfig.compilerOptions as JsonObject),
      moduleResolution: 'bundler',
      experimentalDecorators: true,
      importHelpers: true,
      target: 'es2022',
      module: 'ES2022',
      lib: ['es2022', 'dom'],
      useDefineForClassFields: true,
      skipLibCheck: true,
      skipDefaultLibCheck: true,
      allowSyntheticDefaultImports: true,
      resolveJsonModule: true,
      noUnusedLocals: false,
      noImplicitOverride: true,
      strict: true
    }
  };
}

/**
 * Applies the api tsconfig.json `esModuleInterop: false` edit (script line 610).
 *
 * @param tsconfig - The parsed api tsconfig.json.
 * @returns A new tsconfig object with `esModuleInterop` disabled.
 */
export function applyApiTsconfigEdits(tsconfig: JsonObject): JsonObject {
  return {
    ...tsconfig,
    compilerOptions: { ...(tsconfig.compilerOptions as JsonObject), esModuleInterop: false }
  };
}

/**
 * Reads a JSON file, applies a pure transform, and writes the result back
 * (2-space indent + trailing newline). Honors `dryRun` and skips silently when
 * the file is absent.
 *
 * @param path - Absolute path to the JSON file.
 * @param transform - Pure transform over the parsed object.
 * @param options - When `dryRun` is set, the transform runs but no write occurs.
 * @returns The transformed object, or `undefined` when the file was absent.
 */
export function editJsonFile(path: string, transform: (current: JsonObject) => JsonObject, options?: Maybe<{ readonly dryRun?: Maybe<boolean> }>): Maybe<JsonObject> {
  let result: Maybe<JsonObject>;
  if (existsSync(path)) {
    const current = JSON.parse(readFileSync(path, 'utf8')) as JsonObject;
    const next = transform(current);
    if (!options?.dryRun) {
      writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
    }
    result = next;
  }
  return result;
}

// MARK: Add-on JSON edits (idempotent)
/**
 * The default Firebase Cloud Functions region the dev proxy + MCP URLs target.
 */
export const DEFAULT_FIREBASE_REGION = 'us-central1';

/**
 * The outcome of a tracked JSON edit.
 */
export type JsonFileEditStatus = 'edited' | 'unchanged' | 'file-missing';

/**
 * The result of a tracked JSON edit.
 */
export interface JsonFileEditResult {
  readonly status: JsonFileEditStatus;
  readonly result?: Maybe<JsonObject>;
}

/**
 * Like {@link editJsonFile}, but reports whether the file actually changed and
 * only writes when it did — so re-running an add-on is a true no-op (idempotency).
 *
 * @param path - Absolute path to the JSON file.
 * @param transform - Pure transform over the parsed object.
 * @param options - When `dryRun` is set, the transform runs but no write occurs.
 * @returns The edit status (`edited` / `unchanged` / `file-missing`) and the next object.
 */
export function editJsonFileStatus(path: string, transform: (current: JsonObject) => JsonObject, options?: Maybe<{ readonly dryRun?: Maybe<boolean> }>): JsonFileEditResult {
  let outcome: JsonFileEditResult;
  if (existsSync(path)) {
    const before = readFileSync(path, 'utf8');
    const next = transform(JSON.parse(before) as JsonObject);
    const serialized = `${JSON.stringify(next, null, 2)}\n`;
    const changed = serialized !== before;
    if (changed && !options?.dryRun) {
      writeFileSync(path, serialized);
    }
    outcome = { status: changed ? 'edited' : 'unchanged', result: next };
  } else {
    outcome = { status: 'file-missing' };
  }
  return outcome;
}

/**
 * Ensures each `source` has a `{ source, function: 'api' }` rewrite in a single
 * hosting target, inserted before the `**` catch-all. Existing sources are kept.
 *
 * @param target - A firebase.json hosting target object.
 * @param sources - Rewrite source globs to ensure.
 * @returns The target with the rewrites ensured.
 */
function ensureHostingRewrites(target: JsonObject, sources: readonly string[]): JsonObject {
  const rewrites = Array.isArray(target.rewrites) ? [...(target.rewrites as JsonObject[])] : [];
  const existing = new Set(rewrites.map((rewrite) => rewrite.source));
  const catchAllIndex = rewrites.findIndex((rewrite) => rewrite.source === '**');
  const insertAt = catchAllIndex < 0 ? rewrites.length : catchAllIndex;
  const toAdd = sources.filter((source) => !existing.has(source)).map((source) => ({ source, function: 'api' }));
  return { ...target, rewrites: [...rewrites.slice(0, insertAt), ...toAdd, ...rewrites.slice(insertAt)] };
}

/**
 * Ensures the given rewrite sources exist in every hosting target (handles the
 * array-of-targets and single-object hosting shapes). Idempotent.
 *
 * @param firebaseJson - The parsed firebase.json.
 * @param sources - Rewrite source globs to ensure on each target.
 * @returns A new firebase.json with the rewrites ensured.
 */
export function applyHostingRewrites(firebaseJson: JsonObject, sources: readonly string[]): JsonObject {
  const hosting = firebaseJson.hosting;
  let nextHosting: unknown;
  if (Array.isArray(hosting)) {
    nextHosting = hosting.map((target) => ensureHostingRewrites(target as JsonObject, sources));
  } else if (hosting != null && typeof hosting === 'object') {
    nextHosting = ensureHostingRewrites(hosting as JsonObject, sources);
  } else {
    nextHosting = hosting;
  }
  return { ...firebaseJson, hosting: nextHosting };
}

/**
 * Adds the OIDC discovery/authorize/interaction rewrites to every hosting target.
 *
 * @param firebaseJson - The parsed firebase.json.
 * @returns The updated firebase.json.
 */
export function applyOidcFirebaseJsonRewrites(firebaseJson: JsonObject): JsonObject {
  return applyHostingRewrites(firebaseJson, ['/.well-known/**', '/oidc/**', '/interaction/**']);
}

/**
 * Adds the MCP endpoint rewrites to every hosting target.
 *
 * @param firebaseJson - The parsed firebase.json.
 * @returns The updated firebase.json.
 */
export function applyMcpFirebaseJsonRewrites(firebaseJson: JsonObject): JsonObject {
  return applyHostingRewrites(firebaseJson, ['/mcp/**', '/mcp']);
}

/**
 * Builds the dev proxy / MCP target origin: the Firebase Functions emulator
 * origin for the project (`http://0.0.0.0:<functionsPort>/<projectId>/<region>/api`).
 *
 * @param input - The origin parts.
 * @param input.functionsPort - The functions emulator port (base + 2).
 * @param input.projectId - The project id used by the emulator (the `.firebaserc` default — staging).
 * @param input.region - The Cloud Functions region (default `us-central1`).
 * @returns The proxy target origin URL.
 */
export function buildProxyTarget(input: { readonly functionsPort: number; readonly projectId: string; readonly region?: Maybe<string> }): string {
  return `http://0.0.0.0:${input.functionsPort}/${input.projectId}/${input.region ?? DEFAULT_FIREBASE_REGION}/api`;
}

const PROXY_ENTRY_DEFAULTS = { secure: false, logLevel: 'debug' } as const;

/**
 * Rewrites every proxy entry's `target` to the canonical origin and ensures the
 * given route keys exist. The base proxy template ships the OIDC/MCP route keys
 * but targets the wrong (auth) emulator port + demo project id, so normalizing
 * the origin is required, not optional.
 *
 * @param input - The proxy edit inputs.
 * @param input.proxyJson - The parsed proxy.conf.dev.json.
 * @param input.target - The canonical proxy target origin (see {@link buildProxyTarget}).
 * @param input.ensureKeys - Route keys that must be present.
 * @returns The updated proxy object.
 */
export function applyProxyEdits(input: { readonly proxyJson: JsonObject; readonly target: string; readonly ensureKeys: readonly string[] }): JsonObject {
  const next: JsonObject = {};
  for (const [key, value] of Object.entries(input.proxyJson)) {
    next[key] = value != null && typeof value === 'object' ? { ...(value as JsonObject), target: input.target } : value;
  }
  for (const key of input.ensureKeys) {
    if (!(key in next)) {
      next[key] = { target: input.target, ...PROXY_ENTRY_DEFAULTS };
    }
  }
  return next;
}

/**
 * Ensures the OIDC dev-proxy routes exist and every entry targets the functions emulator origin.
 *
 * @param proxyJson - The parsed proxy.conf.dev.json.
 * @param target - The canonical proxy target origin.
 * @returns The updated proxy object.
 */
export function applyOidcProxyEdits(proxyJson: JsonObject, target: string): JsonObject {
  return applyProxyEdits({ proxyJson, target, ensureKeys: ['/.well-known/**', '/oidc/.well-known/**', '/oidc/**', '/interaction/**', '/reg/**'] });
}

/**
 * Ensures the MCP dev-proxy routes exist and every entry targets the functions emulator origin.
 *
 * @param proxyJson - The parsed proxy.conf.dev.json.
 * @param target - The canonical proxy target origin.
 * @returns The updated proxy object.
 */
export function applyMcpProxyEdits(proxyJson: JsonObject, target: string): JsonObject {
  return applyProxyEdits({ proxyJson, target, ensureKeys: ['/mcp/**', '/mcp'] });
}

/**
 * Ensures an http MCP server entry exists in a `.mcp.json` object (create-or-merge).
 *
 * @param mcpJson - The parsed `.mcp.json` (or `{}` when the file is absent).
 * @param input - The server entry to ensure.
 * @param input.name - The MCP server key (e.g. `<project>-mcp-dev`).
 * @param input.url - The MCP endpoint URL.
 * @returns The updated `.mcp.json` object.
 */
export function ensureMcpServerEntry(mcpJson: JsonObject, input: { readonly name: string; readonly url: string }): JsonObject {
  const servers: JsonObject = { ...(mcpJson.mcpServers as JsonObject) };
  if (!(input.name in servers)) {
    servers[input.name] = { type: 'http', url: input.url };
  }
  return { ...mcpJson, mcpServers: servers };
}
