import { objectHasKey } from '../object';
import { Maybe } from '../value/maybe';

export type CopySelectModelFieldsConfig<T = unknown> = Partial<CopyModelFieldsConfig<T>>;

export type CopyModelFieldsConfig<T = unknown> = {
  [K in keyof T]: Maybe<CopyModelFieldConfig>;
};

export interface CopyModelFieldConfig<V = unknown> {
  /**
   * Default value if not presented. If default is not defined and there is no value, the key will be ignored entirely.
   */
  default?: V;
}

/**
 * Used for copying one field from one partial object to a target object.
 */
export type CopyModelFieldFunction<T> = (from: Partial<T>, target: Partial<T>) => void;

export function makeCopyModelFieldFunction<T extends object>(key: keyof T, inputConfig?: Maybe<CopyModelFieldConfig>): CopyModelFieldFunction<T> {
  const config = inputConfig ?? {};
  const hasDefault = objectHasKey(config, 'default');
  const defaultValue = config.default as T[keyof T];

  return (from: Partial<T>, target: Partial<T>) => {
    if (objectHasKey(from, key)) {
      target[key] = from[key] ?? defaultValue;
    } else if (hasDefault) {
      target[key] = defaultValue;
    }
  };
}
