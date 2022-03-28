import { objectHasKey } from '../object';
import { Maybe } from '../value';

export type CopySelectModelFieldsConfig<T = any> = Partial<CopyModelFieldsConfig<T>>;

export type CopyModelFieldsConfig<T = any> = {
  [K in keyof T]: Maybe<CopyModelFieldConfig>;
}

export interface CopyModelFieldConfig<V = any> {

  /**
   * Default value if not presented. If default is not defined and there is no value, the key will be ignored entirely.
   */
  default?: V;

}

/**
 * Used for copying one field from one partial object to a target object.
 */
export type CopyModelFieldFunction<T> = (from: Partial<T>, target: Partial<T>) => void;

export function makeCopyModelFieldFunction<T extends object>(key: keyof T, inputConfig?: Maybe<CopyModelFieldConfig>): (from: Partial<T>, target: Partial<T>) => void {
  const config = inputConfig ?? {};
  const hasDefault = objectHasKey(config, 'default');
  const defaultValue = config.default;

  return (from: Partial<T>, target: Partial<T>) => {
    if (objectHasKey(from, key)) {
      target[key] = from[key] ?? defaultValue;
    } else if (hasDefault) {
      (target as any)[key] = defaultValue;
    }
  };
}
