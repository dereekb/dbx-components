/*eslint @typescript-eslint/no-explicit-any:"off"*/
// any is used with intent here, as the recursive TreeNode value requires its use to terminate.

import { type TreeNode, type TreeNodeWithoutChildren } from './tree';
import { type Maybe } from '../value/maybe.type';

// MARK: Expand

/**
 * Configuration for an ExpandTreeFunction, defining how to retrieve child values for a given value.
 *
 * @template T The type of the value being processed at each node in the tree.
 */
export interface ExpandTree<T> {
  /**
   * Returns child values from the input value, if they exist.
   * These child values will be recursively processed to form child nodes.
   *
   * @param value The current value of type T to retrieve children for.
   * @returns An array of child values of type T, or undefined/null if no children exist.
   */
  getChildren(value: T): Maybe<T[]>;
}

/**
 * Extended ExpandTree configuration that includes a custom node builder.
 * This allows for creating tree nodes of a specific type N, potentially with additional properties beyond the basic TreeNode structure.
 *
 * @template T The type of the value being processed at each node.
 * @template N The specific type of TreeNode to be created. Must extend TreeNode<T, N>.
 */
export interface ExpandTreeWithNodeBuilder<T, N extends TreeNode<T, N>> extends ExpandTree<T> {
  /**
   * Creates a tree node of type N (omitting the 'children' property, which is attached later).
   * This function is called for each value being converted into a node in the tree.
   *
   * @param node A TreeNodeWithoutChildren<T, N> object containing the core properties (value, depth, parent).
   * @returns An object of type Omit<N, 'children'>, representing the custom-built node without its children.
   */
  makeNode: (node: TreeNodeWithoutChildren<T, N>) => Omit<N, 'children'>;
}

/**
 * A function that expands an input value of type T into a TreeNode of type N.
 *
 * @template T The type of the input value to expand.
 * @template N The type of the TreeNode to be created. Defaults to TreeNode<T, any>.
 * @param value The input value of type T to expand into a tree node.
 * @returns A tree node of type N representing the expanded value and its descendants.
 */
export type ExpandTreeFunction<T, N extends TreeNode<T, N> = TreeNode<T, any>> = (value: T) => N;

/**
 * Creates an ExpandTreeFunction using a basic ExpandTree configuration.
 * The resulting nodes will be of type TreeNode<T>.
 *
 * @template T The type of the value being processed at each node.
 * @param config An ExpandTree<T> configuration object.
 * @returns An ExpandTreeFunction<T, TreeNode<T>>.
 */
export function expandTreeFunction<T>(config: ExpandTree<T>): ExpandTreeFunction<T, TreeNode<T>>;
/**
 * Creates an ExpandTreeFunction using an ExpandTreeWithNodeBuilder configuration.
 * This allows for the creation of custom tree nodes of type N.
 *
 * @template T The type of the value being processed at each node.
 * @template N The specific type of TreeNode to be created.
 * @param config An ExpandTreeWithNodeBuilder<T, N> configuration object.
 * @returns An ExpandTreeFunction<T, N>.
 */
export function expandTreeFunction<T, N extends TreeNode<T, N>>(config: ExpandTreeWithNodeBuilder<T, N>): ExpandTreeFunction<T, N>;
/**
 * Implementation for expandTreeFunction. Creates a function that can expand a single value into a tree structure.
 *
 * This factory function takes a configuration object that specifies how to retrieve children for any given value (`getChildren`)
 * and optionally, how to construct the nodes themselves (`makeNode`). If `makeNode` is not provided, a default node structure is used.
 * The returned function recursively builds a tree from a root value.
 *
 * @template T The type of the value being processed at each node.
 * @template N The type of the TreeNode to be created. Defaults to TreeNode<T, any> if not specified by ExpandTreeWithNodeBuilder.
 * @param config An ExpandTree<T> or ExpandTreeWithNodeBuilder<T, N> configuration object.
 * @returns An ExpandTreeFunction<T, N> that takes a root value and returns its corresponding tree structure.
 */
export function expandTreeFunction<T, N extends TreeNode<T, N> = TreeNode<T, any>>(config: ExpandTree<T> | ExpandTreeWithNodeBuilder<T, N>): ExpandTreeFunction<T, N> {
  const makeNodeFromConfig: (node: TreeNodeWithoutChildren<T, N>) => Omit<N, 'children'> = (config as ExpandTreeWithNodeBuilder<T, N>).makeNode ?? ((basicNode) => basicNode as unknown as Omit<N, 'children'>);

  const expandFn = (value: T, parent?: N): N => {
    const depth = parent ? parent.depth + 1 : 0;
    const treeNodeWithoutChildren: TreeNodeWithoutChildren<T, N> = {
      depth,
      parent,
      value
    };

    // Use Omit<N, 'children'> here as makeNodeFromConfig returns the node without children initially.
    // The children are attached in the next step.
    const node: N = makeNodeFromConfig(treeNodeWithoutChildren) as N; // Cast is necessary because children are added after
    const childrenValues: Maybe<T[]> = config.getChildren(value);
    node.children = childrenValues ? childrenValues.map((x) => expandFn(x, node)) : undefined;
    return node;
  };

  return (rootValue: T) => expandFn(rootValue);
}

/**
 * Convenience function for expanding multiple root values into an array of trees.
 * Each value in the input array is treated as a root for a new tree.
 *
 * @template T The type of the input values.
 * @template N The type of the TreeNode in the resulting trees. Must extend TreeNode<T, N>.
 * @param values An array of root values of type T to expand.
 * @param expandFn An ExpandTreeFunction<T, N> used to expand each value into a tree.
 * @returns An array of N, where each N is the root node of an expanded tree.
 */
export function expandTrees<T, N extends TreeNode<T, N>>(values: T[], expandFn: ExpandTreeFunction<T, N>): N[] {
  return values.map(expandFn);
}
