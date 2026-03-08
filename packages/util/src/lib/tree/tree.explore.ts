import { type ArrayOrValue, asArray } from '../array/array';
import { MAP_IDENTITY } from '../value/map';
import { type Maybe } from '../value/maybe.type';
import { type TreeNode } from './tree';

/**
 * Decides how to visit a node during tree exploration.
 */
export const ExploreTreeVisitNodeDecision = {
  /**
   * Visits all nodes and children
   */
  VISIT_ALL: 0,
  /**
   * Visits the node only
   */
  VISIT_NODE_ONLY: 1,
  /**
   * Visits the node and its children
   */
  VISIT_CHILDREN_ONLY: 2,
  /**
   * No value will be visited
   */
  SKIP_ALL: 3
} as const;

export type ExploreTreeVisitNodeDecision = (typeof ExploreTreeVisitNodeDecision)[keyof typeof ExploreTreeVisitNodeDecision];

/**
 * Function that determines how a node should be handled during tree exploration.
 *
 * Receives both the original node and its mapped value, allowing filtering decisions
 * based on either the raw tree structure or a transformed representation.
 *
 * @template N - The tree node type.
 * @template V - The mapped value type, defaults to N if no mapping is applied.
 */
export type ExploreTreeVisitNodeDecisionFunction<N extends TreeNode<unknown>, V = N> = (node: N, nodeMappedValue: V) => ExploreTreeVisitNodeDecision;

/**
 * Callback invoked when a node is visited during tree exploration.
 *
 * Receives the mapped value (or the node itself if no mapping) and the original node,
 * allowing side effects such as accumulating results or modifying external state.
 *
 * @template N - The tree node type.
 * @template V - The mapped value type passed to the callback.
 */
export type ExploreTreeVisitNodeFunction<N extends TreeNode<unknown>, V> = (value: V, node: N) => void;

/**
 * Factory that creates a traversal strategy for tree exploration.
 *
 * Controls the order in which nodes are visited (e.g., depth-first vs breadth-first).
 * Receives the visit callback and a recursive traversal function, and returns a function
 * that handles a single node based on its visit decision.
 *
 * @template N - The tree node type.
 * @template V - The mapped value type.
 */
export type ExploreTreeTraversalFactoryFunction<N extends TreeNode<unknown>, V> = (visit: ExploreTreeVisitNodeFunction<N, V>, traverseTree: (tree: N) => void) => (node: N, nodeMappedValue: V, visitDecision: ExploreTreeVisitNodeDecision) => void;

/**
 * Configuration for creating an {@link ExploreTreeFunction}.
 *
 * Allows customizing node mapping, visit filtering, and traversal order.
 * All options can also be overridden at call time.
 *
 * @template N - The tree node type.
 * @template V - The mapped value type, defaults to N.
 */
export interface ExploreTreeFunctionConfig<N extends TreeNode<unknown>, V = N> {
  /**
   * Custom traversal strategy (e.g., breadth-first). Defaults to depth-first.
   */
  traverseFunctionFactory?: ExploreTreeTraversalFactoryFunction<N, V>;
  /**
   * Transforms each node into a value before visiting. Defaults to identity.
   */
  mapNodeFunction?: (node: N) => V;
  /**
   * Controls whether each node is visited, skipped, or has only its children visited.
   * Defaults to visiting all nodes.
   */
  shouldVisitNodeFunction?: Maybe<ExploreTreeVisitNodeDecisionFunction<N, V>>;
}

/**
 * Traverses one or more trees, invoking a visit callback on each node.
 *
 * Supports runtime overrides of mapping, filtering, and traversal strategy.
 *
 * @template N - The tree node type.
 * @template V - The mapped value type passed to the visit callback.
 */
export type ExploreTreeFunction<N extends TreeNode<unknown, N>, V> = (trees: ArrayOrValue<N>, visit: ExploreTreeVisitNodeFunction<N, V>, override?: ExploreTreeFunctionConfig<N, V>) => void;

/**
 * Creates a reusable tree exploration function with configurable traversal, mapping, and filtering.
 *
 * The returned function traverses one or more trees, applying a visit callback to each node.
 * By default uses depth-first traversal, identity mapping, and visits all nodes. All options
 * can be overridden per-call.
 *
 * @param config - Optional default configuration for mapping, filtering, and traversal strategy.
 * @returns A reusable function that explores trees with the configured behavior.
 *
 * @example
 * ```typescript
 * const exploreFn = exploreTreeFunction<TestNode, string>({
 *   mapNodeFunction: (node) => node.value.id
 * });
 * const visited: string[] = [];
 *
 * exploreFn(rootNode, (id) => {
 *   visited.push(id);
 * });
 * ```
 */
export function exploreTreeFunction<N extends TreeNode<unknown, N>, V>(config?: Maybe<ExploreTreeFunctionConfig<N, V>>): ExploreTreeFunction<N, V> {
  const defaultMapNodeFn: (node: N) => V = config?.mapNodeFunction ?? (MAP_IDENTITY as typeof defaultMapNodeFn);
  const defaultShouldVisitNodeFn: ExploreTreeVisitNodeDecisionFunction<N, V> = config?.shouldVisitNodeFunction ?? (() => ExploreTreeVisitNodeDecision.VISIT_ALL);
  const defaultTraverseFactory: ExploreTreeTraversalFactoryFunction<N, V> = config?.traverseFunctionFactory ?? depthFirstExploreTreeTraversalFactoryFunction();

  return (trees: ArrayOrValue<N>, visit: (value: V, node: N) => void, override?: ExploreTreeFunctionConfig<N, V>) => {
    const treesArray = asArray(trees);
    const mapNodeFn = override?.mapNodeFunction ?? defaultMapNodeFn;
    const shouldVisitNodeFn = override?.shouldVisitNodeFunction ?? defaultShouldVisitNodeFn;
    const traverseFactory = override?.traverseFunctionFactory ?? defaultTraverseFactory;

    /**
     * The root recursive flatten function.
     *
     * @param tree
     * @returns
     */
    const exploreFn = (tree: N) => {
      const mappedValue = mapNodeFn(tree);
      const visitResult = shouldVisitNodeFn(tree, mappedValue);
      exploreNextFn(tree, mappedValue, visitResult);
    };

    const exploreNextFn = traverseFactory(visit, exploreFn);
    return treesArray.forEach((x) => exploreFn(x));
  };
}

/**
 * Creates a depth-first traversal strategy for tree exploration.
 *
 * Visits each node before its children (pre-order). This is the default traversal
 * strategy used by {@link exploreTreeFunction}.
 *
 * @returns A traversal factory that processes nodes in depth-first order.
 *
 * @example
 * ```typescript
 * const exploreFn = exploreTreeFunction<TestNode, TestNode>({
 *   traverseFunctionFactory: depthFirstExploreTreeTraversalFactoryFunction()
 * });
 * // Visits: root -> child1 -> leaf1 -> leaf2 -> child2 -> leaf3
 * ```
 */
export function depthFirstExploreTreeTraversalFactoryFunction<N extends TreeNode<unknown, N>, V>(): ExploreTreeTraversalFactoryFunction<N, V> {
  return (visit: ExploreTreeVisitNodeFunction<N, V>, continueTraversal: (tree: N) => void) => {
    return (node: N, nodeMappedValue: V, visitDecision: ExploreTreeVisitNodeDecision) => {
      // if addNode returns false, skip this node and its children
      if (visitDecision !== ExploreTreeVisitNodeDecision.SKIP_ALL) {
        if (visitDecision !== ExploreTreeVisitNodeDecision.VISIT_CHILDREN_ONLY) {
          visit(nodeMappedValue, node);
        }

        if (node.children && visitDecision !== ExploreTreeVisitNodeDecision.VISIT_NODE_ONLY) {
          node.children.forEach((x) => continueTraversal(x));
        }
      }
    };
  };
}

/**
 * Creates a breadth-first traversal strategy for tree exploration.
 *
 * Visits nodes level by level, processing all nodes at depth N before moving to depth N+1.
 * Uses an internal queue to defer child processing until the current level is complete.
 *
 * @returns A traversal factory that processes nodes in breadth-first order.
 *
 * @example
 * ```typescript
 * const exploreFn = exploreTreeFunction<TestNode, TestNode>({
 *   traverseFunctionFactory: breadthFirstExploreTreeTraversalFactoryFunction()
 * });
 * // Visits: root -> child1, child2, child3 -> leaf1, leaf2, leaf3
 * ```
 */
export function breadthFirstExploreTreeTraversalFactoryFunction<N extends TreeNode<unknown, N>, V>(): ExploreTreeTraversalFactoryFunction<N, V> {
  return (visit: ExploreTreeVisitNodeFunction<N, V>, continueTraversal: (tree: N) => void) => {
    const queue: N[] = [];
    let isProcessing = false;

    const processQueue = () => {
      if (!isProcessing) {
        isProcessing = true;

        while (queue.length > 0) {
          const node = queue.shift()!;
          continueTraversal(node);
        }

        isProcessing = false;
      }
    };

    return (node: N, nodeMappedValue: V, visitDecision: ExploreTreeVisitNodeDecision) => {
      if (visitDecision !== ExploreTreeVisitNodeDecision.SKIP_ALL) {
        // Visit the node if not VISIT_CHILDREN_ONLY
        if (visitDecision !== ExploreTreeVisitNodeDecision.VISIT_CHILDREN_ONLY) {
          visit(nodeMappedValue, node);
        }

        // Add children to queue if not VISIT_NODE_ONLY
        if (node.children && visitDecision !== ExploreTreeVisitNodeDecision.VISIT_NODE_ONLY) {
          node.children.forEach((child) => queue.push(child));
        }
      }

      // Process queue after current level
      if (!isProcessing) {
        processQueue();
      }
    };
  };
}
