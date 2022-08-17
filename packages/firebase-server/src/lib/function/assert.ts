import { FirestoreDocument, FirestoreDocumentData } from '@dereekb/firebase';
import * as functions from 'firebase-functions';
import { isContextWithAuthData } from './context';
import { modelNotAvailableError, unauthenticatedContextHasNoUidError } from './error';

export function assertContextHasAuth(context: functions.https.CallableContext): void {
  if (!isContextWithAuthData(context)) {
    throw unauthenticatedContextHasNoUidError();
  }
}

/**
 * Attempts to load data from the document. A modelNotAvailableError is thrown if the snapshot data is null/undefined (the document does not exist).
 *
 * @param document
 * @param message
 * @returns
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
 * Asserts that the document exists. A modelNotAvailableError is thrown if the document does not exist.
 *
 * @param document
 * @param message
 * @returns
 */
export async function assertDocumentExists<D extends FirestoreDocument<any>>(document: D, message?: string): Promise<void> {
  const exists = await document.exists();

  if (!exists) {
    throw modelNotAvailableError({
      message: message ?? `The ${document.modelType} was unavailable.`
    });
  }
}
