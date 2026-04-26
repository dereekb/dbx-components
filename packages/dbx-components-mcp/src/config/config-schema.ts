/**
 * Arktype schema for `dbx-mcp.config.json`.
 *
 * The config file lives at the workspace root and tells the MCP which
 * additional manifest sources (downstream-app semantic-types manifests,
 * future util/rxjs/date manifests) to merge alongside the bundled
 * `@dereekb/*` registries. The bundled registries are *always* loaded;
 * the config only adds extras.
 *
 * The shape is intentionally narrow in v1: a `version` discriminator and
 * an optional `semanticTypes.sources` array of repo-relative paths.
 * Domains added in later steps will extend this schema with sibling keys
 * (`util`, `rxjs`, etc.) and bump the version when their absence becomes
 * meaningful.
 */

import { type } from 'arktype';

/**
 * Top-level config schema. Missing-but-optional `semanticTypes` means the
 * MCP runs with only its bundled `@dereekb/*` manifests, which is the
 * intended default for fresh installs.
 */
export const DbxMcpConfig = type({
  version: '1',
  'semanticTypes?': {
    'sources?': 'string[]'
  }
});

/**
 * Static type inferred from {@link DbxMcpConfig}.
 */
export type DbxMcpConfig = typeof DbxMcpConfig.infer;
