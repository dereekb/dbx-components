/*eslint @typescript-eslint/no-explicit-any:"off"*/
// any is used with intent here, as the recursive TreeNode value requires its use to terminate.

import { type TreeNode } from './tree';
import { type ExpandTreeFunction, expandTrees } from './tree.expand';
import { type FlattenTreeFunction, flattenTrees } from './tree.flatten';

/**
 * Function that expands the input values into a tree, and then flattens the tree to produce a single array of values of another type.
 *
 * @template T The type of the initial input values.
 * @template V The type of the values in the final flattened output array.
 * @param values An array of input values of type T.
 * @returns An array of output values of type V.
 */
export type ExpandFlattenTreeFunction<T, V> = (values: T[]) => V[];

/**
 * Creates an ExpandFlattenTreeFunction by composing an expansion function and a flattening function.
 *
 * This higher-order function takes a function to expand an array of values `T` into a list of trees (`N[]` where `N` is a TreeNode)
 * and another function to flatten these trees into a single array of values `V`.
 *
 * @template T The type of the initial input values.
 * @template V The type of the values in the final flattened output array.
 * @template N The type of the intermediate tree nodes. Must extend TreeNode with value T and children of type N.
 * @param expand An ExpandTreeFunction (values: T[]) => N[] that converts an array of T into an array of tree nodes N.
 * @param flatten A FlattenTreeFunction (tree: N, array?: V[]) => V[] that flattens a tree of N nodes into an array of V values.
 * @returns An ExpandFlattenTreeFunction (values: T[]) => V[] that performs the combined expansion and flattening.
 */
export function expandFlattenTreeFunction<T, V, N extends TreeNode<T, N> = TreeNode<T, any>>(expand: ExpandTreeFunction<T, N>, flatten: FlattenTreeFunction<N, V>): ExpandFlattenTreeFunction<T, V> {
  return (values: T[]) => {
    return flattenTrees(expandTrees(values, expand), flatten);
  };
}
