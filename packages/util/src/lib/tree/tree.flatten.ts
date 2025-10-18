import { MAP_IDENTITY } from '../value/map';
import { type Maybe } from '../value/maybe.type';
import { type TreeNode } from './tree';

// MARK: Flatten
/**
 * A function that flattens a tree structure into an array of values.
 *
 * @template N The type of the tree node, extending TreeNode.
 * @template V The type of values in the resulting flattened array.
 * @param tree The root node of the tree to flatten.
 * @param array Optional. An existing array to push the flattened values into. If not provided, a new array is created.
 * @param addNodeFn Optional. A function to determine if a node should be visited. If not provided, all nodes are visited.
 * @returns An array containing the flattened values from the tree.
 */
export type FlattenTreeFunction<N extends TreeNode<unknown>, V> = (tree: N, array?: V[], addNodeFn?: Maybe<FlattenTreeAddNodeDecisionFunction<N, V>>) => V[];

/**
 * Decides how to add a node to the flattened array during flattening.
 */
export enum FlattenTreeAddNodeDecision {
  /**
   * Add all nodes and children
   */
  ADD_ALL = 0,
  /**
   * Add the node only
   */
  ADD_NODE_ONLY = 1,
  /**
   * Add the node and its children
   */
  ADD_CHILDREN_ONLY = 2,
  /**
   * No value will be added
   */
  SKIP_ALL = 3
}

/**
 * A function that determines if a node should be visited.
 *
 * The mapped value is also present.
 */
export type FlattenTreeAddNodeDecisionFunction<N extends TreeNode<unknown>, V = N> = (node: N, nodeMappedValue: V) => FlattenTreeAddNodeDecision;

/**
 * Traverses the tree and flattens it into all tree nodes.
 */
export function flattenTree<N extends TreeNode<unknown> = TreeNode<unknown>>(tree: N, addNodeFn?: Maybe<FlattenTreeAddNodeDecisionFunction<N>>): N[] {
  return flattenTreeToArray(tree, [], addNodeFn);
}

/**
 * Traverses the tree and pushes the nodes into the input array.
 *
 * @param tree
 * @param array
 * @returns
 */
export function flattenTreeToArray<N extends TreeNode<unknown> = TreeNode<unknown>>(tree: N, array: N[], addNodeFn?: Maybe<FlattenTreeAddNodeDecisionFunction<N>>): N[] {
  return flattenTreeToArrayFunction<N>()(tree, array, addNodeFn);
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
export function flattenTreeToArrayFunction<N extends TreeNode<unknown, N>, V>(mapNodeFn?: (node: N) => V, defaultAddNodeFn?: Maybe<FlattenTreeAddNodeDecisionFunction<N, V>>): FlattenTreeFunction<N, V>;
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
 * @param defaultAddNodeFn An optional function to determine if a node should be visited. If omitted, all nodes are visited.
 * @returns A FlattenTreeFunction<N, V> that performs the tree flattening.
 */
export function flattenTreeToArrayFunction<N extends TreeNode<unknown, N>, V>(mapNodeFn?: (node: N) => V, defaultAddNodeFn?: Maybe<FlattenTreeAddNodeDecisionFunction<N, V>>): FlattenTreeFunction<N, V> {
  const mapNode: (node: N) => V = mapNodeFn ?? (MAP_IDENTITY as typeof mapNode);
  const defaultAddNode = defaultAddNodeFn ?? (() => true);

  return (tree: N, array: V[] = [], inputAddNodeFn?: Maybe<FlattenTreeAddNodeDecisionFunction<N, V>>) => {
    const addNodeFn = inputAddNodeFn ?? defaultAddNode;

    const flattenFn = (tree: N, array: V[] = []) => {
      const mappedValue = mapNode(tree);

      const visitResult = addNodeFn(tree, mappedValue);

      // if addNode returns false, skip this node and its children
      if (visitResult === FlattenTreeAddNodeDecision.SKIP_ALL) {
        return array;
      }

      if (visitResult !== FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY) {
        array.push(mappedValue);
      }

      if (tree.children && visitResult !== FlattenTreeAddNodeDecision.ADD_NODE_ONLY) {
        tree.children.forEach((x) => flattenFn(x, array));
      }

      return array;
    };

    return flattenFn(tree, array);
  };
}

/**
 * Convenience function for flattening multiple trees with a flatten function.
 *
 * @param trees
 * @param flattenFn
 * @returns
 */
export function flattenTrees<N extends TreeNode<unknown, N>, V>(trees: N[], flattenFn: FlattenTreeFunction<N, V>, addNodeFn?: Maybe<FlattenTreeAddNodeDecisionFunction<N, V>>): V[] {
  const array: V[] = [];
  trees.forEach((x) => flattenFn(x, array, addNodeFn));
  return array;
}
