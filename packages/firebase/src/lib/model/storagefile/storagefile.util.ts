import { KeyValueTypleValueFilter, Maybe, mergeObjects, mergeObjectsFunction, ModelRelationUtility } from '@dereekb/util';
import { FirestoreModelKey, FirestoreDocumentAccessor } from '../../common';
import { StorageFileGroupDocument, StorageFileGroup, StorageFileGroupEmbeddedFile } from './storagefile';
import { storageFileGroupIdForModel, StorageFileId } from './storagefile.id';
import { isBefore } from '@dereekb/date';

// MARK: StorageFileGroup
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

export interface CalculateStorageFileGroupEmbeddedFileUpdateInput {
  readonly storageFileGroup: Pick<StorageFileGroup, 'f' | 're' | 'z' | 'zat'>;
  readonly insert?: Maybe<(Pick<StorageFileGroupEmbeddedFile, 's'> & Partial<Omit<StorageFileGroupEmbeddedFile, 's'>>)[]>;
  readonly remove?: Maybe<StorageFileId[]>;
  /**
   * Whether or not to recalculate the regenerate flag, even if it is true.
   *
   * Defaults to false.
   */
  readonly recalculateRegenerateFlag?: Maybe<boolean>;
}

export function calculateStorageFileGroupEmbeddedFileUpdate(input: CalculateStorageFileGroupEmbeddedFileUpdateInput): Pick<StorageFileGroup, 'f' | 're'> {
  const { storageFileGroup, insert, remove, recalculateRegenerateFlag } = input;
  const { f: currentF, re: currentRe, z: currentZ, zat: currentZat } = storageFileGroup;

  const removeSet = new Set(remove);
  const mergeFunction = mergeObjectsFunction<StorageFileGroupEmbeddedFile>(KeyValueTypleValueFilter.UNDEFINED);
  const fWithRemovedTargetsRemoved = currentF.filter((x) => !removeSet.has(x.s));
  const oneOrMoreItemsWereRemoved = fWithRemovedTargetsRemoved.length < currentF.length;

  const f = ModelRelationUtility.insertCollection(fWithRemovedTargetsRemoved, (insert ?? []) as StorageFileGroupEmbeddedFile[], {
    readKey: (x) => x.s,
    readType: () => 'x',
    merge: (a, b) => mergeFunction([a, b]) as StorageFileGroupEmbeddedFile
  });

  let re = currentRe || oneOrMoreItemsWereRemoved; // flag removed if any items were removed

  // recalculate re if it is false or the retain flag is false
  if (!re || recalculateRegenerateFlag) {
    const { flagRegenerate } = calculateStorageFileGroupRegeneration({ storageFileGroup: { f, z: currentZ, zat: currentZat } });
    re = flagRegenerate;
  }

  return {
    f,
    re
  };
}

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
 * Calculates the regeneration flags for a StorageFileGroup.
 *
 * @param input CalculateStorageFileGroupRegenerationInput
 * @returns CalculateStorageFileGroupRegenerationResult
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
