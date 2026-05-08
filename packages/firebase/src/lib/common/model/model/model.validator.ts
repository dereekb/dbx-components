import { type } from 'arktype';
import { isFirestoreModelId, isFirestoreModelIdOrKey, isFirestoreModelKey } from '../../firestore/collection/collection';

/**
 * ArkType schema for a FirestoreModelKey (full path like "collection/12345").
 */
export const firestoreModelKeyType = /* @__PURE__ */ type('string > 0').narrow((val, ctx) => isFirestoreModelKey(val) || ctx.mustBe('a valid FirestoreModelKey'));

/**
 * ArkType schema for a FirestoreModelId (document ID like "12345").
 */
export const firestoreModelIdType = /* @__PURE__ */ type('string > 0').narrow((val, ctx) => isFirestoreModelId(val) || ctx.mustBe('a valid FirestoreModelId'));

/**
 * ArkType schema for a FirestoreModelId or FirestoreModelKey.
 */
export const firestoreModelIdOrKeyType = /* @__PURE__ */ type('string > 0').narrow((val, ctx) => isFirestoreModelIdOrKey(val) || ctx.mustBe('a valid FirestoreModelId or FirestoreModelKey'));
