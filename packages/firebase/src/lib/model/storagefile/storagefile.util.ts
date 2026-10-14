import { KeyValueTypleValueFilter, type Maybe, mergeObjectsFunction, ModelRelationUtility } from '@dereekb/util';
import { type FirestoreModelKey, type FirestoreDocumentAccessor } from '../../common';
import { type StorageFileGroupDocument, type StorageFileGroup, type StorageFileGroupEmbeddedFile } from './storagefile';
import { storageFileGroupIdForModel, type StorageFileId } from './storagefile.id';

// MARK: StorageFileGroup
/**
 * Reference to a StorageFileGroup document, either directly or by the related model key.
 *
 * Used by utility functions that need to load or update a StorageFileGroup but accept
 * either a pre-loaded document or a model key for lazy loading.
 */
export interface StorageFileGroupDocumentReferencePair {
  /**
   * StorageFileGroupDocument to update.
   *
   * If not provided, please provide the storageFileGroupRelatedModelKey. If neither value is provided, an error will be thrown.
   */
  readonly storageFileGroupDocument?: Maybe<StorageFileGroupDocument>;
  /**
   * Key of the model the storage file group is expected to be associated with. Used if StorageFileGroupDocument is not provided already.
   */
  readonly storageFileGroupRelatedModelKey?: Maybe<FirestoreModelKey>;
}

/**
 * Resolves a {@link StorageFileGroupDocumentReferencePair} to a concrete {@link StorageFileGroupDocument}.
 *
 * If a document is provided directly, it is returned as-is. Otherwise, the related model key
 * is converted to a group ID via {@link storageFileGroupIdForModel} and loaded from the accessor.
 *
 * @param input - Reference pair containing either a document or a related model key.
 * @param accessor - Document accessor used to load the group document by ID.
 * @returns The resolved StorageFileGroupDocument.
 * @throws {Error} When neither storageFileGroupDocument nor storageFileGroupRelatedModelKey is provided.
 *
 * @example
 * ```ts
 * const doc = loadStorageFileGroupDocumentForReferencePair(
 *   { storageFileGroupRelatedModelKey: 'notification/abc123' },
 *   accessor
 * );
 * ```
 */
export function loadStorageFileGroupDocumentForReferencePair(input: StorageFileGroupDocumentReferencePair, accessor: FirestoreDocumentAccessor<StorageFileGroup, StorageFileGroupDocument>) {
  const { storageFileGroupDocument: inputStorageFileGroupDocument, storageFileGroupRelatedModelKey: inputStorageFileGroupRelatedModelKey } = input;
  let storageFileGroupDocument: StorageFileGroupDocument;

  if (inputStorageFileGroupDocument != null) {
    storageFileGroupDocument = inputStorageFileGroupDocument;
  } else if (inputStorageFileGroupRelatedModelKey) {
    const storageFileGroupId = storageFileGroupIdForModel(inputStorageFileGroupRelatedModelKey);
    storageFileGroupDocument = accessor.loadDocumentForId(storageFileGroupId);
  } else {
    throw new Error('StorageFileGroupDocument or StorageFileGroupRelatedModelKey is required');
  }

  return storageFileGroupDocument;
}

/**
 * Input for {@link calculateStorageFileGroupEmbeddedFileUpdate}, specifying the current group state
 * and files to insert/update/remove.
 */
export interface CalculateStorageFileGroupEmbeddedFileUpdateInput {
  readonly storageFileGroup: Pick<StorageFileGroup, 'f' | 're' | 'z' | 'zat'>;
  readonly insert?: Maybe<(Pick<StorageFileGroupEmbeddedFile, 's'> & Partial<Omit<StorageFileGroupEmbeddedFile, 's'>>)[]>;
  /**
   * Display name updates for files already in the group. Files not in the group are ignored.
   *
   * An undefined `n` keeps the current name, null clears it. Only `n` is copied.
   */
  readonly update?: Maybe<(Pick<StorageFileGroupEmbeddedFile, 's'> & Partial<Pick<StorageFileGroupEmbeddedFile, 'n'>>)[]>;
  readonly remove?: Maybe<StorageFileId[]>;
  /**
   * Whether or not to allow recalculating the regenerate flag even if the current "re" value is true.
   *
   * Removals and display name changes always flag regeneration. Otherwise, when true, an existing `re` is replaced by
   * the value derived from the embedded files, which drops any pending manual request.
   *
   * Defaults to false.
   */
  readonly allowRecalculateRegenerateFlag?: Maybe<boolean>;
}

/**
 * Calculates the updated embedded file list and regeneration flag for a StorageFileGroup
 * after inserting, updating and/or removing files.
 *
 * Handles deduplication via {@link ModelRelationUtility.insertCollection}, merging new entries
 * with existing ones by StorageFile ID. Always flags regeneration when files are removed or when the display
 * name of a file already in the group changes, and otherwise flags it when new files haven't been added to the zip yet.
 *
 * @param input - Current group state, files to insert/update/remove, and regeneration options.
 * @returns Updated `f` (embedded files) and `re` (regeneration flag)
 *
 * @example
 * ```ts
 * const update = calculateStorageFileGroupEmbeddedFileUpdate({
 *   storageFileGroup: group,
 *   insert: [{ s: 'newFileId' }],
 *   update: [{ s: 'existingFileId', n: 'New Name' }],
 *   remove: ['oldFileId']
 * });
 * // update.f = [...updated file list]
 * // update.re = true (because a file was removed and a display name changed)
 * ```
 */
export function calculateStorageFileGroupEmbeddedFileUpdate(input: CalculateStorageFileGroupEmbeddedFileUpdateInput): Pick<StorageFileGroup, 'f' | 're'> {
  const { storageFileGroup, insert, update, remove, allowRecalculateRegenerateFlag } = input;
  const { f: currentF, re: currentRe, z: currentZ, zat: currentZat } = storageFileGroup;

  const removeSet = new Set(remove);
  const mergeFunction = mergeObjectsFunction<StorageFileGroupEmbeddedFile>(KeyValueTypleValueFilter.UNDEFINED);
  const fWithRemovedTargetsRemoved = currentF.filter((x) => !removeSet.has(x.s));
  const oneOrMoreItemsWereRemoved = fWithRemovedTargetsRemoved.length < currentF.length;

  const fWithInsertedTargets = ModelRelationUtility.insertCollection(fWithRemovedTargetsRemoved, (insert ?? []) as StorageFileGroupEmbeddedFile[], {
    readKey: (x) => x.s,
    merge: (a, b) => mergeFunction([a, b]) as StorageFileGroupEmbeddedFile
  });

  // only the display name of entries already in the group can be updated
  const f = ModelRelationUtility.updateCollection(fWithInsertedTargets, (update ?? []) as StorageFileGroupEmbeddedFile[], {
    readKey: (x) => x.s,
    merge: (existing, x) => ({ ...existing, n: x.n === undefined ? existing.n : x.n })
  });

  // a changed display name changes the zip's content
  const previousDisplayNames = new Map(fWithRemovedTargetsRemoved.map((x) => [x.s, x.n ?? undefined]));
  const oneOrMoreDisplayNamesChanged = f.some((x) => previousDisplayNames.has(x.s) && previousDisplayNames.get(x.s) !== (x.n ?? undefined));

  let re = oneOrMoreItemsWereRemoved || oneOrMoreDisplayNamesChanged || (Boolean(currentRe) && !allowRecalculateRegenerateFlag);

  if (!re) {
    // derived from the embedded files. The projection deliberately leaves out re, since this decides whether to set it.
    const { flagRegenerate } = calculateStorageFileGroupRegeneration({ storageFileGroup: { f, z: currentZ, zat: currentZat } });
    re = flagRegenerate;
  }

  return {
    f,
    re
  };
}

/**
 * Input for {@link calculateStorageFileGroupRegeneration}.
 */
export interface CalculateStorageFileGroupRegenerationInput {
  /**
   * The group's current state.
   *
   * When `re` is set the regeneration was explicitly requested and is honored. Callers deciding whether to SET `re`
   * (e.g. {@link calculateStorageFileGroupEmbeddedFileUpdate}) must leave it out.
   */
  readonly storageFileGroup: Pick<StorageFileGroup, 'f' | 'z' | 'zat' | 'zsf' | 're'>;
  /**
   * If true, will force regenerating applicable derived files, even if all content is up to date.
   */
  readonly force?: Maybe<boolean>;
}

export interface CalculateStorageFileGroupRegenerationResult {
  /**
   * Whether or not the zip file needs to be regenerated.
   */
  readonly regenerateZip?: Maybe<boolean>;
  /**
   * Whether or not any derived StorageFile needs to be regenerated.
   */
  readonly flagRegenerate: boolean;
}

/**
 * Determines whether a StorageFileGroup's derived content (e.g., zip files) needs regeneration.
 *
 * The zip needs regeneration when:
 * - `force` is true
 * - `re` is set (regeneration was requested) and files exist or a zip already exists. Rebuilding an existing zip with no files removes the files that were previously in it.
 * - Any embedded file has never been included in the zip (`zat` is unset on the entry)
 * - The zip has never been generated (`zat` is unset) and files exist
 *
 * @param input - Group state and optional force flag.
 * @returns The regeneration result indicating whether the zip or other derived files need to be regenerated.
 *
 * @example
 * ```ts
 * const { flagRegenerate, regenerateZip } = calculateStorageFileGroupRegeneration({
 *   storageFileGroup: group,
 *   force: false
 * });
 * ```
 */
export function calculateStorageFileGroupRegeneration(input: CalculateStorageFileGroupRegenerationInput): CalculateStorageFileGroupRegenerationResult {
  const { storageFileGroup, force } = input;
  const { f, z, zat, zsf, re } = storageFileGroup;

  let regenerateZip: Maybe<boolean> = undefined;

  // check regeneration of zip file should be flagged
  if (z) {
    if (force) {
      regenerateZip = true;
    } else if (re) {
      // requested (file removed, display name changed, manual/code-change rebuild). Rebuild when there is anything to zip, or a zip that may still contain removed files.
      regenerateZip = f.length > 0 || zsf != null || zat != null;
    } else if (zat) {
      // check that each of the entries have a zat value. If not set, then they've never been added to the archive
      regenerateZip = f.some((x) => !x.zat);
    } else {
      regenerateZip = f.length > 0; // if never generated, and there are files, regenerate it
    }
  }

  const flagRegenerate = regenerateZip ?? false;

  return {
    flagRegenerate,
    regenerateZip
  };
}
