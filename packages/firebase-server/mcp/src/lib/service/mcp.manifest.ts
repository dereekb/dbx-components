import { type Maybe } from '@dereekb/util';

/**
 * Version stamp embedded in the build-time MCP manifest JSON. Runtime loaders
 * refuse manifests whose `version` does not match this constant.
 *
 * Mirrors {@link MCP_MANIFEST_VERSION} in `@dereekb/dbx-cli` — both packages
 * version-bump together when the manifest shape changes.
 */
export const MCP_MANIFEST_VERSION = 1 as const;

/**
 * One tool entry inside the pre-rendered MCP manifest JSON.
 *
 * Structural mirror of `@dereekb/dbx-cli`'s `McpManifestToolEntry` so the
 * firebase-server/mcp runtime can consume the build output without taking a
 * runtime dependency on the build-time CLI package.
 */
export interface McpManifestToolEntry {
  readonly description?: string;
  readonly inputSchema?: object;
  readonly outputSchema?: object;
}

/**
 * Full MCP manifest JSON shape consumed at boot.
 */
export interface McpManifest {
  readonly version: typeof MCP_MANIFEST_VERSION;
  readonly generatedAt: string;
  readonly tools: { readonly [key: string]: McpManifestToolEntry | undefined };
}

/**
 * Builds the canonical MCP manifest key for a (modelType, callType, specifier) triple.
 *
 * Default-specifier entries collapse to `_`. Must stay in sync with the build-time
 * helper of the same name in `@dereekb/dbx-cli`.
 */
export function mcpManifestKey(modelType: string, call: string, specifier?: Maybe<string>): string {
  const isDefault = specifier == null || specifier === '_';
  return isDefault ? `${modelType}.${call}._` : `${modelType}.${call}.${specifier}`;
}
