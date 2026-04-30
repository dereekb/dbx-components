/**
 * Finds `export const <x>Converter = snapshotConverterFunctions<<X>>({ fields: { ... } })`
 * declarations and reads the canonical persisted-field list straight off the AST.
 *
 * Mirrors `findConverters` + `parseFieldsBody` in the `.mjs` extractor; the
 * AST replaces the manual brace/string state machine with ts-morph
 * `getProperties()` walks.
 */

import { Node, type CallExpression, type ObjectLiteralExpression, type SourceFile, type VariableDeclaration } from 'ts-morph';
import type { ExtractedConverter } from './types.js';

const FUNCTION_NAME = 'snapshotConverterFunctions';

/**
 * Walks every exported variable declaration in the source file and returns
 * the converter consts whose initializer is a `snapshotConverterFunctions`
 * call.
 *
 * @param sf - the parsed source file to inspect
 * @returns one entry per detected converter
 */
export function findConverters(sf: SourceFile): readonly ExtractedConverter[] {
  const out: ExtractedConverter[] = [];
  for (const statement of sf.getVariableStatements()) {
    if (!statement.isExported()) continue;
    for (const decl of statement.getDeclarations()) {
      const converter = readConverter(decl);
      if (converter) out.push(converter);
    }
  }
  return out;
}

function readConverter(decl: VariableDeclaration): ExtractedConverter | undefined {
  const initializer = decl.getInitializer();
  if (!initializer || !Node.isCallExpression(initializer)) return undefined;
  if (initializer.getExpression().getText() !== FUNCTION_NAME) return undefined;
  const interfaceName = readInterfaceTypeArg(initializer);
  if (!interfaceName) return undefined;
  const fields = readConverterFields(initializer);
  if (!fields) return undefined;
  return { converterConst: decl.getName(), interfaceName, fields };
}

function readInterfaceTypeArg(call: CallExpression): string | undefined {
  const typeArgs = call.getTypeArguments();
  let result: string | undefined;
  if (typeArgs.length > 0) {
    result = typeArgs[0]
      .getText()
      .replaceAll(/<[^>]*>/g, '')
      .trim();
  }
  return result;
}

function readConverterFields(call: CallExpression): readonly { readonly key: string; readonly converter: string }[] | undefined {
  const args = call.getArguments();
  if (args.length === 0) return undefined;
  const config = args[0];
  if (!Node.isObjectLiteralExpression(config)) return undefined;
  const fieldsProp = config.getProperty('fields');
  if (!fieldsProp || !Node.isPropertyAssignment(fieldsProp)) return undefined;
  const fieldsValue = fieldsProp.getInitializer();
  if (!fieldsValue || !Node.isObjectLiteralExpression(fieldsValue)) return undefined;
  return readFieldEntries(fieldsValue);
}

function readFieldEntries(fields: ObjectLiteralExpression): readonly { readonly key: string; readonly converter: string }[] {
  const out: { readonly key: string; readonly converter: string }[] = [];
  for (const property of fields.getProperties()) {
    if (Node.isPropertyAssignment(property)) {
      const initializer = property.getInitializer();
      out.push({ key: property.getName(), converter: initializer ? initializer.getText().replaceAll(/\s+/g, ' ').trim() : '' });
    } else if (Node.isShorthandPropertyAssignment(property)) {
      out.push({ key: property.getName(), converter: property.getName() });
    }
  }
  return out;
}
