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
 * A function that determines if a node should be visited.
 *
 * The mapped value is also present.
 */
export type ExploreTreeVisitNodeDecisionFunction<N extends TreeNode<unknown>, V = N> = (node: N, nodeMappedValue: V) => ExploreTreeVisitNodeDecision;

/**
 * A function that visits a node.
 */
export type ExploreTreeVisitNodeFunction<N extends TreeNode<unknown>, V> = (value: V, node: N) => void;

/**
 * Creates a traversal function that can be used to visit nodes.
 */
export type ExploreTreeTraversalFactoryFunction<N extends TreeNode<unknown>, V> = (visit: ExploreTreeVisitNodeFunction<N, V>, traverseTree: (tree: N) => void) => (node: N, nodeMappedValue: V, visitDecision: ExploreTreeVisitNodeDecision) => void;

export interface ExploreTreeFunctionConfig<N extends TreeNode<unknown>, V = N> {
  /**
   * A custom traversal function to use instead of the default traversal function.
   */
  traverseFunctionFactory?: ExploreTreeTraversalFactoryFunction<N, V>;
  /**
   * A function that maps a node to a specific value before visiting it.
   */
  mapNodeFunction?: (node: N) => V;
  /**
   * A function that determines if a node should be visited.
   */
  shouldVisitNodeFunction?: Maybe<ExploreTreeVisitNodeDecisionFunction<N, V>>;
}

/**
 * Explores the input trees.
 */
export type ExploreTreeFunction<N extends TreeNode<unknown, N>, V> = (trees: ArrayOrValue<N>, visit: ExploreTreeVisitNodeFunction<N, V>, override?: ExploreTreeFunctionConfig<N, V>) => void;

/**
 * Convenience function for exploring the input trees
 
 * @param trees 
 * @param visitNodeFn 
 * @returns 
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
 * A depth-first traversal factory function.
 *
 * @returns A ExploreTreeTraversalFactoryFunction<N, V>.
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
 * A breadth-first traversal factory function.
 *
 * Visits nodes level by level, processing all nodes at depth N before moving to depth N+1.
 *
 * @returns A ExploreTreeTraversalFactoryFunction<N, V>.
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
