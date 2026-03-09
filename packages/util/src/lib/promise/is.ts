/**
 * Checks whether the input value is a native Promise by testing for a `.then` method.
 *
 * @param obj - The value to test.
 * @returns `true` if the value is a Promise, `false` otherwise.
 */
export function isPromise<T, S>(obj: Promise<T> | S): obj is Promise<T> {
  // https://github.com/then/is-promise
  return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof (obj as PromiseLike<T>).then === 'function';
}

/**
 * Checks whether the input value is PromiseLike (i.e., has a `.then` method), which
 * includes both native Promises and custom thenables.
 *
 * @param obj - The value to test.
 * @returns `true` if the value is PromiseLike, `false` otherwise.
 */
export function isPromiseLike<T, S>(obj: PromiseLike<T> | S): obj is PromiseLike<T> {
  // https://github.com/then/is-promise
  return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof (obj as PromiseLike<T>).then === 'function';
}
