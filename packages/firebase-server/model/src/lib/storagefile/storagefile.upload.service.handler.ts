import { NotificationTaskType, UploadedFileTypeDeterminer, UploadedFileTypeIdentifier } from '@dereekb/firebase';
import { ArrayOrValue, asArray, Maybe } from '@dereekb/util';
import { StorageFileInitializeFromUploadService } from './storagefile.upload.service';
import { val } from '@uirouter/core';

export interface StorageFileInitializeFromUploadServiceProcessor {
  /**
   * The file type(s) identifier that this processor handles.
   */
  readonly type: ArrayOrValue<UploadedFileTypeIdentifier>;
  /**
   * A determiner that is paired with the processor.
   *
   * Determiners defined here are modified to ONLY respond to the types specified in the `type` property.
   */
  readonly determiner?: Maybe<UploadedFileTypeDeterminer>;
}

export interface StorageFileInitializeFromUploadServiceConfig {
  /**
   * If true, will validate that all processor file types have a corresponding determiner.
   */
  readonly validate?: boolean;
  /**
   * The UploadedFileTypeDeterminer(s) to use for determining the upload type of each uploaded file.
   *
   * They will be combined together with determiners from the processors.
   */
  readonly determiner: ArrayOrValue<UploadedFileTypeDeterminer>;
  /**
   * List of handlers for NotificationTaskTypes.
   */
  readonly processors: StorageFileInitializeFromUploadServiceProcessor[];
}

/**
 * A basic StorageFileInitializeFromUploadService implementation.
 */
export function storageFileInitializeFromUploadService(config: StorageFileInitializeFromUploadServiceConfig): StorageFileInitializeFromUploadService {
  const { processors: inputProcessors, determiner: inputDeterminers, validate } = config;

  /*
  const allDeterminers: UploadedFileTypeDeterminer[] = inputDeterminers ?? [];
  const processors: Record<UploadedFileTypeIdentifier, StorageFileInitializeFromUploadServiceProcessor> = {};

  inputProcessors.forEach((processor) => {
    const { type: inputTypes, determiner: inputDeterminer } = processor;
    const types = asArray(inputTypes);

    types.forEach((type) => {
      processors[type] = processor;
    });

    if (inputDeterminer) {
      determiners.push(inputDeterminer);
    }
  });

  if (validate) {
    const allProcessorTypes = Object.keys(processors);
    const allDeterminerTypes = new Set(determiner.getPossibleFileTypes());

  }
    */

  return {
    // TODO: ...
  };
}
