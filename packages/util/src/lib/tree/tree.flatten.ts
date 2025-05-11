import { type TreeNode } from './tree';

// MARK: Flatten
/**
 * A function that flattens a tree structure into an array of values.
 *
 * @template N The type of the tree node, extending TreeNode.
 * @template V The type of values in the resulting flattened array.
 * @param tree The root node of the tree to flatten.
 * @param array Optional. An existing array to push the flattened values into. If not provided, a new array is created.
 * @returns An array containing the flattened values from the tree.
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

/**
 * Creates a FlattenTreeFunction that flattens tree nodes themselves into an array.
 *
 * @template N The type of the tree node.
 * @returns A FlattenTreeFunction that collects nodes of type N.
 */
export function flattenTreeToArrayFunction<N extends TreeNode<unknown>>(): FlattenTreeFunction<N, N>;
/**
 * Creates a FlattenTreeFunction that flattens tree nodes into an array of mapped values.
 *
 * @template N The type of the tree node.
 * @template V The type of the value to map each node to.
 * @param mapNodeFn An optional function to transform each node N into a value V. If not provided, nodes are returned as is.
 * @returns A FlattenTreeFunction that collects values of type V.
 */
export function flattenTreeToArrayFunction<N extends TreeNode<unknown, N>, V>(mapNodeFn?: (node: N) => V): FlattenTreeFunction<N, V>;
/**
 * Implementation for flattenTreeToArrayFunction.
 *
 * This function serves as a factory to produce a flattening function. The produced function
 * will traverse a tree and collect either the nodes themselves or a mapped value from each node
 * into an array.
 *
 * @template N The type of the tree node, must extend TreeNode.
 * @template V The type of the values to be collected in the output array.
 * @param mapNodeFn An optional function to transform each node N to a value V. If omitted, nodes are cast to V (effectively N if V is N).
 * @returns A FlattenTreeFunction<N, V> that performs the tree flattening.
 */
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
