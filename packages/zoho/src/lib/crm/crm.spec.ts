import { type ZohoCrmRecordFieldsData } from './crm';
import { type ZohoCrmSearchRecordsCriteriaEntryArray, type ZohoCrmSearchRecordsCriteriaTree, zohoCrmSearchRecordsCriteriaString } from './crm.criteria';

export interface TestEntryType extends ZohoCrmRecordFieldsData {
  testA: string;
  testB: string;
}

describe('zohoCrmSearchRecordsCriteriaString()', () => {
  describe('entry array', () => {
    it('should convert an array of entries', () => {
      const tree: ZohoCrmSearchRecordsCriteriaEntryArray<TestEntryType> = [
        { field: 'testA', filter: 'contains', value: 'a' },
        { field: 'testB', filter: 'contains', value: 'b' }
      ];

      const result = zohoCrmSearchRecordsCriteriaString(tree);
      expect(result).toBe(`((testA:contains:a)and(testB:contains:b))`);
    });
  });

  describe('trees', () => {
    it('should convert a tree of AND values', () => {
      const entries: ZohoCrmSearchRecordsCriteriaEntryArray = [
        { field: 'testA', filter: 'contains', value: 'a' },
        { field: 'testB', filter: 'contains', value: 'b' }
      ];

      const tree: ZohoCrmSearchRecordsCriteriaTree = {
        and: [entries]
      };

      const result = zohoCrmSearchRecordsCriteriaString(tree);
      expect(result).toBe(`((testA:contains:a)and(testB:contains:b))`);
    });

    it('should convert a tree of AND tree values', () => {
      const tree: ZohoCrmSearchRecordsCriteriaTree = {
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

      const result = zohoCrmSearchRecordsCriteriaString(tree);
      expect(result).toBe(`(((testA:contains:a)and(testB:contains:b))and((testC:contains:c)and(testD:contains:d)))`);
    });

    it('should convert a tree of OR values', () => {
      const tree: ZohoCrmSearchRecordsCriteriaTree = {
        or: [
          [
            { field: 'testA', filter: 'contains', value: 'a' },
            { field: 'testB', filter: 'contains', value: 'b' }
          ]
        ]
      };

      const result = zohoCrmSearchRecordsCriteriaString(tree);
      expect(result).toBe(`((testA:contains:a)or(testB:contains:b))`);
    });

    it('should convert a tree of AND values', () => {
      const tree: ZohoCrmSearchRecordsCriteriaTree = {
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

      const result = zohoCrmSearchRecordsCriteriaString(tree);
      expect(result).toBe(`(((testA:contains:a)and(testB:contains:b))and((testC:contains:c)or(testD:contains:d)))`);
    });
  });
});
