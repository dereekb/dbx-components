/**
 * AST extraction for `dbx_validate_firebase_model`.
 *
 * Parses one TypeScript source file with ts-morph and emits a normalized
 * {@link ExtractedFile} structure — file-level `*FirestoreCollections`
 * interface and `*Types` union plus one {@link ExtractedModel} per
 * `firestoreModelIdentity(...)` call. Pure syntactic analysis; no type
 * resolution needed, so a lightweight in-memory Project is sufficient.
 */

import { Node, Project, SyntaxKind, type ClassDeclaration, type GetAccessorDeclaration, type InterfaceDeclaration, type JSDoc, type SourceFile, type TypeAliasDeclaration } from 'ts-morph';
import type { ExtractedDataInterface, ExtractedDecl, ExtractedDocumentClass, ExtractedField, ExtractedFile, ExtractedGroupInterface, ExtractedGroupTypes, ExtractedIdentity, ExtractedModel, FirestoreCollectionKind, ModelVariant, ValidatorSource } from './types.js';

// MARK: Entry
/**
 * Parses a single model source via ts-morph and returns the normalised facts
 * the rules module consumes. Extraction stays best-effort so partial files
 * still produce useful diagnostics rather than crashing the validator.
 *
 * @param source - the in-memory source name + text pair to extract
 * @returns the structured extraction used by the rules layer
 */
export function extractFile(source: ValidatorSource): ExtractedFile {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(source.name, source.text, { overwrite: true });

  const groupInterface = findGroupInterface(sourceFile);
  const groupTypes = findGroupTypes(sourceFile);
  const identities = findIdentities(sourceFile);
  const firstModelLine = identities.length > 0 ? Math.min(...identities.map((i) => i.line)) : undefined;
  const models = identities.map((identity) => extractModel(sourceFile, identity));
  const dataInterfaces = findDataInterfaces(sourceFile, groupInterface);

  const result: ExtractedFile = {
    name: source.name,
    groupInterface,
    groupTypes,
    firstModelLine,
    models,
    dataInterfaces
  };
  return result;
}

// MARK: Data interfaces (for field-name warnings)
function findDataInterfaces(sourceFile: SourceFile, groupInterface: ExtractedGroupInterface | undefined): readonly ExtractedDataInterface[] {
  const out: ExtractedDataInterface[] = [];
  const groupName = groupInterface?.name;
  for (const iface of sourceFile.getInterfaces()) {
    const name = iface.getName();
    if (name === groupName) {
      continue;
    }
    const fields = extractInterfaceFields(iface);
    const dbxModelTag = readDbxModelTag(iface.getJsDocs());
    out.push({ name, line: iface.getStartLineNumber(), dbxModelTag, fields });
  }
  return out;
}

function extractInterfaceFields(iface: InterfaceDeclaration): readonly ExtractedField[] {
  const fields: ExtractedField[] = [];
  for (const prop of iface.getProperties()) {
    const jsDocs = prop.getJsDocs();
    const jsDocFirstLine = firstJsDocLine(jsDocs);
    const dbxModelVariableTag = readDbxModelVariableTag(jsDocs);
    const field: ExtractedField = { name: prop.getName(), line: prop.getStartLineNumber(), jsDocFirstLine, dbxModelVariableTag };
    fields.push(field);
  }
  return fields;
}

function firstJsDocLine(jsDocs: readonly { getDescription(): string }[]): string | undefined {
  for (const jsDoc of jsDocs) {
    const description = jsDoc.getDescription();
    const lines = description.split('\n');
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return undefined;
}

// MARK: File-level
function findGroupInterface(sourceFile: SourceFile): ExtractedGroupInterface | undefined {
  const candidate = sourceFile.getInterfaces().find((i) => i.getName().endsWith('FirestoreCollections'));
  const iface = candidate;
  if (!iface) {
    return undefined;
  }
  const properties = iface.getProperties().map((p) => {
    const typeNode = p.getTypeNode();
    const typeText = typeNode ? typeNode.getText() : '';
    return { name: p.getName(), typeText };
  });
  const result: ExtractedGroupInterface = {
    name: iface.getName(),
    exported: iface.isExported(),
    properties,
    line: iface.getStartLineNumber(),
    dbxModelGroupTag: readDbxModelGroupTag(iface.getJsDocs())
  };
  return result;
}

// MARK: JSDoc tag helpers
/**
 * Reads the `@dbxModelGroup [Name]` tag off a JSDoc block. Returns the
 * trimmed tag text when an explicit group name is supplied, `true` for a
 * bare `@dbxModelGroup` marker, and `undefined` when the tag is absent.
 *
 * Mirrors `scan/extract-models/find-model-groups.ts` so the validator and
 * the rich catalog extractor agree on what counts as a tagged group.
 *
 * @param jsDocs - JSDoc blocks attached to the group container declaration
 * @returns the tag value, or `undefined` when no `@dbxModelGroup` tag is present
 */
function readDbxModelGroupTag(jsDocs: readonly JSDoc[]): string | true | undefined {
  let result: string | true | undefined;
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      if (tag.getTagName() !== 'dbxModelGroup') continue;
      const text = tag.getCommentText()?.trim() ?? '';
      result = text.length > 0 ? text : true;
    }
  }
  return result;
}

/**
 * Reads the `@dbxModel` flag off a JSDoc block. Returns `true` when the
 * tag is present (regardless of any inline argument); `false` otherwise.
 *
 * Mirrors `scan/extract-models/find-interfaces.ts` so a downstream model
 * interface that the catalog would skip is also flagged here.
 *
 * @param jsDocs - JSDoc blocks attached to the data interface declaration
 * @returns `true` when `@dbxModel` is present, otherwise `false`
 */
function readDbxModelTag(jsDocs: readonly JSDoc[]): boolean {
  let result = false;
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      if (tag.getTagName() === 'dbxModel') {
        result = true;
      }
    }
  }
  return result;
}

/**
 * Reads the `@dbxModelVariable <name>` long-name tag off a JSDoc block.
 * Returns the trimmed tag text when present and non-empty; `undefined`
 * otherwise (matching the rich extractor's "first non-empty wins" rule).
 *
 * @param jsDocs - JSDoc blocks attached to the property declaration
 * @returns the long-name string, or `undefined` when no `@dbxModelVariable` tag is present
 */
function readDbxModelVariableTag(jsDocs: readonly JSDoc[]): string | undefined {
  let result: string | undefined;
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      if (tag.getTagName() !== 'dbxModelVariable') continue;
      const text = tag.getCommentText()?.trim();
      if (text !== undefined && text.length > 0 && result === undefined) {
        result = text;
      }
    }
  }
  return result;
}

function findGroupTypes(sourceFile: SourceFile): ExtractedGroupTypes | undefined {
  const candidate = sourceFile.getTypeAliases().find((t) => {
    const name = t.getName();
    const endsWithTypes = name.endsWith('Types');
    const isNotFirestoreCollections = !name.endsWith('FirestoreCollections');
    return endsWithTypes && isNotFirestoreCollections;
  });
  const alias = candidate;
  if (!alias) {
    return undefined;
  }
  const identityRefs = extractIdentityRefs(alias);
  const result: ExtractedGroupTypes = {
    name: alias.getName(),
    exported: alias.isExported(),
    identityRefs,
    line: alias.getStartLineNumber()
  };
  return result;
}

/**
 * Pulls `X` out of each `typeof X` member of the alias (covers both single
 * `typeof X` aliases and `typeof A | typeof B` unions).
 *
 * @param alias - the `*Types` type alias to inspect
 * @returns each referenced identity-const name in source order
 */
function extractIdentityRefs(alias: TypeAliasDeclaration): readonly string[] {
  const typeNode = alias.getTypeNode();
  const refs: string[] = [];
  if (!typeNode) {
    return refs;
  }
  if (Node.isTypeQuery(typeNode)) {
    refs.push(typeNode.getExprName().getText());
  }
  const typeofNodes = typeNode.getDescendantsOfKind(SyntaxKind.TypeQuery);
  for (const tq of typeofNodes) {
    refs.push(tq.getExprName().getText());
  }
  return refs;
}

// MARK: Identity discovery
interface RawIdentity extends ExtractedIdentity {
  readonly statementLine: number;
}

function findIdentities(sourceFile: SourceFile): readonly RawIdentity[] {
  const out: RawIdentity[] = [];
  for (const statement of sourceFile.getVariableStatements()) {
    for (const decl of statement.getDeclarations()) {
      const initializer = decl.getInitializer();
      if (!initializer || !Node.isCallExpression(initializer)) {
        continue;
      }
      if (initializer.getExpression().getText() !== 'firestoreModelIdentity') {
        continue;
      }
      const args = initializer.getArguments();
      const { parentIdentityRef, collectionName, prefix } = parseIdentityArgs(args);
      if (!collectionName || !prefix) {
        // Malformed — rule-level logic will flag MODEL_IDENTITY_BAD_ARGS.
      }
      const result: RawIdentity = {
        constName: decl.getName(),
        exported: statement.isExported(),
        parentIdentityRef,
        collectionName: collectionName ?? '',
        prefix: prefix ?? '',
        line: decl.getStartLineNumber(),
        statementLine: statement.getStartLineNumber()
      };
      out.push(result);
    }
  }
  return out;
}

interface IdentityArgs {
  readonly parentIdentityRef: string | undefined;
  readonly collectionName: string | undefined;
  readonly prefix: string | undefined;
}

function parseIdentityArgs(args: readonly Node[]): IdentityArgs {
  if (args.length === 2) {
    const [nameNode, prefixNode] = args;
    const result: IdentityArgs = {
      parentIdentityRef: undefined,
      collectionName: stringLiteralValue(nameNode),
      prefix: stringLiteralValue(prefixNode)
    };
    return result;
  }
  if (args.length === 3) {
    const [parentNode, nameNode, prefixNode] = args;
    const parentRef = Node.isIdentifier(parentNode) ? parentNode.getText() : undefined;
    const result: IdentityArgs = {
      parentIdentityRef: parentRef,
      collectionName: stringLiteralValue(nameNode),
      prefix: stringLiteralValue(prefixNode)
    };
    return result;
  }
  const result: IdentityArgs = { parentIdentityRef: undefined, collectionName: undefined, prefix: undefined };
  return result;
}

function stringLiteralValue(node: Node | undefined): string | undefined {
  if (!node) {
    return undefined;
  }
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText();
  }
  return undefined;
}

// MARK: Per-model extraction
function extractModel(sourceFile: SourceFile, identity: RawIdentity): ExtractedModel {
  const camelName = deriveCamelName(identity.constName);
  const pascalName = pascalCase(camelName);
  const variant: ModelVariant = identity.parentIdentityRef ? 'subcollection' : 'root';

  const iface = findInterface(sourceFile, pascalName);
  const rolesType = findTypeAlias(sourceFile, `${pascalName}Roles`);
  const documentClass = findDocumentClass(sourceFile, `${pascalName}Document`);
  const converter = findVariable(sourceFile, `${camelName}Converter`);
  const accessorFactory = findVariable(sourceFile, `${camelName}AccessorFactory`);

  const referenceFnName = variant === 'root' ? `${camelName}CollectionReference` : `${camelName}CollectionReferenceFactory`;
  const referenceFn = findFunction(sourceFile, referenceFnName);
  const referenceGroupFn = variant === 'subcollection' ? findFunction(sourceFile, `${camelName}CollectionReference`) : undefined;

  const collectionType = findTypeAlias(sourceFile, `${pascalName}FirestoreCollection`);
  const collectionFactoryType = variant === 'subcollection' ? findTypeAlias(sourceFile, `${pascalName}FirestoreCollectionFactory`) : undefined;
  const collectionGroupType = variant === 'subcollection' ? findTypeAlias(sourceFile, `${pascalName}FirestoreCollectionGroup`) : undefined;

  const collectionFnName = variant === 'root' ? `${camelName}FirestoreCollection` : `${camelName}FirestoreCollectionFactory`;
  const collectionFn = findFunction(sourceFile, collectionFnName);
  const collectionGroupFn = variant === 'subcollection' ? findFunction(sourceFile, `${camelName}FirestoreCollectionGroup`) : undefined;
  const factoryCallKind = detectFactoryCallKind(sourceFile, collectionFnName);

  const extractedIdentity: ExtractedIdentity = {
    constName: identity.constName,
    exported: identity.exported,
    parentIdentityRef: identity.parentIdentityRef,
    collectionName: identity.collectionName,
    prefix: identity.prefix,
    line: identity.line
  };

  const result: ExtractedModel = {
    name: pascalName,
    camelName,
    variant,
    identity: extractedIdentity,
    iface,
    rolesType,
    documentClass,
    converter,
    accessorFactory,
    referenceFn,
    referenceGroupFn,
    collectionType,
    collectionFactoryType,
    collectionGroupType,
    collectionFn,
    collectionGroupFn,
    factoryCallKind
  };
  return result;
}

/**
 * Walks the model's collection factory body to determine which
 * `firestoreContext.*` call it makes. Returns the canonical
 * {@link FirestoreCollectionKind} for whichever recognised call is found
 * first, or `undefined` when the function is missing / no recognised call is
 * present (callers default per-variant to preserve prior behaviour).
 *
 * Mapping:
 *   - `firestoreCollection` → `'root'`
 *   - `rootSingleItemFirestoreCollection` → `'root-singleton'`
 *   - `firestoreCollectionWithParent` → `'sub-collection'`
 *   - `singleItemFirestoreCollection` → `'singleton-sub'`
 *
 * @param sourceFile - the parsed model source file
 * @param factoryFnName - name of the `*FirestoreCollection`/`*FirestoreCollectionFactory` function
 * @returns the detected kind, or `undefined` when none can be located
 */
function detectFactoryCallKind(sourceFile: SourceFile, factoryFnName: string): FirestoreCollectionKind | undefined {
  const fn = sourceFile.getFunction(factoryFnName);
  if (!fn) {
    return undefined;
  }
  const calls = fn.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    const expr = call.getExpression();
    if (!Node.isPropertyAccessExpression(expr)) {
      continue;
    }
    const name = expr.getName();
    if (name === 'firestoreCollection') {
      return 'root';
    }
    if (name === 'rootSingleItemFirestoreCollection') {
      return 'root-singleton';
    }
    if (name === 'firestoreCollectionWithParent') {
      return 'sub-collection';
    }
    if (name === 'singleItemFirestoreCollection') {
      return 'singleton-sub';
    }
  }
  return undefined;
}

// MARK: Name helpers
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

// MARK: Declaration lookups
function findInterface(sourceFile: SourceFile, name: string): ExtractedDecl | undefined {
  const iface = sourceFile.getInterface(name);
  if (!iface) {
    return undefined;
  }
  const result: ExtractedDecl = { name: iface.getName(), exported: iface.isExported(), line: iface.getStartLineNumber() };
  return result;
}

function findTypeAlias(sourceFile: SourceFile, name: string): ExtractedDecl | undefined {
  const alias = sourceFile.getTypeAlias(name);
  if (!alias) {
    return undefined;
  }
  const typeNode = alias.getTypeNode();
  const result: ExtractedDecl = {
    name: alias.getName(),
    exported: alias.isExported(),
    line: alias.getStartLineNumber(),
    typeText: typeNode ? typeNode.getText() : undefined
  };
  return result;
}

function findFunction(sourceFile: SourceFile, name: string): ExtractedDecl | undefined {
  const fn = sourceFile.getFunction(name);
  if (!fn) {
    return undefined;
  }
  const returnTypeNode = fn.getReturnTypeNode();
  const result: ExtractedDecl = {
    name: fn.getName() ?? name,
    exported: fn.isExported(),
    line: fn.getStartLineNumber(),
    typeText: returnTypeNode ? returnTypeNode.getText() : undefined
  };
  return result;
}

function findVariable(sourceFile: SourceFile, name: string): ExtractedDecl | undefined {
  for (const statement of sourceFile.getVariableStatements()) {
    for (const decl of statement.getDeclarations()) {
      if (decl.getName() !== name) {
        continue;
      }
      const result: ExtractedDecl = { name, exported: statement.isExported(), line: decl.getStartLineNumber() };
      return result;
    }
  }
  return undefined;
}

function findDocumentClass(sourceFile: SourceFile, name: string): ExtractedDocumentClass | undefined {
  const classDecl: ClassDeclaration | undefined = sourceFile.getClass(name);
  if (!classDecl) {
    return undefined;
  }
  const extendsExpr = classDecl.getExtends();
  const baseClass = extendsExpr ? extendsExpr.getExpression().getText() : '';
  const typeArgs = extendsExpr ? extendsExpr.getTypeArguments().map((t) => t.getText()) : [];
  const getter: GetAccessorDeclaration | undefined = classDecl.getGetAccessor('modelIdentity');
  const modelIdentityReturn = getter ? parseGetterReturn(getter) : undefined;
  const result: ExtractedDocumentClass = {
    name: classDecl.getName() ?? name,
    exported: classDecl.isExported(),
    line: classDecl.getStartLineNumber(),
    baseClass,
    typeArgs,
    hasModelIdentityGetter: getter !== undefined,
    modelIdentityReturn
  };
  return result;
}

function parseGetterReturn(getter: GetAccessorDeclaration): string | undefined {
  const body = getter.getBody();
  if (!body) {
    return undefined;
  }
  const returnStatements = body.getDescendantsOfKind(SyntaxKind.ReturnStatement);
  const first = returnStatements[0];
  if (!first) {
    return undefined;
  }
  const expr = first.getExpression();
  if (!expr) {
    return undefined;
  }
  return expr.getText();
}
