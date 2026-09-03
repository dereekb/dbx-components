/**
 * Version + dependency constant table, ported from the `DEP__*`,
 * `*_VERSION`, and `DBX_COMPONENTS_VERSION*` variables of `setup-project.sh`.
 *
 * These pin the toolchain (nx / angular / typescript / node / firebase-tools)
 * and every npm dependency the `install` phases add. The defaults started as the
 * script's and now track the current dbx-components release, whose `@dereekb/*`
 * peer ranges they have to satisfy; `resolveSetupVersions` lets the orchestration
 * layer override any of them via environment / flags.
 */

import { type Maybe } from '@dereekb/util';

/**
 * Toolchain + dbx-components version pins (script lines 51-56).
 */
export interface SetupCoreVersions {
  readonly dbxComponents: string;
  readonly nx: string;
  /**
   * The Angular framework line. Exact rather than a range, because the `@dereekb/*` Angular peers
   * are themselves exact (`"@angular/core": "22.1.4"`) and Angular requires every framework package
   * to sit on the same version — a `^22.0.0` here lets packages installed at different points in
   * the pipeline land on different patches.
   */
  readonly angular: string;
  readonly typescript: string;
  readonly firebaseTools: string;
  readonly node: string;
  /**
   * The `esbuild` pin installed alongside `@nx/esbuild` for the API app's `build-base` target.
   * `@nx/esbuild` declares it only as an optional peer, so npm does not install it on its own.
   */
  readonly esbuild: string;
}

/**
 * Default core versions, pinned to the toolchain the {@link DEFAULT_SETUP_CORE_VERSIONS}.`dbxComponents`
 * release is built against.
 */
export const DEFAULT_SETUP_CORE_VERSIONS: SetupCoreVersions = {
  dbxComponents: '13.43.0',
  // 23.0.0 cannot create the workspace at all: its `angular-monorepo` preset dies inside the forked
  // `@nx/workspace:preset` generator with `Cannot convert undefined or null to object`.
  nx: '23.1.3',
  angular: '22.1.4',
  typescript: '^6.0.3',
  firebaseTools: '15.11.0',
  node: '24',
  esbuild: '0.27.3'
};

/**
 * Package version pins for the `install` phases (script lines 62-98). Keyed by
 * npm package name so the install commands can be assembled deterministically.
 */
export const SETUP_DEPENDENCY_VERSIONS: Readonly<Record<string, string>> = {
  sharp: '^0.34.5',
  // The NestJS runtime for the api app. Installed explicitly because the app is generated with
  // `@nx/node:app` rather than `@nx/node`'s `@nx/nest` wrapper, whose `ensureDependencies` used to
  // add these. Pinned to the `@dereekb/firebase-server` peer range (`@nx/nest` used `^11.0.0`) — a
  // lower major here is not merely stale, it is an unresolvable peer conflict.
  '@nestjs/common': '^12.0.1',
  '@nestjs/core': '^12.0.1',
  '@nestjs/platform-express': '^12.0.1',
  'reflect-metadata': '^0.2.0',
  tslib: '^2.3.0',
  firebase: '^12.0.0',
  'firebase-admin': '^13.0.0',
  'firebase-functions': '^7.0.0',
  'firebase-functions-test': '3.4.1',
  prettier: '3.8.1',
  'conventional-changelog': '^7.2.0',
  'conventional-recommended-bump': '^11.2.0',
  semver: '^7.7.4',
  yargs: '^18.0.0',
  'pretty-quick': '^4.2.2',
  'eslint-plugin-import-x': '^4.16.2',
  'eslint-plugin-unused-imports': '4.4.1',
  'eslint-config-prettier': '10.1.8',
  'eslint-plugin-jsdoc': '^62.9.0',
  'eslint-plugin-sonarjs': '^4.0.3',
  'eslint-plugin-unicorn': '^64.0.0',
  'mailgun.js': '^14.0.0',
  rxjs: '^7.8.0',
  arktype: '^2.2.0',
  'mapbox-gl': '^3.10.0',
  'ngx-mapbox-gl': 'git+https://git@github.com/dereekb/ngx-mapbox-gl#3f1d25b0661bc48abbd415dc79ca7f66568bae2e',
  '@ng-web-apis/geolocation': '^5.1.0',
  '@ng-web-apis/common': '^5.1.0',
  '@zip.js/zip.js': '^2.8.11',
  '@placemarkio/geo-viewport': '^1.0.2',
  '@uirouter/rx': '^1.0.0',
  '@uirouter/core': '^6.1.2',
  '@uirouter/angular': '22.0.0',
  '@ngbracket/ngx-layout': '^22.0.1',
  '@ngrx/store-devtools': '^22.0.0',
  '@firebase/rules-unit-testing': '5.0.0',
  'angular-calendar': '^0.32.1',
  '@types/segment-analytics': '^0.0.38',
  '@analogjs/vite-plugin-angular': '~2.7.1',
  '@ng-forge/dynamic-forms': '1.2.0-next.8'
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
 * The extra `npm install` flags a `--ci-test` run needs.
 *
 * `--ci-test` resolves every `@dereekb/*` dependency to a `file:` path pointing at a built package
 * directory, which npm installs as a symlink. npm does not read the peerDependencies of a symlinked
 * local package, and every `@dereekb/*` package declares its whole runtime surface as peers with no
 * `dependencies` of its own — so without this the scaffolded project ends up missing `date-fns`,
 * `extra-set`, `@angular/material`, `@ngrx/*` and the rest, and fails to build on unresolved
 * imports. `--install-links` makes npm copy those directories in as ordinary packages instead, so
 * their peers resolve and auto-install like any registry dependency.
 *
 * @param versions - The resolved setup versions.
 * @returns `['--install-links']` for a ci-test run, otherwise an empty list.
 */
export function ciTestInstallFlags(versions: ResolvedSetupVersions): readonly string[] {
  return versions.isCiTest ? ['--install-links'] : [];
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
