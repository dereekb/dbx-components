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
 * Applies the nx.json edits (script lines 244, 495-504).
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
    ...nxJson,
    workspaceLayout: { appsDir: naming.appsFolder, libsDir: naming.componentsFolder },
    targetDefaults,
    tui: { enabled: false }
  };
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
