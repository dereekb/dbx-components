import { MERGE_RELATION_TAG, READ_RELATION_KEY, READ_RELATION_TAG_TYPE, RelationTag } from './tags';
import { ChangeRelationObjectsMaskFn, ModelRelationUtility, RelationChange } from './relation';

describe('ModelRelationUtility', () => {

  describe('addToCollection()', () => {
    let current: string[];

    beforeEach(() => {
      current = ['a', 'b'];
    });

    it('should add the new item', () => {
      const change = ['c'];

      const result = ModelRelationUtility.addToCollection(current, change, (x) => x);
      expect(result.length).toBe(3);
    });

  });

  describe('modifyCollection()', () => {

    describe('singleType', () => {
      let current: RelationTag[];

      beforeEach(() => {
        current = [
          new RelationTag({
            key: 'a',
            type: 'a'
          }), new RelationTag({
            key: 'b',
            type: 'a'
          })
        ]
      });

      describe('ADD', () => {

        it('should add the new item', () => {
          const change = [new RelationTag({
            key: 'c',
            type: 'a'
          })];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.ADD, change, { merge: MERGE_RELATION_TAG, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(3);
        });

        it('should replace any existing item with the same key.', () => {
          // TODO
        });

      });

      describe('SET', () => {

        it('should set the new item as the only value', () => {
          const change = [new RelationTag({
            key: 'c',
            type: 'a'
          })];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.SET, change, { merge: MERGE_RELATION_TAG, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(change.length);
        });

      });

    });

    describe('multiType', () => {
      let current: RelationTag[];

      beforeEach(() => {
        current = [
          new RelationTag({
            key: 'a',
            type: 'a'
          }), new RelationTag({
            key: 'b',
            type: 'b'
          })
        ]
      });

      describe('ADD', () => {

        it('should add the new item', () => {
          const change = [new RelationTag({
            key: 'c',
            type: 'a'
          })];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.ADD, change, { merge: MERGE_RELATION_TAG, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(3);
        });

        it('should replace any existing item with the same key.', () => {
          // TODO
        });

      });

      describe('SET', () => {

        it('should set the new item as the only item', () => {
          const change = [new RelationTag({
            key: 'c',
            type: 'a'
          })];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.SET, change, { merge: MERGE_RELATION_TAG, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(change.length);
        });

        it('should replace any existing item with the same key.', () => {
          // TODO
        });

        describe('with mask', () => {

          let mask: ChangeRelationObjectsMaskFn<RelationTag>;

          describe('type "a" mask function', () => {

            const aTypeMask = (tag: RelationTag) => {
              return tag.type === 'a';
            }

            beforeEach(() => {
              mask = aTypeMask;
            });

            it('should set the values on the a type', () => {
              const change = [new RelationTag({
                key: 'c',
                type: 'a'
              })];

              expect(mask).toBeDefined();

              const result = ModelRelationUtility.modifyCollection(current, RelationChange.SET, change, { merge: MERGE_RELATION_TAG, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY, mask });
              expect(result).toBeDefined();
              expect(result.filter(x => x.type === 'a').length).toBe(1);
              expect(result.filter(x => x.type === 'b').length).toBe(1);
              expect(result.filter(x => x.type === 'a')[0].key).toBe('c');
            });

          });

        });

      });

      describe('REMOVE', () => {

        // TODO!

      });

      describe('UPDATE', () => {

        // TODO!

      });

      describe('INSERT', () => {

        // TODO!

      });

    });

  });

});
