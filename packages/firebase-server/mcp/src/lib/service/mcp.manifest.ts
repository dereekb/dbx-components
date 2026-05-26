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
 * One persisted field on a {@link McpManifestModelEntry}.
 *
 * Structural mirror of `@dereekb/dbx-cli`'s `CliModelField` minus the
 * converter-text fields (CLI-only). The runtime keeps the payload narrow so the
 * built-in `model-info` / `model-decode` tools can answer catalog queries without
 * round-tripping back through the source packages.
 */
export interface McpManifestModelField {
  readonly name: string;
  readonly longName: string;
  readonly tsType?: string;
  readonly optional: boolean;
  readonly description?: string;
  readonly enumRef?: string;
  readonly syncFlag?: string;
  readonly nestedFields?: readonly McpManifestModelField[];
  readonly nestedIsArray?: boolean;
}

/**
 * One Firestore model entry in the pre-rendered MCP manifest JSON.
 *
 * Structural mirror of `@dereekb/dbx-cli`'s `CliModelManifestEntry`. Drives the
 * built-in `model-info` and `model-decode` MCP tools.
 */
export interface McpManifestModelEntry {
  readonly modelType: string;
  readonly modelName: string;
  readonly modelGroup?: string;
  readonly identityConst: string;
  readonly collectionPrefix: string;
  readonly parentIdentityConst?: string;
  readonly description?: string;
  readonly sourcePackage: string;
  readonly sourceFile: string;
  readonly fields: readonly McpManifestModelField[];
}

/**
 * Full MCP manifest JSON shape consumed at boot.
 *
 * The optional `models` array carries the Firestore model catalog used by the
 * built-in `model-info` / `model-decode` static tools. When absent (e.g., legacy
 * manifests rendered before model catalog support landed), the runtime skips
 * registering those tools instead of failing the boot.
 */
export interface McpManifest {
  readonly version: typeof MCP_MANIFEST_VERSION;
  readonly generatedAt: string;
  readonly tools: { readonly [key: string]: McpManifestToolEntry | undefined };
  readonly models?: readonly McpManifestModelEntry[];
}

/**
 * Builds the canonical MCP manifest key for a (modelType, callType, specifier) triple.
 *
 * Default-specifier entries collapse to `_`. Must stay in sync with the build-time
 * helper of the same name in `@dereekb/dbx-cli`.
 *
 * @param modelType - The Firestore model type segment of the key.
 * @param call - The call type segment of the key.
 * @param specifier - The specifier segment, or `_` / undefined for the default entry.
 * @returns The canonical `modelType.call.specifier` manifest key.
 */
export function mcpManifestKey(modelType: string, call: string, specifier?: Maybe<string>): string {
  const isDefault = specifier == null || specifier === '_';
  return isDefault ? `${modelType}.${call}._` : `${modelType}.${call}.${specifier}`;
}
