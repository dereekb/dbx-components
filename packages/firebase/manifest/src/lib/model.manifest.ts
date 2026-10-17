import { type Maybe, makeValuesGroupMap } from '@dereekb/util';

// MARK: Fields
/**
 * One persisted field on a {@link ModelManifestEntry}.
 *
 * Captures both the persisted (Firestore) short key and the human-readable long name from the
 * model's `@dbxModelVariable` JSDoc tag, plus any nested converter shape (for
 * `firestoreObjectArray` / `firestoreSubObject` fields) so downstream tooling can recursively
 * rewrite payload keys.
 *
 * Shared by the dbx-cli generated model manifest and the firebase-server MCP `mcp.manifest.json`
 * catalog — the MCP manifest simply never carries {@link converter}.
 */
export interface ModelManifestField {
  /**
   * Persisted Firestore short key (e.g. `fn`, `cat`, `gc`).
   */
  readonly name: string;
  /**
   * Human-readable long name resolved from the interface property's `@dbxModelVariable` JSDoc tag.
   * Falls back to `name` when no tag is declared and the persisted key is already long-form.
   */
  readonly longName: string;
  /**
   * Verbatim converter expression text from the converter's `fields` literal
   * (e.g. `firestoreDate()`, `firestoreObjectArray({ objectField: foo })`).
   *
   * Opt-in. Only emitted when the CLI manifest is generated with `--emit-model-converters`;
   * downstream tooling (e.g. the dbx-components MCP) uses this text. Never present in the MCP
   * manifest.
   */
  readonly converter?: string;
  /**
   * TypeScript type text from the interface property declaration, when the field's interface
   * property could be located (e.g. `Date`, `Maybe<NotificationUserState>`).
   */
  readonly tsType?: string;
  /**
   * `true` when the interface property is optional (`?`) or typed as `Maybe<>`, or when the
   * converter is an `optionalFirestore...()` factory.
   */
  readonly optional: boolean;
  /**
   * First paragraph of the interface property's JSDoc, when present.
   */
  readonly description?: string;
  /**
   * Enum name referenced by either the interface property's TS type or the converter's
   * `firestoreEnum<Enum>()` generic argument, resolved against every enum in the scan — the
   * declaring file does not have to be the converter's own.
   */
  readonly enumRef?: string;
  /**
   * Free-text description from the interface property's `@dbxModelVariableSyncFlag` JSDoc tag,
   * when present.
   */
  readonly syncFlag?: string;
  /**
   * Recursively-resolved nested fields when this field's converter is a
   * `firestoreObjectArray({ objectField: ... })` or `firestoreSubObject({ objectField: ... })` call
   * whose inner converter could be resolved (either inline or via cross-file converter const).
   *
   * Absent when the converter is opaque (custom helper, dynamic expression, `firestoreEnum`,
   * primitive factory, etc.).
   */
  readonly nestedFields?: readonly ModelManifestField[];
  /**
   * `true` when the nested fields describe an array element shape (`firestoreObjectArray`);
   * `false` for sub-object fields. Only meaningful when {@link nestedFields} is set.
   */
  readonly nestedIsArray?: boolean;
}

// MARK: Entries
/**
 * Read posture declared by `@dbxModelRead <level>` on a model interface.
 */
export type ModelManifestReadLevel = 'system' | 'owner' | 'admin-only' | 'permissions';

/**
 * Reference to the `@dbxModelServiceFactory <modelType>`-tagged export that implements a model.
 */
export interface ModelManifestServiceFactoryRef {
  readonly exportName: string;
  readonly sourceFile: string;
}

/**
 * Flat-key encoding declared by a `@dbxModelCompositeKey` tag.
 *
 * - `one-way` — `flatFirestoreModelKey()`: slashes removed; the source key cannot be recovered
 *   from the id.
 * - `two-way` — `twoWayFlatFirestoreModelKey()`: slashes replaced with underscores; recover the
 *   source key with `inferKeyFromTwoWayFlatFirestoreModelKey()`.
 */
export type ModelManifestCompositeKeyEncoding = 'one-way' | 'two-way';

/**
 * Composite-key declaration carried on a {@link ModelManifestEntry}.
 */
export interface ModelManifestCompositeKey {
  /**
   * `'*'` when any model's key may be the source (framework models such as `NotificationBox`), or
   * the source model names as written in the tag — each an interface name, identity const, or
   * modelType, resolved against the manifest at decode time.
   */
  readonly from: readonly string[] | '*';
  readonly encoding: ModelManifestCompositeKeyEncoding;
}

/**
 * One Firestore model entry in the generated model catalog.
 *
 * Generated at build time by `dbx-cli-generate-firebase-api-manifest` (the CLI's
 * `<NAMESPACE>_MODEL_MANIFEST`) and projected into the `models` array of `mcp.manifest.json`.
 * Drives the CLI `model-info` / `model-decode` / `info` commands, the `--expand-keys` rewrite, and
 * the firebase-server MCP `model-info` / `model-decode` / `model-get` / `<prefix>_api_info` tools.
 */
export interface ModelManifestEntry {
  /**
   * Persisted model type id (e.g. `notificationBox`, `profile`).
   */
  readonly modelType: string;
  /**
   * Pascal-case model name as declared by the source interface (e.g. `NotificationBox`).
   */
  readonly modelName: string;
  /**
   * Group name from the source `@dbxModelGroup` tag on the `<X>FirestoreCollections` container
   * (e.g. `Notification`, `Profile`).
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
   * `true` when the model's collection holds exactly one document — built by
   * `singleItemFirestoreCollection` (one per parent) or `rootSingleItemFirestoreCollection`
   * (one, full stop). Absent for ordinary multi-document collections.
   */
  readonly singleton?: boolean;
  /**
   * Fixed document id of a {@link singleton} model's one document: the value passed as
   * `singleItemIdentifier`, or `'0'` (`DEFAULT_SINGLE_ITEM_FIRESTORE_COLLECTION_DOCUMENT_IDENTIFIER`)
   * when the collection factory omits it.
   *
   * This cannot be inferred from the rest of the entry — plenty of single-item collections override
   * the default — so a caller building a document key must read it here rather than assume `/0`.
   * Absent when {@link singleton} is `true` but the id was declared as an expression the generator
   * could not resolve.
   */
  readonly singleItemIdentifier?: string;
  /**
   * A ready-to-use example document key for this model, with the parent chain resolved from the
   * identity graph and `<…Id>` placeholders standing in for the ids a caller supplies
   * (e.g. `p/<profileId>`, `gb/<guestbookId>/gbe/<guestbookEntryId>`). A {@link singleton} model's
   * own segment is its literal {@link singleItemIdentifier}.
   *
   * Absent only when some ancestor identity could not be resolved.
   */
  readonly exampleKey?: string;
  /**
   * First paragraph of the source interface's JSDoc, when present.
   */
  readonly description?: string;
  /**
   * Source package providing the model (e.g. `@dereekb/firebase`, `demo-firebase`).
   */
  readonly sourcePackage: string;
  /**
   * Workspace-relative path of the source `.ts` file that declares the model.
   */
  readonly sourceFile: string;
  /**
   * Persisted-field metadata in source order.
   */
  readonly fields: readonly ModelManifestField[];
  /**
   * Per-model override of the MCP tool-name model segment, from `@dbxModelMcpToolNameSegment
   * <segment>` on the model interface. When present it replaces the model type in generated tool
   * names (e.g. the collection prefix). Absent when the model omits the tag.
   */
  readonly mcpToolNameSegment?: string;
  /**
   * Read posture declared by `@dbxModelRead <level>` on the model interface. Absent when the model
   * interface omits the tag.
   */
  readonly read?: ModelManifestReadLevel;
  /**
   * True when the model declared `@dbxModelServerOnly` — no client may read it, on any path.
   *
   * Mirrors `FirebaseModelServiceConfig.serverOnly` on the runtime side, so a consumer sees the
   * refusal is structural rather than a missing role it could be granted.
   */
  readonly serverOnly?: boolean;
  /**
   * Resolved `@dbxModelServiceFactory <modelType>`-tagged export that implements this model. Joined
   * by `modelType` during model-manifest assembly. Absent when no factory was found.
   */
  readonly serviceFactory?: ModelManifestServiceFactoryRef;
  /**
   * Declared `@dbxModelCompositeKey from=<ModelA>[,<ModelB>...] encoding=<two-way|one-way>` on the
   * model interface — this model's document id is a flattened encoding of a source model's key.
   * Absent when the model omits the tag.
   *
   * Consumed by `model-decode` (to publish the derived key when a source key is decoded, and to
   * recover the source key from a two-way id) and by `model-get` (to accept a source key in place
   * of the flattened id).
   */
  readonly compositeKey?: ModelManifestCompositeKey;
}

/**
 * The generated model catalog: every {@link ModelManifestEntry}, in manifest order.
 */
export type ModelManifest = readonly ModelManifestEntry[];

// MARK: Lookup
/**
 * Resolves the manifest entry for `query`. Each entry is tested against its `modelType`, then its
 * `identityConst`, then its `collectionPrefix`; the first entry that matches any of the three wins,
 * so callers can pass whichever form a user typed.
 *
 * @param query - The modelType, identity const, or collection prefix to look up.
 * @param manifest - The model manifest to search.
 * @returns The matching entry, or `undefined` when none exists.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findModelManifestEntry(query: string, manifest: ModelManifest): ModelManifestEntry | undefined {
  let result: ModelManifestEntry | undefined;

  for (const entry of manifest) {
    if (entry.modelType === query || entry.identityConst === query || entry.collectionPrefix === query) {
      result = entry;
      break;
    }
  }

  return result;
}

// MARK: Composite Keys
/**
 * Whether `candidate` is a composite-key model whose document id is derived from a `source`
 * document's key — `candidate.compositeKey.from` names `source` (by interface name, identity const,
 * or modelType) or is the wildcard `*`. A model is never derived from its own key.
 *
 * @param source - The manifest entry of the source model.
 * @param candidate - The manifest entry to test.
 * @returns `true` when `candidate`'s id is a flattened `source` key.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isCompositeKeyModelDerivedFrom(source: ModelManifestEntry, candidate: ModelManifestEntry): boolean {
  const from = candidate.compositeKey?.from;
  return from != null && candidate.modelType !== source.modelType && (from === '*' || from.some((name) => name === source.modelName || name === source.identityConst || name === source.modelType));
}

/**
 * Resolves the manifest entries whose `compositeKey.from` names `source` — the models whose document
 * id is derived from a `source` document's key. A wildcard `from=*` matches every model except
 * `source` itself (a model's id is never derived from its own key).
 *
 * @param source - The manifest entry of the decoded key's leaf model.
 * @param manifest - The full model manifest.
 * @returns The composite-key entries derived from `source`, in manifest order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findCompositeKeyModelsDerivedFrom(source: ModelManifestEntry, manifest: ModelManifest): ModelManifestEntry[] {
  return manifest.filter((entry) => isCompositeKeyModelDerivedFrom(source, entry));
}

// MARK: Field Flattening
/**
 * One field of a model, flattened out of its `nestedFields` tree by {@link flattenModelManifestFields}.
 */
export interface FlatModelManifestField {
  readonly field: ModelManifestField;
  /**
   * Dotted path of persisted short keys from the model root (e.g. `e.h.o`).
   */
  readonly path: string;
  /**
   * Dotted path of long names from the model root (e.g. `entries.history.owner`).
   */
  readonly longPath: string;
  /**
   * Nesting depth; top-level fields are `0`.
   */
  readonly depth: number;
}

/**
 * Flattens a model's fields into a pre-order list, descending into `nestedFields`. Each entry
 * carries the dotted short-key and long-name paths from the model root.
 *
 * @param fields - The model's top-level fields.
 * @returns Every field, parents before their nested fields, in source order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function flattenModelManifestFields(fields: readonly ModelManifestField[]): FlatModelManifestField[] {
  const result: FlatModelManifestField[] = [];

  function visit(current: readonly ModelManifestField[], parentPath: Maybe<string>, parentLongPath: Maybe<string>, depth: number): void {
    for (const field of current) {
      const path = parentPath == null ? field.name : `${parentPath}.${field.name}`;
      const longPath = parentLongPath == null ? field.longName : `${parentLongPath}.${field.longName}`;
      result.push({ field, path, longPath, depth });

      if (field.nestedFields != null) {
        visit(field.nestedFields, path, longPath, depth + 1);
      }
    }
  }

  visit(fields, undefined, undefined, 0);
  return result;
}

// MARK: Grouping
/**
 * Group label used for models that declare no `modelGroup`.
 */
export const MODEL_MANIFEST_UNGROUPED_LABEL = '(ungrouped)';

/**
 * The models of one `modelGroup`, as returned by {@link groupModelManifestEntries}.
 */
export interface ModelManifestEntryGroup {
  readonly modelGroup: string;
  readonly entries: readonly ModelManifestEntry[];
}

/**
 * Groups the manifest by `modelGroup`, bucketing entries without a group under
 * {@link MODEL_MANIFEST_UNGROUPED_LABEL}. Groups are sorted by model count descending, then group
 * name ascending; entries keep manifest order within each group.
 *
 * @param manifest - The model manifest to group.
 * @returns One group per distinct `modelGroup`, most-populous first.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function groupModelManifestEntries(manifest: ModelManifest): ModelManifestEntryGroup[] {
  const grouped = makeValuesGroupMap([...manifest], (entry) => entry.modelGroup ?? MODEL_MANIFEST_UNGROUPED_LABEL);
  const groups: ModelManifestEntryGroup[] = [];

  grouped.forEach((entries, modelGroup) => {
    groups.push({ modelGroup: modelGroup as string, entries });
  });

  groups.sort((a, b) => b.entries.length - a.entries.length || a.modelGroup.localeCompare(b.modelGroup));
  return groups;
}
