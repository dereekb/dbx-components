import { ZohoRecruitRecordFieldsData, ZohoRecruitSearchRecordsCriteriaEntryArray, ZohoRecruitSearchRecordsCriteriaTree, zohoRecruitSearchRecordsCriteriaString } from './recruit';

export interface TestEntryType extends ZohoRecruitRecordFieldsData {
  testA: string;
  testB: string;
}

describe('zohoRecruitSearchRecordsCriteriaString()', () => {
  describe('entry array', () => {
    it('should convert an array of entries', () => {
      const tree: ZohoRecruitSearchRecordsCriteriaEntryArray<TestEntryType> = [
        { field: 'testA', filter: 'contains', value: 'a' },
        { field: 'testB', filter: 'contains', value: 'b' }
      ];

      const result = zohoRecruitSearchRecordsCriteriaString(tree);
      expect(result).toBe(`((testA:contains:a)and(testB:contains:b))`);
    });
  });

  describe('trees', () => {
    it('should convert a tree of AND values', () => {
      const entries: ZohoRecruitSearchRecordsCriteriaEntryArray = [
        { field: 'testA', filter: 'contains', value: 'a' },
        { field: 'testB', filter: 'contains', value: 'b' }
      ];

      const tree: ZohoRecruitSearchRecordsCriteriaTree = {
        and: [entries]
      };

      const result = zohoRecruitSearchRecordsCriteriaString(tree);
      expect(result).toBe(`((testA:contains:a)and(testB:contains:b))`);
    });

    it('should convert a tree of AND tree values', () => {
      const tree: ZohoRecruitSearchRecordsCriteriaTree = {
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

      const result = zohoRecruitSearchRecordsCriteriaString(tree);
      expect(result).toBe(`(((testA:contains:a)and(testB:contains:b))and((testC:contains:c)and(testD:contains:d)))`);
    });

    it('should convert a tree of OR values', () => {
      const tree: ZohoRecruitSearchRecordsCriteriaTree = {
        or: [
          [
            { field: 'testA', filter: 'contains', value: 'a' },
            { field: 'testB', filter: 'contains', value: 'b' }
          ]
        ]
      };

      const result = zohoRecruitSearchRecordsCriteriaString(tree);
      expect(result).toBe(`((testA:contains:a)or(testB:contains:b))`);
    });

    it('should convert a tree of AND values', () => {
      const tree: ZohoRecruitSearchRecordsCriteriaTree = {
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

      const result = zohoRecruitSearchRecordsCriteriaString(tree);
      expect(result).toBe(`(((testA:contains:a)and(testB:contains:b))and((testC:contains:c)or(testD:contains:d)))`);
    });
  });
});
