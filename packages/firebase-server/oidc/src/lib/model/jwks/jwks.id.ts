import { type FirestoreModelId, type FirestoreModelKey } from '@dereekb/firebase';

/**
 * Document ID for a JwksKey. The kid (key identifier) string.
 */
export type JwksKeyId = FirestoreModelId;

/**
 * Full Firestore model key path for a JwksKey document.
 */
export type JwksKeyKey = FirestoreModelKey;
