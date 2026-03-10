import { asDecisionFunction, type DecisionFunction, type MimeTypeWithSubtypeWildcardWithoutParameters, type MimeTypeWithoutParameters, separateValues, SLASH_PATH_FILE_TYPE_SEPARATOR, type SlashPathTypedFileSuffix, splitFront, type MimeTypeWildcard } from '@dereekb/util';

/**
 * String used as input for the "accept" attribute of a file input element.
 */
export type FileAcceptString = string;

/**
 * Returns a string that can be used as the "accept" attribute of a file input element.
 *
 * @param accept
 * @returns
 */
export function fileAcceptString(accept: FileAcceptString | FileAcceptFilterTypeStringArray): FileAcceptString {
  return typeof accept === 'string' ? accept : accept.join(',');
}

/**
 * A string that describes a type of file that can be selected.
 *
 * Can either be a mime type or a file suffix.
 */
export type FileAcceptFilterTypeString = MimeTypeWildcard | MimeTypeWithoutParameters | MimeTypeWithSubtypeWildcardWithoutParameters | SlashPathTypedFileSuffix;

/**
 * An array of file accept filter type strings.
 */
export type FileAcceptFilterTypeStringArray = FileAcceptFilterTypeString[];

/**
 * Converts a comma-separated accept string or array into a {@link FileAcceptFilterTypeStringArray}.
 *
 * @example
 * ```ts
 * const types = fileAcceptFilterTypeStringArray('image/png, .pdf');
 * // ['image/png', '.pdf']
 * ```
 */
export function fileAcceptFilterTypeStringArray(accept: FileAcceptString | FileAcceptFilterTypeStringArray): FileAcceptFilterTypeStringArray {
  return typeof accept === 'string' ? accept.split(',').map((x) => x.trim()) : accept;
}

/**
 * Configuration for matching an array of files against accept criteria with optional multiple file support.
 */
export interface FileArrayAcceptMatchConfig {
  readonly accept: FileAcceptFunction | FileAcceptString | FileAcceptFilterTypeStringArray;
  /**
   * If false, then only the first file will be accepted.
   *
   * Defaults to true.
   */
  readonly multiple?: boolean;
}

/**
 * Result of matching files against accept criteria, categorizing them into accepted and rejected lists.
 */
export interface FileArrayAcceptMatchResult {
  /**
   * If multiple is allowed or not.
   */
  readonly multiple: boolean;
  /**
   * The input files.
   */
  readonly input: File[];
  /**
   * The final list of accepted files.
   */
  readonly accepted: File[];
  /**
   * The final list of rejected files.
   */
  readonly rejected: File[];
  /**
   * The list of accepted files based on the file type.
   *
   * If multiple is false, all files that would have been accepted are included here.
   */
  readonly acceptedType: File[];
  /**
   * The list of rejected files based on the file type.
   *
   * If multiple is false, only files that would have been rejected by type are included here.
   */
  readonly rejectedType: File[];
}

/**
 * A function that matches an array of files based on the internal configuration.
 */
export type FileArrayAcceptMatchFunction = (input: File[]) => FileArrayAcceptMatchResult;

/**
 * Creates a {@link FileArrayAcceptMatchFunction} that filters and separates files based on accept criteria and multiple file support.
 *
 * @example
 * ```ts
 * const matchFn = fileArrayAcceptMatchFunction({ accept: 'image/*', multiple: false });
 * const result = matchFn(fileList);
 * console.log(result.accepted, result.rejected);
 * ```
 */
export function fileArrayAcceptMatchFunction(config: FileArrayAcceptMatchConfig): FileArrayAcceptMatchFunction {
  const multiple = config.multiple ?? true;
  const isAcceptedFunction = typeof config.accept === 'function' ? config.accept : fileAcceptFunction(config.accept);

  return (input: File[]) => {
    const { included: acceptedType, excluded: rejectedType } = separateValues(input, isAcceptedFunction);
    let accepted = acceptedType;
    let rejected = rejectedType;

    if (!multiple) {
      const front = splitFront(acceptedType, 1);
      accepted = front.front;
      rejected = [...rejectedType, ...front.remaining];
    }

    return { multiple, input, accepted, rejected, acceptedType, rejectedType };
  };
}

/**
 * Type of input used for a FileAcceptFunction.
 *
 * Isolates the name and type fields from a File.
 */
export type FileAcceptFunctionInput = Pick<File, 'name' | 'type'>;

/**
 * Used to determine if a file is an accepted type based on the internal configuration.
 */
export type FileAcceptFunction = DecisionFunction<FileAcceptFunctionInput>;

/**
 * Creates a {@link FileAcceptFunction} that checks individual files against accept criteria (MIME types, wildcards, or file extensions).
 *
 * @example
 * ```ts
 * const isAccepted = fileAcceptFunction(['image/*', '.pdf']);
 * isAccepted({ name: 'photo.png', type: 'image/png' }); // true
 * isAccepted({ name: 'doc.txt', type: 'text/plain' }); // false
 * ```
 */
export function fileAcceptFunction(accept: FileAcceptString | FileAcceptFilterTypeStringArray): FileAcceptFunction {
  const acceptList = fileAcceptFilterTypeStringArray(accept);
  let fileAcceptFunction: FileAcceptFunction;

  if (acceptList.length === 0) {
    fileAcceptFunction = asDecisionFunction(true);
  } else {
    const hasWildcard = acceptList.some((x) => x === '*');

    if (hasWildcard) {
      fileAcceptFunction = asDecisionFunction(true);
    } else {
      const isAcceptedFunctions = acceptList.map((x) => {
        if (x[0] === SLASH_PATH_FILE_TYPE_SEPARATOR) {
          // is a SlashPathTypedFileSuffix
          return (input: FileAcceptFunctionInput) => input.name.endsWith(x);
        } else if (x.endsWith('/*')) {
          // is a MimeTypeWildcardWithoutParameters
          const mimeTypePrefix = x.slice(0, -2);
          return (input: FileAcceptFunctionInput) => input.type.startsWith(mimeTypePrefix);
        } else {
          // treat as a MimeTypeWithoutParameters
          return (input: FileAcceptFunctionInput) => input.type === x;
        }
      });

      fileAcceptFunction = (input: FileAcceptFunctionInput) => {
        return isAcceptedFunctions.findIndex((x) => x(input)) !== -1;
      };
    }
  }

  return fileAcceptFunction;
}
