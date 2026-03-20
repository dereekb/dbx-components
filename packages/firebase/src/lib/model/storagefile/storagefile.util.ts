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
 * @param input - reference pair containing either a document or a related model key
 * @param accessor - document accessor used to load the group document by ID
 * @returns the resolved StorageFileGroupDocument
 * @throws {Error} When neither storageFileGroupDocument nor storageFileGroupRelatedModelKey is provided
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
 * and files to insert/remove.
 */
export interface CalculateStorageFileGroupEmbeddedFileUpdateInput {
  readonly storageFileGroup: Pick<StorageFileGroup, 'f' | 're' | 'z' | 'zat'>;
  readonly insert?: Maybe<(Pick<StorageFileGroupEmbeddedFile, 's'> & Partial<Omit<StorageFileGroupEmbeddedFile, 's'>>)[]>;
  readonly remove?: Maybe<StorageFileId[]>;
  /**
   * Whether or not to allow recalculating the regenerate flag even if the current "re" value is true.
   *
   * Regenerate will always be true if any files are removed.
   *
   * Defaults to false.
   */
  readonly allowRecalculateRegenerateFlag?: Maybe<boolean>;
}

/**
 * Calculates the updated embedded file list and regeneration flag for a StorageFileGroup
 * after inserting and/or removing files.
 *
 * Handles deduplication via {@link ModelRelationUtility.insertCollection}, merging new entries
 * with existing ones by StorageFile ID. Automatically flags regeneration when files are removed
 * or when new files haven't been added to the zip yet.
 *
 * @param input - current group state, files to insert/remove, and regeneration options
 * @returns updated `f` (embedded files) and `re` (regeneration flag)
 *
 * @example
 * ```ts
 * const update = calculateStorageFileGroupEmbeddedFileUpdate({
 *   storageFileGroup: group,
 *   insert: [{ s: 'newFileId' }],
 *   remove: ['oldFileId']
 * });
 * // update.f = [...updated file list]
 * // update.re = true (because a file was removed)
 * ```
 */
export function calculateStorageFileGroupEmbeddedFileUpdate(input: CalculateStorageFileGroupEmbeddedFileUpdateInput): Pick<StorageFileGroup, 'f' | 're'> {
  const { storageFileGroup, insert, remove, allowRecalculateRegenerateFlag } = input;
  const { f: currentF, re: currentRe, z: currentZ, zat: currentZat } = storageFileGroup;

  const removeSet = new Set(remove);
  const mergeFunction = mergeObjectsFunction<StorageFileGroupEmbeddedFile>(KeyValueTypleValueFilter.UNDEFINED);
  const fWithRemovedTargetsRemoved = currentF.filter((x) => !removeSet.has(x.s));
  const oneOrMoreItemsWereRemoved = fWithRemovedTargetsRemoved.length < currentF.length;

  const f = ModelRelationUtility.insertCollection(fWithRemovedTargetsRemoved, (insert ?? []) as StorageFileGroupEmbeddedFile[], {
    readKey: (x) => x.s,
    merge: (a, b) => mergeFunction([a, b]) as StorageFileGroupEmbeddedFile
  });

  let re = currentRe ?? oneOrMoreItemsWereRemoved; // flag removed if any items were removed

  // recalculate re if it is false or the retain flag is false
  if (!re || allowRecalculateRegenerateFlag) {
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
  readonly storageFileGroup: Pick<StorageFileGroup, 'f' | 'z' | 'zat'>;
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
 * - The zip has never been generated (`zat` is unset) and files exist
 * - Any embedded file has never been included in the zip (`zat` is unset on the entry)
 *
 * @param input - group state and optional force flag
 * @returns the regeneration result indicating whether the zip or other derived files need to be regenerated
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
  const { f, z, zat } = storageFileGroup;

  let regenerateZip: Maybe<boolean> = undefined;

  // check regeneration of zip file should be flagged
  if (z) {
    if (force) {
      regenerateZip = true;
    } else if (zat) {
      // check that each of the entries have a zat value. If not set, then they've never been added to the archive
      regenerateZip = f.some((x) => !x.zat);
    } else {
      regenerateZip = f.length > 0; // if never generated, and there are files, regenerate it
    }
  }

  const re = regenerateZip ?? false;

  return {
    flagRegenerate: re,
    regenerateZip
  };
}
