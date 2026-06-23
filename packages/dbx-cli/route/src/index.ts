/**
 * Focused `@dereekb/dbx-cli/route` namespace: re-exports just the route-manifest
 * public API (builder, tag parser, version, and the diagnostic / model types) so
 * a downstream can unit-test its `@dbxRouteModel*` tags without pulling the full
 * `@dereekb/dbx-cli` CLI surface (ts-morph scanners, mcp-scan, validators, …).
 *
 * `external: 'all'` keeps this a thin re-export shim — the root module graph is
 * still loaded at runtime; the win is import-surface ergonomics, not weight.
 */

export { buildRouteManifest, parseRouteModelTag, ROUTE_MANIFEST_VERSION } from '@dereekb/dbx-cli';
export type { ParsedRouteModel, RouteModelKind, RouteManifest, RouteManifestStateEntry, RouteManifestModelEntry, RouteManifestWarning, RouteManifestWarningKind, RouteManifestSeverity, RouteSource } from '@dereekb/dbx-cli';
