import { type ISO8601DateString, type Maybe, type ModelKey } from '@dereekb/util';
import { ArkErrors, type Type, type } from 'arktype';
import { OPENROUTER_TEMPLATE_ACCESSOR_NAME_REGEX, OPENROUTER_TEMPLATE_BANNED_NAMES, OpenRouterTemplateRenderError } from './openrouter.template';
import { type OpenRouterTemplateModelOutput, type OpenRouterTemplateTypeConfig, OpenRouterTemplateTypeConfigError } from './openrouter.template.type';

/**
 * The deepest plain data handed to a script may nest.
 */
export const OPENROUTER_TEMPLATE_PLAIN_DATA_MAX_DEPTH = 32;

// MARK: Context
/**
 * The notification a template is rendered for, as scripts and accessors see it as `context.notification`.
 *
 * A template renders once per notification, so every field is the same for every recipient and safe for each of them.
 * Recipients, send times, overrides, the creator and the box are deliberately left out.
 */
export interface OpenRouterTemplateNotificationContext {
  /**
   * The Notification document key.
   */
  readonly key: ModelKey;
  /**
   * The notification item's template type (`n.t`), such as `'ORTT'`.
   */
  readonly templateType: string;
  /**
   * When the notification was created, as an ISO 8601 UTC string. Format a human date in an accessor, in the right time zone.
   */
  readonly createdAt: ISO8601DateString;
}

/**
 * The runtime shape of {@link OpenRouterTemplateNotificationContext}. Undeclared keys are stripped.
 */
export const openRouterTemplateNotificationContextType = type({ key: 'string', templateType: 'string', createdAt: 'string' }) as Type<OpenRouterTemplateNotificationContext>;

/**
 * The accessors scripts call as `await context.accessor.<name>()`, keyed by name.
 */
export type OpenRouterTemplateAccessors<A> = { readonly [K in keyof A]: () => Promise<A[K]> };

/**
 * The context a template body runs with.
 *
 * At runtime it is a frozen, null-prototype `{ data, notification, accessor }`. `accessor` is itself a frozen, null-prototype
 * object holding one memoized function per accessor.
 */
export interface OpenRouterTemplateContext<D = any, A = any> {
  /**
   * The template data: the render's data, plain-data copied and deep-frozen. Its shape is not checked at runtime: it comes
   * from the stored notification, so treat it as untrusted input.
   */
  readonly data: D;
  /**
   * The notification the template is rendered for, or null when it is not rendered for one.
   */
  readonly notification: Maybe<OpenRouterTemplateNotificationContext>;
  /**
   * The accessors. Each runs at most once per context, and only when a script calls it.
   */
  readonly accessor: OpenRouterTemplateAccessors<A>;
}

/**
 * The context a final script runs with. In the modes with a body it also carries the body's context, with the same memoized
 * accessors; in {@link OpenRouterTemplateMode.OPENROUTER} mode it carries only `output`.
 */
export type OpenRouterTemplateFinalContext<D = any, A = any> = Partial<OpenRouterTemplateContext<D, A>> & { readonly output: OpenRouterTemplateModelOutput };

// MARK: Plain Data
/**
 * Resolves to `T` when it is plain data — strings, numbers, booleans, null, arrays and plain objects of plain data — and
 * maps anything else (a `Date`, a `Map`, a function) to `never`, so assigning it fails to compile.
 *
 * Structural: a class instance whose fields are all public data passes here. The runtime plain-data copy refuses it.
 */
export type OpenRouterTemplatePlainData<T> =
  T extends Maybe<string | number | boolean>
    ? T
    : T extends (...args: any[]) => any
      ? never
      : T extends readonly (infer E)[]
        ? readonly OpenRouterTemplatePlainData<E>[]
        : T extends object
          ? T extends Date | Map<any, any> | Set<any> | Promise<any> | RegExp
            ? never
            : { readonly [K in keyof T]: OpenRouterTemplatePlainData<T[K]> }
          : never;

/**
 * The result type of a context factory: what each accessor resolves, keyed by accessor name. Plain data only.
 */
export type OpenRouterTemplateAccessorResults<A> = { readonly [K in keyof A]: OpenRouterTemplatePlainData<A[K]> };

// MARK: Context Factory
/**
 * What a context is built from: the template data and, when rendering for a notification, the notification.
 */
export interface OpenRouterTemplateContextSource<D = unknown> {
  /**
   * The template data, plain-data copied and frozen but not shape-checked. An accessor validates what it uses from it.
   */
  readonly data: D;
  /**
   * The notification the template is rendered for.
   */
  readonly notification?: Maybe<OpenRouterTemplateNotificationContext>;
}

/**
 * Server code that produces one accessor's result from the render's frozen source.
 *
 * It returns ONLY what scripts may see: nothing strips extra keys from the result. Format dates server-side, in the right
 * time zone. For a type with `allowMultipleRecipients`, it may only return data that EVERY recipient of the message may see.
 */
export type OpenRouterTemplateAccessorFunction<D, R> = (source: OpenRouterTemplateContextSource<D>) => Promise<R>;

/**
 * The accessor functions of a context factory, keyed by accessor name.
 */
export type OpenRouterTemplateAccessorFunctions<D, A> = { readonly [K in keyof A]: OpenRouterTemplateAccessorFunction<D, A[K]> };

/**
 * Config for {@link openRouterTemplateContextFactory}.
 */
export interface OpenRouterTemplateContextFactoryConfig<D, A> {
  /**
   * The accessors, keyed by the plain name scripts call: `context.accessor.<name>()`.
   */
  readonly accessors?: Maybe<OpenRouterTemplateAccessorFunctions<D, A>>;
}

/**
 * The params a context factory builds one context from.
 */
export interface OpenRouterTemplateContextFactoryParams extends OpenRouterTemplateContextSource<unknown> {
  /**
   * Data that stands in for accessors, keyed by accessor name. Used by preview. It is copied and frozen the same way an
   * accessor's result is.
   */
  readonly accessorOverrides?: Maybe<Readonly<Record<string, unknown>>>;
}

/**
 * Builds the context a template body runs with. Created by {@link openRouterTemplateContextFactory}.
 *
 * Share one factory between template types with the same data, or extend one by spreading its `accessors` into a new factory.
 */
export interface OpenRouterTemplateContextFactory<D = any, A = any> {
  (params: OpenRouterTemplateContextFactoryParams): OpenRouterTemplateContext<D, A>;
  /**
   * The accessor functions. Looked up when a script calls an accessor, so a spec may spy on them.
   */
  readonly accessors: OpenRouterTemplateAccessorFunctions<D, A>;
  /**
   * The accessor names, read by the script checker and the review.
   */
  readonly accessorNames: ReadonlySet<string>;
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
 * Creates a context factory. Call it where the factory is declared, so a bad factory fails at startup.
 *
 * Each context the factory builds:
 * - is a frozen object with a null prototype: `{ data, notification, accessor }`;
 * - carries the data plain-data copied and deep-frozen, but not shape-checked: type the data `D` through the accessors'
 *   source, and validate in an accessor what it uses. An undefined data becomes null;
 * - carries the notification validated, stripped and frozen, or null when there is none;
 * - runs each accessor at most once (memoized), with the frozen `{ data, notification }` source, and only when a script calls
 *   it. Its result is plain-data copied and deep-frozen, but neither validated nor stripped: accessors are server code, and
 *   their result type is checked at compile time. An undefined result becomes null.
 *
 * Refuses an accessor name that is not plain camelCase (`profile`, `upcomingJobs`) or is in
 * {@link OPENROUTER_TEMPLATE_BANNED_NAMES}, and an accessor that is not a function.
 *
 * @param config - The accessors.
 * @returns The factory.
 * @throws {OpenRouterTemplateTypeConfigError} When the config is invalid.
 */
export function openRouterTemplateContextFactory<D, A extends OpenRouterTemplateAccessorResults<A> = {}>(config: OpenRouterTemplateContextFactoryConfig<D, A>): OpenRouterTemplateContextFactory<D, A> {
  const accessors = { ...config.accessors } as OpenRouterTemplateAccessorFunctions<D, A>;
  const accessorFunctions = accessors as Record<string, unknown>;
  const accessorNames: ReadonlySet<string> = new Set(Object.keys(accessors));
  const errors: string[] = [];

  accessorNames.forEach((name) => {
    if (!OPENROUTER_TEMPLATE_ACCESSOR_NAME_REGEX.test(name)) {
      errors.push(`Accessor "${name}" must be a plain camelCase name, such as "profile".`);
    } else if (OPENROUTER_TEMPLATE_BANNED_NAMES.has(name)) {
      errors.push(`"${name}" is a banned name and cannot be an accessor name.`);
    }

    if (typeof accessorFunctions[name] !== 'function') {
      errors.push(`Accessor "${name}" must be a function.`);
    }
  });

  if (errors.length > 0) {
    throw new OpenRouterTemplateTypeConfigError('context factory', errors);
  }

  function createContext(params: OpenRouterTemplateContextFactoryParams): OpenRouterTemplateContext<D, A> {
    const { accessorOverrides } = params;
    const rawData = params.data === undefined ? null : params.data;
    const data = deepFreezeOpenRouterTemplateData(copyOpenRouterTemplatePlainData(rawData, 'The template data'));
    const notification = params.notification == null ? null : sanitizeOpenRouterTemplateData(params.notification, openRouterTemplateNotificationContextType, 'The notification');
    const source: OpenRouterTemplateContextSource<D> = Object.freeze({ data: data as D, notification });
    const accessor: Record<string, unknown> = Object.create(null);

    accessorNames.forEach((name) => {
      let loaded: Maybe<Promise<unknown>>;

      accessor[name] = () => {
        if (loaded == null) {
          const hasOverride = accessorOverrides != null && Object.hasOwn(accessorOverrides, name);
          loaded = Promise.resolve()
            .then(() => (hasOverride ? (accessorOverrides as Readonly<Record<string, unknown>>)[name] : (accessorFunctions[name] as OpenRouterTemplateAccessorFunction<D, unknown>)(source)))
            .then((x) => deepFreezeOpenRouterTemplateData(copyOpenRouterTemplatePlainData(x === undefined ? null : x, `Accessor ${name}'s result`)));
        }

        return loaded;
      };
    });

    const context: Record<string, unknown> = Object.create(null);
    context['data'] = data;
    context['notification'] = notification;
    context['accessor'] = Object.freeze(accessor);
    return Object.freeze(context) as unknown as OpenRouterTemplateContext<D, A>;
  }

  return Object.assign(createContext, { accessors, accessorNames });
}

/**
 * The context factory of a template type that declares none: no accessors.
 */
const DEFAULT_OPENROUTER_TEMPLATE_CONTEXT_FACTORY: OpenRouterTemplateContextFactory = /* @__PURE__ */ openRouterTemplateContextFactory({});

/**
 * Config for {@link openRouterTemplateContext}.
 */
export interface OpenRouterTemplateContextConfig<D = any, A = any> extends OpenRouterTemplateContextFactoryParams {
  /**
   * The template type.
   */
  readonly typeConfig: OpenRouterTemplateTypeConfig<D, A>;
}

/**
 * Builds the context a template body runs with, using the type's context factory, or a factory with no accessors when the
 * type declares none.
 *
 * @param config - The type, the raw data, the notification and any accessor overrides.
 * @returns The context.
 * @throws {OpenRouterTemplateRenderError} When the data or notification is invalid. An accessor's errors surface when it is called.
 */
export function openRouterTemplateContext<D, A>(config: OpenRouterTemplateContextConfig<D, A>): OpenRouterTemplateContext<D, A> {
  const { typeConfig, ...params } = config;
  const factory = (typeConfig.contextFactory ?? DEFAULT_OPENROUTER_TEMPLATE_CONTEXT_FACTORY) as OpenRouterTemplateContextFactory<D, A>;
  return factory(params);
}

/**
 * Builds the context a final script runs with.
 *
 * @param bodyContext - The body's context, in the modes with a body. Omit it in OPENROUTER mode, where nothing else is passed in.
 * @param output - The model output: its text, and the JSON copied by {@link copyOpenRouterTemplateJsonOutput} when the version
 *   uses a `json_schema` text format.
 * @returns A frozen, null-prototype context carrying the body context's members plus a frozen `output`.
 */
export function openRouterTemplateFinalContext<D, A>(bodyContext: Maybe<OpenRouterTemplateContext<D, A>>, output: OpenRouterTemplateModelOutput): OpenRouterTemplateFinalContext<D, A> {
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
  return Object.freeze(context) as OpenRouterTemplateFinalContext<D, A>;
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
