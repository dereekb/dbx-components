/*eslint @typescript-eslint/no-explicit-any:"off"*/
// any is used with intent here, as the recursive TreeNode value requires its use to terminate.

import { TreeNode, TreeNodeWithoutChildren } from './tree';
import { Maybe } from '../value/maybe';

// MARK: Expand

/**
 * ExpandTreeFunction configuration.
 */
export interface ExpandTree<T> {
  /**
   * Returns child values from the value, if they exist.
   * @param value
   */
  getChildren(value: T): Maybe<T[]>;
}

/**
 * Extended ExpandTree configuration with custom node building.
 */
export interface ExpandTreeWithNodeBuilder<T, N extends TreeNode<T, N>> extends ExpandTree<T> {
  /**
   * Creates a TreeNode of type N, minus the children values that are attached afterwards.
   */
  makeNode: (node: TreeNodeWithoutChildren<T, N>) => Omit<N, 'children'>;
}

/**
 * Expands the input value into a TreeNode.
 */
export type ExpandTreeFunction<T, N extends TreeNode<T, N> = TreeNode<T, any>> = (value: T) => N;

/**
 * Creates an ExpandTreeFunction from the input configuration.
 *
 * @param config
 */
export function expandTreeFunction<T>(config: ExpandTree<T>): ExpandTreeFunction<T, TreeNode<T>>;
export function expandTreeFunction<T, N extends TreeNode<T, N>>(config: ExpandTreeWithNodeBuilder<T, N>): ExpandTreeFunction<T, N>;
export function expandTreeFunction<T, N extends TreeNode<T, N> = TreeNode<T, any>>(config: ExpandTree<T> | ExpandTreeWithNodeBuilder<T, N>): ExpandTreeFunction<T, N> {
  const makeNode: (node: TreeNode<T>) => N = (config as any).makeNode ?? ((node) => node as N);

  const expandFn = (value: T, parent?: N): N => {
    const depth = parent ? parent.depth + 1 : 0;
    const treeNode: TreeNodeWithoutChildren<T, N> = {
      depth,
      parent,
      value
    };

    const node: N = makeNode(treeNode);
    const childrenValues: Maybe<T[]> = config.getChildren(value);
    node.children = childrenValues ? childrenValues.map((x) => expandFn(x, node)) : undefined;
    return node;
  };

  return (root) => expandFn(root);
}

/**
 * Convenience function for expanding multiple values into trees then merging them together into a single array.
 *
 * @param values
 * @param expandFn
 * @returns
 */
export function expandTrees<T, N extends TreeNode<T, N>>(values: T[], expandFn: ExpandTreeFunction<T, N>): N[] {
  return values.map(expandFn);
}
