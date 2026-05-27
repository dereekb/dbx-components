import { readFileSync } from 'node:fs';
import { parse } from '@typescript-eslint/typescript-estree';
import type { Maybe } from '@dereekb/util';
import { type AstNode, type ImportRegistry, createImportRegistry, trackImportDeclaration } from './util';
import { type FoldScope, type ImportedBindingResolver, type ResolvedBinding } from './storagefile-path-fold';

/**
 * The slice of `@typescript-eslint` parser services the cross-module resolver needs: the TS
 * `Program` and the ESTree→TS node map. Typed loosely so the resolver stays decoupled from a
 * specific `@typescript-eslint` version.
 */
export interface ParserServicesLike {
  readonly program?: {
    getTypeChecker(): unknown;
  };
  readonly esTreeNodeToTSNodeMap?: {
    get(node: AstNode): unknown;
  };
}

interface TypeChecker {
  getSymbolAtLocation(node: unknown): Maybe<TsSymbol>;
  getAliasedSymbol(symbol: TsSymbol): Maybe<TsSymbol>;
}

interface TsSymbol {
  getDeclarations(): Maybe<TsDeclaration[]>;
}

interface TsDeclaration {
  readonly kind: number;
  getSourceFile(): { readonly fileName: string };
}

interface ParsedModule {
  readonly program: AstNode;
  readonly importRegistry: ImportRegistry;
}

/**
 * Builds an {@link ImportedBindingResolver} backed by the TypeScript type checker, or null when
 * type information is unavailable (e.g. a lint config without `parserOptions.project`, or a
 * pure-AST test harness). The resolver performs a single hop: it maps an imported identifier in
 * the linted file to the declaration's source file, re-parses that file to ESTree (cached), and
 * returns the named binding plus that module's scope. Identifiers local to the resolved module
 * fold via the re-parsed program directly; transitive re-imports from a third module are not
 * followed.
 *
 * Every failure mode (no symbol, unreadable file, parse error, identifier from an already
 * re-parsed module) returns null so the analyzer falls back to reporting an unresolvable path —
 * it never throws into the lint pass.
 *
 * @param services - The parser services, when present.
 * @returns A resolver, or null when type information is unavailable.
 */
export function createImportedBindingResolver(services: Maybe<ParserServicesLike>): Maybe<ImportedBindingResolver> {
  let result: Maybe<ImportedBindingResolver> = null;
  if (services?.program && services.esTreeNodeToTSNodeMap) {
    const moduleCache: Map<string, Maybe<ParsedModule>> = new Map();
    result = {
      resolve(name: string, referenceNode: AstNode, fromScope: FoldScope): Maybe<ResolvedBinding> {
        return resolveBinding({ name, referenceNode, fromScope, services, moduleCache });
      }
    };
  }
  return result;
}

interface ResolveBindingInput {
  readonly name: string;
  readonly referenceNode: AstNode;
  readonly fromScope: FoldScope;
  readonly services: ParserServicesLike;
  readonly moduleCache: Map<string, Maybe<ParsedModule>>;
}

function resolveBinding(input: ResolveBindingInput): Maybe<ResolvedBinding> {
  const { name, referenceNode, services, moduleCache } = input;
  let result: Maybe<ResolvedBinding> = null;
  try {
    const fileName: Maybe<string> = declarationSourceFile(referenceNode, services);
    if (fileName) {
      const parsedModule: Maybe<ParsedModule> = loadModule(fileName, moduleCache);
      const node: Maybe<AstNode> = parsedModule ? findExportedBinding(parsedModule.program, name) : null;
      if (parsedModule && node) {
        result = { node, scope: { program: parsedModule.program, importRegistry: parsedModule.importRegistry, resolver: input.fromScope.resolver } };
      }
    }
  } catch {
    result = null;
  }
  return result;
}

/**
 * Maps a reference identifier to the absolute path of its declaration's source file via the
 * type checker, following an import alias when present. Returns null when the reference is not
 * in the current file's node map (e.g. it came from an already re-parsed module) or has no
 * resolvable declaration.
 *
 * @param referenceNode - The ESTree reference node in the linted file.
 * @param services - The parser services.
 * @returns The declaration's source file path, or null.
 */
function declarationSourceFile(referenceNode: AstNode, services: ParserServicesLike): Maybe<string> {
  let result: Maybe<string> = null;
  const tsNode: unknown = services.esTreeNodeToTSNodeMap?.get(referenceNode) ?? null;
  if (tsNode) {
    const checker: TypeChecker = services.program?.getTypeChecker() as TypeChecker;
    const symbol: Maybe<TsSymbol> = aliasedSymbol(checker, checker.getSymbolAtLocation(tsNode));
    const declarations: Maybe<TsDeclaration[]> = symbol?.getDeclarations() ?? null;
    const declaration: Maybe<TsDeclaration> = declarations?.find((decl) => isValueDeclarationKind(decl.kind)) ?? declarations?.[0] ?? null;
    result = declaration?.getSourceFile().fileName ?? null;
  }
  return result;
}

function aliasedSymbol(checker: TypeChecker, symbol: Maybe<TsSymbol>): Maybe<TsSymbol> {
  let result: Maybe<TsSymbol> = symbol;
  if (symbol) {
    try {
      result = checker.getAliasedSymbol(symbol) ?? symbol;
    } catch {
      result = symbol;
    }
  }
  return result;
}

/**
 * TS `SyntaxKind` values for the declarations we fold: `VariableDeclaration` (244) and
 * `FunctionDeclaration` (262) in TypeScript 5.x. Other kinds (interfaces, type aliases) carry no
 * foldable value.
 *
 * @param kind - The TS `SyntaxKind` numeric value.
 * @returns True when the declaration kind can carry a foldable value.
 */
function isValueDeclarationKind(kind: number): boolean {
  return kind === 244 || kind === 262;
}

/**
 * Reads and parses a module to ESTree, indexing its imports, caching by absolute path. A
 * `null` cache entry records an unreadable/unparsable file so repeated lookups stay cheap.
 *
 * @param fileName - The absolute module path.
 * @param cache - The per-resolver module cache.
 * @returns The parsed module, or null.
 */
function loadModule(fileName: string, cache: Map<string, Maybe<ParsedModule>>): Maybe<ParsedModule> {
  let result: Maybe<ParsedModule>;
  if (cache.has(fileName)) {
    result = cache.get(fileName) ?? null;
  } else {
    result = null;
    try {
      const source: string = readFileSync(fileName, 'utf8');
      const program: AstNode = parse(source, { range: true, loc: true, jsx: false }) as unknown as AstNode;
      const importRegistry: ImportRegistry = createImportRegistry();
      for (const statement of program.body ?? []) {
        if (statement?.type === 'ImportDeclaration') {
          trackImportDeclaration(importRegistry, statement);
        }
      }
      result = { program, importRegistry };
    } catch {
      result = null;
    }
    cache.set(fileName, result);
  }
  return result;
}

/**
 * Finds the named top-level binding in a re-parsed module: the matching `VariableDeclarator`
 * (with initializer) or `FunctionDeclaration`, looking through `export` wrappers.
 *
 * @param programNode - The module's Program node.
 * @param name - The binding name.
 * @returns The binding node, or null.
 */
function findExportedBinding(programNode: AstNode, name: string): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  for (const statement of programNode?.body ?? []) {
    const declaration: AstNode = statement?.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type === 'FunctionDeclaration' && declaration.id?.name === name) {
      result = declaration;
    } else if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations ?? []) {
        if (declarator.id?.type === 'Identifier' && declarator.id.name === name && declarator.init) {
          result = declarator;
        }
      }
    }
  }
  return result;
}
