import { ArrayOrValue, asArray } from '../array';
import { Configurable } from '../type';
import { Building } from '../value/build';
import { Maybe } from '../value/maybe.type';

/**
 * A tree node
 */
export type SplitStringTreeNodeString = string;

export const SPLIT_STRING_TREE_NODE_ROOT_VALUE = '';

export type SplitStringTreeChildren = {
  [key: string]: SplitStringTree;
};

export interface SplitStringTree {
  /**
   * The full string value.
   *
   * I.E.
   *
   * a/b/c
   */
  readonly fullValue: SplitStringTreeNodeString;
  /**
   * The specific node value. Equal to the "last" "element" of the fullValue.
   *
   * I.E.
   *
   * "c" for the fullValue of "a/b/c"
   */
  readonly nodeValue: string;
  /**
   * Child nodes, keyed by their node value.
   *
   * I.E.
   *
   * { a: { b: { c: {} }} }
   */
  readonly children: SplitStringTreeChildren;
}

export type SplitStringTreeRoot = Pick<SplitStringTree, 'children'>;

export type SplitStringTreeFactory = ((values: ArrayOrValue<string>, existing?: SplitStringTree) => SplitStringTree) & {
  readonly _separator: string;
};

export interface SplitStringTreeFactoryConfig {
  readonly separator: string;
}

/**
 * Creates a SplitStringTreeFactory with the configured splitter.
 *
 * @param config
 * @returns
 */
export function splitStringTreeFactory(config: SplitStringTreeFactoryConfig): SplitStringTreeFactory {
  const { separator } = config;

  const fn = ((values: ArrayOrValue<string>, existing?: SplitStringTree): SplitStringTree => {
    const result: SplitStringTree = existing ?? {
      fullValue: SPLIT_STRING_TREE_NODE_ROOT_VALUE,
      nodeValue: SPLIT_STRING_TREE_NODE_ROOT_VALUE,
      children: {}
    };

    asArray(values).forEach((value) => {
      addToSplitStringTree(result, value, separator);
    });

    return result;
  }) as Building<SplitStringTreeFactory>;

  fn._separator = separator;

  return fn as SplitStringTreeFactory;
}

/**
 * Adds a value to the target SplitStringTree.
 *
 * @param tree
 * @param value
 * @param separator
 * @returns
 */
export function addToSplitStringTree(tree: SplitStringTree, value: SplitStringTreeNodeString, separator: string): SplitStringTree {
  const parts = value.split(separator);
  let currentNode: Configurable<SplitStringTree> = tree;

  parts.forEach((nodeValue) => {
    const existingChildNode = currentNode.children[nodeValue];
    const childNode = (existingChildNode ?? { nodeValue, children: {} }) as Configurable<SplitStringTree>; // use the existing node or create a new node

    if (!existingChildNode) {
      childNode.fullValue = currentNode.fullValue ? currentNode.fullValue + separator + nodeValue : nodeValue;
      currentNode.children[nodeValue] = childNode;
    }

    currentNode = childNode;
  });

  return tree;
}

// MARK: Search
/**
 * Returns the best match for the value in the tree, including the input tree value.
 *
 * Only returns a result if there is match of any kind.
 *
 * @param tree
 * @param value
 * @returns
 */
export function findBestSplitStringTreeMatch(tree: SplitStringTree, value: SplitStringTreeNodeString): Maybe<SplitStringTree> {
  let bestResult = findBestSplitStringTreeChildMatch(tree, value);

  if (!bestResult && tree.fullValue && value.startsWith(tree.fullValue)) {
    bestResult = tree;
  }

  return bestResult;
}

/**
 * Returns the best match for the value in the true, excluding the input tree value.
 *
 * Only returns a result if there is match of any kind.
 *
 * @param tree
 * @param value
 * @returns
 */
export function findBestSplitStringTreeChildMatch(tree: SplitStringTree, value: SplitStringTreeNodeString): Maybe<SplitStringTree> {
  const { children } = tree;
  let bestMatch: Maybe<SplitStringTree>;

  Object.entries(children).find(([_, child]) => {
    let stopScan = false;

    if (value.startsWith(child.fullValue)) {
      bestMatch = findBestSplitStringTreeMatch(child, value) ?? child;
      stopScan = true;
    }

    return stopScan;
  });

  return bestMatch;
}
