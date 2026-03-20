import { type ArrayOrValue } from '../array/array';
import { type Maybe } from '../value/maybe.type';
import { type TreeNode } from './tree';
import { exploreTreeFunction, type ExploreTreeFunctionConfig, ExploreTreeVisitNodeDecision, type ExploreTreeVisitNodeDecisionFunction } from './tree.explore';

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
 * Function that determines whether a node should be included in the flattened output.
 *
 * Alias for {@link ExploreTreeVisitNodeDecisionFunction} in the context of tree flattening.
 * Receives both the original node and its mapped value for filtering decisions.
 *
 * @template N - The tree node type.
 * @template V - The mapped value type, defaults to N.
 */
export type FlattenTreeAddNodeDecisionFunction<N extends TreeNode<unknown>, V = N> = ExploreTreeVisitNodeDecisionFunction<N, V>;

/**
 * Flattens a tree into an array containing all its nodes using depth-first traversal.
 *
 * @param tree - The root node to flatten.
 * @param addNodeFn - Optional filter controlling which nodes and subtrees are included.
 * @returns An array of all nodes in the tree that pass the filter.
 *
 * @example
 * ```typescript
 * const nodes = flattenTree(rootNode);
 * // Returns [root, child1, leaf1, leaf2, child2, leaf3, child3]
 * ```
 */
export function flattenTree<N extends TreeNode<unknown> = TreeNode<unknown>>(tree: N, addNodeFn?: Maybe<FlattenTreeAddNodeDecisionFunction<N>>): N[] {
  return flattenTreeToArray(tree, [], addNodeFn);
}

/**
 * Flattens a tree and appends the resulting nodes to an existing array.
 *
 * Useful for accumulating nodes from multiple trees into a single collection.
 *
 * @param tree - The root node to flatten.
 * @param array - The target array to push flattened nodes into.
 * @param addNodeFn - Optional filter controlling which nodes and subtrees are included.
 * @returns The same array reference, now containing the appended nodes.
 *
 * @example
 * ```typescript
 * const existing: TreeNode[] = [someNode];
 * flattenTreeToArray(rootNode, existing);
 * // existing now contains [someNode, root, child1, ...]
 * ```
 */
export function flattenTreeToArray<N extends TreeNode<unknown> = TreeNode<unknown>>(tree: N, array: N[], addNodeFn?: Maybe<FlattenTreeAddNodeDecisionFunction<N>>): N[] {
  return flattenTreeToArrayFunction<N>()(tree, array, addNodeFn);
}

/**
 * Configuration for creating a {@link FlattenTreeFunction} via {@link flattenTreeToArrayFunction}.
 *
 * Extends the exploration config but replaces `shouldVisitNodeFunction` with `shouldAddNodeFunction`
 * to use flattening-specific terminology.
 *
 * @template N - The tree node type.
 * @template V - The mapped value type collected in the output array.
 */
export interface FlattenTreeToArrayFunctionConfig<N extends TreeNode<unknown>, V> extends Omit<ExploreTreeFunctionConfig<N, V>, 'shouldVisitNodeFunction'> {
  /**
   * Controls whether each node's mapped value is added to the output array.
   * Defaults to adding all nodes.
   */
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
 * @param config - configuration object with optional mapping and node filtering settings
 * @returns A FlattenTreeFunction that collects nodes of type N.
 */
export function flattenTreeToArrayFunction<N extends TreeNode<unknown, N>, V>(config: FlattenTreeToArrayFunctionConfig<N, V>): FlattenTreeFunction<N, V>;
/**
 * Creates a FlattenTreeFunction that flattens tree nodes into an array of mapped values.
 *
 * @template N The type of the tree node.
 * @template V The type of the value to map each node to.
 * @param mapNodeFn - optional function to transform each node N into a value V; if not provided, nodes are returned as-is
 * @param defaultAddNodeFn - optional decision function that filters which nodes are included in the result
 * @returns A FlattenTreeFunction that collects values of type V.
 */
export function flattenTreeToArrayFunction<N extends TreeNode<unknown, N>, V>(mapNodeFn?: (node: N) => V, defaultAddNodeFn?: Maybe<FlattenTreeAddNodeDecisionFunction<N, V>>): FlattenTreeFunction<N, V>;
/**
 * Implementation for flattenTreeToArrayFunction.
 *
 * Creates a reusable function that traverses trees and collects either the nodes themselves
 * or mapped values into an array. Supports both a simple function signature and a config object.
 *
 * @param mapNodeFnOrConfig - Optional mapping function or config object.
 * @param defaultAddNodeFn - Optional default filter for node inclusion.
 * @returns A reusable flattening function.
 *
 * @example
 * ```typescript
 * const flattenIds = flattenTreeToArrayFunction<MyNode, string>(
 *   (node) => node.value.id
 * );
 * const ids = flattenIds(rootNode);
 * // ['root', 'child1', 'leaf1', 'leaf2', 'child2', 'leaf3']
 * ```
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
