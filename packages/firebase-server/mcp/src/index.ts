/**
 * Public entry for `@dereekb/firebase-server/mcp`.
 *
 * Packaging note: the published `exports["./mcp"]` maps the `import` condition to
 * the real ESM build (`./mcp/index.esm.js`), NOT the `.cjs.mjs` CJS re-export
 * shim, so a downstream `import { matchRouteManifestUrl, ROUTE_MANIFEST_VERSION }
 * from '@dereekb/firebase-server/mcp'` exposes statically-analyzable named
 * exports under vitest. The shim (`export * from './index.cjs.js'`) resolved to
 * `undefined` for this subpath under vitest's externalized SSR resolution, while
 * plain Node and the root `@dereekb/firebase-server` entry were unaffected.
 * `require` / the `default` condition still resolves to the CJS build for CJS
 * consumers (the NestJS server runtime).
 *
 * Fallback: if a downstream still sees undefined named imports (e.g. consuming a
 * build that predates this fix), inline the package in its vitest config so Vite
 * transforms it through the `module` (ESM) condition:
 * `test: { server: { deps: { inline: [/@dereekb\/firebase-server/] } } }`.
 */
export * from './lib';
