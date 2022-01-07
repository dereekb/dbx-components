import { ArrayOrValue, convertToArray, flattenArray } from "./array";

/**
 * Convenience function for objectMergeMatrix that returns a flat array.
 */
export function objectFlatMergeMatrix<A extends object = object, B extends object = object>(a: ArrayOrValue<Partial<A>>, b: ArrayOrValue<Partial<B>>): (Partial<A> & Partial<B>)[] {
  return flattenArray(objectMergeMatrix(a, b));
}

/**
 * Creates a matrix of results by merging the input. If either a or b is null/undefined, the result is returned as an array of the other value.
 */
export function objectMergeMatrix<A extends object = object, B extends object = object>(a: ArrayOrValue<Partial<A>>, b: ArrayOrValue<Partial<B>>): (Partial<A> & Partial<B>)[][] {
  if (a && b) {
    const aNorm = convertToArray(a);
    const bNorm = convertToArray(b);

    const results: (Partial<A> & Partial<B>)[][] = aNorm.map((a) => {
      return bNorm.map(b => ({ ...a, ...b }));
    });

    return results;
  } else if (a) {
    return [convertToArray(a) as []];
  } else if (b) {
    return [convertToArray(b) as []];
  } else {
    return [[]];
  }
}
