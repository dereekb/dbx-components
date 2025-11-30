import { type TreeNode } from '../tree/tree';
import { type Maybe } from '../value/maybe.type';
import { type SlashPathDetails } from './path';

/**
 * A value that has a corresponding SlashPathDetails value.
 */
export type SlashPathDirectoryTreeNodeValue<T> = {
  readonly value: T;
  readonly slashPathDetails: SlashPathDetails;
};

export type SlashPathDirectoryTreeNode<T, V extends SlashPathDirectoryTreeNodeValue<T> = SlashPathDirectoryTreeNodeValue<T>> = TreeNode<V>;

export type SlashPathDirectoryTreeRoot<T, V extends SlashPathDirectoryTreeNodeValue<T> = SlashPathDirectoryTreeNodeValue<T>> = Omit<SlashPathDirectoryTreeNode<T, V>, 'value'>;

export interface SlashPathDirectoryTreeOptions {
  /**
   * Whether or not to include node values in the tree if their parent folders do not appear in the tree.
   *
   * If true, these nodes will be added to the root of the tree.
   *
   * Defaults to false
   */
  readonly includeChildrenWithMissingParentFolder?: Maybe<boolean>;
}

export function slashPathDirectoryTree<T, V extends SlashPathDirectoryTreeNodeValue<T> = SlashPathDirectoryTreeNodeValue<T>>(nodeValues: V[], options?: SlashPathDirectoryTreeOptions): SlashPathDirectoryTreeRoot<T, V> {
  const { includeChildrenWithMissingParentFolder } = options ?? {};

  /**
   * Create all nodes first.
   */
  const nodes: SlashPathDirectoryTreeNode<T, V>[] = nodeValues.map((x) => ({
    depth: x.slashPathDetails.parts.length - 1,
    value: x
  }));

  const nodeMap = new Map<string, SlashPathDirectoryTreeNode<T, V>>();

  nodes.forEach((node) => {
    // only add typed files to the node map
    if (!node.value.slashPathDetails.typedFile) {
      const key = node.value.slashPathDetails.parts.join('/');
      nodeMap.set(key, node);
    }
  });

  /**
   * Create the tree second, and add the root children nodes.
   */
  const children: SlashPathDirectoryTreeNode<T, V>[] = [];

  nodes.forEach((node) => {
    const { slashPathDetails } = node.value;
    const parts = slashPathDetails.parts;

    if (parts.length > 1) {
      const parentParts = parts.slice(0, parts.length - 1);
      const parentKey = parentParts.join('/');
      const parent = nodeMap.get(parentKey);

      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }

        parent.children.push(node);
        node.parent = parent;
      } else if (includeChildrenWithMissingParentFolder) {
        children.push(node);
      }
    } else {
      children.push(node);
    }
  });

  const root: SlashPathDirectoryTreeRoot<T, V> = {
    depth: -1,
    children
  };

  return root;
}
