import type { FirestoreQueryConstraint } from '@dereekb/firebase';
import type { Maybe } from '@dereekb/util';
import { type Type } from 'arktype';
import type { ModelManifest, ModelManifestCompositeKey, ModelManifestCompositeKeyEncoding, ModelManifestEntry, ModelManifestEnum, ModelManifestEnums, ModelManifestEnumValue, ModelManifestField } from '@dereekb/firebase/manifest';

/**
 * One persisted field on a {@link CliModelManifestEntry}. Alias of the shared
 * `@dereekb/firebase/manifest` {@link ModelManifestField}.
 */
export type CliModelField = ModelManifestField;

/**
 * One Firestore model entry in a downstream CLI's `<NAMESPACE>_MODEL_MANIFEST`. Alias of the
 * shared `@dereekb/firebase/manifest` {@link ModelManifestEntry}.
 *
 * Generated at build time by `dbx-cli-generate-firebase-api-manifest` from the same source
 * packages it walks for the API manifest. Drives the `model-info` / `model-decode` / `info`
 * commands and the `--expand-keys` flag's payload-rewrite behaviour.
 */
export type CliModelManifestEntry = ModelManifestEntry;

/**
 * Flat-key encoding declared by a `@dbxModelCompositeKey` tag. Alias of the shared
 * {@link ModelManifestCompositeKeyEncoding}.
 */
export type CliModelCompositeKeyEncoding = ModelManifestCompositeKeyEncoding;

/**
 * Composite-key declaration carried on a {@link CliModelManifestEntry}. Alias of the shared
 * {@link ModelManifestCompositeKey}.
 */
export type CliModelCompositeKey = ModelManifestCompositeKey;

/**
 * Generated array of {@link CliModelManifestEntry} consumed by `model-info` and the
 * `--expand-keys` rewrite. Each downstream CLI app exports its own `<NAMESPACE>_MODEL_MANIFEST`
 * of this type.
 */
export type CliModelManifest = ModelManifest;

/**
 * One enum value with its persisted literal and the leading JSDoc paragraph. Alias of the shared
 * {@link ModelManifestEnumValue}.
 */
export type CliModelEnumValue = ModelManifestEnumValue;

/**
 * One TypeScript enum referenced by some model field's `enumRef`. Alias of the shared
 * {@link ModelManifestEnum}.
 */
export type CliModelEnum = ModelManifestEnum;

/**
 * Generated map of {@link CliModelEnum} keyed by enum name, scoped to enums referenced by some
 * emitted model field's `enumRef`. Each downstream CLI app exports its own
 * `<NAMESPACE>_ENUM_MANIFEST` of this type. Alias of the shared {@link ModelManifestEnums}.
 */
export type CliEnumManifest = ModelManifestEnums;

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
// The mcp.manifest.json wire format lives in `@dereekb/firebase/manifest`, shared with the
// firebase-server/mcp runtime that consumes it.
export { MCP_MANIFEST_VERSION, mcpManifestKey } from '@dereekb/firebase/manifest';
export type { McpManifest, McpManifestAuth, McpManifestAuthApp, McpManifestAuthClaim, McpManifestToolEntry } from '@dereekb/firebase/manifest';

/**
 * One persisted field on a {@link McpManifestModelEntry}. Alias of the shared {@link ModelManifestField}.
 */
export type McpManifestModelField = ModelManifestField;

/**
 * One Firestore model entry in the build-time MCP manifest JSON. Alias of the shared {@link ModelManifestEntry}.
 */
export type McpManifestModelEntry = ModelManifestEntry;

/**
 * Default specifier key used when a handler is not behind a specifier router.
 *
 * Mirrors `DEFAULT_SPECIFIER_KEY` in `@dereekb/firebase-server/mcp` — kept in sync so the
 * build-time renderer composes the same tool names as the runtime generator.
 */
export const DEFAULT_SPECIFIER_KEY = '_';

/**
 * Soft limit for an MCP tool name. Mirrors `MCP_TOOL_NAME_WARN_LENGTH` in
 * `@dereekb/firebase-server/mcp`. Names over this are flagged at manifest-generation time.
 */
export const MCP_TOOL_NAME_WARN_LENGTH = 55;

/**
 * Hard limit for an MCP tool name. Mirrors `MCP_TOOL_NAME_MAX_LENGTH` in
 * `@dereekb/firebase-server/mcp`. Remote MCP clients reject a `tools/list` payload containing any
 * tool whose `name` exceeds this, so manifest generation fails when a name is over the cap.
 */
export const MCP_TOOL_NAME_MAX_LENGTH = 64;

/**
 * Severity of a tool name's length relative to the soft / hard limits.
 */
export type McpToolNameLengthLevel = 'ok' | 'warn' | 'error';

/**
 * The outcome of validating a tool name's length.
 */
export interface McpToolNameValidation {
  readonly name: string;
  readonly length: number;
  readonly level: McpToolNameLengthLevel;
}

/**
 * Builds the MCP tool name for a (modelSegment, callType, specifier) triple.
 *
 * Mirrors `buildMcpToolName` in `@dereekb/firebase-server/mcp` so the build-time manifest validation
 * sees the same names the runtime advertises. The call-type segment is only emitted for the default
 * (`_`) specifier; named specifiers drop it (`worker-syncCheckHqEmployee`).
 *
 * @param modelSegment - The model segment of the name (model type, or a per-model override).
 * @param callType - The call type / verb.
 * @param specifier - The specifier key, or `_` / undefined for the default entry.
 * @returns The hyphen-joined tool name.
 *
 * @example
 * ```ts
 * buildMcpToolName('worker', 'update', 'syncCheckHqEmployee'); // 'worker-syncCheckHqEmployee'
 * ```
 */
export function buildMcpToolName(modelSegment: string, callType: string, specifier?: Maybe<string>): string {
  const isDefault = specifier == null || specifier === DEFAULT_SPECIFIER_KEY;
  return isDefault ? `${modelSegment}-${callType}` : `${modelSegment}-${specifier}`;
}

/**
 * Classifies a tool name's length against the soft/hard MCP name-length limits.
 *
 * Mirrors `validateMcpToolName` in `@dereekb/firebase-server/mcp`.
 *
 * @param name - The fully-resolved tool name.
 * @returns The length classification — `error` over {@link MCP_TOOL_NAME_MAX_LENGTH}, `warn` over
 *   {@link MCP_TOOL_NAME_WARN_LENGTH}, otherwise `ok`.
 *
 * @example
 * ```ts
 * validateMcpToolName('worker-create').level; // 'ok'
 * ```
 */
export function validateMcpToolName(name: string): McpToolNameValidation {
  const length = name.length;
  let level: McpToolNameLengthLevel = 'ok';

  if (length > MCP_TOOL_NAME_MAX_LENGTH) {
    level = 'error';
  } else if (length > MCP_TOOL_NAME_WARN_LENGTH) {
    level = 'warn';
  }

  return { name, length, level };
}

/**
 * Single-character abbreviations for the standard CRUDQ + invoke call types.
 *
 * Mirrors `MCP_CALL_TYPE_ABBREVIATIONS` in `@dereekb/firebase-server/mcp` so the build-time renderer
 * disambiguates colliding names exactly like the runtime generator.
 */
export const MCP_CALL_TYPE_ABBREVIATIONS: Readonly<Record<string, string>> = {
  create: 'c',
  read: 'r',
  update: 'u',
  delete: 'd',
  query: 'q',
  invoke: 'i'
};

/**
 * Abbreviates a call type for a disambiguated tool name; a custom call type is returned unchanged.
 *
 * Mirrors `abbreviateMcpCallType` in `@dereekb/firebase-server/mcp`.
 *
 * @param callType - The call type / verb.
 * @returns The single-character abbreviation, or the original string for a custom call type.
 *
 * @example
 * ```ts
 * abbreviateMcpCallType('update'); // 'u'
 * ```
 */
export function abbreviateMcpCallType(callType: string): string {
  return MCP_CALL_TYPE_ABBREVIATIONS[callType] ?? callType;
}

/**
 * Builds the disambiguated MCP tool name — the form used only when {@link buildMcpToolName} collides
 * with another visible tool. Named specifiers re-insert the abbreviated call type
 * (`worker-u-syncCheckHqEmployee`); default (`_`) specifiers already carry the full call type and are
 * returned unchanged.
 *
 * Mirrors `buildDisambiguatedMcpToolName` in `@dereekb/firebase-server/mcp`.
 *
 * @param modelSegment - The model segment of the name (model type, or a per-model override).
 * @param callType - The call type / verb.
 * @param specifier - The specifier key, or `_` / undefined for the default entry.
 * @returns The hyphen-joined disambiguated tool name.
 *
 * @example
 * ```ts
 * buildDisambiguatedMcpToolName('worker', 'update', 'syncCheckHqEmployee'); // 'worker-u-syncCheckHqEmployee'
 * ```
 */
export function buildDisambiguatedMcpToolName(modelSegment: string, callType: string, specifier?: Maybe<string>): string {
  const isDefault = specifier == null || specifier === DEFAULT_SPECIFIER_KEY;
  return isDefault ? `${modelSegment}-${callType}` : `${modelSegment}-${abbreviateMcpCallType(callType)}-${specifier}`;
}

// MARK: Firestore query manifest
/**
 * Firestore query scope a catalog entry runs at, mirroring
 * `@dbxModelFirebaseIndexScope`.
 */
export type CliFirestoreQueryScope = 'COLLECTION' | 'COLLECTION_GROUP';

/**
 * One documented positional parameter of a query factory.
 *
 * `type` is the source type TEXT as written in the factory's signature, not a
 * runtime validator — the manifest is generated by reading the AST, and there
 * is deliberately no validator layer behind it.
 */
export interface CliFirestoreQueryParam {
  readonly name: string;
  /**
   * The parameter's source type text, e.g. `string`, `Maybe<Date>`,
   * `PublishedGuestbookEntriesQueryParams`.
   */
  readonly type: string;
  readonly description?: string;
  /**
   * True for `?` params AND params carrying an initializer — either way the
   * factory can be called without supplying one.
   */
  readonly optional: boolean;
}

/**
 * The callable shape a bound query factory exposes.
 *
 * Deliberately untyped in its arguments: the manifest binds factories with
 * every positional shape the workspace's `*.query.ts` files use (zero-arg,
 * single scalar, single params object, two positionals, ...).
 */
export type CliFirestoreQueryFactory = (...args: readonly any[]) => readonly FirestoreQueryConstraint[];

/**
 * How the rules resolve one read operation on a collection, mirroring
 * `FirestoreRulesAccess` from `@dereekb/dbx-cli/firestore-rules`.
 *
 * Restated here rather than imported: `firestore-rules` is an in-repo
 * source-only package that cannot resolve to a built `.d.ts` during this
 * package's declaration build, and the manifest is a SERIALIZED artifact — its
 * types have to stand alone.
 *
 * - `allowed` — some `allow` covering the op has a condition that is not constant-`false`.
 * - `denied` — the op is covered only by `allow`s whose condition is literally `false`.
 * - `unmatched` — no `allow` covers the op at all, so Firestore's default-deny applies.
 */
export type CliFirestoreQueryRulesAccess = 'allowed' | 'denied' | 'unmatched';

/**
 * How a catalog entry must be INVOKED, resolved from `firestore.rules` at generation time.
 *
 * This classifies on the axis a caller acts on — "how do I run this?" — rather than on the raw
 * rules verdict. The two are not the same question: a `COLLECTION`-scope entry over a
 * subcollection is fully permitted by the rules and still cannot be run without `--parent`, so a
 * pure permission verdict would call it runnable-as-declared and be wrong about how to run it.
 *
 * - `model` — run it directly against the model's collection or collection group.
 * - `parent-child` — it addresses ONE parent document's subcollection, so `--parent <parentKey>`
 *   is required. Either the entry is `COLLECTION`-scope over a subcollection, or its
 *   `COLLECTION_GROUP` shape has no `/{path=**}/<collection>/{id}` block behind it while the
 *   path-scoped read IS granted.
 * - `unavailable` — no client can run it, on any transport or scoping.
 * - `unknown` — the query manifest was generated without a `--rules` file, so nothing was
 *   resolved. Never stored; it is what {@link CliFirestoreQueryManifestEntry.queryMode} being
 *   absent means, so a consumer's switch over this union stays total.
 */
export type CliFirestoreQueryMode = 'model' | 'parent-child' | 'unavailable' | 'unknown';

/**
 * Why an entry resolved to the {@link CliFirestoreQueryMode} it did.
 *
 * `denied` and `unmatched` are kept apart the way the rules scanner keeps them apart: a
 * written-down `if false` is a deliberate no, an absence is an oversight, and a reviewer needs to
 * know which one they are looking at.
 */
export type CliFirestoreQueryModeReason =
  /**
   * `scope: 'COLLECTION_GROUP'` with no `/{path=**}/<collection>/{id}` block in the rules. A
   * collection-group query is evaluated against that block alone — a path-scoped block does not
   * authorize it, no matter how permissive. `parent-child` when the model is nested (the
   * path-scoped read is the way in), `unavailable` when it is a root collection with no parent to
   * scope to.
   */
  | 'no-collection-group-rule'
  /**
   * `scope: 'COLLECTION'` over a subcollection: the entry addresses one parent's subcollection by
   * construction, independent of what the rules say.
   */
  | 'nested-collection-scope'
  /**
   * Every `list` grant on the collection is a constant-`false`.
   */
  | 'list-denied'
  /**
   * No `list` grant covers the collection at all.
   */
  | 'list-unmatched';

/**
 * The `firestore.rules` evidence behind an entry's {@link CliFirestoreQueryMode} — the WHY, kept
 * beside the answer rather than inside it.
 *
 * Split from the mode deliberately: a caller (or an agent) needs only the mode to decide what to
 * do, while a reviewer auditing a surprising mode needs these facts to check the reasoning without
 * re-reading the rules file.
 *
 * Absent, like the mode, when the generator was not given a `--rules` file.
 */
export interface CliFirestoreQueryRules {
  /**
   * The rules' `list` posture for {@link CliFirestoreQueryManifestEntry.collection}, merged across
   * every match block that reaches it.
   */
  readonly list: CliFirestoreQueryRulesAccess;
  /**
   * True when the rules declare a `/{path=**}/<collection>/{id}` block — the only shape a
   * collection-group query is authorized by.
   */
  readonly collectionGroup: boolean;
  /**
   * Present whenever the mode is not `model`.
   */
  readonly reason?: CliFirestoreQueryModeReason;
  /**
   * The parent-document path templates a `--parent` key must match, read off the non-recursive
   * rules match paths that reach this collection (e.g. `jl/{jobLocation}/jlj/{job}`). Lets the CLI
   * name the required `--parent` shape instead of saying only "pass --parent".
   */
  readonly parentPaths?: readonly string[];
}

/**
 * One entry in the generated per-model Firestore query catalog.
 *
 * Produced by the `firestore-query-manifest` generator from the same
 * `@dbxModelFirebaseIndex`-tagged factories that drive `firestore.indexes.json`,
 * so the catalog and the emitted indexes can never disagree.
 */
export interface CliFirestoreQueryManifestEntry {
  /**
   * Kebab-case identifier used on the command line.
   */
  readonly slug: string;
  /**
   * The exported identifier of the factory.
   */
  readonly name: string;
  /**
   * The package the factory is exported from.
   */
  readonly module: string;
  /**
   * The factory's source file, relative to the source package.
   */
  readonly subpath: string;
  /**
   * PascalCase model name, from `@dbxModelFirebaseIndexModel`.
   */
  readonly model: string;
  /**
   * Short collection name — joins {@link CliModelManifestEntry.collectionPrefix}.
   */
  readonly collection: string;
  readonly isNested: boolean;
  readonly scope: CliFirestoreQueryScope;
  /**
   * The factory's full source signature, quoted back in argument errors.
   */
  readonly signature: string;
  readonly params: readonly CliFirestoreQueryParam[];
  readonly description?: string;
  readonly category?: string;
  readonly tags?: readonly string[];
  readonly example?: string;
  readonly relatedSlugs?: readonly string[];
  /**
   * Index-emission governance flags carried through from the extractor. None
   * of them affect callability — they govern what lands in
   * `firestore.indexes.json`.
   */
  readonly manual?: boolean;
  readonly skip?: boolean;
  readonly excluded?: boolean;
  /**
   * True for a factory that only delegates to others; invocable, but its own
   * constraint sequence is empty by design. See {@link relatedSlugs}.
   */
  readonly dispatcher?: boolean;
  /**
   * How this entry must be invoked, per `firestore.rules` — unlike the flags
   * above, this one DOES affect callability.
   *
   * Absent when the generator ran without a `--rules` file, which reads as
   * `unknown` rather than `model`: a guess here would be worse than no field.
   * Present, the CLI refuses an `unavailable` entry locally rather than paying
   * a round trip for the `permission-denied` the rules guarantee, and requires
   * `--parent` for a `parent-child` one.
   */
  readonly queryMode?: CliFirestoreQueryMode;
  /**
   * The rules evidence behind {@link queryMode}. Set and unset together with it.
   */
  readonly rules?: CliFirestoreQueryRules;
  /**
   * Absent when the identifier is not exported from {@link module}'s barrel
   * chain — the entry is listed but cannot be executed.
   */
  readonly factory?: CliFirestoreQueryFactory;
}

/**
 * The generated per-model Firestore query catalog.
 */
export type CliFirestoreQueryManifest = readonly CliFirestoreQueryManifestEntry[];

// MARK: Generated manifest stamp
/**
 * The generator provenance a generated manifest module carries alongside its catalog.
 *
 * Emitted as `<NAMESPACE>_STAMP` by the manifest generators and wired into `runCli` as
 * `manifestGeneratorVersion`. Exists because a generated manifest is the one build output that can go
 * stale WITHOUT breaking the build: it is committed TypeScript, so a manifest emitted by an older
 * generator still compiles and still type-checks against a newer runtime — it just quietly lacks the
 * fields that runtime reads. `queryMode` / `rules` were exactly that, and the resulting
 * `queryModesScanned: false` sat in `doctor` output unread while the direct-Firestore path was being
 * debugged from the wrong end.
 *
 * Version only, deliberately no timestamp: the generators skip a write when the bytes are unchanged
 * so incremental builds preserve mtimes, and a timestamp would rewrite the file — and its git
 * history — on every build.
 */
export interface CliGeneratedManifestStamp {
  /**
   * The `@dereekb/dbx-cli` version of the generator that emitted the module.
   */
  readonly generatorVersion: string;
}

// MARK: Notification Manifest
/**
 * One notification task type in a {@link CliNotificationManifest}.
 *
 * Structural copy of the `TaskSummary` the `@dereekb/dbx-cli/validate` extractor reports, emitted by
 * `generate-notification-manifest --cli-output`. Checkpoints only exist as TypeScript union types, so this is the only way the CLI can
 * know them.
 */
export interface CliNotificationManifestTask {
  /**
   * The task type code, e.g. `E`.
   */
  readonly type: string;
  /**
   * The exported constant the type code is declared with, e.g. `EXAMPLE_NOTIFICATION_TASK_TYPE`.
   */
  readonly symbolName: string;
  /**
   * The task's data interface, when the extractor found one.
   */
  readonly dataInterfaceName?: string;
  /**
   * The task's checkpoints, in declaration order.
   */
  readonly checkpoints: readonly string[];
  /**
   * Whether the API registers a handler for the task type.
   */
  readonly hasHandler: boolean;
  /**
   * Number of steps in the handler's flow, when known.
   */
  readonly handlerFlowStepCount?: number;
  /**
   * Workspace-relative source file of the task type.
   */
  readonly sourceFile: string;
}

/**
 * One notification template type in a {@link CliNotificationManifest}. Only enriches the runtime template type info, which stays the
 * source of truth for names and delivery methods.
 */
export interface CliNotificationManifestTemplate {
  /**
   * The template type code, e.g. `E`.
   */
  readonly type: string;
  /**
   * The exported constant the type code is declared with.
   */
  readonly symbolName: string;
  /**
   * The API's message factory function for the type, when found.
   */
  readonly factoryFunctionName?: string;
  /**
   * Delivery method codes (e.g. `e`, `t`) the factory produces content for.
   */
  readonly factoryContentDeliveryMethods: readonly string[];
  /**
   * Delivery method codes (e.g. `e`) the template type info forces on (`forcedDeliveryMethods`). Only set when the info forces a method.
   * Informational; the runtime template type info stays the source of truth.
   */
  readonly forcedDeliveryMethods?: readonly string[];
  /**
   * Workspace-relative source file of the template type.
   */
  readonly sourceFile: string;
}

/**
 * Build-time notification facts for an app CLI, emitted by `generate-notification-manifest --cli-output`.
 *
 * Structural on purpose: the runtime cannot import `@dereekb/dbx-cli/validate`, which depends on it.
 */
export interface CliNotificationManifest {
  readonly tasks: readonly CliNotificationManifestTask[];
  readonly templates: readonly CliNotificationManifestTemplate[];
}
