import { type TreeNode } from './tree';
import { flattenTree, flattenTreeToArray, flattenTreeToArrayFunction, flattenTrees } from './tree.flatten';

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
});
