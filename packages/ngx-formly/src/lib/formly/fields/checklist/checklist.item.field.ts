import { Observable, combineLatest } from 'rxjs';
import { KeyValueTransformMap } from './../../../utility/types';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { FieldConfig, formlyField } from '../field';
import { DbNgxChecklistItemFieldConfig, ChecklistItemFormlyFieldConfig } from './checklist.item.field.component';
import { map, shareReplay } from 'rxjs/operators';
import { ChecklistItemDisplayContent, ChecklistItemFieldDisplayContentObs } from './checklist.item';
import { addPlusPrefixToNumber } from '@/app/common/utility/string';

export interface ChecklistItemFieldConfig<T = any> extends FieldConfig, DbNgxChecklistItemFieldConfig<T> { }
export type ChecklistItemFieldBuilderInput<T = any> = Partial<ChecklistItemFieldConfig<T>> & Pick<ChecklistItemFieldConfig<T>, 'key' | 'displayContentObs'>;

export function checklistItemField<T = any>({
  key,
  label = '',
  placeholder = '',
  displayContentObs,
  componentClass,
  required = false
}: ChecklistItemFieldBuilderInput<T>
): ChecklistItemFormlyFieldConfig<T> {
  const fieldConfig: ChecklistItemFormlyFieldConfig = formlyField({
    key,
    type: 'checklistitem',
    templateOptions: {
      label,
      placeholder,
      required
    },
    displayContentObs,
    componentClass
  });

  return fieldConfig;
}

export type ChecklistItemFieldDataSetFieldKey<D> = keyof D & string;
export type ChecklistItemFieldDataSetFieldValueForKey<D, K extends keyof D = keyof D> = D[K];
export type ChecklistType<D> = KeyValueTransformMap<D, boolean>;

export type ChecklistItemFieldDataSetBuilderInput<D, T> = { key: ChecklistItemFieldDataSetFieldKey<D> } & ChecklistItemFieldBuilderInput<T>;

export interface ChecklistItemFieldDataSetItem<D, T extends ChecklistType<D>> {
  /**
   * Key for the field.
   */
  key: ChecklistItemFieldDataSetFieldKey<T>;
  /**
   * Base field configuration to use.
   */
  field: ChecklistItemFieldBuilderInput<T>;
}

/**
 * Used for building a set of configurations for a data-type object that has as second object that is used as a checklist.
 */
export class ChecklistItemFieldDataSetBuilder<D extends object, C extends ChecklistType<D> = ChecklistType<D>> {

  private _fields = new Map<ChecklistItemFieldDataSetFieldKey<C>, ChecklistItemFieldDataSetItem<D, any>>();

  readonly dataObs$ = this.dataObs;

  constructor(readonly dataObs: Observable<D>) { }

  /**
   * Merges the input config with existing configuration.
   * 
   * The displayContentObs, if provided, will merge with the existing observable and the two objects merged.
   */
  merge<T>(key: ChecklistItemFieldDataSetFieldKey<D>, config: Partial<ChecklistItemFieldBuilderInput<T>>) {
    const currentField = this._assertFieldExists(key).field;
    const mergedConfig: ChecklistItemFieldDataSetBuilderInput<D, T> = {
      ...currentField,
      ...config,
      key
    } as any;

    if (currentField.displayContentObs && config.displayContentObs) {
      mergedConfig.displayContentObs = combineLatest([
        currentField.displayContentObs,
        config.displayContentObs
      ]).pipe(
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

  showValueFieldArrayCount<T extends ChecklistItemFieldDataSetFieldValueForKey<D> & Array<any>>(key: ChecklistItemFieldDataSetFieldKey<D>, config?: Partial<ChecklistItemFieldDataSetBuilderInput<D, T>>) {
    return this.field({
      displayContentObs: this.contentWithDisplayValueFromData(key, (x: T) => addPlusPrefixToNumber(x?.length)),
      ...config,
      key
    });
  }

  showValueField<T extends ChecklistItemFieldDataSetFieldValueForKey<D> = ChecklistItemFieldDataSetFieldValueForKey<D>>(key: ChecklistItemFieldDataSetFieldKey<D>, config?: Partial<ChecklistItemFieldDataSetBuilderInput<D, T>>, labelFn: (value: T) => string = (x) => x?.toString()) {
    return this.field({
      displayContentObs: this.contentWithDisplayValueFromData(key, labelFn),
      ...config,
      key
    });
  }

  field<T>(config: ChecklistItemFieldDataSetBuilderInput<D, T>) {
    const key = config.key;

    this._fields.set(key, {
      key,
      field: config
    });
  }

  // MARK: Build/Finish
  build(): FormlyFieldConfig[] {
    return Array.from(this._fields.values()).map(({ field }) => {
      return checklistItemField(field);
    });
  }

  // MARK: Utility
  customContentFromData<T extends ChecklistItemFieldDataSetFieldValueForKey<D> = ChecklistItemFieldDataSetFieldValueForKey<D>>(mapFn: (data: D) => ChecklistItemDisplayContent): ChecklistItemFieldDisplayContentObs<T> {
    return this.dataObs$.pipe(map(mapFn));
  }

  contentWithValueFromData<K extends keyof D = keyof D, T extends ChecklistItemFieldDataSetFieldValueForKey<D> = ChecklistItemFieldDataSetFieldValueForKey<D>>(key: K, contentFn?: (value: T) => ChecklistItemDisplayContent): ChecklistItemFieldDisplayContentObs<T> {
    return this.customContentFromData((data) => {
      const meta = data[key] as any as T;
      const content = contentFn(meta);

      return {
        meta,
        ...content
      };
    });
  }

  contentWithDisplayValueFromData<T extends ChecklistItemFieldDataSetFieldValueForKey<D> = ChecklistItemFieldDataSetFieldValueForKey<D>>(key: ChecklistItemFieldDataSetFieldKey<D>, labelFn: (value: T) => string = (x) => x?.toString()): ChecklistItemFieldDisplayContentObs<T> {
    function sanitizeLabel(label: string) {
      return label ?? 'N/A';
    }

    return this.contentWithValueFromData(key, (value: T) => ({ label: sanitizeLabel(labelFn(value)) }));
  }

}
