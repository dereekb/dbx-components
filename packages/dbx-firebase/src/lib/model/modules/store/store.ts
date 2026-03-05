import { type LockSetComponent } from '@dereekb/dbx-core';
import { type FirestoreDocument, type FirestoreCollectionLike, type FirestoreCollection, type FirestoreModelId, type FirestoreModelKey, type DocumentReference, type FirestoreAccessorStreamMode, type FlatFirestoreModelKey, type TwoWayFlatFirestoreModelKey, type FirestoreModelCollectionAndIdPair, type FirestoreModelCollectionAndIdPairObject, type DocumentSnapshot, type DocumentDataWithIdAndKey, type FirestoreModelIdentity } from '@dereekb/firebase';
import { type LoadingState, type ObservableOrValue } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { type Observable, type Subscription } from 'rxjs';

/**
 * Provides read-only accessors to a single model/document.
 *
 * Fields follow two naming conventions:
 * - `current*` fields emit {@link Maybe} values (including `undefined` when no value is present).
 * - Non-prefixed fields filter out `null`/`undefined` and only emit when a value is defined.
 * - `input*` fields reflect the raw identifier set by the caller (via `setId`, `setKey`, or `setRef`).
 * - Non-`input` identity fields (e.g., `id$`, `key$`) are derived from the resolved {@link FirestoreDocument}.
 */
export interface DbxFirebaseDocumentReadOnlyStore<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  /**
   * String used to identify the store. Typically only for debugging UI purposes.
   */
  readonly storeName$: Observable<Maybe<string>>;

  // MARK: Collection
  /**
   * The {@link FirestoreCollectionLike} used to resolve documents.
   *
   * If a {@link FirestoreCollection} is set, it takes priority over a {@link FirestoreCollectionLike}.
   * Only emits when a collection is available.
   */
  readonly firestoreCollectionLike$: Observable<FirestoreCollectionLike<T, D>>;
  /**
   * The {@link FirestoreCollection} used to resolve documents.
   *
   * Only emits when a strict {@link FirestoreCollection} (not just a {@link FirestoreCollectionLike}) is set.
   * Required for resolving documents by id (as opposed to key or ref).
   */
  readonly firestoreCollection$: Observable<FirestoreCollection<T, D>>;

  // MARK: Input
  /**
   * The raw document id string set by the caller via `setId()`.
   *
   * Emits `undefined` when no id has been set. Setting a key or ref clears the id (they are mutually exclusive).
   */
  readonly currentInputId$: Observable<Maybe<FirestoreModelId>>;
  /**
   * Non-nullable version of {@link currentInputId$}. Only emits when a defined id is set.
   */
  readonly inputId$: Observable<FirestoreModelId>;
  /**
   * The raw Firestore key path set by the caller via `setKey()`.
   *
   * Emits `undefined` when no key has been set.
   */
  readonly currentInputKey$: Observable<Maybe<FirestoreModelKey>>;
  /**
   * Non-nullable version of {@link currentInputKey$}. Only emits when a defined key is set.
   */
  readonly inputKey$: Observable<FirestoreModelKey>;
  /**
   * The raw {@link DocumentReference} set by the caller via `setRef()`.
   *
   * Emits `undefined` when no ref has been set.
   */
  readonly currentInputRef$: Observable<Maybe<DocumentReference<T>>>;
  /**
   * Non-nullable version of {@link currentInputRef$}. Only emits when a defined ref is set.
   */
  readonly inputRef$: Observable<DocumentReference<T>>;

  // MARK: Stream Mode
  /**
   * The current {@link FirestoreAccessorStreamMode} used when streaming snapshots.
   *
   * Defaults to `STREAM` (realtime `onSnapshot` subscriptions). Affects how {@link snapshot$} fetches data.
   */
  readonly streamMode$: Observable<FirestoreAccessorStreamMode>;

  // MARK: Document
  /**
   * The resolved {@link FirestoreDocument} based on the current input (id, key, or ref).
   *
   * Resolution priority: `ref > key > id`. Emits `undefined` when no input is set.
   * This represents the document accessor object, not the fetched Firestore data.
   */
  readonly currentDocument$: Observable<Maybe<D>>;
  /**
   * Non-nullable version of {@link currentDocument$}. Only emits once a document has been resolved.
   */
  readonly document$: Observable<D>;
  /**
   * The document id derived from the resolved {@link FirestoreDocument}.
   *
   * Unlike {@link currentInputId$}, this is available regardless of whether the input was an id, key, or ref.
   */
  readonly currentId$: Observable<Maybe<FirestoreModelId>>;
  /**
   * The full Firestore key path derived from the resolved {@link FirestoreDocument}.
   *
   * Unlike {@link currentInputKey$}, this is available regardless of whether the input was an id, key, or ref.
   */
  readonly currentKey$: Observable<Maybe<FirestoreModelKey>>;
  /**
   * Non-nullable version of {@link currentId$}. Only emits once a document has been resolved.
   */
  readonly id$: Observable<FirestoreModelId>;
  /**
   * Non-nullable version of {@link currentKey$}. Only emits once a document has been resolved.
   */
  readonly key$: Observable<FirestoreModelKey>;
  /**
   * The {@link DocumentReference} from the resolved document. Only emits once a document has been resolved.
   */
  readonly ref$: Observable<DocumentReference<T>>;
  /**
   * Whether the store currently points to a resolved document with a non-null reference.
   */
  readonly hasRef$: Observable<boolean>;
  /**
   * A flat (slash-replaced) string representation of the document key. Useful for URLs or flat identifiers.
   */
  readonly flatKey$: Observable<FlatFirestoreModelKey>;
  /**
   * A reversible flat string representation of the document key.
   */
  readonly twoWayFlatKey$: Observable<TwoWayFlatFirestoreModelKey>;

  // MARK: Key Decomposition
  /**
   * All id segments extracted from the document key path.
   *
   * For nested collections, this includes the full ancestor id chain.
   */
  readonly keyModelIds$: Observable<FirestoreModelId[]>;
  /**
   * Collection-and-id pairs for each segment in the document key path.
   */
  readonly keyPairs$: Observable<FirestoreModelCollectionAndIdPair[]>;
  /**
   * Collection-and-id pairs as a named object keyed by collection name.
   */
  readonly keyPairObject$: Observable<FirestoreModelCollectionAndIdPairObject>;

  // MARK: Data
  /**
   * {@link LoadingState} wrapper around the resolved document.
   *
   * Emits a loading state when no document is resolved yet, and a success state once a document object exists.
   * This reflects document resolution, not whether Firestore data has been fetched.
   */
  readonly documentLoadingState$: Observable<LoadingState<D>>;
  /**
   * Live Firestore snapshot stream for the resolved document.
   *
   * Uses the current {@link streamMode$} to determine streaming behavior (realtime vs one-shot).
   * Resubscribes when the document or stream mode changes.
   */
  readonly snapshot$: Observable<DocumentSnapshot<T>>;
  /**
   * {@link LoadingState} wrapper around {@link snapshot$}.
   *
   * Resets to loading when the document changes, then emits success with the snapshot.
   * Permission errors are caught and wrapped as error states.
   */
  readonly snapshotLoadingState$: Observable<LoadingState<DocumentSnapshot<T>>>;
  /**
   * The current document data extracted from the snapshot, or `undefined` while loading or on error.
   */
  readonly currentData$: Observable<Maybe<DocumentDataWithIdAndKey<T>>>;
  /**
   * Non-nullable version of {@link currentData$}. Only emits once Firestore data has arrived.
   *
   * Resets when the document changes and waits for the new document's data before emitting again.
   */
  readonly data$: Observable<DocumentDataWithIdAndKey<T>>;
  /**
   * {@link LoadingState} wrapper around the document data.
   *
   * If the snapshot exists but the document is not found in Firestore, emits an error state.
   */
  readonly dataLoadingState$: Observable<LoadingState<DocumentDataWithIdAndKey<T>>>;
  /**
   * Whether the dataLoadingState$ is currently loading.
   */
  readonly isLoadingData$: Observable<boolean>;
  /**
   * Whether the document exists in Firestore.
   *
   * Returns `false` while no document reference is set (via {@link hasRef$}), then delegates to {@link exists$}.
   * Prevents stale `true` values while transitioning between documents.
   */
  readonly currentExists$: Observable<boolean>;
  /**
   * Whether the document exists in Firestore.
   *
   * `true` if the document has data, `false` if not found. Permission-denied errors are treated as non-existent.
   */
  readonly exists$: Observable<boolean>;
  /**
   * The static {@link FirestoreModelIdentity} (type/collection metadata) from the collection, not from any specific document.
   */
  readonly modelIdentity$: Observable<FirestoreModelIdentity>;
}

/**
 * Provides accessors to a single model/document.
 */
export interface DbxFirebaseDocumentStore<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends DbxFirebaseDocumentReadOnlyStore<T, D>, LockSetComponent {
  /**
   * Sets the name of the store.
   */
  readonly setStoreName: (observableOrValue: ObservableOrValue<Maybe<string>>) => Subscription;

  /**
   * Sets the id of the document to load.
   */
  readonly setId: (observableOrValue: ObservableOrValue<Maybe<FirestoreModelId>>) => Subscription;

  /**
   * Sets the key of the document to load.
   */
  readonly setKey: (observableOrValue: ObservableOrValue<Maybe<FirestoreModelKey>>) => Subscription;

  /**
   * Sets the key of the document to load using a TwoWayFlatFirestoreModelKey.
   */
  readonly setFlatKey: (observableOrValue: ObservableOrValue<Maybe<TwoWayFlatFirestoreModelKey>>) => Subscription;

  /**
   * Sets the ref of the document to load.
   */
  readonly setRef: (observableOrValue: ObservableOrValue<Maybe<DocumentReference<T>>>) => Subscription;

  /**
   * Clears the key/id/ref and current document from the store.
   */
  readonly clearRefs: () => void;

  /**
   * Sets the stream mode.
   */
  readonly setStreamMode: (observableOrValue: ObservableOrValue<FirestoreAccessorStreamMode>) => Subscription;

  /**
   * Sets the FirestoreCollection to retrieve documents from.
   */
  readonly setFirestoreCollection: (() => void) | ((observableOrValue: ObservableOrValue<Maybe<FirestoreCollection<T, D>>>) => Subscription);

  /**
   * Sets the FirestoreCollectionLike to retrieve documents from.
   */
  readonly setFirestoreCollectionLike: (() => void) | ((observableOrValue: ObservableOrValue<Maybe<FirestoreCollectionLike<T, D>>>) => Subscription);
}
