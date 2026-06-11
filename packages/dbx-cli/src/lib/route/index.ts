/**
 * UIRouter route-extraction core, shared by the dev MCP server
 * (`@dereekb/dbx-components-mcp`'s `dbx_route_*` tools) and the build-time
 * `dbx-cli-generate-route-manifest` binary.
 *
 * The fs/glob I/O layer lives in each caller — this core operates on in-memory
 * {@link RouteSource} records and produces a normalized {@link RouteTree}, plus
 * a pure URL matcher and component-source resolver.
 */

export * from './route-types.js';
export * from './route-extract.js';
export * from './route-build-tree.js';
export * from './route-resolve-sources.js';
export * from './route-load-tree.js';
export * from './url-match.js';
export * from './component-resolve.js';
export * from './route-models-extract.js';
export * from './route-manifest.js';
