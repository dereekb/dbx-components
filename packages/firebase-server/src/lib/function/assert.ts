import { type DocumentDataWithIdAndKey, type FirestoreDocument, type FirestoreDocumentData, setIdAndKeyFromKeyIdRefOnDocumentData } from '@dereekb/firebase';
import { isContextWithAuthData } from './context';
import { modelNotAvailableError, unauthenticatedContextHasNoUidError } from './error';
import { type CallableContext } from '../type';

/**
 * Asserts that the callable context contains auth data with a valid UID.
 *
 * @param context - The callable context to check for auth data.
 * @throws {HttpsError} Throws unauthenticated error if no auth data is present.
 *
 * @example
 * ```typescript
 * assertContextHasAuth(context);
 * // Safe to access context.auth.uid
 * ```
 */
export function assertContextHasAuth(context: CallableContext): void {
  if (!isContextWithAuthData(context)) {
    throw unauthenticatedContextHasNoUidError();
  }
}

/**
 * Loads the snapshot data from a Firestore document, throwing if the document does not exist.
 *
 * @param document - The Firestore document to load data from.
 * @param message - Optional custom error message.
 * @returns The document's snapshot data.
 * @throws {HttpsError} Throws a {@link modelNotAvailableError} (404) if the document has no data.
 *
 * @example
 * ```typescript
 * const userData = await assertSnapshotData(userDocument);
 * ```
 */
export async function assertSnapshotData<D extends FirestoreDocument<any>>(document: D, message?: string): Promise<FirestoreDocumentData<D>> {
  const data = await document.snapshotData();

  if (data == null) {
    throw modelNotAvailableError({
      message: message ?? `The ${document.modelType} was unavailable.`
    });
  }

  return data;
}

/**
 * Loads snapshot data and attaches the document's `id` and `key` to the result.
 *
 * Combines {@link assertSnapshotData} with {@link setIdAndKeyFromKeyIdRefOnDocumentData}.
 *
 * @param document - The Firestore document to load data from.
 * @param message - Optional custom error message.
 * @returns The document's snapshot data with `id` and `key` attached.
 * @throws {HttpsError} Throws a {@link modelNotAvailableError} (404) if the document has no data.
 */
export async function assertSnapshotDataWithKey<D extends FirestoreDocument<any>>(document: D, message?: string): Promise<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>> {
  const data = await assertSnapshotData(document, message);
  return setIdAndKeyFromKeyIdRefOnDocumentData(data, document);
}

/**
 * Asserts that the Firestore document exists without loading its data.
 *
 * @param document - The Firestore document to check.
 * @param message - Optional custom error message.
 * @throws {HttpsError} Throws a {@link modelNotAvailableError} (404) if the document does not exist.
 */
export async function assertDocumentExists<D extends FirestoreDocument<any>>(document: D, message?: string): Promise<void> {
  const exists = await document.exists();

  if (!exists) {
    throw documentModelNotAvailableError(document, message);
  }
}

/**
 * Creates a {@link modelNotAvailableError} for the given document's model type.
 *
 * Used by {@link assertDocumentExists} and other assertion functions.
 *
 * @param document - The document (or object with `modelType`) to generate the error for.
 * @param message - Optional custom error message.
 * @returns A {@link modelNotAvailableError} with the document's model type in the message.
 */
export function documentModelNotAvailableError(document: Pick<FirestoreDocument<any>, 'modelType'>, message?: string) {
  return modelNotAvailableError({
    message: message ?? `The ${document.modelType} was unavailable.`
  });
}
