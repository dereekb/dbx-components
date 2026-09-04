import { type Maybe } from '@dereekb/util';
import {
  AbstractFirestoreDocument,
  type CollectionReference,
  type FirestoreCollection,
  type FirestoreContext,
  type SystemState,
  type SystemStateStoredData,
  type SystemStateStoredDataConverterMap,
  type SystemStateUnknownTypeBehavior,
  firestoreModelIdentity,
  systemStateConverter,
  systemStateStoredDataConverterFactory
} from '@dereekb/firebase';

// MARK: Collections
/**
 * Provides access to the {@link SystemStatePrivate} collection.
 *
 * Provided ONLY by a server module. This is deliberately never declared on an app's shared
 * `FirestoreCollections` class: `provideAppFirestoreCollections()` hard-codes a
 * `(context: FirestoreContext) => T` factory, which cannot carry the encryption secrets a private
 * converter needs — so the private collection structurally cannot leak into the client-shared
 * collection set.
 */
export abstract class SystemStatePrivateFirestoreCollections {
  abstract readonly systemStatePrivateCollection: SystemStatePrivateFirestoreCollection;
}

// MARK: Identity
/**
 * Firestore model identity for {@link SystemStatePrivate} documents.
 *
 * The server-only counterpart of `systemStateIdentity` from `@dereekb/firebase`. Same document
 * shape, same "document id is the type identifier" singleton convention — but a separate `sysp`
 * collection, so a secret-bearing document is never reachable through the client-shared SystemState
 * collection or the generic admin model service registered against it.
 *
 * This is a server-side only model. It has no provisions for client-side access, and deliberately
 * has NO `firestore.rules` match block — the implicit default-deny is what denies every client, and
 * a block here would only create an opportunity to grant access by accident.
 */
export const systemStatePrivateIdentity = firestoreModelIdentity('systemStatePrivate', 'sysp');

export class SystemStatePrivateDocument<T extends SystemStateStoredData = SystemStateStoredData> extends AbstractFirestoreDocument<SystemState<T>, SystemStatePrivateDocument<T>, typeof systemStatePrivateIdentity> {
  get modelIdentity() {
    return systemStatePrivateIdentity;
  }
}

// MARK: Collection
/**
 * Returns the Firestore {@link CollectionReference} for {@link SystemStatePrivate} documents.
 *
 * @param context - The Firestore context to create the collection reference from.
 * @returns The typed collection reference.
 */
export function systemStatePrivateCollectionReference(context: FirestoreContext): CollectionReference<SystemState> {
  return context.collection(systemStatePrivateIdentity.collectionName);
}

export type SystemStatePrivateFirestoreCollection<T extends SystemStateStoredData = SystemStateStoredData> = FirestoreCollection<SystemState<T>, SystemStatePrivateDocument<T>>;

/**
 * Configuration for creating a {@link SystemStatePrivateFirestoreCollection}.
 */
export interface SystemStatePrivateFirestoreCollectionConfig {
  readonly firestoreContext: FirestoreContext;
  /**
   * Server-only stored-data converters, keyed by SystemStateTypeIdentifier.
   */
  readonly converters: SystemStateStoredDataConverterMap;
  /**
   * Behavior when a document's type has no registered converter. Defaults to `error`.
   *
   * A private type that was not registered must never silently pass through — that would read a
   * secret-bearing document without its field mapping, returning encrypted fields as raw ciphertext
   * and dates as raw `Timestamp`s, with nothing to signal it.
   */
  readonly unknownTypeBehavior?: Maybe<SystemStateUnknownTypeBehavior>;
}

/**
 * Creates a {@link SystemStatePrivateFirestoreCollection}.
 *
 * @param config - The Firestore context, converters, and unknown-type behavior.
 * @returns The configured server-only SystemState collection.
 */
export function systemStatePrivateFirestoreCollection(config: SystemStatePrivateFirestoreCollectionConfig): SystemStatePrivateFirestoreCollection {
  const { firestoreContext, converters, unknownTypeBehavior } = config;

  return firestoreContext.firestoreCollection({
    modelIdentity: systemStatePrivateIdentity,
    converter: systemStateConverter,
    converterFactory: systemStateStoredDataConverterFactory({
      converters,
      unknownTypeBehavior: unknownTypeBehavior ?? 'error',
      collectionName: systemStatePrivateIdentity.collectionName
    }),
    collection: systemStatePrivateCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new SystemStatePrivateDocument(accessor, documentAccessor),
    firestoreContext
  });
}
