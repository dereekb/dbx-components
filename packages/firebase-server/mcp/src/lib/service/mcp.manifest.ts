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
  /**
   * Name of the MCP-mapped result interface (from `@dbxModelApiMcpResult`) when the output schema was
   * built from a mapped type. Used at boot to detect a `mapSuccessfulResult` handler whose `.api.ts`
   * leaf was never annotated (the output schema would then describe the raw, un-mapped result).
   */
  readonly mcpResultTypeName?: string;
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
  /**
   * Read posture declared by `@dbxModelRead <level>` on the model interface (`system` /
   * `owner` / `admin-only` / `permissions`). Absent when the source model omits the tag.
   */
  readonly read?: 'system' | 'owner' | 'admin-only' | 'permissions';
  /**
   * Resolved `@dbxModelServiceFactory`-tagged export that implements this model, joined onto
   * the model entry by `modelType`. Absent when no factory was found in the same scan.
   */
  readonly serviceFactory?: {
    readonly exportName: string;
    readonly sourceFile: string;
  };
}

/**
 * One auth claim entry in the pre-rendered MCP manifest JSON.
 *
 * Source paths and line numbers are deliberately stripped — the `whoami`
 * runtime tool only needs the claim key, the interface it belongs to, the
 * roles it grants, and the human-readable description.
 */
export interface McpManifestAuthClaim {
  readonly key: string;
  readonly description: string;
  readonly type: string;
  readonly app?: string;
  readonly interfaceName?: string;
  readonly source: 'system' | 'app';
  readonly mapping: {
    readonly roles: readonly string[];
    readonly inverse: boolean;
    readonly inverseMode?: 'any' | 'all';
    readonly claimValue?: string | number | boolean;
    readonly customEncodeDecode: boolean;
  };
  readonly tags: readonly string[];
}

/**
 * One auth app entry in the pre-rendered MCP manifest JSON.
 *
 * `auth.app` denotes the manifest's primary app (the host that emitted the
 * manifest). `auth.apps` carries the full list, which may include the primary
 * plus inherited apps (e.g. `storageFile-upload-user`).
 */
export interface McpManifestAuthApp {
  readonly app: string;
  readonly claimsInterfaceName: string;
  readonly serviceConstName: string;
  readonly claimKeys: readonly string[];
  readonly scopes: readonly string[];
  readonly description?: string;
}

/**
 * Auth section of the pre-rendered MCP manifest JSON. Drives the built-in
 * `whoami` static tool. Optional — runtimes that pre-date this section skip
 * registering whoami.
 */
export interface McpManifestAuth {
  readonly app?: McpManifestAuthApp;
  readonly apps: readonly McpManifestAuthApp[];
  readonly claims: readonly McpManifestAuthClaim[];
}

/**
 * Full MCP manifest JSON shape consumed at boot.
 *
 * The optional `models` array carries the Firestore model catalog used by the
 * built-in `model-info` / `model-decode` static tools. When absent (e.g., legacy
 * manifests rendered before model catalog support landed), the runtime skips
 * registering those tools instead of failing the boot.
 *
 * The optional `auth` section drives the built-in `whoami` static tool.
 */
export interface McpManifest {
  readonly version: typeof MCP_MANIFEST_VERSION;
  readonly generatedAt: string;
  readonly tools: { readonly [key: string]: McpManifestToolEntry | undefined };
  readonly models?: readonly McpManifestModelEntry[];
  readonly auth?: McpManifestAuth;
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
