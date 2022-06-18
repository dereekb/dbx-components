/**
 * Whether or not the input is function-like.
 *
 * @param obj
 * @returns
 */
export function isPromise<T, S>(obj: Promise<T> | S): obj is Promise<T> {
  // https://github.com/then/is-promise
  return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof (obj as PromiseLike<T>).then === 'function';
}

export function isPromiseLike<T, S>(obj: PromiseLike<T> | S): obj is PromiseLike<T> {
  // https://github.com/then/is-promise
  return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof (obj as PromiseLike<T>).then === 'function';
}
