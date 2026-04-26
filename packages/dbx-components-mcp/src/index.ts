/**
 * Public entry for @dereekb/dbx-components-mcp.
 *
 * Exposes the server factory and registry types so consumers can embed the
 * server or extend its registries. Most consumers will invoke the CLI instead.
 */

export * from './server.js';
export * from './registry/index.js';
export * from './manifest/core-topics.js';
export * from './manifest/semantic-types-schema.js';
export * from './manifest/loader.js';
export * from './config/config-schema.js';
export * from './config/load-config.js';
export * from './scan/scan-config-schema.js';
export * from './scan/extract.js';
export * from './scan/build-manifest.js';
export * from './scan/cli.js';
