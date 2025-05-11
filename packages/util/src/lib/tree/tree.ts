/*eslint @typescript-eslint/no-explicit-any:"off"*/
// any is used with intent here, as the recursive TreeNode value requires its use to terminate.

/**
 * Represents a node in a traversable tree structure.
 *
 * @template T The type of the value stored within the node.
 * @template N The specific type of the tree node itself, allowing for recursive type definitions
 *             for `parent` and `children` properties. Defaults to `TreeNode<T, any>` if not specified,
 *             which is suitable for basic trees but can be overridden for custom node types.
 */
export interface TreeNode<T, N extends TreeNode<T, N> = TreeNode<T, any>> {
  /** The depth of the node in the tree. The root node has a depth of 0. */
  depth: number;
  /** The value associated with this tree node. */
  value: T;
  /** A reference to the parent node, or undefined if this is the root node. */
  parent?: N;
  /** An array of child nodes, or undefined if this node has no children. */
  children?: N[];
}

/**
 * A utility type representing a TreeNode before its children have been attached.
 * This is often used during the tree construction process where a node is created
 * and then its children are recursively generated and linked.
 *
 * It omits the 'children' property from the standard TreeNode interface.
 *
 * @template T The type of the value stored within the node.
 * @template N The specific type of the tree node, as in TreeNode.
 */
export type TreeNodeWithoutChildren<T, N extends TreeNode<T, N> = TreeNode<T, any>> = Omit<TreeNode<T, N>, 'children'>;
