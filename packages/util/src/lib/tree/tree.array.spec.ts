import { type TreeNode } from './tree';
import { type ExpandTree, expandTreeFunction } from './tree.expand';
import { flattenTreeToArrayFunction } from './tree.flatten';
import { expandFlattenTreeFunction } from './tree.array';
import { type Maybe } from '../value/maybe.type';

interface TestItem {
  id: string;
  childIds?: string[];
}

const allItems: TestItem[] = [{ id: 'root', childIds: ['a', 'b'] }, { id: 'a', childIds: ['a1'] }, { id: 'b' }, { id: 'a1' }];

const itemsById = new Map(allItems.map((item) => [item.id, item]));

const expandConfig: ExpandTree<TestItem> = {
  getChildren: (value: TestItem): Maybe<TestItem[]> => {
    return value.childIds?.map((id) => itemsById.get(id)!).filter(Boolean) ?? undefined;
  }
};

describe('expandFlattenTreeFunction()', () => {
  it('should expand input values into trees and flatten them into a single array', () => {
    const expand = expandTreeFunction(expandConfig);
    const flatten = flattenTreeToArrayFunction<TreeNode<TestItem>, string>((node) => node.value.id);
    const expandFlatten = expandFlattenTreeFunction(expand, flatten);

    const result = expandFlatten([itemsById.get('root')!]);
    expect(result).toEqual(['root', 'a', 'a1', 'b']);
  });

  it('should return an empty array when given an empty input', () => {
    const expand = expandTreeFunction(expandConfig);
    const flatten = flattenTreeToArrayFunction<TreeNode<TestItem>, string>((node) => node.value.id);
    const expandFlatten = expandFlattenTreeFunction(expand, flatten);

    const result = expandFlatten([]);
    expect(result).toEqual([]);
  });

  it('should handle multiple root values', () => {
    const expand = expandTreeFunction(expandConfig);
    const flatten = flattenTreeToArrayFunction<TreeNode<TestItem>, string>((node) => node.value.id);
    const expandFlatten = expandFlattenTreeFunction(expand, flatten);

    const result = expandFlatten([itemsById.get('a')!, itemsById.get('b')!]);
    expect(result).toEqual(['a', 'a1', 'b']);
  });

  it('should flatten to node values instead of IDs', () => {
    const expand = expandTreeFunction(expandConfig);
    const flatten = flattenTreeToArrayFunction<TreeNode<TestItem>, TestItem>((node) => node.value);
    const expandFlatten = expandFlattenTreeFunction(expand, flatten);

    const result = expandFlatten([itemsById.get('b')!]);
    expect(result).toEqual([{ id: 'b' }]);
  });
});
