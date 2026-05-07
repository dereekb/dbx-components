/**
 * Shared types for the `<model>.api.ts` CRUD walker.
 *
 * A CRUD entry is one callable site in a `<model>.api.ts` file —
 * either a leaf in `<Group>ModelCrudFunctionsConfig` (verb + optional
 * specifier) or a key in `<Group>FunctionTypeMap` (standalone).
 *
 * Consumed both by `dbx-components-mcp`'s `dbx_model_api_*` tools and by the
 * `dbx-cli-firebase-api-manifest` build CLI. Re-exported under
 * `@dereekb/dbx-cli/manifest-extract`.
 */

export type CrudVerb = 'create' | 'read' | 'update' | 'delete' | 'query' | 'standalone';

export interface CrudEntryDocField {
  readonly name: string;
  readonly typeText: string;
  readonly description?: string;
}

export interface CrudEntry {
  /**
   * Top-level model key from `<Group>ModelCrudFunctionsConfig` (e.g. `profile`,
   * `guestbookEntry`). For standalone entries this is the firebase function
   * key itself.
   */
  readonly model: string;
  readonly verb: CrudVerb;
  /**
   * Specifier sub-key (e.g. `username`, `_`, `subscribeToNotifications`).
   * `undefined` when the verb has no nested specifier object (the value is
   * a bare params reference, e.g. `create: CreateGuestbookParams`), or when
   * the entry is `standalone`.
   */
  readonly specifier: string | undefined;
  /**
   * Bare params type name resolved at the leaf (e.g. `SetProfileUsernameParams`).
   * `undefined` when the leaf could not be resolved to a type reference.
   */
  readonly paramsTypeName: string | undefined;
  /**
   * Result type name when the leaf is a `[Params, Result]` tuple, otherwise
   * `undefined` (implies `void`).
   */
  readonly resultTypeName: string | undefined;
  /**
   * Source line of the leaf property in the type literal.
   */
  readonly line: number;
  /**
   * JSDoc summary on the property signature in `<Group>ModelCrudFunctionsConfig` (or the key
   * in `<Group>FunctionTypeMap`).
   */
  readonly description?: string;
  /**
   * JSDoc summary on the params interface itself (e.g. on `ResetProfilePasswordParams`).
   */
  readonly paramsTypeDescription?: string;
  /**
   * Per-field JSDocs read from the params interface's properties.
   */
  readonly paramsFields?: readonly CrudEntryDocField[];
  /**
   * JSDoc summary on the result interface itself (e.g. on `DownloadProfileArchiveResult`).
   */
  readonly resultTypeDescription?: string;
  /**
   * Per-field JSDocs read from the result interface's properties.
   */
  readonly resultFields?: readonly CrudEntryDocField[];
}

export interface CrudExtraction {
  /**
   * Inferred group pascal name (e.g. `Profile`, `Guestbook`).
   */
  readonly groupName: string | undefined;
  /**
   * Top-level model keys declared in `<Group>ModelCrudFunctionsConfig`,
   * including null-valued entries (e.g. `profilePrivate: null`).
   */
  readonly modelKeys: readonly string[];
  readonly entries: readonly CrudEntry[];
  /**
   * Name of the abstract `*Functions` class declared in the source, when present.
   * Used by the manifest build CLI to bind `<APP>_FIREBASE_FUNCTIONS_CONFIG`
   * class identifiers to source files.
   */
  readonly functionsClassName?: string;
}
