import { Maybe } from "./value";

/**
 * A key made up of either a string or number value.
 */
export type PrimativeKey = string | number;

/**
 * A key of a type.
 */
export type FieldOfType<T> = keyof T;

export type ReadKeyFunction<T, K extends PrimativeKey = PrimativeKey> = (model: T) => Maybe<K>;
export type ReadKeysFunction<T, K extends PrimativeKey = PrimativeKey> = (model: T) => K[];
