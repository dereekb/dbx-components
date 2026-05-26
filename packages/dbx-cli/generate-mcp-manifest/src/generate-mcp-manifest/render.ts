import { type CliApiManifest, type CliApiManifestEntry, type CliApiManifestField, MCP_MANIFEST_VERSION, type McpManifest, type McpManifestToolEntry, mcpManifestKey } from '@dereekb/dbx-cli';
import { arktypeToJsonSchemaForExport } from '@dereekb/model';
import { type Type } from 'arktype';

type JsonObject = Record<string, unknown>;

/**
 * Pure renderer: turns a {@link CliApiManifest} into the {@link McpManifest} JSON shape.
 *
 * No file I/O — the main entry handles writing. Skips `verb === 'standalone'` entries
 * (they aren't dispatched through callModel and have no MCP tool counterpart).
 *
 * @param input - The source API manifest.
 * @param now - Override for the `generatedAt` timestamp. Tests pass a fixed value.
 */
export function renderMcpManifest(input: CliApiManifest, now: Date = new Date()): McpManifest {
  const tools: Record<string, McpManifestToolEntry> = {};

  for (const entry of input) {
    if (entry.verb === 'standalone') {
      continue;
    }

    const key = mcpManifestKey(entry.model, entry.verb, entry.specifier);
    tools[key] = buildToolEntry(entry);
  }

  return {
    version: MCP_MANIFEST_VERSION,
    generatedAt: now.toISOString(),
    tools
  };
}

function buildToolEntry(entry: CliApiManifestEntry): McpManifestToolEntry {
  const description = buildDescription(entry);
  const inputSchema = buildInputSchema(entry);
  const outputSchema = buildOutputSchema(entry);
  const result: { description?: string; inputSchema?: object; outputSchema?: object } = {};

  if (description != null) result.description = description;
  if (inputSchema != null) result.inputSchema = inputSchema;
  if (outputSchema != null) result.outputSchema = outputSchema;

  return result;
}

function buildDescription(entry: CliApiManifestEntry): string | undefined {
  const parts = [entry.description, entry.paramsTypeDescription].filter((value): value is string => typeof value === 'string' && value.length > 0);
  return parts.length === 0 ? undefined : parts.join('\n\n');
}

function buildInputSchema(entry: CliApiManifestEntry): JsonObject | undefined {
  const validator = entry.paramsValidator;
  const baseSchema = validator == null ? undefined : safeToJsonSchema(validator);
  const hasFields = entry.paramsFields != null && entry.paramsFields.length > 0;

  if (baseSchema == null && !hasFields) {
    return undefined;
  }

  const schema: JsonObject = baseSchema == null ? { type: 'object' } : cloneJsonObject(baseSchema);
  const properties = ensureProperties(schema);

  if (entry.paramsFields != null) {
    for (const field of entry.paramsFields) {
      mergeFieldIntoProperties(properties, field);
    }
  }

  return schema;
}

function buildOutputSchema(entry: CliApiManifestEntry): JsonObject | undefined {
  const hasFields = entry.resultFields != null && entry.resultFields.length > 0;
  const hasDescription = typeof entry.resultTypeDescription === 'string' && entry.resultTypeDescription.length > 0;

  if (!hasFields && !hasDescription) {
    return undefined;
  }

  const schema: JsonObject = { type: 'object' };

  if (hasDescription) {
    schema['description'] = entry.resultTypeDescription;
  }

  if (hasFields) {
    const properties: JsonObject = {};

    for (const field of entry.resultFields) {
      properties[field.name] = buildPropertyFromField(field);
    }

    schema['properties'] = properties;
  }

  return schema;
}

function ensureProperties(schema: JsonObject): JsonObject {
  const existing = schema['properties'];
  let properties: JsonObject;

  if (existing != null && typeof existing === 'object') {
    properties = existing as JsonObject;
  } else {
    properties = {};
    schema['properties'] = properties;
  }

  return properties;
}

function mergeFieldIntoProperties(properties: JsonObject, field: CliApiManifestField): void {
  const existing = properties[field.name];
  const target = existing != null && typeof existing === 'object' ? (existing as JsonObject) : {};

  if (target['description'] == null && field.description != null && field.description.length > 0) {
    target['description'] = field.description;
  }

  if (target['type'] == null) {
    const inferred = inferJsonSchemaType(field.typeText);

    if (inferred != null) {
      target['type'] = inferred;
    }
  }

  properties[field.name] = target;
}

function buildPropertyFromField(field: CliApiManifestField): JsonObject {
  const property: JsonObject = {};

  if (field.description != null && field.description.length > 0) {
    property['description'] = field.description;
  }

  const inferred = inferJsonSchemaType(field.typeText);

  if (inferred != null) {
    property['type'] = inferred;
  }

  return property;
}

/**
 * Best-effort JSON Schema `type` inference from raw TS `typeText`.
 *
 * Only handles the obvious cases (`string`, `number`, `boolean`, `T[]`, `Maybe<T>`).
 * Anything else returns `undefined` so the property's description still surfaces.
 */
function inferJsonSchemaType(typeText: string | undefined): string | undefined {
  if (typeText == null) {
    return undefined;
  }

  const trimmed = typeText.trim();
  let result: string | undefined;

  if (trimmed === 'string') {
    result = 'string';
  } else if (trimmed === 'number') {
    result = 'number';
  } else if (trimmed === 'boolean') {
    result = 'boolean';
  } else if (trimmed.endsWith('[]')) {
    result = 'array';
  } else if (trimmed.startsWith('Maybe<') && trimmed.endsWith('>')) {
    result = inferJsonSchemaType(trimmed.slice('Maybe<'.length, -1));
  } else {
    result = undefined;
  }

  return result;
}

function safeToJsonSchema(validator: NonNullable<CliApiManifestEntry['paramsValidator']>): JsonObject | undefined {
  let result: JsonObject | undefined;

  try {
    const schema = arktypeToJsonSchemaForExport(validator as unknown as Type<unknown>);

    if (schema != null && typeof schema === 'object') {
      result = schema as JsonObject;
    }
  } catch {
    result = undefined;
  }

  return result;
}

function cloneJsonObject(value: JsonObject): JsonObject {
  return structuredClone(value);
}
