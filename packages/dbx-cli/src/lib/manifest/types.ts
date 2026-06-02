import type { Maybe } from '@dereekb/util';
import { type Type } from 'arktype';

/**
 * One persisted field on a {@link CliModelManifestEntry}.
 *
 * Captures both the persisted (Firestore) short key and the human-readable
 * long name from the model's `@dbxModelVariable` JSDoc tag, plus the verbatim
 * converter expression text and any nested converter shape (for
 * `firestoreObjectArray` / `firestoreSubObject` fields) so downstream tooling
 * can recursively rewrite payload keys.
 */
export interface CliModelField {
  /**
   * Persisted Firestore short key (e.g. `fn`, `cat`, `gc`).
   */
  readonly name: string;
  /**
   * Human-readable long name resolved from the interface property's
   * `@dbxModelVariable` JSDoc tag. Falls back to `name` when no tag is
   * declared and the persisted key is already long-form.
   */
  readonly longName: string;
  /**
   * Verbatim converter expression text from the converter's `fields` literal
   * (e.g. `firestoreDate()`, `firestoreObjectArray({ objectField: foo })`).
   *
   * Opt-in. Only emitted when the manifest is generated with
   * `--emit-model-converters`; downstream tooling (e.g. the dbx-components MCP)
   * uses this text, while the CLI itself does not need it.
   */
  readonly converter?: string;
  /**
   * TypeScript type text from the interface property declaration, when the
   * field's interface property could be located (e.g. `Date`, `Maybe<NotificationUserState>`).
   */
  readonly tsType?: string;
  /**
   * `true` when the interface property is optional (`?`) or typed as `Maybe<>`,
   * or when the converter is an `optionalFirestore...()` factory.
   */
  readonly optional: boolean;
  /**
   * First paragraph of the interface property's JSDoc, when present.
   */
  readonly description?: string;
  /**
   * Enum name referenced by either the interface property's TS type or the
   * converter's `firestoreEnum<Enum>()` generic argument, when an enum is
   * present in the same source file.
   */
  readonly enumRef?: string;
  /**
   * Free-text description from the interface property's
   * `@dbxModelVariableSyncFlag` JSDoc tag, when present.
   */
  readonly syncFlag?: string;
  /**
   * Recursively-resolved nested fields when this field's converter is a
   * `firestoreObjectArray({ objectField: ... })` or
   * `firestoreSubObject({ objectField: ... })` call whose inner converter
   * could be resolved (either inline or via cross-file converter const).
   *
   * Absent when the converter is opaque (custom helper, dynamic expression,
   * `firestoreEnum`, primitive factory, etc.).
   */
  readonly nestedFields?: readonly CliModelField[];
  /**
   * `true` when the nested fields describe an array element shape
   * (`firestoreObjectArray`); `false` for sub-object fields. Only meaningful
   * when {@link nestedFields} is set.
   */
  readonly nestedIsArray?: boolean;
}

/**
 * One Firestore model entry in a downstream CLI's `<NAMESPACE>_MODEL_MANIFEST`.
 *
 * Generated at build time by `dbx-cli-generate-firebase-api-manifest` from the
 * same source packages it walks for the API manifest. Drives both the
 * `model-info` command's catalog/per-model help and the `--expand-keys` flag's
 * payload-rewrite behaviour.
 */
export interface CliModelManifestEntry {
  /**
   * Persisted model type id (e.g. `notificationBox`, `profile`).
   */
  readonly modelType: string;
  /**
   * Pascal-case model name as declared by the source interface (e.g.
   * `NotificationBox`).
   */
  readonly modelName: string;
  /**
   * Group name from the source `@dbxModelGroup` tag on the
   * `<X>FirestoreCollections` container (e.g. `Notification`, `Profile`).
   */
  readonly modelGroup?: string;
  /**
   * Identity const name from the source file (e.g. `notificationBoxIdentity`).
   */
  readonly identityConst: string;
  /**
   * Collection-name prefix used by the identity (e.g. `nb`, `p`).
   */
  readonly collectionPrefix: string;
  /**
   * Parent identity const name when the model is a subcollection.
   */
  readonly parentIdentityConst?: string;
  /**
   * First paragraph of the source interface's JSDoc, when present.
   */
  readonly description?: string;
  /**
   * Source package providing the model (e.g. `@dereekb/firebase`,
   * `demo-firebase`).
   */
  readonly sourcePackage: string;
  /**
   * Workspace-relative path of the source `.ts` file that declares the model.
   */
  readonly sourceFile: string;
  /**
   * Persisted-field metadata in source order.
   */
  readonly fields: readonly CliModelField[];
  /**
   * Read posture declared by `@dbxModelRead <level>` on the model interface. Closed enum:
   * `system` / `owner` / `admin-only` / `permissions`. Absent when the model interface omits the tag.
   */
  readonly read?: 'system' | 'owner' | 'admin-only' | 'permissions';
  /**
   * Resolved `@dbxModelServiceFactory <modelType>`-tagged export that implements this model.
   * Joined by `modelType` during model-manifest assembly. Absent when no factory was found
   * (surfaced as an orphan by the cross-file ESLint rule).
   */
  readonly serviceFactory?: {
    readonly exportName: string;
    readonly sourceFile: string;
  };
}

/**
 * Generated array of {@link CliModelManifestEntry} consumed by `model-info`
 * and the `--expand-keys` rewrite. Each downstream CLI app exports its own
 * `<NAMESPACE>_MODEL_MANIFEST` of this type.
 */
export type CliModelManifest = readonly CliModelManifestEntry[];

export type CliApiVerb = 'create' | 'read' | 'update' | 'delete' | 'query' | 'invoke' | 'standalone';

export interface CliApiManifestField {
  readonly name: string;
  readonly typeText: string;
  readonly description?: string;
}

export interface CliApiManifestEntry {
  readonly model: string;
  readonly verb: CliApiVerb;
  readonly specifier?: string;
  readonly paramsTypeName?: string;
  readonly paramsValidator?: Type<unknown>;
  readonly resultTypeName?: string;
  readonly groupName: string;
  readonly sourceFile: string;
  /**
   * Per-action description, rendered as the command's `describe` in `--help`.
   */
  readonly description?: string;
  /**
   * Description from the params interface's own JSDoc (e.g. on `ResetProfilePasswordParams`).
   * Rendered in the `--help` epilogue under the params section.
   */
  readonly paramsTypeDescription?: string;
  /**
   * Per-field params descriptions read from the params interface's property JSDocs.
   */
  readonly paramsFields?: readonly CliApiManifestField[];
  /**
   * Description from the result interface's own JSDoc (e.g. on `DownloadProfileArchiveResult`).
   * Surfaces the same way `paramsTypeDescription` does, but for the response side.
   */
  readonly resultTypeDescription?: string;
  /**
   * Per-field result descriptions read from the result interface's property JSDocs.
   */
  readonly resultFields?: readonly CliApiManifestField[];
  /**
   * Name of the MCP-mapped result interface declared via the `@dbxModelApiMcpResult <TypeName>`
   * JSDoc tag on the CRUD leaf. Present only when a handler remaps its success result for MCP.
   */
  readonly mcpResultTypeName?: string;
  /**
   * Description from the MCP-mapped result interface's own JSDoc. The MCP manifest renderer prefers
   * this over {@link resultTypeDescription} when building the tool output schema.
   */
  readonly mcpResultTypeDescription?: string;
  /**
   * Per-field descriptions read from the MCP-mapped result interface's property JSDocs. The MCP
   * manifest renderer prefers these over {@link resultFields} when building the tool output schema.
   */
  readonly mcpResultFields?: readonly CliApiManifestField[];
}

export type CliApiManifest = readonly CliApiManifestEntry[];

// MARK: MCP Manifest
/**
 * Version stamp embedded in the build-time MCP manifest JSON. Runtime loaders
 * refuse manifests whose `version` does not match this constant.
 */
export const MCP_MANIFEST_VERSION = 1 as const;

/**
 * One tool entry inside the build-time MCP manifest JSON.
 *
 * The renderer pre-merges descriptions, enriches the input schema with per-field
 * `description` text, and synthesizes an `outputSchema` from `resultFields[]` so the
 * runtime only has to do map lookups.
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
   * built from a mapped type. Present iff the source leaf was annotated — the runtime tool generator
   * uses it to detect handlers whose `mapSuccessfulResult` lacks the matching `.api.ts` annotation.
   */
  readonly mcpResultTypeName?: string;
}

/**
 * One persisted field on a {@link McpManifestModelEntry}.
 *
 * Structural projection of {@link CliModelField} minus the converter expression
 * text (CLI-only). Keeps the runtime payload narrow for downstream MCP tools.
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
 * One Firestore model entry in the build-time MCP manifest JSON.
 *
 * Structural projection of {@link CliModelManifestEntry} consumed at runtime by
 * the firebase-server/mcp built-in `model-info` and `model-decode` tools.
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
 * One auth claim entry in the pre-rendered MCP manifest JSON. Powers the
 * runtime `whoami` tool. Source paths and line numbers are stripped — only
 * the catalog-facing fields survive.
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
 * Auth section of the pre-rendered MCP manifest JSON. Optional — runtimes
 * built before this section landed simply skip registering whoami.
 */
export interface McpManifestAuth {
  readonly app?: McpManifestAuthApp;
  readonly apps: readonly McpManifestAuthApp[];
  readonly claims: readonly McpManifestAuthClaim[];
}

/**
 * Build-time MCP manifest JSON shape consumed by the runtime MCP module's optional manifest loader.
 *
 * `tools` is keyed by {@link mcpManifestKey} so the runtime can do O(1) lookups per registered tool.
 * `models` is optional — the runtime skips the catalog-introspection tools when missing.
 * `auth` is optional — drives the runtime `whoami` tool.
 */
export interface McpManifest {
  readonly version: typeof MCP_MANIFEST_VERSION;
  /**
   * ISO-8601 timestamp captured when the manifest was rendered. Useful for diagnostics.
   */
  readonly generatedAt: string;
  readonly tools: { readonly [key: string]: McpManifestToolEntry | undefined };
  readonly models?: readonly McpManifestModelEntry[];
  readonly auth?: McpManifestAuth;
}

/**
 * Builds the canonical MCP manifest key for a (modelType, callType, specifier) triple.
 *
 * The default-specifier entry collapses to `_` so the runtime can compose the same
 * key from its dispatch coordinates without first checking whether the handler is
 * behind a specifier router.
 *
 * @param modelType - The Firestore model type (e.g., `guestbook`).
 * @param call - The call type / verb (e.g., `query`).
 * @param specifier - The specifier key, or `_` / undefined for the default entry.
 * @returns The canonical `modelType.call.specifier` lookup key, with the default specifier normalized to `_`.
 */
export function mcpManifestKey(modelType: string, call: string, specifier?: Maybe<string>): string {
  const isDefault = specifier == null || specifier === '_';
  return isDefault ? `${modelType}.${call}._` : `${modelType}.${call}.${specifier}`;
}
