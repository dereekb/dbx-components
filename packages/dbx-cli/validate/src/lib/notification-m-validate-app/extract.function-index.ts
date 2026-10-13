/**
 * Index of the API side's named functions, shared by the notification extractors that chase factory calls
 * (`extract.ts`, `extract.taskbot.ts`).
 */

import { Node, type ArrowFunction, type FunctionDeclaration, type FunctionExpression, type SourceFile } from 'ts-morph';
import { apiRelPath, unwrapAsExpressions } from '../_core/_validate/ast.js';

/**
 * A named function declared in an API source file — a function declaration, or a variable initialized with an arrow
 * function or function expression.
 */
export interface ApiFunctionEntry {
  readonly node: FunctionDeclaration | ArrowFunction | FunctionExpression;
  readonly sourceFile: SourceFile;
  readonly relPath: string;
}

/**
 * Lookup of the API side's named functions by name.
 */
export interface ApiFunctionIndex {
  readonly functionsByName: ReadonlyMap<string, ApiFunctionEntry>;
}

/**
 * Indexes every named function across the given API sources. A later declaration with the same name replaces an
 * earlier one.
 *
 * @param sources - The API source files.
 * @returns The function index.
 */
export function buildApiFunctionIndex(sources: readonly SourceFile[]): ApiFunctionIndex {
  const map = new Map<string, ApiFunctionEntry>();
  for (const sf of sources) {
    const rel = apiRelPath(sf);
    indexFunctionDeclarations(sf, rel, map);
    indexFunctionVariableDeclarations(sf, rel, map);
  }
  const result: ApiFunctionIndex = { functionsByName: map };
  return result;
}

function indexFunctionDeclarations(sf: SourceFile, rel: string, map: Map<string, ApiFunctionEntry>): void {
  for (const fn of sf.getFunctions()) {
    const name = fn.getName();
    if (name) {
      map.set(name, { node: fn, sourceFile: sf, relPath: rel });
    }
  }
}

function indexFunctionVariableDeclarations(sf: SourceFile, rel: string, map: Map<string, ApiFunctionEntry>): void {
  for (const stmt of sf.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const initializer = unwrapAsExpressions(decl.getInitializer());
      if (!initializer) continue;
      if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
        map.set(decl.getName(), { node: initializer, sourceFile: sf, relPath: rel });
      }
    }
  }
}
