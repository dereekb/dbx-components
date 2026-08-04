import { describe, expect, it } from 'vitest';
import { beginLoading, errorResult, successResult } from '@dereekb/rxjs';
import { type DocumentDataWithIdAndKey, FIRESTORE_PERMISSION_DENIED_ERROR_CODE, type UserExternalConnection } from '@dereekb/firebase';
import { readableError } from '@dereekb/util';
import { DBX_FIREBASE_MODEL_DOES_NOT_EXIST_ERROR } from '../../../model/error';
import { externalConnectionsLoadingStateFromDocumentLoadingState, shouldCreateUserExternalConnectionForDocumentLoadingState } from './userexternalconnection.store';

const now = new Date();

function documentData(connection: Partial<UserExternalConnection>): DocumentDataWithIdAndKey<UserExternalConnection> {
  return {
    id: 'testuid',
    key: 'uec/testuid',
    uid: 'testuid',
    e: {},
    c: [],
    uat: now,
    ...connection
  } as DocumentDataWithIdAndKey<UserExternalConnection>;
}

describe('externalConnectionsLoadingStateFromDocumentLoadingState()', () => {
  it('should return the entry map when the document loaded', () => {
    const entry = { st: 'connected' as const, uat: now };
    const result = externalConnectionsLoadingStateFromDocumentLoadingState(successResult(documentData({ e: { calcom: entry } })));

    expect(result.value).toBeDefined();
    expect(result.value?.['calcom']).toBe(entry);
  });

  it('should return an empty map when the document does not exist', () => {
    // a user who has never connected anything has no document. That is the common case, not an error.
    const result = externalConnectionsLoadingStateFromDocumentLoadingState(errorResult(readableError(DBX_FIREBASE_MODEL_DOES_NOT_EXIST_ERROR, 'The document does not exist.')));

    expect(result.error).not.toBeDefined();
    expect(result.value).toBeDefined();
    expect(Object.keys(result.value ?? {}).length).toBe(0);
  });

  it('should return an empty map when the read was denied', () => {
    const result = externalConnectionsLoadingStateFromDocumentLoadingState(errorResult(readableError(FIRESTORE_PERMISSION_DENIED_ERROR_CODE, 'denied')));

    expect(result.error).not.toBeDefined();
    expect(result.value).toBeDefined();
    expect(Object.keys(result.value ?? {}).length).toBe(0);
  });

  it('should pass any other error through', () => {
    const result = externalConnectionsLoadingStateFromDocumentLoadingState(errorResult(readableError('UNAVAILABLE', 'offline')));

    expect(result.error?.code).toBe('UNAVAILABLE');
    expect(result.value).not.toBeDefined();
  });

  it('should stay loading while the document is loading', () => {
    const result = externalConnectionsLoadingStateFromDocumentLoadingState(beginLoading<DocumentDataWithIdAndKey<UserExternalConnection>>());

    expect(result.error).not.toBeDefined();
    expect(result.value).not.toBeDefined();
  });
});

describe('shouldCreateUserExternalConnectionForDocumentLoadingState()', () => {
  it('should create when the document does not exist', () => {
    expect(shouldCreateUserExternalConnectionForDocumentLoadingState(errorResult(readableError(DBX_FIREBASE_MODEL_DOES_NOT_EXIST_ERROR, 'The document does not exist.')))).toBe(true);
  });

  it('should not create while the document is still loading', () => {
    // a loading state has no value, which would otherwise read as "missing" for a user who has one
    expect(shouldCreateUserExternalConnectionForDocumentLoadingState(beginLoading<DocumentDataWithIdAndKey<UserExternalConnection>>())).toBe(false);
  });

  it('should not create when the document loaded', () => {
    expect(shouldCreateUserExternalConnectionForDocumentLoadingState(successResult(documentData({})))).toBe(false);
  });

  it('should not create when the read was denied', () => {
    // a denied read is a rules problem — creating would not make the document readable
    expect(shouldCreateUserExternalConnectionForDocumentLoadingState(errorResult(readableError(FIRESTORE_PERMISSION_DENIED_ERROR_CODE, 'denied')))).toBe(false);
  });

  it('should not create on an unrelated error', () => {
    expect(shouldCreateUserExternalConnectionForDocumentLoadingState(errorResult(readableError('UNAVAILABLE', 'offline')))).toBe(false);
  });
});
