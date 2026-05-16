/**
 * Validation rules run against an {@link ExtractedFile}. Rules accumulate
 * {@link Violation}s into a mutable buffer; the public entry point is
 * {@link validateExtracted} in `./index.ts`.
 *
 * All rules emit hard errors. Callers are expected to fix the source and
 * re-run rather than silence individual codes.
 */

import { attachRemediation } from '../rule-catalog/index.js';
import { MAX_FIELD_NAME_LENGTH, ROOT_MODEL_ORDER, SUBCOLLECTION_MODEL_ORDER, type CrossFileInterfaceEntry, type CrossFileRuleContext, type DeclarationKind, type ExtractedFile, type ExtractedModel, type FirestoreCollectionKind, type RuleOptions, type Violation, type ViolationSeverity } from './types.js';

// MARK: Entry
/**
 * Applies every model-level rule to a single extracted model file and returns
 * the aggregated diagnostics. Rules short-circuit early when prerequisites
 * (like a missing identity) are absent.
 *
 * Files without `firestoreModelIdentity` calls still run the cross-file
 * sub-object factory rule when a {@link CrossFileRuleContext} is supplied —
 * a sibling sub-file (e.g. `worker.pay.ts`) can declare and consume
 * `firestoreSubObject<T>` without itself anchoring a model.
 *
 * @param file - the extracted facts for one model source
 * @param options - optional rule overrides (field-name length limit, ignore list)
 * @param context - optional cross-file context for rules needing access to interfaces declared in sibling files
 * @returns the violations the rules emit for that file
 */
export function runRules(file: ExtractedFile, options?: RuleOptions, context?: CrossFileRuleContext): readonly Violation[] {
  const violations: Violation[] = [];
  const hasModels = file.models.length > 0;
  if (hasModels) {
    checkFileLevel(file, violations);
    for (const model of file.models) {
      checkIdentity(file, model, violations);
      checkCoreDeclarations(file, model, violations);
      if (model.variant === 'subcollection') {
        checkSubcollectionExtras(file, model, violations);
      }
      checkDeclarationOrder(file, model, violations);
    }
  }
  // Field rules run in every file. In files with no top-level models
  // (sibling sub-files like `worker.pay.ts`), the scope tightens to
  // `@dbxModel` / `@dbxModelSubObject` interfaces so the validator stays
  // silent on unrelated helper interfaces that just happen to live there.
  const fieldRuleInput: FieldRuleCheckInput = {
    file,
    violations,
    options,
    scope: { restrictToTaggedInterfaces: !hasModels }
  };
  checkFieldNameLengths(fieldRuleInput);
  checkSubObjectInterfaceTags(file, violations);
  checkSubObjectFactoryCallSites(file, violations, context);
  checkSubObjectParentNotTagged({ file, violations, context, options });
  checkCompositeKeyTags(file, violations);
  return violations;
}

/**
 * Shared input for the field-level rule checks. Bundles the per-file
 * extraction, the violations buffer, the rule options, and the per-call
 * scope so the underlying helpers stay under the max-params cap.
 */
interface FieldRuleCheckInput {
  readonly file: ExtractedFile;
  readonly violations: Violation[];
  readonly options: RuleOptions | undefined;
  readonly scope: FieldRuleScope;
}

// MARK: Field-name length (warning)
interface FieldRuleScope {
  /**
   * When `true`, restricts the per-interface field rules to interfaces
   * tagged with `@dbxModel` or `@dbxModelSubObject`. The validator passes
   * `true` for sibling sub-files that don't host any top-level model so
   * unrelated helper interfaces don't trigger warnings.
   */
  readonly restrictToTaggedInterfaces: boolean;
}

function checkFieldNameLengths(input: FieldRuleCheckInput): void {
  const { file, violations, options, scope } = input;
  const limit = options?.maxFieldNameLength ?? MAX_FIELD_NAME_LENGTH;
  const ignored = options?.ignoredFieldNames;
  for (const iface of file.dataInterfaces) {
    if (scope.restrictToTaggedInterfaces && !(iface.dbxModelTag || iface.dbxModelSubObjectTag)) {
      continue;
    }
    for (const field of iface.fields) {
      if (ignored?.has(field.name)) {
        continue;
      }
      if (field.name.length <= limit) {
        continue;
      }
      pushViolation(violations, {
        code: 'MODEL_FIELD_NAME_TOO_LONG',
        severity: 'warning',
        message: `Field \`${field.name}\` in interface \`${iface.name}\` is ${field.name.length} characters (limit ${limit}). Firestore field names should be short to minimize document size.`,
        file: file.name,
        line: field.line,
        model: iface.name
      });
    }
  }
  checkFieldJsDocs(input);
}

interface CheckFieldInput {
  readonly file: ExtractedFile;
  readonly iface: ExtractedFile['dataInterfaces'][number];
  readonly field: ExtractedFile['dataInterfaces'][number]['fields'][number];
  readonly ignored: ReadonlySet<string> | undefined;
  readonly violations: Violation[];
}

/**
 * Emits `MODEL_FIELD_MISSING_JSDOC` for fields whose first JSDoc line
 * is empty. Acts on a single field via the shared {@link CheckFieldInput}.
 *
 * @param input - the field + violations buffer
 */
function checkFieldJsDocDescription(input: CheckFieldInput): void {
  const { file, iface, field, violations } = input;
  if (field.jsDocFirstLine) return;
  pushViolation(violations, {
    code: 'MODEL_FIELD_MISSING_JSDOC',
    severity: 'warning',
    message: `Field \`${field.name}\` in interface \`${iface.name}\` is missing a JSDoc description. Add a one-line description above the field declaration (and an \`@dbxModelVariable <longName>\` tag for the canonical long name).`,
    file: file.name,
    line: field.line,
    model: iface.name
  });
}

/**
 * Emits `MODEL_FIELD_MISSING_VARIABLE_TAG` when a tagged interface's
 * field is missing its `@dbxModelVariable` tag, and
 * `MODEL_FIELD_LONG_NAME_EQUALS_NAME` when the tag value matches the
 * field's short name.
 *
 * @param input - the field, ignored-name set, and violations buffer
 */
function checkFieldVariableTag(input: CheckFieldInput): void {
  const { file, iface, field, ignored, violations } = input;
  const fieldRulesApply = iface.dbxModelTag || iface.dbxModelSubObjectTag;
  if (!fieldRulesApply) return;
  if (field.dbxModelVariableTag === undefined) {
    pushViolation(violations, {
      code: 'MODEL_FIELD_MISSING_VARIABLE_TAG',
      severity: 'warning',
      message: `Field \`${field.name}\` in interface \`${iface.name}\` is missing its \`@dbxModelVariable <name>\` JSDoc tag. The catalog uses the tag for the field's long name — the field's unabbreviated camelCase variable name (e.g. \`uid\` → \`userUid\`, \`n\` → \`name\`).`,
      file: file.name,
      line: field.line,
      model: iface.name
    });
    return;
  }
  if (field.dbxModelVariableTag === field.name && !ignored?.has(field.name)) {
    pushViolation(violations, {
      code: 'MODEL_FIELD_LONG_NAME_EQUALS_NAME',
      severity: 'warning',
      message: `Field \`${field.name}\` in interface \`${iface.name}\` has \`@dbxModelVariable ${field.dbxModelVariableTag}\` matching its short name. The long name should be the field's unabbreviated camelCase variable name (e.g. \`h\` → \`hours\`, \`ub\` → \`usedBudget\`). If the short name is already the unabbreviated form, add \`${field.name}\` to \`modelValidate.ignoredFieldNames\` in \`dbx-mcp.config.json\`.`,
      file: file.name,
      line: field.line,
      model: iface.name
    });
  }
}

// MARK: Field JSDoc + @dbxModelVariable convention (warning)
function checkFieldJsDocs(input: FieldRuleCheckInput): void {
  const { file, violations, options, scope } = input;
  const ignored = options?.ignoredFieldNames;
  for (const iface of file.dataInterfaces) {
    if (scope.restrictToTaggedInterfaces && !(iface.dbxModelTag || iface.dbxModelSubObjectTag)) {
      continue;
    }
    for (const field of iface.fields) {
      const fieldInput: CheckFieldInput = { file, iface, field, ignored, violations };
      checkFieldJsDocDescription(fieldInput);
      checkFieldVariableTag(fieldInput);
    }
  }
}

// MARK: Sub-object interface tag conflict (error)
function checkSubObjectInterfaceTags(file: ExtractedFile, violations: Violation[]): void {
  for (const iface of file.dataInterfaces) {
    if (iface.dbxModelTag && iface.dbxModelSubObjectTag) {
      pushViolation(violations, {
        code: 'MODEL_SUBOBJECT_TAG_CONFLICT',
        message: `Interface \`${iface.name}\` carries both \`@dbxModel\` and \`@dbxModelSubObject\`. Use only \`@dbxModel\` for top-level Firestore models; use \`@dbxModelSubObject\` only for embedded sub-objects without a \`firestoreModelIdentity\`.`,
        file: file.name,
        line: iface.line,
        model: iface.name
      });
    }
  }
}

// MARK: Untagged sub-object factory references (warning, cross-file)
/**
 * Walks each `firestoreSubObject<T> / firestoreObjectArray<T> /
 * firestoreMap<T>` call captured in the file and emits
 * `MODEL_SUBOBJECT_NOT_TAGGED` when the referenced interface `T` is
 * declared in the validated source set but carries neither `@dbxModel`
 * nor `@dbxModelSubObject`.
 *
 * Resolution is name-based via the supplied {@link CrossFileRuleContext}.
 * Type-args that cannot be resolved (e.g. interfaces declared in another
 * package, generic parameters, inline types) are silently skipped — the
 * rule errs on the side of false negatives over false positives.
 *
 * Findings are de-duplicated by interface name across the entire
 * validation run via `context.emittedSubObjectInterfaces`: a single
 * untagged interface referenced from N call-sites produces one warning,
 * anchored at the interface declaration site (not the call site) so the
 * fix lands on the JSDoc block needing the new tag.
 *
 * @param file - the extracted facts for the source file being checked
 * @param violations - the buffer the rule appends violations to
 * @param context - cross-file index + dedup state shared across all files in the validation run; when absent the rule is a no-op
 */
function checkSubObjectFactoryCallSites(file: ExtractedFile, violations: Violation[], context: CrossFileRuleContext | undefined): void {
  if (!context) {
    return;
  }
  if (file.subObjectCalls.length === 0) {
    return;
  }
  for (const call of file.subObjectCalls) {
    const entry = context.interfacesByName.get(call.typeArgName);
    if (!entry) {
      continue;
    }
    const { iface, file: declFile } = entry;
    if (iface.dbxModelTag || iface.dbxModelSubObjectTag) {
      continue;
    }
    if (context.emittedSubObjectInterfaces.has(call.typeArgName)) {
      continue;
    }
    context.emittedSubObjectInterfaces.add(call.typeArgName);
    pushViolation(violations, {
      code: 'MODEL_SUBOBJECT_NOT_TAGGED',
      severity: 'warning',
      message: `Interface \`${iface.name}\` is referenced by \`${call.factoryName}<${iface.name}>(...)\` at ${file.name}:${call.line} but carries neither \`@dbxModel\` nor \`@dbxModelSubObject\`. Tag the interface with \`@dbxModelSubObject\` so its persisted fields are subject to the same \`@dbxModelVariable\` long-name checks as a top-level model.`,
      file: declFile,
      line: iface.line,
      model: iface.name
    });
  }
}

// MARK: Sub-object parent-not-tagged (warning, cross-file)
/**
 * Walks every `@dbxModelSubObject` interface in the file and emits
 * `MODEL_SUBOBJECT_PARENT_NOT_TAGGED` for each parent (named in the
 * `extends` clause) that is not itself tagged with `@dbxModel` or
 * `@dbxModelSubObject`.
 *
 * Resolution is name-based via the supplied {@link CrossFileRuleContext}:
 * - A parent name found in `context.interfacesByName` is **in-package**
 *   (declared in the validated source set).
 * - A parent name not found there is **external** (declared outside the
 *   set — different folder, different package, framework dependency).
 *
 * External parents listed in `options.ignoredExternalParents` are
 * silently skipped — useful for well-known framework plumbing
 * (`IndexRef`, `DateCellRange`, `DateRange`) whose fields don't need
 * surface long-names in the catalog. The suppression never applies to
 * in-package parents.
 *
 * Findings are de-duplicated per `(child, parent)` pair across the
 * validation run via `context.emittedSubObjectInterfaces` so a single
 * parent referenced via the same child only warns once.
 *
 * @param file - the extracted facts for the source file being checked
 * @param violations - the buffer the rule appends violations to
 * @param context - cross-file index + dedup state; when absent the rule is a no-op
 * @param options - rule options carrying `ignoredExternalParents`
 */
interface CheckSubObjectParentInput {
  readonly file: ExtractedFile;
  readonly iface: ExtractedFile['dataInterfaces'][number];
  readonly parentName: string;
  readonly dedupKey: string;
  readonly context: CrossFileRuleContext;
  readonly violations: Violation[];
  readonly ignoredExternal: ReadonlySet<string> | undefined;
}

/**
 * Emits `MODEL_SUBOBJECT_PARENT_NOT_TAGGED` for a parent interface that
 * lives in the validated source set but lacks the `@dbxModel` /
 * `@dbxModelSubObject` JSDoc tag.
 *
 * @param input - the iface + parentName + dedup key + buffers
 * @param entry - the resolved in-package parent interface entry
 */
function emitInPackageParent(input: CheckSubObjectParentInput, entry: CrossFileInterfaceEntry): void {
  const { iface, parentName, dedupKey, context, violations } = input;
  const parent = entry.iface;
  if (parent.dbxModelTag || parent.dbxModelSubObjectTag) return;
  context.emittedSubObjectInterfaces.add(dedupKey);
  pushViolation(violations, {
    code: 'MODEL_SUBOBJECT_PARENT_NOT_TAGGED',
    severity: 'warning',
    message: `Interface \`${parentName}\` is extended by \`@dbxModelSubObject\` \`${iface.name}\`. \`${parentName}\` is declared in the same package (${entry.file}) and its fields are persisted via \`${iface.name}\`'s converter but are not validated. Fix (preferred): add \`@dbxModelSubObject\` to \`${parentName}\`'s JSDoc and tag each persisted field with \`@dbxModelVariable <longName>\`. Alternative: redeclare the inherited fields directly on \`${iface.name}\` with their own JSDoc + tag (useful when \`${parentName}\` is a shared shape that you do not want to commit to a single longName).`,
    file: entry.file,
    line: parent.line,
    model: parentName
  });
}

/**
 * Emits `MODEL_SUBOBJECT_PARENT_NOT_TAGGED` for a parent interface that
 * lives outside the validated source set (and therefore can't be tagged
 * from this package), respecting the `ignoredExternalParents` config.
 *
 * @param input - the iface + parentName + dedup key + buffers + ignored set
 */
function emitExternalParent(input: CheckSubObjectParentInput): void {
  const { file, iface, parentName, dedupKey, context, violations, ignoredExternal } = input;
  if (ignoredExternal?.has(parentName)) return;
  context.emittedSubObjectInterfaces.add(dedupKey);
  pushViolation(violations, {
    code: 'MODEL_SUBOBJECT_PARENT_NOT_TAGGED',
    severity: 'warning',
    message: `Interface \`${parentName}\` is extended by \`@dbxModelSubObject\` \`${iface.name}\`, but \`${parentName}\` is declared outside this package (unresolved in the validated source set). Its persisted fields cannot be tagged from here. Decide: (1) if the inherited fields need explicit longNames in this catalog, redeclare them on \`${iface.name}\` with a JSDoc block carrying \`@dbxModelVariable <longName>\` (the redeclaration is structurally compatible — TypeScript treats it as a field narrowing, not a new property); (2) if the inherited fields are framework plumbing (e.g. \`IndexRef.i\`, \`DateRange.start/end\`) and surface longNames are not needed, suppress this specific warning by adding \`${parentName}\` to \`modelValidate.ignoredExternalParents\` in \`dbx-mcp.config.json\`.`,
    file: file.name,
    line: iface.line,
    model: iface.name
  });
}

interface CheckSubObjectParentNotTaggedInput {
  readonly file: ExtractedFile;
  readonly violations: Violation[];
  readonly context: CrossFileRuleContext | undefined;
  readonly options: RuleOptions | undefined;
}

function checkSubObjectParentNotTagged(input: CheckSubObjectParentNotTaggedInput): void {
  const { file, violations, context, options } = input;
  if (!context) return;
  const ignoredExternal = options?.ignoredExternalParents;
  for (const iface of file.dataInterfaces) {
    if (!iface.dbxModelSubObjectTag) continue;
    for (const parentName of iface.extendsNames) {
      const dedupKey = `${iface.name}<-${parentName}`;
      if (context.emittedSubObjectInterfaces.has(dedupKey)) continue;
      const parentInput: CheckSubObjectParentInput = { file, iface, parentName, dedupKey, context, violations, ignoredExternal };
      const entry = context.interfacesByName.get(parentName);
      if (entry) {
        emitInPackageParent(parentInput, entry);
      } else {
        emitExternalParent(parentInput);
      }
    }
  }
}

// MARK: File-level checks
function checkFileLevel(file: ExtractedFile, violations: Violation[]): void {
  checkGroupInterfaceFileLevel(file, violations);
  checkGroupTypesFileLevel(file, violations);
}

function checkGroupInterfaceFileLevel(file: ExtractedFile, violations: Violation[]): void {
  const { groupInterface, firstModelLine, name } = file;
  if (!groupInterface) {
    pushViolation(violations, {
      code: 'FILE_MISSING_GROUP_INTERFACE',
      message: 'Missing exported `<Group>FirestoreCollections` interface. Declare one interface ending in `FirestoreCollections` before the first model.',
      file: name,
      line: undefined,
      model: undefined
    });
    return;
  }
  if (!groupInterface.exported) {
    pushViolation(violations, {
      code: 'FILE_GROUP_INTERFACE_NOT_EXPORTED',
      message: `Interface \`${groupInterface.name}\` must be exported.`,
      file: name,
      line: groupInterface.line,
      model: undefined
    });
  }
  if (firstModelLine !== undefined && groupInterface.line > firstModelLine) {
    pushViolation(violations, {
      code: 'FILE_GROUP_INTERFACE_AFTER_MODEL',
      message: `Interface \`${groupInterface.name}\` must be declared before the first model (currently at line ${groupInterface.line}; first model at line ${firstModelLine}).`,
      file: name,
      line: groupInterface.line,
      model: undefined
    });
  }
  if (groupInterface.dbxModelGroupTag === undefined) {
    pushViolation(violations, {
      code: 'MODEL_GROUP_INTERFACE_MISSING_TAG',
      message: `Interface \`${groupInterface.name}\` is missing its \`@dbxModelGroup\` JSDoc tag. Add \`@dbxModelGroup <Group>\` so the catalog and downstream traversal can register the group.`,
      file: name,
      line: groupInterface.line,
      model: undefined
    });
  }
  checkGroupInterfaceCoverage(file, violations);
}

function checkGroupTypesFileLevel(file: ExtractedFile, violations: Violation[]): void {
  const { groupTypes, firstModelLine, models, name } = file;
  if (!groupTypes) {
    pushViolation(violations, {
      code: 'FILE_MISSING_GROUP_TYPES',
      message: 'Missing exported `<Group>Types` type alias. Declare a union of `typeof <identity>` covering every model in the file.',
      file: name,
      line: undefined,
      model: undefined
    });
    return;
  }
  if (!groupTypes.exported) {
    pushViolation(violations, {
      code: 'FILE_GROUP_TYPES_NOT_EXPORTED',
      message: `Type alias \`${groupTypes.name}\` must be exported.`,
      file: name,
      line: groupTypes.line,
      model: undefined
    });
  }
  if (firstModelLine !== undefined && groupTypes.line > firstModelLine) {
    pushViolation(violations, {
      code: 'FILE_GROUP_TYPES_AFTER_MODEL',
      message: `Type alias \`${groupTypes.name}\` must be declared before the first model (currently at line ${groupTypes.line}; first model at line ${firstModelLine}).`,
      file: name,
      line: groupTypes.line,
      model: undefined
    });
  }
  checkGroupTypesCoverage(file, models, violations);
}

function checkGroupInterfaceCoverage(file: ExtractedFile, violations: Violation[]): void {
  const iface = file.groupInterface;
  if (!iface) {
    return;
  }
  for (const model of file.models) {
    const expected = expectedInterfaceEntries(model);
    for (const entry of expected) {
      const found = iface.properties.find((p) => p.name === entry.name);
      if (!found) {
        pushViolation(violations, {
          code: 'FILE_GROUP_INTERFACE_MISSING_COLLECTION',
          message: `Interface \`${iface.name}\` is missing entry \`${entry.name}: ${entry.typeText}\` for model ${model.name}.`,
          file: file.name,
          line: iface.line,
          model: model.name
        });
      }
    }
  }
}

interface ExpectedInterfaceEntry {
  readonly name: string;
  readonly typeText: string;
}

function expectedInterfaceEntries(model: ExtractedModel): readonly ExpectedInterfaceEntry[] {
  if (model.variant === 'root') {
    const entry: ExpectedInterfaceEntry = { name: `${model.camelName}Collection`, typeText: `${model.name}FirestoreCollection` };
    return [entry];
  }
  const factoryEntry: ExpectedInterfaceEntry = { name: `${model.camelName}CollectionFactory`, typeText: `${model.name}FirestoreCollectionFactory` };
  const groupEntry: ExpectedInterfaceEntry = { name: `${model.camelName}CollectionGroup`, typeText: `${model.name}FirestoreCollectionGroup` };
  return [factoryEntry, groupEntry];
}

function checkGroupTypesCoverage(file: ExtractedFile, models: readonly ExtractedModel[], violations: Violation[]): void {
  const groupTypes = file.groupTypes;
  if (!groupTypes) {
    return;
  }
  const refsSet = new Set(groupTypes.identityRefs);
  const expectedIdentities = new Set(models.map((m) => m.identity.constName));
  for (const model of models) {
    if (!refsSet.has(model.identity.constName)) {
      pushViolation(violations, {
        code: 'FILE_GROUP_TYPES_MISSING_IDENTITY',
        message: `Type alias \`${groupTypes.name}\` is missing \`typeof ${model.identity.constName}\`.`,
        file: file.name,
        line: groupTypes.line,
        model: model.name
      });
    }
  }
  for (const ref of groupTypes.identityRefs) {
    if (!expectedIdentities.has(ref)) {
      pushViolation(violations, {
        code: 'FILE_GROUP_TYPES_UNKNOWN_IDENTITY',
        message: `Type alias \`${groupTypes.name}\` references \`typeof ${ref}\` but no matching identity is declared in this file.`,
        file: file.name,
        line: groupTypes.line,
        model: undefined
      });
    }
  }
}

// MARK: Identity checks
function checkIdentity(file: ExtractedFile, model: ExtractedModel, violations: Violation[]): void {
  if (!model.identity.exported) {
    pushViolation(violations, {
      code: 'MODEL_IDENTITY_NOT_EXPORTED',
      message: `Identity const \`${model.identity.constName}\` must be exported.`,
      file: file.name,
      line: model.identity.line,
      model: model.name
    });
  }
  if (model.identity.collectionName === '' || model.identity.prefix === '') {
    pushViolation(violations, {
      code: 'MODEL_IDENTITY_BAD_ARGS',
      message: `firestoreModelIdentity call for \`${model.identity.constName}\` must use string literals for the collection name and prefix (and an identity reference for subcollections).`,
      file: file.name,
      line: model.identity.line,
      model: model.name
    });
  }
}

// MARK: Core declarations
function checkCoreDeclarations(file: ExtractedFile, model: ExtractedModel, violations: Violation[]): void {
  checkInterface(file, model, violations);
  checkRoles(file, model, violations);
  checkDocumentClass(file, model, violations);
  checkConverter(file, model, violations);
  checkCollectionReferenceFn(file, model, violations);
  checkCollectionType(file, model, violations);
  checkCollectionFn(file, model, violations);
}

function checkInterface(file: ExtractedFile, model: ExtractedModel, violations: Violation[]): void {
  if (!model.iface) {
    pushViolation(violations, {
      code: 'MODEL_MISSING_INTERFACE',
      message: `Missing exported interface \`${model.name}\`.`,
      file: file.name,
      line: model.identity.line,
      model: model.name
    });
    return;
  }
  if (!model.iface.exported) {
    pushViolation(violations, {
      code: 'MODEL_INTERFACE_NOT_EXPORTED',
      message: `Interface \`${model.name}\` must be exported.`,
      file: file.name,
      line: model.iface.line,
      model: model.name
    });
  }
  const dataInterface = file.dataInterfaces.find((d) => d.name === model.name);
  if (dataInterface && !dataInterface.dbxModelTag) {
    pushViolation(violations, {
      code: 'MODEL_INTERFACE_MISSING_TAG',
      message: `Interface \`${model.name}\` is missing its \`@dbxModel\` JSDoc tag. The catalog skips untagged interfaces, so downstream traversal/referencing of \`${model.name}\` is broken.`,
      file: file.name,
      line: dataInterface.line,
      model: model.name
    });
    pushViolation(violations, {
      code: 'MODEL_IDENTITY_NOT_TAGGED',
      message: `\`firestoreModelIdentity\` was found for \`${model.identity.constName}\` but its \`${model.name}\` interface is not tagged with \`@dbxModel\`. Tag the interface so the catalog registers the model.`,
      file: file.name,
      line: model.identity.line,
      model: model.name
    });
  }
}

function checkRoles(file: ExtractedFile, model: ExtractedModel, violations: Violation[]): void {
  if (!model.rolesType) {
    pushViolation(violations, {
      code: 'MODEL_MISSING_ROLES',
      message: `Missing exported type alias \`${model.name}Roles\`. Declare at minimum \`export type ${model.name}Roles = GrantedReadRole;\`.`,
      file: file.name,
      line: model.identity.line,
      model: model.name
    });
    return;
  }
  if (!model.rolesType.exported) {
    pushViolation(violations, {
      code: 'MODEL_ROLES_NOT_EXPORTED',
      message: `Type alias \`${model.name}Roles\` must be exported.`,
      file: file.name,
      line: model.rolesType.line,
      model: model.name
    });
  }
}

function checkDocumentClass(file: ExtractedFile, model: ExtractedModel, violations: Violation[]): void {
  const doc = model.documentClass;
  if (!doc) {
    pushViolation(violations, {
      code: 'MODEL_MISSING_DOCUMENT_CLASS',
      message: `Missing exported class \`${model.name}Document\`.`,
      file: file.name,
      line: model.identity.line,
      model: model.name
    });
    return;
  }
  if (!doc.exported) {
    pushViolation(violations, {
      code: 'MODEL_DOCUMENT_CLASS_NOT_EXPORTED',
      message: `Class \`${model.name}Document\` must be exported.`,
      file: file.name,
      line: doc.line,
      model: model.name
    });
  }

  const expectedBase = model.variant === 'root' ? 'AbstractFirestoreDocument' : 'AbstractFirestoreDocumentWithParent';
  if (doc.baseClass !== expectedBase) {
    pushViolation(violations, {
      code: 'MODEL_DOCUMENT_WRONG_BASE_CLASS',
      message: `Class \`${model.name}Document\` must extend \`${expectedBase}\` (found \`${doc.baseClass || '<none>'}\`).`,
      file: file.name,
      line: doc.line,
      model: model.name
    });
  }

  const parentPascal = model.variant === 'subcollection' && model.identity.parentIdentityRef ? pascalCase(deriveCamelName(model.identity.parentIdentityRef)) : undefined;
  const expectedArgs = model.variant === 'root' ? [model.name, `${model.name}Document`, `typeof ${model.identity.constName}`] : [parentPascal ?? '<parent>', model.name, `${model.name}Document`, `typeof ${model.identity.constName}`];
  if (!typeArgsMatch(doc.typeArgs, expectedArgs)) {
    pushViolation(violations, {
      code: 'MODEL_DOCUMENT_BAD_TYPE_ARGS',
      message: `Class \`${model.name}Document\` must extend \`${expectedBase}<${expectedArgs.join(', ')}>\`. Found type args: \`${doc.typeArgs.join(', ') || '<none>'}\`.`,
      file: file.name,
      line: doc.line,
      model: model.name
    });
  }

  if (!doc.hasModelIdentityGetter) {
    pushViolation(violations, {
      code: 'MODEL_DOCUMENT_MISSING_IDENTITY_GETTER',
      message: `Class \`${model.name}Document\` must declare \`get modelIdentity() { return ${model.identity.constName}; }\`.`,
      file: file.name,
      line: doc.line,
      model: model.name
    });
    return;
  }
  if (doc.modelIdentityReturn !== model.identity.constName) {
    pushViolation(violations, {
      code: 'MODEL_DOCUMENT_WRONG_IDENTITY_GETTER',
      message: `Getter \`modelIdentity\` in \`${model.name}Document\` must return \`${model.identity.constName}\` (found \`${doc.modelIdentityReturn ?? '<none>'}\`).`,
      file: file.name,
      line: doc.line,
      model: model.name
    });
  }
}

function checkConverter(file: ExtractedFile, model: ExtractedModel, violations: Violation[]): void {
  if (!model.converter) {
    pushViolation(violations, {
      code: 'MODEL_MISSING_CONVERTER',
      message: `Missing exported const \`${model.camelName}Converter\` (snapshotConverterFunctions<${model.name}>({ fields: {...} })).`,
      file: file.name,
      line: model.identity.line,
      model: model.name
    });
    return;
  }
  if (!model.converter.exported) {
    pushViolation(violations, {
      code: 'MODEL_CONVERTER_NOT_EXPORTED',
      message: `Const \`${model.camelName}Converter\` must be exported.`,
      file: file.name,
      line: model.converter.line,
      model: model.name
    });
  }
}

function checkCollectionReferenceFn(file: ExtractedFile, model: ExtractedModel, violations: Violation[]): void {
  if (model.referenceFn) {
    return;
  }
  const expectedName = model.variant === 'root' ? `${model.camelName}CollectionReference` : `${model.camelName}CollectionReferenceFactory`;
  const expectedSig = model.variant === 'root' ? `(context: FirestoreContext): CollectionReference<${model.name}>` : `(context: FirestoreContext): (parent: ${pascalCase(deriveCamelName(model.identity.parentIdentityRef ?? ''))}Document) => CollectionReference<${model.name}>`;
  pushViolation(violations, {
    code: 'MODEL_MISSING_COLLECTION_REFERENCE',
    message: `Missing exported function \`${expectedName}${expectedSig}\`.`,
    file: file.name,
    line: model.identity.line,
    model: model.name
  });
}

function checkCollectionType(file: ExtractedFile, model: ExtractedModel, violations: Violation[]): void {
  if (!model.collectionType) {
    pushViolation(violations, {
      code: 'MODEL_MISSING_COLLECTION_TYPE',
      message: `Missing exported type alias \`${model.name}FirestoreCollection\`.`,
      file: file.name,
      line: model.identity.line,
      model: model.name
    });
    return;
  }
  const typeText = model.collectionType.typeText ?? '';
  const allowedKinds: readonly FirestoreCollectionKind[] = model.variant === 'root' ? ['root', 'root-singleton'] : ['sub-collection', 'singleton-sub'];
  const aliasKind = detectAliasKind(typeText);
  const factoryKind = model.factoryCallKind;

  // Mismatch: alias and factory body each pick a recognised kind, but they disagree.
  if (aliasKind && factoryKind && aliasKind !== factoryKind) {
    pushViolation(violations, {
      code: 'MODEL_COLLECTION_FACTORY_TYPE_MISMATCH',
      message: `Type alias \`${model.name}FirestoreCollection\` is \`${COLLECTION_TYPE_NAME[aliasKind]}\` but factory \`${expectedCollectionFnName(model)}\` calls \`firestoreContext.${COLLECTION_FACTORY_FN_NAME[factoryKind]}({...})\`. Type alias and factory body must declare the same collection kind (\`${aliasKind}\` vs \`${factoryKind}\`).`,
      file: file.name,
      line: model.collectionType.line,
      model: model.name
    });
    return;
  }

  // Either kind disagrees with the parent-identity-derived variant — e.g. a
  // model with a parent identity declared with a root collection type.
  const isAllowed = (k: FirestoreCollectionKind | undefined): boolean => k === undefined || allowedKinds.includes(k);
  if (!isAllowed(aliasKind) || !isAllowed(factoryKind)) {
    const offender = isAllowed(aliasKind) ? factoryKind : aliasKind;
    const offenderSite = isAllowed(aliasKind) ? 'factory body' : 'type alias';
    const variantLabel = model.variant === 'root' ? 'root (no parent identity)' : 'subcollection (parent identity declared)';
    const allowedList = allowedKinds.map((k) => `\`${k}\``).join(', ');
    pushViolation(violations, {
      code: 'MODEL_COLLECTION_FACTORY_TYPE_MISMATCH',
      message: `Model \`${model.name}\` is a ${variantLabel} but its collection ${offenderSite} is \`${offender}\`. Allowed kinds for this variant: ${allowedList}.`,
      file: file.name,
      line: model.collectionType.line,
      model: model.name
    });
    return;
  }

  // Pick the expected kind: alias if known (author's declared intent), else
  // factory body, else the variant default — `'root'` and `'singleton-sub'`
  // preserve the original validator behaviour.
  const defaultKind: FirestoreCollectionKind = model.variant === 'root' ? 'root' : 'singleton-sub';
  const expectedKind: FirestoreCollectionKind = aliasKind ?? factoryKind ?? defaultKind;
  const expected = expectedCollectionTypeText(expectedKind, model);
  if (typeText.replaceAll(/\s+/g, '') !== expected.replaceAll(/\s+/g, '')) {
    pushViolation(violations, {
      code: 'MODEL_COLLECTION_TYPE_WRONG_GENERIC',
      message: `Type alias \`${model.name}FirestoreCollection\` must equal \`${expected}\` (found \`${typeText || '<none>'}\`).`,
      file: file.name,
      line: model.collectionType.line,
      model: model.name
    });
  }
}

/**
 * Type-alias name for each collection kind (constructor written in the
 * `<Model>FirestoreCollection = ...` right-hand side).
 */
const COLLECTION_TYPE_NAME: Record<FirestoreCollectionKind, string> = {
  root: 'FirestoreCollection',
  'root-singleton': 'RootSingleItemFirestoreCollection',
  'sub-collection': 'FirestoreCollectionWithParent',
  'singleton-sub': 'SingleItemFirestoreCollection'
};

/**
 * `firestoreContext.*` method name each collection kind should call inside
 * its factory function body.
 */
const COLLECTION_FACTORY_FN_NAME: Record<FirestoreCollectionKind, string> = {
  root: 'firestoreCollection',
  'root-singleton': 'rootSingleItemFirestoreCollection',
  'sub-collection': 'firestoreCollectionWithParent',
  'singleton-sub': 'singleItemFirestoreCollection'
};

/**
 * Detects which {@link FirestoreCollectionKind} a type alias declares by
 * looking at its leading constructor name. Generic arguments are validated
 * separately.
 *
 * Order matters here because `SingleItemFirestoreCollection` and
 * `RootSingleItemFirestoreCollection` overlap on substring — the longer one
 * is checked first.
 *
 * @param typeText - the type alias right-hand side as written in the source
 * @returns the matched kind, or `undefined` when no recognised constructor leads the expression
 */
function detectAliasKind(typeText: string): FirestoreCollectionKind | undefined {
  const normalized = typeText.replaceAll(/\s+/g, '');
  if (normalized.startsWith('RootSingleItemFirestoreCollection<')) {
    return 'root-singleton';
  }
  if (normalized.startsWith('SingleItemFirestoreCollection<')) {
    return 'singleton-sub';
  }
  if (normalized.startsWith('FirestoreCollectionWithParent<')) {
    return 'sub-collection';
  }
  if (normalized.startsWith('FirestoreCollection<')) {
    return 'root';
  }
  return undefined;
}

/**
 * Builds the canonical type-alias text for a given kind — used both as the
 * source-of-truth for validation and in error messages.
 *
 * @param kind - the collection kind whose canonical alias text to render
 * @param model - the extracted model providing names + parent identity for generic args
 * @returns the canonical right-hand side of `<Model>FirestoreCollection = ...`
 */
function expectedCollectionTypeText(kind: FirestoreCollectionKind, model: ExtractedModel): string {
  const ctor = COLLECTION_TYPE_NAME[kind];
  if (kind === 'root' || kind === 'root-singleton') {
    return `${ctor}<${model.name}, ${model.name}Document>`;
  }
  const parentPascal = pascalCase(deriveCamelName(model.identity.parentIdentityRef ?? ''));
  return `${ctor}<${model.name}, ${parentPascal}, ${model.name}Document, ${parentPascal}Document>`;
}

function expectedCollectionFnName(model: ExtractedModel): string {
  return model.variant === 'root' ? `${model.camelName}FirestoreCollection` : `${model.camelName}FirestoreCollectionFactory`;
}

function checkCollectionFn(file: ExtractedFile, model: ExtractedModel, violations: Violation[]): void {
  if (model.collectionFn) {
    return;
  }
  const expectedName = model.variant === 'root' ? `${model.camelName}FirestoreCollection` : `${model.camelName}FirestoreCollectionFactory`;
  pushViolation(violations, {
    code: 'MODEL_MISSING_COLLECTION_FN',
    message: `Missing exported function \`${expectedName}\`.`,
    file: file.name,
    line: model.identity.line,
    model: model.name
  });
}

// MARK: Subcollection extras
function checkSubcollectionExtras(file: ExtractedFile, model: ExtractedModel, violations: Violation[]): void {
  if (!model.collectionFactoryType) {
    pushViolation(violations, {
      code: 'SUB_MISSING_COLLECTION_FACTORY_TYPE',
      message: `Missing exported type alias \`${model.name}FirestoreCollectionFactory = (parent: ${pascalCase(deriveCamelName(model.identity.parentIdentityRef ?? ''))}Document) => ${model.name}FirestoreCollection\`.`,
      file: file.name,
      line: model.identity.line,
      model: model.name
    });
  }
  if (!model.referenceGroupFn) {
    pushViolation(violations, {
      code: 'SUB_MISSING_COLLECTION_GROUP_REFERENCE',
      message: `Missing exported function \`${model.camelName}CollectionReference(context: FirestoreContext): CollectionGroup<${model.name}>\`.`,
      file: file.name,
      line: model.identity.line,
      model: model.name
    });
  }
  if (!model.collectionGroupType) {
    pushViolation(violations, {
      code: 'SUB_MISSING_COLLECTION_GROUP_TYPE',
      message: `Missing exported type alias \`${model.name}FirestoreCollectionGroup = FirestoreCollectionGroup<${model.name}, ${model.name}Document>\`.`,
      file: file.name,
      line: model.identity.line,
      model: model.name
    });
  }
  if (!model.collectionGroupFn) {
    pushViolation(violations, {
      code: 'SUB_MISSING_COLLECTION_GROUP_FN',
      message: `Missing exported function \`${model.camelName}FirestoreCollectionGroup\` returning \`${model.name}FirestoreCollectionGroup\`.`,
      file: file.name,
      line: model.identity.line,
      model: model.name
    });
  }
}

// MARK: Declaration order
function checkDeclarationOrder(file: ExtractedFile, model: ExtractedModel, violations: Violation[]): void {
  const sequence = model.variant === 'root' ? ROOT_MODEL_ORDER : SUBCOLLECTION_MODEL_ORDER;
  const positions: { kind: DeclarationKind; line: number }[] = [];
  for (const kind of sequence) {
    const line = declarationLine(model, kind);
    if (line !== undefined) {
      positions.push({ kind, line });
    }
  }
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];
    if (curr.line < prev.line) {
      pushViolation(violations, {
        code: 'MODEL_OUT_OF_ORDER',
        message: `Declaration \`${curr.kind}\` (line ${curr.line}) must come after \`${prev.kind}\` (line ${prev.line}). Expected order: ${sequence.join(' → ')}.`,
        file: file.name,
        line: curr.line,
        model: model.name
      });
      return;
    }
  }
}

function declarationLine(model: ExtractedModel, kind: DeclarationKind): number | undefined {
  switch (kind) {
    case 'identity':
      return model.identity.line;
    case 'interface':
      return model.iface?.line;
    case 'rolesType':
      return model.rolesType?.line;
    case 'documentClass':
      return model.documentClass?.line;
    case 'converter':
      return model.converter?.line;
    case 'referenceFn':
      return model.referenceFn?.line;
    case 'collectionType':
      return model.collectionType?.line;
    case 'collectionFactoryType':
      return model.collectionFactoryType?.line;
    case 'collectionFn':
      return model.collectionFn?.line;
    case 'referenceGroupFn':
      return model.referenceGroupFn?.line;
    case 'collectionGroupType':
      return model.collectionGroupType?.line;
    case 'collectionGroupFn':
      return model.collectionGroupFn?.line;
  }
}

// MARK: Composite-key tag
/**
 * Per-file rules that fire on `@dbxModelCompositeKey` tags:
 *
 * - `MODEL_COMPOSITE_KEY_MISSING_FROM` — tag present but `from=` was not
 *   supplied (or resolved to an empty list after filtering).
 * - `MODEL_COMPOSITE_KEY_WILDCARD_MIXED` — `*` mixed with concrete entries.
 * - `MODEL_COMPOSITE_KEY_INVALID_ENCODING` — `encoding=` missing or not
 *   `two-way` / `one-way`.
 * - `MODEL_COMPOSITE_KEY_WITHOUT_ARCHETYPE` (warning) — tag applied to an
 *   interface not tagged with `composite-key-root` or
 *   `denormalised-aggregate keying=composite-flat-key`.
 *
 * Cross-manifest resolution of concrete `from=` entries
 * (`MODEL_COMPOSITE_KEY_UNKNOWN_MODEL`) runs as a manifest-level rule in
 * `manifest-rules.ts` — the per-file pass cannot see other packages.
 *
 * @param file - the extracted file
 * @param violations - the mutable violation buffer
 */
function checkCompositeKeyTags(file: ExtractedFile, violations: Violation[]): void {
  for (const iface of file.dataInterfaces) {
    const tag = iface.dbxModelCompositeKeyTag;
    if (tag === undefined) continue;
    const fromIsWildcard = tag.from === '*';
    const fromList = Array.isArray(tag.from) ? tag.from : [];
    const fromIsMissing = !fromIsWildcard && fromList.length === 0;
    const fromMixesWildcard = !fromIsWildcard && fromList.includes('*');
    if (fromIsMissing) {
      pushViolation(violations, {
        code: 'MODEL_COMPOSITE_KEY_MISSING_FROM',
        message: `Interface \`${iface.name}\` has \`@dbxModelCompositeKey\` without a \`from=\` argument. Declare either a concrete list (\`from=ModelA,ModelB\`) or the wildcard form (\`from=*\`).`,
        file: file.name,
        line: tag.line,
        model: iface.name
      });
    }
    if (fromMixesWildcard) {
      pushViolation(violations, {
        code: 'MODEL_COMPOSITE_KEY_WILDCARD_MIXED',
        message: `Interface \`${iface.name}\` mixes \`*\` with concrete model names in \`@dbxModelCompositeKey from=\`. The wildcard is exclusive — use \`from=*\` for framework models, or enumerate every contributing model.`,
        file: file.name,
        line: tag.line,
        model: iface.name
      });
    }
    if (tag.encoding === undefined) {
      pushViolation(violations, {
        code: 'MODEL_COMPOSITE_KEY_INVALID_ENCODING',
        message: `Interface \`${iface.name}\` has \`@dbxModelCompositeKey\` without a valid \`encoding=\` argument. Allowed values: \`two-way\` (round-trips via \`inferKeyFromTwoWayFlatFirestoreModelKey\`) or \`one-way\` (slashes stripped, not recoverable).`,
        file: file.name,
        line: tag.line,
        model: iface.name
      });
    }
    if (!hasMatchingCompositeKeyArchetype(iface.dbxModelArchetypeTags)) {
      pushViolation(violations, {
        severity: 'warning',
        code: 'MODEL_COMPOSITE_KEY_WITHOUT_ARCHETYPE',
        message: `Interface \`${iface.name}\` carries \`@dbxModelCompositeKey\` but no archetype tag justifies the composite-flat-key shape. Add \`@dbxModelArchetype composite-key-root\`, or \`@dbxModelArchetype denormalised-aggregate keying=composite-flat-key\` when the doc is a projection.`,
        file: file.name,
        line: tag.line,
        model: iface.name
      });
    }
  }
}

function hasMatchingCompositeKeyArchetype(tags: readonly { readonly slug: string; readonly axes: { readonly [key: string]: string } }[]): boolean {
  let matched = false;
  for (const t of tags) {
    if (t.slug === 'composite-key-root') {
      matched = true;
      break;
    }
    if (t.slug === 'denormalised-aggregate' && t.axes['keying'] === 'composite-flat-key') {
      matched = true;
      break;
    }
  }
  return matched;
}

// MARK: Helpers
/**
 * Accepts violations with an optional `severity` to keep the majority of
 * call sites (all hard-error rules) terse — defaults to `'error'`.
 *
 * @param buffer - the mutable violation buffer the rule is appending to
 * @param violation - the violation payload, with severity defaulting to `'error'`
 */
function pushViolation(buffer: Violation[], violation: Omit<Violation, 'severity' | 'remediation'> & { readonly severity?: ViolationSeverity }): void {
  const severity: ViolationSeverity = violation.severity ?? 'error';
  const filled: Violation = {
    code: violation.code,
    severity,
    message: violation.message,
    file: violation.file,
    line: violation.line,
    model: violation.model,
    remediation: attachRemediation(violation.code)
  };
  buffer.push(filled);
}

function typeArgsMatch(found: readonly string[], expected: readonly string[]): boolean {
  if (found.length !== expected.length) {
    return false;
  }
  for (const [i, element] of found.entries()) {
    if (element.replaceAll(/\s+/g, '') !== expected[i].replaceAll(/\s+/g, '')) {
      return false;
    }
  }
  return true;
}

function deriveCamelName(constName: string): string {
  const suffix = 'Identity';
  return constName.endsWith(suffix) ? constName.slice(0, -suffix.length) : constName;
}

function pascalCase(camel: string): string {
  if (camel.length === 0) {
    return camel;
  }
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}
