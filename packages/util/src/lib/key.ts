
export type ReadKeyFunction<T, K extends string | number = string | number> = (model: T) => K;
export type ReadKeysFunction<T, K extends string | number = string | number> = (model: T) => K[];

/**
 * A key made up of either a string or number value.
 */
export type PrimativeKey = string | number;

/**
 * A key of a type.
 */
export type FieldOfType<T> = keyof T;
