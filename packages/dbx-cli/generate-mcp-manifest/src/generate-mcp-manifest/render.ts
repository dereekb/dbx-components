import { type AuthAppInfo, type AuthClaimInfo, type AuthRegistry, type CliApiManifest, type CliApiManifestEntry, type CliApiManifestField, type CliModelField, type CliModelManifest, type CliModelManifestEntry, MCP_MANIFEST_VERSION, type McpManifest, type McpManifestAuth, type McpManifestAuthApp, type McpManifestAuthClaim, type McpManifestModelEntry, type McpManifestModelField, type McpManifestToolEntry, mcpManifestKey } from '@dereekb/dbx-cli';
import { arktypeToJsonSchemaForExport } from '@dereekb/model';
import { type Type } from 'arktype';

type JsonObject = Record<string, unknown>;

/**
 * Inputs to {@link renderMcpManifest}.
 */
export interface RenderMcpManifestInput {
  /**
   * Generated API manifest used to render tool entries.
   */
  readonly apiManifest: CliApiManifest;
  /**
   * Optional generated model manifest. When present, projects each entry into
   * the runtime {@link McpManifestModelEntry} shape and emits a `models` array
   * on the output JSON for the runtime's built-in catalog tools.
   */
  readonly modelManifest?: CliModelManifest;
  /**
   * Optional auth registry + primary-app slug used to project the runtime
   * `auth` section on the manifest. The renderer filters entries to the
   * primary app's claim catalog (inherited claims like `fr` are included
   * via the app's `claimKeys` list).
   */
  readonly auth?: {
    readonly registry: AuthRegistry;
    readonly app: string;
  };
}

/**
 * Pure renderer: turns a {@link CliApiManifest} (and optional {@link CliModelManifest})
 * into the {@link McpManifest} JSON shape.
 *
 * No file I/O — the main entry handles writing. Skips `verb === 'standalone'` entries
 * (they aren't dispatched through callModel and have no MCP tool counterpart).
 *
 * @param input - The render config carrying the API manifest and optional model manifest.
 * @param now - Override for the `generatedAt` timestamp. Tests pass a fixed value.
 * @returns The rendered MCP manifest with tools keyed by {@link mcpManifestKey} and an optional models array.
 */
export function renderMcpManifest(input: RenderMcpManifestInput, now: Date = new Date()): McpManifest {
  const tools: Record<string, McpManifestToolEntry> = {};

  for (const entry of input.apiManifest) {
    if (entry.verb === 'standalone') {
      continue;
    }

    const key = mcpManifestKey(entry.model, entry.verb, entry.specifier);
    tools[key] = buildToolEntry(entry);
  }

  const models = input.modelManifest != null && input.modelManifest.length > 0 ? input.modelManifest.map(projectModelEntry) : undefined;
  const auth = input.auth != null ? projectAuthSection(input.auth.registry, input.auth.app) : undefined;

  const base: { version: typeof MCP_MANIFEST_VERSION; generatedAt: string; tools: Record<string, McpManifestToolEntry> } = { version: MCP_MANIFEST_VERSION, generatedAt: now.toISOString(), tools };
  const result: McpManifest = {
    ...base,
    ...(models == null ? {} : { models }),
    ...(auth == null ? {} : { auth })
  };

  return result;
}

function projectAuthSection(registry: AuthRegistry, appSlug: string): McpManifestAuth | undefined {
  const primary = registry.findApp(appSlug);
  if (primary == null) {
    return undefined;
  }

  const apps: readonly McpManifestAuthApp[] = [projectAuthApp(primary)];
  const ownedKeys = new Set(primary.claimKeys);
  const claims = registry.claims.filter((claim) => ownedKeys.has(claim.key)).map(projectAuthClaim);

  return {
    app: apps[0],
    apps,
    claims
  };
}

function projectAuthApp(info: AuthAppInfo): McpManifestAuthApp {
  return {
    app: info.app,
    claimsInterfaceName: info.claimsInterfaceName,
    serviceConstName: info.serviceConstName ?? '',
    claimKeys: info.claimKeys,
    scopes: info.scopes,
    ...(info.description == null ? {} : { description: info.description })
  };
}

function projectAuthClaim(info: AuthClaimInfo): McpManifestAuthClaim {
  const mapping: McpManifestAuthClaim['mapping'] = {
    roles: info.mapping.roles,
    inverse: info.mapping.inverse,
    customEncodeDecode: info.mapping.customEncodeDecode,
    ...(info.mapping.inverseMode == null ? {} : { inverseMode: info.mapping.inverseMode }),
    ...(info.mapping.claimValue == null ? {} : { claimValue: info.mapping.claimValue })
  };
  return {
    key: info.key,
    description: info.description,
    type: info.type,
    source: info.source,
    mapping,
    tags: info.tags,
    ...(info.app == null ? {} : { app: info.app }),
    ...(info.interfaceName == null ? {} : { interfaceName: info.interfaceName })
  };
}

function projectModelEntry(entry: CliModelManifestEntry): McpManifestModelEntry {
  const projected: McpManifestModelEntry = {
    modelType: entry.modelType,
    modelName: entry.modelName,
    identityConst: entry.identityConst,
    collectionPrefix: entry.collectionPrefix,
    sourcePackage: entry.sourcePackage,
    sourceFile: entry.sourceFile,
    fields: entry.fields.map(projectModelField),
    ...(entry.modelGroup == null ? {} : { modelGroup: entry.modelGroup }),
    ...(entry.parentIdentityConst == null ? {} : { parentIdentityConst: entry.parentIdentityConst }),
    ...(entry.description == null ? {} : { description: entry.description }),
    ...(entry.read == null ? {} : { read: entry.read }),
    ...(entry.serviceFactory == null ? {} : { serviceFactory: entry.serviceFactory })
  };
  return projected;
}

function projectModelField(field: CliModelField): McpManifestModelField {
  const projected: McpManifestModelField = {
    name: field.name,
    longName: field.longName,
    optional: field.optional,
    ...(field.tsType == null ? {} : { tsType: field.tsType }),
    ...(field.description == null ? {} : { description: field.description }),
    ...(field.enumRef == null ? {} : { enumRef: field.enumRef }),
    ...(field.syncFlag == null ? {} : { syncFlag: field.syncFlag }),
    ...(field.nestedFields == null ? {} : { nestedFields: field.nestedFields.map(projectModelField) }),
    ...(field.nestedIsArray == null ? {} : { nestedIsArray: field.nestedIsArray })
  };
  return projected;
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
 *
 * @param typeText - Raw TypeScript type text captured from the API manifest field.
 * @returns The matching JSON Schema primitive type (`string`, `number`, `boolean`, `array`), or `undefined` when the type isn't a recognized primitive.
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
