import { type Maybe } from '@dereekb/util';
import { DEFAULT_MCP_REASON_PARAMETER_DESCRIPTION, DEFAULT_MCP_REASON_PARAMETER_MAX_LENGTH, DEFAULT_MCP_REASON_PARAMETER_NAME, DEFAULT_MCP_REASON_PARAMETER_REQUIRED, type McpReasonParameterConfig } from '../mcp.config';

/**
 * The fully-normalized form of {@link McpReasonParameterConfig}, with every field resolved to a
 * concrete value via {@link resolveMcpReasonParameterConfig}.
 */
export interface ResolvedMcpReasonParameterConfig {
  readonly enabled: boolean;
  readonly required: boolean;
  readonly maxLength: number;
  readonly description: string;
  readonly parameterName: string;
}

/**
 * Normalizes the app-supplied {@link McpModuleConfig.reasonParameter} value (object / boolean /
 * undefined) into a fully-resolved {@link ResolvedMcpReasonParameterConfig} with the package defaults
 * applied.
 *
 * - `undefined` / `true` → defaults, enabled.
 * - `false` → defaults, but `enabled: false`.
 * - object → per-field overrides on top of the defaults (`enabled` defaults to `true`).
 *
 * @param config - The raw config from {@link McpModuleConfig.reasonParameter}.
 * @returns The resolved config with all defaults applied.
 */
export function resolveMcpReasonParameterConfig(config?: McpReasonParameterConfig | boolean): ResolvedMcpReasonParameterConfig {
  let result: ResolvedMcpReasonParameterConfig;

  if (config === false) {
    result = { enabled: false, required: DEFAULT_MCP_REASON_PARAMETER_REQUIRED, maxLength: DEFAULT_MCP_REASON_PARAMETER_MAX_LENGTH, description: DEFAULT_MCP_REASON_PARAMETER_DESCRIPTION, parameterName: DEFAULT_MCP_REASON_PARAMETER_NAME };
  } else if (config == null || config === true) {
    result = { enabled: true, required: DEFAULT_MCP_REASON_PARAMETER_REQUIRED, maxLength: DEFAULT_MCP_REASON_PARAMETER_MAX_LENGTH, description: DEFAULT_MCP_REASON_PARAMETER_DESCRIPTION, parameterName: DEFAULT_MCP_REASON_PARAMETER_NAME };
  } else {
    result = {
      enabled: config.enabled ?? true,
      required: config.required ?? DEFAULT_MCP_REASON_PARAMETER_REQUIRED,
      maxLength: config.maxLength ?? DEFAULT_MCP_REASON_PARAMETER_MAX_LENGTH,
      description: config.description ?? DEFAULT_MCP_REASON_PARAMETER_DESCRIPTION,
      parameterName: config.parameterName ?? DEFAULT_MCP_REASON_PARAMETER_NAME
    };
  }

  return result;
}

/**
 * Minimal shape of the JSON-schema fragments this module reasons about: a `properties` bag plus an
 * optional `required` list.
 */
interface JsonSchemaObjectShape {
  type?: unknown;
  properties?: Record<string, unknown>;
  required?: ReadonlyArray<string>;
  [key: string]: unknown;
}

/**
 * Returns `true` when the JSON schema already declares a property named `name` under `properties`.
 *
 * Used as the collision guard so a handler that legitimately consumes its own field of the same name
 * is never double-declared (schema injection) or stripped (arg extraction).
 *
 * @param schema - The candidate JSON schema object (may be `undefined`).
 * @param name - The property name to look for.
 * @returns Whether the schema's `properties` already contains `name`.
 */
export function mcpSchemaDeclaresProperty(schema: object | undefined, name: string): boolean {
  const properties = (schema as JsonSchemaObjectShape | undefined)?.properties;
  return properties != null && typeof properties === 'object' && Object.prototype.hasOwnProperty.call(properties, name);
}

/**
 * Returns a NEW JSON schema object with the reason parameter property merged into `properties` (and
 * appended to `required` when configured). Never mutates the input — the static wire schemas are
 * shared module-level constants reused across requests.
 *
 * Self-skips (returns the input schema unchanged) when the config is disabled or the schema already
 * declares the parameter name. Defensive against a non-object / missing-`properties` input.
 *
 * @param inputSchema - The tool's resolved input schema.
 * @param resolved - The resolved reason-parameter config.
 * @returns A new schema carrying the reason property, or the original schema when skipped.
 */
export function applyMcpReasonParameterToSchema(inputSchema: object, resolved: ResolvedMcpReasonParameterConfig): object {
  let result: object = inputSchema;

  if (resolved.enabled && !mcpSchemaDeclaresProperty(inputSchema, resolved.parameterName)) {
    const base = (typeof inputSchema === 'object' && inputSchema != null ? inputSchema : {}) as JsonSchemaObjectShape;
    const existingProperties = typeof base.properties === 'object' && base.properties != null ? base.properties : {};

    const next: JsonSchemaObjectShape = {
      ...base,
      type: base.type ?? 'object',
      properties: {
        ...existingProperties,
        [resolved.parameterName]: { type: 'string', maxLength: resolved.maxLength, description: resolved.description }
      }
    };

    if (resolved.required) {
      const existingRequired = Array.isArray(base.required) ? base.required : [];
      next.required = existingRequired.includes(resolved.parameterName) ? [...existingRequired] : [...existingRequired, resolved.parameterName];
    }

    result = next;
  }

  return result;
}

/**
 * The result of extracting the reason value from a tool call's raw arguments.
 */
export interface ExtractedMcpReason {
  /**
   * The extracted, clamped reason string, or `undefined` when absent / disabled / handler-owned.
   */
  readonly reason: Maybe<string>;
  /**
   * The arguments to forward to the underlying handler — with the reason key removed when this module
   * owns it, or the original args untouched otherwise.
   */
  readonly args: Record<string, unknown>;
}

/**
 * Splits the auto-injected reason value out of a tool call's raw arguments.
 *
 * When enabled and the tool did NOT declare its own field of the same name: shallow-copies the args,
 * deletes the parameter key, and coerces + clamps the value to `maxLength` (the client is not trusted).
 * An empty / absent value yields `reason: undefined`.
 *
 * Otherwise (disabled, or the handler legitimately owns the field) returns the args unchanged so a
 * field the handler actually consumes is never stripped.
 *
 * @param args - The raw `tools/call` arguments.
 * @param resolved - The resolved reason-parameter config.
 * @param toolDeclaresOwnReason - Whether the tool's own input schema already declares the parameter.
 * @returns The extracted reason plus the (possibly stripped) args to dispatch.
 */
export function extractMcpReasonFromArgs(args: Record<string, unknown>, resolved: ResolvedMcpReasonParameterConfig, toolDeclaresOwnReason: boolean): ExtractedMcpReason {
  let result: ExtractedMcpReason;

  if (resolved.enabled && !toolDeclaresOwnReason && Object.prototype.hasOwnProperty.call(args, resolved.parameterName)) {
    const rawValue = args[resolved.parameterName];
    const nextArgs = { ...args };
    delete nextArgs[resolved.parameterName];

    const stringValue = rawValue == null ? '' : String(rawValue);
    const clamped = stringValue.length > resolved.maxLength ? stringValue.slice(0, resolved.maxLength) : stringValue;
    result = { reason: clamped.length > 0 ? clamped : undefined, args: nextArgs };
  } else {
    result = { reason: undefined, args };
  }

  return result;
}
