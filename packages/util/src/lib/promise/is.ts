
/**
 * Whether or not the input is function-like.
 * 
 * @param obj 
 * @returns
 */
export function isPromise<T, S>(obj: PromiseLike<T> | S): obj is PromiseLike<T> {
  // https://github.com/then/is-promise
  return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof ((obj as any).then) === 'function';
}
