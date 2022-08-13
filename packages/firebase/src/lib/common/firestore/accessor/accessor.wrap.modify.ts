import { ArrayOrValue, asArray, mergeModifiers, ModifierFunction, cachedGetter } from '@dereekb/util';
import { UserRelated } from '../../../model/user';
import { DocumentReferenceRef } from '../reference';
import { SetOptionsMerge, SetOptionsMergeFields, DocumentData, PartialWithFieldValue, SetOptions, WithFieldValue } from '../types';
import { FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorCreateFunction, FirestoreDocumentDataAccessorSetFunction } from './accessor';
import { AbstractFirestoreDocumentDataAccessorWrapper, interceptAccessorFactoryFunction, InterceptAccessorFactoryFunction } from './accessor.wrap';

// MARK: Set Wrapper
/**
 * Data accessor modes.
 * - always: Always modifies on update, set, or create.
 * - update: Only modifies when calling set with options
 * - set:    Only modifies when calling create or set without options
 * - create: Only modifies on create calls
 */
export type ModifyBeforeSetFistoreDataAccessorMode = 'always' | 'update' | 'set' | 'create';

/**
 * Input fora ModifyBeforeSetFirestoreDocumentDataAccessorWrapper
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
 * FirestoreDocumentDataAccessorWrapper that applies a modifier function to data being set. When the modifier functions are applied can be changed by the mode.
 */
export class ModifyBeforeSetFirestoreDocumentDataAccessorWrapper<T extends object, D = DocumentData> extends AbstractFirestoreDocumentDataAccessorWrapper<T, D> {
  readonly modifier: ModifierFunction<ModifyBeforeSetFistoreDataAccessorInput<T>>;
  override readonly set: FirestoreDocumentDataAccessorSetFunction<T>;

  constructor(accessor: FirestoreDocumentDataAccessor<T, D>, readonly config: ModifyBeforeSetConfig<T>) {
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
 * Creates a ModifyBeforeSetModifierFunction<T> to copy the documentRef's id to the target field on the data.
 *
 * @param fieldName
 * @returns
 */
export function copyDocumentIdToFieldModifierFunction<T extends object>(fieldName: keyof T): ModifyBeforeSetModifierFunction<T> {
  return ({ data, documentRef }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as unknown as Record<any, string>)[fieldName] = documentRef.id; // copy the id to the target field
  };
}

export function modifyBeforeSetInterceptAccessorFactoryFunction<T extends object, D = DocumentData>(config: ModifyBeforeSetConfig<T>): InterceptAccessorFactoryFunction<T, D> {
  return interceptAccessorFactoryFunction((accessor) => new ModifyBeforeSetFirestoreDocumentDataAccessorWrapper(accessor, config));
}

// MARK: Templates
export function copyDocumentIdForUserRelatedModifierFunction<T extends UserRelated>(): ModifyBeforeSetModifierFunction<T> {
  return copyDocumentIdToFieldModifierFunction<T>('uid');
}

/**
 * Returns a pre-configured ModifyBeforeSetConfig<T> for UserRelated models
 * @returns
 */
export function copyUserRelatedDataModifierConfig<T extends UserRelated>(): ModifyBeforeSetConfig<T> {
  return {
    when: 'set',
    modifier: copyDocumentIdForUserRelatedModifierFunction()
  };
}

export const COPY_USER_RELATED_DATA_ACCESSOR_FACTORY_FUNCTION = cachedGetter(() => modifyBeforeSetInterceptAccessorFactoryFunction(copyUserRelatedDataModifierConfig()));

export function copyUserRelatedDataAccessorFactoryFunction<T extends UserRelated, D = DocumentData>(): InterceptAccessorFactoryFunction<T, D> {
  return COPY_USER_RELATED_DATA_ACCESSOR_FACTORY_FUNCTION() as unknown as InterceptAccessorFactoryFunction<T, D>;
}
