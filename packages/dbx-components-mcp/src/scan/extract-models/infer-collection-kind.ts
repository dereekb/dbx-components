/**
 * Builds a map of `<modelType>FirestoreCollection(Factory)?` factory function
 * names to the {@link FirestoreCollectionKind} their body declares.
 *
 * Mirrors the `findCollectionFactoryCalls` + `detectCollectionKindInBody`
 * pair in `scripts/extract-firebase-models.mjs`. The kind is read off the
 * first matching `firestoreContext.<method>(...)` call inside each
 * function body — the pattern matches whether the call is direct
 * (`firestoreContext.firestoreCollection({...})`) or returned from an
 * inner factory closure.
 */

import { type FunctionDeclaration, type SourceFile } from 'ts-morph';
import type { FirestoreCollectionKind } from '../../tools/model-validate/types.js';

const COLLECTION_CALL_RE = /\.(firestoreCollection|rootSingleItemFirestoreCollection|firestoreCollectionWithParent|singleItemFirestoreCollection)\s*\(/g;

const KIND_BY_METHOD: Readonly<Record<string, FirestoreCollectionKind>> = {
  firestoreCollection: 'root',
  rootSingleItemFirestoreCollection: 'root-singleton',
  firestoreCollectionWithParent: 'sub-collection',
  singleItemFirestoreCollection: 'singleton-sub'
};

/**
 * Returns a map of factory function name to its declared
 * {@link FirestoreCollectionKind}. Functions that don't make a recognised
 * `firestoreContext.*` call are omitted.
 *
 * @param sf - the parsed source file to inspect
 * @returns the factory-name → kind map (may be empty)
 */
export function findCollectionFactoryCalls(sf: SourceFile): ReadonlyMap<string, FirestoreCollectionKind> {
  const out = new Map<string, FirestoreCollectionKind>();
  for (const fn of sf.getFunctions()) {
    if (!fn.isExported()) continue;
    const kind = detectKind(fn);
    if (kind) {
      const name = fn.getName();
      if (name) out.set(name, kind);
    }
  }
  return out;
}

function detectKind(fn: FunctionDeclaration): FirestoreCollectionKind | undefined {
  const body = fn.getBody()?.getText() ?? '';
  let result: FirestoreCollectionKind | undefined;
  COLLECTION_CALL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = COLLECTION_CALL_RE.exec(body)) !== null) {
    const kind = KIND_BY_METHOD[match[1]];
    if (kind) {
      result = kind;
      break;
    }
  }
  return result;
}
