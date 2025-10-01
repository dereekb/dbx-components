import { CombineUploadFileTypeDeterminerConfig, combineUploadFileTypeDeterminers, FirebaseStorageAccessorFile, limitUploadFileTypeDeterminer, StorageFileDocument, StorageFileInitializeFromUploadResultType, StoredFileReader, storedFileReaderFactory, UploadedFileTypeDeterminer, UploadedFileTypeDeterminerResult, UploadedFileTypeIdentifier } from '@dereekb/firebase';
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
  readonly fileDetailsAccessor: StoredFileReader;
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
  readonly determiner?: Maybe<ArrayOrValue<UploadedFileTypeDeterminer>>;
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
  readonly initializer: StorageFileInitializeFromUploadServiceInitializer[];
}

/**
 * A basic StorageFileInitializeFromUploadService implementation.
 */
export function storageFileInitializeFromUploadService(config: StorageFileInitializeFromUploadServiceConfig): StorageFileInitializeFromUploadService {
  const { initializer: inputInitializers, determiner: inputDeterminers, validate, checkFileIsAllowedToBeInitialized: inputCheckFileIsAllowedToBeInitialized } = config;

  const allDeterminers: UploadedFileTypeDeterminer[] = [];
  const initializers: Record<UploadedFileTypeIdentifier, StorageFileInitializeFromUploadServiceInitializer> = {};
  const detailsAccessorFactory = storedFileReaderFactory();

  if (inputDeterminers) {
    pushItemOrArrayItemsIntoArray(allDeterminers, inputDeterminers);
  }

  // iterate initializers
  inputInitializers.forEach((initializer) => {
    const { type: inputTypes, determiner: inputDeterminer } = initializer;
    const types = asArray(inputTypes);

    types.forEach((type) => {
      initializers[type] = initializer;
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

  // validate initializers
  if (validate) {
    const allInitializerTypes = Object.keys(initializers);
    const allDeterminerTypes = new Set(determiner.getPossibleFileTypes());

    // all initializer types should have a corresponding determiner
    allInitializerTypes.forEach((type) => {
      if (!allDeterminerTypes.has(type)) {
        throw new Error(`Initializer type ${type} does not have a corresponding determiner.`);
      }
    });
  }

  async function determineUploadFileType(input: StorageFileInitializeFromUploadInput): Promise<Maybe<UploadedFileTypeDeterminerResult>> {
    const { file } = input;
    const fileDetailsAccessor = detailsAccessorFactory(file);
    return determiner.determine(fileDetailsAccessor);
  }

  return {
    checkFileIsAllowedToBeInitialized: inputCheckFileIsAllowedToBeInitialized ?? asDecisionFunction(true),
    determineUploadFileType,
    initializeFromUpload: async (input: StorageFileInitializeFromUploadInput) => {
      const determinerResult = await determineUploadFileType(input);

      let resultType: StorageFileInitializeFromUploadResultType;
      let storageFileDocument: Maybe<StorageFileDocument>;
      let processorError: Maybe<unknown>;

      if (determinerResult) {
        const { input: fileDetailsAccessor } = determinerResult;

        resultType = 'success';

        const initializer = initializers[determinerResult.type];

        if (initializer) {
          try {
            const initializerResult = await initializer.initialize({ determinerResult, fileDetailsAccessor });
            storageFileDocument = initializerResult.storageFileDocument;
          } catch (e) {
            resultType = 'initializer_error';
            processorError = e;
          }
        } else {
          resultType = 'no_initializer_configured';
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
