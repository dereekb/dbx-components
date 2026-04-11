import { type ArrayOrValue, asArray, lastValue } from '../array/array';
import { type Configurable } from '../type';
import { type Building } from '../value/build';
import { type Maybe } from '../value/maybe.type';

/**
 * A string value representing a node in a split string tree.
 */
export type SplitStringTreeNodeString = string;

/**
 * The default value used for the root node of a split string tree.
 */
export const SPLIT_STRING_TREE_NODE_ROOT_VALUE = '';

/**
 * Map of child nodes in a split string tree, keyed by their node value.
 *
 * @template M - The type of metadata attached to tree nodes.
 */
export type SplitStringTreeChildren<M = unknown> = {
  [key: string]: SplitStringTree<M>;
};

/**
 * A node in a tree structure built by splitting strings on a separator character.
 *
 * For example, splitting `"a/b/c"` on `"/"` produces a tree with nodes for `"a"`, `"b"`, and `"c"`.
 *
 * @template M - The type of metadata attached to tree nodes.
 */
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

/**
 * A root-level split string tree containing only children (no own value).
 *
 * @template M - The type of metadata attached to tree nodes.
 */
export type SplitStringTreeRoot<M = unknown> = Pick<SplitStringTree<M>, 'children'>;

/**
 * Input for a {@link SplitStringTreeFactory}, specifying values to add and optional metadata.
 *
 * @template M - The type of metadata attached to tree nodes.
 */
export interface SplitStringTreeFactoryInput<M = unknown> extends Pick<AddToSplitStringTreeInputValueWithMeta<M>, 'leafMeta' | 'nodeMeta'> {
  /**
   * One or more string values to split and add to the tree.
   */
  readonly values: ArrayOrValue<SplitStringTreeNodeString>;
}

/**
 * Factory function that builds or extends a {@link SplitStringTree} from string values split on a configured separator.
 *
 * @template M - The type of metadata attached to tree nodes.
 */
export type SplitStringTreeFactory<M = unknown> = ((input: SplitStringTreeFactoryInput<M>, existing?: Maybe<SplitStringTree<M>>) => SplitStringTree<M>) & {
  readonly _separator: string;
};

/**
 * Configuration for a {@link SplitStringTreeFactory}.
 *
 * @template M - The type of metadata attached to tree nodes.
 */
export type SplitStringTreeFactoryConfig<M = unknown> = AddToSplitStringTreeInputConfig<M>;

/**
 * Creates a {@link SplitStringTreeFactory} that builds tree structures by splitting strings on the configured separator.
 *
 * @param config - Configuration specifying the separator and optional metadata merge strategy.
 * @returns A factory function that creates or extends split string trees.
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

/**
 * Input for {@link applySplitStringTreeWithMultipleValues}.
 *
 * @template M - The type of metadata attached to tree nodes.
 */
export interface ApplySplitStringTreeWithMultipleValuesInput<M = unknown> {
  /**
   * The entries to add to the tree, each potentially with different metadata.
   */
  readonly entries: SplitStringTreeFactoryInput<M>[];
  /**
   * The factory to use for building the tree.
   */
  readonly factory: SplitStringTreeFactory<M>;
  /**
   * An optional existing tree to extend rather than creating a new one.
   */
  readonly existing?: SplitStringTree<M>;
}

/**
 * Builds or extends a split string tree by applying multiple entry sets sequentially.
 *
 * @param input - The entries, factory, and optional existing tree.
 * @returns The resulting split string tree with all entries applied.
 */
export function applySplitStringTreeWithMultipleValues<M = unknown>(input: ApplySplitStringTreeWithMultipleValuesInput<M>): SplitStringTree<M> {
  const { entries, factory, existing } = input;
  let result: Maybe<SplitStringTree<M>> = existing;

  entries.forEach((entry) => {
    result = factory(entry, result);
  });

  result ??= factory({ values: [] });

  return result;
}

/**
 * A value and optional metadata to add to a split string tree.
 *
 * @template M - The type of metadata attached to tree nodes.
 */
export interface AddToSplitStringTreeInputValueWithMeta<M = unknown> {
  /**
   * The string value to split and insert into the tree.
   */
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

/**
 * Configuration for splitting strings and adding them to a tree.
 *
 * @template M - The type of metadata attached to tree nodes.
 */
export interface AddToSplitStringTreeInputConfig<M = unknown> {
  /**
   * The separator character used to split string values into tree path segments.
   */
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
 * Adds a value to the target {@link SplitStringTree} by splitting it on the configured separator and inserting nodes along the path.
 *
 * @param tree - The tree to add the value to.
 * @param inputValue - The string value and optional metadata to insert.
 * @param config - Configuration specifying the separator and optional metadata merge strategy.
 * @returns The same tree instance with the new value added.
 */
export function addToSplitStringTree<M = unknown>(tree: SplitStringTree<M>, inputValue: AddToSplitStringTreeInputValueWithMeta<M>, config: AddToSplitStringTreeInputConfig<M>): SplitStringTree<M> {
  const { separator, mergeMeta } = config;
  const { value, leafMeta, nodeMeta } = inputValue;

  function nextMeta(node: SplitStringTree<M>, nextMeta: M): M | undefined {
    return mergeMeta && node.meta != null ? mergeMeta(node.meta, nextMeta) : nextMeta;
  }

  const parts = value.split(separator);
  let currentNode: Configurable<SplitStringTree<M>> = tree;

  parts.forEach((nodeValue) => {
    const existingChildNode = currentNode.children[nodeValue] as SplitStringTree<M> | undefined; // may be undefined for new paths
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
 * Returns the deepest matching node for the value in the tree, including the input tree node itself.
 *
 * Only returns a result if there is a match of any kind.
 *
 * @param tree - The tree to search.
 * @param value - The string value to find a match for.
 * @returns The best matching tree node, or `undefined` if no match is found.
 */
export function findBestSplitStringTreeMatch<M = unknown>(tree: SplitStringTree<M>, value: SplitStringTreeNodeString): Maybe<SplitStringTree<M>> {
  return lastValue(findBestSplitStringTreeMatchPath(tree, value));
}

/**
 * Returns the deepest matching child node for the value in the tree, excluding the input tree node itself.
 *
 * Only returns a result if there is a match of any kind.
 *
 * @param tree - The tree to search.
 * @param value - The string value to find a match for.
 * @returns The best matching child tree node, or `undefined` if no match is found.
 */
export function findBestSplitStringTreeChildMatch<M = unknown>(tree: SplitStringTree<M>, value: SplitStringTreeNodeString): Maybe<SplitStringTree<M>> {
  return lastValue(findBestSplitStringTreeChildMatchPath(tree, value));
}

/**
 * Returns the full path of matching nodes for the value in the tree, including the input tree node itself.
 *
 * Only returns a result if there is a match of any kind.
 *
 * @param tree - The tree to search.
 * @param value - The string value to find a match path for.
 * @returns An array of tree nodes forming the match path from root to deepest match, or `undefined` if no match is found.
 */
export function findBestSplitStringTreeMatchPath<M = unknown>(tree: SplitStringTree<M>, value: SplitStringTreeNodeString): Maybe<SplitStringTree<M>[]> {
  let bestResult = findBestSplitStringTreeChildMatchPath(tree, value);

  if (!bestResult && tree.fullValue && value.startsWith(tree.fullValue)) {
    bestResult = [tree];
  }

  return bestResult;
}

/**
 * Returns the full path of matching child nodes for the value in the tree, excluding the input tree node itself.
 *
 * Only returns a result if there is a match of any kind.
 *
 * @param tree - The tree to search.
 * @param value - The string value to find a match path for.
 * @returns An array of child tree nodes forming the match path, or `undefined` if no match is found.
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
