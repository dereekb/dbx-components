import { type TreeNode, type TreeNodeWithoutChildren } from './tree';
import { type ExpandTree, type ExpandTreeWithNodeBuilder, expandTreeFunction, expandTrees } from './tree.expand';
import { type Maybe } from '../value/maybe.type';

interface RawItem {
  id: string;
  childIds?: string[];
  data: any;
}

interface CustomTreeNode extends TreeNode<RawItem, CustomTreeNode> {
  value: RawItem;
  customProperty: string; // Example of a custom property
  children?: CustomTreeNode[];
}

// Test Data: A flat list of items that can be structured into a tree.
const allRawItems: RawItem[] = [
  { id: 'root1', childIds: ['child1A', 'child1B'], data: 'Root 1 Data' },
  { id: 'child1A', childIds: ['grandchild1A1'], data: 'Child 1A Data' },
  { id: 'child1B', data: 'Child 1B Data' }, // No children
  { id: 'grandchild1A1', data: 'Grandchild 1A1 Data' },
  { id: 'root2', childIds: ['child2A'], data: 'Root 2 Data' },
  { id: 'child2A', data: 'Child 2A Data' },
  { id: 'orphan', data: 'Orphan Data' } // Not part of any tree if roots are specified
];

const rawItemsById = new Map(allRawItems.map((item) => [item.id, item]));

// Config for ExpandTree<RawItem>
const basicExpandConfig: ExpandTree<RawItem> = {
  getChildren: (value: RawItem): Maybe<RawItem[]> => {
    return value.childIds?.map((id) => rawItemsById.get(id)!).filter(Boolean) ?? undefined;
  }
};

// Config for ExpandTreeWithNodeBuilder<RawItem, CustomTreeNode>
const customNodeExpandConfig: ExpandTreeWithNodeBuilder<RawItem, CustomTreeNode> = {
  getChildren: basicExpandConfig.getChildren,
  makeNode: (nodeWithoutChildren: TreeNodeWithoutChildren<RawItem, CustomTreeNode>): Omit<CustomTreeNode, 'children'> => {
    return {
      ...nodeWithoutChildren,
      customProperty: `Custom for ${nodeWithoutChildren.value.id}`
    };
  }
};

describe('expandTreeFunction', () => {
  describe('with basic ExpandTree config (default TreeNode output)', () => {
    const expandFn = expandTreeFunction(basicExpandConfig);
    const root1Item = rawItemsById.get('root1')!;

    it('should expand a value into a TreeNode structure.', () => {
      const tree = expandFn(root1Item);
      expect(tree).toBeDefined();
      expect(tree.value).toBe(root1Item);
      expect(tree.depth).toBe(0);
      expect(tree.parent).toBeUndefined();
    });

    it('should correctly link children and set their depth and parent.', () => {
      const tree = expandFn(root1Item);
      expect(tree.children).toBeDefined();
      expect(tree.children?.length).toBe(2);

      const child1A = tree.children?.find((c) => c.value.id === 'child1A');
      expect(child1A).toBeDefined();
      expect(child1A?.value.id).toBe('child1A');
      expect(child1A?.depth).toBe(1);
      expect(child1A?.parent).toBe(tree);
      expect(child1A?.children?.length).toBe(1);

      const grandchild1A1 = child1A?.children?.find((c) => c.value.id === 'grandchild1A1');
      expect(grandchild1A1).toBeDefined();
      expect(grandchild1A1?.value.id).toBe('grandchild1A1');
      expect(grandchild1A1?.depth).toBe(2);
      expect(grandchild1A1?.parent).toBe(child1A);
      expect(grandchild1A1?.children).toBeUndefined(); // No further children defined for it
    });

    it('should handle nodes with no children.', () => {
      const child1BItem = rawItemsById.get('child1B')!;
      const treeNode = expandFn(child1BItem); // Expand child1B which has no children
      expect(treeNode.value).toBe(child1BItem);
      expect(treeNode.children).toBeUndefined();
    });
  });

  describe('with ExpandTreeWithNodeBuilder config (CustomTreeNode output)', () => {
    const expandFn = expandTreeFunction(customNodeExpandConfig);
    const root2Item = rawItemsById.get('root2')!;

    it('should expand a value into a CustomTreeNode structure with custom properties.', () => {
      const tree = expandFn(root2Item);
      expect(tree).toBeDefined();
      expect(tree.value).toBe(root2Item);
      expect(tree.depth).toBe(0);
    });

    it('should correctly link children as CustomTreeNodes.', () => {
      const tree = expandFn(root2Item);
      expect(tree.children).toBeDefined();
      expect(tree.children?.length).toBe(1);

      const child2A = tree.children?.[0];
      expect(child2A).toBeDefined();
      expect(child2A?.value.id).toBe('child2A');
      expect(child2A?.depth).toBe(1);
      expect(child2A?.parent).toBe(tree);
      expect(child2A?.children).toBeUndefined();
    });
  });
});

describe('expandTrees', () => {
  it('should expand an array of root values into an array of trees using basic config.', () => {
    const expandBasicFn = expandTreeFunction(basicExpandConfig);
    const rootsToExpand = [rawItemsById.get('root1')!, rawItemsById.get('root2')!];
    const trees = expandTrees(rootsToExpand, expandBasicFn);

    expect(trees.length).toBe(2);
    expect(trees[0].value.id).toBe('root1');
    expect(trees[1].value.id).toBe('root2');
    expect(trees[0].children?.length).toBe(2);
    expect(trees[1].children?.length).toBe(1);
  });

  it('should return an empty array if the input values array is empty.', () => {
    const expandBasicFn = expandTreeFunction(basicExpandConfig);
    const trees = expandTrees([], expandBasicFn);
    expect(trees).toEqual([]);
  });
});
