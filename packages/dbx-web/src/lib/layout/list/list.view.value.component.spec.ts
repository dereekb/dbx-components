import { DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION } from './list.view.value.component';
import { type DbxValueListItem } from './list.view.value';

interface TestValue {
  readonly name: string;
}

interface TestValueWithKey {
  readonly key: string;
  readonly name: string;
}

interface TestValueWithId {
  readonly id: string;
  readonly name: string;
}

describe('DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION', () => {
  describe('with item.key set', () => {
    it('should use the item key', () => {
      const item: DbxValueListItem<TestValue> = {
        key: 'explicit-key',
        itemValue: { name: 'test' }
      };

      const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
      expect(result).toBe('explicit-key');
    });

    it('should prefer item.key over itemValue.key', () => {
      const item: DbxValueListItem<TestValueWithKey> = {
        key: 'explicit-key',
        itemValue: { key: 'value-key', name: 'test' }
      };

      const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
      expect(result).toBe('explicit-key');
    });

    it('should prefer item.key over itemValue.id', () => {
      const item: DbxValueListItem<TestValueWithId> = {
        key: 'explicit-key',
        itemValue: { id: 'value-id', name: 'test' }
      };

      const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
      expect(result).toBe('explicit-key');
    });
  });

  describe('with itemValue.key', () => {
    it('should use itemValue.key when item.key is not set', () => {
      const item: DbxValueListItem<TestValueWithKey> = {
        itemValue: { key: 'value-key', name: 'test' }
      };

      const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
      expect(result).toBe('value-key');
    });

    it('should prefer itemValue.key over itemValue.id', () => {
      const item: DbxValueListItem<TestValueWithKey & TestValueWithId> = {
        itemValue: { key: 'value-key', id: 'value-id', name: 'test' }
      };

      const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
      expect(result).toBe('value-key');
    });
  });

  describe('with itemValue.id', () => {
    it('should use itemValue.id when neither item.key nor itemValue.key is set', () => {
      const item: DbxValueListItem<TestValueWithId> = {
        itemValue: { id: 'value-id', name: 'test' }
      };

      const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
      expect(result).toBe('value-id');
    });
  });

  describe('index fallback', () => {
    it('should fall back to a prefixed index when no key or id is available', () => {
      const item: DbxValueListItem<TestValue> = {
        itemValue: { name: 'test' }
      };

      const result = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(3, item);
      expect(result).toBe('__list__3__');
    });

    it('should produce different fallback values for different indexes', () => {
      const item: DbxValueListItem<TestValue> = {
        itemValue: { name: 'test' }
      };

      const result0 = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, item);
      const result1 = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(1, item);

      expect(result0).not.toBe(result1);
    });
  });

  describe('stability across data updates', () => {
    it('should return the same tracking key for items with the same key but different data', () => {
      const itemBefore: DbxValueListItem<TestValue> = {
        key: 'stable-key',
        itemValue: { name: 'before' }
      };

      const itemAfter: DbxValueListItem<TestValue> = {
        key: 'stable-key',
        itemValue: { name: 'after' }
      };

      const resultBefore = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, itemBefore);
      const resultAfter = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, itemAfter);

      expect(resultBefore).toBe(resultAfter);
    });

    it('should return the same tracking key for items with the same itemValue.key but different object references', () => {
      const itemBefore: DbxValueListItem<TestValueWithKey> = {
        itemValue: { key: 'model-key', name: 'before' }
      };

      const itemAfter: DbxValueListItem<TestValueWithKey> = {
        itemValue: { key: 'model-key', name: 'after' }
      };

      const resultBefore = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, itemBefore);
      const resultAfter = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, itemAfter);

      expect(resultBefore).toBe(resultAfter);
    });

    it('should return the same tracking key for items with the same itemValue.id but different object references', () => {
      const itemBefore: DbxValueListItem<TestValueWithId> = {
        itemValue: { id: 'model-id', name: 'before' }
      };

      const itemAfter: DbxValueListItem<TestValueWithId> = {
        itemValue: { id: 'model-id', name: 'after' }
      };

      const resultBefore = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, itemBefore);
      const resultAfter = DEFAULT_VALUE_LIST_VIEW_CONTENT_COMPONENT_TRACK_BY_FUNCTION(0, itemAfter);

      expect(resultBefore).toBe(resultAfter);
    });
  });
});
