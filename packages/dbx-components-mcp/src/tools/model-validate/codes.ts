/**
 * Violation codes emitted by `dbx_model_validate`.
 *
 * Source of truth for rule documentation. `extract-rule-catalog`
 * walks the JSDoc summary + `@dbxRule*` tags off each member and
 * emits the runtime catalog.
 */
export enum ModelValidateCode {
  /**
   * The file is missing its `<Group>FirestoreCollections` interface.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model file (one declaring `firestoreModelIdentity(...)`) must anchor its `<Group>FirestoreCollections` interface above the first model.
   * @dbxRuleNotApplies Files in `@dereekb/firebase` itself — those are upstream sources owned by the package.
   * @dbxRuleFix Declare `export interface <Group>FirestoreCollections { ... }` above the first `firestoreModelIdentity(...)` call.
   * @dbxRuleSeeAlso artifact:firestore-model
   */
  FILE_MISSING_GROUP_INTERFACE = 'FILE_MISSING_GROUP_INTERFACE',

  /**
   * The `<Group>FirestoreCollections` interface is declared but not exported.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every group-collections interface declaration.
   * @dbxRuleNotApplies When the interface is intentionally module-private (rare — the model wiring needs it cross-file).
   * @dbxRuleFix Add the `export` keyword to the interface declaration.
   */
  FILE_GROUP_INTERFACE_NOT_EXPORTED = 'FILE_GROUP_INTERFACE_NOT_EXPORTED',

  /**
   * The `<Group>FirestoreCollections` interface is declared after the first model.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model file with both an interface and at least one model declaration.
   * @dbxRuleNotApplies Files declaring no models (the interface ordering rule is moot there).
   * @dbxRuleFix Move the `<Group>FirestoreCollections` interface above the first model declaration.
   */
  FILE_GROUP_INTERFACE_AFTER_MODEL = 'FILE_GROUP_INTERFACE_AFTER_MODEL',

  /**
   * The file is missing its `<Group>Types` union alias.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model file must declare a `<Group>Types` union of `typeof <identity>` covering every model in the file.
   * @dbxRuleNotApplies Files in `@dereekb/firebase` itself.
   * @dbxRuleFix Add `export type <Group>Types = typeof <Identity1>FirestoreModelIdentity | typeof <Identity2>FirestoreModelIdentity ...`.
   */
  FILE_MISSING_GROUP_TYPES = 'FILE_MISSING_GROUP_TYPES',

  /**
   * The `<Group>Types` alias is declared but not exported.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every group-types alias.
   * @dbxRuleNotApplies When intentionally module-private (rare — downstream code consumes the union).
   * @dbxRuleFix Add `export` to the type alias declaration.
   */
  FILE_GROUP_TYPES_NOT_EXPORTED = 'FILE_GROUP_TYPES_NOT_EXPORTED',

  /**
   * The `<Group>Types` alias is declared after the first model.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model file with both a types alias and at least one model.
   * @dbxRuleNotApplies Files declaring no models.
   * @dbxRuleFix Move the `<Group>Types` alias above the first model.
   */
  FILE_GROUP_TYPES_AFTER_MODEL = 'FILE_GROUP_TYPES_AFTER_MODEL',

  /**
   * The `<Group>Types` alias is missing a `typeof <identity>` ref for one of the file's models.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every identity declared in the file must appear in the types union.
   * @dbxRuleNotApplies When the model is intentionally excluded (rare — the union is the canonical type discriminator).
   * @dbxRuleFix Add `| typeof <identity>` to the union.
   */
  FILE_GROUP_TYPES_MISSING_IDENTITY = 'FILE_GROUP_TYPES_MISSING_IDENTITY',

  /**
   * The `<Group>Types` alias references an identity that isn't declared in the file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every identity ref in the union.
   * @dbxRuleNotApplies When the identity is imported from another file (rare — usually a typo).
   * @dbxRuleFix Either declare the identity in the file or remove the orphaned ref.
   */
  FILE_GROUP_TYPES_UNKNOWN_IDENTITY = 'FILE_GROUP_TYPES_UNKNOWN_IDENTITY',

  /**
   * The `<Group>FirestoreCollections` interface is missing the collection entry for one of the file's models.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model in the file must have its `<camelName>Collection` (root) or `<camelName>CollectionFactory` + `<camelName>CollectionGroup` (subcollection) entries on the interface.
   * @dbxRuleNotApplies Models intentionally excluded from the group container (rare).
   * @dbxRuleFix Add the missing property to the interface declaration.
   */
  FILE_GROUP_INTERFACE_MISSING_COLLECTION = 'FILE_GROUP_INTERFACE_MISSING_COLLECTION',

  /**
   * The `<Group>FirestoreCollections` interface is missing its `@dbxModelGroup` JSDoc tag.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every group container — the rich catalog extractor (`scan/extract-models`) requires the tag to register the group, and downstream traversal/referencing depends on that registration.
   * @dbxRuleNotApplies Files in `@dereekb/firebase` itself (upstream-owned sources).
   * @dbxRuleFix Add `@dbxModelGroup <Group>` to the JSDoc above the `<Group>FirestoreCollections` declaration.
   * @dbxRuleSeeAlso artifact:firestore-model
   */
  MODEL_GROUP_INTERFACE_MISSING_TAG = 'MODEL_GROUP_INTERFACE_MISSING_TAG',

  /**
   * The model's `firestoreModelIdentity(...)` const is not exported.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every identity constant.
   * @dbxRuleNotApplies When intentionally module-private (rare).
   * @dbxRuleFix Add `export` to the identity constant declaration.
   */
  MODEL_IDENTITY_NOT_EXPORTED = 'MODEL_IDENTITY_NOT_EXPORTED',

  /**
   * `firestoreModelIdentity(...)` was called with non-string-literal args (or wrong arity).
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every identity call.
   * @dbxRuleNotApplies When the args come from a const (uncommon — the validator can't follow non-literal references).
   * @dbxRuleFix Pass `(parentIdentity?, '<modelType>', '<prefix>')` as inline string literals.
   */
  MODEL_IDENTITY_BAD_ARGS = 'MODEL_IDENTITY_BAD_ARGS',

  /**
   * `firestoreModelIdentity(...)` was found but its corresponding model interface lacks the `@dbxModel` JSDoc tag, leaving the model invisible to the catalog and to downstream traversal/referencing code.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `firestoreModelIdentity(...)` call whose `<PascalName>` interface is missing `@dbxModel`. Anchored at the identity line so the fix points at both the interface and the identity.
   * @dbxRuleNotApplies Files in `@dereekb/firebase` itself.
   * @dbxRuleFix Add `@dbxModel` to the JSDoc on the `<PascalName>` interface so the catalog and decoder recognise it as a model.
   * @dbxRuleSeeAlso artifact:firestore-model
   */
  MODEL_IDENTITY_NOT_TAGGED = 'MODEL_IDENTITY_NOT_TAGGED',

  /**
   * The model has no matching data interface (`<PascalName>`).
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model in the file.
   * @dbxRuleNotApplies Models that intentionally reuse another file's interface (rare).
   * @dbxRuleFix Declare `export interface <PascalName> extends FirestoreModelData { ... }`.
   * @dbxRuleSeeAlso artifact:firestore-model
   */
  MODEL_MISSING_INTERFACE = 'MODEL_MISSING_INTERFACE',

  /**
   * The model's data interface is missing its `@dbxModel` JSDoc tag.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `<PascalName>` interface that anchors a `firestoreModelIdentity(...)` model — the rich catalog extractor (`scan/extract-models`) requires the tag to register the model.
   * @dbxRuleNotApplies Embedded sub-object interfaces (no matching identity) and files in `@dereekb/firebase` itself.
   * @dbxRuleFix Add `@dbxModel` to the JSDoc above the `<PascalName>` interface declaration.
   * @dbxRuleSeeAlso artifact:firestore-model
   */
  MODEL_INTERFACE_MISSING_TAG = 'MODEL_INTERFACE_MISSING_TAG',

  /**
   * The model's data interface is declared but not exported.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model interface declaration.
   * @dbxRuleNotApplies When intentionally module-private (rare).
   * @dbxRuleFix Add `export` to the interface declaration.
   */
  MODEL_INTERFACE_NOT_EXPORTED = 'MODEL_INTERFACE_NOT_EXPORTED',

  /**
   * The model has no matching `<PascalName>Roles` type alias.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model in the file.
   * @dbxRuleNotApplies Models that intentionally reuse a parent's role union (rare).
   * @dbxRuleFix Declare `export type <PascalName>Roles = 'role-a' | 'role-b' | ...`.
   */
  MODEL_MISSING_ROLES = 'MODEL_MISSING_ROLES',

  /**
   * The roles type is declared but not exported.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every roles type alias.
   * @dbxRuleNotApplies When intentionally module-private.
   * @dbxRuleFix Add `export` to the alias.
   */
  MODEL_ROLES_NOT_EXPORTED = 'MODEL_ROLES_NOT_EXPORTED',

  /**
   * The model has no matching `<PascalName>Document` class.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model in the file.
   * @dbxRuleNotApplies Models intentionally extending a shared document class.
   * @dbxRuleFix Declare `export class <PascalName>Document extends AbstractFirestoreDocument<...> { ... }`.
   */
  MODEL_MISSING_DOCUMENT_CLASS = 'MODEL_MISSING_DOCUMENT_CLASS',

  /**
   * The document class is declared but not exported.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every document class.
   * @dbxRuleNotApplies When intentionally module-private.
   * @dbxRuleFix Add `export` to the class declaration.
   */
  MODEL_DOCUMENT_CLASS_NOT_EXPORTED = 'MODEL_DOCUMENT_CLASS_NOT_EXPORTED',

  /**
   * The document class extends an unsupported base class.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every document class — must extend `AbstractFirestoreDocument` (root) or `AbstractFirestoreDocumentWithParent` (subcollection).
   * @dbxRuleNotApplies Custom document hierarchies (rare; usually a typo).
   * @dbxRuleFix Change the `extends` clause to the canonical base class for the model variant.
   */
  MODEL_DOCUMENT_WRONG_BASE_CLASS = 'MODEL_DOCUMENT_WRONG_BASE_CLASS',

  /**
   * The document class's generic type args don't line up with the model identity / interface.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every document class.
   * @dbxRuleNotApplies When generics are intentionally widened (rare).
   * @dbxRuleFix Pass `<PascalName>, <PascalName>Document>` (root) or include the parent generics for subcollections.
   */
  MODEL_DOCUMENT_BAD_TYPE_ARGS = 'MODEL_DOCUMENT_BAD_TYPE_ARGS',

  /**
   * The document class is missing the `get modelIdentity()` getter.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every document class.
   * @dbxRuleNotApplies Document classes inheriting the getter from a custom abstract base (rare).
   * @dbxRuleFix Add `get modelIdentity() { return <identity>; }` returning the matching identity constant.
   */
  MODEL_DOCUMENT_MISSING_IDENTITY_GETTER = 'MODEL_DOCUMENT_MISSING_IDENTITY_GETTER',

  /**
   * The document's `get modelIdentity()` returns the wrong identity constant.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every document class.
   * @dbxRuleNotApplies When the rename was intentional (rare — usually a copy-paste).
   * @dbxRuleFix Update the getter body to return the matching identity constant.
   */
  MODEL_DOCUMENT_WRONG_IDENTITY_GETTER = 'MODEL_DOCUMENT_WRONG_IDENTITY_GETTER',

  /**
   * The model has no `<camelName>Converter` constant.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model in the file.
   * @dbxRuleNotApplies Models intentionally sharing a converter (rare).
   * @dbxRuleFix Declare `export const <camelName>Converter = snapshotConverterFunctions<<PascalName>>({ fields: { ... } });`.
   */
  MODEL_MISSING_CONVERTER = 'MODEL_MISSING_CONVERTER',

  /**
   * The converter constant is declared but not exported.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every converter constant.
   * @dbxRuleNotApplies When intentionally module-private.
   * @dbxRuleFix Add `export` to the converter declaration.
   */
  MODEL_CONVERTER_NOT_EXPORTED = 'MODEL_CONVERTER_NOT_EXPORTED',

  /**
   * The model has no collection-reference function (`<camelName>CollectionReference` for root or `<camelName>CollectionReferenceFactory` for subcollection).
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model.
   * @dbxRuleNotApplies Models that intentionally bypass the canonical reference shape.
   * @dbxRuleFix Declare the matching reference function next to the converter.
   */
  MODEL_MISSING_COLLECTION_REFERENCE = 'MODEL_MISSING_COLLECTION_REFERENCE',

  /**
   * The model has no `<PascalName>FirestoreCollection` type alias.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model.
   * @dbxRuleNotApplies When intentionally re-using a parent type (rare).
   * @dbxRuleFix Declare `export type <PascalName>FirestoreCollection = FirestoreCollection<<PascalName>, <PascalName>Document>;`.
   */
  MODEL_MISSING_COLLECTION_TYPE = 'MODEL_MISSING_COLLECTION_TYPE',

  /**
   * The collection type alias uses the wrong generic shape for the model variant.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies The 4-shape taxonomy: `FirestoreCollection<T, D>` for root, `RootSingleItemFirestoreCollection<T, D>` for root-singleton, `FirestoreCollectionWithParent<T, PT, D, PD>` for sub-collection, `SingleItemFirestoreCollection<T, PT, D, PD>` for singleton-sub.
   * @dbxRuleNotApplies Multi-document subcollections that should genuinely use `FirestoreCollectionWithParent` — confirm the factory body calls `firestoreContext.firestoreCollectionWithParent({...})`. If yes, this rule is a false-positive (the validator detected `singleItemFirestoreCollection` somewhere it shouldn't have).
   * @dbxRuleFix Match the type alias's generics to the factory body's `firestoreContext.*` call. Run `dbx_explain_rule code="MODEL_COLLECTION_TYPE_WRONG_GENERIC"` for the full taxonomy.
   * @dbxRuleSeeAlso artifact:firestore-model
   */
  MODEL_COLLECTION_TYPE_WRONG_GENERIC = 'MODEL_COLLECTION_TYPE_WRONG_GENERIC',

  /**
   * The collection-type alias kind disagrees with the factory body's `firestoreContext.*` call.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the type alias declares one shape and the factory implements another (e.g. type says `RootSingleItemFirestoreCollection` but body calls `firestoreCollection`).
   * @dbxRuleNotApplies When the validator can't locate the factory body (rare — emits no rule then).
   * @dbxRuleFix Pick one shape and use it consistently — either change the type alias or change the factory body to match.
   */
  MODEL_COLLECTION_FACTORY_TYPE_MISMATCH = 'MODEL_COLLECTION_FACTORY_TYPE_MISMATCH',

  /**
   * The model has no `<camelName>FirestoreCollection` (root) or `<camelName>FirestoreCollectionFactory` (subcollection) function.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model.
   * @dbxRuleNotApplies When the function is intentionally inlined (rare).
   * @dbxRuleFix Declare the matching factory function.
   */
  MODEL_MISSING_COLLECTION_FN = 'MODEL_MISSING_COLLECTION_FN',

  /**
   * The model's declarations are out of canonical order.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model — declarations follow the order: identity, interface, rolesType, documentClass, converter, referenceFn, collectionType, collectionFn (root) or … collectionFactoryType, collectionFn, referenceGroupFn, collectionGroupType, collectionGroupFn (subcollection).
   * @dbxRuleNotApplies Files where multiple models intentionally interleave (rare; prefer one-model-per-file).
   * @dbxRuleFix Re-order the declarations to match the canonical sequence.
   */
  MODEL_OUT_OF_ORDER = 'MODEL_OUT_OF_ORDER',

  /**
   * Subcollection model is missing its `<camelName>CollectionReferenceFactory` function.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every subcollection model.
   * @dbxRuleNotApplies Root models — they declare `<camelName>CollectionReference` instead.
   * @dbxRuleFix Declare `export function <camelName>CollectionReferenceFactory(...)`.
   */
  SUB_MISSING_COLLECTION_REFERENCE_FACTORY = 'SUB_MISSING_COLLECTION_REFERENCE_FACTORY',

  /**
   * Subcollection model is missing its `<PascalName>FirestoreCollectionFactory` type alias.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every subcollection model.
   * @dbxRuleNotApplies Root models.
   * @dbxRuleFix Declare `export type <PascalName>FirestoreCollectionFactory = FirestoreCollectionWithParentFactory<...>;`.
   */
  SUB_MISSING_COLLECTION_FACTORY_TYPE = 'SUB_MISSING_COLLECTION_FACTORY_TYPE',

  /**
   * Subcollection model is missing its `<camelName>FirestoreCollectionFactory` function.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every subcollection model.
   * @dbxRuleNotApplies Root models.
   * @dbxRuleFix Declare `export function <camelName>FirestoreCollectionFactory(...)`.
   */
  SUB_MISSING_COLLECTION_FACTORY_FN = 'SUB_MISSING_COLLECTION_FACTORY_FN',

  /**
   * Subcollection model is missing its `<camelName>CollectionGroup` reference function.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every subcollection model.
   * @dbxRuleNotApplies Root models — they don't have a collection-group concept.
   * @dbxRuleFix Declare `export function <camelName>CollectionGroup(firestoreContext)`.
   */
  SUB_MISSING_COLLECTION_GROUP_REFERENCE = 'SUB_MISSING_COLLECTION_GROUP_REFERENCE',

  /**
   * Subcollection model is missing its `<PascalName>FirestoreCollectionGroup` type alias.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every subcollection model.
   * @dbxRuleNotApplies Root models.
   * @dbxRuleFix Declare `export type <PascalName>FirestoreCollectionGroup = FirestoreCollectionGroup<...>;`.
   */
  SUB_MISSING_COLLECTION_GROUP_TYPE = 'SUB_MISSING_COLLECTION_GROUP_TYPE',

  /**
   * Subcollection model is missing its `<camelName>FirestoreCollectionGroup` function.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every subcollection model.
   * @dbxRuleNotApplies Root models.
   * @dbxRuleFix Declare `export function <camelName>FirestoreCollectionGroup(firestoreContext)`.
   */
  SUB_MISSING_COLLECTION_GROUP_FN = 'SUB_MISSING_COLLECTION_GROUP_FN',

  /**
   * A persisted field's name exceeds the workspace's 5-character convention.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every persisted field on a model interface (or sub-object interface). The default limit is 5; override via `dbx-mcp.config.json` `modelValidate.maxFieldNameLength`.
   * @dbxRuleNotApplies Fields whose name is listed in `dbx-mcp.config.json` `modelValidate.ignoredFieldNames`, or fields that compose well-known multi-character abbreviations the project intentionally allows.
   * @dbxRuleFix Rename the field to a 1–5 character abbreviation (e.g. `name` → `n`, `userId` → `uid`). To exempt specific names workspace-wide, add them to `modelValidate.ignoredFieldNames` in `dbx-mcp.config.json`.
   */
  MODEL_FIELD_NAME_TOO_LONG = 'MODEL_FIELD_NAME_TOO_LONG',

  /**
   * A persisted field has no JSDoc description.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every persisted field — short field names need a JSDoc description so a reader knows what the field is actually for. The long-name itself is carried by the `@dbxModelVariable` tag, so the JSDoc body just needs a one-line description.
   * @dbxRuleNotApplies Fields whose name is unambiguously self-describing (rare with 1-4 char abbreviations).
   * @dbxRuleFix Add `/** <one-line description> *\/` above the field declaration (and append `@dbxModelVariable <longName>` for the canonical long name).
   */
  MODEL_FIELD_MISSING_JSDOC = 'MODEL_FIELD_MISSING_JSDOC',

  /**
   * A persisted field is missing its `@dbxModelVariable <name>` JSDoc tag.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every field on a `@dbxModel` interface — the tag carries the human-readable long name the catalog and decoder use when surfacing the field to operators. The long name is the variable name the field would have unabbreviated, written in camelCase (e.g. `uid` → `userUid`, `n` → `name`, `crAt` → `createdAt`).
   * @dbxRuleNotApplies Fields on embedded sub-object interfaces (no `@dbxModel` parent) and fields the project deliberately leaves untagged (rare).
   * @dbxRuleFix Append `@dbxModelVariable <longName>` to the field's JSDoc block, where `<longName>` is the field's unabbreviated camelCase variable name.
   */
  MODEL_FIELD_MISSING_VARIABLE_TAG = 'MODEL_FIELD_MISSING_VARIABLE_TAG'
}

/**
 * String-literal union derived from {@link ModelValidateCode}.
 */
export type ModelValidateCodeString = `${ModelValidateCode}`;
