/**
 * Umbrella barrel for the dbx-components MCP scan infrastructure.
 *
 * Three subdirs:
 *  - `registry/`  — typed metadata catalogs (`FIREBASE_MODELS`, archetypes,
 *    auth, semantic types, etc.) used by runtime MCP tools and build-time CLIs.
 *  - `scan/`      — ts-morph-backed source extractors and `generate-mcp-manifest`
 *    cluster CLIs that walk workspace source to build the catalog JSON files.
 *  - `manifest/`  — arktype-validated schemas + loader helpers that hydrate the
 *    runtime registries from those JSON files.
 */

export * from './config/config-schema.js';
export * from './config/load-config.js';

export * from './registry/index.js';
export * from './scan/index.js';

export * from './manifest/index.js';
