/*eslint @typescript-eslint/no-explicit-any:"off"*/
// any is used with intent here, as the recursive TreeNode value requires its use to terminate.

import { type TreeNode } from './tree';
import { type ExpandTreeFunction, expandTrees } from './tree.expand';
import { type FlattenTreeFunction, flattenTrees } from './tree.flatten';

/**
 * Function that expands the input values into a tree, and then flattens the tree to produce a single array of values of another type.
 */
export type ExpandFlattenTreeFunction<T, V> = (values: T[]) => V[];

/**
 * Creates an ExpandFlattenTree function.
 *
 * @param expand
 * @param flatten
 * @returns
 */
export function expandFlattenTreeFunction<T, V, N extends TreeNode<T, N> = TreeNode<T, any>>(expand: ExpandTreeFunction<T, N>, flatten: FlattenTreeFunction<N, V>): ExpandFlattenTreeFunction<T, V> {
  return (values: T[]) => {
    return flattenTrees(expandTrees(values, expand), flatten);
  };
}
