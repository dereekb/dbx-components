import { type NonNever } from 'ts-essentials';

/**
 * A null/undefined value.
 */
export type MaybeNot = null | undefined;

/**
 * A non-null/undefined value.
 */
export type MaybeSo<T = unknown> = T extends MaybeNot ? never : T;

/**
 * A value that might exist, or be null/undefined instead.
 */
export type Maybe<T> = T | MaybeNot;

/**
 * A value that is not null/undefined.
 */
export type MaybeSoStrict<T> = T extends Maybe<infer A> ? (A extends Maybe<infer B> ? B extends Maybe<infer C> ? C extends Maybe<infer D> ? D extends Maybe<infer E> ? E : D : C : B : A) : T;

/**
 * Turns all key values in an object into a Maybe value.
 */
export type MaybeMap<T extends object> = NonNever<{
  [K in keyof T]: T[K] extends MaybeNot ? never : Maybe<T[K]>;
}>;
