/**
 * Version + dependency constant table, ported from the `DEP__*`,
 * `*_VERSION`, and `DBX_COMPONENTS_VERSION*` variables of `setup-project.sh`.
 *
 * These pin the toolchain (nx / angular / typescript / node / firebase-tools)
 * and every npm dependency the `install` phases add. The defaults are exactly
 * the script's; `resolveSetupVersions` lets the orchestration layer override
 * any of them via environment / flags.
 */

import { type Maybe } from '@dereekb/util';

/**
 * Toolchain + dbx-components version pins (script lines 51-56).
 */
export interface SetupCoreVersions {
  readonly dbxComponents: string;
  readonly nx: string;
  readonly angular: string;
  readonly typescript: string;
  readonly firebaseTools: string;
  readonly node: string;
}

/**
 * Default core versions, matching `setup-project.sh`.
 */
export const DEFAULT_SETUP_CORE_VERSIONS: SetupCoreVersions = {
  dbxComponents: '13.18.0',
  nx: '23.0.0',
  angular: '^21.0.0',
  typescript: '^5.9.3',
  firebaseTools: '15.11.0',
  node: '24'
};

/**
 * Package version pins for the `install` phases (script lines 62-98). Keyed by
 * npm package name so the install commands can be assembled deterministically.
 */
export const SETUP_DEPENDENCY_VERSIONS: Readonly<Record<string, string>> = {
  sharp: '^0.34.5',
  'zone.js': '^0.16.0',
  firebase: '^12.0.0',
  'firebase-admin': '^13.0.0',
  'firebase-functions': '^7.0.0',
  'firebase-functions-test': '3.4.1',
  prettier: '3.8.1',
  'pretty-quick': '^4.2.2',
  'eslint-plugin-import-x': '^4.16.2',
  'eslint-plugin-unused-imports': '4.4.1',
  'eslint-config-prettier': '10.1.8',
  'eslint-plugin-jsdoc': '^62.9.0',
  'eslint-plugin-sonarjs': '^4.0.3',
  'eslint-plugin-unicorn': '^64.0.0',
  'mailgun.js': '^12.0.0',
  rxjs: '^7.8.0',
  'mapbox-gl': '^3.10.0',
  'ngx-mapbox-gl': 'git+https://git@github.com/dereekb/ngx-mapbox-gl#3f1d25b0661bc48abbd415dc79ca7f66568bae2e',
  '@ng-web-apis/geolocation': '^5.1.0',
  '@ng-web-apis/common': '^5.1.0',
  '@zip.js/zip.js': '^2.8.11',
  '@placemarkio/geo-viewport': '^1.0.2',
  '@uirouter/rx': '^1.0.0',
  '@uirouter/core': '^6.1.2',
  '@uirouter/angular': '21.0.0',
  '@ngbracket/ngx-layout': '^21.0.0',
  '@ngrx/store-devtools': '^21.0.0',
  '@firebase/rules-unit-testing': '5.0.0',
  'angular-calendar': '^0.32.1',
  '@types/segment-analytics': '^0.0.38',
  '@analogjs/vite-plugin-angular': '~2.3.1',
  '@ng-forge/dynamic-forms': '^0.7.0'
};

/**
 * The `@dereekb/*` packages installed against the dbx-components version.
 */
export const DEREEKB_PACKAGES: readonly string[] = ['@dereekb/analytics', '@dereekb/browser', '@dereekb/calcom', '@dereekb/date', '@dereekb/dbx-analytics', '@dereekb/dbx-core', '@dereekb/dbx-firebase', '@dereekb/dbx-form', '@dereekb/dbx-web', '@dereekb/firebase', '@dereekb/firebase-server', '@dereekb/model', '@dereekb/zoho', '@dereekb/zoom', '@dereekb/nestjs', '@dereekb/rxjs', '@dereekb/util', '@dereekb/vitest'];

/**
 * The CI dist path the `--ci-test` mode installs `@dereekb/*` from (script line 169).
 */
export const CI_DIST_PATH = 'file:~/code/dist/packages';

/**
 * Maps a `@dereekb/<pkg>` name to its CI dist `file:` spec (script lines
 * 170-189). Sub-path packages (`dbx-form/mapbox`, `dbx-web/mapbox`) are keyed
 * separately because the script tracks them individually.
 *
 * @returns Each `@dereekb/*` package mapped to the local CI build it installs from.
 */
export function deriveCiDistVersionMap(): Readonly<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const pkg of DEREEKB_PACKAGES) {
    const subPath = pkg.replace('@dereekb/', '');
    map[pkg] = `${CI_DIST_PATH}/${subPath}`;
  }
  return map;
}

/**
 * Resolved setup versions: core pins, used by manifest + install phases.
 */
export interface ResolvedSetupVersions {
  readonly core: SetupCoreVersions;
  /**
   * Whether this run installs `@dereekb/*` from the CI dist folder instead of npm.
   */
  readonly isCiTest: boolean;
}

/**
 * Resolves the effective setup versions, layering optional overrides over the
 * script defaults.
 *
 * @param overrides - Partial core-version overrides and the ci-test flag.
 * @returns The resolved versions used by the manifest + install phases.
 */
export function resolveSetupVersions(overrides?: Maybe<{ readonly core?: Maybe<Partial<SetupCoreVersions>>; readonly isCiTest?: Maybe<boolean> }>): ResolvedSetupVersions {
  return {
    core: { ...DEFAULT_SETUP_CORE_VERSIONS, ...overrides?.core },
    isCiTest: overrides?.isCiTest ?? false
  };
}
