import { type Maybe } from '@dereekb/util';
import { type ModelManifestEntry } from './model.manifest';
import { type ModelManifestEnums } from './model.manifest.enum';

/**
 * Version stamp embedded in the build-time MCP manifest JSON. Runtime loaders refuse manifests
 * whose `version` does not match this constant.
 */
export const MCP_MANIFEST_VERSION = 1 as const;

/**
 * One tool entry inside the build-time MCP manifest JSON.
 *
 * The renderer pre-merges descriptions, enriches the input schema with per-field `description`
 * text, and synthesizes an `outputSchema` from `resultFields[]` so the runtime only has to do map
 * lookups.
 */
export interface McpManifestToolEntry {
  /**
   * Merged tool description: `entry.description` joined with `entry.paramsTypeDescription`.
   * Omitted when both source fields are absent.
   */
  readonly description?: string;
  /**
   * JSON Schema produced from the params validator and enriched with `paramsFields[]` descriptions.
   * Omitted when neither validator nor fields produced a schema.
   */
  readonly inputSchema?: object;
  /**
   * JSON Schema synthesized from `resultFields[]` / `resultTypeDescription`. Omitted when both absent.
   */
  readonly outputSchema?: object;
  /**
   * Name of the MCP-mapped result interface (from `@dbxModelApiMcpResult`) when the output schema was
   * built from a mapped type. Used at boot to detect a `mapSuccessfulResult` handler whose `.api.ts`
   * leaf was never annotated (the output schema would then describe the raw, un-mapped result).
   */
  readonly mcpResultTypeName?: string;
}

/**
 * One auth claim entry in the pre-rendered MCP manifest JSON.
 *
 * Source paths and line numbers are deliberately stripped — the `whoami` runtime tool only needs
 * the claim key, the interface it belongs to, the roles it grants, and the human-readable
 * description.
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
 * `auth.app` denotes the manifest's primary app (the host that emitted the manifest). `auth.apps`
 * carries the full list, which may include the primary plus inherited apps
 * (e.g. `storageFile-upload-user`).
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
 * Auth section of the pre-rendered MCP manifest JSON. Drives the built-in `whoami` static tool.
 * Optional — runtimes built before this section landed simply skip registering whoami.
 */
export interface McpManifestAuth {
  readonly app?: McpManifestAuthApp;
  readonly apps: readonly McpManifestAuthApp[];
  readonly claims: readonly McpManifestAuthClaim[];
}

/**
 * Build-time MCP manifest JSON shape (`mcp.manifest.json`) consumed by the runtime MCP module's
 * manifest loader.
 *
 * - `tools` is keyed by {@link mcpManifestKey} so the runtime can do O(1) lookups per registered tool.
 * - `models` is optional — it carries the Firestore model catalog behind the built-in `model-info` /
 *   `model-decode` / `model-get` tools and the compact `<prefix>_api_info` tool; the runtime skips
 *   them when absent.
 * - `enums` is optional — keyed by enum name, it carries the value→label tables `model-info` inlines
 *   and `enum-info` serves. Scoped to enums referenced by some model field's `enumRef`.
 * - `auth` is optional — drives the runtime `whoami` tool.
 */
export interface McpManifest {
  readonly version: typeof MCP_MANIFEST_VERSION;
  /**
   * ISO-8601 timestamp captured when the manifest was rendered. Useful for diagnostics.
   */
  readonly generatedAt: string;
  readonly tools: { readonly [key: string]: McpManifestToolEntry | undefined };
  readonly models?: readonly ModelManifestEntry[];
  readonly enums?: ModelManifestEnums;
  readonly auth?: McpManifestAuth;
}

/**
 * Builds the canonical MCP manifest key for a (modelType, callType, specifier) triple.
 *
 * The default-specifier entry collapses to `_` so the runtime can compose the same key from its
 * dispatch coordinates without first checking whether the handler is behind a specifier router.
 *
 * @param modelType - The Firestore model type (e.g., `guestbook`).
 * @param call - The call type / verb (e.g., `query`).
 * @param specifier - The specifier key, or `_` / undefined for the default entry.
 * @returns The canonical `modelType.call.specifier` lookup key, with the default specifier normalized to `_`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function mcpManifestKey(modelType: string, call: string, specifier?: Maybe<string>): string {
  const isDefault = specifier == null || specifier === '_';
  return isDefault ? `${modelType}.${call}._` : `${modelType}.${call}.${specifier}`;
}
