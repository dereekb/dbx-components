/**
 * Shared types for the `dbx_model_api_*` tools.
 *
 * A CRUD entry is one callable site in a `<model>.api.ts` file —
 * either a leaf in `<Group>ModelCrudFunctionsConfig` (verb + optional
 * specifier) or a key in `<Group>FunctionTypeMap` (standalone).
 */

export type CrudVerb = 'create' | 'read' | 'update' | 'delete' | 'query' | 'standalone';

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
}
