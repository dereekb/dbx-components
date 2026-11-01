import { type Maybe } from '@dereekb/util';
import { OpenRouterTemplateRenderError, type OpenRouterTemplateScriptPhase } from './openrouter.template';
import { type OpenRouterTemplateScriptError, validateOpenRouterTemplateScript } from './openrouter.template.script';
import { type OpenRouterTemplateTypeConfig } from './openrouter.template.type';

/**
 * The longest a script error message may be once sanitized.
 */
export const OPENROUTER_TEMPLATE_SCRIPT_ERROR_MESSAGE_MAX_LENGTH = 300;

/**
 * The most compiled scripts kept per template type. The oldest is dropped first.
 */
export const OPENROUTER_TEMPLATE_COMPILED_SCRIPT_CACHE_MAX_SIZE = 200;

/**
 * A compiled template script. Its errors are always an {@link OpenRouterTemplateRenderError} with a sanitized message.
 */
export type OpenRouterTemplateCompiledScript = (context: object) => Promise<unknown>;

/**
 * Raised when a script fails validation or compilation.
 */
export class OpenRouterTemplateScriptValidationError extends OpenRouterTemplateRenderError {
  readonly errors: OpenRouterTemplateScriptError[];

  constructor(errors: OpenRouterTemplateScriptError[]) {
    const details = errors.map((x) => (x.line == null ? x.message : x.message + ' (' + x.line + ':' + (x.column ?? 0) + ')')).join(' ');
    super(`The template script is invalid: ${details}`);
    this.name = 'OpenRouterTemplateScriptValidationError';
    this.errors = errors;
  }
}

/**
 * Config for {@link compileOpenRouterTemplateScript}.
 */
export interface CompileOpenRouterTemplateScriptConfig {
  /**
   * The script source.
   */
  readonly code: string;
  /**
   * The CURRENT template type config. The script is re-validated against it, so a code change that drops a field fails
   * closed rather than running a script written against the old shape.
   */
  readonly typeConfig: OpenRouterTemplateTypeConfig;
  /**
   * Which script this is. Defaults to `body`.
   */
  readonly phase?: Maybe<OpenRouterTemplateScriptPhase>;
  /**
   * The JSON Schema of the version's `json_schema` text format, for a final script.
   */
  readonly outputJsonSchema?: Maybe<object>;
}

/**
 * The AsyncFunction constructor. Functions it builds never close over module scope.
 */
const ASYNC_FUNCTION_CONSTRUCTOR = Object.getPrototypeOf(async function () {
  /* empty */
}).constructor as new (...args: string[]) => (context: object) => Promise<unknown>;

/**
 * Compiled scripts, cached per type config identity and then by phase, output schema and code.
 */
const COMPILED_SCRIPT_CACHE = new WeakMap<OpenRouterTemplateTypeConfig, Map<string, OpenRouterTemplateCompiledScript>>();

/**
 * Reduces a thrown value to a message safe to return to a script's author: its name and message, truncated. No stack.
 *
 * @param error - The thrown value.
 * @returns The sanitized message.
 */
export function sanitizeOpenRouterTemplateScriptError(error: unknown): string {
  let message: string;

  if (error instanceof Error) {
    message = `${error.name}: ${error.message}`;
  } else {
    message = 'The script threw a value that is not an Error.';
  }

  return message.length > OPENROUTER_TEMPLATE_SCRIPT_ERROR_MESSAGE_MAX_LENGTH ? `${message.slice(0, OPENROUTER_TEMPLATE_SCRIPT_ERROR_MESSAGE_MAX_LENGTH)}…` : message;
}

/**
 * Validates and compiles a template script.
 *
 * The script is re-validated with {@link validateOpenRouterTemplateScript} against the current type config every time it is
 * compiled, then built as `new AsyncFunction('context', "'use strict';\n" + code)`. There is no VM: the validator is the
 * boundary, and the constructor's own parse is the final gate. Compiled functions are cached in-process.
 *
 * Verify a stored script's approval BEFORE compiling it.
 *
 * @param config - The script, its current type config and its phase.
 * @returns The compiled script. Calling it runs the script with the given context; any error it throws becomes an
 *   {@link OpenRouterTemplateRenderError} with a sanitized message.
 * @throws {OpenRouterTemplateScriptValidationError} When the script fails validation or compilation.
 */
export function compileOpenRouterTemplateScript(config: CompileOpenRouterTemplateScriptConfig): OpenRouterTemplateCompiledScript {
  const { code, typeConfig, outputJsonSchema } = config;
  const phase = config.phase ?? 'body';
  const cacheKey = `${phase}\n${outputJsonSchema == null ? '' : JSON.stringify(outputJsonSchema)}\n${code}`;

  let typeCache = COMPILED_SCRIPT_CACHE.get(typeConfig);

  if (typeCache == null) {
    typeCache = new Map();
    COMPILED_SCRIPT_CACHE.set(typeConfig, typeCache);
  }

  let compiled = typeCache.get(cacheKey);

  if (compiled == null) {
    const validation = validateOpenRouterTemplateScript({ code, typeConfig, phase, outputJsonSchema });

    if (!validation.valid) {
      throw new OpenRouterTemplateScriptValidationError(validation.errors);
    }

    let fn: (context: object) => Promise<unknown>;

    try {
      // The validator above is the security boundary for this constructor; see validateOpenRouterTemplateScript.
      fn = new ASYNC_FUNCTION_CONSTRUCTOR('context', `'use strict';\n${code}`); // NOSONAR typescript:S1523
    } catch (e) {
      throw new OpenRouterTemplateScriptValidationError([{ message: `The script does not compile: ${sanitizeOpenRouterTemplateScriptError(e)}` }]);
    }

    compiled = async (context: object) => {
      try {
        return await fn(context);
      } catch (e) {
        throw new OpenRouterTemplateRenderError(`The template script failed: ${sanitizeOpenRouterTemplateScriptError(e)}`);
      }
    };

    if (typeCache.size >= OPENROUTER_TEMPLATE_COMPILED_SCRIPT_CACHE_MAX_SIZE) {
      const oldestKey = typeCache.keys().next().value;

      if (oldestKey != null) {
        typeCache.delete(oldestKey);
      }
    }

    typeCache.set(cacheKey, compiled);
  }

  return compiled;
}
