import { type Maybe } from '@dereekb/util';
import { ArkErrors, type Type } from 'arktype';
import { OPENROUTER_TEMPLATE_BANNED_NAMES, OpenRouterTemplateRenderError } from './openrouter.template';
import { type OpenRouterTemplateLoaderOutput, type OpenRouterTemplateLoaders, type OpenRouterTemplateLoadersData, type OpenRouterTemplateModelOutput, type OpenRouterTemplateTypeConfig } from './openrouter.template.type';

/**
 * The deepest plain data handed to a script may nest.
 */
export const OPENROUTER_TEMPLATE_PLAIN_DATA_MAX_DEPTH = 32;

/**
 * The context a template body runs with: the validated input and one memoized function per loader.
 */
export type OpenRouterTemplateContext<I = any, L extends OpenRouterTemplateLoaders<I> = OpenRouterTemplateLoaders<I>> = { readonly input: I } & { readonly [K in keyof L]: () => Promise<OpenRouterTemplateLoaderOutput<L[K]>> };

/**
 * The context a final script runs with. In the modes with a body it also carries the body's context, with the same memoized
 * loaders; in {@link OpenRouterTemplateMode.OPENROUTER} mode it carries only `output`.
 */
export type OpenRouterTemplateFinalContext<I = any, L extends OpenRouterTemplateLoaders<I> = OpenRouterTemplateLoaders<I>> = Partial<OpenRouterTemplateContext<I, L>> & { readonly output: OpenRouterTemplateModelOutput };

/**
 * Config for {@link openRouterTemplateContext}.
 */
export interface OpenRouterTemplateContextConfig<I = any, L extends OpenRouterTemplateLoaders<I> = OpenRouterTemplateLoaders<I>> {
  /**
   * The template type.
   */
  readonly typeConfig: OpenRouterTemplateTypeConfig<I, L>;
  /**
   * The raw template input. Validated against the type's input shape, with undeclared keys stripped.
   */
  readonly input: unknown;
  /**
   * Data that stands in for a loader's output, keyed by loader name. Used by preview. The data is checked the same way a real
   * loader's output is.
   */
  readonly loaderOverrides?: Maybe<Partial<OpenRouterTemplateLoadersData<L>>>;
}

/**
 * Recursively freezes plain data.
 *
 * @param value - The data to freeze.
 * @returns The same data, frozen.
 */
export function deepFreezeOpenRouterTemplateData<T>(value: T): T {
  if (value != null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach((x) => deepFreezeOpenRouterTemplateData(x));
  }

  return value;
}

/**
 * Deep-copies a value, refusing anything that is not plain data.
 *
 * Plain data is plain objects (an `Object.prototype` or null prototype, no accessors), arrays, strings, finite numbers,
 * booleans and null. Anything else is refused: a Firestore snapshot, `DocumentReference` or `Timestamp`, a `Date`, a class
 * instance, a function, a cycle. An `undefined` object value is dropped, and a banned key such as `__proto__` is never
 * copied.
 *
 * @param value - The value to copy.
 * @param label - What the value is, for the error message.
 * @returns The copy.
 * @throws {OpenRouterTemplateRenderError} When the value is not plain data.
 */
export function copyOpenRouterTemplatePlainData(value: unknown, label: string): unknown {
  const ancestors = new Set<object>();

  function fail(path: string, reason: string): never {
    throw new OpenRouterTemplateRenderError(`${label} is not plain data at \`${path || '(root)'}\`: ${reason}`);
  }

  function copy(x: unknown, path: string, depth: number): unknown {
    let result: unknown;

    if (depth > OPENROUTER_TEMPLATE_PLAIN_DATA_MAX_DEPTH) {
      fail(path, `it nests deeper than ${OPENROUTER_TEMPLATE_PLAIN_DATA_MAX_DEPTH} levels.`);
    }

    if (x === null || typeof x === 'string' || typeof x === 'boolean') {
      result = x;
    } else if (typeof x === 'number') {
      if (!Number.isFinite(x)) {
        fail(path, 'numbers must be finite.');
      }

      result = x;
    } else if (typeof x === 'object') {
      if (ancestors.has(x)) {
        fail(path, 'it contains a cycle.');
      }

      ancestors.add(x);

      if (Array.isArray(x)) {
        if (Object.getPrototypeOf(x) !== Array.prototype) {
          fail(path, 'arrays must be plain arrays.');
        }

        result = x.map((item, i) => {
          if (item === undefined) {
            fail(`${path}[${i}]`, 'arrays cannot hold undefined.');
          }

          return copy(item, `${path}[${i}]`, depth + 1);
        });
      } else {
        const proto = Object.getPrototypeOf(x);

        if (proto !== Object.prototype && proto !== null) {
          fail(path, `found a ${(x as { constructor?: { name?: string } }).constructor?.name ?? 'class'} instance; only plain objects are allowed.`);
        }

        const target: Record<string, unknown> = {};

        Object.entries(Object.getOwnPropertyDescriptors(x)).forEach(([key, descriptor]) => {
          if (descriptor.get != null || descriptor.set != null) {
            fail(`${path}.${key}`, 'accessors are not allowed.');
          }

          if (descriptor.enumerable && descriptor.value !== undefined && !OPENROUTER_TEMPLATE_BANNED_NAMES.has(key)) {
            target[key] = copy(descriptor.value, path ? `${path}.${key}` : key, depth + 1);
          }
        });

        result = target;
      }

      ancestors.delete(x);
    } else {
      fail(path, `found a ${typeof x}.`);
    }

    return result;
  }

  return copy(value, '', 0);
}

const DELETE_UNDECLARED_KEYS_TYPE_CACHE = new WeakMap<Type<unknown>, Type<unknown>>();

/**
 * Copies data handed to a script: checks it is plain data, deep-copies it, validates it against its declared shape, strips
 * undeclared keys and deep-freezes the result.
 *
 * @param value - The data.
 * @param shape - The declared shape.
 * @param label - What the data is, for the error message.
 * @returns The validated, stripped, frozen copy.
 * @throws {OpenRouterTemplateRenderError} When the data is not plain data or does not match the shape.
 */
export function sanitizeOpenRouterTemplateData<T>(value: unknown, shape: Type<T>, label: string): T {
  const copied = copyOpenRouterTemplatePlainData(value, label);
  const key = shape as Type<unknown>;
  let stripping = DELETE_UNDECLARED_KEYS_TYPE_CACHE.get(key);

  if (stripping == null) {
    stripping = key.onDeepUndeclaredKey('delete') as Type<unknown>;
    DELETE_UNDECLARED_KEYS_TYPE_CACHE.set(key, stripping);
  }

  const result = stripping(copied);

  if (result instanceof ArkErrors) {
    throw new OpenRouterTemplateRenderError(`${label} does not match its declared shape: ${result.summary}`);
  }

  return deepFreezeOpenRouterTemplateData(result as T);
}

/**
 * Builds the context a template body runs with.
 *
 * - The context is a frozen object with a null prototype: `{ input, loadX… }`.
 * - The input is validated against the type's input shape, stripped of undeclared keys, deep-copied and deep-frozen.
 * - Each loader runs at most once per context (memoized), on the validated input, and only when a script calls it. Its
 *   output is checked to be plain data, then deep-copied, validated against the loader's output shape, stripped and frozen.
 *
 * @param config - The type, the raw input and any loader overrides.
 * @returns The context.
 * @throws {OpenRouterTemplateRenderError} When the input is invalid. A loader's errors surface when it is called.
 */
export function openRouterTemplateContext<I, L extends OpenRouterTemplateLoaders<I>>(config: OpenRouterTemplateContextConfig<I, L>): OpenRouterTemplateContext<I, L> {
  const { typeConfig, input, loaderOverrides } = config;
  const context: Record<string, unknown> = Object.create(null);
  let validatedInput: Maybe<I>;

  if (typeConfig.input != null) {
    validatedInput = sanitizeOpenRouterTemplateData(input, typeConfig.input, 'The template input');
    context['input'] = validatedInput;
  }

  Object.entries(typeConfig.loaders ?? {}).forEach(([name, loader]) => {
    let loaded: Maybe<Promise<unknown>>;

    context[name] = () => {
      if (loaded == null) {
        const hasOverride = loaderOverrides != null && Object.hasOwn(loaderOverrides, name);
        loaded = Promise.resolve()
          .then(() => (hasOverride ? (loaderOverrides as Record<string, unknown>)[name] : loader.load(validatedInput as I)))
          .then((x) => sanitizeOpenRouterTemplateData(x, loader.output, `Loader ${name}'s output`));
      }

      return loaded;
    };
  });

  return Object.freeze(context) as OpenRouterTemplateContext<I, L>;
}

/**
 * Builds the context a final script runs with.
 *
 * @param bodyContext - The body's context, in the modes with a body. Omit it in OPENROUTER mode, where nothing else is passed in.
 * @param output - The model output: its text, and the JSON copied by {@link copyOpenRouterTemplateJsonOutput} when the version
 *   uses a `json_schema` text format.
 * @returns A frozen, null-prototype context carrying the body context's members plus a frozen `output`.
 */
export function openRouterTemplateFinalContext<I, L extends OpenRouterTemplateLoaders<I>>(bodyContext: Maybe<OpenRouterTemplateContext<I, L>>, output: OpenRouterTemplateModelOutput): OpenRouterTemplateFinalContext<I, L> {
  const context: Record<string, unknown> = Object.create(null);

  if (bodyContext != null) {
    Object.assign(context, bodyContext);
  }

  const frozenOutput: Record<string, unknown> = Object.create(null);
  frozenOutput['text'] = output.text;

  if (output.json !== undefined) {
    frozenOutput['json'] = deepFreezeOpenRouterTemplateData(output.json);
  }

  context['output'] = Object.freeze(frozenOutput);
  return Object.freeze(context) as OpenRouterTemplateFinalContext<I, L>;
}

/**
 * Copies a model's parsed JSON output structurally against the version's `json_schema`, keeping only declared keys and plain
 * JSON values of the declared type. Needs no JSON Schema validator: anything that does not fit is dropped, not reported.
 *
 * Follows `type` (a name or a list), `properties`, `items`, `prefixItems`, `anyOf` and `oneOf` (the first branch whose type
 * fits the value). A banned key is never copied.
 *
 * @param value - The parsed JSON output.
 * @param schema - The `json_schema` text format's schema.
 * @returns The frozen copy, or undefined when the value does not fit the schema at all.
 */
export function copyOpenRouterTemplateJsonOutput(value: unknown, schema: Maybe<object>): unknown {
  function jsonType(x: unknown): Maybe<string> {
    let result: Maybe<string>;

    if (x === null) {
      result = 'null';
    } else if (Array.isArray(x)) {
      result = 'array';
    } else if (typeof x === 'number') {
      result = Number.isFinite(x) ? 'number' : undefined;
    } else if (typeof x === 'string' || typeof x === 'boolean') {
      result = typeof x;
    } else if (typeof x === 'object' && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null)) {
      result = 'object';
    }

    return result;
  }

  function fits(x: unknown, node: Record<string, unknown>): boolean {
    const declared = node['type'];
    const actual = jsonType(x);
    let result: boolean;

    if (actual == null) {
      result = false;
    } else if (declared == null) {
      result = true;
    } else {
      const declaredTypes = Array.isArray(declared) ? declared : [declared];
      result = declaredTypes.includes(actual) || (actual === 'number' && declaredTypes.includes('integer') && Number.isInteger(x));
    }

    return result;
  }

  function copy(x: unknown, node: unknown, depth: number): unknown {
    let result: unknown;

    if (depth <= OPENROUTER_TEMPLATE_PLAIN_DATA_MAX_DEPTH && node != null && typeof node === 'object') {
      const schemaNode = node as Record<string, unknown>;
      const branches = (schemaNode['anyOf'] ?? schemaNode['oneOf']) as Maybe<unknown[]>;

      if (Array.isArray(branches)) {
        const branch = branches.find((b) => b != null && typeof b === 'object' && fits(x, b as Record<string, unknown>));
        result = branch == null ? undefined : copy(x, branch, depth + 1);
      } else if (fits(x, schemaNode)) {
        const type = jsonType(x);

        if (type === 'object') {
          const properties = (schemaNode['properties'] ?? {}) as Record<string, unknown>;
          const target: Record<string, unknown> = {};

          Object.entries(properties).forEach(([key, propertySchema]) => {
            if (!OPENROUTER_TEMPLATE_BANNED_NAMES.has(key) && Object.hasOwn(x as object, key)) {
              const copied = copy((x as Record<string, unknown>)[key], propertySchema, depth + 1);

              if (copied !== undefined) {
                target[key] = copied;
              }
            }
          });

          result = target;
        } else if (type === 'array') {
          const prefixItems = schemaNode['prefixItems'] as Maybe<unknown[]>;
          const items = schemaNode['items'];

          result = (x as unknown[])
            .map((item, i) => {
              let itemSchema: unknown = Array.isArray(items) ? items[i] : items;

              if (Array.isArray(prefixItems) && i < prefixItems.length) {
                itemSchema = prefixItems[i];
              }

              return itemSchema == null ? undefined : copy(item, itemSchema, depth + 1);
            })
            .filter((item) => item !== undefined);
        } else {
          result = x;
        }
      }
    }

    return result;
  }

  const copied = schema == null ? undefined : copy(value, schema, 0);
  return deepFreezeOpenRouterTemplateData(copied);
}
