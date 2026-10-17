import { type ModelManifestCompositeKey, type ModelManifestCompositeKeyEncoding, type ModelManifestEntry, type ModelManifestEnum, type ModelManifestEnumValue, type ModelManifestField } from '@dereekb/firebase/manifest';

// The mcp.manifest.json wire format and the model catalog helpers live in `@dereekb/firebase/manifest`,
// shared with the `@dereekb/dbx-cli` generators that write the manifest.
export { MCP_MANIFEST_VERSION, mcpManifestKey, findCompositeKeyModelsDerivedFrom, isCompositeKeyModelDerivedFrom } from '@dereekb/firebase/manifest';
export type { McpManifest, McpManifestAuth, McpManifestAuthApp, McpManifestAuthClaim, McpManifestToolEntry } from '@dereekb/firebase/manifest';

/**
 * One persisted field on a {@link McpManifestModelEntry}. Alias of the shared
 * `@dereekb/firebase/manifest` {@link ModelManifestField}.
 */
export type McpManifestModelField = ModelManifestField;

/**
 * One Firestore model entry in the pre-rendered MCP manifest JSON. Alias of the shared
 * {@link ModelManifestEntry}. Drives the built-in `model-info` / `model-decode` / `model-get` tools
 * and the compact `<prefix>_api_info` tool.
 */
export type McpManifestModelEntry = ModelManifestEntry;

/**
 * Flat-key encoding declared by a `@dbxModelCompositeKey` tag. Alias of the shared
 * {@link ModelManifestCompositeKeyEncoding}.
 */
export type McpManifestModelCompositeKeyEncoding = ModelManifestCompositeKeyEncoding;

/**
 * Composite-key declaration carried on a {@link McpManifestModelEntry}. Alias of the shared
 * {@link ModelManifestCompositeKey}.
 */
export type McpManifestModelCompositeKey = ModelManifestCompositeKey;

/**
 * One enum value with its persisted literal and the leading JSDoc paragraph. Alias of the shared
 * {@link ModelManifestEnumValue}.
 */
export type McpManifestEnumValue = ModelManifestEnumValue;

/**
 * One TypeScript enum referenced by some model field's `enumRef`. Alias of the shared
 * {@link ModelManifestEnum}.
 */
export type McpManifestEnum = ModelManifestEnum;
