import { arrayToMap, filterUniqueValues } from '../array';
import { makeKeyPairs, makeValuesGroupMap, restoreOrderWithValues, separateValues } from '../grouping';
import { type Maybe } from '../value/maybe.type';

/**
 * Type of relation change to perform on a collection of models.
 */
export const RelationChange = {
  /**
   * Adds a model to the relation. If the model already exists in
   * the relation, the new one is used.
   *
   * Use INSERT to merge the two values together.
   */
  ADD: 'add' as const,
  /**
   * Sets the relation to be equal to the input.
   */
  SET: 'set' as const,
  /**
   * Variation of SET that performs REMOVE on the collection, and then follows it up with INSERT.
   *
   * This can allow the modification function to behave selectively with the items targeted for removal.
   */
  REMOVE_AND_INSERT: 'remove_and_insert' as const,
  /**
   * Removes a model from the relation.
   */
  REMOVE: 'remove' as const,
  /**
   * Updates an existing relation, if it exists.
   * The existing object is merged with the update object.
   */
  UPDATE: 'update' as const,
  /**
   * Updates an existing relation, if it exists, or creates a new one.
   */
  INSERT: 'insert' as const
} as const;

export type RelationChangeType = (typeof RelationChange)[keyof typeof RelationChange];

export type RelationString = string;
export type RelationObject = RelationString | object;
export type RelationModelType = string;
export type RelationKey = string | number;

export type ReadRelationKeyFn<T> = (model: T) => RelationKey;
export type ReadRelationModelTypeFn<T> = (model: T) => RelationModelType;

/**
 * Merges the two input values. The "a" value is usually the existing/incumbent value, while "b" is the new value.
 */
export type MergeRelationObjectsFn<T> = (a: T, b: T) => T;

/**
 * Whether or not the object is changable as part of this request.
 */
export type ChangeRelationObjectsMaskFn<T> = (x: T) => boolean;

export interface UpdateRelationConfig<T> {
  readKey: ReadRelationKeyFn<T>;
  merge: MergeRelationObjectsFn<T>;
  /**
   * Whether or not an item should be removed when remove is called.
   */
  shouldRemove?: (x: T) => boolean;
  /**
   * Whether or not the item should be considered when performing a change.
   *
   * For instance, existing items that are passed to this function and it returns false are unable to be changed,
   * and new/target items that are passed to this function and it returns false are ignored.
   */
  mask?: ChangeRelationObjectsMaskFn<T>;
}

export interface UpdateMiltiTypeRelationConfig<T> extends UpdateRelationConfig<T> {
  readType: ReadRelationModelTypeFn<T>;
}

/**
 * Utility class for modifying a collection of relational objects.
 *
 * For instance, a string collection of keys.
 */
export class ModelRelationUtility {
  static modifyStringCollection(current: Maybe<RelationString[]>, change: RelationChangeType, mods: RelationString[]): RelationString[] {
    return ModelRelationUtility.modifyCollection(current, change, mods, { readKey: (x) => x, merge: (a, b) => b });
  }

  static modifyCollection<T extends RelationObject>(current: Maybe<T[]>, change: RelationChangeType, mods: T[], config: UpdateRelationConfig<T>): T[];
  static modifyCollection<T extends RelationObject>(current: Maybe<T[]>, change: RelationChangeType, mods: T[], config: UpdateMiltiTypeRelationConfig<T>): T[];
  static modifyCollection<T extends RelationObject>(current: Maybe<T[]>, change: RelationChangeType, mods: T[], config: UpdateRelationConfig<T> | UpdateMiltiTypeRelationConfig<T>): T[] {
    const { mask, readKey } = config;

    current = current ?? []; //init current if not set.

    if (mask) {
      const { included: currentModify, excluded: currentRetain } = separateValues(current, mask);
      const { included: modModify } = separateValues(mods, mask);

      const modifiedResults = this._modifyCollectionWithoutMask(currentModify, change, modModify, config);

      return this._mergeMaskResults(current, currentRetain, modifiedResults, readKey);
    } else {
      return this._modifyCollectionWithoutMask(current, change, mods, config);
    }
  }

  /**
   * The mask results are merged together.
   *
   * Order from the "current" is retained. Anything in currentRetain overrides modifiedResults.
   */
  private static _mergeMaskResults<T extends RelationObject>(current: T[], currentRetain: T[], modifiedResults: T[], readKey: ReadRelationKeyFn<T>) {
    return restoreOrderWithValues(current, [...currentRetain, ...modifiedResults], { readKey });
  }

  private static _modifyCollectionWithoutMask<T extends RelationObject>(current: T[], change: RelationChangeType, mods: T[], config: UpdateRelationConfig<T> | UpdateMiltiTypeRelationConfig<T>): T[] {
    const { readKey, merge, shouldRemove } = config;

    const readType = (config as UpdateMiltiTypeRelationConfig<T>).readType;

    function remove(rCurrent = current, rMods = mods) {
      return ModelRelationUtility._modifyCollection(
        rCurrent,
        rMods,
        (x: T[], y: T[]) => {
          return ModelRelationUtility.removeFromCollection(x, y, readKey, shouldRemove);
        },
        readType
      );
    }

    function performAdd() {
      return ModelRelationUtility._modifyCollection(current, mods, (x, y) => ModelRelationUtility.addToCollection(x, y, readKey), readType);
    }

    function performInsert() {
      return ModelRelationUtility.insertCollection(current, mods, { readKey, readType, merge });
    }

    switch (change) {
      case RelationChange.SET:
        current = []; // Set current before performing add.
        return performAdd();
      case RelationChange.ADD:
        return performAdd();
      case RelationChange.REMOVE:
        return remove();
      case RelationChange.UPDATE:
        return ModelRelationUtility.updateCollection(current, mods, { readKey, readType, merge });
      case RelationChange.REMOVE_AND_INSERT:
        current = remove(current, current); // Remove all current values before performing an insert.
        return performInsert();
      case RelationChange.INSERT:
        return performInsert();
    }
  }

  static updateCollection<T extends RelationObject>(current: T[], update: T[], { readKey, readType, merge }: UpdateMiltiTypeRelationConfig<T>): T[] {
    ModelRelationUtility._assertMergeProvided(merge);
    return ModelRelationUtility._modifyCollection(current, update, (x, y) => ModelRelationUtility._updateSingleTypeCollection(x, y, { readKey, merge }), readType);
  }

  static insertCollection<T extends RelationObject>(current: T[], update: T[], { readKey, readType, merge }: UpdateMiltiTypeRelationConfig<T>): T[] {
    ModelRelationUtility._assertMergeProvided(merge);
    return ModelRelationUtility._modifyCollection(current, update, (x, y) => ModelRelationUtility._insertSingleTypeCollection(x, y, { readKey, merge }), readType);
  }

  /**
   * Used to modify a collection which may be multi-type. If readType is provided, the collection is handled as a multi-type map.
   */
  private static _modifyCollection<T extends RelationObject>(current: T[], mods: T[], modifyCollection: (subSetCurrent: T[], mods: T[]) => T[], readType?: ReadRelationModelTypeFn<T>): T[] {
    if (readType) {
      return ModelRelationUtility._modifyMultiTypeCollection(current, mods, readType, modifyCollection);
    } else {
      return modifyCollection(current, mods);
    }
  }

  private static _modifyMultiTypeCollection<T extends RelationObject>(input: T[], mods: T[], readType: ReadRelationModelTypeFn<T>, modifyCollection: (subSetCurrent: T[], mods: T[]) => T[]): T[] {
    const inputMap = makeValuesGroupMap(input, readType);
    const modsMap = makeValuesGroupMap(mods, readType);

    const typesModified = new Set<Maybe<string>>([...inputMap.keys(), ...modsMap.keys()]);

    // Break the collections up into their individual types and process separately.
    const modifiedSubcollections = Array.from(typesModified).map((type) => {
      const values = inputMap.get(type) ?? [];
      const mods = modsMap.get(type) ?? [];

      // Only modify if they've got changes for their type.
      if (mods.length === 0) {
        return values; // No mods, no change to those types.
      } else {
        return modifyCollection(values, mods);
      }
    });

    // Rejoin all changes.
    return modifiedSubcollections.reduce((x, y) => x.concat(y), []);
  }

  private static _insertSingleTypeCollection<T extends RelationObject>(current: T[], insert: T[], { readKey, merge }: UpdateRelationConfig<T>): T[] {
    const currentKeys = arrayToMap(current, readKey);
    const updateValues: T[] = [];
    const addValues: T[] = [];

    insert.forEach((value) => {
      const key = readKey(value);

      if (currentKeys.has(key)) {
        updateValues.push(value);
      } else {
        addValues.push(value);
      }
    });

    const added = ModelRelationUtility.addToCollection(current, addValues, readKey);
    const results = ModelRelationUtility._updateSingleTypeCollection(added, updateValues, { readKey, merge });
    return results;
  }

  private static _updateSingleTypeCollection<T extends RelationObject>(current: T[], update: T[], { readKey, merge }: UpdateRelationConfig<T>): T[] {
    const keysToUpdate = arrayToMap(update, readKey);
    const updateValues: T[] = [];

    current.forEach((value) => {
      const key = readKey(value);
      const mergeWith = keysToUpdate.get(key);

      if (mergeWith != null) {
        updateValues.push(merge(value, mergeWith));
      }
    });

    // Add to merge all values and remove duplicates.
    return ModelRelationUtility.addToCollection(current, updateValues, readKey);
  }

  static addToCollection<T extends RelationObject>(current: Maybe<T[]>, add: T[], readKey: ReadRelationKeyFn<T>): T[] {
    current = current ?? [];
    return add?.length ? ModelRelationUtility.removeDuplicates([...add, ...current], readKey) : current; // Will keep any "added" before any existing ones.
  }

  static removeFromCollection<T extends RelationObject>(current: Maybe<T[]>, remove: T[], readKey: ReadRelationKeyFn<T>, shouldRemove?: (x: T) => boolean): T[] {
    if (current?.length) {
      if (shouldRemove) {
        const currentKeyPairs = makeKeyPairs(current, readKey);
        const map = new Map(currentKeyPairs);

        remove.forEach((x) => {
          const key = readKey(x);
          const removalTarget = map.get(key);

          if (removalTarget && shouldRemove(removalTarget)) {
            map.delete(key); // Remove from the map.
          }
        });

        return currentKeyPairs.filter((x) => map.has(x[0])).map((x) => x[1]); // Retain order, remove from map.
      } else {
        return ModelRelationUtility.removeKeysFromCollection(current, remove.map(readKey), readKey);
      }
    } else {
      return [];
    }
  }

  static removeKeysFromCollection<T extends RelationObject>(current: Maybe<T[]>, keysToRemove: RelationKey[], readKey: ReadRelationKeyFn<T>): T[] {
    return ModelRelationUtility.removeDuplicates(current, readKey, keysToRemove);
  }

  static removeDuplicates<T>(relations: Maybe<T[]>, readKey: ReadRelationKeyFn<T>, additionalKeys: RelationKey[] = []): T[] {
    return relations?.length ? filterUniqueValues(relations, readKey, additionalKeys) : [];
  }

  // MARK: Internal Utility
  private static _assertMergeProvided<T = unknown>(merge: MergeRelationObjectsFn<T>) {
    if (!merge) {
      throw new Error('Merge was not provided.');
    }
  }
}
