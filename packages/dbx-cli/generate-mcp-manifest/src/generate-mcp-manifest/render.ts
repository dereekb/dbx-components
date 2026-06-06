import {
  type AuthAppInfo,
  type AuthClaimInfo,
  type AuthRegistry,
  buildDisambiguatedMcpToolName,
  buildMcpToolName,
  type CliApiManifest,
  type CliApiManifestEntry,
  type CliApiManifestField,
  type CliModelField,
  type CliModelManifest,
  type CliModelManifestEntry,
  MCP_MANIFEST_VERSION,
  MCP_TOOL_NAME_MAX_LENGTH,
  MCP_TOOL_NAME_WARN_LENGTH,
  type McpManifest,
  type McpManifestAuth,
  type McpManifestAuthApp,
  type McpManifestAuthClaim,
  type McpManifestModelEntry,
  type McpManifestModelField,
  type McpManifestToolEntry,
  mcpManifestKey,
  validateMcpToolName
} from '@dereekb/dbx-cli';
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
 * Output of {@link renderMcpManifest}: the rendered manifest plus any tool-name validation findings.
 */
export interface RenderMcpManifestResult {
  /**
   * The rendered MCP manifest JSON shape.
   */
  readonly manifest: McpManifest;
  /**
   * Soft findings (names over the warn length, or names produced by more than one entry). Logged at
   * build time but do not fail generation.
   */
  readonly warnings: readonly string[];
  /**
   * Hard findings (names over the 64-char MCP cap). A non-empty list should fail manifest generation.
   */
  readonly errors: readonly string[];
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
export function renderMcpManifest(input: RenderMcpManifestInput, now: Date = new Date()): RenderMcpManifestResult {
  const tools: Record<string, McpManifestToolEntry> = {};
  const warnings: string[] = [];
  const errors: string[] = [];
  const seenNames = new Map<string, string>();
  const segments = buildSegmentMap(input.modelManifest);

  const toolEntries = input.apiManifest.filter((entry) => entry.verb !== 'standalone');
  const nameCounts = countToolNames(toolEntries, segments);

  for (const entry of toolEntries) {
    registerToolEntry({ entry, segments, nameCounts, tools, seenNames, warnings, errors });
  }

  const models = input.modelManifest != null && input.modelManifest.length > 0 ? input.modelManifest.map(projectModelEntry) : undefined;
  const auth = input.auth == null ? undefined : projectAuthSection(input.auth.registry, input.auth.app);

  const base: { version: typeof MCP_MANIFEST_VERSION; generatedAt: string; tools: Record<string, McpManifestToolEntry> } = { version: MCP_MANIFEST_VERSION, generatedAt: now.toISOString(), tools };
  const manifest: McpManifest = {
    ...base,
    ...(models == null ? {} : { models }),
    ...(auth == null ? {} : { auth })
  };

  return { manifest, warnings, errors };
}

/**
 * Builds the per-model tool-name segment overrides (e.g. collection prefix)
 * from the model manifest, so the names validated here match what the runtime
 * generator advertises.
 *
 * @param modelManifest - The optional generated model manifest.
 * @returns Each declaring model's tool-name segment override, keyed by `modelType`.
 */
function buildSegmentMap(modelManifest: CliModelManifest | undefined): ReadonlyMap<string, string> {
  const segments = new Map<string, string>();
  if (modelManifest != null) {
    for (const model of modelManifest) {
      if (model.mcpToolNameSegment != null && model.mcpToolNameSegment.length > 0) {
        segments.set(model.modelType, model.mcpToolNameSegment);
      }
    }
  }
  return segments;
}

/**
 * Counts how many entries produce each preferred (short) tool name so colliding
 * ones can be resolved the same way the runtime generator does. The renderer has
 * no runtime visibility / `mcp.name` override info, so it conservatively counts
 * every entry — the runtime generator is authoritative and only disambiguates
 * visible auto-named collisions, but this matches it for the build-time checks.
 *
 * @param toolEntries - The non-standalone API manifest entries.
 * @param segments - The per-model tool-name segment overrides.
 * @returns How many entries produce each preferred tool name, keyed by that name.
 */
function countToolNames(toolEntries: readonly CliApiManifestEntry[], segments: ReadonlyMap<string, string>): ReadonlyMap<string, number> {
  const nameCounts = new Map<string, number>();
  for (const entry of toolEntries) {
    const segment = segments.get(entry.model) ?? entry.model;
    const baseName = buildMcpToolName(segment, entry.verb, entry.specifier);
    nameCounts.set(baseName, (nameCounts.get(baseName) ?? 0) + 1);
  }
  return nameCounts;
}

interface RegisterToolEntryInput {
  readonly entry: CliApiManifestEntry;
  readonly segments: ReadonlyMap<string, string>;
  readonly nameCounts: ReadonlyMap<string, number>;
  readonly tools: Record<string, McpManifestToolEntry>;
  readonly seenNames: Map<string, string>;
  readonly warnings: string[];
  readonly errors: string[];
}

/**
 * Renders one API entry into its tool entry and resolves the name the runtime
 * will advertise: a preferred name produced by more than one entry is re-derived
 * with the abbreviated call type ({@link buildDisambiguatedMcpToolName}) so both
 * tools survive. The length cap applies to that final name — over-cap is a hard
 * error, over-soft is a warning; auto-resolved clashes are surfaced as warnings
 * (not errors) so the build still ships.
 *
 * @param input - The entry, the segment/name-count maps, and the accumulating tools/seen-names/warnings/errors collections.
 */
function registerToolEntry(input: RegisterToolEntryInput): void {
  const { entry, segments, nameCounts, tools, seenNames, warnings, errors } = input;
  const key = mcpManifestKey(entry.model, entry.verb, entry.specifier);
  tools[key] = buildToolEntry(entry);

  const segment = segments.get(entry.model) ?? entry.model;
  const baseName = buildMcpToolName(segment, entry.verb, entry.specifier);
  const clashes = (nameCounts.get(baseName) ?? 0) > 1;
  const toolName = clashes ? buildDisambiguatedMcpToolName(segment, entry.verb, entry.specifier) : baseName;

  if (toolName !== baseName) {
    warnings.push(`Tool name "${baseName}" is produced by more than one entry; re-derived as "${toolName}" (${key}) with the abbreviated call type to disambiguate.`);
  }

  const validation = validateMcpToolName(toolName);

  if (validation.level === 'error') {
    errors.push(`Tool name "${toolName}" is ${validation.length} chars, over the ${MCP_TOOL_NAME_MAX_LENGTH}-char MCP cap (${key}). Shorten the model/specifier, set a per-model mcpToolNameSegment, or hide the tool.`);
  } else if (validation.level === 'warn') {
    warnings.push(`Tool name "${toolName}" is ${validation.length} chars, over the ${MCP_TOOL_NAME_WARN_LENGTH}-char soft limit (${key}).`);
  }

  const priorKey = seenNames.get(toolName);

  if (priorKey == null) {
    seenNames.set(toolName, key);
  } else {
    warnings.push(`Tool name "${toolName}" is still produced by more than one entry (${priorKey} and ${key}) after disambiguation; one shadows the other unless hidden or renamed at runtime.`);
  }
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
    ...(entry.mcpToolNameSegment == null ? {} : { mcpToolNameSegment: entry.mcpToolNameSegment }),
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
  const result: { description?: string; inputSchema?: object; outputSchema?: object; mcpResultTypeName?: string } = {};

  if (description != null) result.description = description;
  if (inputSchema != null) result.inputSchema = inputSchema;
  if (outputSchema != null) result.outputSchema = outputSchema;
  // Carry the MCP-mapped result type name so the runtime can detect a mapSuccessfulResult handler whose `.api.ts` leaf was never annotated.
  if (entry.mcpResultTypeName != null) result.mcpResultTypeName = entry.mcpResultTypeName;

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
  // Prefer the MCP-mapped result type (declared via `@dbxModelApiMcpResult`) when present — it
  // describes what a `mapSuccessfulResult` handler actually exposes over MCP. Fall back to the raw
  // result type otherwise.
  const fields = entry.mcpResultFields != null && entry.mcpResultFields.length > 0 ? entry.mcpResultFields : entry.resultFields;
  const description = typeof entry.mcpResultTypeDescription === 'string' && entry.mcpResultTypeDescription.length > 0 ? entry.mcpResultTypeDescription : entry.resultTypeDescription;
  const hasFields = fields != null && fields.length > 0;
  const hasDescription = typeof description === 'string' && description.length > 0;

  if (!hasFields && !hasDescription) {
    return undefined;
  }

  const schema: JsonObject = { type: 'object' };

  if (hasDescription) {
    schema['description'] = description;
  }

  if (hasFields) {
    const properties: JsonObject = {};

    for (const field of fields) {
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
