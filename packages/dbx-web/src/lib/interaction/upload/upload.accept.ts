import { ArrayOrValue, asArray, asDecisionFunction, DecisionFunction, decisionFunction, MimeTypeWildcardWithoutParameters, MimeTypeWithoutParameters, SeparateResult, separateValues, SLASH_PATH_FILE_TYPE_SEPARATOR, SlashPathTypedFileSuffix } from '@dereekb/util';

/**
 * A string that describes a type of file that can be selected.
 *
 * Can either be a mime type or a file suffix.
 */
export type FileAcceptFilterTypeString = MimeTypeWithoutParameters | MimeTypeWildcardWithoutParameters | SlashPathTypedFileSuffix;

export interface FileArrayAcceptMatchConfig {
  readonly accept: FileAcceptFunction | ArrayOrValue<FileAcceptFilterTypeString>;
}

export interface FileArrayAcceptMatchResult {
  readonly input: File[];
  readonly accepted: File[];
  readonly rejected: File[];
}

/**
 * A function that matches an array of files based on the internal configuration.
 */
export type FileArrayAcceptMatchFunction = (input: File[]) => FileArrayAcceptMatchResult;

/**
 * Creates a FileArrayAcceptMatchFunction from the input.
 */
export function fileArrayAcceptMatchFunction(config: FileArrayAcceptMatchConfig): FileArrayAcceptMatchFunction {
  const isAcceptedFunction = typeof config.accept === 'function' ? config.accept : fileAcceptFunction(config.accept);

  return (input: File[]) => {
    const { included: accepted, excluded: rejected } = separateValues(input, isAcceptedFunction);
    return { input, accepted, rejected };
  };
}

/**
 * Used to determine if a file is an accepted type based on the internal configuration.
 */
export type FileAcceptFunction = DecisionFunction<File>;

/**
 * Creates a FileAcceptFunction from the input.
 *
 * @param accept
 * @returns
 */
export function fileAcceptFunction(accept: ArrayOrValue<FileAcceptFilterTypeString>): FileAcceptFunction {
  const acceptList = asArray(accept);

  if (acceptList.length === 0) {
    return asDecisionFunction(true);
  } else {
    const isAcceptedFunctions = acceptList.map((x) => {
      if (x[0] === SLASH_PATH_FILE_TYPE_SEPARATOR) {
        // is a SlashPathTypedFileSuffix
        return (file: File) => file.name.endsWith(x);
      } else if (x.endsWith('/*')) {
        // is a MimeTypeWildcardWithoutParameters
        const mimeTypePrefix = x.slice(0, -2);
        return (file: File) => file.type.startsWith(mimeTypePrefix);
      } else {
        // treat as a MimeTypeWithoutParameters
        return (file: File) => file.type === x;
      }
    });

    return (file: File) => {
      return isAcceptedFunctions.findIndex((x) => x(file)) !== -1;
    };
  }
}
