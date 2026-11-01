import { type Maybe, arrayToObject, typedConfigRegistry } from '@dereekb/util';
import { type Type } from 'arktype';
import { OPENROUTER_TEMPLATE_BANNED_NAMES, OPENROUTER_TEMPLATE_LOADER_NAME_REGEX, OPENROUTER_TEMPLATE_MODES, OpenRouterTemplateMode, type OpenRouterTemplateTypeKey } from './openrouter.template';

/**
 * A loader a template type pre-registers in code.
 *
 * A loader takes NO script arguments: it derives everything it needs from the validated template input. Its output is
 * checked to be plain data, deep-copied, validated against `output` and stripped of undeclared keys before a script sees it.
 *
 * For a type with `allowMultipleRecipients`, a loader may only return data that EVERY recipient of the message may see.
 */
export interface OpenRouterTemplateLoader<I = any, O = any> {
  /**
   * The declared shape of the loaded data. JSON-only: pre-format dates and money as strings.
   */
  readonly output: Type<O>;
  /**
   * Loads the data for one render. Called at most once per render, and only when a script asks for it.
   *
   * @param input - The validated template input.
   */
  load(input: I): Promise<O>;
}

/**
 * The loaders of a template type, keyed by name. Every name matches `load[A-Z]…`.
 */
export type OpenRouterTemplateLoaders<I = any> = Readonly<Record<string, OpenRouterTemplateLoader<I>>>;

/**
 * The output type of a loader.
 */
export type OpenRouterTemplateLoaderOutput<L> = L extends OpenRouterTemplateLoader<any, infer O> ? O : never;

/**
 * The output of every loader in a record, keyed by loader name.
 */
export type OpenRouterTemplateLoadersData<L extends OpenRouterTemplateLoaders> = { readonly [K in keyof L]: OpenRouterTemplateLoaderOutput<L[K]> };

/**
 * The output rules every rendered message of a type must meet. Model-written text gets the same checks as script text.
 */
export interface OpenRouterTemplateOutputConfig {
  /**
   * The longest the trimmed message text may be.
   */
  readonly maxLength: number;
  /**
   * The domains a URL in the text may point at. A subdomain of a listed domain is allowed. When unset, the text may carry no
   * URL at all.
   */
  readonly allowedUrlDomains?: Maybe<string[]>;
  /**
   * The longest the OpenRouter input a body hands off may be.
   */
  readonly maxOpenRouterInputLength?: Maybe<number>;
}

/**
 * Whether a type's versions may (`optional`) or must (`required`) carry a final script. Absent means they may not.
 */
export type OpenRouterTemplateFinalScriptSetting = 'optional' | 'required';

/**
 * A model output, as handed to a final script.
 */
export interface OpenRouterTemplateModelOutput {
  /**
   * The model's output text.
   */
  readonly text: string;
  /**
   * The parsed JSON output, present only when the version's config uses a `json_schema` text format.
   */
  readonly json?: Maybe<unknown>;
}

/**
 * Sample data for a type, used by preview and by the review.
 */
export interface OpenRouterTemplateSamples<I = any, L extends OpenRouterTemplateLoaders<I> = OpenRouterTemplateLoaders<I>> {
  /**
   * A sample template input.
   */
  readonly input: I;
  /**
   * Sample loader outputs, standing in for the real loaders.
   */
  readonly loaders: Partial<OpenRouterTemplateLoadersData<L>>;
  /**
   * A sample model output, so a final script can be rendered without calling the model.
   */
  readonly output?: Maybe<OpenRouterTemplateModelOutput>;
}

/**
 * A template type, registered in code.
 *
 * The type is the security and authoring contract of every template of that type: it declares the input, the loaders and
 * their output shapes, the mode and the output rules. A stored template can change its script, never its type's config.
 */
export interface OpenRouterTemplateTypeConfig<I = any, L extends OpenRouterTemplateLoaders<I> = OpenRouterTemplateLoaders<I>> {
  /**
   * The type key.
   */
  readonly type: OpenRouterTemplateTypeKey;
  /**
   * Human-readable name.
   */
  readonly name: string;
  /**
   * What messages of this type are for. Fed to the review, which flags a template whose output does not match it.
   */
  readonly purpose: string;
  /**
   * How templates of this type turn their input into text.
   */
  readonly mode: OpenRouterTemplateMode;
  /**
   * The template input's shape. Required for every mode except {@link OpenRouterTemplateMode.OPENROUTER}, which takes none.
   * JSON-only.
   */
  readonly input?: Maybe<Type<I>>;
  /**
   * The pre-registered loaders. Not allowed for {@link OpenRouterTemplateMode.OPENROUTER}.
   */
  readonly loaders?: Maybe<L>;
  /**
   * The output rules.
   */
  readonly output: OpenRouterTemplateOutputConfig;
  /**
   * Whether this type is GENERIC text that may go to several people in one notification. Defaults to false: a notification
   * rendered from a single-recipient type that would reach more than one person sends nothing.
   *
   * Set it only when every loader returns data that EVERY recipient may see. When content has to differ per person, create
   * one notification per recipient instead. Templates inherit this from their type; it can never be set from the store.
   */
  readonly allowMultipleRecipients?: Maybe<boolean>;
  /**
   * Whether versions of this type may carry a final script. Not allowed for {@link OpenRouterTemplateMode.DETERMINISTIC}.
   */
  readonly finalScript?: Maybe<OpenRouterTemplateFinalScriptSetting>;
  /**
   * Sample data for preview and review.
   */
  readonly samples?: Maybe<OpenRouterTemplateSamples<I, L>>;
}

/**
 * Raised when a template type's config is invalid.
 */
export class OpenRouterTemplateTypeConfigError extends Error {
  readonly errors: string[];

  constructor(type: Maybe<string>, errors: string[]) {
    super(`Template type "${type ?? ''}" is invalid: ${errors.join(' ')}`);
    this.name = 'OpenRouterTemplateTypeConfigError';
    this.errors = errors;
  }
}

/**
 * The JSON Schema options used to read a type's shapes. A narrowing predicate keeps its JSON base; anything not JSON (a
 * `Date`, a morph, a class instance) throws, which is how a non-JSON shape is refused.
 */
const OPENROUTER_TEMPLATE_JSON_SCHEMA_OPTIONS = {
  fallback: {
    predicate: (ctx: { readonly base: unknown }) => ctx.base
  }
};

/**
 * Returns the JSON Schema of an arktype shape, or throws when the shape is not JSON-only.
 *
 * @param shape - The shape to read.
 * @returns The JSON Schema, as a plain object.
 */
export function openRouterTemplateJsonSchema(shape: Type<unknown>): object {
  const raw = shape.toJsonSchema(OPENROUTER_TEMPLATE_JSON_SCHEMA_OPTIONS as Parameters<Type<unknown>['toJsonSchema']>[0]);
  // JSON round trip runs arktype's boxed-node toJSON() callbacks, which structuredClone would skip.
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(JSON.stringify(raw)) as object; // NOSONAR typescript:S7784
}

/**
 * The field names and paths a template type declares.
 */
export interface OpenRouterTemplateFieldNames {
  /**
   * Every property name declared anywhere in the input or a loader output, plus `input` and the loader names.
   *
   * This flat set is the security boundary's data half: a script may access a property only when its name is here or in the
   * fixed built-in set.
   */
  readonly propertyNames: ReadonlySet<string>;
  /**
   * Every declared path, rooted at `input` or a loader name: `input.jobs`, `input.jobs[]`, `input.jobs[].title`,
   * `loadProfile.username`. Drives the authoring check that every field a script names exists.
   */
  readonly paths: ReadonlySet<string>;
  /**
   * The declared loader names.
   */
  readonly loaderNames: ReadonlySet<string>;
}

/**
 * Config for {@link addOpenRouterTemplateJsonSchemaFieldNames}.
 */
export interface AddOpenRouterTemplateJsonSchemaFieldNamesConfig {
  /**
   * The JSON Schema to walk.
   */
  readonly schema: unknown;
  /**
   * The path of the schema's root.
   */
  readonly path: string;
  /**
   * Collects the property names.
   */
  readonly propertyNames: Set<string>;
  /**
   * Collects the paths.
   */
  readonly paths: Set<string>;
}

/**
 * Walks a JSON Schema, adding each declared property name and path.
 *
 * Follows `properties`, `items`, `prefixItems`, `anyOf`, `oneOf` and `allOf`. `additionalProperties` is not followed: a key
 * that is not declared by name can never be accessed by a script.
 *
 * @param config - The schema, its root path and the sets to collect into.
 */
export function addOpenRouterTemplateJsonSchemaFieldNames(config: AddOpenRouterTemplateJsonSchemaFieldNamesConfig): void {
  const { propertyNames, paths } = config;
  walkOpenRouterTemplateJsonSchema(config.schema, config.path, propertyNames, paths);
}

function walkOpenRouterTemplateJsonSchema(schema: unknown, path: string, propertyNames: Set<string>, paths: Set<string>): void {
  if (schema != null && typeof schema === 'object') {
    const node = schema as Record<string, unknown>;
    paths.add(path);

    const properties = node['properties'];

    if (properties != null && typeof properties === 'object') {
      Object.entries(properties).forEach(([key, value]) => {
        propertyNames.add(key);
        walkOpenRouterTemplateJsonSchema(value, `${path}.${key}`, propertyNames, paths);
      });
    }

    const items = node['items'];

    if (Array.isArray(items)) {
      items.forEach((x) => walkOpenRouterTemplateJsonSchema(x, `${path}[]`, propertyNames, paths));
    } else if (items != null && typeof items === 'object') {
      walkOpenRouterTemplateJsonSchema(items, `${path}[]`, propertyNames, paths);
    }

    ['prefixItems', 'anyOf', 'oneOf', 'allOf'].forEach((key) => {
      const list = node[key];

      if (Array.isArray(list)) {
        const childPath = key === 'prefixItems' ? `${path}[]` : path;
        list.forEach((x) => walkOpenRouterTemplateJsonSchema(x, childPath, propertyNames, paths));
      }
    });
  }
}

/**
 * Returns the field names and paths a template type declares, read from the JSON Schema of its input and loader outputs.
 *
 * @param typeConfig - The template type.
 * @returns The flat property allowlist, the declared path set and the loader names.
 */
export function openRouterTemplateFieldNames(typeConfig: OpenRouterTemplateTypeConfig): OpenRouterTemplateFieldNames {
  const propertyNames = new Set<string>();
  const paths = new Set<string>();
  const loaders = typeConfig.loaders ?? {};
  const loaderNames = new Set(Object.keys(loaders));

  if (typeConfig.input != null) {
    propertyNames.add('input');
    addOpenRouterTemplateJsonSchemaFieldNames({ schema: openRouterTemplateJsonSchema(typeConfig.input), path: 'input', propertyNames, paths });
  }

  Object.entries(loaders).forEach(([name, loader]) => {
    propertyNames.add(name);
    addOpenRouterTemplateJsonSchemaFieldNames({ schema: openRouterTemplateJsonSchema(loader.output), path: name, propertyNames, paths });
  });

  return { propertyNames, paths, loaderNames };
}

/**
 * Validates and returns a template type config. Call it where the type is declared, so a bad type fails at startup.
 *
 * Refuses:
 * - a missing type, name or purpose, or an unknown mode;
 * - an input on an {@link OpenRouterTemplateMode.OPENROUTER} type, or a missing one on any other mode;
 * - loaders on an {@link OpenRouterTemplateMode.OPENROUTER} type, or a loader name that does not match `load[A-Z]…`;
 * - a `finalScript` setting on a {@link OpenRouterTemplateMode.DETERMINISTIC} type, which never calls a model;
 * - a `maxLength` that is not a positive integer;
 * - a shape that is not JSON-only (for example a `Date`);
 * - any field or loader name in {@link OPENROUTER_TEMPLATE_BANNED_NAMES}, so the flat allowlist can never let in a
 *   dangerous name by way of a data field.
 *
 * @param config - The template type config.
 * @returns The same config.
 * @throws {OpenRouterTemplateTypeConfigError} When the config is invalid.
 */
export function openRouterTemplateType<I, L extends OpenRouterTemplateLoaders<I> = OpenRouterTemplateLoaders<I>>(config: OpenRouterTemplateTypeConfig<I, L>): OpenRouterTemplateTypeConfig<I, L> {
  const errors: string[] = [];
  const { type, name, purpose, mode, input, loaders, output, finalScript } = config;
  const loaderNames = Object.keys(loaders ?? {});

  if (!type) {
    errors.push('A type key is required.');
  }

  if (!name) {
    errors.push('A name is required.');
  }

  if (!purpose) {
    errors.push('A purpose is required.');
  }

  if (!OPENROUTER_TEMPLATE_MODES.includes(mode)) {
    errors.push(`Unknown mode "${String(mode)}".`);
  }

  if (mode === OpenRouterTemplateMode.OPENROUTER) {
    if (input != null) {
      errors.push('An OPENROUTER type takes no template input: the caller passes the prompt call params through.');
    }

    if (loaderNames.length > 0) {
      errors.push('An OPENROUTER type has no loaders, because no script runs on a template input.');
    }
  } else if (input == null) {
    errors.push('An input shape is required for every mode except OPENROUTER.');
  }

  if (finalScript != null && mode === OpenRouterTemplateMode.DETERMINISTIC) {
    errors.push('A DETERMINISTIC type never calls a model, so it cannot allow a final script.');
  }

  if (output == null || !Number.isInteger(output.maxLength) || output.maxLength <= 0) {
    errors.push('output.maxLength must be a positive integer.');
  }

  loaderNames.forEach((loaderName) => {
    if (!OPENROUTER_TEMPLATE_LOADER_NAME_REGEX.test(loaderName)) {
      errors.push(`Loader "${loaderName}" must be named load[A-Z]….`);
    }
  });

  if (errors.length === 0) {
    try {
      const { propertyNames } = openRouterTemplateFieldNames(config as OpenRouterTemplateTypeConfig);

      propertyNames.forEach((propertyName) => {
        if (OPENROUTER_TEMPLATE_BANNED_NAMES.has(propertyName)) {
          errors.push(`"${propertyName}" is a banned name and cannot be a field or loader name.`);
        }
      });
    } catch (e) {
      errors.push(`Every input and loader shape must be JSON-only (pre-format dates and money as strings): ${(e as Error).message}`);
    }
  }

  if (errors.length > 0) {
    throw new OpenRouterTemplateTypeConfigError(type, errors);
  }

  return config;
}

// MARK: Registry
/**
 * A record of template types keyed by type.
 */
export type OpenRouterTemplateTypeConfigRecord = Record<OpenRouterTemplateTypeKey, OpenRouterTemplateTypeConfig>;

/**
 * Creates an {@link OpenRouterTemplateTypeConfigRecord} from an array of types.
 *
 * @param configs - The types to index.
 * @returns A record keyed by type.
 * @throws {Error} When two configs share a type.
 */
export function openRouterTemplateTypeConfigRecord(configs: OpenRouterTemplateTypeConfig[]): OpenRouterTemplateTypeConfigRecord {
  return arrayToObject(configs, {
    readKey: (x) => x.type,
    throwOnDuplicateKey: (type) => new Error(`openRouterTemplateTypeConfigRecord(): duplicate OpenRouterTemplateTypeKey in record: ${type}`)
  });
}

/**
 * Runtime service for resolving an {@link OpenRouterTemplateTypeConfig} from its type key.
 *
 * Built from an {@link OpenRouterTemplateTypeConfigRecord} via {@link appOpenRouterTemplateTypeConfigService}.
 */
export abstract class AppOpenRouterTemplateTypeConfigService {
  /**
   * All registered types for this app.
   */
  abstract readonly appOpenRouterTemplateTypeConfigRecord: OpenRouterTemplateTypeConfigRecord;

  /**
   * Returns the type config for the given type.
   *
   * There is no fallback type: a template of a type the app does not register is refused, never rendered.
   *
   * @param type - The type to look up.
   * @throws {Error} When the type is not registered.
   */
  abstract configForTemplateType(type: OpenRouterTemplateTypeKey): OpenRouterTemplateTypeConfig;

  /**
   * Returns the type config for the given type, or undefined when it is not registered.
   *
   * @param type - The type to look up.
   */
  abstract registeredConfigForTemplateType(type: OpenRouterTemplateTypeKey): Maybe<OpenRouterTemplateTypeConfig>;

  /**
   * Returns every registered type key.
   */
  abstract getAllKnownTemplateTypes(): OpenRouterTemplateTypeKey[];

  /**
   * Returns every registered type config.
   */
  abstract getAllKnownTemplateTypeConfigs(): OpenRouterTemplateTypeConfig[];
}

/**
 * Reference to an {@link AppOpenRouterTemplateTypeConfigService} instance, for dependency injection.
 */
export interface AppOpenRouterTemplateTypeConfigServiceRef {
  readonly appOpenRouterTemplateTypeConfigService: AppOpenRouterTemplateTypeConfigService;
}

/**
 * Creates an {@link AppOpenRouterTemplateTypeConfigService} from the given record.
 *
 * Built on {@link typedConfigRegistry}, with a fallback that throws, so an unknown type is refused.
 *
 * @param appOpenRouterTemplateTypeConfigRecord - The complete template type registry for the application.
 * @returns The service.
 *
 * @example
 * ```ts
 * const service = appOpenRouterTemplateTypeConfigService(openRouterTemplateTypeConfigRecord([DEMO_PROFILE_TEXT_TEMPLATE_TYPE]));
 * const typeConfig = service.configForTemplateType('demo-profile-text');
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function appOpenRouterTemplateTypeConfigService(appOpenRouterTemplateTypeConfigRecord: OpenRouterTemplateTypeConfigRecord): AppOpenRouterTemplateTypeConfigService {
  const registry = typedConfigRegistry<OpenRouterTemplateTypeConfig>({
    configs: appOpenRouterTemplateTypeConfigRecord,
    defaultConfigForType: (type) => {
      throw new Error(`No template type is registered for "${type}".`);
    }
  });

  return {
    appOpenRouterTemplateTypeConfigRecord,
    configForTemplateType: registry.configForType,
    registeredConfigForTemplateType: registry.registeredConfigForType,
    getAllKnownTemplateTypes: registry.getAllKnownTypes,
    getAllKnownTemplateTypeConfigs: registry.getAllKnownConfigs
  };
}
