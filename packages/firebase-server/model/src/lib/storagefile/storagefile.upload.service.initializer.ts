import { CombineUploadFileTypeDeterminerConfig, combineUploadFileTypeDeterminers, FirebaseStorageAccessorFile, limitUploadFileTypeDeterminer, StorageFileDocument, StorageFileInitializeFromUploadResultType, UploadedFileDetailsAccessor, uploadedFileDetailsAccessorFactory, UploadedFileTypeDeterminer, UploadedFileTypeDeterminerResult, UploadedFileTypeIdentifier } from '@dereekb/firebase';
import { ArrayOrValue, asArray, asDecisionFunction, AsyncDecisionFunction, Maybe, pushItemOrArrayItemsIntoArray } from '@dereekb/util';
import { StorageFileInitializeFromUploadInput, StorageFileInitializeFromUploadResult, StorageFileInitializeFromUploadService } from './storagefile.upload.service';

export interface StorageFileInitializeFromUploadServiceInitializerInput {
  /**
   * The result of the determiner.
   */
  readonly determinerResult: UploadedFileTypeDeterminerResult;
  /**
   * The uploaded file.
   */
  readonly fileDetailsAccessor: UploadedFileDetailsAccessor;
}

export interface StorageFileInitializeFromUploadServiceInitializerResult {
  /**
   * The StorageFileDocument, if it was initialized.
   */
  readonly storageFileDocument?: Maybe<StorageFileDocument>;
}

/**
 * Processes the input details accessor and returns the results.
 */
export type StorageFileInitializeFromUploadServiceInitializerFunction = (input: StorageFileInitializeFromUploadServiceInitializerInput) => Promise<StorageFileInitializeFromUploadServiceInitializerResult>;

export interface StorageFileInitializeFromUploadServiceInitializer {
  /**
   * The file type(s) identifier that this processor handles.
   */
  readonly type: ArrayOrValue<UploadedFileTypeIdentifier>;
  /**
   * A determiner that is paired with the processor.
   *
   * Determiners defined here are modified to ONLY respond to the types specified in the `type` property. This means that
   * if the determiner returns a separate type, that result will be altered to be null, instead of returned as a match.
   */
  readonly determiner?: Maybe<UploadedFileTypeDeterminer>;
  /**
   * Handles the initialization of the StorageFileDocument from the uploaded file.
   */
  readonly initialize: StorageFileInitializeFromUploadServiceInitializerFunction;
}

export interface StorageFileInitializeFromUploadServiceConfig {
  /**
   * If true, will validate that all processor file types have at least one corresponding determiner.
   */
  readonly validate?: boolean;
  /**
   * The UploadedFileTypeDeterminer(s) to use for determining the upload type of each uploaded file.
   *
   * They will be combined together with determiners from the processors.
   */
  readonly determiner: ArrayOrValue<UploadedFileTypeDeterminer>;
  /**
   * Configuration for combining the determiners.
   *
   * Defaults to:
   * - completeSearchOnFirstMatch: true
   */
  readonly combineDeterminersConfig?: Maybe<CombineUploadFileTypeDeterminerConfig>;
  /**
   * Optional function to check if the file is allowed to be initialized.
   */
  readonly checkFileIsAllowedToBeInitialized?: Maybe<AsyncDecisionFunction<FirebaseStorageAccessorFile>>;
  /**
   * List of handlers for NotificationTaskTypes.
   */
  readonly processors: StorageFileInitializeFromUploadServiceInitializer[];
}

/**
 * A basic StorageFileInitializeFromUploadService implementation.
 */
export function storageFileInitializeFromUploadService(config: StorageFileInitializeFromUploadServiceConfig): StorageFileInitializeFromUploadService {
  const { processors: inputProcessors, determiner: inputDeterminers, validate, checkFileIsAllowedToBeInitialized: inputCheckFileIsAllowedToBeInitialized } = config;

  const allDeterminers: UploadedFileTypeDeterminer[] = [];
  const processors: Record<UploadedFileTypeIdentifier, StorageFileInitializeFromUploadServiceInitializer> = {};
  const detailsAccessorFactory = uploadedFileDetailsAccessorFactory();

  if (inputDeterminers) {
    pushItemOrArrayItemsIntoArray(allDeterminers, inputDeterminers);
  }

  // iterate processors
  inputProcessors.forEach((processor) => {
    const { type: inputTypes, determiner: inputDeterminer } = processor;
    const types = asArray(inputTypes);

    types.forEach((type) => {
      processors[type] = processor;
    });

    if (inputDeterminer) {
      const wrappedDeterminer = limitUploadFileTypeDeterminer(inputDeterminer, types);
      allDeterminers.push(wrappedDeterminer);
    }
  });

  const determiner = combineUploadFileTypeDeterminers({
    determiners: allDeterminers,
    ...{
      completeSearchOnFirstMatch: true,
      ...config.combineDeterminersConfig
    }
  });

  // validate processors
  if (validate) {
    const allProcessorTypes = Object.keys(processors);
    const allDeterminerTypes = new Set(determiner.getPossibleFileTypes());

    // all processor types should have a corresponding determiner
    allProcessorTypes.forEach((type) => {
      if (!allDeterminerTypes.has(type)) {
        throw new Error(`Processor type ${type} does not have a corresponding determiner.`);
      }
    });
  }

  return {
    checkFileIsAllowedToBeInitialized: inputCheckFileIsAllowedToBeInitialized ?? asDecisionFunction(true),
    initializeFromUpload: async (input: StorageFileInitializeFromUploadInput) => {
      const { file } = input;
      const fileDetailsAccessor = detailsAccessorFactory(file);
      const determinerResult = await determiner.determine(fileDetailsAccessor);

      let resultType: StorageFileInitializeFromUploadResultType;
      let storageFileDocument: Maybe<StorageFileDocument>;
      let processorError: Maybe<unknown>;

      if (determinerResult) {
        resultType = 'success';

        const processor = processors[determinerResult.type];

        if (processor) {
          try {
            const processorResult = await processor.initialize({ determinerResult, fileDetailsAccessor });
            storageFileDocument = processorResult.storageFileDocument;
          } catch (e) {
            resultType = 'processor_error';
            processorError = e;
          }
        } else {
          resultType = 'no_processor_configured';
        }
      } else {
        resultType = 'no_determiner_match';
      }

      const result: StorageFileInitializeFromUploadResult = {
        resultType,
        storageFileDocument,
        initializationError: processorError
      };

      return result;
    }
  };
}
