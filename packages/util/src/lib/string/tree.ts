import { type ArrayOrValue, asArray, lastValue } from '../array/array';
import { type Configurable } from '../type';
import { type Building } from '../value/build';
import { type Maybe } from '../value/maybe.type';

/**
 * A tree node
 */
export type SplitStringTreeNodeString = string;

export const SPLIT_STRING_TREE_NODE_ROOT_VALUE = '';

export type SplitStringTreeChildren<M = unknown> = {
  [key: string]: SplitStringTree<M>;
};

export interface SplitStringTree<M = unknown> {
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
  readonly children: SplitStringTreeChildren<M>;
  /**
   * Meta value for the node.
   */
  readonly meta?: M;
}

export type SplitStringTreeRoot<M = unknown> = Pick<SplitStringTree<M>, 'children'>;

export interface SplitStringTreeFactoryInput<M = unknown> extends Pick<AddToSplitStringTreeInputValueWithMeta<M>, 'leafMeta' | 'nodeMeta'> {
  readonly values: ArrayOrValue<SplitStringTreeNodeString>;
}

export type SplitStringTreeFactory<M = unknown> = ((input: SplitStringTreeFactoryInput<M>, existing?: Maybe<SplitStringTree<M>>) => SplitStringTree<M>) & {
  readonly _separator: string;
};

export type SplitStringTreeFactoryConfig<M = unknown> = AddToSplitStringTreeInputConfig<M>;

/**
 * Creates a SplitStringTreeFactory with the configured splitter.
 *
 * @param config
 * @returns
 */
export function splitStringTreeFactory<M = unknown>(config: SplitStringTreeFactoryConfig<M>): SplitStringTreeFactory<M> {
  const { separator } = config;

  const fn = ((input: SplitStringTreeFactoryInput<M>, existing?: Maybe<SplitStringTree<M>>): SplitStringTree<M> => {
    const { leafMeta, nodeMeta, values } = input;
    const result: SplitStringTree<M> = existing ?? {
      fullValue: SPLIT_STRING_TREE_NODE_ROOT_VALUE,
      nodeValue: SPLIT_STRING_TREE_NODE_ROOT_VALUE,
      children: {}
    };

    asArray(values).forEach((value) => {
      addToSplitStringTree<M>(result, { value, leafMeta, nodeMeta }, config);
    });

    return result;
  }) as Building<SplitStringTreeFactory<M>>;

  fn._separator = separator;

  return fn as SplitStringTreeFactory<M>;
}

export interface ApplySplitStringTreeWithMultipleValuesInput<M = unknown> {
  readonly entries: SplitStringTreeFactoryInput<M>[];
  readonly factory: SplitStringTreeFactory<M>;
  readonly existing?: SplitStringTree<M>;
}

export function applySplitStringTreeWithMultipleValues<M = unknown>(input: ApplySplitStringTreeWithMultipleValuesInput<M>): SplitStringTree<M> {
  const { entries, factory, existing } = input;
  let result: Maybe<SplitStringTree<M>>;

  entries.forEach((entry) => {
    result = factory(entry, result);
  });

  if (!result) {
    result = factory({ values: [] });
  }

  return result;
}

export interface AddToSplitStringTreeInputValueWithMeta<M = unknown> {
  readonly value: SplitStringTreeNodeString;
  /**
   * The meta value to merge/attach to each node in the tree
   */
  readonly nodeMeta?: M;
  /**
   * The meta value to merge/attach to each leaf node
   */
  readonly leafMeta?: M;
}

export interface AddToSplitStringTreeInputConfig<M = unknown> {
  readonly separator: string;
  /**
   * Used for merging the meta values of two nodes.
   *
   * @param current
   * @param next
   * @returns
   */
  readonly mergeMeta?: (current: M, next: M) => M;
}

/**
 * Adds a value to the target SplitStringTree.
 *
 * @param tree
 * @param value
 * @param separator
 * @returns
 */
export function addToSplitStringTree<M = unknown>(tree: SplitStringTree<M>, inputValue: AddToSplitStringTreeInputValueWithMeta<M>, config: AddToSplitStringTreeInputConfig<M>): SplitStringTree<M> {
  const { separator, mergeMeta } = config;
  const { value, leafMeta, nodeMeta } = inputValue;

  function nextMeta(node: SplitStringTree<M>, nextMeta: M): M | undefined {
    if (mergeMeta && node.meta != null) {
      return mergeMeta(node.meta, nextMeta);
    } else {
      return nextMeta;
    }
  }

  const parts = value.split(separator);
  let currentNode: Configurable<SplitStringTree<M>> = tree;

  parts.forEach((nodeValue) => {
    const existingChildNode = currentNode.children[nodeValue];
    const childNode = (existingChildNode ?? { nodeValue, children: {} }) as Configurable<SplitStringTree<M>>; // use the existing node or create a new node

    if (!existingChildNode) {
      childNode.fullValue = currentNode.fullValue ? currentNode.fullValue + separator + nodeValue : nodeValue;
      currentNode.children[nodeValue] = childNode;
    }

    // add the meta to the node
    if (nodeMeta != null) {
      childNode.meta = nextMeta(childNode, nodeMeta);
    }

    currentNode = childNode;
  });

  // add the meta to the leaf node
  if (leafMeta != null) {
    currentNode.meta = nextMeta(currentNode, leafMeta);
  }

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
  return lastValue(findBestSplitStringTreeMatchPath(tree, value));
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
export function findBestSplitStringTreeChildMatch<M = unknown>(tree: SplitStringTree<M>, value: SplitStringTreeNodeString): Maybe<SplitStringTree<M>> {
  return lastValue(findBestSplitStringTreeChildMatchPath(tree, value));
}

/**
 * Returns the best match for the value in the tree, including the input tree value.
 *
 * Only returns a result if there is match of any kind.
 *
 * @param tree
 * @param value
 * @returns
 */
export function findBestSplitStringTreeMatchPath<M = unknown>(tree: SplitStringTree<M>, value: SplitStringTreeNodeString): Maybe<SplitStringTree<M>[]> {
  let bestResult = findBestSplitStringTreeChildMatchPath(tree, value);

  if (!bestResult && tree.fullValue && value.startsWith(tree.fullValue)) {
    bestResult = [tree];
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
export function findBestSplitStringTreeChildMatchPath<M = unknown>(tree: SplitStringTree<M>, value: SplitStringTreeNodeString): Maybe<SplitStringTree<M>[]> {
  const { children } = tree;
  let bestMatchPath: Maybe<SplitStringTree<M>[]>;

  Object.entries(children).find(([_, child]) => {
    let stopScan = false;

    if (value.startsWith(child.fullValue)) {
      const bestChildPath = findBestSplitStringTreeChildMatchPath(child, value) ?? [];
      bestMatchPath = [child, ...bestChildPath];
      stopScan = true;
    }

    return stopScan;
  });

  return bestMatchPath;
}
