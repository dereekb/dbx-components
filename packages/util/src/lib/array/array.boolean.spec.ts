import { readBooleanKeySafetyWrap, isFalseBooleanKeyArray, isTrueBooleanKeyArray, insertIntoBooleanKeyArray, removeFromBooleanKeyArray, removeByKeyFromBooleanKeyArray, booleanKeyArrayUtility, BooleanStringKeyArrayUtility, type BooleanKeyArray, type BooleanStringKey } from './array.boolean';

describe('Array Boolean Functions', () => {
  // Test objects
  type TestItem = {
    id: string;
  };

  const testKeyFn = (item: TestItem) => item.id;
  const safetyWrappedKeyFn = readBooleanKeySafetyWrap(testKeyFn);

  // Test data
  const item1 = { id: '1' };
  const item2 = { id: '2' };
  const item3 = { id: '3' };
  const itemWithEmptyKey = { id: '' };

  describe('readBooleanKeySafetyWrap', () => {
    it('should return the key when key is not empty', () => {
      expect(safetyWrappedKeyFn(item1)).toBe('1');
    });

    it('should throw error when key is empty string', () => {
      expect(() => safetyWrappedKeyFn(itemWithEmptyKey)).toThrow('Cannot use "empty" string for BooleanKey.');
    });
  });

  describe('isFalseBooleanKeyArray', () => {
    it('should return true for undefined array', () => {
      expect(isFalseBooleanKeyArray(undefined)).toBe(true);
    });

    it('should return true for empty array', () => {
      expect(isFalseBooleanKeyArray([])).toBe(true);
    });

    it('should return false for non-empty array', () => {
      expect(isFalseBooleanKeyArray(['test'])).toBe(false);
    });
  });

  describe('isTrueBooleanKeyArray', () => {
    it('should return false for undefined array', () => {
      expect(isTrueBooleanKeyArray(undefined)).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(isTrueBooleanKeyArray([])).toBe(false);
    });

    it('should return true for non-empty array', () => {
      expect(isTrueBooleanKeyArray(['test'])).toBe(true);
    });
  });

  describe('insertIntoBooleanKeyArray', () => {
    it('should create a new array with the item if array is undefined', () => {
      const result = insertIntoBooleanKeyArray<TestItem>(undefined, item1, testKeyFn);
      expect(result).toEqual([item1]);
    });

    it('should add item to empty array', () => {
      const result = insertIntoBooleanKeyArray<TestItem>([], item1, testKeyFn);
      expect(result).toEqual([item1]);
    });

    it('should add new item to existing array', () => {
      const array: BooleanKeyArray<TestItem> = [item1];
      const result = insertIntoBooleanKeyArray<TestItem>(array, item2, testKeyFn);
      expect(result).toEqual([item1, item2]);
    });

    it('should replace existing item with same key', () => {
      const array: BooleanKeyArray<TestItem> = [item1, item2];
      const newItem1 = { id: '1', updated: true } as any;
      const result = insertIntoBooleanKeyArray<TestItem>(array, newItem1, testKeyFn);
      expect(result).toEqual([item2, newItem1]);
      expect(result).toHaveLength(2);
    });

    it('should throw error when trying to insert item with empty key', () => {
      expect(() => insertIntoBooleanKeyArray<TestItem>([], itemWithEmptyKey, testKeyFn)).toThrow();
    });
  });

  describe('removeFromBooleanKeyArray', () => {
    it('should return undefined if array is undefined', () => {
      const result = removeFromBooleanKeyArray<TestItem>(undefined, item1, testKeyFn);
      expect(result).toBe(undefined);
    });

    it('should return empty array if array is empty', () => {
      const result = removeFromBooleanKeyArray<TestItem>([], item1, testKeyFn);
      expect(result).toEqual([]);
    });

    it('should remove item with matching key', () => {
      const array: BooleanKeyArray<TestItem> = [item1, item2];
      const result = removeFromBooleanKeyArray<TestItem>(array, item1, testKeyFn);
      expect(result).toEqual([item2]);
    });

    it('should remove item with matching key even if object reference is different', () => {
      const array: BooleanKeyArray<TestItem> = [item1, item2];
      const similarItem1 = { id: '1' };
      const result = removeFromBooleanKeyArray<TestItem>(array, similarItem1, testKeyFn);
      expect(result).toEqual([item2]);
    });

    it('should not modify array if item with key is not found', () => {
      const array: BooleanKeyArray<TestItem> = [item1, item2];
      const result = removeFromBooleanKeyArray<TestItem>(array, item3, testKeyFn);
      expect(result).toEqual([item1, item2]);
    });
  });

  describe('removeByKeyFromBooleanKeyArray', () => {
    it('should return undefined if array is undefined', () => {
      const result = removeByKeyFromBooleanKeyArray<TestItem>(undefined, '1', testKeyFn);
      expect(result).toBe(undefined);
    });

    it('should return empty array if array is empty', () => {
      const result = removeByKeyFromBooleanKeyArray<TestItem>([], '1', testKeyFn);
      expect(result).toEqual([]);
    });

    it('should remove item with matching key', () => {
      const array: BooleanKeyArray<TestItem> = [item1, item2];
      const result = removeByKeyFromBooleanKeyArray<TestItem>(array, '1', testKeyFn);
      expect(result).toEqual([item2]);
    });

    it('should not modify array if key is not found', () => {
      const array: BooleanKeyArray<TestItem> = [item1, item2];
      const result = removeByKeyFromBooleanKeyArray<TestItem>(array, '3', testKeyFn);
      expect(result).toEqual([item1, item2]);
    });
  });

  describe('booleanKeyArrayUtility', () => {
    const utility = booleanKeyArrayUtility<TestItem>(testKeyFn);

    describe('isFalse', () => {
      it('should return true for undefined array', () => {
        expect(utility.isFalse(undefined)).toBe(true);
      });

      it('should return true for empty array', () => {
        expect(utility.isFalse([])).toBe(true);
      });

      it('should return false for non-empty array', () => {
        expect(utility.isFalse(['test'])).toBe(false);
      });
    });

    describe('isTrue', () => {
      it('should return false for undefined array', () => {
        expect(utility.isTrue(undefined)).toBe(false);
      });

      it('should return false for empty array', () => {
        expect(utility.isTrue([])).toBe(false);
      });

      it('should return true for non-empty array', () => {
        expect(utility.isTrue(['test'])).toBe(true);
      });
    });

    describe('set', () => {
      it('should insert item when enable is true', () => {
        const array: BooleanKeyArray<TestItem> = [item1];
        const result = utility.set(array, item2, true);
        expect(result).toEqual([item1, item2]);
      });

      it('should remove item when enable is false', () => {
        const array: BooleanKeyArray<TestItem> = [item1, item2];
        const result = utility.set(array, item1, false);
        expect(result).toEqual([item2]);
      });

      it('should use true as default for enable parameter', () => {
        const array: BooleanKeyArray<TestItem> = [item1];
        const result = utility.set(array, item2);
        expect(result).toEqual([item1, item2]);
      });
    });

    describe('insert', () => {
      it('should create a new array with the item if array is undefined', () => {
        const result = utility.insert(undefined, item1);
        expect(result).toEqual([item1]);
      });

      it('should add item to existing array', () => {
        const array: BooleanKeyArray<TestItem> = [item1];
        const result = utility.insert(array, item2);
        expect(result).toEqual([item1, item2]);
      });
    });

    describe('remove', () => {
      it('should remove item with matching key', () => {
        const array: BooleanKeyArray<TestItem> = [item1, item2];
        const result = utility.remove(array, item1);
        expect(result).toEqual([item2]);
      });
    });

    describe('removeByKey', () => {
      it('should remove item with matching key', () => {
        const array: BooleanKeyArray<TestItem> = [item1, item2];
        const result = utility.removeByKey(array, '1');
        expect(result).toEqual([item2]);
      });
    });
  });

  describe('BooleanStringKeyArrayUtility', () => {
    it('should work with string keys', () => {
      const key1: BooleanStringKey = 'key1';
      const key2: BooleanStringKey = 'key2';

      const array: BooleanKeyArray<BooleanStringKey> = [key1];

      expect(BooleanStringKeyArrayUtility.isTrue(array)).toBe(true);
      expect(BooleanStringKeyArrayUtility.isFalse([])).toBe(true);

      const withKey2 = BooleanStringKeyArrayUtility.insert(array, key2);
      expect(withKey2).toEqual([key1, key2]);

      const withoutKey1 = BooleanStringKeyArrayUtility.remove(withKey2, key1);
      expect(withoutKey1).toEqual([key2]);

      const empty = BooleanStringKeyArrayUtility.removeByKey(withoutKey1, 'key2');
      expect(empty).toEqual([]);
    });

    it('should handle null/undefined safely in key function', () => {
      // The key function for BooleanStringKeyArrayUtility is (x) => (x ? x : undefined)
      // This tests that it handles undefined values properly
      const array: BooleanKeyArray<BooleanStringKey> = ['valid'];

      // @ts-expect-error - Intentionally passing null to test handling
      expect(() => BooleanStringKeyArrayUtility.insert(array, null)).not.toThrow();

      // @ts-expect-error - Intentionally passing undefined to test handling
      expect(() => BooleanStringKeyArrayUtility.insert(array, undefined)).not.toThrow();
    });
  });
});
