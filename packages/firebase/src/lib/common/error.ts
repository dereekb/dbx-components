/**
 * A firebase error code in the format of "service/string-code".
 */
export type FirebaseErrorCode<Service extends string = string, StringCode extends string = string> = `${Service}/${StringCode}`;
