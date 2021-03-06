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
