import { type Maybe } from '@dereekb/util';
import { type GrantedReadRole, type GrantedUpdateRole, type GrantedDeleteRole } from '@dereekb/model';
import { AbstractFirestoreDocument, type CollectionReference, type FirestoreCollection, type FirestoreContext, type FirebaseAuthOwnershipKey, type FirebaseAuthUserId, type FirestoreModelKey, firestoreDate, firestoreEnum, firestoreModelIdentity, firestoreNumber, firestoreString, firestoreUID, optionalFirestoreDate, optionalFirestorePassthroughJsonField, optionalFirestoreString, snapshotConverterFunctions } from '../../common';
import { type NotificationKey } from '../notification/notification.id';
import { type FormSpaceType } from './formspace.id';

/**
 * @module formspace
 *
 * Defines the FormSpace Firestore model: a generic, type-registered container that parks a client-side
 * form's JSON while the user fills it out, accepts a bounded set of file uploads against it, and hands the
 * finished result to server code that knows what to do with it.
 *
 * **Why one document.** The form's own values live embedded in `d` as pass-through JSON. Files are the
 * thing that is actually large, and they live in GCS as ordinary {@link StorageFile}s inside a
 * {@link StorageFileGroup} keyed by the FormSpace — so every existing sync / zip / delete behaviour applies
 * unchanged and the document itself stays far under Firestore's 1 MiB ceiling.
 *
 * **Submission.** Submitting stamps `sat`, locks the space out of further edits, and moves `ps` to
 * QUEUED_FOR_PROCESSING. A NotificationTask keyed by the space then dispatches to the registered
 * server-side handler for its type, inheriting the checkpoint / retry / delay semantics every other task in
 * the system already uses. `ps` mirrors {@link StorageFileProcessingState} field-for-field for exactly that
 * reason: it is the same lifecycle.
 */

// MARK: FormSpace
/**
 * Model identity for the FormSpace collection (collection name: `formSpace`, prefix: `fsp`).
 *
 * Deliberately not `fs`: too easy to misread against `sf` (StorageFile) in `firestore.rules`.
 */
export const formSpaceIdentity = firestoreModelIdentity('formSpace', 'fsp');

/**
 * Lifecycle state of a {@link FormSpace}.
 *
 * Only DRAFT is editable. The other three are terminal for the owner: SUBMITTED is awaiting or undergoing
 * processing, EXPIRED was retired by the sweep before it was ever submitted, and ARCHIVED is a space kept
 * for the record after its processing concluded.
 */
export enum FormSpaceState {
  DRAFT = 0,
  SUBMITTED = 1,
  EXPIRED = 2,
  ARCHIVED = 3
}

/**
 * Processing state of a submitted {@link FormSpace}.
 *
 * Mirrors {@link StorageFileProcessingState} value-for-value, because it drives the same NotificationTask
 * machinery and a reader that already knows one should not have to learn a second vocabulary.
 */
export enum FormSpaceProcessingState {
  INIT_OR_NONE = 0,
  QUEUED_FOR_PROCESSING = 1,
  PROCESSING = 2,
  FAILED = 3,
  SUCCESS = 4,
  DO_NOT_PROCESS = 5
}

/**
 * The arbitrary JSON a FormSpace parks while the user fills the form out.
 *
 * PASS-THROUGH: the framework never interprets it. The type's handler is what gives it meaning, and an app
 * narrows this generic to its own interface at the point it reads the space.
 */
export type FormSpaceData = Record<string, unknown>;

/**
 * A type-registered container for a client-side form: its in-progress JSON, its uploads, and its
 * submission state.
 *
 * `o` drives `resourceIsOwnedByAuthOwnershipKey()` in the security rules identically to `sf` / `sfg` / `cal`,
 * and `ps` / `pn` / `pat` mirror {@link StorageFile}'s processing triple exactly.
 *
 * @template T - the shape of the embedded form data
 * @dbxModel
 * @dbxModelRead owner
 * @dbxModelArchetype root-entity
 * @dbxModelArchetype state-machine-item
 */
export interface FormSpace<T extends FormSpaceData = FormSpaceData> {
  /**
   * The kind of form this space holds, resolving its upload restrictions, expiration policy, and the
   * server-side handler its submission is dispatched to.
   *
   * @dbxModelVariable formSpaceType
   */
  t: FormSpaceType;
  /**
   * Display name of the space, for the owner's own list of in-progress forms.
   *
   * @dbxModelVariable displayName
   */
  n?: Maybe<string>;
  /**
   * Lifecycle state. Only DRAFT is editable.
   *
   * @dbxModelVariable state
   */
  s: FormSpaceState;
  /**
   * Processing state of the submission.
   *
   * @dbxModelVariable processingState
   */
  ps: FormSpaceProcessingState;
  /**
   * The form's own values, stored as pass-through JSON.
   *
   * @dbxModelVariable data
   */
  d?: Maybe<T>;
  /**
   * The user the space belongs to. Set at creation and never changed.
   *
   * @dbxModelVariable userId
   */
  u: FirebaseAuthUserId;
  /**
   * Ownership key, if applicable. Drives read access in the security rules.
   *
   * @dbxModelVariable ownerKey
   */
  o?: Maybe<FirebaseAuthOwnershipKey>;
  /**
   * Key of the model this space was opened against, when it was opened against one.
   *
   * A TARGETING HANDLE, not an identity — several concurrent spaces may share one target, which is exactly
   * why the FormSpace does not derive its own id from it.
   *
   * @dbxModelVariable targetModelKey
   */
  m?: Maybe<FirestoreModelKey>;
  /**
   * Monotonic count of uploads this space has ACCEPTED over its whole lifetime.
   *
   * NOT a live file count: superseding a slot still increments it. It exists so `maxUploads` can be
   * enforced inside the same transaction that creates the StorageFile, which a query-based count could not
   * do without a read of the whole collection.
   *
   * @dbxModelVariable uploadCount
   */
  uc: number;
  /**
   * The NotificationTask key processing this space's submission.
   *
   * Set when the submission is queued; cleared once processing is no longer PROCESSING.
   *
   * @dbxModelVariable processingNotificationKey
   */
  pn?: Maybe<NotificationKey>;
  /**
   * The date `ps` was last moved to PROCESSING. Used to detect a stuck task.
   *
   * @dbxModelVariable processingAt
   */
  pat?: Maybe<Date>;
  /**
   * Created at date.
   *
   * @dbxModelVariable createdAt
   */
  cat: Date;
  /**
   * Updated at date. Moves on every content change.
   *
   * @dbxModelVariable updatedAt
   */
  uat: Date;
  /**
   * The date the space was submitted, if it was. Its presence IS the lock.
   *
   * @dbxModelVariable submittedAt
   */
  sat?: Maybe<Date>;
  /**
   * The date processing of the submission concluded, if it has.
   *
   * @dbxModelVariable completedAt
   */
  cpat?: Maybe<Date>;
  /**
   * The date this space becomes eligible for the expiration sweep, if it expires at all.
   *
   * CLEARED whenever the space leaves the expirable window — on submit, and on expiry itself. That is what
   * keeps {@link formSpacesDueForExpirationQuery} on a single-field inequality: Firestore skips a document
   * where the field is absent, so a cleared `eat` removes the space from the sweep entirely.
   *
   * @dbxModelVariable expiresAt
   */
  eat?: Maybe<Date>;
}

/**
 * Permission roles for FormSpace operations.
 *
 * `submit` is separate from `update` because it is the one-way door: an owner who may edit a draft is not
 * necessarily the party allowed to finalize it.
 */
export type FormSpaceRoles = GrantedReadRole | GrantedUpdateRole | GrantedDeleteRole | 'submit' | 'upload';

/**
 * Firestore document wrapper for a {@link FormSpace}.
 *
 * Deliberately NOT generic over the form data. The converter and the collection are both typed to the base
 * {@link FormSpace}, so a generic here would be a type-level claim nothing downstream could honour — a
 * caller that knows its type's shape narrows `d` at the read site instead.
 */
export class FormSpaceDocument extends AbstractFirestoreDocument<FormSpace, FormSpaceDocument, typeof formSpaceIdentity> {
  get modelIdentity() {
    return formSpaceIdentity;
  }
}

/**
 * Snapshot converter for {@link FormSpace} documents.
 */
export const formSpaceConverter = snapshotConverterFunctions<FormSpace>({
  fields: {
    t: firestoreString<FormSpaceType>(),
    n: optionalFirestoreString(),
    s: firestoreEnum<FormSpaceState>({ default: FormSpaceState.DRAFT }),
    ps: firestoreEnum<FormSpaceProcessingState>({ default: FormSpaceProcessingState.INIT_OR_NONE }),
    d: optionalFirestorePassthroughJsonField<FormSpaceData>({ dontStoreIfEmpty: true }),
    u: firestoreUID(),
    o: optionalFirestoreString(),
    m: optionalFirestoreString(),
    uc: firestoreNumber({ default: 0 }),
    pn: optionalFirestoreString(),
    pat: optionalFirestoreDate(),
    cat: firestoreDate({ saveDefaultAsNow: true }),
    uat: firestoreDate({ saveDefaultAsNow: true }),
    sat: optionalFirestoreDate(),
    cpat: optionalFirestoreDate(),
    eat: optionalFirestoreDate()
  }
});

/**
 * Returns the raw Firestore CollectionReference for the FormSpace collection.
 *
 * @param context - The Firestore context to use.
 * @returns The CollectionReference for FormSpace documents.
 */
export function formSpaceCollectionReference(context: FirestoreContext): CollectionReference<FormSpace> {
  return context.collection(formSpaceIdentity.collectionName);
}

/**
 * Typed FirestoreCollection for {@link FormSpace} documents.
 */
export type FormSpaceFirestoreCollection = FirestoreCollection<FormSpace, FormSpaceDocument>;

/**
 * Creates a fully configured {@link FormSpaceFirestoreCollection} with snapshot conversion and document factory.
 *
 * @param firestoreContext - The Firestore context to use.
 * @returns A configured FormSpaceFirestoreCollection.
 *
 * @example
 * ```ts
 * const collection = formSpaceFirestoreCollection(firestoreContext);
 * const doc = collection.documentAccessor().loadDocumentForId(formSpaceId);
 * ```
 */
export function formSpaceFirestoreCollection(firestoreContext: FirestoreContext): FormSpaceFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: formSpaceIdentity,
    converter: formSpaceConverter,
    collection: formSpaceCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new FormSpaceDocument(accessor, documentAccessor),
    firestoreContext
  });
}

/**
 * Abstract base providing access to the FormSpace Firestore collection.
 *
 * Implement this in your app module to wire up the collection for dependency injection.
 *
 * @dbxModelGroup FormSpace
 */
export abstract class FormSpaceFirestoreCollections {
  abstract readonly formSpaceCollection: FormSpaceFirestoreCollection;
}

/**
 * Union of all FormSpace-related model identity types.
 */
export type FormSpaceTypes = typeof formSpaceIdentity;
