import { type TreeNode } from './tree';
import { FlattenTreeAddNodeDecision, flattenTree, flattenTreeToArray, flattenTreeToArrayFunction, flattenTrees } from './tree.flatten';
import { breadthFirstExploreTreeTraversalFactoryFunction } from './tree.explore';

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

describe('flattenTree()', () => {
  it('should flatten a single node tree.', () => {
    const result = flattenTree(singleNodeTree);
    expect(result).toEqual([singleNodeTree]);
  });

  it('should flatten a complex tree into an array of nodes.', () => {
    const result = flattenTree(root1);
    const expectedNodes = [root1, child1, leaf1, leaf2, child2, leaf3, child3];
    expect(result.length).toBe(expectedNodes.length);
    expectedNodes.forEach((node) => expect(result).toContain(node));
  });

  it('should handle trees with nodes that have no children.', () => {
    const treeWithEmptyChild = createTestNode('root', 0, [createTestNode('childWithNoGrandchildren')]);
    const result = flattenTree(treeWithEmptyChild);
    expect(result.length).toBe(2);
    expect(result).toEqual([treeWithEmptyChild, treeWithEmptyChild.children![0]]);
  });

  describe('with addNodeFn', () => {
    it('should add all nodes when addNodeFn returns ADD_ALL.', () => {
      const addNodeFn = () => FlattenTreeAddNodeDecision.ADD_ALL;
      const result = flattenTree(root1, addNodeFn);
      const expectedNodes = [root1, child1, leaf1, leaf2, child2, leaf3, child3];
      expect(result).toEqual(expectedNodes);
    });

    it('should skip node and children when addNodeFn returns SKIP_ALL.', () => {
      const addNodeFn = (node: TestNode) => (node.value.id === 'child1' ? FlattenTreeAddNodeDecision.SKIP_ALL : FlattenTreeAddNodeDecision.ADD_ALL);
      const result = flattenTree(root1, addNodeFn);
      // Should skip child1 and its children (leaf1, leaf2)
      const expectedNodes = [root1, child2, leaf3, child3];
      expect(result).toEqual(expectedNodes);
    });

    it('should add node only when addNodeFn returns ADD_NODE_ONLY.', () => {
      const addNodeFn = (node: TestNode) => (node.value.id === 'child1' ? FlattenTreeAddNodeDecision.ADD_NODE_ONLY : FlattenTreeAddNodeDecision.ADD_ALL);
      const result = flattenTree(root1, addNodeFn);
      // Should include child1 but skip its children (leaf1, leaf2)
      const expectedNodes = [root1, child1, child2, leaf3, child3];
      expect(result).toEqual(expectedNodes);
    });

    it('should skip node but add children when addNodeFn returns ADD_CHILDREN_ONLY.', () => {
      const addNodeFn = (node: TestNode) => (node.value.id === 'child1' ? FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY : FlattenTreeAddNodeDecision.ADD_ALL);
      const result = flattenTree(root1, addNodeFn);
      // Should skip child1 but include its children (leaf1, leaf2)
      const expectedNodes = [root1, leaf1, leaf2, child2, leaf3, child3];
      expect(result).toEqual(expectedNodes);
    });

    it('should handle multiple nodes with different decisions.', () => {
      const addNodeFn = (node: TestNode) => {
        if (node.value.id === 'child1') return FlattenTreeAddNodeDecision.ADD_NODE_ONLY;
        if (node.value.id === 'child2') return FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY;
        if (node.value.id === 'child3') return FlattenTreeAddNodeDecision.SKIP_ALL;
        return FlattenTreeAddNodeDecision.ADD_ALL;
      };
      const result = flattenTree(root1, addNodeFn);
      // root1: ADD_ALL, child1: ADD_NODE_ONLY (skip leaf1, leaf2), child2: ADD_CHILDREN_ONLY (skip child2, add leaf3), child3: SKIP_ALL
      const expectedNodes = [root1, child1, leaf3];
      expect(result).toEqual(expectedNodes);
    });

    it('should filter based on node value property.', () => {
      const addNodeFn = (node: TestNode) => ((node.value.value ?? 0) >= 10 ? FlattenTreeAddNodeDecision.ADD_ALL : FlattenTreeAddNodeDecision.SKIP_ALL);
      const result = flattenTree(root1, addNodeFn);
      // Should include root1 (100) but skip children with values < 10
      const expectedNodes = [root1];
      expect(result).toEqual(expectedNodes);
    });

    it('should allow children to be added even when parent uses ADD_CHILDREN_ONLY.', () => {
      const addNodeFn = (node: TestNode) => (node.value.id === 'root1' ? FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY : FlattenTreeAddNodeDecision.ADD_ALL);
      const result = flattenTree(root1, addNodeFn);
      // Should skip root1 but include all its descendants
      const expectedNodes = [child1, leaf1, leaf2, child2, leaf3, child3];
      expect(result).toEqual(expectedNodes);
    });
  });
});

describe('flattenTreeToArray()', () => {
  it('should flatten a tree into a given array.', () => {
    const initialArray: TestNode[] = [createTestNode('existing')];
    const result = flattenTreeToArray(root1, initialArray);
    const expectedNodes = [createTestNode('existing'), root1, child1, leaf1, leaf2, child2, leaf3, child3];

    expect(result.length).toBe(expectedNodes.length);
    // Check for presence rather than exact order initially, as flatten appends.
    expectedNodes.forEach((node) => {
      const found = result.find((r) => r.value.id === node.value.id);
      expect(found).toBeDefined();
      if (found && node.value.value !== undefined) {
        expect(found.value.value).toBe(node.value.value);
      }
    });
    expect(result[0].value.id).toBe('existing'); // First element should be the initial one
  });
});

describe('flattenTreeToArrayFunction()', () => {
  describe('without mapNodeFn', () => {
    it('should flatten tree nodes into an array.', () => {
      const flattenFn = flattenTreeToArrayFunction<TestNode>();
      const result = flattenFn(root1);
      const expectedNodes = [root1, child1, leaf1, leaf2, child2, leaf3, child3];
      expect(result.length).toBe(expectedNodes.length);
      expectedNodes.forEach((node) => expect(result).toContain(node));
    });
  });

  describe('with mapNodeFn', () => {
    it('should flatten tree nodes into an array of mapped values (e.g., node.value.id).', () => {
      const mapFn = (node: TestNode) => node.value.id;
      const flattenFn = flattenTreeToArrayFunction<TestNode, string>(mapFn);
      const result = flattenFn(root1);
      const expectedIds = ['root1', 'child1', 'leaf1', 'leaf2', 'child2', 'leaf3', 'child3'];
      expect(result).toEqual(expectedIds);
    });

    it('should flatten tree nodes into an array of mapped values (e.g., node.value).', () => {
      const mapFn = (node: TestNode) => node.value;
      const flattenFn = flattenTreeToArrayFunction<TestNode, TestNodeValue>(mapFn);
      const result = flattenFn(root1);
      const expectedValues: TestNodeValue[] = [
        { id: 'root1', value: 100 },
        { id: 'child1', value: 1 },
        { id: 'leaf1', value: 10 },
        { id: 'leaf2', value: 20 },
        { id: 'child2', value: 2 },
        { id: 'leaf3', value: 30 },
        { id: 'child3', value: 3 }
      ];
      expect(result).toEqual(expectedValues);
    });
  });

  describe('with addNodeFn', () => {
    it('should filter nodes based on addNodeFn with mapped values.', () => {
      const mapFn = (node: TestNode) => node.value.id;
      const flattenFn = flattenTreeToArrayFunction<TestNode, string>(mapFn);
      const addNodeFn = (node: TestNode, mappedValue: string) => (mappedValue.startsWith('child') ? FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY : FlattenTreeAddNodeDecision.ADD_ALL);
      const result = flattenFn(root1, [], addNodeFn);
      // Should skip child nodes but include root and leaf nodes
      const expectedIds = ['root1', 'leaf1', 'leaf2', 'leaf3'];
      expect(result).toEqual(expectedIds);
    });

    it('should use ADD_NODE_ONLY to prevent traversal of children.', () => {
      const mapFn = (node: TestNode) => node.value.value ?? 0;
      const flattenFn = flattenTreeToArrayFunction<TestNode, number>(mapFn);
      const addNodeFn = (node: TestNode, mappedValue: number) => (mappedValue < 10 ? FlattenTreeAddNodeDecision.ADD_NODE_ONLY : FlattenTreeAddNodeDecision.ADD_ALL);
      const result = flattenFn(root1, [], addNodeFn);
      // Should include root1 (100), child1 (1) but not its children, child2 (2) but not its children, child3 (3)
      const expectedValues = [100, 1, 2, 3];
      expect(result).toEqual(expectedValues);
    });

    it('should use defaultAddNodeFn when provided to factory.', () => {
      const mapFn = (node: TestNode) => node.value.id;
      const defaultAddNodeFn = (node: TestNode, mappedValue: string) => (mappedValue.includes('child') ? FlattenTreeAddNodeDecision.SKIP_ALL : FlattenTreeAddNodeDecision.ADD_ALL);
      const flattenFn = flattenTreeToArrayFunction<TestNode, string>(mapFn, defaultAddNodeFn);
      const result = flattenFn(root1);
      // Should skip child nodes and their children
      const expectedIds = ['root1'];
      expect(result).toEqual(expectedIds);
    });

    it('should override defaultAddNodeFn with runtime addNodeFn.', () => {
      const mapFn = (node: TestNode) => node.value.id;
      const defaultAddNodeFn = (node: TestNode, mappedValue: string) => (mappedValue.includes('child') ? FlattenTreeAddNodeDecision.SKIP_ALL : FlattenTreeAddNodeDecision.ADD_ALL);
      const flattenFn = flattenTreeToArrayFunction<TestNode, string>(mapFn, defaultAddNodeFn);
      const runtimeAddNodeFn = (node: TestNode, mappedValue: string) => (mappedValue.startsWith('leaf') ? FlattenTreeAddNodeDecision.ADD_ALL : FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY);
      const result = flattenFn(root1, [], runtimeAddNodeFn);
      // Should use runtime function: skip root1, child1, child2, child3 but include leaf nodes
      const expectedIds = ['leaf1', 'leaf2', 'leaf3'];
      expect(result).toEqual(expectedIds);
    });

    it('should handle complex filtering with mapped values.', () => {
      const mapFn = (node: TestNode) => node.value;
      const flattenFn = flattenTreeToArrayFunction<TestNode, TestNodeValue>(mapFn);
      const addNodeFn = (node: TestNode, mappedValue: TestNodeValue) => {
        if (mappedValue.id === 'child1') return FlattenTreeAddNodeDecision.ADD_NODE_ONLY;
        if (mappedValue.id === 'child2') return FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY;
        return FlattenTreeAddNodeDecision.ADD_ALL;
      };
      const result = flattenFn(root1, [], addNodeFn);
      // root1: ADD_ALL, child1: ADD_NODE_ONLY (no leaf1, leaf2), child2: ADD_CHILDREN_ONLY (no child2, yes leaf3), child3: ADD_ALL
      const expectedValues: TestNodeValue[] = [
        { id: 'root1', value: 100 },
        { id: 'child1', value: 1 },
        { id: 'leaf3', value: 30 },
        { id: 'child3', value: 3 }
      ];
      expect(result).toEqual(expectedValues);
    });

    it('should allow filtering based on both node and mapped value.', () => {
      const mapFn = (node: TestNode) => `${node.value.id}-${node.value.value ?? 0}`;
      const flattenFn = flattenTreeToArrayFunction<TestNode, string>(mapFn);
      const addNodeFn = (node: TestNode, mappedValue: string) => {
        const value = node.value.value ?? 0;
        if (value >= 100) return FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY;
        if (value >= 10) return FlattenTreeAddNodeDecision.ADD_ALL;
        if (value < 10 && node.children && node.children.length > 0) return FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY;
        return FlattenTreeAddNodeDecision.SKIP_ALL;
      };
      const result = flattenFn(root1, [], addNodeFn);
      // root1 (100): ADD_CHILDREN_ONLY, child1/2/3 (<10 with children): ADD_CHILDREN_ONLY, leaf1/2/3 (>=10): ADD_ALL
      const expectedIds = ['leaf1-10', 'leaf2-20', 'leaf3-30'];
      expect(result).toEqual(expectedIds);
    });
  });

  describe('with config object', () => {
    it('should create flatten function with config object.', () => {
      const flattenFn = flattenTreeToArrayFunction<TestNode, string>({
        mapNodeFunction: (node) => node.value.id
      });
      const result = flattenFn(root1);
      const expectedIds = ['root1', 'child1', 'leaf1', 'leaf2', 'child2', 'leaf3', 'child3'];
      expect(result).toEqual(expectedIds);
    });

    it('should use shouldAddNodeFunction from config.', () => {
      const flattenFn = flattenTreeToArrayFunction<TestNode, string>({
        mapNodeFunction: (node) => node.value.id,
        shouldAddNodeFunction: (node, mappedValue) => (mappedValue.startsWith('child') ? FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY : FlattenTreeAddNodeDecision.ADD_ALL)
      });
      const result = flattenFn(root1);
      // Should skip child nodes but include root and leaf nodes
      const expectedIds = ['root1', 'leaf1', 'leaf2', 'leaf3'];
      expect(result).toEqual(expectedIds);
    });

    it('should support traverseFunctionFactory in config.', () => {
      const flattenFn = flattenTreeToArrayFunction<TestNode, string>({
        mapNodeFunction: (node) => node.value.id,
        traverseFunctionFactory: breadthFirstExploreTreeTraversalFactoryFunction()
      });
      const result = flattenFn(root1);
      // Breadth-first order
      const expectedIds = ['root1', 'child1', 'child2', 'child3', 'leaf1', 'leaf2', 'leaf3'];
      expect(result).toEqual(expectedIds);
    });

    it('should combine config options.', () => {
      const flattenFn = flattenTreeToArrayFunction<TestNode, number>({
        mapNodeFunction: (node) => node.value.value ?? 0,
        shouldAddNodeFunction: (node, mappedValue) => (mappedValue >= 10 ? FlattenTreeAddNodeDecision.ADD_ALL : FlattenTreeAddNodeDecision.SKIP_ALL),
        traverseFunctionFactory: breadthFirstExploreTreeTraversalFactoryFunction()
      });
      const result = flattenFn(root1);
      // Breadth-first with filtering: root1 (100) passes, children fail (< 10)
      const expectedValues = [100];
      expect(result).toEqual(expectedValues);
    });

    it('should allow runtime override of config.', () => {
      const flattenFn = flattenTreeToArrayFunction<TestNode, string>({
        mapNodeFunction: (node) => node.value.id,
        shouldAddNodeFunction: (node, mappedValue) => FlattenTreeAddNodeDecision.ADD_ALL
      });
      const runtimeAddNodeFn = (node: TestNode, mappedValue: string) => (mappedValue.startsWith('leaf') ? FlattenTreeAddNodeDecision.ADD_ALL : FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY);
      const result = flattenFn(root1, [], runtimeAddNodeFn);
      // Runtime override: skip non-leaf nodes
      const expectedIds = ['leaf1', 'leaf2', 'leaf3'];
      expect(result).toEqual(expectedIds);
    });

    it('should work with empty config.', () => {
      const flattenFn = flattenTreeToArrayFunction<TestNode, TestNode>({});
      const result = flattenFn(root1);
      // Should use identity mapping and visit all nodes
      const expectedNodes = [root1, child1, leaf1, leaf2, child2, leaf3, child3];
      expect(result).toEqual(expectedNodes);
    });
  });
});

describe('flattenTrees()', () => {
  it('should flatten an array of trees into a single array of nodes.', () => {
    const trees = [root1, root2];
    const flattenNodeFn = flattenTreeToArrayFunction<TestNode>();
    const result = flattenTrees(trees, flattenNodeFn);
    const expectedNodes = [
      root1,
      child1,
      leaf1,
      leaf2,
      child2,
      leaf3,
      child3, // from root1
      root2,
      leaf4 // from root2
    ];
    expect(result.length).toBe(expectedNodes.length);
    expectedNodes.forEach((node) => expect(result).toContain(node));
  });

  it('should return an empty array if given an empty array of trees.', () => {
    const trees: TestNode[] = [];
    const flattenNodeFn = flattenTreeToArrayFunction<TestNode>();
    const result = flattenTrees(trees, flattenNodeFn);
    expect(result).toEqual([]);
  });

  it('should flatten an array of trees using a mapping function.', () => {
    const trees = [child1, child2]; // Smaller trees for simplicity
    const mapFn = (node: TestNode) => node.value.id;
    const flattenMappedFn = flattenTreeToArrayFunction<TestNode, string>(mapFn);
    const result = flattenTrees(trees, flattenMappedFn);
    const expectedIds = [
      'child1',
      'leaf1',
      'leaf2', // from child1
      'child2',
      'leaf3' // from child2
    ];
    expect(result).toEqual(expectedIds);
  });

  describe('with addNodeFn', () => {
    it('should filter nodes across multiple trees using addNodeFn.', () => {
      const trees = [root1, root2];
      const flattenNodeFn = flattenTreeToArrayFunction<TestNode>();
      const addNodeFn = (node: TestNode) => ((node.value.value ?? 0) >= 10 ? FlattenTreeAddNodeDecision.ADD_ALL : FlattenTreeAddNodeDecision.SKIP_ALL);
      const result = flattenTrees(trees, flattenNodeFn, addNodeFn);
      // Should include nodes with value >= 10: root1 (100), root2 (200), leaf4 (40)
      // child1, child2, child3 are filtered out along with their children
      const expectedNodes = [root1, root2, leaf4];
      expect(result.length).toBe(expectedNodes.length);
      expectedNodes.forEach((node) => expect(result).toContain(node));
    });

    it('should filter mapped values across multiple trees.', () => {
      const trees = [child1, child2];
      const mapFn = (node: TestNode) => node.value.id;
      const flattenMappedFn = flattenTreeToArrayFunction<TestNode, string>(mapFn);
      const addNodeFn = (node: TestNode, mappedValue: string) => (mappedValue.startsWith('leaf') ? FlattenTreeAddNodeDecision.ADD_ALL : FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY);
      const result = flattenTrees(trees, flattenMappedFn, addNodeFn);
      // Should skip child nodes but include leaf nodes
      const expectedIds = ['leaf1', 'leaf2', 'leaf3'];
      expect(result).toEqual(expectedIds);
    });

    it('should return empty array when all nodes are filtered out.', () => {
      const trees = [root1, root2];
      const flattenNodeFn = flattenTreeToArrayFunction<TestNode>();
      const addNodeFn = () => FlattenTreeAddNodeDecision.SKIP_ALL;
      const result = flattenTrees(trees, flattenNodeFn, addNodeFn);
      expect(result).toEqual([]);
    });

    it('should apply addNodeFn independently to each tree.', () => {
      const trees = [root1, root2];
      const mapFn = (node: TestNode) => node.value.id;
      const flattenMappedFn = flattenTreeToArrayFunction<TestNode, string>(mapFn);
      const addNodeFn = (node: TestNode, mappedValue: string) => {
        if (mappedValue.includes('root')) return FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY;
        if (mappedValue === 'leaf4') return FlattenTreeAddNodeDecision.ADD_ALL;
        return FlattenTreeAddNodeDecision.SKIP_ALL;
      };
      const result = flattenTrees(trees, flattenMappedFn, addNodeFn);
      // Should skip root1, root2 (ADD_CHILDREN_ONLY) but traverse their children, include leaf4 (ADD_ALL)
      const expectedIds = ['leaf4'];
      expect(result).toEqual(expectedIds);
    });

    it('should handle complex filtering with ADD_CHILDREN_ONLY across trees.', () => {
      const trees = [child1, child2];
      const flattenNodeFn = flattenTreeToArrayFunction<TestNode>();
      const addNodeFn = (node: TestNode) => {
        if (node.value.id === 'child1') return FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY;
        if (node.value.id === 'child2') return FlattenTreeAddNodeDecision.ADD_NODE_ONLY;
        return FlattenTreeAddNodeDecision.ADD_ALL;
      };
      const result = flattenTrees(trees, flattenNodeFn, addNodeFn);
      // child1: ADD_CHILDREN_ONLY (skip child1, add leaf1, leaf2), child2: ADD_NODE_ONLY (add child2, skip leaf3)
      const expectedNodes = [leaf1, leaf2, child2];
      expect(result).toEqual(expectedNodes);
    });

    it('should combine defaultAddNodeFn and runtime addNodeFn across trees.', () => {
      const trees = [root1, root2];
      const mapFn = (node: TestNode) => node.value.value ?? 0;
      const defaultAddNodeFn = (node: TestNode, mappedValue: number) => (mappedValue >= 50 ? FlattenTreeAddNodeDecision.ADD_ALL : FlattenTreeAddNodeDecision.SKIP_ALL);
      const flattenMappedFn = flattenTreeToArrayFunction<TestNode, number>(mapFn, defaultAddNodeFn);
      const runtimeAddNodeFn = (node: TestNode, mappedValue: number) => (mappedValue >= 100 ? FlattenTreeAddNodeDecision.ADD_CHILDREN_ONLY : FlattenTreeAddNodeDecision.ADD_ALL);
      const result = flattenTrees(trees, flattenMappedFn, runtimeAddNodeFn);
      // root1 (100): ADD_CHILDREN_ONLY, root2 (200): ADD_CHILDREN_ONLY, others: ADD_ALL
      // Should skip root1 and root2 but include their children
      const expectedValues = [1, 10, 20, 2, 30, 3, 40];
      expect(result).toEqual(expectedValues);
    });
  });
});
