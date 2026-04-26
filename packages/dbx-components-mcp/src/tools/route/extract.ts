/**
 * AST extraction for the route cluster.
 *
 * Parses one TypeScript source file with ts-morph and emits a list of
 * {@link RouteNode}s plus any issues surfaced during extraction.
 *
 * Recognized shapes (all syntactic — no type resolution):
 *
 *   1. Top-level `const x: Ng2StateDeclaration = { ... }` — single-state.
 *   2. Top-level array literals of state objects (`const STATES = [a, b]` or
 *      `const STATES: Ng2StateDeclaration[] = [...]`) — every element is
 *      either an inline object literal or an identifier referencing one of
 *      the single-state consts above. Identifier refs are resolved within the
 *      same file.
 *   3. `provideStates({ states: [...] })` — element shape matches (2).
 *   4. `UIRouterModule.forChild({ states: [...] })` — same.
 *
 * Pure ts-morph in-memory project, no tsconfig, no fs reads. The caller is
 * responsible for funnelling files in.
 */

import { Node, Project, SyntaxKind, type ArrayLiteralExpression, type Identifier, type ObjectLiteralExpression, type SourceFile, type VariableStatement } from 'ts-morph';
import type { RouteIssue, RouteNode, RouteSource } from './types.js';

export interface ExtractFileResult {
  readonly nodes: readonly RouteNode[];
  readonly issues: readonly RouteIssue[];
  /**
   * Identifiers that this file imports — used by `resolve.ts` to walk transitively.
   */
  readonly importedFromRelative: readonly RelativeImport[];
}

export interface RelativeImport {
  readonly moduleSpecifier: string;
  readonly file: string;
}

// MARK: Entry
/**
 * Extracts every UIRouter state declaration from a single source file plus any
 * extraction-time diagnostics. Best-effort: malformed states surface as issues
 * rather than throwing so the rest of the file still contributes nodes.
 *
 * @param source - the in-memory source name + text pair to extract
 * @returns the discovered route nodes alongside extraction issues
 */
export function extractFile(source: RouteSource): ExtractFileResult {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(source.name, source.text, { overwrite: true });

  const issues: RouteIssue[] = [];
  const objectLiteralsByName = collectStateConsts(sourceFile);
  const collected = new Map<string, RouteNode>();

  // (1) every typed single-state const becomes a candidate
  for (const [name, info] of objectLiteralsByName) {
    if (!info.typedAsState) {
      continue;
    }
    addNode({ file: source.name, literal: info.literal, fallbackConstName: name, into: collected, issues });
  }

  // (2) every array literal that participates in state registration
  for (const arrayLit of findStateArrayLiterals(sourceFile)) {
    for (const element of arrayLit.getElements()) {
      if (Node.isObjectLiteralExpression(element)) {
        addNode({ file: source.name, literal: element, fallbackConstName: undefined, into: collected, issues });
      } else if (Node.isIdentifier(element)) {
        const ref = objectLiteralsByName.get(element.getText());
        if (ref) {
          addNode({ file: source.name, literal: ref.literal, fallbackConstName: element.getText(), into: collected, issues });
        }
      }
    }
  }

  const importedFromRelative = collectRelativeImports(sourceFile, source.name);

  const result: ExtractFileResult = {
    nodes: Array.from(collected.values()),
    issues,
    importedFromRelative
  };
  return result;
}

// MARK: State const map
interface StateConstInfo {
  readonly literal: ObjectLiteralExpression;
  readonly typedAsState: boolean;
}

function collectStateConsts(sourceFile: SourceFile): Map<string, StateConstInfo> {
  const out = new Map<string, StateConstInfo>();
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const initializer = decl.getInitializer();
      if (!initializer || !Node.isObjectLiteralExpression(initializer)) {
        continue;
      }
      const typeNode = decl.getTypeNode();
      const typedAsState = typeNode ? typeNode.getText() === 'Ng2StateDeclaration' : false;
      out.set(decl.getName(), { literal: initializer, typedAsState });
    }
  }
  return out;
}

// MARK: Array discovery
function findStateArrayLiterals(sourceFile: SourceFile): readonly ArrayLiteralExpression[] {
  const arrays: ArrayLiteralExpression[] = [];

  // 2a: top-level `const X: Ng2StateDeclaration[] = [...]` or `const X = [literalOrIdent, ...]`
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const initializer = decl.getInitializer();
      if (initializer && Node.isArrayLiteralExpression(initializer) && declarationIsStateArray(stmt, decl.getName(), initializer)) {
        arrays.push(initializer);
      }
    }
  }

  // 2b: `provideStates({ states: [...] })` and `UIRouterModule.forChild({ states: [...] })`
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = call.getExpression();
    const exprText = expr.getText();
    const isProvide = exprText === 'provideStates';
    const isForChild = exprText.endsWith('.forChild') || exprText.endsWith('.forRoot');
    if (!isProvide && !isForChild) {
      continue;
    }
    for (const arg of call.getArguments()) {
      if (!Node.isObjectLiteralExpression(arg)) {
        continue;
      }
      const statesProp = arg.getProperty('states');
      if (!statesProp || !Node.isPropertyAssignment(statesProp)) {
        continue;
      }
      const initializer = statesProp.getInitializer();
      if (initializer && Node.isArrayLiteralExpression(initializer)) {
        arrays.push(initializer);
      } else if (initializer && Node.isIdentifier(initializer)) {
        // states: STATES — resolve to an array literal in the same file
        const referenced = findArrayLiteralForIdentifier(sourceFile, initializer);
        if (referenced) {
          arrays.push(referenced);
        }
      }
    }
  }

  return arrays;
}

function declarationIsStateArray(stmt: VariableStatement, name: string, literal: ArrayLiteralExpression): boolean {
  // Heuristic 1: explicit `: Ng2StateDeclaration[]` annotation
  const decl = stmt.getDeclarations().find((d) => d.getName() === name);
  const typeNode = decl?.getTypeNode();
  if (typeNode?.getText() === 'Ng2StateDeclaration[]') {
    return true;
  }
  // Heuristic 2: array contains at least one identifier or object literal that
  // already looks like a state (has `name:` string property)
  for (const element of literal.getElements()) {
    if (Node.isObjectLiteralExpression(element) && hasStringNameProperty(element)) {
      return true;
    }
    if (Node.isIdentifier(element)) {
      // We can't definitively know without resolution; defer to caller (only
      // identifiers that resolve to a typed state-const will produce nodes).
      return true;
    }
  }
  return false;
}

function hasStringNameProperty(literal: ObjectLiteralExpression): boolean {
  const nameProp = literal.getProperty('name');
  if (!nameProp || !Node.isPropertyAssignment(nameProp)) {
    return false;
  }
  const initializer = nameProp.getInitializer();
  return initializer !== undefined && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer));
}

function findArrayLiteralForIdentifier(sourceFile: SourceFile, identifier: Identifier): ArrayLiteralExpression | undefined {
  const name = identifier.getText();
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      if (decl.getName() !== name) {
        continue;
      }
      const initializer = decl.getInitializer();
      if (initializer && Node.isArrayLiteralExpression(initializer)) {
        return initializer;
      }
    }
  }
  return undefined;
}

/**
 * Options for adding a parsed state-object literal to the route tree.
 */
interface AddNodeOptions {
  readonly file: string;
  readonly literal: ObjectLiteralExpression;
  readonly fallbackConstName: string | undefined;
  readonly into: Map<string, RouteNode>;
  readonly issues: RouteIssue[];
}

// MARK: Single-state extraction
function addNode(options: AddNodeOptions): void {
  const { file, literal, fallbackConstName, into, issues } = options;
  const stringField = (key: string): string | undefined => stringPropertyValue(literal, key);
  const name = stringField('name');
  const line = literal.getStartLineNumber();
  if (!name) {
    // Either malformed or a dynamic name — flag as info and skip.
    issues.push({
      code: 'DYNAMIC_STATE_NAME',
      severity: 'info',
      message: fallbackConstName ? `State \`${fallbackConstName}\` has no string-literal \`name\` field; skipping.` : `State at line ${line} has no string-literal \`name\` field; skipping.`,
      file,
      line,
      stateName: undefined
    });
    return;
  }
  const futureState = name.endsWith('.**');
  const explicitParent = stringField('parent');
  const url = stringField('url');
  const redirectTo = stringField('redirectTo');
  const abstract = booleanPropertyValue(literal, 'abstract') ?? false;
  const component = identifierPropertyValue(literal, 'component');
  const paramKeys = objectPropertyKeys(literal, 'params');
  const resolveKeys = collectResolveKeys(literal);

  const node: RouteNode = {
    name,
    url,
    component,
    explicitParent,
    redirectTo,
    abstract,
    futureState,
    paramKeys,
    resolveKeys,
    file,
    line
  };

  // Same file may declare both `const layoutState: Ng2StateDeclaration = {...}`
  // and `const STATES = [layoutState]` — same object literal both times. Dedupe
  // by name within a file.
  if (!into.has(name)) {
    into.set(name, node);
  }
}

// MARK: Property helpers
function stringPropertyValue(literal: ObjectLiteralExpression, key: string): string | undefined {
  const prop = literal.getProperty(key);
  if (!prop || !Node.isPropertyAssignment(prop)) {
    return undefined;
  }
  const initializer = prop.getInitializer();
  if (!initializer) {
    return undefined;
  }
  if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer.getLiteralText();
  }
  return undefined;
}

function booleanPropertyValue(literal: ObjectLiteralExpression, key: string): boolean | undefined {
  const prop = literal.getProperty(key);
  if (!prop || !Node.isPropertyAssignment(prop)) {
    return undefined;
  }
  const initializer = prop.getInitializer();
  if (!initializer) {
    return undefined;
  }
  if (initializer.getKind() === SyntaxKind.TrueKeyword) {
    return true;
  }
  if (initializer.getKind() === SyntaxKind.FalseKeyword) {
    return false;
  }
  return undefined;
}

function identifierPropertyValue(literal: ObjectLiteralExpression, key: string): string | undefined {
  const prop = literal.getProperty(key);
  if (!prop || !Node.isPropertyAssignment(prop)) {
    return undefined;
  }
  const initializer = prop.getInitializer();
  if (!initializer) {
    return undefined;
  }
  if (Node.isIdentifier(initializer)) {
    return initializer.getText();
  }
  // PropertyAccessExpression like `Foo.Bar`
  if (Node.isPropertyAccessExpression(initializer)) {
    return initializer.getText();
  }
  return undefined;
}

function objectPropertyKeys(literal: ObjectLiteralExpression, key: string): readonly string[] {
  const prop = literal.getProperty(key);
  if (!prop || !Node.isPropertyAssignment(prop)) {
    return [];
  }
  const initializer = prop.getInitializer();
  if (!initializer || !Node.isObjectLiteralExpression(initializer)) {
    return [];
  }
  const out: string[] = [];
  for (const member of initializer.getProperties()) {
    if (Node.isPropertyAssignment(member) || Node.isShorthandPropertyAssignment(member) || Node.isMethodDeclaration(member)) {
      const nameNode = member.getNameNode();
      if (nameNode) {
        out.push(nameNode.getText());
      }
    }
  }
  return out;
}

function collectResolveKeys(literal: ObjectLiteralExpression): readonly string[] {
  const prop = literal.getProperty('resolve');
  if (!prop || !Node.isPropertyAssignment(prop)) {
    return [];
  }
  const initializer = prop.getInitializer();
  if (!initializer) {
    return [];
  }
  const keys: string[] = [];
  if (Node.isObjectLiteralExpression(initializer)) {
    for (const member of initializer.getProperties()) {
      if (Node.isPropertyAssignment(member) || Node.isShorthandPropertyAssignment(member) || Node.isMethodDeclaration(member)) {
        const nameNode = member.getNameNode();
        if (nameNode) {
          keys.push(nameNode.getText());
        }
      }
    }
  } else if (Node.isArrayLiteralExpression(initializer)) {
    for (const element of initializer.getElements()) {
      if (Node.isObjectLiteralExpression(element)) {
        const tokenProp = element.getProperty('token');
        if (tokenProp && Node.isPropertyAssignment(tokenProp)) {
          const tokenInit = tokenProp.getInitializer();
          if (tokenInit && (Node.isStringLiteral(tokenInit) || Node.isIdentifier(tokenInit))) {
            keys.push(tokenInit.getText().replace(/^['"]|['"]$/g, ''));
          }
        }
      }
    }
  }
  return keys;
}

// MARK: Imports for transitive resolution
function collectRelativeImports(sourceFile: SourceFile, fileName: string): readonly RelativeImport[] {
  const out: RelativeImport[] = [];
  for (const decl of sourceFile.getImportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue();
    if (specifier.startsWith('.')) {
      out.push({ moduleSpecifier: specifier, file: fileName });
    }
  }
  return out;
}
