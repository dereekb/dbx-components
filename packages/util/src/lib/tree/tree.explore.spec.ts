import { type TreeNode } from './tree';
import { breadthFirstExploreTreeTraversalFactoryFunction, exploreTreeFunction, ExploreTreeVisitNodeDecision } from './tree.explore';

interface TestNodeValue {
  id: string;
  value?: number;
}

interface TestNode extends TreeNode<TestNodeValue, TestNode> {
  value: TestNodeValue;
  children?: TestNode[];
}

function createTestNode(id: string, value?: number, children?: TestNode[]): TestNode {
  return {
    depth: 0,
    parent: undefined,
    value: { id, value },
    children
  };
}

// Test Data
const leaf1 = createTestNode('leaf1', 10);
const leaf2 = createTestNode('leaf2', 20);
const leaf3 = createTestNode('leaf3', 30);
const leaf4 = createTestNode('leaf4', 40);

const child1 = createTestNode('child1', 1, [leaf1, leaf2]);
const child2 = createTestNode('child2', 2, [leaf3]);
const child3 = createTestNode('child3', 3); // No children

const root1 = createTestNode('root1', 100, [child1, child2, child3]);
const root2 = createTestNode('root2', 200, [leaf4]);
const singleNodeTree = createTestNode('single', 500);

describe('exploreTreeFunction()', () => {
  describe('basic traversal', () => {
    it('should visit all nodes in a single tree.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>();
      const visited: string[] = [];

      exploreFn(singleNodeTree, (value, node) => {
        visited.push(value.value.id);
      });

      expect(visited).toEqual(['single']);
    });

    it('should visit all nodes in a complex tree.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>();
      const visited: string[] = [];

      exploreFn(root1, (value, node) => {
        visited.push(value.value.id);
      });

      const expectedIds = ['root1', 'child1', 'leaf1', 'leaf2', 'child2', 'leaf3', 'child3'];
      expect(visited).toEqual(expectedIds);
    });

    it('should visit all nodes in multiple trees.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>();
      const visited: string[] = [];

      exploreFn([root1, root2], (value, node) => {
        visited.push(value.value.id);
      });

      const expectedIds = ['root1', 'child1', 'leaf1', 'leaf2', 'child2', 'leaf3', 'child3', 'root2', 'leaf4'];
      expect(visited).toEqual(expectedIds);
    });
  });

  describe('with mapNodeFunction', () => {
    it('should map nodes to their IDs.', () => {
      const exploreFn = exploreTreeFunction<TestNode, string>({
        mapNodeFunction: (node) => node.value.id
      });
      const visited: string[] = [];

      exploreFn(root1, (value, node) => {
        visited.push(value);
      });

      const expectedIds = ['root1', 'child1', 'leaf1', 'leaf2', 'child2', 'leaf3', 'child3'];
      expect(visited).toEqual(expectedIds);
    });

    it('should map nodes to their values.', () => {
      const exploreFn = exploreTreeFunction<TestNode, number>({
        mapNodeFunction: (node) => node.value.value ?? 0
      });
      const visited: number[] = [];

      exploreFn(root1, (value, node) => {
        visited.push(value);
      });

      const expectedValues = [100, 1, 10, 20, 2, 30, 3];
      expect(visited).toEqual(expectedValues);
    });
  });

  describe('with shouldVisitNodeFunction', () => {
    it('should skip nodes when SKIP_ALL is returned.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>({
        shouldVisitNodeFunction: (node, value) => (node.value.id === 'child1' ? ExploreTreeVisitNodeDecision.SKIP_ALL : ExploreTreeVisitNodeDecision.VISIT_ALL)
      });
      const visited: string[] = [];

      exploreFn(root1, (value, node) => {
        visited.push(value.value.id);
      });

      // Should skip child1 and its children (leaf1, leaf2)
      const expectedIds = ['root1', 'child2', 'leaf3', 'child3'];
      expect(visited).toEqual(expectedIds);
    });

    it('should visit node only when VISIT_NODE_ONLY is returned.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>({
        shouldVisitNodeFunction: (node, value) => (node.value.id === 'child1' ? ExploreTreeVisitNodeDecision.VISIT_NODE_ONLY : ExploreTreeVisitNodeDecision.VISIT_ALL)
      });
      const visited: string[] = [];

      exploreFn(root1, (value, node) => {
        visited.push(value.value.id);
      });

      // Should visit child1 but skip its children (leaf1, leaf2)
      const expectedIds = ['root1', 'child1', 'child2', 'leaf3', 'child3'];
      expect(visited).toEqual(expectedIds);
    });

    it('should visit children only when VISIT_CHILDREN_ONLY is returned.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>({
        shouldVisitNodeFunction: (node, value) => (node.value.id === 'child1' ? ExploreTreeVisitNodeDecision.VISIT_CHILDREN_ONLY : ExploreTreeVisitNodeDecision.VISIT_ALL)
      });
      const visited: string[] = [];

      exploreFn(root1, (value, node) => {
        visited.push(value.value.id);
      });

      // Should skip child1 but visit its children (leaf1, leaf2)
      const expectedIds = ['root1', 'leaf1', 'leaf2', 'child2', 'leaf3', 'child3'];
      expect(visited).toEqual(expectedIds);
    });

    it('should handle multiple different decisions.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>({
        shouldVisitNodeFunction: (node, value) => {
          if (node.value.id === 'child1') return ExploreTreeVisitNodeDecision.VISIT_NODE_ONLY;
          if (node.value.id === 'child2') return ExploreTreeVisitNodeDecision.VISIT_CHILDREN_ONLY;
          if (node.value.id === 'child3') return ExploreTreeVisitNodeDecision.SKIP_ALL;
          return ExploreTreeVisitNodeDecision.VISIT_ALL;
        }
      });
      const visited: string[] = [];

      exploreFn(root1, (value, node) => {
        visited.push(value.value.id);
      });

      // root1: VISIT_ALL, child1: VISIT_NODE_ONLY (no children), child2: VISIT_CHILDREN_ONLY (skip child2, visit leaf3), child3: SKIP_ALL
      const expectedIds = ['root1', 'child1', 'leaf3'];
      expect(visited).toEqual(expectedIds);
    });

    it('should filter based on node values.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>({
        shouldVisitNodeFunction: (node, value) => ((node.value.value ?? 0) >= 10 ? ExploreTreeVisitNodeDecision.VISIT_ALL : ExploreTreeVisitNodeDecision.SKIP_ALL)
      });
      const visited: string[] = [];

      exploreFn(root1, (value, node) => {
        visited.push(value.value.id);
      });

      // Should visit root1 (100) but skip children with values < 10
      const expectedIds = ['root1'];
      expect(visited).toEqual(expectedIds);
    });
  });

  describe('with runtime override', () => {
    it('should override mapNodeFunction at runtime.', () => {
      const exploreFn = exploreTreeFunction<TestNode, string>({
        mapNodeFunction: (node) => node.value.id
      });
      const visitedDefault: string[] = [];
      const visitedOverride: string[] = [];

      // First call with default mapping (node.value.id)
      exploreFn(root1, (value, node) => {
        visitedDefault.push(value);
      });

      // Second call with runtime override (different string mapping)
      exploreFn(
        root1,
        (value, node) => {
          visitedOverride.push(value);
        },
        {
          mapNodeFunction: (node) => `${node.value.id}-${node.value.value ?? 0}`
        }
      );

      const expectedDefault = ['root1', 'child1', 'leaf1', 'leaf2', 'child2', 'leaf3', 'child3'];
      const expectedOverride = ['root1-100', 'child1-1', 'leaf1-10', 'leaf2-20', 'child2-2', 'leaf3-30', 'child3-3'];
      expect(visitedDefault).toEqual(expectedDefault);
      expect(visitedOverride).toEqual(expectedOverride);
    });

    it('should override shouldVisitNodeFunction at runtime.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>({
        shouldVisitNodeFunction: (node, value) => ExploreTreeVisitNodeDecision.VISIT_ALL
      });

      const visited: string[] = [];

      exploreFn(
        root1,
        (value, node) => {
          visited.push(value.value.id);
        },
        {
          shouldVisitNodeFunction: (node, value) => (node.value.id.startsWith('child') ? ExploreTreeVisitNodeDecision.VISIT_CHILDREN_ONLY : ExploreTreeVisitNodeDecision.VISIT_ALL)
        }
      );

      // Should skip child nodes but visit root and leaf nodes
      const expectedIds = ['root1', 'leaf1', 'leaf2', 'leaf3'];
      expect(visited).toEqual(expectedIds);
    });
  });

  describe('with combined mapNodeFunction and shouldVisitNodeFunction', () => {
    it('should map and filter nodes together.', () => {
      const exploreFn = exploreTreeFunction<TestNode, string>({
        mapNodeFunction: (node) => node.value.id,
        shouldVisitNodeFunction: (node, mappedValue) => (mappedValue.startsWith('leaf') ? ExploreTreeVisitNodeDecision.VISIT_ALL : ExploreTreeVisitNodeDecision.VISIT_CHILDREN_ONLY)
      });
      const visited: string[] = [];

      exploreFn(root1, (value, node) => {
        visited.push(value);
      });

      // Should only visit leaf nodes
      const expectedIds = ['leaf1', 'leaf2', 'leaf3'];
      expect(visited).toEqual(expectedIds);
    });

    it('should use mapped values in visit function.', () => {
      const exploreFn = exploreTreeFunction<TestNode, { id: string; doubled: number }>({
        mapNodeFunction: (node) => ({ id: node.value.id, doubled: (node.value.value ?? 0) * 2 })
      });
      const visited: { id: string; doubled: number }[] = [];

      exploreFn(root1, (value, node) => {
        visited.push(value);
      });

      expect(visited).toEqual([
        { id: 'root1', doubled: 200 },
        { id: 'child1', doubled: 2 },
        { id: 'leaf1', doubled: 20 },
        { id: 'leaf2', doubled: 40 },
        { id: 'child2', doubled: 4 },
        { id: 'leaf3', doubled: 60 },
        { id: 'child3', doubled: 6 }
      ]);
    });
  });

  describe('side effects', () => {
    it('should allow counting nodes.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>();
      let count = 0;

      exploreFn(root1, (value, node) => {
        count++;
      });

      expect(count).toBe(7);
    });

    it('should allow collecting specific node types.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>();
      const leafNodes: TestNode[] = [];

      exploreFn(root1, (value, node) => {
        if (!node.children || node.children.length === 0) {
          leafNodes.push(node);
        }
      });

      expect(leafNodes.length).toBe(4);
      expect(leafNodes.map((n) => n.value.id)).toEqual(['leaf1', 'leaf2', 'leaf3', 'child3']);
    });

    it('should allow modifying external state.', () => {
      const exploreFn = exploreTreeFunction<TestNode, number>({
        mapNodeFunction: (node) => node.value.value ?? 0
      });
      let sum = 0;

      exploreFn(root1, (value, node) => {
        sum += value;
      });

      expect(sum).toBe(100 + 1 + 10 + 20 + 2 + 30 + 3); // 166
    });
  });

  describe('edge cases', () => {
    it('should handle empty array of trees.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>();
      const visited: string[] = [];

      exploreFn([], (value, node) => {
        visited.push(value.value.id);
      });

      expect(visited).toEqual([]);
    });

    it('should handle tree with no children.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>();
      const visited: string[] = [];

      exploreFn(child3, (value, node) => {
        visited.push(value.value.id);
      });

      expect(visited).toEqual(['child3']);
    });

    it('should handle SKIP_ALL on root node.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>({
        shouldVisitNodeFunction: () => ExploreTreeVisitNodeDecision.SKIP_ALL
      });
      const visited: string[] = [];

      exploreFn(root1, (value, node) => {
        visited.push(value.value.id);
      });

      expect(visited).toEqual([]);
    });
  });

  describe('with custom traversal (breadth-first)', () => {
    it('should traverse tree in breadth-first order.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>({
        traverseFunctionFactory: breadthFirstExploreTreeTraversalFactoryFunction()
      });
      const visited: string[] = [];

      exploreFn(root1, (value, node) => {
        visited.push(value.value.id);
      });

      // Breadth-first: root1, then all children (child1, child2, child3), then all grandchildren (leaf1, leaf2, leaf3)
      const expectedIds = ['root1', 'child1', 'child2', 'child3', 'leaf1', 'leaf2', 'leaf3'];
      expect(visited).toEqual(expectedIds);
    });

    it('should traverse multiple trees in breadth-first order.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>({
        traverseFunctionFactory: breadthFirstExploreTreeTraversalFactoryFunction()
      });
      const visited: string[] = [];

      exploreFn([child1, child2], (value, node) => {
        visited.push(value.value.id);
      });

      // Each tree is processed completely in breadth-first order before the next tree
      // child1 tree: child1 (level 0), then leaf1, leaf2 (level 1)
      // child2 tree: child2 (level 0), then leaf3 (level 1)
      const expectedIds = ['child1', 'leaf1', 'leaf2', 'child2', 'leaf3'];
      expect(visited).toEqual(expectedIds);
    });

    it('should respect visit decisions in breadth-first traversal.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>({
        traverseFunctionFactory: breadthFirstExploreTreeTraversalFactoryFunction(),
        shouldVisitNodeFunction: (node, value) => (node.value.id === 'child1' ? ExploreTreeVisitNodeDecision.VISIT_NODE_ONLY : ExploreTreeVisitNodeDecision.VISIT_ALL)
      });
      const visited: string[] = [];

      exploreFn(root1, (value, node) => {
        visited.push(value.value.id);
      });

      // Breadth-first with child1 as VISIT_NODE_ONLY (skip leaf1, leaf2)
      const expectedIds = ['root1', 'child1', 'child2', 'child3', 'leaf3'];
      expect(visited).toEqual(expectedIds);
    });

    it('should override to breadth-first at runtime.', () => {
      const exploreFn = exploreTreeFunction<TestNode, TestNode>();
      const visitedDepthFirst: string[] = [];
      const visitedBreadthFirst: string[] = [];

      // Default depth-first
      exploreFn(root1, (value, node) => {
        visitedDepthFirst.push(value.value.id);
      });

      // Override to breadth-first
      exploreFn(
        root1,
        (value, node) => {
          visitedBreadthFirst.push(value.value.id);
        },
        {
          traverseFunctionFactory: breadthFirstExploreTreeTraversalFactoryFunction()
        }
      );

      const expectedDepthFirst = ['root1', 'child1', 'leaf1', 'leaf2', 'child2', 'leaf3', 'child3'];
      const expectedBreadthFirst = ['root1', 'child1', 'child2', 'child3', 'leaf1', 'leaf2', 'leaf3'];
      expect(visitedDepthFirst).toEqual(expectedDepthFirst);
      expect(visitedBreadthFirst).toEqual(expectedBreadthFirst);
    });
  });
});
