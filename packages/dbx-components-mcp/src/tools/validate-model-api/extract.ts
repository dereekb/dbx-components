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

  const beforeBlock = firstFunctionsBlockLine !== undefined ? paramsOrResultLines.filter((l) => l < firstFunctionsBlockLine) : paramsOrResultLines;
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
  const candidates: GroupCandidate[] = [];
  if (parts.functionTypeMap) {
    const pascal = stripSuffix(parts.functionTypeMap.name, 'FunctionTypeMap');
    if (pascal) {
      candidates.push({ name: parts.functionTypeMap.name, pascal });
    }
  }
  if (parts.functionTypeConfigMap) {
    const camel = stripSuffix(parts.functionTypeConfigMap.name, 'FunctionTypeConfigMap');
    if (camel) {
      candidates.push({ name: parts.functionTypeConfigMap.name, pascal: pascalCase(camel) });
    }
  }
  if (parts.crudConfigType) {
    const pascal = stripSuffix(parts.crudConfigType.name, 'ModelCrudFunctionsConfig');
    if (pascal) {
      candidates.push({ name: parts.crudConfigType.name, pascal });
    }
  }
  if (parts.crudConfigConst) {
    const camel = stripSuffix(parts.crudConfigConst.name, 'ModelCrudFunctionsConfig');
    if (camel) {
      candidates.push({ name: parts.crudConfigConst.name, pascal: pascalCase(camel) });
    }
  }
  if (parts.functionMap) {
    const camel = stripSuffix(parts.functionMap.name, 'FunctionMap');
    if (camel) {
      candidates.push({ name: parts.functionMap.name, pascal: pascalCase(camel) });
    }
  }
  if (parts.functionsClass) {
    const pascal = stripSuffix(parts.functionsClass.name, 'Functions');
    if (pascal) {
      candidates.push({ name: parts.functionsClass.name, pascal });
    }
  }
  if (candidates.length === 0) {
    return undefined;
  }
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

function stripSuffix(name: string, suffix: string): string | undefined {
  if (!name.endsWith(suffix)) {
    return undefined;
  }
  const stem = name.slice(0, -suffix.length);
  return stem.length > 0 ? stem : undefined;
}

function pascalCase(camel: string): string {
  if (camel.length === 0) {
    return camel;
  }
  const result = camel.charAt(0).toUpperCase() + camel.slice(1);
  return result;
}

function camelCase(pascal: string): string {
  if (pascal.length === 0) {
    return pascal;
  }
  const result = pascal.charAt(0).toLowerCase() + pascal.slice(1);
  return result;
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
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getName();
      if (!name.endsWith('FunctionTypeConfigMap')) {
        continue;
      }
      const typeNode = decl.getTypeNode();
      const result: ExtractedVariable = {
        name,
        exported: stmt.isExported(),
        line: decl.getStartLineNumber(),
        typeAnnotation: typeNode ? typeNode.getText() : undefined
      };
      return result;
    }
  }
  return undefined;
}

function findCrudConfigType(sourceFile: SourceFile): ExtractedCrudConfigType | undefined {
  for (const alias of sourceFile.getTypeAliases()) {
    if (!alias.getName().endsWith('ModelCrudFunctionsConfig')) {
      continue;
    }
    const typeNode = alias.getTypeNode();
    const summary = typeNode && Node.isTypeLiteral(typeNode) ? summarizeCrudConfigType(typeNode) : { keys: [], nonNullKeys: [], bareLeafParamsNames: [] };
    const result: ExtractedCrudConfigType = {
      name: alias.getName(),
      exported: alias.isExported(),
      line: alias.getStartLineNumber(),
      keys: summary.keys,
      nonNullKeys: summary.nonNullKeys,
      bareLeafParamsNames: summary.bareLeafParamsNames
    };
    return result;
  }
  return undefined;
}

interface CrudConfigTypeSummary {
  readonly keys: readonly string[];
  readonly nonNullKeys: readonly string[];
  readonly bareLeafParamsNames: readonly string[];
}

function summarizeCrudConfigType(typeLiteral: TypeNode): CrudConfigTypeSummary {
  if (!Node.isTypeLiteral(typeLiteral)) {
    return { keys: [], nonNullKeys: [], bareLeafParamsNames: [] };
  }
  const keys: string[] = [];
  const nonNullKeys: string[] = [];
  const bareLeafParamsNames: string[] = [];
  for (const member of typeLiteral.getMembers()) {
    if (!Node.isPropertySignature(member)) {
      continue;
    }
    const name = member.getName();
    keys.push(name);
    const valueNode = member.getTypeNode();
    if (!valueNode) {
      continue;
    }
    if (isNullLiteralType(valueNode)) {
      continue;
    }
    nonNullKeys.push(name);
    collectBareParamsLeaves(valueNode, bareLeafParamsNames);
  }
  return { keys, nonNullKeys, bareLeafParamsNames };
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
    return;
  }
  // Primitives, unions, null — ignore.
}

function findCrudConfigConst(sourceFile: SourceFile): ExtractedCrudConfigConst | undefined {
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getName();
      if (!name.endsWith('ModelCrudFunctionsConfig')) {
        continue;
      }
      const typeNode = decl.getTypeNode();
      const initializer = decl.getInitializer();
      const runtimeKeys: string[] = [];
      if (initializer && Node.isAsExpression(initializer)) {
        const inner = initializer.getExpression();
        if (Node.isObjectLiteralExpression(inner)) {
          runtimeKeys.push(...collectObjectLiteralKeys(inner));
        }
      } else if (initializer && Node.isObjectLiteralExpression(initializer)) {
        runtimeKeys.push(...collectObjectLiteralKeys(initializer));
      }
      const result: ExtractedCrudConfigConst = {
        name,
        exported: stmt.isExported(),
        line: decl.getStartLineNumber(),
        typeAnnotation: typeNode ? typeNode.getText() : undefined,
        runtimeKeys
      };
      return result;
    }
  }
  return undefined;
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
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const name = decl.getName();
      if (!name.endsWith('FunctionMap')) {
        continue;
      }
      const initializer = decl.getInitializer();
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
      const typeNode = decl.getTypeNode();
      const result: ExtractedFunctionMap = {
        name,
        exported: stmt.isExported(),
        line: decl.getStartLineNumber(),
        typeAnnotation: typeNode ? typeNode.getText() : undefined,
        callsFactory,
        factoryArgs
      };
      return result;
    }
  }
  return undefined;
}

function findFunctionsClass(sourceFile: SourceFile): ExtractedFunctionsClass | undefined {
  const candidates: ClassDeclaration[] = [];
  for (const cls of sourceFile.getClasses()) {
    const name = cls.getName();
    if (name && name.endsWith('Functions')) {
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
  if (!node) {
    return undefined;
  }
  let current: Node | undefined = node;
  while (current && Node.isAsExpression(current)) {
    const typeNode = current.getTypeNode();
    if (!typeNode) {
      break;
    }
    if (Node.isTypeReference(typeNode)) {
      const refName = typeNode.getTypeName().getText();
      if (refName === 'Type') {
        const args = typeNode.getTypeArguments();
        if (args.length === 1) {
          const arg = args[0];
          if (Node.isTypeReference(arg)) {
            return arg.getTypeName().getText();
          }
          return arg.getText();
        }
        return undefined;
      }
    }
    current = current.getExpression();
  }
  return undefined;
}

function extractValidatorProperties(initializer: Node): readonly ExtractedValidatorProperty[] {
  const obj = findArktypeObjectLiteral(initializer);
  if (!obj) {
    return [];
  }
  const out: ExtractedValidatorProperty[] = [];
  for (const prop of obj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) {
      continue;
    }
    const propAssignment = prop as PropertyAssignment;
    const rawName = propAssignment.getName();
    const stripped = rawName.replace(/^['"`]|['"`]$/g, '');
    const optional = stripped.endsWith('?');
    const clean = optional ? stripped.slice(0, -1) : stripped;
    const valueNode = propAssignment.getInitializer();
    let hasClearable = false;
    if (valueNode && Node.isCallExpression(valueNode)) {
      const exprText = valueNode.getExpression().getText();
      if (exprText === 'clearable') {
        hasClearable = true;
      }
    }
    out.push({ name: clean, optional, hasClearable, line: propAssignment.getStartLineNumber() });
  }
  return out;
}

/**
 * Unwraps the arktype object literal from a validator initializer.
 * Handles three observed shapes:
 *   - `type({...}) as Type<X>` / `type({...}) as unknown as Type<X>`
 *   - `baseParamsType.merge({...}) as Type<X>` / with `as unknown as`
 *   - `baseParamsType as Type<X>` → returns `undefined` (no object literal).
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
