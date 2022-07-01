import { chainMapSameFunctions, MapSameFunction } from '../value/map';
import { asArray, ArrayOrValue, mergeArrayOrValueIntoArray } from '../array/array';
import { firstAndLastCharacterOccurrence, replaceCharacterAtIndexWith, replaceStringsFunction, splitStringAtIndex } from '../string';
import { chainMapFunction, MapFunction, mapIdentityFunction } from '../value';
import { FactoryWithRequiredInput } from '../getter/getter';

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
 * A forward-slash path string.
 */
export type SlashPathFolder = `${SlashPathSeparatorString}${string}${SlashPathSeparatorString}` | `${string}${SlashPathSeparatorString}`;

/**
 * A file name without a type.
 */
export type SlashPathFile = string;

/**
 * A file name
 */
export type SlashPathTypedFile = `${string}${SlashFileTypeSeparatorString}${string}`;

/**
 * A simple path made up of UTF-8 characters and slashes
 */
export type SlashPath = SlashPathFolder | SlashPathFile | SlashPathTypedFile;

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
  const dotCount = input.split(SLASH_PATH_FILE_TYPE_SEPARATOR, 2).length;
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
      type = 'file';
      break;
    default:
      type = 'invalid';
      break;
  }

  return type;
}

export function isSlashPathFile(input: string): input is SlashPathTypedFile {
  const type = slashPathType(input);
  return type === 'file' || type === 'typedfile';
}

export function isSlashPathFolder(input: string): input is SlashPathFolder {
  return slashPathType(input) === 'folder';
}

export function isValidSlashPath(input: string): input is SlashPath {
  return slashPathType(input) !== 'invalid';
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
      fn = relativeSlashPathStartTypeFactory;
      break;
    case 'absolute':
      fn = absoluteSlashPathStartTypeFactory;
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

export function relativeSlashPathStartTypeFactory(input: SlashPath): SlashPath {
  // remove all leading slashes
  return input.replace(LEADING_SLASHES_REGEX, '');
}

/**
 *
 * @param input
 * @returns
 */
export function absoluteSlashPathStartTypeFactory(input: SlashPath): SlashPath {
  // add a leading slash, and remove any multiple slashes if provided
  return input.startsWith(SLASH_PATH_SEPARATOR) ? input.replace(LEADING_SLASHES_REGEX, SLASH_PATH_SEPARATOR) : `${SLASH_PATH_SEPARATOR}${input}`;
}

export function fixMultiSlashesInSlashPath(input: SlashPath): SlashPath {
  return input.replace(ALL_DOUBLE_SLASHES_REGEX, SLASH_PATH_SEPARATOR);
}

export function replaceMultipleFilePathsInSlashPath(input: SlashPath): SlashPath {
  return input.replace(ALL_DOUBLE_SLASHES_REGEX, SLASH_PATH_SEPARATOR);
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
      case 1:
        const lastSlashPosition = inputToEvaluate.lastIndexOf('/');

        if (lastSlashPosition === -1 || lastSlashPosition < last) {
          // valid path
          fixedPath = inputToEvaluate;
        } else {
          // the dot occurs before another slash, so we should replace it
          fixedPath = replaceCharacterAtIndexWith(inputToEvaluate, last, replaceWith);
        }
        break;
      default:
        const [head, tail] = splitStringAtIndex(inputToEvaluate, last, true);
        const headWithReplacedSeparators = head.replace(ALL_SLASH_PATH_FILE_TYPE_SEPARATORS_REGEX, replaceWith);

        fixedPath = headWithReplacedSeparators + tail;
        break;
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
  illegalStrings?: ArrayOrValue<string>;
  /**
   * String used to replace all encountered illegal characters.
   *
   * Is true by default.
   */
  replaceIllegalCharacters?: string | boolean;
  /**
   * Whether or not to replace extra dots by treating them as illegal characters.
   *
   * Will replace extra dots with the input value, or if true, will replace them with the value for replaceIllegalCharacters.
   */
  replaceIllegalDots?: string | boolean;
  /**
   * Whether or not to validate a final time after replacing elements and throw an error if it is still not valid.
   *
   * Disabled by default unless replaceIllegalCharacters and replaceIllegalDots are false.
   */
  throwError?: boolean;
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

  if (throwError === true || !Boolean(inputReplaceIllegalCharacters || inputReplaceIllegalDots)) {
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
export type SlashPathFactory = FactoryWithRequiredInput<SlashPath, ArrayOrValue<SlashPath>>;

export interface SlashPathFactoryConfig {
  /**
   * SlashPath start type to enforce
   */
  startType?: SlashPathStartType;
  /**
   * Prefix paths to append
   */
  basePath?: ArrayOrValue<SlashPathFolder>;
  /**
   * SlashPathValidationFactoryConfig to use for validation.
   */
  validate?: boolean | SlashPathValidationFactoryConfig;
}

export function slashPathFactory(config?: SlashPathFactoryConfig): SlashPathFactory {
  const { startType: type = 'any', basePath: inputBasePaths, validate = true } = config ?? {};
  const basePath = inputBasePaths ? mergeSlashPaths(asArray(inputBasePaths)) : '';
  const typeFactory = slashPathStartTypeFactory(type);
  const validationFactory = validate ? (typeof validate === 'boolean' ? slashPathValidationFactory() : slashPathValidationFactory(validate)) : null;
  const finalizeFn = chainMapFunction(typeFactory, validationFactory);

  return (paths: ArrayOrValue<SlashPath>) => {
    const merged = mergeSlashPaths(mergeArrayOrValueIntoArray([basePath], paths));
    return finalizeFn(merged);
  };
}

export function mergeSlashPaths(paths: SlashPath[]): SlashPath {
  const merge = paths.filter((x) => Boolean(x)).join(SLASH_PATH_SEPARATOR);
  return fixMultiSlashesInSlashPath(merge);
}

export function slashPathInvalidError() {
  return new Error('The slashPath is invalid.');
}
