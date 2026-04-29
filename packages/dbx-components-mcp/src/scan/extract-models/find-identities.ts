/**
 * Locates `export const <X>Identity = firestoreModelIdentity(...)` declarations
 * in a ts-morph source file. Mirrors the regex-based extractor in
 * `scripts/extract-firebase-models.mjs` (`findIdentities`) but operates on
 * the AST so generic call shapes round-trip cleanly.
 */

import { Node, type SourceFile } from 'ts-morph';
import type { ExtractedIdentity } from './types.js';

const FUNCTION_NAME = 'firestoreModelIdentity';

/**
 * Walks every `export const` declaration in the source file and pulls the
 * model-type / prefix / parent-identity arguments out of any
 * `firestoreModelIdentity(...)` call.
 *
 * Mirrors the `.mjs` 1/2/3-arg branching:
 *
 *   • `firestoreModelIdentity('user')` → `modelType: 'user'`
 *   • `firestoreModelIdentity('storageFile', 'sf')` → `modelType: 'storageFile'`, `prefix: 'sf'`
 *   • `firestoreModelIdentity(notificationBoxIdentity, 'notification')` → `parent: 'notificationBoxIdentity'`, `modelType: 'notification'`
 *   • `firestoreModelIdentity(guestbookIdentity, 'guestbookEntry', 'gbe')` → all three
 *
 * @param sf - the parsed source file to inspect
 * @returns the identity declarations in source order; entries with an
 *   unrecognisable shape are skipped
 */
export function findIdentities(sf: SourceFile): readonly ExtractedIdentity[] {
  const out: ExtractedIdentity[] = [];
  for (const statement of sf.getVariableStatements()) {
    if (!statement.isExported()) continue;
    for (const decl of statement.getDeclarations()) {
      const initializer = decl.getInitializer();
      if (!initializer || !Node.isCallExpression(initializer)) continue;
      if (initializer.getExpression().getText() !== FUNCTION_NAME) continue;
      const parsed = parseIdentityCall(initializer.getArguments());
      if (parsed) {
        out.push({ identityConst: decl.getName(), ...parsed });
      }
    }
  }
  return out;
}

interface ParsedIdentityArgs {
  readonly modelType: string;
  readonly collectionPrefix: string | undefined;
  readonly parentIdentityConst: string | undefined;
}

function parseIdentityCall(args: readonly Node[]): ParsedIdentityArgs | undefined {
  let result: ParsedIdentityArgs | undefined;
  if (args.length === 1) {
    const modelType = stringLiteralValue(args[0]);
    if (modelType !== undefined) {
      result = { modelType, collectionPrefix: undefined, parentIdentityConst: undefined };
    }
  } else if (args.length === 2) {
    const first = stringLiteralValue(args[0]);
    if (first !== undefined) {
      result = { modelType: first, collectionPrefix: stringLiteralValue(args[1]), parentIdentityConst: undefined };
    } else {
      const modelType = stringLiteralValue(args[1]);
      if (modelType !== undefined) {
        result = { modelType, collectionPrefix: undefined, parentIdentityConst: identifierName(args[0]) };
      }
    }
  } else if (args.length >= 3) {
    const modelType = stringLiteralValue(args[1]);
    if (modelType !== undefined) {
      result = { modelType, collectionPrefix: stringLiteralValue(args[2]), parentIdentityConst: identifierName(args[0]) };
    }
  }
  return result;
}

function stringLiteralValue(node: Node): string | undefined {
  let result: string | undefined;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    result = node.getLiteralText();
  }
  return result;
}

function identifierName(node: Node): string | undefined {
  let result: string | undefined;
  if (Node.isIdentifier(node)) {
    result = node.getText();
  }
  return result;
}
