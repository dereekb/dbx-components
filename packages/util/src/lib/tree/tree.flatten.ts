import { type TreeNode } from './tree';

// MARK: Flatten
/**
 * Flattens the tree by pushing the values into the input array, or a new array and returns the value.
 */
export type FlattenTreeFunction<N extends TreeNode<unknown>, V> = (tree: N, array?: V[]) => V[];

/**
 * Traverses the tree and flattens it into all tree nodes.
 */
export function flattenTree<N extends TreeNode<unknown> = TreeNode<unknown>>(tree: N): N[] {
  return flattenTreeToArray(tree, []);
}

/**
 * Traverses the tree and pushes the nodes into the input array.
 *
 * @param tree
 * @param array
 * @returns
 */
export function flattenTreeToArray<N extends TreeNode<unknown> = TreeNode<unknown>>(tree: N, array: N[]): N[] {
  return flattenTreeToArrayFunction<N>()(tree, array);
}

export function flattenTreeToArrayFunction<N extends TreeNode<unknown>>(): FlattenTreeFunction<N, N>;
export function flattenTreeToArrayFunction<N extends TreeNode<unknown, N>, V>(mapNodeFn?: (node: N) => V): FlattenTreeFunction<N, V>;
export function flattenTreeToArrayFunction<N extends TreeNode<unknown, N>, V>(mapNodeFn?: (node: N) => V): FlattenTreeFunction<N, V> {
  const mapNode: (node: N) => V = mapNodeFn ?? ((x) => x as unknown as V);

  const flattenFn = (tree: N, array: V[] = []) => {
    array.push(mapNode(tree));

    if (tree.children) {
      tree.children.forEach((x) => flattenFn(x, array));
    }

    return array;
  };

  return flattenFn;
}

/**
 * Convenience function for flattening multiple trees with a flatten function.
 *
 * @param trees
 * @param flattenFn
 * @returns
 */
export function flattenTrees<N extends TreeNode<unknown, N>, V>(trees: N[], flattenFn: FlattenTreeFunction<N, V>): V[] {
  const array: V[] = [];
  trees.forEach((x) => flattenFn(x, array));
  return array;
}
