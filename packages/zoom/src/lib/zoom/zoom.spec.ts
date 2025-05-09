import { ZoomRecordFieldsData, ZoomSearchRecordsCriteriaEntryArray, ZoomSearchRecordsCriteriaTree, zoomSearchRecordsCriteriaString } from './zoom';

export interface TestEntryType extends ZoomRecordFieldsData {
  testA: string;
  testB: string;
}

describe('zoomSearchRecordsCriteriaString()', () => {
  describe('entry array', () => {
    it('should convert an array of entries', () => {
      const tree: ZoomSearchRecordsCriteriaEntryArray<TestEntryType> = [
        { field: 'testA', filter: 'contains', value: 'a' },
        { field: 'testB', filter: 'contains', value: 'b' }
      ];

      const result = zoomSearchRecordsCriteriaString(tree);
      expect(result).toBe(`((testA:contains:a)and(testB:contains:b))`);
    });
  });

  describe('trees', () => {
    it('should convert a tree of AND values', () => {
      const entries: ZoomSearchRecordsCriteriaEntryArray = [
        { field: 'testA', filter: 'contains', value: 'a' },
        { field: 'testB', filter: 'contains', value: 'b' }
      ];

      const tree: ZoomSearchRecordsCriteriaTree = {
        and: [entries]
      };

      const result = zoomSearchRecordsCriteriaString(tree);
      expect(result).toBe(`((testA:contains:a)and(testB:contains:b))`);
    });

    it('should convert a tree of AND tree values', () => {
      const tree: ZoomSearchRecordsCriteriaTree = {
        and: [
          {
            and: [
              [
                { field: 'testA', filter: 'contains', value: 'a' },
                { field: 'testB', filter: 'contains', value: 'b' }
              ]
            ]
          },
          {
            and: [
              [
                { field: 'testC', filter: 'contains', value: 'c' },
                { field: 'testD', filter: 'contains', value: 'd' }
              ]
            ]
          }
        ]
      };

      const result = zoomSearchRecordsCriteriaString(tree);
      expect(result).toBe(`(((testA:contains:a)and(testB:contains:b))and((testC:contains:c)and(testD:contains:d)))`);
    });

    it('should convert a tree of OR values', () => {
      const tree: ZoomSearchRecordsCriteriaTree = {
        or: [
          [
            { field: 'testA', filter: 'contains', value: 'a' },
            { field: 'testB', filter: 'contains', value: 'b' }
          ]
        ]
      };

      const result = zoomSearchRecordsCriteriaString(tree);
      expect(result).toBe(`((testA:contains:a)or(testB:contains:b))`);
    });

    it('should convert a tree of AND values', () => {
      const tree: ZoomSearchRecordsCriteriaTree = {
        and: [
          [
            { field: 'testA', filter: 'contains', value: 'a' },
            { field: 'testB', filter: 'contains', value: 'b' }
          ]
        ],
        or: [
          [
            { field: 'testC', filter: 'contains', value: 'c' },
            { field: 'testD', filter: 'contains', value: 'd' }
          ]
        ]
      };

      const result = zoomSearchRecordsCriteriaString(tree);
      expect(result).toBe(`(((testA:contains:a)and(testB:contains:b))and((testC:contains:c)or(testD:contains:d)))`);
    });
  });
});
