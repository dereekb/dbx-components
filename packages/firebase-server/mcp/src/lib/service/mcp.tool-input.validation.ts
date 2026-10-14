import { Ajv, addFormats } from '@modelcontextprotocol/server/validators/ajv';
import { type Maybe } from '@dereekb/util';

/**
 * The ajv instance type the MCP SDK bundles.
 */
type McpToolInputAjv = InstanceType<typeof Ajv>;

/**
 * A compiled ajv validate function.
 */
type McpToolInputCompiledValidator = ReturnType<McpToolInputAjv['compile']>;

/**
 * A single ajv error, as read by {@link formatMcpToolInputValidationErrors}.
 */
export interface McpToolInputValidationErrorLike {
  readonly keyword: string;
  readonly instancePath: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly message?: Maybe<string>;
  readonly data?: unknown;
}

/**
 * Checks MCP static tool args against their tool's JSON-Schema `inputSchema`.
 */
export interface McpToolInputValidator {
  /**
   * Validates the args against the schema.
   *
   * @param schema - The tool's JSON-Schema input schema.
   * @param args - The tool call args, with the reason parameter already stripped.
   * @returns The one-line-per-field summary when the args fail, or undefined when they pass (or the schema is skipped).
   */
  validate(schema: object, args: unknown): Maybe<string>;
}

/**
 * Config for {@link mcpToolInputValidator}.
 */
export interface McpToolInputValidatorConfig {
  /**
   * Called once per schema that fails to compile. That schema is then skipped (fail-open).
   */
  readonly warn?: (message: string) => void;
}

/**
 * Creates an {@link McpToolInputValidator} backed by the draft-07 ajv the MCP SDK bundles.
 *
 * The ajv instance is created on first use with `{ strict: false, allErrors: true, validateSchema: false, verbose: true }`
 * plus formats. No coercion and no defaults, so args are never mutated. Each schema is compiled on first use and cached
 * by the schema object's identity. A schema that fails to compile logs one warning and is skipped.
 *
 * @param config - Optional warning sink.
 * @returns A validator.
 */
export function mcpToolInputValidator(config: McpToolInputValidatorConfig = {}): McpToolInputValidator {
  const { warn = (message: string) => console.warn(message) } = config;
  const cache = new WeakMap<object, Maybe<McpToolInputCompiledValidator>>();
  let ajv: Maybe<McpToolInputAjv>;

  function compiledValidatorForSchema(schema: object): Maybe<McpToolInputCompiledValidator> {
    let compiled: Maybe<McpToolInputCompiledValidator>;

    if (cache.has(schema)) {
      compiled = cache.get(schema);
    } else {
      if (ajv == null) {
        ajv = new Ajv({ strict: false, allErrors: true, validateSchema: false, verbose: true });
        addFormats(ajv);
      }

      try {
        compiled = ajv.compile(schema);
      } catch (error) {
        warn(`MCP tool inputSchema failed to compile and will not be checked: ${(error as Error).message}`);
      }

      cache.set(schema, compiled);
    }

    return compiled;
  }

  return {
    validate(schema: object, args: unknown): Maybe<string> {
      const compiled = compiledValidatorForSchema(schema);
      let summary: Maybe<string>;

      if (compiled != null && !compiled(args)) {
        summary = formatMcpToolInputValidationErrors((compiled.errors ?? []) as McpToolInputValidationErrorLike[]);
      }

      return summary;
    }
  };
}

/**
 * Formats ajv errors one line per error, like ArkType's summary.
 *
 * - `required` → `<missingProperty> is required`
 * - `additionalProperties` → `<additionalProperty> is not a parameter of this tool`
 * - `enum` → `<path> must be one of "a", "b" (was <value>)`
 * - anything else → `<path> <ajv message> (was <value>)`
 *
 * The path is the `instancePath` without its leading `/` (e.g. `keys/0`), or `params` at the root.
 *
 * @param errors - The ajv errors.
 * @returns The summary text.
 */
export function formatMcpToolInputValidationErrors(errors: readonly McpToolInputValidationErrorLike[]): string {
  return errors
    .map((error) => {
      const parentPath = error.instancePath.replace(/^\//, '');
      const path = parentPath || 'params';
      let line: string;

      switch (error.keyword) {
        case 'required':
          line = `${joinMcpToolInputPath(parentPath, String(error.params['missingProperty']))} is required`;
          break;
        case 'additionalProperties':
          line = `${joinMcpToolInputPath(parentPath, String(error.params['additionalProperty']))} is not a parameter of this tool`;
          break;
        case 'enum':
          line = `${path} must be one of ${((error.params['allowedValues'] as Maybe<unknown[]>) ?? []).map((x) => JSON.stringify(x)).join(', ')} (was ${describeMcpToolInputValue(error.data)})`;
          break;
        default:
          line = `${path} ${error.message ?? 'is invalid'} (was ${describeMcpToolInputValue(error.data)})`;
          break;
      }

      return line;
    })
    .join('\n');
}

function joinMcpToolInputPath(parentPath: string, key: string): string {
  return parentPath ? `${parentPath}/${key}` : key;
}

function describeMcpToolInputValue(value: unknown): string {
  let result: string;

  try {
    result = JSON.stringify(value) ?? String(value);
  } catch {
    result = String(value);
  }

  return result.length > 80 ? `${result.slice(0, 77)}...` : result;
}
