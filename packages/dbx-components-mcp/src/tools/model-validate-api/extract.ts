/**
 * AST extraction for `dbx_validate_model_api`.
 *
 * Parses one `<model>.api.ts` source with ts-morph and emits a normalized
 * {@link ExtractedFile}. No type resolution is needed for syntactic
 * checks, so an in-memory project is sufficient. Extraction is
 * best-effort: rules downstream tolerate partial data (e.g. a Functions
 * block is fully missing) without crashing.
 */

import { Node, Project, SyntaxKind, type ClassDeclaration, type InterfaceDeclaration, type ObjectLiteralExpression, type PropertyAssignment, type SourceFile, type TypeAliasDeclaration, type TypeNode, type VariableStatement } from 'ts-morph';
import type { ExtractedCrudConfigConst, ExtractedCrudConfigType, ExtractedField, ExtractedFile, ExtractedFunctionMap, ExtractedFunctionsClass, ExtractedParamsDecl, ExtractedParamsValidator, ExtractedResultDecl, ExtractedTypeAlias, ExtractedValidatorProperty, ExtractedVariable, MarkComment, ValidatorSource } from './types.js';

// MARK: Entry
/**
 * Parses a single api source via ts-morph and returns the normalised facts the
 * rules module consumes. Extraction is best-effort — when a section is missing
 * the rules treat the absence as the diagnostic instead of crashing here.
 *
 * @param source - The in-memory source name + text pair to extract.
 * @returns The structured extraction used by the rules layer.
 */
export function extractFile(source: ValidatorSource): ExtractedFile {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(source.name, source.text, { overwrite: true });

  const factoryCallSeen = detectFactoryCall(sourceFile);
  const functionTypeMap = findFunctionTypeMap(sourceFile);
  const functionTypeConfigMap = findFunctionTypeConfigMap(sourceFile);
  const crudConfigType = findCrudConfigType(sourceFile);
  const crudConfigConst = findCrudConfigConst(sourceFile);
  const functionMap = findFunctionMap(sourceFile);
  const functionsClass = findFunctionsClass(sourceFile);
  const paramsDecls = findParamsDecls(sourceFile);
  const paramsValidators = findParamsValidators(sourceFile);
  const resultDecls = findResultDecls(sourceFile);
  const markComments = findMarkComments(sourceFile);

  const functionsBlockLines = collectFunctionsBlockLines({ functionTypeMap, functionTypeConfigMap, crudConfigType, crudConfigConst, functionMap, functionsClass });
  const firstFunctionsBlockLine = functionsBlockLines.length > 0 ? Math.min(...functionsBlockLines) : undefined;

  const paramsOrResultLines = [...paramsDecls.map((d) => d.line), ...resultDecls.map((d) => d.line), ...paramsValidators.map((v) => v.line)];
  const firstParamsOrResultLine = paramsOrResultLines.length > 0 ? Math.min(...paramsOrResultLines) : undefined;

  const beforeBlock = firstFunctionsBlockLine === undefined ? paramsOrResultLines : paramsOrResultLines.filter((l) => l < firstFunctionsBlockLine);
  const lastParamsOrResultBeforeFunctionsLine = beforeBlock.length > 0 ? Math.max(...beforeBlock) : undefined;

  const groupName = inferGroupName({ functionTypeMap, functionTypeConfigMap, crudConfigType, crudConfigConst, functionMap, functionsClass });

  const result: ExtractedFile = {
    name: source.name,
    factoryCallSeen,
    groupName,
    functionTypeMap,
    functionTypeConfigMap,
    crudConfigType,
    crudConfigConst,
    functionMap,
    functionsClass,
    paramsDecls,
    paramsValidators,
    resultDecls,
    firstFunctionsBlockLine,
    markComments,
    firstParamsOrResultLine,
    lastParamsOrResultBeforeFunctionsLine
  };
  return result;
}

// MARK: Factory call detection
function detectFactoryCall(sourceFile: SourceFile): boolean {
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = call.getExpression();
    if (expr.getText() === 'callModelFirebaseFunctionMapFactory') {
      return true;
    }
  }
  return false;
}

// MARK: MARK: comments
function findMarkComments(sourceFile: SourceFile): readonly MarkComment[] {
  const out: MarkComment[] = [];
  const text = sourceFile.getFullText();
  const regex = /\/\/\s*MARK:\s*(.+?)\s*$/gm;
  for (;;) {
    const match = regex.exec(text);
    if (!match) {
      break;
    }
    const line = sourceFile.getLineAndColumnAtPos(match.index).line;
    out.push({ label: match[1].trim(), line });
  }
  return out;
}

// MARK: Group name inference
interface GroupCandidate {
  readonly name: string;
  readonly pascal: string;
}

function inferGroupName(parts: { readonly functionTypeMap: ExtractedTypeAlias | undefined; readonly functionTypeConfigMap: ExtractedVariable | undefined; readonly crudConfigType: ExtractedCrudConfigType | undefined; readonly crudConfigConst: ExtractedCrudConfigConst | undefined; readonly functionMap: ExtractedFunctionMap | undefined; readonly functionsClass: ExtractedFunctionsClass | undefined }): string | undefined {
  const candidates = collectGroupCandidates(parts);
  let result: string | undefined;
  if (candidates.length > 0) {
    result = pickMostCommonPascal(candidates);
  }
  return result;
}

function collectGroupCandidates(parts: { readonly functionTypeMap: ExtractedTypeAlias | undefined; readonly functionTypeConfigMap: ExtractedVariable | undefined; readonly crudConfigType: ExtractedCrudConfigType | undefined; readonly crudConfigConst: ExtractedCrudConfigConst | undefined; readonly functionMap: ExtractedFunctionMap | undefined; readonly functionsClass: ExtractedFunctionsClass | undefined }): readonly GroupCandidate[] {
  const candidates: GroupCandidate[] = [];
  pushPascalCandidate(candidates, parts.functionTypeMap, 'FunctionTypeMap');
  pushCamelCandidate(candidates, parts.functionTypeConfigMap, 'FunctionTypeConfigMap');
  pushPascalCandidate(candidates, parts.crudConfigType, 'ModelCrudFunctionsConfig');
  pushCamelCandidate(candidates, parts.crudConfigConst, 'ModelCrudFunctionsConfig');
  pushCamelCandidate(candidates, parts.functionMap, 'FunctionMap');
  pushPascalCandidate(candidates, parts.functionsClass, 'Functions');
  return candidates;
}

function pushPascalCandidate(candidates: GroupCandidate[], part: { readonly name: string } | undefined, suffix: string): void {
  if (!part) return;
  const pascal = stripSuffix(part.name, suffix);
  if (pascal) {
    candidates.push({ name: part.name, pascal });
  }
}

function pushCamelCandidate(candidates: GroupCandidate[], part: { readonly name: string } | undefined, suffix: string): void {
  if (!part) return;
  const camel = stripSuffix(part.name, suffix);
  if (camel) {
    candidates.push({ name: part.name, pascal: pascalCase(camel) });
  }
}

function pickMostCommonPascal(candidates: readonly GroupCandidate[]): string | undefined {
  const counts = new Map<string, number>();
  for (const c of candidates) {
    counts.set(c.pascal, (counts.get(c.pascal) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Returns the leading stem of `name` when it ends in the given suffix, or
 * `undefined` when the suffix is absent or consumes the entire name.
 *
 * @param name - The candidate identifier.
 * @param suffix - The trailing fragment to strip.
 * @returns The stem, or `undefined` when no usable stem remains.
 */
function stripSuffix(name: string, suffix: string): string | undefined {
  if (!name.endsWith(suffix)) {
    return undefined;
  }
  const stem = name.slice(0, -suffix.length);
  return stem.length > 0 ? stem : undefined;
}

/**
 * Capitalises the first character of a camel-case identifier so it can be
 * compared to its pascal-case sibling.
 *
 * @param camel - The camel-cased input.
 * @returns The same identifier with the first character uppercased.
 */
function pascalCase(camel: string): string {
  if (camel.length === 0) {
    return camel;
  }
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Lowercases the first character of a pascal-case identifier so it can be
 * compared to its camel-case sibling.
 *
 * @param pascal - The pascal-cased input.
 * @returns The same identifier with the first character lowercased.
 */
function camelCase(pascal: string): string {
  if (pascal.length === 0) {
    return pascal;
  }
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// MARK: Functions-block finders
function findFunctionTypeMap(sourceFile: SourceFile): ExtractedTypeAlias | undefined {
  for (const alias of sourceFile.getTypeAliases()) {
    if (alias.getName().endsWith('FunctionTypeMap')) {
      return { name: alias.getName(), exported: alias.isExported(), line: alias.getStartLineNumber() };
    }
  }
  return undefined;
}

function findFunctionTypeConfigMap(sourceFile: SourceFile): ExtractedVariable | undefined {
  let result: ExtractedVariable | undefined;
  outer: for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getName();
      if (!name.endsWith('FunctionTypeConfigMap')) {
        continue;
      }
      const typeNode = decl.getTypeNode();
      result = {
        name,
        exported: stmt.isExported(),
        line: decl.getStartLineNumber(),
        typeAnnotation: typeNode ? typeNode.getText() : undefined
      };
      break outer;
    }
  }
  return result;
}

function findCrudConfigType(sourceFile: SourceFile): ExtractedCrudConfigType | undefined {
  let result: ExtractedCrudConfigType | undefined;
  for (const alias of sourceFile.getTypeAliases()) {
    if (!alias.getName().endsWith('ModelCrudFunctionsConfig')) {
      continue;
    }
    const typeNode = alias.getTypeNode();
    const summary = typeNode && Node.isTypeLiteral(typeNode) ? summarizeCrudConfigType(typeNode) : { keys: [], nonNullKeys: [], bareLeafParamsNames: [] };
    result = {
      name: alias.getName(),
      exported: alias.isExported(),
      line: alias.getStartLineNumber(),
      keys: summary.keys,
      nonNullKeys: summary.nonNullKeys,
      bareLeafParamsNames: summary.bareLeafParamsNames
    };
    break;
  }
  return result;
}

interface CrudConfigTypeSummary {
  readonly keys: readonly string[];
  readonly nonNullKeys: readonly string[];
  readonly bareLeafParamsNames: readonly string[];
}

function summarizeCrudConfigType(typeLiteral: TypeNode): CrudConfigTypeSummary {
  let result: CrudConfigTypeSummary;
  if (Node.isTypeLiteral(typeLiteral)) {
    const keys: string[] = [];
    const nonNullKeys: string[] = [];
    const bareLeafParamsNames: string[] = [];
    for (const member of typeLiteral.getMembers()) {
      collectCrudConfigMember(member, { keys, nonNullKeys, bareLeafParamsNames });
    }
    result = { keys, nonNullKeys, bareLeafParamsNames };
  } else {
    result = { keys: [], nonNullKeys: [], bareLeafParamsNames: [] };
  }
  return result;
}

interface MutableCrudConfigSummary {
  readonly keys: string[];
  readonly nonNullKeys: string[];
  readonly bareLeafParamsNames: string[];
}

function collectCrudConfigMember(member: Node, summary: MutableCrudConfigSummary): void {
  if (!Node.isPropertySignature(member)) return;
  const name = member.getName();
  summary.keys.push(name);
  const valueNode = member.getTypeNode();
  if (!valueNode) return;
  if (isNullLiteralType(valueNode)) return;
  summary.nonNullKeys.push(name);
  collectBareParamsLeaves(valueNode, summary.bareLeafParamsNames);
}

function isNullLiteralType(node: TypeNode): boolean {
  if (Node.isLiteralTypeNode(node)) {
    const literal = node.getLiteral();
    if (Node.isNullLiteral(literal)) {
      return true;
    }
  }
  return false;
}

function collectBareParamsLeaves(node: TypeNode, out: string[]): void {
  if (Node.isTypeLiteral(node)) {
    for (const member of node.getMembers()) {
      if (!Node.isPropertySignature(member)) {
        continue;
      }
      const valueNode = member.getTypeNode();
      if (valueNode) {
        collectBareParamsLeaves(valueNode, out);
      }
    }
    return;
  }
  if (Node.isTupleTypeNode(node)) {
    // Declared result tuple — not a bare leaf.
    return;
  }
  if (Node.isTypeReference(node)) {
    const name = node.getTypeName().getText();
    if (name.endsWith('Params')) {
      out.push(name);
    }
  }
  // Primitives, unions, null — ignore.
}

function findCrudConfigConst(sourceFile: SourceFile): ExtractedCrudConfigConst | undefined {
  let result: ExtractedCrudConfigConst | undefined;
  for (const stmt of sourceFile.getVariableStatements()) {
    result = findCrudConfigConstInStatement(stmt);
    if (result) break;
  }
  return result;
}

function findCrudConfigConstInStatement(stmt: VariableStatement): ExtractedCrudConfigConst | undefined {
  let result: ExtractedCrudConfigConst | undefined;
  for (const decl of stmt.getDeclarations()) {
    const name = decl.getName();
    if (!name.endsWith('ModelCrudFunctionsConfig')) continue;
    const typeNode = decl.getTypeNode();
    const runtimeKeys = collectCrudConfigRuntimeKeys(decl.getInitializer());
    result = {
      name,
      exported: stmt.isExported(),
      line: decl.getStartLineNumber(),
      typeAnnotation: typeNode ? typeNode.getText() : undefined,
      runtimeKeys
    };
    break;
  }
  return result;
}

function collectCrudConfigRuntimeKeys(initializer: Node | undefined): readonly string[] {
  const runtimeKeys: string[] = [];
  if (!initializer) return runtimeKeys;
  if (Node.isAsExpression(initializer)) {
    const inner = initializer.getExpression();
    if (Node.isObjectLiteralExpression(inner)) {
      runtimeKeys.push(...collectObjectLiteralKeys(inner));
    }
  } else if (Node.isObjectLiteralExpression(initializer)) {
    runtimeKeys.push(...collectObjectLiteralKeys(initializer));
  }
  return runtimeKeys;
}

function collectObjectLiteralKeys(obj: ObjectLiteralExpression): readonly string[] {
  const out: string[] = [];
  for (const prop of obj.getProperties()) {
    if (Node.isPropertyAssignment(prop) || Node.isShorthandPropertyAssignment(prop)) {
      out.push(prop.getName());
    }
  }
  return out;
}

function findFunctionMap(sourceFile: SourceFile): ExtractedFunctionMap | undefined {
  let result: ExtractedFunctionMap | undefined;
  for (const stmt of sourceFile.getVariableStatements()) {
    result = findFunctionMapInStatement(stmt);
    if (result) break;
  }
  return result;
}

function findFunctionMapInStatement(stmt: VariableStatement): ExtractedFunctionMap | undefined {
  let result: ExtractedFunctionMap | undefined;
  for (const decl of stmt.getDeclarations()) {
    const name = decl.getName();
    if (!name.endsWith('FunctionMap')) continue;
    const factoryCall = readFactoryCall(decl.getInitializer());
    const typeNode = decl.getTypeNode();
    result = {
      name,
      exported: stmt.isExported(),
      line: decl.getStartLineNumber(),
      typeAnnotation: typeNode ? typeNode.getText() : undefined,
      callsFactory: factoryCall.callsFactory,
      factoryArgs: factoryCall.factoryArgs
    };
    break;
  }
  return result;
}

function readFactoryCall(initializer: Node | undefined): { readonly callsFactory: boolean; readonly factoryArgs: readonly string[] } {
  let callsFactory = false;
  const factoryArgs: string[] = [];
  if (initializer && Node.isCallExpression(initializer)) {
    const exprText = initializer.getExpression().getText();
    if (exprText === 'callModelFirebaseFunctionMapFactory') {
      callsFactory = true;
      for (const arg of initializer.getArguments()) {
        factoryArgs.push(arg.getText());
      }
    }
  }
  return { callsFactory, factoryArgs };
}

function findFunctionsClass(sourceFile: SourceFile): ExtractedFunctionsClass | undefined {
  const candidates: ClassDeclaration[] = [];
  for (const cls of sourceFile.getClasses()) {
    const name = cls.getName();
    if (name?.endsWith('Functions')) {
      candidates.push(cls);
    }
  }
  const cls = candidates[0];
  if (!cls) {
    return undefined;
  }
  const implementsClauses = cls.getImplements();
  const implementsText = implementsClauses.length > 0 ? implementsClauses[0].getText() : undefined;
  const memberNames: string[] = [];
  for (const prop of cls.getProperties()) {
    memberNames.push(prop.getName());
  }
  const result: ExtractedFunctionsClass = {
    name: cls.getName() ?? '',
    exported: cls.isExported(),
    isAbstract: cls.isAbstract(),
    line: cls.getStartLineNumber(),
    implementsText,
    memberNames
  };
  return result;
}

// MARK: Params / Result decls
function findParamsDecls(sourceFile: SourceFile): readonly ExtractedParamsDecl[] {
  const out: ExtractedParamsDecl[] = [];
  for (const iface of sourceFile.getInterfaces()) {
    const name = iface.getName();
    if (!name.endsWith('Params') || isReservedStructuralName(name)) {
      continue;
    }
    const fields = extractInterfaceFields(iface);
    out.push({ name, exported: iface.isExported(), line: iface.getStartLineNumber(), isInterface: true, fields });
  }
  for (const alias of sourceFile.getTypeAliases()) {
    const name = alias.getName();
    if (!name.endsWith('Params') || isReservedStructuralName(name)) {
      continue;
    }
    out.push({ name, exported: alias.isExported(), line: alias.getStartLineNumber(), isInterface: false, fields: [] });
  }
  return out;
}

function findResultDecls(sourceFile: SourceFile): readonly ExtractedResultDecl[] {
  const out: ExtractedResultDecl[] = [];
  for (const iface of sourceFile.getInterfaces()) {
    const name = iface.getName();
    if (!name.endsWith('Result')) {
      continue;
    }
    const fields = extractInterfaceFields(iface);
    out.push({ name, exported: iface.isExported(), line: iface.getStartLineNumber(), isInterface: true, fields });
  }
  for (const alias of sourceFile.getTypeAliases()) {
    const name = alias.getName();
    if (!name.endsWith('Result')) {
      continue;
    }
    out.push({ name, exported: alias.isExported(), line: alias.getStartLineNumber(), isInterface: false, fields: [] });
  }
  return out;
}

function isReservedStructuralName(name: string): boolean {
  return name.endsWith('ModelCrudFunctionsConfig') || name.endsWith('FunctionTypeMap') || name.endsWith('FunctionTypeConfigMap');
}

function extractInterfaceFields(iface: InterfaceDeclaration): readonly ExtractedField[] {
  const fields: ExtractedField[] = [];
  for (const prop of iface.getProperties()) {
    const typeNode = prop.getTypeNode();
    const typeText = typeNode ? typeNode.getText() : '';
    const hasMaybeType = /\bMaybe\s*</.test(typeText);
    const isReadonly = prop.hasModifier(SyntaxKind.ReadonlyKeyword);
    const field: ExtractedField = {
      name: prop.getName(),
      readonly: isReadonly,
      line: prop.getStartLineNumber(),
      typeText,
      hasMaybeType
    };
    fields.push(field);
  }
  return fields;
}

// MARK: Params validators
function findParamsValidators(sourceFile: SourceFile): readonly ExtractedParamsValidator[] {
  const out: ExtractedParamsValidator[] = [];
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getName();
      if (!name.endsWith('ParamsType')) {
        continue;
      }
      const initializer = decl.getInitializer();
      const castTargetName = extractCastTargetName(initializer);
      const properties = initializer ? extractValidatorProperties(initializer) : [];
      const result: ExtractedParamsValidator = {
        name,
        exported: stmt.isExported(),
        line: decl.getStartLineNumber(),
        castTargetName,
        properties
      };
      out.push(result);
    }
  }
  return out;
}

function extractCastTargetName(node: Node | undefined): string | undefined {
  let result: string | undefined;
  let current: Node | undefined = node;
  let done = false;
  while (!done && current && Node.isAsExpression(current)) {
    const outcome = readAsExpressionTarget(current);
    if (outcome.kind === 'found') {
      result = outcome.name;
      done = true;
    } else if (outcome.kind === 'stop') {
      done = true;
    } else {
      current = current.getExpression();
    }
  }
  return result;
}

type AsExpressionOutcome = { readonly kind: 'found'; readonly name: string | undefined } | { readonly kind: 'stop' } | { readonly kind: 'continue' };

function readAsExpressionTarget(expr: Node): AsExpressionOutcome {
  if (!Node.isAsExpression(expr)) return { kind: 'continue' };
  const typeNode = expr.getTypeNode();
  if (!typeNode) return { kind: 'stop' };
  if (!Node.isTypeReference(typeNode)) return { kind: 'continue' };
  const refName = typeNode.getTypeName().getText();
  if (refName !== 'Type') return { kind: 'continue' };
  const args = typeNode.getTypeArguments();
  let result: AsExpressionOutcome;
  if (args.length === 1) {
    const arg = args[0];
    const name = Node.isTypeReference(arg) ? arg.getTypeName().getText() : arg.getText();
    result = { kind: 'found', name };
  } else {
    result = { kind: 'found', name: undefined };
  }
  return result;
}

/**
 * Walks an arktype `type({...})` initializer and emits one record per property.
 * Picks up the `?` optional marker and detects `clearable(...)` wrappers so
 * the rules layer can compare against the matching params interface.
 *
 * @param initializer - The variable initializer node (typically a `type(...)` call)
 * @returns The parsed property descriptors in source order.
 */
function extractValidatorProperties(initializer: Node): readonly ExtractedValidatorProperty[] {
  const obj = findArktypeObjectLiteral(initializer);
  const out: ExtractedValidatorProperty[] = [];
  if (obj) {
    for (const prop of obj.getProperties()) {
      const parsed = parseValidatorProperty(prop);
      if (parsed) {
        out.push(parsed);
      }
    }
  }
  return out;
}

function parseValidatorProperty(prop: Node): ExtractedValidatorProperty | undefined {
  if (!Node.isPropertyAssignment(prop)) return undefined;
  const propAssignment = prop as PropertyAssignment;
  const rawName = propAssignment.getName();
  const stripped = rawName.replaceAll(/^['"`]|['"`]$/g, '');
  const optional = stripped.endsWith('?');
  const clean = optional ? stripped.slice(0, -1) : stripped;
  const hasClearable = isClearableCall(propAssignment.getInitializer());
  return { name: clean, optional, hasClearable, line: propAssignment.getStartLineNumber() };
}

function isClearableCall(valueNode: Node | undefined): boolean {
  let result = false;
  if (valueNode && Node.isCallExpression(valueNode)) {
    const exprText = valueNode.getExpression().getText();
    if (exprText === 'clearable') {
      result = true;
    }
  }
  return result;
}

/**
 * Unwraps the arktype object literal from a validator initializer.
 * Handles three observed shapes:
 *   - `type({...}) as Type<X>` / `type({...}) as unknown as Type<X>`
 *   - `baseParamsType.merge({...}) as Type<X>` / with `as unknown as`
 *   - `baseParamsType as Type<X>` → returns `undefined` (no object literal).
 *
 * @param initializer - The variable initializer node to unwrap.
 * @returns The underlying arktype object literal, or `undefined` when the initializer is a re-export.
 */
function findArktypeObjectLiteral(initializer: Node): ObjectLiteralExpression | undefined {
  let current: Node | undefined = initializer;
  while (current && Node.isAsExpression(current)) {
    current = current.getExpression();
  }
  if (!current || !Node.isCallExpression(current)) {
    return undefined;
  }
  const expr = current.getExpression();
  if (Node.isIdentifier(expr) && expr.getText() === 'type') {
    const args = current.getArguments();
    const arg = args[0];
    if (arg && Node.isObjectLiteralExpression(arg)) {
      return arg;
    }
    return undefined;
  }
  if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'merge') {
    const args = current.getArguments();
    const arg = args[0];
    if (arg && Node.isObjectLiteralExpression(arg)) {
      return arg;
    }
  }
  return undefined;
}

// MARK: Line collection helpers
function collectFunctionsBlockLines(parts: { readonly functionTypeMap: ExtractedTypeAlias | undefined; readonly functionTypeConfigMap: ExtractedVariable | undefined; readonly crudConfigType: ExtractedCrudConfigType | undefined; readonly crudConfigConst: ExtractedCrudConfigConst | undefined; readonly functionMap: ExtractedFunctionMap | undefined; readonly functionsClass: ExtractedFunctionsClass | undefined }): readonly number[] {
  const lines: number[] = [];
  if (parts.functionTypeMap) lines.push(parts.functionTypeMap.line);
  if (parts.functionTypeConfigMap) lines.push(parts.functionTypeConfigMap.line);
  if (parts.crudConfigType) lines.push(parts.crudConfigType.line);
  if (parts.crudConfigConst) lines.push(parts.crudConfigConst.line);
  if (parts.functionMap) lines.push(parts.functionMap.line);
  if (parts.functionsClass) lines.push(parts.functionsClass.line);
  return lines;
}

// MARK: Re-exports for internal consumers
export { camelCase, pascalCase };

// Suppress unused-warnings for type-only helpers used by rules.ts via the types module.
export type _Unused = VariableStatement | TypeAliasDeclaration;
