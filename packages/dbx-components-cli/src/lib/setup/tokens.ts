/**
 * The order-sensitive token substitution table, derived from {@link SetupNaming}.
 *
 * Two layers, mirroring `setup-project.sh`:
 *
 * - **Global tokens** — the 16 replacements `download_ts_file` (script line 625)
 *   applies to every scaffolded module-subtree text file, in collision-safe
 *   order (the `_CAPS|_CAMEL|_LOWER` variants before bare `APP_CODE_PREFIX`).
 * - **Per-file tokens** — a `Map<archivePath, orderedTokens>` for the handful of
 *   config / root files whose `sed` lists are file-specific (firebase.json,
 *   .firebaserc, docker, project.json templates, circleci, proxy confs, …).
 *   These are applied **exclusively** (never combined with the global set), so a
 *   broad global token cannot corrupt a file — e.g. `.firebaserc` uses
 *   `FIREBASE_PROJECT_ID_STAGING`, which contains `FIREBASE_PROJECT_ID`, so the
 *   global `FIREBASE_PROJECT_ID` token must never touch it.
 */

import { type SetupNaming } from './naming.js';

/**
 * A single literal search → replace pair.
 */
export interface SetupToken {
  readonly search: string;
  readonly replace: string;
}

/**
 * The resolved two-layer token table.
 */
export interface SetupTokenTable {
  /**
   * Tokens applied to every module-subtree text file, in order.
   */
  readonly global: readonly SetupToken[];
  /**
   * Per-archive-path token lists, applied exclusively for the keyed files.
   */
  readonly perFile: ReadonlyMap<string, readonly SetupToken[]>;
}

/**
 * Optional CI git identity used by the CircleCI config (script defaults).
 */
export interface SetupTokenOptions {
  readonly ciGitUserEmail?: string;
  readonly ciGitUserName?: string;
}

const DEFAULT_CI_GIT_USER_EMAIL = 'ci@example.dereekb.com';
const DEFAULT_CI_GIT_USER_NAME = 'ci';

/**
 * The global token list, in the exact collision-safe order of `download_ts_file`.
 *
 * @param naming - The derived naming object.
 * @returns The ordered global token list.
 */
function buildGlobalTokens(naming: SetupNaming): readonly SetupToken[] {
  return [
    { search: 'FIREBASE_STAGING_PROJECT_ID', replace: naming.stagingProjectId },
    { search: 'FIREBASE_PROJECT_ID', replace: naming.firebaseProjectId },
    { search: 'APP_CODE_PREFIX_CAPS', replace: naming.appCodePrefixCaps },
    { search: 'APP_CODE_PREFIX_CAMEL', replace: naming.appCodePrefixCamel },
    { search: 'APP_CODE_PREFIX_LOWER', replace: naming.appCodePrefixLower },
    { search: 'APP_CODE_PREFIX', replace: naming.appCodePrefix },
    { search: 'FIREBASE_COMPONENTS_NAME', replace: naming.firebaseComponentsName },
    { search: 'ANGULAR_COMPONENTS_NAME', replace: naming.angularComponentsName },
    { search: 'ANGULAR_COMPONENTS_FOLDER', replace: naming.angularComponentsFolder },
    { search: 'FIREBASE_COMPONENTS_FOLDER', replace: naming.firebaseComponentsFolder },
    { search: 'ANGULAR_APP_NAME', replace: naming.angularAppName },
    { search: 'API_APP_NAME', replace: naming.apiAppName },
    { search: 'FIREBASE_EMULATOR_AUTH_PORT', replace: String(naming.emulatorAuthPort) },
    { search: 'FIREBASE_EMULATOR_FIRESTORE_PORT', replace: String(naming.emulatorFirestorePort) },
    { search: 'FIREBASE_EMULATOR_HOSTING_PORT', replace: String(naming.emulatorHostingPort) },
    { search: 'FIREBASE_EMULATOR_STORAGE_PORT', replace: String(naming.emulatorStoragePort) }
  ];
}

/**
 * Builds the per-file token map, keyed by archive-relative template path. Order
 * within each list mirrors the corresponding `sed -e` chain in the script.
 *
 * @param naming - The derived naming object.
 * @param options - CI git identity options.
 * @returns The per-file token map.
 */
function buildPerFileTokens(naming: SetupNaming, options: SetupTokenOptions): ReadonlyMap<string, readonly SetupToken[]> {
  const ciGitUserEmail = options.ciGitUserEmail ?? DEFAULT_CI_GIT_USER_EMAIL;
  const ciGitUserName = options.ciGitUserName ?? DEFAULT_CI_GIT_USER_NAME;

  const map = new Map<string, readonly SetupToken[]>();

  // firebase.json (script line 323) — _STAGING before bare id (substring), then dist folders.
  map.set('firebase.json', [
    { search: 'FIREBASE_PROJECT_ID_STAGING', replace: naming.stagingProjectId },
    { search: 'FIREBASE_PROJECT_ID', replace: naming.firebaseProjectId },
    { search: 'ANGULAR_APP_DIST_FOLDER', replace: naming.angularAppDistFolder },
    { search: 'API_APP_DIST_FOLDER', replace: naming.apiAppDistFolder }
  ]);

  // .firebaserc (script line 330)
  map.set('.firebaserc', [
    { search: 'FIREBASE_PROJECT_ID_STAGING', replace: naming.stagingProjectId },
    { search: 'FIREBASE_PROJECT_ID', replace: naming.firebaseProjectId }
  ]);

  // Dockerfile (script line 355)
  map.set('root/Dockerfile', [{ search: 'demo-api', replace: naming.apiAppName }]);

  // docker-compose.yml (script line 359) — server/network before bare demo-api (prefix), then port range.
  map.set('root/docker-compose.yml', [
    { search: 'dereekb-components', replace: naming.stagingProjectId },
    { search: 'demo-api-server', replace: naming.dockerContainerAppName },
    { search: 'demo-api-network', replace: naming.dockerContainerNetworkName },
    { search: 'demo-api', replace: naming.apiAppName },
    { search: '9900-9908', replace: naming.emulatorPortRange }
  ]);

  // .gitignore (script line 364)
  map.set('root/.gitignore', [{ search: 'demo-api', replace: naming.apiAppName }]);

  // exec-with-emulator.sh (script line 369)
  map.set('root/exec-with-emulator.sh', [
    { search: 'demo-api-server', replace: naming.dockerContainerAppName },
    { search: 'demo-api', replace: naming.apiAppName }
  ]);

  // test-all.sh (script line 404)
  map.set('root/test-all.sh', [{ search: 'demo-api', replace: naming.apiAppName }]);

  // run-server.sh (script line 409)
  map.set('root/run-server.sh', [
    { search: 'demo-api-server', replace: naming.dockerContainerAppName },
    { search: 'demo-api', replace: naming.apiAppName }
  ]);

  // serve-server.sh (script line 414)
  map.set('root/serve-server.sh', [
    { search: 'demo-api-server', replace: naming.dockerContainerAppName },
    { search: 'demo-api', replace: naming.apiAppName }
  ]);

  // serve-web.sh (script line 422)
  map.set('root/serve-web.sh', [{ search: 'demo', replace: naming.angularAppName }]);

  // test-demo-api.sh (script line 427) — also renamed to test-<api>.sh by the root module.
  map.set('root/test-demo-api.sh', [{ search: 'demo-api', replace: naming.apiAppName }]);

  // wait-for-ports.sh (script line 432)
  map.set('root/wait-for-ports.sh', [{ search: '9900-9908', replace: naming.emulatorPortRange }]);

  // .env (script line 437)
  map.set('root/.env', [{ search: '9910', replace: String(naming.angularAppPort) }]);

  // tools/scripts/release.mjs (script line 442) — github-username TODO first, then project rename.
  map.set('root/tools/scripts/release.mjs', [
    { search: "dereekb';", replace: "dereekb'; // TODO: Replace with your github username" },
    { search: 'dbx-components', replace: naming.projectName }
  ]);

  // .circleci/config.yml (script line 564)
  map.set('.circleci/config.yml', [
    { search: 'CI_GIT_USER_EMAIL', replace: ciGitUserEmail },
    { search: 'CI_GIT_USER_NAME', replace: ciGitUserName },
    { search: 'ANGULAR_APP_NAME', replace: naming.angularAppName },
    { search: 'API_APP_NAME', replace: naming.apiAppName },
    { search: 'E2E_APP_NAME', replace: naming.e2eAppName }
  ]);

  // make-api-package.js (script line 568)
  map.set('make-api-package.js', [{ search: 'API_APP_FOLDER', replace: naming.apiAppFolder }]);

  // apps/app/project.template.json (script line 585)
  map.set('apps/app/project.template.json', [
    { search: 'ANGULAR_APP_DIST_FOLDER', replace: naming.angularAppDistFolder },
    { search: 'ANGULAR_APP_FOLDER', replace: naming.angularAppFolder },
    { search: 'ANGULAR_APP_NAME', replace: naming.angularAppName },
    { search: 'ANGULAR_APP_PORT', replace: String(naming.angularAppPort) }
  ]);

  // apps/api/project.template.json (script line 590)
  map.set('apps/api/project.template.json', [
    { search: 'API_APP_DIST_FOLDER', replace: naming.apiAppDistFolder },
    { search: 'API_APP_FOLDER', replace: naming.apiAppFolder },
    { search: 'API_APP_NAME', replace: naming.apiAppName }
  ]);

  // apps/api/webpack.config.template.js (script line 594)
  map.set('apps/api/webpack.config.template.js', [
    { search: 'API_APP_DIST_FOLDER', replace: naming.apiAppDistFolder },
    { search: 'API_APP_FOLDER', replace: naming.apiAppFolder },
    { search: 'API_APP_NAME', replace: naming.apiAppName }
  ]);

  // components/app/project.template.json (script line 600) — ANGULAR_APP_PREFIX is undefined in the
  // script, so its `sed` deletes the token (replace with empty string). Quirk preserved deliberately.
  map.set('components/app/project.template.json', [
    { search: 'ANGULAR_COMPONENTS_DIST_FOLDER', replace: naming.angularComponentsDistFolder },
    { search: 'FIREBASE_COMPONENTS_NAME', replace: naming.firebaseComponentsName },
    { search: 'ANGULAR_COMPONENTS_FOLDER', replace: naming.angularComponentsFolder },
    { search: 'APP_CODE_PREFIX_LOWER', replace: naming.appCodePrefixLower },
    { search: 'ANGULAR_APP_PREFIX', replace: '' },
    { search: 'ANGULAR_COMPONENTS_NAME', replace: naming.angularComponentsName }
  ]);

  // components/firebase/project.template.json (script line 605)
  map.set('components/firebase/project.template.json', [
    { search: 'FIREBASE_COMPONENTS_DIST_FOLDER', replace: naming.firebaseComponentsDistFolder },
    { search: 'FIREBASE_COMPONENTS_FOLDER', replace: naming.firebaseComponentsFolder },
    { search: 'FIREBASE_COMPONENTS_NAME', replace: naming.firebaseComponentsName }
  ]);

  // apps/api/src/environments/environment.ts — dev appUrl uses the angular dev-server port
  // (the OIDC issuer origin; see the `oidc` add-on). Exclusive per-file list (no global tokens needed).
  map.set('apps/api/src/environments/environment.ts', [{ search: 'ANGULAR_APP_PORT', replace: String(naming.angularAppPort) }]);

  // apps/<app> proxy confs (script lines 782, 786)
  map.set('root/apps-demo/proxy.conf.dev.json', [{ search: '9902', replace: String(naming.emulatorAuthPort) }]);
  map.set('root/apps-demo/proxy.conf.prod.json', [{ search: 'components.dereekb.com', replace: 'example.dereekb.com' }]);

  return map;
}

/**
 * Builds the complete {@link SetupTokenTable} from derived naming.
 *
 * @param naming - The derived naming object.
 * @param options - Optional CI git identity overrides.
 * @returns The two-layer token table.
 */
export function buildSetupTokenTable(naming: SetupNaming, options?: SetupTokenOptions): SetupTokenTable {
  return {
    global: buildGlobalTokens(naming),
    perFile: buildPerFileTokens(naming, options ?? {})
  };
}
