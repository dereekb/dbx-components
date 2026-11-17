import { pruneTreesFunction } from './tree.prune';

interface TestItem {
  readonly id: string;
  readonly at: number;
  readonly parent?: string;
  readonly group?: string;
  readonly failed?: boolean;
}

const pruneTestItems = pruneTreesFunction<TestItem>({
  readId: (x) => x.id,
  readParentId: (x) => x.parent,
  readOrder: (x) => x.at,
  readRootGroup: (x) => x.group,
  isPreferredLeaf: (x) => !x.failed
});

function item(id: string, at: number, parent?: string): TestItem {
  return { id, at, parent };
}

function keptIds(items: TestItem[], limits?: { readonly maxRoots?: number; readonly maxLeaves?: number; readonly pinnedIds?: string[] }): string[] {
  return pruneTestItems({ items, ...limits })
    .keep.map((x) => x.id)
    .sort();
}

describe('pruneTreesFunction()', () => {
  it('should keep everything without limits', () => {
    const items = [item('a', 1), item('b', 2, 'a'), item('c', 3, 'b')];
    const result = pruneTestItems({ items });
    expect(result.keep).toEqual(items);
    expect(result.remove).toEqual([]);
  });

  it('should keep every root up to the limit with the path to its newest leaf, and remove older leaves oldest first', () => {
    const items: TestItem[] = [];

    for (const i of [1, 2, 3]) {
      items.push(item(`r${i}`, i * 100), item(`m${i}`, i * 100 + 10, `r${i}`), item(`l${i}old`, i * 100 + 20, `m${i}`), item(`l${i}new`, i * 100 + 30, `m${i}`));
    }

    expect(keptIds(items, { maxRoots: 3, maxLeaves: 3 })).toEqual(['l1new', 'l2new', 'l3new', 'm1', 'm2', 'm3', 'r1', 'r2', 'r3']);
  });

  it('should keep the path to each kept root newest leaf even past the leaf limit', () => {
    const items = [item('r1', 100), item('l1', 110, 'r1'), item('r2', 200), item('l2', 210, 'r2')];
    expect(keptIds(items, { maxRoots: 3, maxLeaves: 1 })).toEqual(['l1', 'l2', 'r1', 'r2']);
  });

  it('should remove the oldest roots past the root limit, with their descendants', () => {
    const items = [item('r1', 100), item('c1', 110, 'r1'), item('r2', 200), item('r3', 300), item('r4', 400)];
    expect(keptIds(items, { maxRoots: 3 })).toEqual(['r2', 'r3', 'r4']);
  });

  it("should remove a leaf's parent once it is the oldest leaf, so no kept item loses its parent", () => {
    const items = [item('r', 1), item('m1', 10, 'r'), item('l1', 15, 'm1'), item('m2', 20, 'r'), item('m3', 30, 'r'), item('m4', 40, 'r'), item('l4', 45, 'm4')];

    // leaves l1, m2, m3, l4: removing l1 leaves m1 as the oldest leaf, which goes next
    expect(keptIds(items, { maxRoots: 3, maxLeaves: 3 })).toEqual(['l4', 'm2', 'm3', 'm4', 'r']);
  });

  it('should always keep the pinned items with their ancestors', () => {
    const items = [item('r1', 100), item('c1', 110, 'r1'), item('r2', 200), item('r3', 300)];
    expect(keptIds(items, { maxRoots: 1, maxLeaves: 1, pinnedIds: ['c1'] })).toEqual(['c1', 'r1', 'r3']);
  });

  it('should protect the newest preferred leaf over a newer one that is not preferred', () => {
    const items = [item('r', 1), item('m', 10, 'r'), item('ok', 20, 'm'), { ...item('failed', 30, 'm'), failed: true }];
    expect(keptIds(items, { maxRoots: 3, maxLeaves: 1 })).toEqual(['m', 'ok', 'r']);
  });

  it('should treat an item whose parent is not in the list as a root', () => {
    const items = [item('orphan', 100, 'missing'), item('r', 200)];
    expect(keptIds(items, { maxRoots: 2 })).toEqual(['orphan', 'r']);
    expect(keptIds(items, { maxRoots: 1 })).toEqual(['r']);
  });

  it('should limit each root group on its own', () => {
    const items: TestItem[] = [
      { id: 'a1', at: 1, group: 'a' },
      { id: 'a2', at: 2, group: 'a' },
      { id: 'b1', at: 3, group: 'b' },
      { id: 'b2', at: 4, group: 'b' }
    ];

    expect(keptIds(items, { maxRoots: 1 })).toEqual(['a2', 'b2']);
  });

  it('should break order ties by list position, with later items newer', () => {
    const items = [item('first', 1), item('second', 1)];
    expect(keptIds(items, { maxRoots: 1 })).toEqual(['second']);
  });

  it('should return both lists in the input order', () => {
    const items = [item('r2', 200), item('r1', 100), item('r3', 300)];
    const result = pruneTestItems({ items, maxRoots: 2 });
    expect(result.keep.map((x) => x.id)).toEqual(['r2', 'r3']);
    expect(result.remove.map((x) => x.id)).toEqual(['r1']);
  });

  it('should not loop on a parent cycle', () => {
    const items = [item('x', 1, 'y'), item('y', 2, 'x'), item('r', 3)];
    expect(keptIds(items, { maxRoots: 5, maxLeaves: 5, pinnedIds: ['x'] })).toEqual(['r', 'x', 'y']);
  });
});
