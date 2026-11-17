import { describe, expect, it } from 'vitest';
import { type DbxValueListItem } from '../list.view.value';
import { dbxListItemDropEvent } from './list.drag.drop';

function makeItems(values: string[]): DbxValueListItem<string>[] {
  return values.map((itemValue) => ({ key: itemValue, itemValue }));
}

describe('dbxListItemDropEvent()', () => {
  describe('single group', () => {
    it('should move an item down', () => {
      const items = makeItems(['a', 'b', 'c', 'd']);
      const result = dbxListItemDropEvent<string>({ flatItems: items, groupItems: items, previousGroupIndex: 0, currentGroupIndex: 2 });

      expect(result).toBeDefined();
      expect(result?.value).toBe('a');
      expect(result?.key).toBe('a');
      expect(result?.previousIndex).toBe(0);
      expect(result?.currentIndex).toBe(2);
      expect(result?.values).toEqual(['b', 'c', 'a', 'd']);
    });

    it('should move an item up', () => {
      const items = makeItems(['a', 'b', 'c', 'd']);
      const result = dbxListItemDropEvent<string>({ flatItems: items, groupItems: items, previousGroupIndex: 3, currentGroupIndex: 1 });

      expect(result?.value).toBe('d');
      expect(result?.previousIndex).toBe(3);
      expect(result?.currentIndex).toBe(1);
      expect(result?.values).toEqual(['a', 'd', 'b', 'c']);
    });

    it('should return undefined when nothing moved', () => {
      const items = makeItems(['a', 'b', 'c']);
      const result = dbxListItemDropEvent<string>({ flatItems: items, groupItems: items, previousGroupIndex: 1, currentGroupIndex: 1 });
      expect(result).toBeUndefined();
    });

    it('should return undefined when an index is out of range', () => {
      const items = makeItems(['a', 'b', 'c']);
      expect(dbxListItemDropEvent<string>({ flatItems: items, groupItems: items, previousGroupIndex: 5, currentGroupIndex: 1 })).toBeUndefined();
      expect(dbxListItemDropEvent<string>({ flatItems: items, groupItems: items, previousGroupIndex: 1, currentGroupIndex: 5 })).toBeUndefined();
    });

    it('should return a new values array and not change the input items', () => {
      const items = makeItems(['a', 'b', 'c']);
      const itemsCopy = [...items];
      const result = dbxListItemDropEvent<string>({ flatItems: items, groupItems: items, previousGroupIndex: 0, currentGroupIndex: 2 });

      expect(result?.values).not.toBe(items);
      expect(items).toEqual(itemsCopy);
      expect(items.map((x) => x.itemValue)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('multiple groups', () => {
    it('should map the group indexes to the flat indexes', () => {
      const items = makeItems(['a1', 'b1', 'a2', 'b2', 'a3']);
      const groupA = [items[0], items[2], items[4]];

      // move a3 to the first position of group A
      const result = dbxListItemDropEvent<string>({ flatItems: items, groupItems: groupA, previousGroupIndex: 2, currentGroupIndex: 0 });

      expect(result?.value).toBe('a3');
      expect(result?.previousIndex).toBe(4);
      expect(result?.currentIndex).toBe(0);
      expect(result?.values).toEqual(['a3', 'a1', 'b1', 'a2', 'b2']);
    });

    it('should keep the new order within the group', () => {
      const items = makeItems(['a1', 'b1', 'a2', 'b2', 'a3']);
      const groupB = [items[1], items[3]];

      // move b1 after b2
      const result = dbxListItemDropEvent<string>({ flatItems: items, groupItems: groupB, previousGroupIndex: 0, currentGroupIndex: 1 });

      expect(result?.previousIndex).toBe(1);
      expect(result?.currentIndex).toBe(3);
      expect(result?.values.filter((x) => x.startsWith('b'))).toEqual(['b2', 'b1']);
      expect(result?.values.filter((x) => x.startsWith('a'))).toEqual(['a1', 'a2', 'a3']);
    });

    it('should return undefined when the group items are not in the flat items', () => {
      const items = makeItems(['a', 'b', 'c']);
      const otherGroup = makeItems(['a', 'b']);
      const result = dbxListItemDropEvent<string>({ flatItems: items, groupItems: otherGroup, previousGroupIndex: 0, currentGroupIndex: 1 });
      expect(result).toBeUndefined();
    });
  });
});
