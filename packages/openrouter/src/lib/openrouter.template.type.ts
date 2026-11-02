import { type Maybe, arrayToObject, typedConfigRegistry } from '@dereekb/util';
import { type Type } from 'arktype';
import { OPENROUTER_TEMPLATE_MODES, OpenRouterTemplateMode, type OpenRouterTemplateTypeKey } from './openrouter.template';
import { type OpenRouterTemplateContextFactory, type OpenRouterTemplateNotificationContext } from './openrouter.template.context';

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
export interface OpenRouterTemplateSamples<D = any, A = any> {
  /**
   * Sample template data, read by scripts as `context.data`.
   */
  readonly data?: Maybe<D>;
  /**
   * A sample notification, read by scripts as `context.notification`.
   */
  readonly notification?: Maybe<OpenRouterTemplateNotificationContext>;
  /**
   * Sample accessor results, keyed by accessor name, standing in for the real accessors. An accessor without a sample runs
   * for real in preview.
   */
  readonly accessor?: Maybe<Partial<A>>;
  /**
   * A sample model output, so a final script can be rendered without calling the model.
   */
  readonly output?: Maybe<OpenRouterTemplateModelOutput>;
}

/**
 * A template type, registered in code.
 *
 * The type is the security and authoring contract of every template of that type: it declares the context factory, the mode
 * and the output rules. A stored template can change its script, never its type's config.
 */
export interface OpenRouterTemplateTypeConfig<D = any, A = any> {
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
   * How templates of this type turn their context into text.
   */
  readonly mode: OpenRouterTemplateMode;
  /**
   * Builds the context scripts see: `context.data`, `context.notification` and `context.accessor`. Created with
   * {@link openRouterTemplateContextFactory}. Not allowed for {@link OpenRouterTemplateMode.OPENROUTER}, which runs no body.
   *
   * Optional for every other mode: without one, the context has the data and no accessors.
   */
  readonly contextFactory?: Maybe<OpenRouterTemplateContextFactory<D, A>>;
  /**
   * The output rules.
   */
  readonly output: OpenRouterTemplateOutputConfig;
  /**
   * Whether this type is GENERIC text that may go to several people in one notification. Defaults to false: a notification
   * rendered from a single-recipient type that would reach more than one person sends nothing.
   *
   * Set it only when every accessor of the type's context factory returns data that EVERY recipient may see. When content has to differ per person, create
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
  readonly samples?: Maybe<OpenRouterTemplateSamples<D, A>>;
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
 * Follows `properties`, `items`, `prefixItems`, `anyOf`, `oneOf` and `allOf`. `additionalProperties` is not followed.
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
 * Validates and returns a template type config. Call it where the type is declared, so a bad type fails at startup.
 *
 * Refuses:
 * - a missing type, name or purpose, or an unknown mode;
 * - a context factory on an {@link OpenRouterTemplateMode.OPENROUTER} type, which runs no body;
 * - sample accessor data for an accessor the context factory does not have;
 * - a `finalScript` setting on a {@link OpenRouterTemplateMode.DETERMINISTIC} type, which never calls a model;
 * - a `maxLength` that is not a positive integer.
 *
 * The accessor names are checked by {@link openRouterTemplateContextFactory}, where the factory is declared.
 *
 * @param config - The template type config.
 * @returns The same config.
 * @throws {OpenRouterTemplateTypeConfigError} When the config is invalid.
 */
export function openRouterTemplateType<D, A>(config: OpenRouterTemplateTypeConfig<D, A>): OpenRouterTemplateTypeConfig<D, A> {
  const errors: string[] = [];
  const { type, name, purpose, mode, contextFactory, output, finalScript, samples } = config;

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

  if (mode === OpenRouterTemplateMode.OPENROUTER && contextFactory != null) {
    errors.push('An OPENROUTER type has no context factory, because no script runs on template data: the caller passes the prompt call params through.');
  }

  if (samples?.accessor != null) {
    const accessorNames = contextFactory?.accessorNames;

    Object.keys(samples.accessor).forEach((accessorName) => {
      if (accessorNames?.has(accessorName) !== true) {
        errors.push(`The samples carry data for accessor "${accessorName}", which the context factory does not have.`);
      }
    });
  }

  if (finalScript != null && mode === OpenRouterTemplateMode.DETERMINISTIC) {
    errors.push('A DETERMINISTIC type never calls a model, so it cannot allow a final script.');
  }

  if (output == null || !Number.isInteger(output.maxLength) || output.maxLength <= 0) {
    errors.push('output.maxLength must be a positive integer.');
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
 * const service = appOpenRouterTemplateTypeConfigService(openRouterTemplateTypeConfigRecord(demoOpenRouterTemplateTypes(loadProfile)));
 * const typeConfig = service.configForTemplateType(DEMO_PROFILE_TEXT_TEMPLATE_TYPE);
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
