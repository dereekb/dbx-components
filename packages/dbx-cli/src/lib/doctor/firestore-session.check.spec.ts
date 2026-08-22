import { describe, expect, it } from 'vitest';
import { type CliFirestoreBinding } from '../firestore/firestore.models';
import { type CliFirestoreQueryManifest, type CliModelManifest } from '../manifest/types';
import { buildFirestoreSessionDoctorReadRouting } from './firestore-session.check';

const BINDING = { collections: () => ({}), models: (() => ({})) as never } as CliFirestoreBinding;

const MODEL_MANIFEST = [
  { modelType: 'guestbook', collectionPrefix: 'gb' },
  { modelType: 'systemState', collectionPrefix: 'sys', serverOnly: true },
  { modelType: 'notification', collectionPrefix: 'nbn', serverOnly: true }
] as unknown as CliModelManifest;

const QUERY_MANIFEST = [{ slug: 'a', factory: () => [] }, { slug: 'b', factory: () => [] }, { slug: 'c' }] as unknown as CliFirestoreQueryManifest;

/**
 * A manifest generated WITH `--rules`: one plain model query, one runnable only under `--parent`,
 * and one the rules refuse at every scope despite its factory binding fine.
 */
const SCANNED_QUERY_MANIFEST = [
  { slug: 'model', factory: () => [], queryMode: 'model', rules: { list: 'allowed', collectionGroup: true } },
  { slug: 'parent-child', factory: () => [], queryMode: 'parent-child', rules: { list: 'allowed', collectionGroup: false, reason: 'no-collection-group-rule' } },
  { slug: 'unavailable', factory: () => [], queryMode: 'unavailable', rules: { list: 'unmatched', collectionGroup: false, reason: 'list-unmatched' } }
] as unknown as CliFirestoreQueryManifest;

describe('buildFirestoreSessionDoctorReadRouting()', () => {
  it('prefers firestore when the whole chain resolved', () => {
    const routing = buildFirestoreSessionDoctorReadRouting({ firestore: BINDING, firebaseConfigComplete: true, sessionOpened: true });

    expect(routing.getFirestoreModels).toBe(true);
    expect(routing.readPreference).toBe('firestore');
    expect(routing.reason).toBe('session-available');
  });

  it('reports no-firestore-binding when the CLI has no binding', () => {
    const routing = buildFirestoreSessionDoctorReadRouting({ firebaseConfigComplete: true, sessionOpened: true });

    expect(routing.getFirestoreModels).toBe(false);
    expect(routing.readPreference).toBe('api');
    expect(routing.reason).toBe('no-firestore-binding');
  });

  it('reports firebase-config-incomplete ahead of the session state', () => {
    const routing = buildFirestoreSessionDoctorReadRouting({ firestore: BINDING, firebaseConfigComplete: false, sessionOpened: false });

    expect(routing.readPreference).toBe('api');
    expect(routing.reason).toBe('firebase-config-incomplete');
  });

  it('reports session-unavailable when the chain is wired but the handshake failed', () => {
    const routing = buildFirestoreSessionDoctorReadRouting({ firestore: BINDING, firebaseConfigComplete: true, sessionOpened: false });

    expect(routing.readPreference).toBe('api');
    expect(routing.reason).toBe('session-unavailable');
  });

  it('counts only the invocable query entries', () => {
    const routing = buildFirestoreSessionDoctorReadRouting({ firestoreQueryManifest: QUERY_MANIFEST, firebaseConfigComplete: true, sessionOpened: true });

    expect(routing.totalQueryEntries).toBe(3);
    expect(routing.invocableQueryEntries).toBe(2);
  });

  it('reports the modes as unscanned when the manifest carries none', () => {
    const routing = buildFirestoreSessionDoctorReadRouting({ firestoreQueryManifest: QUERY_MANIFEST, firebaseConfigComplete: true, sessionOpened: true });

    // the zeroes below are structural, not a clean bill of health — this flag is what says so
    expect(routing.queryModesScanned).toBe(false);
    expect(routing.unavailableQueryEntries).toBe(0);
  });

  it('excludes an unavailable entry from the invocable count', () => {
    // the reported bug: `invocableQueryEntries: 128/128` while ~1/3 of the catalog was a guaranteed
    // permission-denied
    const routing = buildFirestoreSessionDoctorReadRouting({ firestoreQueryManifest: SCANNED_QUERY_MANIFEST, firebaseConfigComplete: true, sessionOpened: true });

    expect(routing.totalQueryEntries).toBe(3);
    expect(routing.invocableQueryEntries).toBe(2);
    expect(routing.queryModesScanned).toBe(true);
  });

  it('surfaces the unavailable and parent-child counts the way serverOnlyModels is surfaced', () => {
    const routing = buildFirestoreSessionDoctorReadRouting({ firestoreQueryManifest: SCANNED_QUERY_MANIFEST, firebaseConfigComplete: true, sessionOpened: true });

    expect(routing.unavailableQueryEntries).toBe(1);
    expect(routing.parentChildQueryEntries).toBe(1);
  });

  it('counts the server-only models', () => {
    const routing = buildFirestoreSessionDoctorReadRouting({ modelManifest: MODEL_MANIFEST, firebaseConfigComplete: true, sessionOpened: true });
    expect(routing.serverOnlyModels).toBe(2);
  });

  it('reports zero counts when no manifests were supplied', () => {
    const routing = buildFirestoreSessionDoctorReadRouting({ firebaseConfigComplete: true, sessionOpened: true });

    expect(routing.totalQueryEntries).toBe(0);
    expect(routing.invocableQueryEntries).toBe(0);
    expect(routing.unavailableQueryEntries).toBe(0);
    expect(routing.parentChildQueryEntries).toBe(0);
    expect(routing.queryModesScanned).toBe(false);
    expect(routing.serverOnlyModels).toBe(0);
  });
});
