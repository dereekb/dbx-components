import { type Maybe, type SlashPathFile } from '@dereekb/util';
import { type GrantedReadRole, type GrantedUpdateRole, type GrantedDeleteRole } from '@dereekb/model';
import {
  AbstractFirestoreDocument,
  type CollectionReference,
  type FirestoreCollection,
  type FirestoreContext,
  type FirebaseAuthOwnershipKey,
  type FirebaseAuthUserId,
  type FirestoreModelKey,
  firestoreDate,
  firestoreEnum,
  firestoreModelIdString,
  firestoreModelIdentity,
  firestoreNumber,
  firestoreObjectArray,
  firestoreString,
  firestoreSubObject,
  firestoreUID,
  firestoreUnixDateTimeSecondsNumber,
  optionalFirestoreDate,
  optionalFirestorePassthroughJsonField,
  optionalFirestoreString,
  optionalFirestoreUID,
  optionalFirestoreUnixDateTimeSecondsNumber,
  snapshotConverterFunctions
} from '../../common';
import { type NotificationKey } from '../notification/notification.id';
import { type StorageFileId } from '../storagefile/storagefile.id';
import { type FormSpaceFileSlot, type FormSpaceType } from './formspace.id';

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
 * Only DRAFT is editable. SUBMITTED is awaiting or undergoing processing, and is the one state a space can
 * come BACK from: a type declaring a reopen policy lets a caller holding the `reopen` role return the space
 * to DRAFT until it is fully locked. EXPIRED (retired by the sweep before it was ever submitted) and
 * ARCHIVED (kept for the record after processing concluded) stay terminal — {@link isFormSpaceReopenable}
 * requires SUBMITTED, so neither is reachable by a reopen.
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
 * Validation state of one {@link FormSpaceFile}.
 *
 * A slot that declares no validator leaves every file at NONE — "nothing to check" and "checked and fine"
 * are deliberately distinct, so a type that gains a validator later does not silently inherit a pass.
 */
export enum FormSpaceFileValidationState {
  NONE = 0,
  PENDING = 1,
  VALID = 2,
  INVALID = 3
}

/**
 * Why validation could not reach a verdict about a file's CONTENT.
 *
 * Closed, unlike {@link FormSpaceFile.r}, because every member here is infrastructural: the object was gone,
 * the file was superseded mid-check, no validator was registered, the validator threw. A content rejection's
 * reason is written by the validator for a human to read and so cannot be enumerated.
 */
export type FormSpaceFileValidationFailureReason = 'replaced' | 'file_unavailable' | 'no_validator' | 'error';

/**
 * One file currently held in a {@link FormSpace} slot.
 *
 * The FormSpace's `f` array is the ONLY authority on what a space currently holds. The StorageFiles
 * themselves are not queryable by the owner (`firestore.rules` grants `get` but not `list` on `/sf`) and the
 * StorageFileGroup's own `f[]` is populated lazily by the group-sync sweep, so neither can answer "what is in
 * this folder" at the moment an upload is accepted. This array is written in the same transaction that
 * accepts the upload, so it always can.
 *
 * @dbxModelSubObject
 */
export interface FormSpaceFile {
  /**
   * The slot this file fills.
   *
   * @dbxModelVariable slot
   */
  sl: FormSpaceFileSlot;
  /**
   * The id of the StorageFile holding the bytes.
   *
   * @dbxModelVariable storageFileId
   */
  sf: StorageFileId;
  /**
   * The user who put the file here.
   *
   * On a single-user space this always equals the space's `u`; on a SHARED one it is whichever member
   * actually uploaded, which is the only thing that can answer "is this MY file". Absent on an entry written
   * before the field existed, where the space's `u` was necessarily the uploader — which is exactly what
   * {@link formSpaceFileUploaderId} falls back to.
   *
   * @dbxModelVariable uploadedBy
   */
  ub?: Maybe<FirebaseAuthUserId>;
  /**
   * The file's name, as it was uploaded.
   *
   * @dbxModelVariable fileName
   */
  n: SlashPathFile;
  /**
   * Validation state.
   *
   * @dbxModelVariable validationState
   */
  v: FormSpaceFileValidationState;
  /**
   * Free-text reason the file was judged INVALID, written for the owner to act on.
   *
   * @dbxModelVariable invalidReason
   */
  r?: Maybe<string>;
  /**
   * Reason validation never reached a content verdict, if it did not.
   *
   * @dbxModelVariable failureReason
   */
  fr?: Maybe<FormSpaceFileValidationFailureReason>;
  /**
   * The date the upload was accepted.
   *
   * @dbxModelVariable uploadedAt
   */
  at: Date;
  /**
   * The date validation concluded, if it has.
   *
   * @dbxModelVariable validatedAt
   */
  vat?: Maybe<Date>;
}

/**
 * Firestore sub-object converter for {@link FormSpaceFile}.
 *
 * Dates are stored as Unix seconds rather than timestamps, matching {@link storageFileGroupEmbeddedFile}:
 * these are embedded in an array that is rewritten on every upload, and the compact form keeps the document
 * small enough that the array is never the reason a space approaches Firestore's ceiling.
 */
export const formSpaceFileSubObject = firestoreSubObject<FormSpaceFile>({
  objectField: {
    fields: {
      sl: firestoreString<FormSpaceFileSlot>(),
      sf: firestoreModelIdString,
      ub: optionalFirestoreUID(),
      n: firestoreString<SlashPathFile>(),
      v: firestoreEnum<FormSpaceFileValidationState>({ default: FormSpaceFileValidationState.NONE }),
      r: optionalFirestoreString(),
      fr: optionalFirestoreString<FormSpaceFileValidationFailureReason>(),
      at: firestoreUnixDateTimeSecondsNumber({ saveDefaultAsNow: true }),
      vat: optionalFirestoreUnixDateTimeSecondsNumber()
    }
  }
});

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
   * The next index a file's permanent storage path is keyed by.
   *
   * NOT an index into `f`, and not a count of anything. It advances when a path is CLAIMED — before the
   * bytes are copied and before the upload is accepted — so a claim that never becomes a file leaves a
   * gap, which is the point. A gap costs nothing; a reused index puts two StorageFiles on one object, and
   * deleting either then destroys the other's bytes.
   *
   * Deliberately separate from `uc`. `uc` is the upload BUDGET and must not move for a refused upload;
   * this must move for every path handed out, refused or not.
   *
   * @dbxModelVariable nextFileIndex
   */
  fi: number;
  /**
   * Every file the space currently holds, across every slot.
   *
   * THE authority on the space's files. It is written in the same transaction that increments `uc`, so it is
   * correct the instant an upload is accepted — which neither a StorageFile query (the owner cannot `list`
   * `/sf`) nor the StorageFileGroup's lazily-synced `f[]` is.
   *
   * Flat rather than a map of slot to files: one array converts with one {@link firestoreObjectArray}, and
   * the per-slot views callers actually want are a filter away. Bounded by the type's `maxUploads`.
   *
   * Distinct from `uc`: superseding a slot drops the old entry and appends a new one, leaving the length
   * unchanged while `uc` still advances.
   *
   * @dbxModelVariable files
   */
  f: FormSpaceFile[];
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
   * The date the CURRENT submission was made, if the space is submitted. Its presence IS the lock.
   *
   * Cleared by a reopen, which is what hands the space back as an editable draft, so it always describes
   * the submission in force NOW rather than the history. `fsat` is what remembers the first one.
   *
   * @dbxModelVariable submittedAt
   */
  sat?: Maybe<Date>;
  /**
   * The date the space was FIRST submitted, if it ever was.
   *
   * Never cleared. Since a reopen clears `sat`, without this the fact that the space was submitted at all —
   * and when — would be destroyed by the first reopen. It is also the anchor
   * {@link resolveFormSpaceLocksAt} measures the type's `reopenableUntil` from, which is what stops a
   * reopen/resubmit round from walking the lock deadline forward.
   *
   * @dbxModelVariable firstSubmittedAt
   */
  fsat?: Maybe<Date>;
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
  /**
   * The date reopening stops being possible — the instant the submission becomes FULLY LOCKED.
   *
   * Written once, on the first submit, as `fsat + reopenableUntil`, and never moved afterwards; an explicit
   * lock sets it to that moment instead. Absent means there is no CEILING, not that the space is locked:
   * the type's `reopenableFor` is the master switch, and a type declaring neither is simply never
   * reopenable. The same "an absent field is an absent gate" convention `eat` uses.
   *
   * Stored as an ISO8601 string like every other date here, which means `firestore.rules` CANNOT compare it
   * against `request.time` — rules convert only bool/int/float/null to a string, never a timestamp. A
   * downstream app that needs the lock predicate inside its OWN rules has to denormalize a unix-seconds
   * mirror onto its own model and compare that. Reading this field over a callable, or over the `get` the
   * rules already grant, needs no mirror at all.
   *
   * @dbxModelVariable locksAt
   */
  lat?: Maybe<Date>;
  /**
   * The user who locked the submission early, when a caller did rather than the deadline passing.
   *
   * @dbxModelVariable lockedBy
   */
  lby?: Maybe<FirebaseAuthUserId>;
  /**
   * Monotonic count of times this space has been REOPENED after a submission.
   *
   * Doubles as the submission-attempt generation. The submission task is keyed by it, so a resubmit gets a
   * fresh task instead of colliding with the finished one, and a task still carrying a stale count is
   * fenced off rather than clobbering the attempt in force.
   *
   * Monotonic for the same reason `uc` is: it counts rounds that happened, and a counter something can
   * rewind is not a bound. Capped by the type's `maxReopens`.
   *
   * @dbxModelVariable reopenCount
   */
  rc: number;
  /**
   * The date the space was last reopened, if it ever was.
   *
   * @dbxModelVariable reopenedAt
   */
  rat?: Maybe<Date>;
  /**
   * The user who last reopened the space.
   *
   * @dbxModelVariable reopenedBy
   */
  rby?: Maybe<FirebaseAuthUserId>;
}

/**
 * Permission roles for FormSpace operations.
 *
 * `submit` is separate from `update` because it is the one-way door: an owner who may edit a draft is not
 * necessarily the party allowed to finalize it.
 *
 * `uploadFile` and `removeFile` are separate from `update` for the mirror-image reason. On a SHARED space a
 * member contributes files to a form whose `d` belongs to everyone; letting them add or take back their own
 * file must not also let them rewrite the form. WHICH files a `removeFile` holder may remove is a second,
 * per-file question the type's {@link FormSpaceFileAccess} answers — the role only opens the door.
 *
 * The two are enforced in DIFFERENT places, because an upload and a removal arrive by different routes.
 * `removeFile` gates a callable, so a role map answers it directly. An upload has no callable at all — the
 * client writes bytes into its own storage namespace and a storage trigger picks them up with no auth
 * context to build a role map from — so `uploadFile` is the DECLARATION of who may contribute, and
 * `FormSpaceUploadAuthorizationDelegate` is where the same app policy is actually applied. Grant them
 * together, to the same people.
 *
 * `reopen` and `lock` are the two halves of undoing that door, and are separate from each other as much as
 * from `submit`. `reopen` returns a submitted space to DRAFT; WHETHER it may be reopened at all is the
 * type's own policy, re-asserted inside the action's transaction, so the role only says who is allowed to
 * ask. `lock` goes the other way and ends the reopen window early — in a two-party flow that is a
 * privilege the party who submitted should not automatically hold over the party reviewing, which is
 * exactly why it is not folded into `reopen`.
 */
export type FormSpaceRoles = GrantedReadRole | GrantedUpdateRole | GrantedDeleteRole | 'submit' | 'uploadFile' | 'removeFile' | 'reopen' | 'lock';

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
    fi: firestoreNumber({ default: 0 }),
    f: firestoreObjectArray({ objectField: formSpaceFileSubObject }),
    pn: optionalFirestoreString(),
    pat: optionalFirestoreDate(),
    cat: firestoreDate({ saveDefaultAsNow: true }),
    uat: firestoreDate({ saveDefaultAsNow: true }),
    sat: optionalFirestoreDate(),
    fsat: optionalFirestoreDate(),
    cpat: optionalFirestoreDate(),
    eat: optionalFirestoreDate(),
    lat: optionalFirestoreDate(),
    lby: optionalFirestoreUID(),
    rc: firestoreNumber({ default: 0 }),
    rat: optionalFirestoreDate(),
    rby: optionalFirestoreUID()
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
