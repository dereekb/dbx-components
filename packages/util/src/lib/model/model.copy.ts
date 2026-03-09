import { objectHasKey } from '../object';
import { type Maybe } from '../value/maybe.type';

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

/**
 * Creates a function that copies a single field from a partial source object to a partial target object.
 *
 * If the field exists on the source, its value (or the configured default if null) is assigned to the target.
 * If the field does not exist on the source but a default is configured, the default is used.
 * Otherwise, the target is left unchanged.
 *
 * @param key - The property key to copy
 * @param inputConfig - Optional config with a default value for the field
 * @returns A function that copies the field from source to target
 */
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
