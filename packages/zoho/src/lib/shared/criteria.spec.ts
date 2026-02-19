import { type ZohoSearchRecordsCriteriaEntryArray, type ZohoSearchRecordsCriteriaTree, zohoSearchRecordsCriteriaString } from './criteria';

export interface TestEntryType {
  testA: string;
  testB: string;
}

describe('zohoSearchRecordsCriteriaString()', () => {
  describe('entry array', () => {
    it('should convert an array of entries', () => {
      const tree: ZohoSearchRecordsCriteriaEntryArray<TestEntryType> = [
        { field: 'testA', filter: 'contains', value: 'a' },
        { field: 'testB', filter: 'contains', value: 'b' }
      ];

      const result = zohoSearchRecordsCriteriaString(tree);
      expect(result).toBe(`((testA:contains:a)and(testB:contains:b))`);
    });
  });

  describe('trees', () => {
    it('should convert a tree of AND values', () => {
      const entries: ZohoSearchRecordsCriteriaEntryArray = [
        { field: 'testA', filter: 'contains', value: 'a' },
        { field: 'testB', filter: 'contains', value: 'b' }
      ];

      const tree: ZohoSearchRecordsCriteriaTree = {
        and: [entries]
      };

      const result = zohoSearchRecordsCriteriaString(tree);
      expect(result).toBe(`((testA:contains:a)and(testB:contains:b))`);
    });

    it('should convert a tree of AND tree values', () => {
      const tree: ZohoSearchRecordsCriteriaTree = {
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

      const result = zohoSearchRecordsCriteriaString(tree);
      expect(result).toBe(`(((testA:contains:a)and(testB:contains:b))and((testC:contains:c)and(testD:contains:d)))`);
    });

    it('should convert a tree of OR values', () => {
      const tree: ZohoSearchRecordsCriteriaTree = {
        or: [
          [
            { field: 'testA', filter: 'contains', value: 'a' },
            { field: 'testB', filter: 'contains', value: 'b' }
          ]
        ]
      };

      const result = zohoSearchRecordsCriteriaString(tree);
      expect(result).toBe(`((testA:contains:a)or(testB:contains:b))`);
    });

    it('should convert a tree of AND values', () => {
      const tree: ZohoSearchRecordsCriteriaTree = {
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

      const result = zohoSearchRecordsCriteriaString(tree);
      expect(result).toBe(`(((testA:contains:a)and(testB:contains:b))and((testC:contains:c)or(testD:contains:d)))`);
    });
  });
});
