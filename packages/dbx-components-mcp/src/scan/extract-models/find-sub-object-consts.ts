/**
 * Walks every `export const <name> = firestoreSubObject<T>(...)` /
 * `firestoreObjectArray<T>(...)` / `firestoreMap<T>(...)` declaration and
 * records the const-name → type-arg-interface mapping the rich catalog
 * uses to resolve sub-object converters back to their underlying
 * interface.
 */

import { Node, type CallExpression, type SourceFile, type VariableDeclaration } from 'ts-morph';
import type { ExtractedSubObjectConst } from './types.js';

const SUB_OBJECT_FACTORY_NAMES: ReadonlySet<ExtractedSubObjectConst['factoryName']> = new Set(['firestoreSubObject', 'firestoreObjectArray', 'firestoreMap']);

/**
 * Returns one entry per detected `firestoreSubObject<T>` /
 * `firestoreObjectArray<T>` / `firestoreMap<T>` declaration whose first
 * generic type-argument is a bare type-reference identifier. Inline
 * object types and generic parameters are skipped because they never
 * resolve to a declared interface.
 *
 * @param sf - the parsed source file to inspect
 * @returns one entry per detected sub-object factory const, in source order
 */
export function findSubObjectConsts(sf: SourceFile): readonly ExtractedSubObjectConst[] {
  const out: ExtractedSubObjectConst[] = [];
  for (const statement of sf.getVariableStatements()) {
    for (const decl of statement.getDeclarations()) {
      const entry = readSubObjectConst(decl);
      if (entry) out.push(entry);
    }
  }
  return out;
}

function readSubObjectConst(decl: VariableDeclaration): ExtractedSubObjectConst | undefined {
  const initializer = decl.getInitializer();
  if (!initializer || !Node.isCallExpression(initializer)) return undefined;
  const expr = initializer.getExpression();
  if (!Node.isIdentifier(expr)) return undefined;
  const factoryName = expr.getText() as ExtractedSubObjectConst['factoryName'];
  if (!SUB_OBJECT_FACTORY_NAMES.has(factoryName)) return undefined;
  const interfaceName = readInterfaceTypeArg(initializer);
  if (!interfaceName) return undefined;
  return { constName: decl.getName(), interfaceName, factoryName };
}

function readInterfaceTypeArg(call: CallExpression): string | undefined {
  const typeArgs = call.getTypeArguments();
  if (typeArgs.length === 0) return undefined;
  const first = typeArgs[0];
  if (!Node.isTypeReference(first)) return undefined;
  const nameNode = first.getTypeName();
  if (!Node.isIdentifier(nameNode)) return undefined;
  return nameNode.getText();
}
