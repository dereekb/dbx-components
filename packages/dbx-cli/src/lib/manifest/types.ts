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
}

/**
 * Generated array of {@link CliModelManifestEntry} consumed by `model-info`
 * and the `--expand-keys` rewrite. Each downstream CLI app exports its own
 * `<NAMESPACE>_MODEL_MANIFEST` of this type.
 */
export type CliModelManifest = readonly CliModelManifestEntry[];

export type CliApiVerb = 'create' | 'read' | 'update' | 'delete' | 'query' | 'standalone';

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
}

export type CliApiManifest = readonly CliApiManifestEntry[];
