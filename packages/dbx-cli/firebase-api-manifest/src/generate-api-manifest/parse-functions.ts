/**
 * Parses the `<APP>_FIREBASE_FUNCTIONS_CONFIG` variable from a CLI app's
 * `functions.ts` and returns the (groupKey, className, importedFromModule)
 * tuple for every entry.
 *
 * We follow the import declaration of the abstract-class identifier to know
 * which package the `*.api.ts` lives in. The variable name is matched
 * generically by `/FIREBASE_FUNCTIONS_CONFIG$/` so any app-prefix works.
 */

import { readFileSync } from 'node:fs';
import { Node, Project, type ObjectLiteralElementLike, type ObjectLiteralExpression, type SourceFile, type VariableDeclaration } from 'ts-morph';
import type { FunctionsGroup } from './types';

/**
 * Parses the `<APP>_FIREBASE_FUNCTIONS_CONFIG` literal at `functionsTsPath`
 * into one entry per group declared in the config object.
 *
 * @param functionsTsPath - Absolute path to the app's `functions.ts`.
 * @returns One {@link FunctionsGroup} per `<groupKey>: [<Class>, ...]` pair.
 */
export function parseFunctionsConfig(functionsTsPath: string): FunctionsGroup[] {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const text = readFileSync(functionsTsPath, 'utf8');
  const sourceFile = project.createSourceFile('functions.ts', text, { overwrite: true });

  const importIdentToModule = collectImportSpecifierMap(sourceFile);
  const result: FunctionsGroup[] = [];

  for (const variable of sourceFile.getVariableDeclarations()) {
    const initializer = readFunctionsConfigInitializer(variable);
    if (initializer) collectGroupsFromConfig(initializer, importIdentToModule, result);
  }

  return result;
}

function readFunctionsConfigInitializer(variable: VariableDeclaration): ObjectLiteralExpression | undefined {
  let result: ObjectLiteralExpression | undefined;
  if (isFunctionsConfigVariable(variable)) {
    const initializer = variable.getInitializer();
    if (initializer && Node.isObjectLiteralExpression(initializer)) result = initializer;
  }
  return result;
}

function collectGroupsFromConfig(initializer: ObjectLiteralExpression, importIdentToModule: ReadonlyMap<string, string>, sink: FunctionsGroup[]): void {
  for (const property of initializer.getProperties()) {
    const group = readGroupFromProperty(property, importIdentToModule);
    if (group) sink.push(group);
  }
}

function readGroupFromProperty(property: ObjectLiteralElementLike, importIdentToModule: ReadonlyMap<string, string>): FunctionsGroup | undefined {
  if (!Node.isPropertyAssignment(property)) return undefined;
  const valueExpr = property.getInitializer();
  if (!valueExpr || !Node.isArrayLiteralExpression(valueExpr)) return undefined;
  const first = valueExpr.getElements()[0];
  if (!first || !Node.isIdentifier(first)) return undefined;
  const className = first.getText();
  const importedFromModule = importIdentToModule.get(className);
  if (!importedFromModule) return undefined;
  return { groupKey: property.getName(), className, importedFromModule };
}

function isFunctionsConfigVariable(variable: VariableDeclaration): boolean {
  const name = variable.getName();
  return name.endsWith('FIREBASE_FUNCTIONS_CONFIG');
}

function collectImportSpecifierMap(sourceFile: SourceFile): Map<string, string> {
  const map = new Map<string, string>();
  for (const decl of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = decl.getModuleSpecifierValue();
    for (const named of decl.getNamedImports()) {
      const localName = named.getAliasNode()?.getText() ?? named.getName();
      map.set(localName, moduleSpecifier);
    }
  }
  return map;
}
