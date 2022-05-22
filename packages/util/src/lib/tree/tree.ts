/*eslint @typescript-eslint/no-explicit-any:"off"*/
// any is used with intent here, as the recursive TreeNode value requires its use to terminate.

/**
 * Represends a traversable tree with values of type T.
 */
export interface TreeNode<T, N extends TreeNode<T, N> = TreeNode<T, any>> {
  depth: number;
  value: T;
  parent?: N;
  children?: N[];
}

/**
 * A TreeNode with no children values available. Used when building a tree.
 */
export type TreeNodeWithoutChildren<T, N extends TreeNode<T, N> = TreeNode<T, any>> = Omit<TreeNode<T, N>, 'children'>;
