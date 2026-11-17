import { type PrimativeKey, type ReadKeyFunction, type ReadRequiredKeyFunction } from '../key';
import { type MapFunction } from '../value/map';
import { type Maybe } from '../value/maybe.type';

/**
 * Configuration of a {@link PruneTreesFunction}: how to read the items of a flat list of trees.
 *
 * @template T The item type.
 * @template K The id type.
 */
export interface PruneTreesFunctionConfig<T, K extends PrimativeKey = string> {
  /**
   * Reads an item's id. Ids are unique.
   */
  readonly readId: ReadRequiredKeyFunction<T, K>;
  /**
   * Reads an item's parent id. An item with no parent id, or whose parent is not in the list, is a root.
   */
  readonly readParentId: ReadKeyFunction<T, K>;
  /**
   * Reads the value items are aged by, such as a creation time. Smaller is older. Ties keep the list order: a later item counts as newer.
   */
  readonly readOrder: MapFunction<T, number>;
  /**
   * Groups the roots. Each group keeps its own maxRoots roots, and the trees of each group keep their own maxLeaves leaves. Defaults to a single
   * group.
   */
  readonly readRootGroup?: Maybe<MapFunction<T, unknown>>;
  /**
   * Whether an item is preferred as the leaf a kept root protects, such as a successful result over a failed one. Each kept root protects the
   * path to its newest preferred leaf, or to its newest leaf when it has no preferred one. Defaults to preferring every leaf.
   */
  readonly isPreferredLeaf?: Maybe<MapFunction<T, boolean>>;
}

/**
 * Input of a {@link PruneTreesFunction}.
 *
 * @template T The item type.
 * @template K The id type.
 */
export interface PruneTreesParams<T, K extends PrimativeKey = string> {
  /**
   * The items: a flat list of trees, linked by parent id.
   */
  readonly items: readonly T[];
  /**
   * Max roots kept per root group. Unlimited when unset.
   */
  readonly maxRoots?: Maybe<number>;
  /**
   * Max leaves (items with no kept children) kept in the trees of each root group. Unlimited when unset.
   */
  readonly maxLeaves?: Maybe<number>;
  /**
   * Ids of the items that are always kept, with their ancestors, whatever the limits.
   */
  readonly pinnedIds?: Maybe<Iterable<K>>;
}

/**
 * Result of a {@link PruneTreesFunction}. Both lists keep the input order.
 *
 * @template T The item type.
 */
export interface PruneTreesResult<T> {
  readonly keep: T[];
  readonly remove: T[];
}

/**
 * Prunes a flat list of trees (items linked by parent id) to a root limit and a leaf limit. See {@link pruneTreesFunction}.
 *
 * @template T The item type.
 * @template K The id type.
 */
export type PruneTreesFunction<T, K extends PrimativeKey = string> = (params: PruneTreesParams<T, K>) => PruneTreesResult<T>;

/**
 * Creates a {@link PruneTreesFunction}, which prunes a flat list of trees (items linked by parent id), oldest first, such as a history of
 * generations where each one derives from a parent generation.
 *
 * - Roots are capped per root group. The oldest roots past maxRoots are removed with their descendants.
 * - Leaves are capped per root group's trees. Past maxLeaves the oldest leaf is removed first. Removing a leaf can leave its parent as a leaf,
 *   which is then removed in turn, so only leaves are ever removed and no kept item loses its parent.
 * - Each kept root protects the path to its newest (preferred) leaf, even past maxLeaves, so every kept root keeps its latest result.
 * - Pinned items are always kept with their ancestors.
 *
 * @param config - How to read the items.
 * @returns The prune function.
 *
 * @dbxUtil
 * @dbxUtilCategory tree
 * @dbxUtilKind factory
 * @dbxUtilTags tree, prune, history, limit, leaf, root, parent, lineage, retention, oldest
 * @dbxUtilRelated expand-trees, flatten-tree-to-array-function
 *
 * @example
 * ```ts
 * const pruneRuns = pruneTreesFunction<Run>({ readId: (x) => x.id, readParentId: (x) => x.parentId, readOrder: (x) => x.createdAt.getTime() });
 * const { keep } = pruneRuns({ items: runs, maxRoots: 25, maxLeaves: 25, pinnedIds: [selectedRunId] });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function pruneTreesFunction<T, K extends PrimativeKey = string>(config: PruneTreesFunctionConfig<T, K>): PruneTreesFunction<T, K> {
  const { readId, readParentId, readOrder, readRootGroup, isPreferredLeaf } = config;

  return (params: PruneTreesParams<T, K>) => {
    const { items } = params;
    const maxRoots = params.maxRoots ?? Number.POSITIVE_INFINITY;
    const maxLeaves = params.maxLeaves ?? Number.POSITIVE_INFINITY;
    const byId = new Map<K, T>();
    const indexes = new Map<T, number>();

    items.forEach((x, i) => {
      byId.set(readId(x), x);
      indexes.set(x, i);
    });

    const compareOldestFirst = (a: T, b: T) => readOrder(a) - readOrder(b) || (indexes.get(a) as number) - (indexes.get(b) as number);
    const readKnownParent = (x: T) => {
      const parentId = readParentId(x);
      return parentId == null ? undefined : byId.get(parentId);
    };

    const children = new Map<T, T[]>();
    const rootsByGroup = new Map<unknown, T[]>();

    for (const item of items) {
      const parent = readKnownParent(item);

      if (parent == null) {
        const group = readRootGroup?.(item);
        rootsByGroup.set(group, [...(rootsByGroup.get(group) ?? []), item]);
      } else {
        children.set(parent, [...(children.get(parent) ?? []), item]);
      }
    }

    // the item and its ancestors; guarded against parent cycles
    const withAncestors = (item: Maybe<T>) => {
      const result: T[] = [];
      let current = item;

      while (current != null && !result.includes(current)) {
        result.push(current);
        current = readKnownParent(current);
      }

      return result;
    };

    const withDescendants = (root: T) => {
      const result = new Set<T>();
      const stack: T[] = [root];

      while (stack.length > 0) {
        const item = stack.pop() as T;

        if (!result.has(item)) {
          result.add(item);
          stack.push(...(children.get(item) ?? []));
        }
      }

      return Array.from(result);
    };

    const newest = (list: readonly T[]) => list.reduce<Maybe<T>>((a, b) => (a == null || compareOldestFirst(b, a) > 0 ? b : a), undefined);

    const kept = new Set<T>();
    const protectedItems = new Set<T>();

    for (const id of params.pinnedIds ?? []) {
      withAncestors(byId.get(id)).forEach((x) => {
        kept.add(x);
        protectedItems.add(x);
      });
    }

    // the newest roots of each group, with their descendants. Each kept root protects the path to its newest (preferred) leaf.
    const groupOf = new Map<T, unknown>();

    rootsByGroup.forEach((roots, group) => {
      [...roots].sort(compareOldestFirst).forEach((root, i, sorted) => {
        const tree = withDescendants(root);
        tree.forEach((x) => groupOf.set(x, group));

        if (sorted.length - i <= maxRoots) {
          tree.forEach((x) => kept.add(x));
          const leaves = tree.filter((x) => !children.has(x));
          const leaf = newest(isPreferredLeaf ? leaves.filter((x) => isPreferredLeaf(x)) : leaves) ?? newest(leaves);
          withAncestors(leaf).forEach((x) => protectedItems.add(x));
        }
      });
    });

    // the leaves of each group's trees, removed oldest first. A removed leaf can leave its parent as a leaf, which is removed in turn.
    const hasKeptChild = (item: T) => (children.get(item) ?? []).some((x) => kept.has(x));
    const keptByGroup = new Map<unknown, T[]>();

    kept.forEach((x) => {
      const group = groupOf.get(x);
      keptByGroup.set(group, [...(keptByGroup.get(group) ?? []), x]);
    });

    keptByGroup.forEach((groupItems) => {
      const leaves = groupItems.filter((x) => !hasKeptChild(x));
      const removable = leaves.filter((x) => !protectedItems.has(x)).sort(compareOldestFirst);
      let leafCount = leaves.length;

      while (leafCount > maxLeaves && removable.length > 0) {
        const leaf = removable.shift() as T;
        const parent = readKnownParent(leaf);
        kept.delete(leaf);
        leafCount -= 1;

        if (parent != null && kept.has(parent) && !hasKeptChild(parent)) {
          leafCount += 1;

          if (!protectedItems.has(parent)) {
            const index = removable.findIndex((x) => compareOldestFirst(x, parent) > 0);
            removable.splice(index === -1 ? removable.length : index, 0, parent);
          }
        }
      }
    });

    return { keep: items.filter((x) => kept.has(x)), remove: items.filter((x) => !kept.has(x)) };
  };
}
