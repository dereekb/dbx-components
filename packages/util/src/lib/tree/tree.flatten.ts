import { ArrayOrValue } from '../array/array';
import { type Maybe } from '../value/maybe.type';
import { type TreeNode } from './tree';
import { exploreTreeFunction, ExploreTreeFunctionConfig, ExploreTreeVisitNodeDecision, type ExploreTreeVisitNodeDecisionFunction } from './tree.explore';

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
export type FlattenTreeFunction<N extends TreeNode<unknown>, V> = (trees: ArrayOrValue<N>, array?: V[], addNodeFn?: Maybe<FlattenTreeAddNodeDecisionFunction<N, V>>) => V[];

/**
 * Decides how to add a node to the flattened array during flattening.
 */
export const FlattenTreeAddNodeDecision = {
  /**
   * Add all nodes and children
   */
  ADD_ALL: ExploreTreeVisitNodeDecision.VISIT_ALL,
  /**
   * Add the node only
   */
  ADD_NODE_ONLY: ExploreTreeVisitNodeDecision.VISIT_NODE_ONLY,
  /**
   * Add the node and its children
   */
  ADD_CHILDREN_ONLY: ExploreTreeVisitNodeDecision.VISIT_CHILDREN_ONLY,
  /**
   * No value will be added
   */
  SKIP_ALL: ExploreTreeVisitNodeDecision.SKIP_ALL
} as const;

export type FlattenTreeAddNodeDecision = ExploreTreeVisitNodeDecision;

/**
 * A function that determines if a node should be visited.
 *
 * The mapped value is also present.
 */
export type FlattenTreeAddNodeDecisionFunction<N extends TreeNode<unknown>, V = N> = ExploreTreeVisitNodeDecisionFunction<N, V>;

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

export interface FlattenTreeToArrayFunctionConfig<N extends TreeNode<unknown>, V> extends Omit<ExploreTreeFunctionConfig<N, V>, 'shouldVisitNodeFunction'> {
  readonly shouldAddNodeFunction?: Maybe<FlattenTreeAddNodeDecisionFunction<N, V>>;
}

/**
 * Creates a FlattenTreeFunction that flattens tree nodes themselves into an array.
 *
 * @template N The type of the tree node.
 * @returns A FlattenTreeFunction that collects nodes of type N.
 */
export function flattenTreeToArrayFunction<N extends TreeNode<unknown>>(): FlattenTreeFunction<N, N>;
/**
 * Creates a FlattenTreeFunction that flattens tree nodes themselves into an array.
 *
 * @template N The type of the tree node.
 * @returns A FlattenTreeFunction that collects nodes of type N.
 */
export function flattenTreeToArrayFunction<N extends TreeNode<unknown, N>, V>(config: FlattenTreeToArrayFunctionConfig<N, V>): FlattenTreeFunction<N, V>;
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
 * @param defaultAddNodeFn An optional function to determine if a node should be visited. If omitted, all nodes are visited. Ignored if the input config is an object with a shouldAddNodeFunction.
 * @returns A FlattenTreeFunction<N, V> that performs the tree flattening.
 */
export function flattenTreeToArrayFunction<N extends TreeNode<unknown, N>, V>(mapNodeFnOrConfig?: FlattenTreeToArrayFunctionConfig<N, V> | ((node: N) => V), defaultAddNodeFn?: Maybe<FlattenTreeAddNodeDecisionFunction<N, V>>): FlattenTreeFunction<N, V> {
  const config: FlattenTreeToArrayFunctionConfig<N, V> = typeof mapNodeFnOrConfig === 'function' ? ({ mapNodeFunction: mapNodeFnOrConfig } as FlattenTreeToArrayFunctionConfig<N, V>) : (mapNodeFnOrConfig ?? {});

  const exploreFn = exploreTreeFunction<N, V>({
    ...config,
    shouldVisitNodeFunction: config.shouldAddNodeFunction ?? defaultAddNodeFn
  });

  return (trees: ArrayOrValue<N>, array: V[] = [], inputAddNodeFn?: Maybe<FlattenTreeAddNodeDecisionFunction<N, V>>) => {
    exploreFn(trees, (value) => array.push(value), inputAddNodeFn ? { shouldVisitNodeFunction: inputAddNodeFn } : undefined);
    return array;
  };
}

/**
 * Convenience function for flattening multiple trees with a single configured flatten function.
 *
 * @deprecated FlattenTreeFunction now supports an array of trees.
 *
 * @param trees
 * @param flattenFn
 * @returns
 */
export function flattenTrees<N extends TreeNode<unknown, N>, V>(trees: ArrayOrValue<N>, flattenFn: FlattenTreeFunction<N, V>, addNodeFn?: Maybe<FlattenTreeAddNodeDecisionFunction<N, V>>): V[] {
  const array: V[] = [];
  flattenFn(trees, array, addNodeFn);
  return array;
}
