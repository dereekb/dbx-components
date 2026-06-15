/**
 * Locates `export const <X>Identity = firestoreModelIdentity(...)` declarations
 * in a ts-morph source file. Mirrors the regex-based extractor in
 * `scripts/extract-firebase-models.mjs` (`findIdentities`) but operates on
 * the AST so generic call shapes round-trip cleanly.
 */

import { Node, type SourceFile } from 'ts-morph';
import { parseFirestoreModelIdentityArgs } from '../../../scan-helpers/firestore-model-extract-utils.js';
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
 * @param sf - The parsed source file to inspect.
 * @returns The identity declarations in source order; entries with an
 *   unrecognisable shape are skipped.
 */
export function findIdentities(sf: SourceFile): readonly ExtractedIdentity[] {
  const out: ExtractedIdentity[] = [];
  for (const statement of sf.getVariableStatements()) {
    if (!statement.isExported()) continue;
    for (const decl of statement.getDeclarations()) {
      const initializer = decl.getInitializer();
      if (!initializer || !Node.isCallExpression(initializer)) continue;
      if (initializer.getExpression().getText() !== FUNCTION_NAME) continue;
      const parsed = parseFirestoreModelIdentityArgs(initializer.getArguments());
      if (parsed) {
        out.push({ identityConst: decl.getName(), ...parsed });
      }
    }
  }
  return out;
}
