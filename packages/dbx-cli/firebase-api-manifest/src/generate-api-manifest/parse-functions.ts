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
import { Node, Project, type SourceFile, type VariableDeclaration } from 'ts-morph';
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
    if (!isFunctionsConfigVariable(variable)) continue;
    const initializer = variable.getInitializer();
    if (!initializer || !Node.isObjectLiteralExpression(initializer)) continue;

    for (const property of initializer.getProperties()) {
      if (!Node.isPropertyAssignment(property)) continue;
      const groupKey = property.getName();
      const valueExpr = property.getInitializer();
      if (!valueExpr || !Node.isArrayLiteralExpression(valueExpr)) continue;

      const elements = valueExpr.getElements();
      if (elements.length === 0) continue;
      const first = elements[0];
      if (!Node.isIdentifier(first)) continue;

      const className = first.getText();
      const importedFromModule = importIdentToModule.get(className);
      if (!importedFromModule) continue;

      result.push({ groupKey, className, importedFromModule });
    }
  }

  return result;
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
