import { type ArrayOrValue, asArray, decisionFunction, type DecisionFunction, type FactoryWithRequiredInput, type Maybe, mergeSlashPaths, type PromiseOrValue, SLASH_PATH_FILE_TYPE_SEPARATOR, type SlashPathFile, type SlashPathFolder, type SlashPathPart, slashPathPathMatcher, type SlashPathPathMatcherConfigInput, slashPathSubPathMatcher, type SlashPathSubPathMatcherConfig, unique } from '@dereekb/util';
import { type UploadedFileTypeIdentifier, UPLOADS_FOLDER_PATH, ALL_USER_UPLOADS_FOLDER_NAME } from './storagefile.upload';
import { type FirebaseAuthUserId, type StorageBucketId } from '../../common';
import { type StoredFileReader } from './storagefile.file';

/**
 * @module storagefile.upload.determiner
 *
 * Provides the upload type determination system for classifying uploaded files.
 *
 * Determiners inspect a file's path, name, metadata, or content to assign an
 * {@link UploadedFileTypeIdentifier} with a confidence level. Multiple determiners
 * can be combined via {@link combineUploadFileTypeDeterminers}, and user detection
 * can be added via {@link determineUserByFolderWrapperFunction}.
 *
 * Built-in determiners:
 * - {@link determineByFileName} — match by file name or prefix
 * - {@link determineByFolderName} — match by parent folder name
 * - {@link determineByFilePath} — match by full path pattern with optional bucket filtering
 */

/**
 * Confidence level of a file type determination. Higher values indicate higher confidence.
 *
 * When multiple determiners match, the one with the highest level wins.
 *
 * Higher values indicate higher confidence.
 *
 * For example, a match by a file name would potentially have a higher confidence than a match by folder name
 * in the case where we have two determiners:
 * - One looking for 'avatar.png' exactly
 * - One looking for the folder 'photos' exactly
 *
 * In this case, the folder match should return a lower determination level than the file name match, so that
 * it is processed properly.
 *
 * In the ideal case there generally shouldn't be two determiners that could potentially match the same file.
 */
export type UploadedFileTypeDeterminationLevel = number;

/**
 * Lower determination level.
 */
export const LOW_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL = 1;

/**
 * Default determination level.
 */
export const DEFAULT_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL = 2;

/**
 * High determination level.
 */
export const HIGH_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL = 3;

/**
 * Exact match determination level.
 *
 * The default highest determination level.
 */
export const EXACT_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL = 10;

/**
 * Result of a StorageFileUploadTypeDeterminer.
 */
export interface UploadedFileTypeDeterminerResult {
  /**
   * The input file details accessor.
   */
  readonly input: StoredFileReader;
  /**
   * The determined type identifier.
   */
  readonly type: UploadedFileTypeIdentifier;
  /**
   * The level of confidence in the determined type.
   */
  readonly level: UploadedFileTypeDeterminationLevel;
  /**
   * The user this file appears to be associated with.
   *
   * Unset if no user determination could be made.
   */
  readonly user?: Maybe<FirebaseAuthUserId>;
}

/**
 * Async function that determines the upload type of a StorageFile.
 *
 * Returns a determination result or undefined if the function cannot determine the upload type.
 */
export type UploadedFileTypeDeterminationFunction = (input: StoredFileReader) => PromiseOrValue<Maybe<UploadedFileTypeDeterminerResult>>;

/**
 * Strategy interface for determining the upload type of a file in Firebase Storage.
 *
 * Implement custom determiners for application-specific file type classification,
 * or use the built-in factory functions ({@link determineByFileName}, {@link determineByFolderName},
 * {@link determineByFilePath}).
 */
export interface UploadedFileTypeDeterminer {
  /**
   * Determine function
   */
  readonly determine: UploadedFileTypeDeterminationFunction;
  /**
   * Returns a list of possible file types that this determiner can handle.
   */
  getPossibleFileTypes(): UploadedFileTypeIdentifier[];
}

// MARK: Implementations
export interface DetermineByFileNameConfig {
  /**
   * The file type identifier to match on.
   */
  readonly fileType: UploadedFileTypeIdentifier;
  /**
   * Case-sensitive file name to try and match on.
   *
   * If this value contains a file type/extension then will match on the file name exactly.
   *
   * Otherwise, will match on file names that begin with this value (e.g. "image" will match "image.png", "image.jpg", "image-test.png", etc.).
   */
  readonly match: SlashPathFile;
  /**
   * The determination level to use if the file name exactly matches the match value.
   *
   * Defaults to EXACT_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL.
   */
  readonly exactMatchDeterminationLevel?: Maybe<UploadedFileTypeDeterminationLevel>;
  /**
   * The determination level to use if the file name matches the match value.
   *
   * Defaults to HIGH_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL.
   */
  readonly nameMatchDeterminationLevel?: Maybe<UploadedFileTypeDeterminationLevel>;
}

/**
 * Creates a determiner that classifies files by their file name.
 *
 * If the match string includes a file extension (e.g., `avatar.png`), only exact matches succeed
 * at {@link EXACT_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL}. Otherwise, prefix matching is used
 * (e.g., `image` matches `image.png`, `image-test.jpg`) at {@link HIGH_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL}.
 *
 * @param config - file type, match string, and optional determination levels
 *
 * @example
 * ```ts
 * const avatarDeterminer = determineByFileName({
 *   fileType: 'avatar',
 *   match: 'avatar.png'
 * });
 * ```
 */
export function determineByFileName(config: DetermineByFileNameConfig): UploadedFileTypeDeterminer {
  const { fileType, match, exactMatchDeterminationLevel: inputExactMatchDeterminationLevel, nameMatchDeterminationLevel: inputNameMatchDeterminationLevel } = config;
  const mustMatchExactly = match.includes(SLASH_PATH_FILE_TYPE_SEPARATOR);
  const exactMatchDeterminationLevel = inputExactMatchDeterminationLevel ?? EXACT_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL;
  const nameMatchDeterminationLevel = inputNameMatchDeterminationLevel ?? HIGH_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL;

  const testFileName: FactoryWithRequiredInput<Maybe<UploadedFileTypeDeterminationLevel>, SlashPathPart> = mustMatchExactly
    ? (fileName) => (fileName === match ? exactMatchDeterminationLevel : undefined) // exact match
    : (fileName) => (fileName.startsWith(match) ? nameMatchDeterminationLevel : undefined); // name match

  return {
    determine: (input) => {
      let result: Maybe<UploadedFileTypeDeterminerResult>;

      const pathDetails = input.getPathDetails();

      if (pathDetails.file) {
        const matchLevel = testFileName(pathDetails.file);

        if (matchLevel != null) {
          result = {
            input,
            type: fileType,
            level: matchLevel
          };
        }
      }

      return result;
    },
    getPossibleFileTypes: () => [fileType]
  };
}

export interface DetermineByFolderNameConfig {
  /**
   * The file type identifier to determine.
   */
  readonly fileType: UploadedFileTypeIdentifier;
  /**
   * The case-sensitive folder name to match on.
   */
  readonly match: SlashPathPart;
}

/**
 * Creates a determiner that classifies files by their parent folder name.
 *
 * Matches at {@link EXACT_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL} when the folder path
 * exactly equals the configured match string.
 *
 * @param config - file type and folder name to match
 *
 * @example
 * ```ts
 * const photoDeterminer = determineByFolderName({
 *   fileType: 'photo',
 *   match: 'photos'
 * });
 * ```
 */
export function determineByFolderName(config: DetermineByFolderNameConfig): UploadedFileTypeDeterminer {
  const { fileType, match } = config;

  return {
    determine: (input) => {
      const pathDetails = input.getPathDetails();
      const folderPath = pathDetails.folderPath;

      let result: Maybe<UploadedFileTypeDeterminerResult>;

      if (folderPath === match) {
        result = {
          input,
          type: fileType,
          level: EXACT_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL
        };
      }

      return result;
    },
    getPossibleFileTypes: () => [fileType]
  };
}

export interface DetermineByFilePathConfig {
  /**
   * The file type identifier to return.
   */
  readonly fileType: UploadedFileTypeIdentifier;
  /**
   * Optional decision function to filter/match the bucket.
   */
  readonly matchBucket?: Maybe<DecisionFunction<StorageBucketId>>;
  /**
   * Match path configuration to use.
   */
  readonly match: SlashPathPathMatcherConfigInput;
  /**
   * Optional decision function to further filter/match the input.
   */
  readonly matchFileDetails?: Maybe<DecisionFunction<StoredFileReader>>;
  /**
   * The determination level to use if the file name matches the match value.
   *
   * Defaults to HIGH_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL.
   */
  readonly matchDeterminationLevel?: Maybe<UploadedFileTypeDeterminationLevel>;
}

/**
 * Creates a determiner that classifies files by their full storage path, with optional
 * bucket filtering and additional file details matching.
 *
 * Uses {@link slashPathPathMatcher} for path pattern matching. Most flexible of the
 * built-in determiners.
 *
 * @param config - file type, path match config, optional bucket/file filters
 *
 * @example
 * ```ts
 * const reportDeterminer = determineByFilePath({
 *   fileType: 'report',
 *   match: { targetPath: 'reports', matchType: 'startsWith' },
 *   matchBucket: (bucket) => bucket === 'my-bucket'
 * });
 * ```
 */
export function determineByFilePath(config: DetermineByFilePathConfig): UploadedFileTypeDeterminer {
  const { fileType, match, matchDeterminationLevel: inputMatchDeterminationLevel, matchBucket: inputMatchBucket, matchFileDetails: inputMatchFile } = config;

  const pathMatcher = slashPathPathMatcher(match);
  const matchBucket = typeof inputMatchBucket === 'function' ? inputMatchBucket : decisionFunction(true);
  const matchFileDetails = typeof inputMatchFile === 'function' ? inputMatchFile : decisionFunction(true);
  const matchDeterminationLevel = inputMatchDeterminationLevel ?? HIGH_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL;

  return {
    determine: (input) => {
      let result: Maybe<UploadedFileTypeDeterminerResult>;
      const { bucketId, pathString } = input.input;

      if (matchBucket(bucketId)) {
        const { matchesTargetPath } = pathMatcher(pathString);

        if (matchesTargetPath && matchFileDetails(input)) {
          result = {
            input,
            type: fileType,
            level: matchDeterminationLevel
          };
        }
      }

      return result;
    },
    getPossibleFileTypes: () => [fileType]
  };
}

export interface DetermineUserByFolderWrapperFunctionConfig {
  /**
   * Requires the detection of a user.
   *
   * If no user can be detected, the determination will return null, even if the wrapped determiner would have otherwise returned a result.
   *
   * Defaults to false.
   */
  readonly requireUser?: boolean;
  /**
   * The root folder/path to filter on.
   *
   * Defaults to the value of UPLOADS_FOLDER_PATH.
   */
  readonly rootFolder: SlashPathPart;
  /**
   * Specific user folder/path to filter on. This path must match the path that comes after the rootFolder exactly.
   *
   * For example, if the rootFolder is "uploads" and the userFolderPrefix is "u", then the user at the path "uploads/u/123/avatar.png" would be "123".
   */
  readonly userFolderPrefix: SlashPathPart | SlashPathFolder;
  /**
   * Sub path matcher configuration.
   *
   * If provided, the rootFolder and userFolderPrefix are ignored.
   */
  readonly matchSubPath?: Maybe<SlashPathSubPathMatcherConfig>;
  /**
   * Whether to allow sub-paths after the user folder.
   *
   * Defaults to true.
   */
  readonly allowSubPaths?: boolean;
}

/**
 * Wraps the input determiner with determineUserByFolder.
 */
export type DetermineUserByFolderDeterminerWrapperFunction = (determiner: UploadedFileTypeDeterminer) => UploadedFileTypeDeterminer;

/**
 * Creates a wrapper function that adds user detection to any {@link UploadedFileTypeDeterminer}
 * by inspecting the folder path structure.
 *
 * Extracts the user ID from a path like `{rootFolder}/{userFolderPrefix}/{userId}/{file}`.
 * If `requireUser` is true, the determination fails when no user can be detected.
 *
 * @param config - root folder, user prefix, and matching options
 *
 * @example
 * ```ts
 * const addUser = determineUserByFolderWrapperFunction({
 *   rootFolder: 'uploads',
 *   userFolderPrefix: 'u'
 * });
 * const withUser = addUser(myDeterminer);
 * ```
 */
export function determineUserByFolderWrapperFunction(config: DetermineUserByFolderWrapperFunctionConfig): DetermineUserByFolderDeterminerWrapperFunction {
  const { rootFolder, userFolderPrefix, requireUser = false, allowSubPaths: inputAllowSubPaths = true } = config;
  const allowSubPaths = inputAllowSubPaths ?? true;
  const subPathMatcherConfig = config.matchSubPath ?? { basePath: mergeSlashPaths([rootFolder, userFolderPrefix]) };
  const pathMatcher = slashPathSubPathMatcher(subPathMatcherConfig);

  return (determiner: UploadedFileTypeDeterminer) => {
    return {
      determine: async (input) => {
        const determinerResult = await determiner.determine(input);
        let result: Maybe<UploadedFileTypeDeterminerResult>;

        if (determinerResult) {
          if (determinerResult.user) {
            result = determinerResult;
          } else {
            const pathDetails = input.getPathDetails();
            const pathRootFolder = pathDetails.parts[0];

            if (pathRootFolder === rootFolder) {
              // root folder matches, continue
              const { matchesBasePath, subPathParts } = pathMatcher(pathDetails.path);

              if (matchesBasePath && (allowSubPaths ? subPathParts.length >= 2 : subPathParts.length === 2)) {
                // must have two parts: the user folder and the file
                const user = subPathParts[0];

                result = {
                  ...determinerResult,
                  user
                };
              }
            }
          }

          // If requireUser is true and no user was detected, return null.
          if (requireUser && !result?.user) {
            result = null;
          }
        }

        return result;
      },
      getPossibleFileTypes: () => determiner.getPossibleFileTypes()
    };
  };
}

/**
 * Convenience wrapper pre-configured for the standard uploads folder structure (`uploads/u/{userId}/...`).
 *
 * @example
 * ```ts
 * const addUser = determineUserByUserUploadsFolderWrapperFunction();
 * const withUser = addUser(myDeterminer);
 * ```
 */
export function determineUserByUserUploadsFolderWrapperFunction(config?: Omit<DetermineUserByFolderWrapperFunctionConfig, 'rootFolder' | 'userFolderPrefix'>): DetermineUserByFolderDeterminerWrapperFunction {
  return determineUserByFolderWrapperFunction({
    ...config,
    rootFolder: UPLOADS_FOLDER_PATH,
    userFolderPrefix: ALL_USER_UPLOADS_FOLDER_NAME
  });
}

/**
 * Configuration for determineUserByFolder().
 */
export interface DetermineUserByFolderFunctionConfig extends DetermineUserByFolderWrapperFunctionConfig {
  /**
   * The determiner to wrap.
   */
  readonly determiner: UploadedFileTypeDeterminer;
}

/**
 * Convenience function for using determineUserByFolderWrapperFunction directly on a pre-set determiner.
 *
 * @param config Configuration.
 * @returns The wrapped UploadedFileTypeDeterminer.
 */
export function determineUserByFolder(config: DetermineUserByFolderFunctionConfig): UploadedFileTypeDeterminer {
  return determineUserByFolderWrapperFunction(config)(config.determiner);
}

/**
 * Configuration for limitUploadFileTypeDeterminer.
 */
export interface LimitUploadFileTypeDeterminerConfig {
  /**
   * The file type(s) to allow.
   */
  readonly allowedType: ArrayOrValue<UploadedFileTypeIdentifier>;
  /**
   * The determiner to wrap.
   */
  readonly determiner: UploadedFileTypeDeterminer;
}

/**
 * Wraps an {@link UploadedFileTypeDeterminer} to only return results for the specified file types.
 *
 * Useful for scoping a broad determiner to a subset of types in a specific context.
 *
 * @param determiner - the determiner to filter
 * @param types - allowed file type identifier(s)
 *
 * @example
 * ```ts
 * const limited = limitUploadFileTypeDeterminer(broadDeterminer, ['avatar', 'photo']);
 * ```
 */
export function limitUploadFileTypeDeterminer(determiner: UploadedFileTypeDeterminer, types: ArrayOrValue<UploadedFileTypeIdentifier>): UploadedFileTypeDeterminer {
  const allowedTypes = asArray(types);
  const allowedTypeSet = new Set(allowedTypes);

  return {
    determine: async (input) => {
      const result = await determiner.determine(input);

      // if the result's type is not in the allowed types, return null.
      return result && allowedTypeSet.has(result.type) ? result : null;
    },
    getPossibleFileTypes: () => allowedTypes
  };
}

export interface CombineUploadFileTypeDeterminerConfig {
  /**
   * The determiners to combine/try.
   *
   * Determiners are tried in order and sequentially.
   */
  readonly determiners: UploadedFileTypeDeterminer[];
  /**
   * If true, will complete the search early if any determiner returns a LOW_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL or higher result level.
   *
   * Defaults to false.
   */
  readonly completeSearchOnFirstMatch?: Maybe<boolean>;
  /**
   * The level at which to complete the search early if any determiner returns a result at or above that level.
   *
   * Ignored if `completeSearchOnFirstMatch` is true.
   */
  readonly completeSearchAtLevel?: Maybe<UploadedFileTypeDeterminationLevel>;
}

/**
 * Combines multiple {@link UploadedFileTypeDeterminer} instances into a single determiner
 * that tries each in order and returns the highest-confidence match.
 *
 * If only one determiner is provided, it is returned unwrapped. The search can be
 * short-circuited via `completeSearchOnFirstMatch` or `completeSearchAtLevel`.
 *
 * @param config - determiners to combine and optional early-exit settings
 *
 * @example
 * ```ts
 * const combined = combineUploadFileTypeDeterminers({
 *   determiners: [avatarDeterminer, photoDeterminer, documentDeterminer],
 *   completeSearchOnFirstMatch: true
 * });
 * ```
 */
export function combineUploadFileTypeDeterminers(config: CombineUploadFileTypeDeterminerConfig): UploadedFileTypeDeterminer {
  const { determiners, completeSearchAtLevel: inputCompleteSearchAtLevel, completeSearchOnFirstMatch: inputCompleteSearchOnFirstMatch } = config;
  let result: UploadedFileTypeDeterminer;

  if (determiners.length === 1) {
    result = determiners[0];
  } else {
    const possibleFileTypes = unique(determiners.map((d) => d.getPossibleFileTypes()).flat());
    const completeSearchOnFirstMatch = Boolean(inputCompleteSearchOnFirstMatch);
    const completeSearchAtLevel = completeSearchOnFirstMatch ? LOW_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL : (inputCompleteSearchAtLevel ?? EXACT_UPLOADED_FILE_TYPE_DETERMINATION_LEVEL);

    result = {
      determine: async (input) => {
        let result: Maybe<UploadedFileTypeDeterminerResult>;

        for (const determiner of determiners) {
          const stepResult = await determiner.determine(input);

          if (stepResult) {
            if (stepResult.level >= completeSearchAtLevel) {
              result = stepResult;
              break;
            } else if (!result || stepResult.level > result.level) {
              result = stepResult; // update result to the higher level match
            }
          }
        }

        return result;
      },
      getPossibleFileTypes: () => possibleFileTypes
    };
  }

  return result;
}
