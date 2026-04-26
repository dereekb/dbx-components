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

/**
 * Union of all valid {@link RelationChange} values.
 */
export type RelationChangeType = (typeof RelationChange)[keyof typeof RelationChange];

/**
 * A string-based relation identifier.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-util:relation
 */
export type RelationString = string;

/**
 * A relation target that is either a string key or an object containing relation data.
 */
export type RelationObject = RelationString | object;

/**
 * A string identifying the type/category of a relation model.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-util:relation
 */
export type RelationModelType = string;

/**
 * A unique key identifying a relation model, either a string or number.
 */
export type RelationKey = string | number;

/**
 * Extracts the unique key from a relation model.
 */
export type ReadRelationKeyFn<T> = (model: T) => RelationKey;

/**
 * Extracts the model type string from a relation model.
 */
export type ReadRelationModelTypeFn<T> = (model: T) => RelationModelType;

/**
 * Merges the two input values. The "a" value is usually the existing/incumbent value, while "b" is the new value.
 */
export type MergeRelationObjectsFn<T> = (a: T, b: T) => T;

/**
 * Whether or not the object is changable as part of this request.
 */
export type ChangeRelationObjectsMaskFn<T> = (x: T) => boolean;

/**
 * Configuration for modifying a single-type relation collection via {@link ModelRelationUtility}.
 */
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

/**
 * Extends {@link UpdateRelationConfig} with a type reader for multi-type relation collections.
 */
export interface UpdateMiltiTypeRelationConfig<T> extends UpdateRelationConfig<T> {
  readType: ReadRelationModelTypeFn<T>;
}

/**
 * Utility class for modifying a collection of relational objects.
 *
 * For instance, a string collection of keys.
 */
export class ModelRelationUtility {
  /**
   * Convenience method that modifies a collection of plain string relations.
   *
   * @param current - The current string collection.
   * @param change - The type of relation change to perform.
   * @param mods - The string values to apply as modifications.
   * @returns The modified string collection.
   */
  static modifyStringCollection(current: Maybe<RelationString[]>, change: RelationChangeType, mods: RelationString[]): RelationString[] {
    return ModelRelationUtility.modifyCollection(current, change, mods, { readKey: (x) => x, merge: (a, b) => b });
  }

  /**
   * Applies a {@link RelationChangeType} operation to a typed collection of relation objects.
   * Supports single-type and multi-type collections depending on the config.
   *
   * @param current - The current collection of relation objects.
   * @param change - The relation change operation to perform.
   * @param mods - The modification objects to apply.
   * @param config - Configuration providing key/type readers, merge function, and optional mask.
   * @returns The modified collection.
   */
  static modifyCollection<T extends RelationObject>(current: Maybe<T[]>, change: RelationChangeType, mods: T[], config: UpdateMiltiTypeRelationConfig<T>): T[];
  static modifyCollection<T extends RelationObject>(current: Maybe<T[]>, change: RelationChangeType, mods: T[], config: UpdateRelationConfig<T>): T[];
  // eslint-disable-next-line @typescript-eslint/max-params
  static modifyCollection<T extends RelationObject>(current: Maybe<T[]>, change: RelationChangeType, mods: T[], config: UpdateRelationConfig<T> | UpdateMiltiTypeRelationConfig<T>): T[] {
    const { mask, readKey } = config;

    current = current ?? []; //init current if not set.

    if (mask) {
      const { included: currentModify, excluded: currentRetain } = separateValues(current, mask);
      const { included: modModify } = separateValues(mods, mask);

      const modifiedResults = this._modifyCollectionWithoutMask(currentModify, change, modModify, config);
      return this._mergeMaskResults(current, currentRetain, modifiedResults, readKey);
    }

    return this._modifyCollectionWithoutMask(current, change, mods, config);
  }

  /**
   * The mask results are merged together.
   *
   * Order from the "current" is retained. Anything in currentRetain overrides modifiedResults.
   *
   * @param current - the original array whose ordering is preserved
   * @param currentRetain - items from `current` that were excluded from modification and take precedence in the merge
   * @param modifiedResults - items that were modified or added during the relation change
   * @param readKey - function that extracts the relation key from each item for ordering
   * @returns the merged array with original ordering restored
   */
  // eslint-disable-next-line @typescript-eslint/max-params
  private static _mergeMaskResults<T extends RelationObject>(current: T[], currentRetain: T[], modifiedResults: T[], readKey: ReadRelationKeyFn<T>) {
    return restoreOrderWithValues(current, [...currentRetain, ...modifiedResults], { readKey });
  }

  // eslint-disable-next-line @typescript-eslint/max-params
  private static _modifyCollectionWithoutMask<T extends RelationObject>(current: T[], change: RelationChangeType, mods: T[], config: UpdateRelationConfig<T> | UpdateMiltiTypeRelationConfig<T>): T[] {
    const { readKey, merge, shouldRemove } = config;

    const readType = (config as Partial<UpdateMiltiTypeRelationConfig<T>>).readType ?? (() => '0');

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

  /**
   * Merges update objects into matching existing items in the collection. Items without a match are ignored.
   *
   * @param current - The current collection.
   * @param update - The objects to merge into matching items.
   * @param config - Configuration with key/type readers and merge function.
   * @returns The updated collection.
   */
  static updateCollection<T extends RelationObject>(current: T[], update: T[], config: UpdateRelationConfig<T> | UpdateMiltiTypeRelationConfig<T>): T[] {
    const { readKey, readType, merge } = config as UpdateMiltiTypeRelationConfig<T>;
    ModelRelationUtility._assertMergeProvided(merge);
    return ModelRelationUtility._modifyCollection(current, update, (x, y) => ModelRelationUtility._updateSingleTypeCollection(x, y, { readKey, merge }), readType);
  }

  /**
   * Inserts objects into the collection: merges with existing items that share a key,
   * and adds new items that have no match.
   *
   * @param current - The current collection.
   * @param update - The objects to insert or merge.
   * @param config - Configuration with key/type readers and merge function.
   * @returns The collection with insertions and merges applied.
   */
  static insertCollection<T extends RelationObject>(current: T[], update: T[], config: UpdateRelationConfig<T> | UpdateMiltiTypeRelationConfig<T>): T[] {
    const { readKey, readType, merge } = config as UpdateMiltiTypeRelationConfig<T>;
    ModelRelationUtility._assertMergeProvided(merge);
    return ModelRelationUtility._modifyCollection(current, update, (x, y) => ModelRelationUtility._insertSingleTypeCollection(x, y, { readKey, merge }), readType);
  }

  /**
   * Used to modify a collection which may be multi-type. If readType is provided, the collection is handled as a multi-type map.
   *
   * @param current - the current collection of relation objects
   * @param mods - the modifications to apply to the collection
   * @param modifyCollection - function that applies modifications to a single-type subset of the collection
   * @param readType - optional function to read the type from each relation object, enabling multi-type handling
   * @returns the modified collection with all changes applied
   */
  // eslint-disable-next-line @typescript-eslint/max-params
  private static _modifyCollection<T extends RelationObject>(current: T[], mods: T[], modifyCollection: (subSetCurrent: T[], mods: T[]) => T[], readType?: Maybe<ReadRelationModelTypeFn<T>>): T[] {
    return readType ? ModelRelationUtility._modifyMultiTypeCollection(current, mods, readType, modifyCollection) : modifyCollection(current, mods);
  }

  // eslint-disable-next-line @typescript-eslint/max-params
  private static _modifyMultiTypeCollection<T extends RelationObject>(input: T[], mods: T[], readType: ReadRelationModelTypeFn<T>, modifyCollection: (subSetCurrent: T[], mods: T[]) => T[]): T[] {
    const inputMap = makeValuesGroupMap(input, readType);
    const modsMap = makeValuesGroupMap(mods, readType);

    const typesModified = new Set<Maybe<string>>([...inputMap.keys(), ...modsMap.keys()]);

    // Break the collections up into their individual types and process separately.
    const modifiedSubcollections = [...typesModified].map((type) => {
      const values = inputMap.get(type) ?? [];
      const mods = modsMap.get(type) ?? [];

      // Only modify if they've got changes for their type.
      return mods.length === 0 ? values : modifyCollection(values, mods);
    });

    // Rejoin all changes.
    return modifiedSubcollections.reduce((x, y) => [...x, ...y], [] as T[]);
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
    return ModelRelationUtility._updateSingleTypeCollection(added, updateValues, { readKey, merge });
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

  /**
   * Adds items to the collection, replacing any existing items with the same key.
   * New items take precedence over existing ones with duplicate keys.
   *
   * @param current - The current collection.
   * @param add - The items to add.
   * @param readKey - Function to extract the unique key from each item.
   * @returns The collection with added items.
   */
  static addToCollection<T extends RelationObject>(current: Maybe<T[]>, add: T[], readKey: ReadRelationKeyFn<T>): T[] {
    current = current ?? [];
    return add.length ? ModelRelationUtility.removeDuplicates([...add, ...current], readKey) : current; // Will keep any "added" before any existing ones.
  }

  /**
   * Removes items from the collection by matching keys. Optionally uses a `shouldRemove`
   * predicate to conditionally skip removal of matched items.
   *
   * @param current - The current collection.
   * @param remove - The items whose keys identify which items to remove.
   * @param readKey - Function to extract the unique key from each item.
   * @param shouldRemove - Optional predicate that must return true for a matched item to actually be removed.
   * @returns The collection with matching items removed.
   */
  // eslint-disable-next-line @typescript-eslint/max-params
  static removeFromCollection<T extends RelationObject>(current: Maybe<T[]>, remove: T[], readKey: ReadRelationKeyFn<T>, shouldRemove?: (x: T) => boolean): T[] {
    if (!current?.length) {
      return [];
    }

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
    }

    return ModelRelationUtility.removeKeysFromCollection(current, remove.map(readKey), readKey);
  }

  /**
   * Removes items from the collection whose keys match any of the given keys to remove.
   *
   * @param current - The current collection.
   * @param keysToRemove - The keys identifying items to remove.
   * @param readKey - Function to extract the unique key from each item.
   * @returns The collection with matching items removed.
   */
  static removeKeysFromCollection<T extends RelationObject>(current: Maybe<T[]>, keysToRemove: RelationKey[], readKey: ReadRelationKeyFn<T>): T[] {
    return ModelRelationUtility.removeDuplicates(current, readKey, keysToRemove);
  }

  /**
   * Removes duplicate items from the collection by key, keeping the first occurrence.
   * Optionally excludes items whose keys appear in an additional keys list.
   *
   * @param relations - The collection to deduplicate.
   * @param readKey - Function to extract the unique key from each item.
   * @param additionalKeys - Extra keys to treat as already seen (items with these keys are excluded).
   * @returns The deduplicated collection.
   */
  static removeDuplicates<T>(relations: Maybe<T[]>, readKey: ReadRelationKeyFn<T>, additionalKeys: RelationKey[] = []): T[] {
    return relations?.length ? filterUniqueValues(relations, readKey, additionalKeys) : [];
  }

  // MARK: Internal Utility
  private static _assertMergeProvided<T = unknown>(merge: Maybe<MergeRelationObjectsFn<T>>) {
    if (!merge) {
      throw new Error('Merge was not provided.');
    }
  }
}
