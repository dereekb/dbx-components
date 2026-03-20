import { type ModelTypeString } from '../model/model';
import { type ChangeRelationObjectsMaskFn, ModelRelationUtility, RelationChange, type RelationKey, type RelationModelType } from './relation';

class RelationTag {
  type: ModelTypeString;
  key: RelationKey;

  constructor(template: RelationTag) {
    this.type = template.type;
    this.key = template.key;
  }
}

function READ_RELATION_TAG_TYPE<T extends RelationTag>(model: T): RelationModelType {
  return model.type;
}

function READ_RELATION_KEY<T extends RelationTag>(model: T): RelationKey {
  return model.key;
}

function MERGE_RELATION_TAG(a: RelationTag): RelationTag {
  return a; // a and b are the same.
}

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
          }),
          new RelationTag({
            key: 'b',
            type: 'a'
          })
        ];
      });

      describe('ADD', () => {
        it('should add the new item', () => {
          const change = [
            new RelationTag({
              key: 'c',
              type: 'a'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.ADD, change, { merge: MERGE_RELATION_TAG, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(3);
        });

        it('should replace any existing item with the same key.', () => {
          const change = [
            new RelationTag({
              key: 'a', // same key as existing item
              type: 'a'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.ADD, change, { merge: MERGE_RELATION_TAG, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(2); // Still 2 items
          expect(result.find((x) => x.key === 'a')).toBe(change[0]); // The new item is used
        });
      });

      describe('SET', () => {
        it('should set the new item as the only value', () => {
          const change = [
            new RelationTag({
              key: 'c',
              type: 'a'
            })
          ];

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
          }),
          new RelationTag({
            key: 'b',
            type: 'b'
          })
        ];
      });

      describe('ADD', () => {
        it('should add the new item', () => {
          const change = [
            new RelationTag({
              key: 'c',
              type: 'a'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.ADD, change, { merge: MERGE_RELATION_TAG, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(3);
        });

        it('should add a new item that has the same key but a different type', () => {
          const change = [
            new RelationTag({
              key: 'a', // same key as existing item but different type
              type: 'b'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.ADD, change, { merge: MERGE_RELATION_TAG, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(3);
          const typeAItems = result.filter((x) => x.type === 'a');
          const typeBItems = result.filter((x) => x.type === 'b');
          expect(typeAItems.length).toBe(1);
          expect(typeBItems.length).toBe(2);
          expect(typeBItems[0]).toBe(change[0]); // The new item is used
        });
      });

      describe('SET', () => {
        it('should set the new item as the only item', () => {
          const change = [
            new RelationTag({
              key: 'c',
              type: 'a'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.SET, change, { merge: MERGE_RELATION_TAG, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(change.length);
        });

        it('should replace any existing item with the same key.', () => {
          const change = [
            new RelationTag({
              key: 'a', // same key as existing item
              type: 'b'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.SET, change, { merge: MERGE_RELATION_TAG, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(1); // Only the new item
          expect(result[0]).toBe(change[0]); // The new item is used
          expect(result[0].key).toBe('a');
          expect(result[0].type).toBe('b');
        });

        describe('with mask', () => {
          let mask: ChangeRelationObjectsMaskFn<RelationTag>;

          describe('type "a" mask function', () => {
            const aTypeMask = (tag: RelationTag) => {
              return tag.type === 'a';
            };

            beforeEach(() => {
              mask = aTypeMask;
            });

            it('should set the values on the a type', () => {
              const change = [
                new RelationTag({
                  key: 'c',
                  type: 'a'
                })
              ];

              expect(mask).toBeDefined();

              const result = ModelRelationUtility.modifyCollection(current, RelationChange.SET, change, {
                merge: MERGE_RELATION_TAG,
                readType: READ_RELATION_TAG_TYPE,
                readKey: READ_RELATION_KEY,
                mask
              });
              expect(result).toBeDefined();
              expect(result.filter((x) => x.type === 'a').length).toBe(1);
              expect(result.filter((x) => x.type === 'b').length).toBe(1);
              expect(result.find((x) => x.type === 'a').key).toBe('c');
            });
          });
        });
      });

      describe('REMOVE', () => {
        it('should remove the item with the matching key', () => {
          const toRemove = [
            new RelationTag({
              key: 'a',
              type: 'a'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.REMOVE, toRemove, { merge: MERGE_RELATION_TAG, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(1);
          expect(result[0].key).toBe('b');
        });

        it('should remove multiple items', () => {
          const toRemove = [
            new RelationTag({
              key: 'a',
              type: 'a'
            }),
            new RelationTag({
              key: 'b',
              type: 'b'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.REMOVE, toRemove, { merge: MERGE_RELATION_TAG, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(0);
        });

        it('should not remove items that do not match', () => {
          const toRemove = [
            new RelationTag({
              key: 'c',
              type: 'a'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.REMOVE, toRemove, { merge: MERGE_RELATION_TAG, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(2);
        });
      });

      describe('UPDATE', () => {
        const MERGE_WITH_SUFFIX = (a: RelationTag, _b: RelationTag): RelationTag => {
          return new RelationTag({
            key: a.key,
            type: `${a.type}_updated`
          });
        };

        it('should update an existing item', () => {
          const update = [
            new RelationTag({
              key: 'a',
              type: 'a'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.UPDATE, update, { merge: MERGE_WITH_SUFFIX, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(2);
          const updatedItem = result.find((x) => x.key === 'a');
          expect(updatedItem).toBeDefined();
          expect(updatedItem!.type).toBe('a_updated');
        });

        it('should not add new items that do not exist', () => {
          const update = [
            new RelationTag({
              key: 'c',
              type: 'c'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.UPDATE, update, { merge: MERGE_WITH_SUFFIX, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(2); // Still only 2 items
          expect(result.find((x) => x.key === 'c')).toBeUndefined();
        });

        it('should update multiple items', () => {
          const update = [
            new RelationTag({
              key: 'a',
              type: 'a'
            }),
            new RelationTag({
              key: 'b',
              type: 'b'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.UPDATE, update, { merge: MERGE_WITH_SUFFIX, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(2);
          expect(result.find((x) => x.key === 'a')!.type).toBe('a_updated');
          expect(result.find((x) => x.key === 'b')!.type).toBe('b_updated');
        });
      });

      describe('INSERT', () => {
        const MERGE_WITH_SUFFIX = (a: RelationTag, _b: RelationTag): RelationTag => {
          return new RelationTag({
            key: a.key,
            type: `${a.type}_inserted`
          });
        };

        it('should update an existing item', () => {
          const insert = [
            new RelationTag({
              key: 'a',
              type: 'a'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.INSERT, insert, { merge: MERGE_WITH_SUFFIX, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(2);
          const insertedItem = result.find((x) => x.key === 'a');
          expect(insertedItem).toBeDefined();
          expect(insertedItem!.type).toBe('a_inserted');
        });

        it('should add new items that do not exist', () => {
          const insert = [
            new RelationTag({
              key: 'c',
              type: 'c'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.INSERT, insert, { merge: MERGE_WITH_SUFFIX, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(3);
          const newItem = result.find((x) => x.key === 'c');
          expect(newItem).toBeDefined();
          expect(newItem!.type).toBe('c');
        });

        it('should handle both updates and additions', () => {
          const insert = [
            new RelationTag({
              key: 'a', // existing
              type: 'a'
            }),
            new RelationTag({
              key: 'c', // new
              type: 'c'
            })
          ];

          const result = ModelRelationUtility.modifyCollection(current, RelationChange.INSERT, insert, { merge: MERGE_WITH_SUFFIX, readType: READ_RELATION_TAG_TYPE, readKey: READ_RELATION_KEY });
          expect(result.length).toBe(3);
          expect(result.find((x) => x.key === 'a')!.type).toBe('a_inserted');
          expect(result.find((x) => x.key === 'b')!.type).toBe('b'); // unchanged
          expect(result.find((x) => x.key === 'c')!.type).toBe('c'); // new
        });
      });
    });
  });
});
