import { type Observable, combineLatest, map, shareReplay } from 'rxjs';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type ChecklistItemDisplayContent } from './checklist.item';
import { type Configurable, type KeyValueTransformMap, addPlusPrefixToNumber, type Maybe } from '@dereekb/util';
import { checklistItemField, type ChecklistItemFieldBuilderInput } from './checklist.item.field';

export type ChecklistItemFieldDataSetFieldKey<D> = keyof D & string;
export type ChecklistItemFieldDataSetFieldValueForKey<D, K extends keyof D = keyof D> = D[K];
export type ChecklistType<D> = KeyValueTransformMap<D, boolean>;

export type ChecklistItemFieldDataSetBuilderInput<D, T> = { key: ChecklistItemFieldDataSetFieldKey<D> } & ChecklistItemFieldBuilderInput<T>;

export interface ChecklistItemFieldDataSetItem<D, T extends ChecklistType<D>> {
  /**
   * Key for the field.
   */
  readonly key: ChecklistItemFieldDataSetFieldKey<T>;
  /**
   * Base field configuration to use.
   */
  readonly field: ChecklistItemFieldBuilderInput<T>;
}

/**
 * Used for building a set of configurations for a data-type object that has as second object that is used as a checklist.
 */
export class ChecklistItemFieldDataSetBuilder<D extends object, C extends ChecklistType<D> = ChecklistType<D>> {
  private readonly _fields = new Map<ChecklistItemFieldDataSetFieldKey<C>, ChecklistItemFieldDataSetItem<D, ChecklistType<D>>>();

  readonly dataObs$: Observable<D>;

  constructor(dataObs: Observable<D>) {
    this.dataObs$ = dataObs;
  }

  /**
   * Merges the input config with existing configuration.
   *
   * The displayContentObs, if provided, will merge with the existing observable and the two objects merged.
   */
  merge<T>(key: ChecklistItemFieldDataSetFieldKey<D>, config: Partial<ChecklistItemFieldBuilderInput<T>>) {
    const currentField = this._assertFieldExists(key).field;
    const mergedConfig: Configurable<ChecklistItemFieldDataSetBuilderInput<D, T>> = {
      ...currentField,
      ...config,
      key
    } as any;

    if (currentField.displayContent && config.displayContent) {
      mergedConfig.displayContent = combineLatest([currentField.displayContent, config.displayContent]).pipe(
        map(([a, b]) => {
          const result = {
            ...a,
            ...b
          };

          // console.log('A and b: ', a, b, result);
          return result;
        }),
        shareReplay(1)
      );
    }

    // console.log('Merged: ', mergedConfig);

    this.field(mergedConfig);
  }

  override<T>(key: ChecklistItemFieldDataSetFieldKey<D>, config: Partial<ChecklistItemFieldBuilderInput<T>>) {
    const currentField = this._assertFieldExists(key);

    this.field({
      ...currentField.field,
      ...config,
      key
    });
  }

  _assertFieldExists(key: ChecklistItemFieldDataSetFieldKey<D>): ChecklistItemFieldDataSetItem<D, any> {
    const currentField = this._fields.get(key);

    if (!currentField) {
      throw new Error(`Expected field with key "${key}" for override() but was unavailable.`);
    }

    return currentField;
  }

  showValueFieldArrayCount<T extends ChecklistItemFieldDataSetFieldValueForKey<D> & Array<unknown>>(key: ChecklistItemFieldDataSetFieldKey<D>, config?: Partial<ChecklistItemFieldDataSetBuilderInput<D, T>>) {
    return this.field({
      displayContent: this.contentWithDisplayValueFromData(key, (x: T) => addPlusPrefixToNumber(x?.length)),
      ...config,
      key
    });
  }

  showValueField<T extends ChecklistItemFieldDataSetFieldValueForKey<D> = ChecklistItemFieldDataSetFieldValueForKey<D>>(key: ChecklistItemFieldDataSetFieldKey<D>, config?: Partial<ChecklistItemFieldDataSetBuilderInput<D, T>>, labelFn: (value: T) => Maybe<string> = (x: T) => (x as unknown as object | number | string)?.toString()) {
    return this.field({
      displayContent: this.contentWithDisplayValueFromData(key, labelFn),
      ...config,
      key
    });
  }

  field<T>(config: ChecklistItemFieldDataSetBuilderInput<D, T>) {
    const key = config.key;

    const field: ChecklistItemFieldDataSetItem<D, ChecklistType<D>> = {
      key,
      field: config as unknown as ChecklistItemFieldBuilderInput<ChecklistType<D>>
    };

    this._fields.set(key, field);
  }

  // MARK: Build/Finish
  build(): FormlyFieldConfig[] {
    return Array.from(this._fields.values()).map(({ field }) => {
      return checklistItemField(field);
    });
  }

  // MARK: Utility
  customContentFromData<T extends ChecklistItemFieldDataSetFieldValueForKey<D> = ChecklistItemFieldDataSetFieldValueForKey<D>>(mapFn: (data: D) => ChecklistItemDisplayContent<T>): Observable<ChecklistItemDisplayContent<T>> {
    return this.dataObs$.pipe(map(mapFn));
  }

  contentWithValueFromData<K extends keyof D = keyof D, T extends ChecklistItemFieldDataSetFieldValueForKey<D> = ChecklistItemFieldDataSetFieldValueForKey<D>>(key: K, contentFn?: (value: T) => ChecklistItemDisplayContent<T>): Observable<ChecklistItemDisplayContent<T>> {
    return this.customContentFromData((data) => {
      const meta = data[key] as unknown as T;
      const content = contentFn?.(meta);

      return {
        meta,
        ...content
      };
    });
  }

  contentWithDisplayValueFromData<T extends ChecklistItemFieldDataSetFieldValueForKey<D> = ChecklistItemFieldDataSetFieldValueForKey<D>>(key: ChecklistItemFieldDataSetFieldKey<D>, labelFn: (value: T) => Maybe<string> = (x: T) => (x as unknown as object | number | string)?.toString()): Observable<ChecklistItemDisplayContent<T>> {
    function sanitizeLabel(label: Maybe<string>): string {
      return label ?? 'N/A';
    }

    return this.contentWithValueFromData(key, (value: T) => ({ label: sanitizeLabel(labelFn(value)) }));
  }
}
