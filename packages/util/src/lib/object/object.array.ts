import { type ArrayOrValue, convertToArray, flattenArray } from '../array';

/**
 * Creates a flattened array of merged objects by computing the cross-product of arrays a and b,
 * merging each pair with spread syntax.
 *
 * Convenience wrapper around {@link objectMergeMatrix} that flattens the result.
 *
 * @param a - First array (or single value) of partial objects
 * @param b - Second array (or single value) of partial objects
 * @returns Flat array of merged objects
 */
export function objectFlatMergeMatrix<A extends object = object, B extends object = object>(a: ArrayOrValue<Partial<A>>, b: ArrayOrValue<Partial<B>>): (Partial<A> & Partial<B>)[] {
  return flattenArray(objectMergeMatrix(a, b));
}

/**
 * Creates a 2D matrix of merged objects from the cross-product of arrays a and b.
 *
 * Each element in the matrix is the spread merge of one item from a with one item from b.
 * If either input is null/undefined, returns the other as a single-row matrix.
 *
 * @param a - First array (or single value) of partial objects
 * @param b - Second array (or single value) of partial objects
 * @returns 2D array where result[i][j] is `{ ...a[i], ...b[j] }`
 */
export function objectMergeMatrix<A extends object = object, B extends object = object>(a: ArrayOrValue<Partial<A>>, b: ArrayOrValue<Partial<B>>): (Partial<A> & Partial<B>)[][] {
  let result: (Partial<A> & Partial<B>)[][];

  if (a && b) {
    const aNorm = convertToArray(a);
    const bNorm = convertToArray(b);

    result = aNorm.map((a) => {
      return bNorm.map((b) => ({ ...a, ...b }));
    });
  } else if (a) {
    result = [convertToArray(a) as []];
  } else if (b) {
    result = [convertToArray(b) as []];
  } else {
    result = [[]];
  }

  return result;
}
