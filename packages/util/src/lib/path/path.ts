import { chainMapSameFunctions, type MapSameFunction } from '../value/map';
import { asArray, type ArrayOrValue, pushItemOrArrayItemsIntoArray, lastValue } from '../array/array';
import { firstAndLastCharacterOccurrence, replaceCharacterAtIndexWith, splitStringAtIndex } from '../string/char';
import { chainMapFunction, indexRange, type IndexRangeInput, mapIdentityFunction, type Maybe } from '../value';
import { type FactoryWithRequiredInput } from '../getter/getter';
import { sliceIndexRangeFunction } from '../array/array.index';
import { replaceStringsFunction } from '../string/replace';

export const SLASH_PATH_SEPARATOR = '/';
export const SLASH_PATH_FILE_TYPE_SEPARATOR = '.';

export type SlashPathSeparatorString = typeof SLASH_PATH_SEPARATOR;
export type SlashFileTypeSeparatorString = typeof SLASH_PATH_FILE_TYPE_SEPARATOR;

export const DEFAULT_SLASH_PATH_ILLEGAL_CHARACTERS = ['#', '[', ']', '*', '?'];

/**
 * Default replacement character for illegal characters.
 */
export const DEFAULT_SLASH_PATH_ILLEGAL_CHARACTER_REPLACEMENT = '_';

/**
 * A relative folder path that does not start with a slash.
 */
export type RelativeSlashPathFolder = `${string}${SlashPathSeparatorString}`;

/**
 * An absolute folder path that starts with a slash.
 */
export type AbsoluteSlashPathFolder = `${SlashPathSeparatorString}${string}${SlashPathSeparatorString}`;

/**
 * A forward-slash path string.
 */
export type SlashPathFolder = AbsoluteSlashPathFolder | RelativeSlashPathFolder | `${SlashPathSeparatorString}`;

/**
 * A relative folder path that is just an empty string.
 */
export type EmptyRelativeSlashPathFolder = '';

/**
 * This type includes the empty relative folder path possibility.
 */
export type InferredSlashPathFolder = SlashPathFolder | EmptyRelativeSlashPathFolder;

/**
 * A SlashPath file name without a file type identifier (e.g. 'image', and not 'image.png')
 */
export type SlashPathUntypedFile = string;

/**
 * A file name that contains a file type identifier (e.g. 'image.png')
 */
export type SlashPathTypedFile = `${string}${SlashFileTypeSeparatorString}${string}`;

/**
 * A SlashPath file name
 */
export type SlashPathFile = SlashPathUntypedFile | SlashPathTypedFile;

/**
 * A simple path made up of UTF-8 characters and slashes
 */
export type SlashPath = SlashPathFolder | SlashPathFile | SlashPathTypedFile;

/**
 * A part of a slash path.
 *
 * Does not contain any slashes.
 */
export type SlashPathPart = string | SlashPathTypedFile;

/**
 * Function that modifies the input SlashPath
 */
export type SlashPathFunction = MapSameFunction<SlashPath>;

/**
 * Slash path type
 * - folder: is a folder
 * - file: is a file without a type
 * - typedfile: is a file with a type
 * - invalid: is an invalid slash path that might contain multiple '.' values, or is an empty string.
 */
export type SlashPathType = 'folder' | 'file' | 'typedfile' | 'invalid';

/**
 * Returns the SlashPathType for the input.
 *
 * @param input
 * @returns
 */
export function slashPathType(input: SlashPath): SlashPathType {
  const dotCount = input.split(SLASH_PATH_FILE_TYPE_SEPARATOR, 3).length - 1;
  let type: SlashPathType;

  switch (dotCount) {
    case 0:
      if (input.length === 0) {
        type = 'invalid';
      } else {
        const lastValue = input[input.length - 1];

        if (lastValue === SLASH_PATH_SEPARATOR) {
          type = 'folder';
        } else {
          type = 'file';
        }
      }
      break;
    case 1:
      type = 'typedfile';
      break;
    default:
      type = 'invalid';
      break;
  }

  return type;
}

export function isSlashPathFile(input: string): input is SlashPathFile {
  const type = slashPathType(input);
  return type === 'file' || type === 'typedfile';
}

export function isSlashPathTypedFile(input: string): input is SlashPathTypedFile {
  const type = slashPathType(input);
  return type === 'typedfile';
}

export function isSlashPathFolder(input: string): input is SlashPathFolder {
  return slashPathType(input) === 'folder';
}

export function isValidSlashPath(input: string): input is SlashPath {
  return slashPathType(input) !== 'invalid';
}

/**
 * Returns the last part of the slash path.
 *
 * @param slashPath
 */
export function slashPathName(slashPath: SlashPath): SlashPathPart {
  const parts = slashPathParts(slashPath);
  return lastValue(parts);
}

/**
 * Returns each section of a SlashPath
 *
 * @param slashPath
 * @returns
 */
export function slashPathParts(slashPath: SlashPath): SlashPathPart[] {
  return slashPath.split(SLASH_PATH_SEPARATOR).filter((x) => Boolean(x));
}

/**
 * Slash path type to enforce.
 * - relative: path that does not start with a slash
 * - absolute: path that starts with a slash
 * - any: either relative or absolute
 */
export type SlashPathStartType = 'relative' | 'absolute' | 'any';

/**
 * Factory use to set the slash path type of the input.
 */
export type SlashPathStartTypeFactory = SlashPathFunction;

export function slashPathStartTypeFactory(type: SlashPathStartType): SlashPathStartTypeFactory {
  let fn: SlashPathStartTypeFactory;

  switch (type) {
    case 'relative':
      fn = toRelativeSlashPathStartType;
      break;
    case 'absolute':
      fn = toAbsoluteSlashPathStartType;
      break;
    case 'any':
      fn = mapIdentityFunction();
      break;
  }

  return fn;
}

export const LEADING_SLASHES_REGEX = /^\/+/;
export const TRAILING_SLASHES_REGEX = /\/+$/;
export const TRAILING_FILE_TYPE_SEPARATORS_REGEX = /\.+$/;
export const ALL_SLASHES_REGEX = /\/+/g;
export const ALL_DOUBLE_SLASHES_REGEX = /\/{2,}/g;
export const ALL_SLASH_PATH_FILE_TYPE_SEPARATORS_REGEX = /\.+/g;

export function toRelativeSlashPathStartType(input: SlashPath): SlashPath {
  // remove all leading slashes
  return input.replace(LEADING_SLASHES_REGEX, '');
}

/**
 * Factory function that creates a SlashPathFolder from a string.
 */
export type SlashPathFolderFactory = (input: string) => InferredSlashPathFolder;

export interface SlashPathFolderFactoryConfig {
  /**
   * Optional start type for the slash path. Defaults to 'any'.
   */
  readonly startType?: SlashPathStartType;
  /**
   * Whether to treat untyped files as folders.
   *
   * Defaults to false.
   */
  readonly treatUntypedFilesAsFolders?: boolean;
  /**
   * Optional validation configuration.
   */
  readonly validationConfig?: SlashPathValidationFactoryConfig;
  /**
   * The path value to return if the input is considered invalid after the validation step.
   *
   * You can also configure the `throwError` option in `validationConfig` to throw an error, in which case this option will be ignored.
   *
   * Defaults to ''.
   */
  readonly invalidPathValue?: Maybe<InferredSlashPathFolder>;
}

/**
 * Creates a SlashPathFolderFactory.
 *
 * @param config Configuration options for the factory.
 * @returns A SlashPathFolderFactory.
 */
export function slashPathFolderFactory(config: SlashPathFolderFactoryConfig = {}): SlashPathFolderFactory {
  const { startType, validationConfig, invalidPathValue: inputInvalidPathValue, treatUntypedFilesAsFolders } = config;

  const invalidPathValue = inputInvalidPathValue ?? '';
  const startTypeFactory = slashPathStartTypeFactory(startType ?? 'any');
  const slashPathValidation = slashPathValidationFactory({
    replaceIllegalCharacters: true,
    replaceIllegalDots: true,
    throwError: false,
    ...validationConfig
  });

  return (input) => {
    const initialPath = slashPathValidation(input);
    const pathType = slashPathType(initialPath);

    let path: Maybe<InferredSlashPathFolder>;

    function pathFromFilePath(filePath: SlashPathFile) {
      const details = slashPathDetails(filePath);
      return details.folderPath;
    }

    switch (pathType) {
      case 'file':
        if (treatUntypedFilesAsFolders) {
          path = initialPath as InferredSlashPathFolder;
        } else {
          path = pathFromFilePath(initialPath);
        }
        break;
      case 'typedfile':
        path = pathFromFilePath(initialPath);
        break;
      case 'folder':
        path = initialPath as InferredSlashPathFolder;
        break;
      case 'invalid':
        path = undefined;
        break;
    }

    if (path != null) {
      path = startTypeFactory(path) as InferredSlashPathFolder;
    } else {
      path = invalidPathValue;
    }

    // must end with a slash to be a proper folder
    if (path && !path.endsWith(SLASH_PATH_SEPARATOR)) {
      path += SLASH_PATH_SEPARATOR;
    }

    return path as InferredSlashPathFolder;
  };
}

/**
 * Converts the input string to a valid slash path folder based on the configuration.
 *
 * If the input is a file, the folder of the file is returned instead.
 *
 * @param input
 */
export function slashPathFolder(input: string, config?: SlashPathFolderFactoryConfig): InferredSlashPathFolder {
  return slashPathFolderFactory({ ...config })(input);
}

/**
 *
 * @param input
 * @returns
 */
export function toAbsoluteSlashPathStartType(input: SlashPath): SlashPath {
  // add a leading slash, and remove any multiple slashes if provided
  return input.startsWith(SLASH_PATH_SEPARATOR) ? input.replace(LEADING_SLASHES_REGEX, SLASH_PATH_SEPARATOR) : `${SLASH_PATH_SEPARATOR}${input}`;
}

export function fixMultiSlashesInSlashPath(input: SlashPath): SlashPath {
  return input.replace(ALL_DOUBLE_SLASHES_REGEX, SLASH_PATH_SEPARATOR);
}

export function replaceMultipleFilePathsInSlashPath(input: SlashPath): SlashPath {
  return input.replace(ALL_DOUBLE_SLASHES_REGEX, SLASH_PATH_SEPARATOR);
}

export function removeTrailingSlashes(input: SlashPath): SlashPath {
  return input.replace(TRAILING_SLASHES_REGEX, '');
}

export function removeTrailingFileTypeSeparators(input: SlashPath): SlashPath {
  return input.replace(TRAILING_FILE_TYPE_SEPARATORS_REGEX, '');
}

/**
 * Replaces all extra and invalidate FilePathTypeSeparator values from the SlashPath, returning a valid SlashPath.
 *
 * @param input
 * @param replaceWith
 * @returns
 */
export function replaceInvalidFilePathTypeSeparatorsInSlashPath(input: SlashPath, replaceWith?: string): SlashPath {
  return replaceInvalidFilePathTypeSeparatorsInSlashPathFunction(replaceWith)(input);
}

/**
 * Creates a function that replaces all extra and invalidate FilePathTypeSeparator values from the SlashPath, returning a valid SlashPath.
 *
 * @param input
 * @param replaceWith
 * @returns
 */
export function replaceInvalidFilePathTypeSeparatorsInSlashPathFunction(replaceWith: string = DEFAULT_SLASH_PATH_ILLEGAL_CHARACTER_REPLACEMENT): SlashPathFunction {
  return (input: SlashPath) => {
    const endsOnFileTypeSeparator = input[input.length - 1] === SLASH_PATH_FILE_TYPE_SEPARATOR;
    const inputToEvaluate = endsOnFileTypeSeparator ? removeTrailingFileTypeSeparators(input) : input;
    const { first, last, occurences } = firstAndLastCharacterOccurrence(inputToEvaluate, SLASH_PATH_FILE_TYPE_SEPARATOR);

    let fixedPath: SlashPath;

    switch (occurences) {
      case 0:
        fixedPath = inputToEvaluate;
        break;
      case 1: {
        const lastSlashPosition = inputToEvaluate.lastIndexOf('/');

        if (lastSlashPosition === -1 || lastSlashPosition < last) {
          // valid path
          fixedPath = inputToEvaluate;
        } else {
          // the dot occurs before another slash, so we should replace it
          fixedPath = replaceCharacterAtIndexWith(inputToEvaluate, last, replaceWith);
        }
        break;
      }
      default: {
        const [head, tail] = splitStringAtIndex(inputToEvaluate, last, true);
        const headWithReplacedSeparators = head.replace(ALL_SLASH_PATH_FILE_TYPE_SEPARATORS_REGEX, replaceWith);

        fixedPath = headWithReplacedSeparators + tail;
        break;
      }
    }

    return fixedPath;
  };
}

/**
 * Factory used to validate and fix invalid SlashPath input.
 */
export type SlashPathValidationFactory = SlashPathFunction;

export interface SlashPathValidationFactoryConfig {
  /**
   * Set of illegal characters to find/replace. If not provided, used the DEFAULT_SLASH_PATH_ILLEGAL_CHARACTERS
   */
  readonly illegalStrings?: ArrayOrValue<string>;
  /**
   * String used to replace all encountered illegal characters.
   *
   * Is true by default.
   */
  readonly replaceIllegalCharacters?: string | boolean;
  /**
   * Whether or not to replace extra dots by treating them as illegal characters.
   *
   * Will replace extra dots with the input value, or if true, will replace them with the value for replaceIllegalCharacters.
   */
  readonly replaceIllegalDots?: string | boolean;
  /**
   * Whether or not to validate a final time after replacing elements and throw an error if it is still not valid.
   *
   * Disabled by default unless replaceIllegalCharacters and replaceIllegalDots are false.
   */
  readonly throwError?: boolean;
}

export function slashPathValidationFactory(config?: SlashPathValidationFactoryConfig): SlashPathValidationFactory {
  const { illegalStrings = DEFAULT_SLASH_PATH_ILLEGAL_CHARACTERS, replaceIllegalCharacters: inputReplaceIllegalCharacters = true, replaceIllegalDots: inputReplaceIllegalDots = true, throwError } = config ?? {};
  const fns: MapSameFunction<SlashPath>[] = [];

  const replaceIllegalCharacters = typeof inputReplaceIllegalCharacters === 'string' ? inputReplaceIllegalCharacters : DEFAULT_SLASH_PATH_ILLEGAL_CHARACTER_REPLACEMENT;

  if (inputReplaceIllegalCharacters != null) {
    fns.push(
      replaceStringsFunction({
        replace: illegalStrings,
        replaceWith: replaceIllegalCharacters
      })
    );
  }

  if (inputReplaceIllegalDots != null) {
    const replaceIllegalDotsWith = typeof inputReplaceIllegalDots === 'string' ? inputReplaceIllegalDots : replaceIllegalCharacters;
    fns.push(replaceInvalidFilePathTypeSeparatorsInSlashPathFunction(replaceIllegalDotsWith));
  }

  if (throwError === true || !(inputReplaceIllegalCharacters || inputReplaceIllegalDots)) {
    fns.push((x) => {
      if (!isValidSlashPath(x)) {
        throw slashPathInvalidError();
      }

      return x;
    });
  }

  return chainMapSameFunctions(fns);
}

/**
 * Factory use to generate/merge file paths together.
 */
export type SlashPathFactory = FactoryWithRequiredInput<SlashPath, ArrayOrValue<Maybe<SlashPath>>>;

export interface SlashPathFactoryConfig {
  /**
   * SlashPath start type to enforce
   */
  readonly startType?: SlashPathStartType;
  /**
   * Prefix paths to append
   */
  readonly basePath?: ArrayOrValue<SlashPathFolder>;
  /**
   * SlashPathValidationFactoryConfig to use for validation.
   */
  readonly validate?: boolean | SlashPathValidationFactoryConfig;
}

export function slashPathFactory(config?: SlashPathFactoryConfig): SlashPathFactory {
  const { startType: type = 'any', basePath: inputBasePaths, validate = true } = config ?? {};
  const basePath = inputBasePaths ? mergeSlashPaths(asArray(inputBasePaths)) : undefined;
  const typeFactory = slashPathStartTypeFactory(type);
  const validationFactory = validate ? (typeof validate === 'boolean' ? slashPathValidationFactory() : slashPathValidationFactory(validate)) : null;
  const finalizeFn = chainMapFunction(typeFactory, validationFactory);

  return (paths: ArrayOrValue<Maybe<SlashPath>>) => {
    const merged = mergeSlashPaths(pushItemOrArrayItemsIntoArray([basePath], paths));
    return finalizeFn(merged);
  };
}

export function mergeSlashPaths(paths: Maybe<SlashPath>[]): SlashPath {
  const merge = paths.filter(Boolean).join(SLASH_PATH_SEPARATOR);
  return fixMultiSlashesInSlashPath(merge);
}

export function slashPathInvalidError() {
  return new Error('The slashPath is invalid.');
}

/**
 * Splits the path and returns the items at the given ranges.
 *
 * @param path
 */
export function isolateSlashPath(path: SlashPath, range: IndexRangeInput): SlashPath {
  return isolateSlashPathFunction({ range })(path);
}

/**
 * isolateSlashPathFunction() config.
 */
export interface IsolateSlashPathFunctionConfig {
  /**
   * Range to isolate
   */
  readonly range: IndexRangeInput;
  /**
   * Start type to force the result to be.
   */
  readonly startType?: SlashPathStartType;
  /**
   * Whether or not to isolate the path to a file path. If true, the result string will not end with a slash.
   */
  readonly asFile?: boolean;
}

/**
 * Isolates a configured index range of path elements.
 *
 * Path start type is retained. I.E. If a relative path is input, a relative path will be returned.
 */
export type IsolateSlashPathFunction = (path: SlashPath) => SlashPath;

/**
 * Creates an IsolateSlashPathFunction.
 *
 * @param config
 * @returns
 */
export function isolateSlashPathFunction(config: IsolateSlashPathFunctionConfig): IsolateSlashPathFunction {
  const { startType, asFile } = config;
  const range = indexRange(config.range);
  const sliceRange = sliceIndexRangeFunction(range);

  return (path: SlashPath) => {
    const split = toRelativeSlashPathStartType(path).split(SLASH_PATH_SEPARATOR);
    const splitRange = sliceRange(split);
    let joined = splitRange.join(SLASH_PATH_SEPARATOR);
    const isFolder = asFile !== true && split.length > range.maxIndex;

    if (isFolder) {
      joined = joined + SLASH_PATH_SEPARATOR; // end with a slash.
    }

    if (startType === 'absolute' || path.startsWith(SLASH_PATH_SEPARATOR)) {
      return toAbsoluteSlashPathStartType(joined);
    } else {
      return joined;
    }
  };
}

// MARK: Details
export interface SlashPathDetails {
  /**
   * The full path
   */
  readonly path: SlashPath;
  /**
   * The path type
   */
  readonly type: SlashPathType;
  /**
   * The last part of the path
   */
  readonly file: SlashPathFile | SlashPathTypedFile;
  /**
   * The last part of the path if it is a typed file
   */
  readonly typedFile: Maybe<SlashPathTypedFile>;
  /**
   * Contains the name of the folder the file is in, if applicable.
   */
  readonly fileFolder: Maybe<SlashPathPart>;
  /**
   * Contains all parts of the path, minus the file part.
   *
   * If there is only one path part and the path is a relative path, this will be an empty string.
   */
  readonly folderPath: InferredSlashPathFolder;
  /**
   * The start type of the path.
   */
  readonly startType: SlashPathStartType;
  /**
   * All parts of the path
   */
  readonly parts: SlashPathPart[];
}

/**
 * Returns the details of a path.
 *
 * @param path The path to get details for.
 * @returns The details of the path.
 */
export function slashPathDetails(path: SlashPath): SlashPathDetails {
  const type = slashPathType(path);
  const parts = slashPathParts(path);
  const fileIndex = parts.length - 1;
  const file = parts[fileIndex];

  let folderPath: InferredSlashPathFolder;
  let fileFolder: Maybe<SlashPathPart>;
  const pathStartsWithSlash = path.startsWith(SLASH_PATH_SEPARATOR);

  if (fileIndex === 0) {
    folderPath = pathStartsWithSlash ? SLASH_PATH_SEPARATOR : '';
    fileFolder = undefined;
  } else {
    const folderPathParts = parts.slice(0, fileIndex);
    folderPath = folderPathParts.join(SLASH_PATH_SEPARATOR) as SlashPathFolder;

    if (pathStartsWithSlash) {
      folderPath = (SLASH_PATH_SEPARATOR + folderPath) as SlashPathFolder;
    }

    fileFolder = folderPathParts[folderPathParts.length - 1];
  }

  return {
    path,
    type,
    file,
    startType: pathStartsWithSlash ? 'absolute' : 'relative',
    typedFile: type === 'typedfile' ? (file as SlashPathTypedFile) : undefined,
    fileFolder,
    folderPath,
    parts
  };
}

// MARK: Sub Path Matcher
export interface SlashPathSubPathMatcherConfig {
  /**
   * The base path to match against.
   */
  readonly basePath: SlashPath;
}

export type SlashPathSubPathMatcherResult = SlashPathSubPathMatcherNonMatchResult | SlashPathSubPathMatcherMatchResult;

export interface SlashPathSubPathMatcherBaseResult {
  /**
   * The input path that was matched.
   */
  readonly inputPath: SlashPath;
  /**
   * True if the input path has the same configured base path.
   */
  readonly matchesBasePath: boolean;
  /**
   * All parts of the input path.
   */
  readonly inputPathParts: SlashPathPart[];
  /**
   * Result of the comparison between the parts of the input path against the base path.
   */
  readonly nonMatchingParts: (SlashPathPart | null)[];
  /**
   * All parts of the sub path, relative to the base path.
   *
   * Only non-null if matchesBasePath is true.
   */
  readonly subPathParts: SlashPathPart[] | null;
}

export interface SlashPathSubPathMatcherMatchResult extends SlashPathSubPathMatcherBaseResult {
  readonly matchesBasePath: true;
  /**
   * All parts of the sub path, relative to the base path.
   */
  readonly subPathParts: SlashPathPart[];
}

export interface SlashPathSubPathMatcherNonMatchResult extends SlashPathSubPathMatcherBaseResult {
  readonly matchesBasePath: false;
  /**
   * Unset when the input path does not match the base path.
   */
  readonly subPathParts: null;
}

/**
 * Used to match sub paths of a specific configured path.
 */
export type SlashPathSubPathMatcher = (path: SlashPath) => SlashPathSubPathMatcherResult;

/**
 * Creates a SlashPathSubPathMatcher.
 *
 * @param config The configuration for the matcher.
 * @returns The matcher.
 */
export function slashPathSubPathMatcher(config: SlashPathSubPathMatcherConfig): SlashPathSubPathMatcher {
  const basePathParts = slashPathParts(config.basePath);

  return (inputPath: SlashPath) => {
    const inputPathParts = slashPathParts(inputPath);

    let nonMatchingPartsCount = 0;

    const nonMatchingParts = basePathParts.map((part, index) => {
      let result: SlashPathPart | null;

      if (part !== inputPathParts[index]) {
        result = part;
        nonMatchingPartsCount += 1;
      } else {
        result = null;
      }

      return result;
    });

    const matchesBasePath = inputPathParts.length >= basePathParts.length && nonMatchingPartsCount === 0;

    let subPathParts: SlashPathPart[] | null = null;

    if (matchesBasePath) {
      subPathParts = inputPathParts.slice(basePathParts.length);
    }

    return {
      inputPath,
      matchesBasePath,
      inputPathParts,
      subPathParts,
      nonMatchingParts
    } as SlashPathSubPathMatcherResult;
  };
}
