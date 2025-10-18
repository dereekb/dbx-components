import { type Getter, type GetterOrValue, type LogicalDate, type Maybe, type ReadableTimeString, asGetter, getValueFromGetter } from '@dereekb/util';

/**
 * A pair of either a logical date or a time string.
 */
export interface DateTimePresetValue {
  /**
   * Logical date to provide.
   */
  logicalDate?: Maybe<LogicalDate>;
  /**
   * Time string value. Ignored if logical date is provided.
   */
  timeString?: Maybe<ReadableTimeString>;
}

/**
 * Configuration for a DateTimePreset
 */
export interface DateTimePresetConfiguration {
  /**
   * Label
   */
  label: GetterOrValue<string>;
  /**
   * Whether or not the value should be retrieved each time or can be cached.
   *
   * Only relevant if a getter is used.
   */
  dynamic?: boolean;
  /**
   * Logical time to provide.
   */
  logicalDate?: Maybe<GetterOrValue<LogicalDate>>;
  /**
   * Time string to return. Ignored if logicalDate is provided.
   */
  timeString?: Maybe<GetterOrValue<ReadableTimeString>>;
}

/**
 * A label and value getter.
 */
export interface DateTimePreset {
  /**
   * Getter for the label
   */
  label: Getter<string>;
  /**
   * Getter for the value
   */
  value: Getter<DateTimePresetValue>;
}

/**
 * Creates a DateTimePreset from a DateTimePresetConfiguration
 *
 * @param config
 */
export function dateTimePreset(config: DateTimePresetConfiguration): DateTimePreset {
  let value: Getter<DateTimePresetValue>;

  if (config.logicalDate) {
    value = () => ({ logicalDate: getValueFromGetter(config.logicalDate) });
  } else if (config.timeString) {
    value = () => ({ timeString: getValueFromGetter(config.timeString) });
  } else {
    value = () => ({ logicalDate: 'now' });
  }

  if (!config.dynamic) {
    value = asGetter(value()); // get/calculate the value now and return it if not dynamic
  }

  return {
    label: asGetter(config.label),
    value
  };
}
