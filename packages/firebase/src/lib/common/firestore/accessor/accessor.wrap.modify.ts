import { type ArrayOrValue, asArray, mergeModifiers, type ModifierFunction, cachedGetter } from '@dereekb/util';
import { type UserRelated } from '../../../model/user';
import { type DocumentReferenceRef } from '../reference';
import { type SetOptionsMerge, type SetOptionsMergeFields, type DocumentData, type PartialWithFieldValue, type SetOptions, type WithFieldValue } from '../types';
import { type FirestoreDocumentDataAccessor, type FirestoreDocumentDataAccessorCreateFunction, type FirestoreDocumentDataAccessorSetFunction } from './accessor';
import { AbstractFirestoreDocumentDataAccessorWrapper, interceptAccessorFactoryFunction, type InterceptAccessorFactoryFunction } from './accessor.wrap';

// MARK: Set Wrapper
/**
 * Controls when the modifier function is applied to document data.
 *
 * - `'always'`: Modifies data on every create, set, and update operation
 * - `'update'`: Only modifies when calling `set()` with merge options (updating existing documents)
 * - `'set'`: Only modifies when calling `create()` or `set()` without merge options (new documents)
 * - `'create'`: Only modifies on `create()` calls
 */
export type ModifyBeforeSetFistoreDataAccessorMode = 'always' | 'update' | 'set' | 'create';

/**
 * Input passed to the modifier function, containing the document data and reference context.
 */
export interface ModifyBeforeSetFistoreDataAccessorInput<T> extends DocumentReferenceRef<T> {
  /**
   * Data to pass to the modifyAndSet function.
   */
  readonly data: Partial<T>;
  /**
   * Set options passed to the set function, if available.
   */
  readonly options?: SetOptions;
}

export type ModifyBeforeSetModifierFunction<T> = ModifierFunction<ModifyBeforeSetFistoreDataAccessorInput<T>>;

export interface ModifyBeforeSetConfig<T extends object> {
  /**
   * When to modify the input data.
   */
  readonly when: ModifyBeforeSetFistoreDataAccessorMode;
  /**
   * Modifier or array of modifier functions to apply to input data.
   */
  readonly modifier: ArrayOrValue<ModifyBeforeSetModifierFunction<T>>;
}

/**
 * Accessor wrapper that applies a modifier function to data before it is written to Firestore.
 *
 * The `when` mode in the config controls which write operations trigger the modifier.
 * Common use case: automatically copying the document ID into a `uid` field for {@link UserRelated} models
 * via {@link copyUserRelatedDataModifierConfig}.
 *
 * @template T - The document data type
 * @template D - The raw document data type in Firestore
 */
export class ModifyBeforeSetFirestoreDocumentDataAccessorWrapper<T extends object, D = DocumentData> extends AbstractFirestoreDocumentDataAccessorWrapper<T, D> {
  readonly modifier: ModifierFunction<ModifyBeforeSetFistoreDataAccessorInput<T>>;
  override readonly set: FirestoreDocumentDataAccessorSetFunction<T>;

  constructor(
    accessor: FirestoreDocumentDataAccessor<T, D>,
    readonly config: ModifyBeforeSetConfig<T>
  ) {
    super(accessor);
    const when = config.when;
    this.modifier = mergeModifiers(asArray(config.modifier));

    let setFn: FirestoreDocumentDataAccessorSetFunction<T>;

    const modifyData = (data: PartialWithFieldValue<T> | WithFieldValue<T>, options?: SetOptions) => {
      const copy = { ...data };
      const input: ModifyBeforeSetFistoreDataAccessorInput<T> = {
        data: copy,
        documentRef: this.documentRef,
        options
      };

      this.modifier(input);
      return input;
    };

    const modifyAndSet: FirestoreDocumentDataAccessorSetFunction<T> = (data: PartialWithFieldValue<T> | WithFieldValue<T>, options?: SetOptions) => {
      const input = modifyData(data, options);
      return super.set(input.data, options as SetOptions);
    };

    let applyToCreateFunction = false;

    switch (when) {
      case 'always':
        setFn = modifyAndSet;
        applyToCreateFunction = true;
        break;
      case 'set':
        setFn = (data: PartialWithFieldValue<T> | WithFieldValue<T>, options?: SetOptions) => {
          const isSetForNewModel = Boolean(!options);
          if (isSetForNewModel) {
            return modifyAndSet(data);
          } else {
            return super.set(data, options as SetOptions);
          }
        };
        applyToCreateFunction = true;
        break;
      case 'update':
        setFn = (data: PartialWithFieldValue<T> | WithFieldValue<T>, options?: SetOptions) => {
          const isUpdateForExistingModel = options && (Boolean((options as SetOptionsMergeFields).mergeFields) || Boolean((options as SetOptionsMerge).merge));
          if (isUpdateForExistingModel) {
            return modifyAndSet(data);
          } else {
            return super.set(data, options as SetOptions);
          }
        };
        break;
      case 'create':
        setFn = (data: PartialWithFieldValue<T> | WithFieldValue<T>, options?: SetOptions) => super.set(data, options as SetOptions);
        applyToCreateFunction = true;
        break;
    }

    this.set = setFn;

    if (applyToCreateFunction) {
      const modifyAndCreate: FirestoreDocumentDataAccessorCreateFunction<T> = (data: WithFieldValue<T>) => {
        const input = modifyData(data);
        return super.create(input.data as T);
      };

      this.create = modifyAndCreate;
    }
  }
}

// MARK: Modifier Functions
/**
 * Creates a modifier function that copies the document reference's ID into the specified field on the data.
 *
 * Useful for models that need to store their own document ID as a field (e.g., `uid` on {@link UserRelated} models).
 *
 * @param fieldName - The field to copy the document ID into
 * @returns A modifier function that sets the field to the document's ID
 */
export function copyDocumentIdToFieldModifierFunction<T extends object>(fieldName: keyof T): ModifyBeforeSetModifierFunction<T> {
  return ({ data, documentRef }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as unknown as Record<any, string>)[fieldName] = documentRef.id; // copy the id to the target field
  };
}

/**
 * Creates an {@link InterceptAccessorFactoryFunction} that wraps all created accessors with
 * {@link ModifyBeforeSetFirestoreDocumentDataAccessorWrapper} using the provided config.
 *
 * @param config - The ModifyBeforeSetConfig defining when and how to modify documents
 * @returns An InterceptAccessorFactoryFunction that wraps accessors with the modify-before-set behavior
 */
export function modifyBeforeSetInterceptAccessorFactoryFunction<T extends object, D = DocumentData>(config: ModifyBeforeSetConfig<T>): InterceptAccessorFactoryFunction<T, D> {
  return interceptAccessorFactoryFunction((accessor) => new ModifyBeforeSetFirestoreDocumentDataAccessorWrapper(accessor, config));
}

// MARK: Templates
/**
 * Creates a modifier that copies the document ID to the `uid` field for {@link UserRelated} models.
 *
 * @returns A ModifyBeforeSetModifierFunction that sets the `uid` field to the document's ID
 */
export function copyDocumentIdForUserRelatedModifierFunction<T extends UserRelated>(): ModifyBeforeSetModifierFunction<T> {
  return copyDocumentIdToFieldModifierFunction<T>('uid');
}

/**
 * Returns a pre-configured {@link ModifyBeforeSetConfig} for {@link UserRelated} models
 * that copies the document ID to the `uid` field on set operations (new document creation).
 *
 * @returns A ModifyBeforeSetConfig configured to copy the document ID to the `uid` field on set
 */
export function copyUserRelatedDataModifierConfig<T extends UserRelated>(): ModifyBeforeSetConfig<T> {
  return {
    when: 'set',
    modifier: copyDocumentIdForUserRelatedModifierFunction()
  };
}

/**
 * Cached singleton factory for the UserRelated data modifier accessor interceptor.
 */
export const COPY_USER_RELATED_DATA_ACCESSOR_FACTORY_FUNCTION = cachedGetter(() => modifyBeforeSetInterceptAccessorFactoryFunction(copyUserRelatedDataModifierConfig()));

/**
 * Returns a typed {@link InterceptAccessorFactoryFunction} that applies the UserRelated
 * document ID copy modifier to all accessors created by the factory.
 *
 * @returns A typed InterceptAccessorFactoryFunction with the UserRelated document ID copy modifier applied
 */
export function copyUserRelatedDataAccessorFactoryFunction<T extends UserRelated, D = DocumentData>(): InterceptAccessorFactoryFunction<T, D> {
  return COPY_USER_RELATED_DATA_ACCESSOR_FACTORY_FUNCTION() as unknown as InterceptAccessorFactoryFunction<T, D>;
}
