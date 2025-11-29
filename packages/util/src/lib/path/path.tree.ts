import { TreeNode } from '../tree/tree';
import { SlashPathDetails } from './path';

/**
 * A value that has a corresponding SlashPathDetails value.
 */
export type SlashPathDirectoryTreeNodeValue<T> = {
  readonly value: T;
  readonly slashPathDetails: SlashPathDetails;
};

export type SlashPathDirectoryTreeNode<T> = TreeNode<SlashPathDirectoryTreeNodeValue<T>>;

export type SlashPathDirectoryTreeRoot<T> = Omit<SlashPathDirectoryTreeNode<T>, 'value'>;

export function slashPathDirectoryTree<T>(nodeValues: SlashPathDirectoryTreeNodeValue<T>[]): SlashPathDirectoryTreeRoot<T> {
  const children: SlashPathDirectoryTreeNode<T>[] = [];

  // TODO: recursively build a tree from the node values. The slash path data contains all the information needed to build the tree.

  const root: SlashPathDirectoryTreeRoot<T> = {
    depth: -1,
    children
  };

  return root;
}
