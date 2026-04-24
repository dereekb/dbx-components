/**
 * Validation rules run against an {@link ExtractedFile}. Rules accumulate
 * {@link Violation}s into a mutable buffer; the public entry point is
 * {@link validateExtracted} in `./index.ts`.
 *
 * All rules emit hard errors. Callers are expected to fix the source and
 * re-run rather than silence individual codes.
 */

import { MAX_FIELD_NAME_LENGTH, ROOT_MODEL_ORDER, SUBCOLLECTION_MODEL_ORDER, type DeclarationKind, type ExtractedFile, type ExtractedModel, type Violation, type ViolationSeverity } from './types.js';

// MARK: Entry
export function runRules(file: ExtractedFile): readonly Violation[] {
  const violations: Violation[] = [];
  if (file.models.length === 0) {
    // Files without any firestoreModelIdentity calls are not subject to
    // model-group rules — the validator assumes the caller passed in a
    // non-model file by accident. Keep the pass silent.
    return violations;
  }
  checkFileLevel(file, violations);
  for (const model of file.models) {
    checkIdentity(file, model, violations);
    checkCoreDeclarations(file, model, violations);
    if (model.variant === 'subcollection') {
      checkSubcollectionExtras(file, model, violations);
    }
    checkDeclarationOrder(file, model, violations);
  }
  checkFieldNameLengths(file, violations);
  return violations;
}

// MARK: Field-name length (warning)
function checkFieldNameLengths(file: ExtractedFile, violations: Violation[]): void {
  for (const iface of file.dataInterfaces) {
    for (const field of iface.fields) {
      if (field.name.length <= MAX_FIELD_NAME_LENGTH) {
        continue;
      }
      pushViolation(violations, {
        code: 'MODEL_FIELD_NAME_TOO_LONG',
        severity: 'warning',
        message: `Field \`${field.name}\` in interface \`${iface.name}\` is ${field.name.length} characters (limit ${MAX_FIELD_NAME_LENGTH}). Firestore field names should be short to minimize document size.`,
        file: file.name,
        line: field.line,
        model: iface.name
      });
    }
  }
  checkFieldJsDocs(file, violations);
}

// MARK: Field JSDoc + full-name convention (warning)
/**
 * Matches the opening "FullName — description" pattern. The full name must
 * start with an uppercase letter and consist of letters/digits, followed by
 * a separator (`--`, em dash, en dash, single dash, or colon) surrounded by
 * whitespace, then at least one non-space character.
 */
const FULL_NAME_FIRST_LINE = /^[A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*)*\s*(?:--|—|–|-|:)\s+\S/;

function checkFieldJsDocs(file: ExtractedFile, violations: Violation[]): void {
  for (const iface of file.dataInterfaces) {
    for (const field of iface.fields) {
      if (!field.jsDocFirstLine) {
        pushViolation(violations, {
          code: 'MODEL_FIELD_MISSING_JSDOC',
          severity: 'warning',
          message: `Field \`${field.name}\` in interface \`${iface.name}\` is missing a JSDoc comment. First line should be \`<FullName> -- <description>\` (for example \`/** SyncFlag -- the sync flag. */\`).`,
          file: file.name,
          line: field.line,
          model: iface.name
        });
        continue;
      }
      if (!FULL_NAME_FIRST_LINE.test(field.jsDocFirstLine)) {
        pushViolation(violations, {
          code: 'MODEL_FIELD_JSDOC_NO_FULL_NAME',
          severity: 'warning',
          message: `JSDoc on field \`${field.name}\` in interface \`${iface.name}\` should start with \`<FullName> -- <description>\` (found: \`${field.jsDocFirstLine}\`). Supported separators: \`--\`, \`—\`, \`–\`, \`-\`, \`:\`.`,
          file: file.name,
          line: field.line,
          model: iface.name
        });
      }
    }
  }
}

// MARK: File-level checks
function checkFileLevel(file: ExtractedFile, violations: Violation[]): void {
  const { groupInterface, groupTypes, firstModelLine, models, name } = file;

  if (!groupInterface) {
    pushViolation(violations, {
      code: 'FILE_MISSING_GROUP_INTERFACE',
      message: 'Missing exported `<Group>FirestoreCollections` interface. Declare one interface ending in `FirestoreCollections` before the first model.',
      file: name,
      line: undefined,
      model: undefined
    });
  } else {
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
    checkGroupInterfaceCoverage(file, violations);
  }

  if (!groupTypes) {
    pushViolation(violations, {
      code: 'FILE_MISSING_GROUP_TYPES',
      message: 'Missing exported `<Group>Types` type alias. Declare a union of `typeof <identity>` covering every model in the file.',
      file: name,
      line: undefined,
      model: undefined
    });
  } else {
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
  if (model.variant === 'root') {
    const expected = `FirestoreCollection<${model.name}, ${model.name}Document>`;
    if (typeText.replace(/\s+/g, '') !== expected.replace(/\s+/g, '')) {
      pushViolation(violations, {
        code: 'MODEL_COLLECTION_TYPE_WRONG_GENERIC',
        message: `Type alias \`${model.name}FirestoreCollection\` must equal \`${expected}\` (found \`${typeText || '<none>'}\`).`,
        file: file.name,
        line: model.collectionType.line,
        model: model.name
      });
    }
    return;
  }
  const parentPascal = pascalCase(deriveCamelName(model.identity.parentIdentityRef ?? ''));
  const expected = `SingleItemFirestoreCollection<${model.name}, ${parentPascal}, ${model.name}Document, ${parentPascal}Document>`;
  if (typeText.replace(/\s+/g, '') !== expected.replace(/\s+/g, '')) {
    pushViolation(violations, {
      code: 'MODEL_COLLECTION_TYPE_WRONG_GENERIC',
      message: `Type alias \`${model.name}FirestoreCollection\` must equal \`${expected}\` (found \`${typeText || '<none>'}\`).`,
      file: file.name,
      line: model.collectionType.line,
      model: model.name
    });
  }
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

// MARK: Helpers
/**
 * Accepts violations with an optional `severity` to keep the majority of
 * call sites (all hard-error rules) terse — defaults to `'error'`.
 */
function pushViolation(buffer: Violation[], violation: Omit<Violation, 'severity'> & { readonly severity?: ViolationSeverity }): void {
  const severity: ViolationSeverity = violation.severity ?? 'error';
  const filled: Violation = {
    code: violation.code,
    severity,
    message: violation.message,
    file: violation.file,
    line: violation.line,
    model: violation.model
  };
  buffer.push(filled);
}

function typeArgsMatch(found: readonly string[], expected: readonly string[]): boolean {
  if (found.length !== expected.length) {
    return false;
  }
  for (let i = 0; i < found.length; i++) {
    if (found[i].replace(/\s+/g, '') !== expected[i].replace(/\s+/g, '')) {
      return false;
    }
  }
  return true;
}

function deriveCamelName(constName: string): string {
  const suffix = 'Identity';
  const base = constName.endsWith(suffix) ? constName.slice(0, -suffix.length) : constName;
  return base;
}

function pascalCase(camel: string): string {
  if (camel.length === 0) {
    return camel;
  }
  const result = camel.charAt(0).toUpperCase() + camel.slice(1);
  return result;
}
