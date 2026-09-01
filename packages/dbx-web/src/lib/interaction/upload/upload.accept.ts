import { asDecisionFunction, type DecisionFunction, type Maybe, type MimeTypeWithSubtypeWildcardWithoutParameters, type MimeTypeWithoutParameters, separateValues, SLASH_PATH_FILE_TYPE_SEPARATOR, type SlashPathTypedFileSuffix, splitFront, type MimeTypeWildcard } from '@dereekb/util';

/**
 * String used as input for the "accept" attribute of a file input element.
 */
export type FileAcceptString = string;

/**
 * Returns a string that can be used as the "accept" attribute of a file input element.
 *
 * @param accept - A file accept string or array of filter type strings to convert.
 * @returns A comma-separated string suitable for the HTML accept attribute.
 */
export function fileAcceptString(accept: FileAcceptString | FileAcceptFilterTypeStringArray): FileAcceptString {
  return typeof accept === 'string' ? accept : accept.join(',');
}

/**
 * Describes a type of file that can be selected.
 *
 * Can either be a mime type or a file suffix.
 */
export type FileAcceptFilterTypeString = MimeTypeWildcard | MimeTypeWithoutParameters | MimeTypeWithSubtypeWildcardWithoutParameters | SlashPathTypedFileSuffix;

/**
 * The file accept filter type strings.
 */
export type FileAcceptFilterTypeStringArray = FileAcceptFilterTypeString[];

/**
 * Converts a comma-separated accept string or array into a {@link FileAcceptFilterTypeStringArray}.
 *
 * @param accept - A file accept string or array of filter type strings to normalize.
 * @returns The individual filter type strings.
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
export interface FileArrayAcceptMatchConfig extends FileArrayAcceptMaxFilesInput {
  readonly accept: FileAcceptFunction | FileAcceptString | FileAcceptFilterTypeStringArray;
}

/**
 * The two values that together decide how many files a selection may accept.
 */
export interface FileArrayAcceptMaxFilesInput {
  /**
   * If false, then only the first file will be accepted.
   *
   * Defaults to true.
   */
  readonly multiple?: Maybe<boolean>;
  /**
   * The most files that may be accepted at once.
   *
   * Files past the limit are REJECTED rather than the whole selection being refused, so a user who picks
   * more than the limit still gets the first ones instead of nothing at all.
   *
   * A limit of 0 accepts nothing — which is how a destination that is already full says so. Ignored while
   * multiple is false, as that is already a limit of one.
   */
  readonly maxFiles?: Maybe<number>;
}

/**
 * Returns how many files a selection may accept, or undefined when there is no limit.
 *
 * @param input - The multiple/maxFiles pair to resolve.
 * @returns The effective limit, or undefined when unlimited.
 *
 * @example
 * ```ts
 * fileArrayAcceptMaxFiles({ multiple: false }); // 1
 * fileArrayAcceptMaxFiles({ multiple: true, maxFiles: 3 }); // 3
 * fileArrayAcceptMaxFiles({ multiple: true }); // undefined
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function fileArrayAcceptMaxFiles(input: FileArrayAcceptMaxFilesInput): Maybe<number> {
  const { multiple, maxFiles } = input;
  let result: Maybe<number>;

  if (multiple === false) {
    result = 1;
  } else if (maxFiles != null) {
    result = Math.max(0, Math.floor(maxFiles));
  }

  return result;
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
   * The limit that was applied, or undefined when the selection was unlimited.
   */
  readonly maxFiles?: Maybe<number>;
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
 * Matches an array of files based on the internal configuration.
 */
export type FileArrayAcceptMatchFunction = (input: File[]) => FileArrayAcceptMatchResult;

/**
 * Creates a {@link FileArrayAcceptMatchFunction} that filters and separates files based on accept criteria and multiple file support.
 *
 * @param config - Configuration specifying the accept criteria and whether multiple files are allowed.
 * @returns Accepts an array of files and returns the categorized match result.
 *
 * @example
 * ```ts
 * const matchFn = fileArrayAcceptMatchFunction({ accept: 'image/*', multiple: false });
 * const result = matchFn(fileList);
 * console.log(result.accepted, result.rejected);
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function fileArrayAcceptMatchFunction(config: FileArrayAcceptMatchConfig): FileArrayAcceptMatchFunction {
  const multiple = config.multiple ?? true;
  const maxFiles = fileArrayAcceptMaxFiles(config);
  const isAcceptedFunction = typeof config.accept === 'function' ? config.accept : fileAcceptFunction(config.accept);

  return (input: File[]) => {
    const { included: acceptedType, excluded: rejectedType } = separateValues(input, isAcceptedFunction);
    let accepted = acceptedType;
    let rejected = rejectedType;

    if (maxFiles != null) {
      const front = splitFront(acceptedType, maxFiles);
      accepted = front.front;
      rejected = [...rejectedType, ...front.remaining];
    }

    return { multiple, maxFiles, input, accepted, rejected, acceptedType, rejectedType };
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
 * @param accept - A file accept string or array specifying which MIME types, wildcards, or file extensions to allow.
 * @returns A decision function that returns true if a file matches any of the accept criteria.
 *
 * @example
 * ```ts
 * const isAccepted = fileAcceptFunction(['image/*', '.pdf']);
 * isAccepted({ name: 'photo.png', type: 'image/png' }); // true
 * isAccepted({ name: 'doc.txt', type: 'text/plain' }); // false
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function fileAcceptFunction(accept: FileAcceptString | FileAcceptFilterTypeStringArray): FileAcceptFunction {
  const acceptList = fileAcceptFilterTypeStringArray(accept);
  let fileAcceptFunction: FileAcceptFunction;

  if (acceptList.length === 0) {
    fileAcceptFunction = asDecisionFunction(true);
  } else {
    const hasWildcard = acceptList.includes('*');

    if (hasWildcard) {
      fileAcceptFunction = asDecisionFunction(true);
    } else {
      const isAcceptedFunctions = acceptList.map((x) => {
        let matchFn: (input: FileAcceptFunctionInput) => boolean;

        if (x[0] === SLASH_PATH_FILE_TYPE_SEPARATOR) {
          // is a SlashPathTypedFileSuffix
          matchFn = (input) => input.name.endsWith(x);
        } else if (x.endsWith('/*')) {
          // is a MimeTypeWildcardWithoutParameters
          const mimeTypePrefix = x.slice(0, -2);
          matchFn = (input) => input.type.startsWith(mimeTypePrefix);
        } else {
          // treat as a MimeTypeWithoutParameters
          matchFn = (input) => input.type === x;
        }

        return matchFn;
      });

      fileAcceptFunction = (input: FileAcceptFunctionInput) => {
        return isAcceptedFunctions.some((x) => x(input));
      };
    }
  }

  return fileAcceptFunction;
}
