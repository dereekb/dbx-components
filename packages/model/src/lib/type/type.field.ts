/**
 * Two checks for hand-edited config objects whose errors an operator reads — a JSON config file's entries, a host
 * extension's own keys. arktype does the validating; {@link parseArktypeFieldsWithMessages} turns its first error into
 * an operator-facing message (`<label>.<field> must <rule> (got <value>). <remedy>`), and {@link assertObjectKeys}
 * reports a retired or unknown key before any field is read.
 *
 * Every message is prefixed with an optional schema label (`'my-app config: '`) and names the object by a label the
 * caller chooses (`"config.json providers['gateway']"`), so a caller's messages read the same at every level.
 */

import { filterUndefinedValues, isPlainObject, type Maybe } from '@dereekb/util';
import { ArkErrors, type Type } from 'arktype';

// MARK: Keys
/**
 * Input to {@link assertObjectKeys}.
 */
export interface AssertObjectKeysConfig {
  /**
   * The schema label every message is prefixed with (`my-app config`). Omitted ⇒ no prefix.
   */
  readonly schemaLabel?: Maybe<string>;
  /**
   * What the message names as the object (`config.json providers['gateway']`).
   */
  readonly label: string;
  /**
   * The object whose keys are checked.
   */
  readonly entry: Readonly<Record<string, unknown>>;
  /**
   * Retired keys → the remedy sentence that tells the operator what replaced them. Checked BEFORE the allowed list, so a
   * retired key reports its remedy rather than reading as a typo.
   */
  readonly retired?: Maybe<ReadonlyMap<string, string>>;
  /**
   * The allowed keys, in the order the message lists them. Omitted ⇒ only the retired check runs (an extensible level
   * whose extension keys are checked by the extension).
   */
  readonly allowed?: Maybe<ReadonlyArray<string>>;
}

/**
 * The prefix a message carries for a schema label (`'my-app config: '`), or `''`.
 *
 * @param schemaLabel - The schema label, if any.
 * @returns The message prefix.
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind function
 * @dbxUtilTags validator, arktype, config, error-message, keys
 *
 * @example
 * ```ts
 * schemaLabelMessagePrefix('my-app config'); // 'my-app config: '
 * schemaLabelMessagePrefix(undefined); // ''
 * ```
 */
export function schemaLabelMessagePrefix(schemaLabel: Maybe<string>): string {
  return schemaLabel ? `${schemaLabel}: ` : '';
}

/**
 * Fail loud on a retired key (with its remedy), then on any key outside {@link AssertObjectKeysConfig.allowed}.
 *
 * @param input - The labels, the object, and the retired / allowed key lists.
 * @throws {Error} On the first retired or unknown key.
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind function
 * @dbxUtilTags validator, arktype, config, error-message, keys
 *
 * @example
 * ```ts
 * assertObjectKeys({ schemaLabel: 'my-app config', label: 'widget', entry: { nmae: 'a' }, allowed: ['name', 'size'] });
 * // throws "my-app config: widget has unknown key 'nmae' (allowed: name, size)."
 * ```
 */
export function assertObjectKeys(input: AssertObjectKeysConfig): void {
  const { label, entry, retired, allowed } = input;
  const prefix = schemaLabelMessagePrefix(input.schemaLabel);
  const keys = Object.keys(entry);

  for (const key of keys) {
    const remedy = retired?.get(key);

    if (remedy != null) {
      throw new Error(`${prefix}${label} has retired key '${key}'. ${remedy}`);
    }
  }

  if (allowed != null) {
    for (const key of keys) {
      if (!allowed.includes(key)) {
        throw new Error(`${prefix}${label} has unknown key '${key}' (allowed: ${allowed.join(', ')}).`);
      }
    }
  }
}

// MARK: Field rules
/**
 * What an operator is told when one field fails: `<label>.<field> must <must> (got <value>). <remedy>`.
 */
export interface ArktypeFieldRule {
  /**
   * The requirement, completing "must …" (`'be a boolean'`, `'be one of low, medium, high'`).
   */
  readonly must: string;
  /**
   * An optional sentence appended after the value (`'Remove the key to use the default size.'`).
   */
  readonly remedy?: Maybe<string>;
  /**
   * For a nested object field: the rules of ITS fields, so a nested failure names `field.nestedField`.
   */
  readonly fields?: Maybe<Readonly<Record<string, ArktypeFieldRule>>>;
  /**
   * For a nested object field: its allowed keys, in order — an unknown nested key fails loud.
   */
  readonly keys?: Maybe<ReadonlyArray<string>>;
}

/**
 * One {@link ArktypeFieldRule} per key of `T` — exhaustive, so a field added to a declaration without a message fails
 * to compile.
 */
export type ArktypeFieldRules<T> = { readonly [K in keyof T & string]-?: ArktypeFieldRule };

/**
 * Config for {@link parseArktypeFieldsWithMessages}.
 */
export interface ParseArktypeFieldsWithMessagesConfig<T extends object> {
  /**
   * The schema label every message is prefixed with. Omitted ⇒ no prefix.
   */
  readonly schemaLabel?: Maybe<string>;
  /**
   * What the message names as the object (`widgets['main']`).
   */
  readonly label: string;
  /**
   * The object to validate (the caller has already checked it is a plain object and checked its top-level keys).
   */
  readonly value: Readonly<Record<string, unknown>>;
  /**
   * The arktype object type that validates the fields. An extension declares its own with `'+': 'delete'` so the
   * result carries only its keys.
   */
  readonly type: Type<T>;
  /**
   * The checked keys in message order: when several fields fail, the first in this list is reported.
   */
  readonly keys: ReadonlyArray<keyof T & string>;
  /**
   * The message rule per key.
   */
  readonly rules: ArktypeFieldRules<T>;
}

/**
 * Render a raw value for a `(got …)` clause.
 *
 * @param value - The raw value.
 * @returns Its JSON rendering; `undefined` and non-finite numbers by `String`.
 */
function arktypeFieldGotValue(value: unknown): string {
  return value === undefined || (typeof value === 'number' && !Number.isFinite(value)) ? String(value) : JSON.stringify(value);
}

/**
 * Render a rule's remedy as the sentence appended after a message, or `''`.
 *
 * @param remedy - The rule's remedy, if any.
 * @returns The remedy prefixed by one space, or `''`.
 */
function arktypeFieldRemedySuffix(remedy: Maybe<string>): string {
  return remedy ? ` ${remedy}` : '';
}

/**
 * Drops the `undefined`-valued keys of `value`, at the top level and inside each nested rule object, so they read as
 * "absent" (arktype rejects an explicit `undefined` for an optional key). The input is not modified.
 *
 * @param value - The object.
 * @param rules - The rules, naming which keys are nested objects.
 * @returns The stripped copy.
 */
function stripUndefinedArktypeFieldValues(value: Readonly<Record<string, unknown>>, rules: Readonly<Record<string, ArktypeFieldRule>>): Record<string, unknown> {
  const out = filterUndefinedValues({ ...value });

  for (const [key, rule] of Object.entries(rules)) {
    const nested = out[key];

    if (rule.fields != null && isPlainObject(nested)) {
      out[key] = stripUndefinedArktypeFieldValues(nested, rule.fields);
    }
  }

  return out;
}

/**
 * Validate an object's fields with an arktype type and report the FIRST failing field (by
 * {@link ParseArktypeFieldsWithMessagesConfig.keys} order) as `<label>.<field> must <rule> (got <value>). <remedy>`.
 * Nested rule objects get their unknown keys checked first. A field set to `undefined` counts as absent.
 *
 * A caller that needs a canonical key order (or trimming) assembles its own result from the returned value; an
 * extension can return it as-is.
 *
 * @param config - The labels, the object, the type, the key order and the rules.
 * @returns The validated value, typed by the arktype type.
 * @throws {Error} On an unknown nested key or the first failing field.
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind function
 * @dbxUtilTags validator, arktype, config, error-message, keys
 *
 * @example
 * ```ts
 * const widgetType = type({ name: 'string > 0', 'size?': 'number.integer > 0' });
 *
 * parseArktypeFieldsWithMessages({
 *   schemaLabel: 'my-app config',
 *   label: 'widget',
 *   value: { name: 'a', size: 0 },
 *   type: widgetType,
 *   keys: ['name', 'size'],
 *   rules: { name: { must: 'be a non-empty name' }, size: { must: 'be a positive integer', remedy: 'Remove the key to use the default size.' } }
 * });
 * // throws "my-app config: widget.size must be a positive integer (got 0). Remove the key to use the default size."
 * ```
 */
export function parseArktypeFieldsWithMessages<T extends object>(config: ParseArktypeFieldsWithMessagesConfig<T>): Type<T>['infer'] {
  const { schemaLabel, label, value, type, keys, rules } = config;
  const ruleMap: Readonly<Record<string, ArktypeFieldRule>> = rules;
  const keyList: ReadonlyArray<string> = keys;

  for (const key of keyList) {
    const rule = ruleMap[key];
    const nested = value[key];

    if (rule.keys != null && isPlainObject(nested)) {
      assertObjectKeys({ schemaLabel, label: `${label}.${key}`, entry: nested, allowed: rule.keys });
    }
  }

  const stripped = stripUndefinedArktypeFieldValues(value, ruleMap);
  const result = type(stripped);

  if (result instanceof ArkErrors) {
    const rank = (path: ReadonlyArray<PropertyKey>): [number, number] => {
      const first = keyList.indexOf(String(path[0]));
      const nestedKeys = ruleMap[String(path[0])]?.keys ?? [];
      return [first < 0 ? keyList.length : first, path.length > 1 ? nestedKeys.indexOf(String(path[1])) : -1];
    };

    const [error] = Array.from(result).sort((a, b) => {
      const [a0, a1] = rank(a.path);
      const [b0, b1] = rank(b.path);
      return a0 - b0 || a1 - b1;
    });

    const key = String(error.path[0]);
    const rule: Maybe<ArktypeFieldRule> = ruleMap[key];
    const nestedKey = error.path.length > 1 ? String(error.path[1]) : undefined;
    const nestedRule = nestedKey == null ? undefined : rule?.fields?.[nestedKey];
    const prefix = schemaLabelMessagePrefix(schemaLabel);
    let message: string;

    if (rule == null) {
      message = `${prefix}${label} ${result.summary}`;
    } else if (nestedRule != null && nestedKey != null) {
      const raw = stripped[key];
      const got = isPlainObject(raw) ? raw[nestedKey] : undefined;
      message = `${prefix}${label}.${key}.${nestedKey} must ${nestedRule.must} (got ${arktypeFieldGotValue(got)}).${arktypeFieldRemedySuffix(nestedRule.remedy)}`;
    } else {
      message = `${prefix}${label}.${key} must ${rule.must} (got ${arktypeFieldGotValue(stripped[key])}).${arktypeFieldRemedySuffix(rule.remedy)}`;
    }

    throw new Error(message);
  }

  return result;
}
