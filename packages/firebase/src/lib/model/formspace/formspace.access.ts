import { type Maybe } from '@dereekb/util';
import { type FirebaseAuthUserId } from '../../common/auth/auth';
import { FIRESTORE_COLLECTION_NAME_SEPARATOR } from '../../common/firestore/collection/collection';
import { type StorageFile } from '../storagefile/storagefile';
import { type FormSpace, type FormSpaceFile, type FormSpaceFirestoreCollections, formSpaceIdentity } from './formspace';
import { type FormSpaceFileSlot, type FormSpaceKey } from './formspace.id';
import { DEFAULT_FORM_SPACE_FILE_ACCESS, type AppFormSpaceTypeConfigService, type FormSpaceFileAccess, type FormSpaceTypeConfig } from './formspace.type';
import { FORM_SPACE_PURPOSE } from './formspace.upload';
import { formSpaceFileSlotConfig } from './formspace.util';

/**
 * @module formspace.access
 *
 * Who may read and remove ONE file of a FormSpace, as opposed to who may reach the space at all.
 *
 * The two questions are deliberately separate and are asked in that order. The space-level roles
 * (`read`, `upload`, `removeFile`) decide whether a caller is in the room; {@link FormSpaceFileAccess}
 * decides which of the files in it are theirs to touch. Nothing here ever GRANTS — every predicate can only
 * take access away from a caller who already passed the space-level check, which is what makes it safe to
 * evaluate as an AND wherever a role is being resolved.
 *
 * The distinction only has teeth on a SHARED space. On a single-user form every file was uploaded by the
 * one person who can reach the space, so `'space'` and `'uploader'` agree on every question.
 */

/**
 * The character `twoWayFlatFirestoreModelKey` swaps a key's separators for.
 *
 * Local rather than imported because the flattener hard-codes it; this is the one place that has to undo it
 * by hand and so is the one place worth naming it.
 */
const FLAT_MODEL_KEY_SEPARATOR = '_';

/**
 * Input for {@link formSpaceSlotFileAccess}.
 */
export interface FormSpaceSlotFileAccessInput {
  readonly config: FormSpaceTypeConfig;
  readonly slot: Maybe<FormSpaceFileSlot>;
}

/**
 * Resolves the {@link FormSpaceFileAccess} governing one slot.
 *
 * Slot narrows type narrows default, the same precedence `allowedMimeTypes` and `maxFileSizeBytes` use.
 *
 * @param input - The type config and the slot.
 * @returns The effective file access policy.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formSpaceSlotFileAccess(input: FormSpaceSlotFileAccessInput): FormSpaceFileAccess {
  const { config, slot } = input;
  const slotConfig = slot == null ? undefined : formSpaceFileSlotConfig(config, slot);
  return slotConfig?.fileAccess ?? config.fileAccess ?? DEFAULT_FORM_SPACE_FILE_ACCESS;
}

/**
 * Input for {@link formSpaceFileUploaderId}.
 */
export interface FormSpaceFileUploaderIdInput {
  readonly formSpace: Pick<FormSpace, 'u'>;
  readonly file: Pick<FormSpaceFile, 'ub'>;
}

/**
 * The uid that owns one file for access purposes.
 *
 * Falls back to the space's `u` when the entry carries no `ub`. That is not a guess: `ub` was added after
 * FormSpace shipped, and every entry written before it existed came from the only party that could upload
 * at the time — the space's own user. Falling back keeps an older single-user space working unchanged
 * under an `'uploader'` policy instead of locking its owner out of their own files.
 *
 * @param input - The space and the file entry.
 * @returns The uploader's uid.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formSpaceFileUploaderId(input: FormSpaceFileUploaderIdInput): FirebaseAuthUserId {
  const { formSpace, file } = input;
  return file.ub ?? formSpace.u;
}

/**
 * Input for {@link isFormSpaceFileAccessibleWithAccess}.
 */
export interface IsFormSpaceFileAccessibleWithAccessInput {
  readonly fileAccess: FormSpaceFileAccess;
  readonly formSpace: Pick<FormSpace, 'u'>;
  readonly file: Pick<FormSpaceFile, 'ub'>;
  readonly uid: Maybe<FirebaseAuthUserId>;
}

/**
 * THE per-file rule, applied to an ALREADY-RESOLVED {@link FormSpaceFileAccess}.
 *
 * Split from {@link isFormSpaceFileAccessibleByUser} so a caller holding the policy but not the whole
 * `FormSpaceTypeConfig` — a UI handed `fileAccess` as an input, say — decides with the same function the
 * server enforces with, rather than a second copy of `ub ?? u` that could drift from it.
 *
 * @param input - The resolved policy, the space, the file entry, and the caller.
 * @returns True when the caller may read and remove this file.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isFormSpaceFileAccessibleWithAccess(input: IsFormSpaceFileAccessibleWithAccessInput): boolean {
  const { fileAccess, formSpace, file, uid } = input;
  return fileAccess === 'space' || (uid != null && formSpaceFileUploaderId({ formSpace, file }) === uid);
}

/**
 * Input for {@link isFormSpaceFileAccessibleByUser}.
 */
export interface IsFormSpaceFileAccessibleByUserInput {
  readonly formSpace: Pick<FormSpace, 'u'>;
  readonly config: FormSpaceTypeConfig;
  readonly file: Pick<FormSpaceFile, 'sl' | 'ub'>;
  readonly uid: Maybe<FirebaseAuthUserId>;
}

/**
 * THE per-file predicate: may this user read or remove this file, given they already reach the space?
 *
 * One function for both verbs on purpose. "You can see it but not delete it" and "you can delete it but not
 * see it" are both worse than either consistent answer, and two policies would be two things to keep in
 * step. A type that genuinely needs to split them should keep files in separate slots and narrow one.
 *
 * @param input - The space, its type config, the file entry, and the caller.
 * @returns True when the caller may read and remove this file.
 *
 * @example
 * ```ts
 * const allowed = isFormSpaceFileAccessibleByUser({ formSpace, config, file, uid: context.auth?.uid });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isFormSpaceFileAccessibleByUser(input: IsFormSpaceFileAccessibleByUserInput): boolean {
  const { formSpace, config, file, uid } = input;
  return isFormSpaceFileAccessibleWithAccess({ fileAccess: formSpaceSlotFileAccess({ config, slot: file.sl }), formSpace, file, uid });
}

/**
 * Returns the {@link FormSpaceKey} a StorageFile was uploaded into, or null when it is not a FormSpace file.
 *
 * Reads the group ids rather than a dedicated field: a FormSpace upload joins the group
 * {@link formSpaceStorageFileGroupId} keys by the space's own model key, so the key is already recoverable
 * and a second copy of it could only drift. The purpose is checked first, so a file from any other pipeline
 * costs one string comparison.
 *
 * Decoded by splitting the FIRST separator rather than through
 * {@link inferStorageFileGroupRelatedModelKey}, which replaces EVERY `_` with a `/`. That generic inverse is
 * only two-way for an id that contains no underscore, and a space keyed by {@link formSpaceIdForModel}
 * always does — a guestbook's album is `fsp/gb_<id>`, which the generic inverse turns into the three-segment
 * `fsp/gb/<id>`: not a document path at all. FormSpace is a ROOT collection, so everything after the first
 * separator is the id, underscores and all.
 *
 * @param storageFile - The StorageFile to inspect.
 * @returns The FormSpace's model key, or null.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formSpaceKeyForStorageFile(storageFile: Pick<StorageFile, 'p' | 'g'>): Maybe<FormSpaceKey> {
  let key: Maybe<FormSpaceKey>;

  if (storageFile.p === FORM_SPACE_PURPOSE) {
    const collectionName = formSpaceIdentity.collectionName;
    const prefix = `${collectionName}${FLAT_MODEL_KEY_SEPARATOR}`;
    const groupId = (storageFile.g ?? []).find((x) => x.startsWith(prefix));

    key = groupId == null ? undefined : `${collectionName}${FIRESTORE_COLLECTION_NAME_SEPARATOR}${groupId.slice(prefix.length)}`;
  }

  return key;
}

/**
 * Input for {@link isFormSpaceStorageFileAccessibleByUser}.
 */
export interface IsFormSpaceStorageFileAccessibleByUserInput {
  readonly collections: FormSpaceFirestoreCollections;
  readonly appFormSpaceTypeConfigService: AppFormSpaceTypeConfigService;
  readonly storageFile: Pick<StorageFile, 'p' | 'g' | 'pg' | 'uby'>;
  readonly uid: Maybe<FirebaseAuthUserId>;
}

/**
 * {@link isFormSpaceFileAccessibleByUser}, asked from the StorageFile side — where a download is authorized.
 *
 * Returns true for a StorageFile that is not a FormSpace upload at all, so a caller can AND it into an
 * existing role grant without first classifying the file: this narrows FormSpace files and abstains on
 * everything else.
 *
 * Costs at most one FormSpace read, and usually none. A caller who IS the file's `uby` is allowed under
 * BOTH policies, so the space never has to be loaded to answer for them — which is the common case, since
 * the person downloading a file is overwhelmingly the person who uploaded it.
 *
 * @param input - The collections, the type registry, the StorageFile, and the caller.
 * @returns True when the caller may read this file.
 */
export async function isFormSpaceStorageFileAccessibleByUser(input: IsFormSpaceStorageFileAccessibleByUserInput): Promise<boolean> {
  const { collections, appFormSpaceTypeConfigService, storageFile, uid } = input;
  const formSpaceKey = formSpaceKeyForStorageFile(storageFile);
  let accessible: boolean;

  if (formSpaceKey == null || (uid != null && storageFile.uby === uid)) {
    // not a FormSpace file (abstain), or the caller uploaded it (allowed under either policy)
    accessible = true;
  } else {
    const formSpace = await collections.formSpaceCollection.documentAccessor().loadDocumentForKey(formSpaceKey).snapshotData();

    if (formSpace == null) {
      // the space is gone but its file is not. Nothing left declares a policy, so fall back to the
      // permissive default rather than locking out a reader the surrounding role grant already accepted.
      accessible = true;
    } else {
      const config = appFormSpaceTypeConfigService.configForFormSpaceType(formSpace.t);
      const slot = storageFile.pg as Maybe<FormSpaceFileSlot>;

      accessible = isFormSpaceFileAccessibleByUser({
        formSpace,
        config,
        // `pg` IS the slot and `uby` IS the uploader — the same two values the `f` entry carries — so this
        // answers without also having to find the entry, which a superseded file no longer has.
        file: { sl: slot as FormSpaceFileSlot, ub: storageFile.uby },
        uid
      });
    }
  }

  return accessible;
}
