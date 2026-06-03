/**
 * Stitches per-file {@link ModelExtraction} outputs from {@link findModelFiles}
 * into the runtime {@link CliModelManifestEntry[]} the manifest emits.
 *
 * Builds two cross-file registries (converters keyed by `converterConst`,
 * interfaces keyed by `name`) and uses them to resolve nested converter
 * references — `firestoreObjectArray({ objectField: <const> })` and
 * `firestoreSubObject({ objectField: <const> })` — recursively, so an
 * `--expand-keys` rewrite on a model's response payload can rename short
 * keys all the way down through embedded sub-object and object-array fields.
 */

import type { CliModelField, CliModelManifestEntry } from '@dereekb/dbx-cli';
import type { ModelExtraction, ModelExtractionConverter, ModelExtractionConverterField, ModelExtractionInterface, ModelExtractionInterfaceProp } from '@dereekb/dbx-cli/manifest-extract';

/**
 * Maximum nested-converter recursion depth. Bounded so a malformed cyclic
 * reference cannot lock the build. No real model approaches this depth.
 */
const MAX_NESTED_DEPTH = 8;

const LONG_NAME_RE = /^[a-z][a-zA-Z0-9]*$/;

const ENUM_GENERIC_RE = /firestoreEnum<(\w+)>|optionalFirestoreEnum<(\w+)>/;

/**
 * Inputs for {@link assembleModels}.
 */
export interface AssembleModelsInput {
  readonly extractions: readonly { readonly sourcePackage: string; readonly sourceFile: string; readonly extraction: ModelExtraction }[];
}

/**
 * Aggregates per-file extractions into the runtime {@link CliModelManifestEntry}
 * list the generator emits. De-duplicates models by `identityConst` (first
 * file wins, matching the converter walker's stable ordering across packages).
 *
 * @param input - One entry per source file, with the package label and
 *   workspace-relative source path that should be stamped on every produced
 *   manifest entry.
 * @returns The assembled manifest entries, sorted by `modelType` for stable
 *   diffs.
 */
export function assembleModels(input: AssembleModelsInput): readonly CliModelManifestEntry[] {
  const registries = buildGlobalRegistries(input.extractions);
  const accumulator: AssemblyAccumulator = { seen: new Set<string>(), entries: [] };

  for (const source of input.extractions) {
    appendEntriesFromSource(source, registries, accumulator);
  }

  accumulator.entries.sort((a, b) => a.modelType.localeCompare(b.modelType));
  return accumulator.entries;
}

interface AssemblyAccumulator {
  readonly seen: Set<string>;
  readonly entries: CliModelManifestEntry[];
}

interface GlobalRegistries {
  readonly converterRegistry: ReadonlyMap<string, ModelExtractionConverter>;
  readonly interfaceRegistry: ReadonlyMap<string, ModelExtractionInterface>;
  readonly groupByModelName: ReadonlyMap<string, string>;
  readonly serviceFactoryByModelType: ReadonlyMap<string, { readonly exportName: string; readonly sourceFile: string }>;
}

function buildGlobalRegistries(extractions: AssembleModelsInput['extractions']): GlobalRegistries {
  const converterRegistry = new Map<string, ModelExtractionConverter>();
  const interfaceRegistry = new Map<string, ModelExtractionInterface>();
  const groupByModelName = new Map<string, string>();
  const serviceFactoryByModelType = new Map<string, { readonly exportName: string; readonly sourceFile: string }>();

  for (const { extraction, sourceFile } of extractions) {
    registerConverters(extraction.converters, converterRegistry);
    registerInterfaces(extraction.interfaces, interfaceRegistry);
    registerModelGroups(extraction.modelGroups, groupByModelName);
    for (const factory of extraction.serviceFactories) {
      if (!serviceFactoryByModelType.has(factory.modelType)) {
        serviceFactoryByModelType.set(factory.modelType, { exportName: factory.exportName, sourceFile });
      }
    }
  }

  return { converterRegistry, interfaceRegistry, groupByModelName, serviceFactoryByModelType };
}

function registerConverters(converters: ModelExtraction['converters'], registry: Map<string, ModelExtractionConverter>): void {
  for (const converter of converters) {
    if (converter.converterConst && !registry.has(converter.converterConst)) {
      registry.set(converter.converterConst, converter);
    }
  }
}

function registerInterfaces(interfaces: ModelExtraction['interfaces'], registry: Map<string, ModelExtractionInterface>): void {
  for (const iface of interfaces) {
    if (!registry.has(iface.name)) registry.set(iface.name, iface);
  }
}

function registerModelGroups(modelGroups: ModelExtraction['modelGroups'], registry: Map<string, string>): void {
  for (const group of modelGroups) {
    for (const modelName of group.modelNames) {
      if (!registry.has(modelName)) registry.set(modelName, group.name);
    }
  }
}

function appendEntriesFromSource(source: AssembleModelsInput['extractions'][number], registries: GlobalRegistries, accumulator: AssemblyAccumulator): void {
  const enumNames = new Set(source.extraction.enums.map((e) => e.name));
  for (const identity of source.extraction.identities) {
    if (accumulator.seen.has(identity.identityConst)) continue;
    const entry = buildEntryForIdentity({ identity, source, registries, enumNames });
    if (entry) {
      accumulator.seen.add(identity.identityConst);
      accumulator.entries.push(entry);
    }
  }
}

interface BuildEntryInput {
  readonly identity: ModelExtraction['identities'][number];
  readonly source: AssembleModelsInput['extractions'][number];
  readonly registries: GlobalRegistries;
  readonly enumNames: ReadonlySet<string>;
}

function buildEntryForIdentity(input: BuildEntryInput): CliModelManifestEntry | undefined {
  const { identity, source, registries, enumNames } = input;
  let result: CliModelManifestEntry | undefined;

  if (identity.collectionPrefix !== undefined) {
    const modelName = capitalize(identity.modelType);
    const iface = registries.interfaceRegistry.get(modelName);
    if (iface?.hasDbxModelTag) {
      const converter = findConverterForInterface(source.extraction, modelName) ?? findConverterFromRegistry(registries.converterRegistry, modelName);
      if (converter) {
        const fields = buildFields({
          converter,
          iface,
          interfaceRegistry: registries.interfaceRegistry,
          converterRegistry: registries.converterRegistry,
          enumNames,
          depth: 0,
          visitedConverters: new Set<string>()
        });

        const modelGroup = registries.groupByModelName.get(modelName);
        const serviceFactory = registries.serviceFactoryByModelType.get(identity.modelType);
        result = {
          modelType: identity.modelType,
          modelName,
          ...(modelGroup ? { modelGroup } : {}),
          identityConst: identity.identityConst,
          collectionPrefix: identity.collectionPrefix,
          ...(identity.parentIdentityConst ? { parentIdentityConst: identity.parentIdentityConst } : {}),
          ...(iface.description ? { description: iface.description } : {}),
          sourcePackage: source.sourcePackage,
          sourceFile: source.sourceFile,
          fields,
          ...(iface.mcpToolNameSegment ? { mcpToolNameSegment: iface.mcpToolNameSegment } : {}),
          ...(iface.dbxModelRead ? { read: iface.dbxModelRead } : {}),
          ...(serviceFactory ? { serviceFactory } : {})
        };
      }
    }
  }

  return result;
}

function findConverterForInterface(extraction: ModelExtraction, interfaceName: string): ModelExtractionConverter | undefined {
  return extraction.converters.find((c) => c.interfaceName === interfaceName);
}

function findConverterFromRegistry(registry: ReadonlyMap<string, ModelExtractionConverter>, interfaceName: string): ModelExtractionConverter | undefined {
  let result: ModelExtractionConverter | undefined;
  for (const converter of registry.values()) {
    if (converter.interfaceName === interfaceName) {
      result = converter;
      break;
    }
  }
  return result;
}

interface BuildFieldsInput {
  readonly converter: ModelExtractionConverter;
  readonly iface: ModelExtractionInterface | undefined;
  readonly interfaceRegistry: ReadonlyMap<string, ModelExtractionInterface>;
  readonly converterRegistry: ReadonlyMap<string, ModelExtractionConverter>;
  readonly enumNames: ReadonlySet<string>;
  readonly depth: number;
  readonly visitedConverters: Set<string>;
}

function buildFields(input: BuildFieldsInput): readonly CliModelField[] {
  const out: CliModelField[] = [];
  const propByName = new Map<string, ModelExtractionInterfaceProp>();
  if (input.iface) {
    for (const prop of input.iface.props) propByName.set(prop.name, prop);
    for (const ancestor of collectAncestors(input.iface, input.interfaceRegistry)) {
      for (const prop of ancestor.props) {
        if (!propByName.has(prop.name)) propByName.set(prop.name, prop);
      }
    }
  }

  for (const field of input.converter.fields) {
    out.push(buildField({ ...input, field, propByName }));
  }
  return out;
}

interface BuildFieldInput extends BuildFieldsInput {
  readonly field: ModelExtractionConverterField;
  readonly propByName: ReadonlyMap<string, ModelExtractionInterfaceProp>;
}

function buildField(input: BuildFieldInput): CliModelField {
  const { field, propByName } = input;
  const prop = propByName.get(field.key);
  const enumRef = resolveEnumRef(field.converter, prop?.tsType, input.enumNames);
  const optional = prop?.optional ?? field.converter.startsWith('optionalFirestore');
  const longName = resolveLongName(field.key, prop?.longName);
  const nested = resolveNestedFields(input);

  const out: CliModelField = {
    name: field.key,
    longName,
    converter: field.converter,
    ...(prop?.tsType ? { tsType: prop.tsType } : {}),
    optional,
    ...(prop?.description ? { description: prop.description } : {}),
    ...(enumRef ? { enumRef } : {}),
    ...(prop?.syncFlag ? { syncFlag: prop.syncFlag } : {}),
    ...(nested ? { nestedFields: nested.fields, nestedIsArray: nested.isArray } : {})
  };
  return out;
}

interface ResolvedNested {
  readonly fields: readonly CliModelField[];
  readonly isArray: boolean;
}

function resolveNestedFields(input: BuildFieldInput): ResolvedNested | undefined {
  const { field } = input;
  let result: ResolvedNested | undefined;

  if (input.depth < MAX_NESTED_DEPTH) {
    let nestedConverter: ModelExtractionConverter | undefined;
    let aborted = false;
    if (field.nestedConverterInline) {
      nestedConverter = field.nestedConverterInline;
    } else if (field.nestedConverterRef) {
      if (input.visitedConverters.has(field.nestedConverterRef)) {
        aborted = true;
      } else {
        nestedConverter = input.converterRegistry.get(field.nestedConverterRef);
      }
    }

    if (!aborted && nestedConverter) {
      const nextVisited = new Set(input.visitedConverters);
      if (nestedConverter.converterConst) nextVisited.add(nestedConverter.converterConst);

      const nestedIface = nestedConverter.interfaceName ? input.interfaceRegistry.get(nestedConverter.interfaceName) : undefined;
      const fields = buildFields({
        converter: nestedConverter,
        iface: nestedIface,
        interfaceRegistry: input.interfaceRegistry,
        converterRegistry: input.converterRegistry,
        enumNames: input.enumNames,
        depth: input.depth + 1,
        visitedConverters: nextVisited
      });

      result = { fields, isArray: field.nestedIsArray ?? false };
    }
  }

  return result;
}

function collectAncestors(iface: ModelExtractionInterface, registry: ReadonlyMap<string, ModelExtractionInterface>): readonly ModelExtractionInterface[] {
  const out: ModelExtractionInterface[] = [];
  const visited = new Set<string>([iface.name]);
  const stack: ModelExtractionInterface[] = [iface];
  while (stack.length > 0) {
    const current = stack.pop() as ModelExtractionInterface;
    for (const parentName of current.extendsNames) {
      if (visited.has(parentName)) continue;
      visited.add(parentName);
      const parent = registry.get(parentName);
      if (parent) {
        out.push(parent);
        stack.push(parent);
      }
    }
  }
  return out;
}

function resolveLongName(fieldName: string, propLongName: string | undefined): string {
  let result: string;
  if (propLongName && LONG_NAME_RE.test(propLongName)) {
    result = propLongName;
  } else {
    result = fieldName;
  }
  return result;
}

function resolveEnumRef(converter: string, tsType: string | undefined, enumNames: ReadonlySet<string>): string | undefined {
  let result: string | undefined;
  if (tsType) {
    for (const name of enumNames) {
      const re = new RegExp(String.raw`\b${name}\b`);
      if (re.test(tsType)) {
        result = name;
        break;
      }
    }
  }
  if (!result) {
    const m = ENUM_GENERIC_RE.exec(converter);
    if (m) {
      const name = m[1] ?? m[2];
      if (enumNames.has(name)) result = name;
    }
  }
  return result;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}
