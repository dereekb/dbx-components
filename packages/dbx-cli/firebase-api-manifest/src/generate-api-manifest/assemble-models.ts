/**
 * Stitches per-file {@link ModelExtraction} outputs from {@link findModelFiles}
 * into the runtime {@link CliModelManifestEntry[]} the manifest emits.
 *
 * Builds cross-file registries (converters keyed by `converterConst`,
 * interfaces keyed by `name`) and uses them to resolve nested converter
 * references — `firestoreObjectArray({ objectField: <const> })` and
 * `firestoreSubObject({ objectField: <const> })` — recursively, so an
 * `--expand-keys` rewrite on a model's response payload can rename short
 * keys all the way down through embedded sub-object and object-array fields.
 *
 * Every registry here is deliberately CROSS-FILE. A model group routinely splits
 * its enums and its converters across sibling files (`billing.ts` +
 * `billing.bill.ts`), so a per-file enum registry silently dropped the reference,
 * and a dropped `enumRef` also drops the enum from the emitted enum manifest
 * (`collectModelEnums` scopes by what the fields reference) — which is how a real
 * downstream app ended up with only 44 of its 97 exported enums documented.
 */

import type { CliEnumManifest, CliModelEnum, CliModelField, CliModelManifestEntry } from '@dereekb/dbx-cli';
import type { ModelExtraction, ModelExtractionConverter, ModelExtractionConverterField, ModelExtractionEnum, ModelExtractionIdentity, ModelExtractionInterface, ModelExtractionInterfaceProp, ModelExtractionSingleItemCollection } from '@dereekb/dbx-cli/manifest-extract';

/**
 * Maximum nested-converter recursion depth. Bounded so a malformed cyclic
 * reference cannot lock the build. No real model approaches this depth.
 */
const MAX_NESTED_DEPTH = 8;

const LONG_NAME_RE = /^[a-z][a-zA-Z0-9]*$/;

const ENUM_GENERIC_RE = /firestoreEnum<(\w+)>|optionalFirestoreEnum<(\w+)>/;

/**
 * Identifier-shaped tokens inside a property's TS type text (`Maybe<BillingGroupInvoiceState>` →
 * `Maybe`, `BillingGroupInvoiceState`). Matching tokens against the enum registry, rather than
 * regex-testing the type text once per known enum, keeps the enum-ref resolution O(tokens) as the
 * registry grows workspace-wide and makes the winner a function of the type text alone instead of
 * the registry's insertion order.
 */
const TS_TYPE_TOKEN_RE = /[A-Za-z_$][\w$]*/g;

/**
 * Document id a `singleItemFirestoreCollection` gets when its config omits `singleItemIdentifier`.
 * Mirrors `DEFAULT_SINGLE_ITEM_FIRESTORE_COLLECTION_DOCUMENT_IDENTIFIER` in `@dereekb/firebase`,
 * duplicated rather than imported so the build-time generator keeps no runtime dependency on the
 * firebase package.
 */
const DEFAULT_SINGLE_ITEM_DOCUMENT_ID = '0';

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

/**
 * Inputs for {@link collectModelEnums}.
 */
export interface CollectModelEnumsInput {
  /**
   * The same per-file extractions {@link assembleModels} consumes — the source of every enum
   * declaration's value table.
   */
  readonly extractions: AssembleModelsInput['extractions'];
  /**
   * The emitted model entries (already `--only`-filtered) whose fields' `enumRef`s scope which
   * enums are kept.
   */
  readonly models: readonly CliModelManifestEntry[];
}

/**
 * Collects the value tables for every enum referenced (by `enumRef`) on some emitted model field —
 * recursively through `nestedFields` — into a manifest keyed by enum name.
 *
 * Sibling to {@link assembleModels} (its signature is left unchanged to avoid churning existing
 * callers/tests). Mirrors the design-time `filterRelevantEnums` / `buildModelEnumEntry` pair so the
 * runtime manifest carries the same value→label tables the dbx-components MCP already builds.
 *
 * @param input - The per-file extractions (enum source) plus the emitted model entries (enum references).
 * @returns The referenced enums keyed by name, sorted for stable diffs. Empty when no field references an enum.
 */
export function collectModelEnums(input: CollectModelEnumsInput): CliEnumManifest {
  const registry = buildEnumRegistry(input.extractions);
  const referenced = collectReferencedEnumNames(input.models);
  const out: Record<string, CliModelEnum> = {};
  for (const name of Array.from(referenced).sort((a, b) => a.localeCompare(b))) {
    const extracted = registry.get(name);
    if (extracted) {
      out[name] = buildModelEnumEntry(extracted);
    }
  }
  return out;
}

function buildEnumRegistry(extractions: AssembleModelsInput['extractions']): ReadonlyMap<string, ModelExtractionEnum> {
  const registry = new Map<string, ModelExtractionEnum>();
  for (const { extraction } of extractions) {
    for (const e of extraction.enums) {
      if (!registry.has(e.name)) registry.set(e.name, e);
    }
  }
  return registry;
}

function collectReferencedEnumNames(models: readonly CliModelManifestEntry[]): ReadonlySet<string> {
  const referenced = new Set<string>();
  for (const model of models) {
    addReferencedEnumNames(model.fields, referenced);
  }
  return referenced;
}

function addReferencedEnumNames(fields: readonly CliModelField[], referenced: Set<string>): void {
  for (const field of fields) {
    if (field.enumRef) referenced.add(field.enumRef);
    if (field.nestedFields) addReferencedEnumNames(field.nestedFields, referenced);
  }
}

/**
 * Projects one extracted enum into the manifest enum shape, omitting empty value/enum descriptions.
 * Mirrors the dbx-components MCP `buildModelEnumEntry`.
 *
 * @param e - The extracted enum.
 * @returns The manifest enum entry.
 */
function buildModelEnumEntry(e: ModelExtractionEnum): CliModelEnum {
  return {
    name: e.name,
    values: e.values.map((v) => (v.description ? { name: v.name, value: v.value, description: v.description } : { name: v.name, value: v.value })),
    ...(e.description ? { description: e.description } : {})
  };
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
  /**
   * Every exported enum name across every scanned file. Cross-file by construction: a converter in
   * `billing.ts` referencing an enum declared in `billing.bill.ts` must still resolve.
   */
  readonly enumNames: ReadonlySet<string>;
  /**
   * Single-item collection declarations keyed by the identity const their `modelIdentity` names.
   */
  readonly singleItemByIdentityConst: ReadonlyMap<string, ModelExtractionSingleItemCollection>;
  /**
   * Every identity in the scan keyed by its const name, so an entry's parent chain resolves even
   * through ancestors that produced no manifest entry of their own (an untagged interface, or one
   * whose converter could not be found).
   */
  readonly identityByConst: ReadonlyMap<string, ModelExtractionIdentity>;
  /**
   * Exported string constants keyed by name, for resolving a `singleItemIdentifier: SOME_CONST`
   * reference declared in another file.
   */
  readonly stringConstants: ReadonlyMap<string, string>;
}

function buildGlobalRegistries(extractions: AssembleModelsInput['extractions']): GlobalRegistries {
  const converterRegistry = new Map<string, ModelExtractionConverter>();
  const interfaceRegistry = new Map<string, ModelExtractionInterface>();
  const groupByModelName = new Map<string, string>();
  const serviceFactoryByModelType = new Map<string, { readonly exportName: string; readonly sourceFile: string }>();
  const enumNames = new Set<string>();
  const singleItemByIdentityConst = new Map<string, ModelExtractionSingleItemCollection>();
  const identityByConst = new Map<string, ModelExtractionIdentity>();
  const stringConstants = new Map<string, string>();

  for (const { extraction, sourceFile } of extractions) {
    registerConverters(extraction.converters, converterRegistry);
    registerInterfaces(extraction.interfaces, interfaceRegistry);
    registerModelGroups(extraction.modelGroups, groupByModelName);
    for (const e of extraction.enums) enumNames.add(e.name);
    for (const identity of extraction.identities) {
      if (!identityByConst.has(identity.identityConst)) identityByConst.set(identity.identityConst, identity);
    }
    for (const single of extraction.singleItemCollections) {
      if (!singleItemByIdentityConst.has(single.identityConst)) singleItemByIdentityConst.set(single.identityConst, single);
    }
    for (const constant of extraction.stringConstants) {
      if (!stringConstants.has(constant.name)) stringConstants.set(constant.name, constant.value);
    }
    for (const factory of extraction.serviceFactories) {
      if (!serviceFactoryByModelType.has(factory.modelType)) {
        serviceFactoryByModelType.set(factory.modelType, { exportName: factory.exportName, sourceFile });
      }
    }
  }

  return { converterRegistry, interfaceRegistry, groupByModelName, serviceFactoryByModelType, enumNames, singleItemByIdentityConst, identityByConst, stringConstants };
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
  for (const identity of source.extraction.identities) {
    if (accumulator.seen.has(identity.identityConst)) continue;
    const entry = buildEntryForIdentity({ identity, source, registries });
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
}

function buildEntryForIdentity(input: BuildEntryInput): CliModelManifestEntry | undefined {
  const { identity, source, registries } = input;
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
          enumNames: registries.enumNames,
          depth: 0,
          visitedConverters: new Set<string>()
        });
        result = buildManifestEntry({ identity, modelName, collectionPrefix: identity.collectionPrefix, iface, fields, source, registries });
      }
    }
  }

  return result;
}

interface BuildManifestEntryInput {
  readonly identity: ModelExtraction['identities'][number];
  readonly modelName: string;
  readonly collectionPrefix: string;
  readonly iface: ModelExtractionInterface;
  readonly fields: readonly CliModelField[];
  readonly source: AssembleModelsInput['extractions'][number];
  readonly registries: GlobalRegistries;
}

/**
 * Builds the runtime {@link CliModelManifestEntry} for one resolved
 * (identity, interface, converter) triple, applying every optional field
 * (group, parent identity, singleton document id, example key, description,
 * MCP segment, read level, service factory) only when present.
 *
 * @param input - The resolved identity, model name, narrowed collection prefix, tagged interface, built fields, source, and registries.
 * @returns The assembled manifest entry.
 */
function buildManifestEntry(input: BuildManifestEntryInput): CliModelManifestEntry {
  const { identity, modelName, collectionPrefix, iface, fields, source, registries } = input;
  const modelGroup = registries.groupByModelName.get(modelName);
  const serviceFactory = registries.serviceFactoryByModelType.get(identity.modelType);
  const single = registries.singleItemByIdentityConst.get(identity.identityConst);
  const singleItemIdentifier = single ? resolveSingleItemDocumentId(single, registries) : undefined;
  if (single && singleItemIdentifier === undefined) {
    console.warn(`[single-item-id-unresolved] ${source.sourceFile}:${single.line} · ${identity.modelType} → singleItemIdentifier ${single.documentIdConstRef ?? '(expression)'} could not be resolved to a string; the model's fixed document id is omitted from the manifest`);
  }
  const exampleKey = buildExampleKey({ identity, collectionPrefix, singleItemIdentifier, registries });
  return {
    modelType: identity.modelType,
    modelName,
    ...(modelGroup ? { modelGroup } : {}),
    identityConst: identity.identityConst,
    collectionPrefix,
    ...(identity.parentIdentityConst ? { parentIdentityConst: identity.parentIdentityConst } : {}),
    ...(single ? { singleton: true } : {}),
    ...(singleItemIdentifier === undefined ? {} : { singleItemIdentifier }),
    ...(exampleKey === undefined ? {} : { exampleKey }),
    ...(iface.description ? { description: iface.description } : {}),
    sourcePackage: source.sourcePackage,
    sourceFile: source.sourceFile,
    fields,
    ...(iface.mcpToolNameSegment ? { mcpToolNameSegment: iface.mcpToolNameSegment } : {}),
    ...(iface.dbxModelRead ? { read: iface.dbxModelRead } : {}),
    ...(iface.dbxModelServerOnly ? { serverOnly: true } : {}),
    ...(serviceFactory ? { serviceFactory } : {})
  };
}

/**
 * Resolves a single-item collection's fixed document id, in the three shapes the config can take:
 * an inline string literal, an identifier naming a string const (resolved against the cross-file
 * constant registry, since the const is frequently declared in a sibling file), or an omitted
 * `singleItemIdentifier` — which means the runtime default `'0'` applies.
 *
 * @param single - The extracted single-item collection declaration.
 * @param registries - The cross-file registries, for the string-constant lookup.
 * @returns The document id, or `undefined` when `singleItemIdentifier` was declared as something
 *   the walker could not read down to a string.
 */
function resolveSingleItemDocumentId(single: ModelExtractionSingleItemCollection, registries: GlobalRegistries): string | undefined {
  let result: string | undefined;
  if (!single.explicitIdentifier) {
    result = DEFAULT_SINGLE_ITEM_DOCUMENT_ID;
  } else if (single.documentId !== undefined) {
    result = single.documentId;
  } else if (single.documentIdConstRef !== undefined) {
    result = registries.stringConstants.get(single.documentIdConstRef);
  }
  return result;
}

interface BuildExampleKeyInput {
  readonly identity: ModelExtractionIdentity;
  readonly collectionPrefix: string;
  /**
   * The model's own resolved singleton document id, when it has one — it replaces the placeholder
   * in the key's last segment.
   */
  readonly singleItemIdentifier: string | undefined;
  readonly registries: GlobalRegistries;
}

/**
 * Assembles a model's example document key by walking its identity's parent chain to the root,
 * emitting a `<collectionName>/<id>` pair per level. Each level's id is the ancestor's fixed
 * singleton document id when it has one, otherwise a `<modelTypeId>` placeholder the caller fills
 * in.
 *
 * @param input - The model's identity, its collection name, its own resolved singleton id, and the registries.
 * @returns The example key, or `undefined` when an ancestor identity is not in the scan (its
 *   collection name is then unknown, and a partial key would be worse than none).
 */
function buildExampleKey(input: BuildExampleKeyInput): string | undefined {
  const { identity, collectionPrefix, singleItemIdentifier, registries } = input;
  const segments: string[] = [`${collectionPrefix}/${singleItemIdentifier ?? modelIdPlaceholder(identity.modelType)}`];
  const visited = new Set<string>([identity.identityConst]);
  let parentConst = identity.parentIdentityConst;
  let resolved = true;

  while (resolved && parentConst !== undefined) {
    const parent = visited.has(parentConst) ? undefined : registries.identityByConst.get(parentConst);
    if (parent === undefined) {
      resolved = false;
    } else {
      visited.add(parent.identityConst);
      segments.unshift(`${collectionNameFor(parent)}/${ancestorDocumentIdFor(parent, registries)}`);
      parentConst = parent.parentIdentityConst;
    }
  }

  return resolved ? segments.join('/') : undefined;
}

/**
 * The collection-name segment an identity contributes to a key. Mirrors `firestoreModelIdentity`'s
 * own default: an identity declared without an explicit collection name uses the lower-cased model
 * type.
 *
 * @param identity - The identity.
 * @returns The collection name.
 */
function collectionNameFor(identity: ModelExtractionIdentity): string {
  return identity.collectionPrefix ?? identity.modelType.toLowerCase();
}

function ancestorDocumentIdFor(identity: ModelExtractionIdentity, registries: GlobalRegistries): string {
  const single = registries.singleItemByIdentityConst.get(identity.identityConst);
  const documentId = single ? resolveSingleItemDocumentId(single, registries) : undefined;
  return documentId ?? modelIdPlaceholder(identity.modelType);
}

function modelIdPlaceholder(modelType: string): string {
  return `<${modelType}Id>`;
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
  let result: ResolvedNested | undefined;

  if (input.depth < MAX_NESTED_DEPTH) {
    const nestedConverter = selectNestedConverter(input);
    if (nestedConverter) {
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

      result = { fields, isArray: input.field.nestedIsArray ?? false };
    }
  }

  return result;
}

/**
 * Selects the converter a nested field expands into: an inline converter
 * directly, or a registry-resolved converter referenced by name (unless that
 * reference is already on the current recursion path, which would cycle).
 *
 * @param input - The field plus the interface/converter registries and the visited-converter guard set.
 * @returns The nested converter to expand, or `undefined` when there is none or the reference would cycle.
 */
function selectNestedConverter(input: BuildFieldInput): ModelExtractionConverter | undefined {
  const { field } = input;
  let result: ModelExtractionConverter | undefined;
  if (field.nestedConverterInline) {
    result = field.nestedConverterInline;
  } else if (field.nestedConverterRef && !input.visitedConverters.has(field.nestedConverterRef)) {
    result = input.converterRegistry.get(field.nestedConverterRef);
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

/**
 * Resolves the enum a field references: first the leftmost identifier in the interface property's
 * TS type text that names a known enum (so `Maybe<BillingGroupInvoiceState>` resolves), then the
 * converter's `firestoreEnum<Enum>()` / `optionalFirestoreEnum<Enum>()` generic argument.
 *
 * @param converter - Verbatim converter expression text for the field.
 * @param tsType - TS type text of the matching interface property, when one was found.
 * @param enumNames - Every enum name in the scan (cross-file — an enum declared in a sibling file
 *   of the converter's is just as valid a reference).
 * @returns The referenced enum name, or `undefined` when neither carrier names a known enum.
 */
function resolveEnumRef(converter: string, tsType: string | undefined, enumNames: ReadonlySet<string>): string | undefined {
  let result: string | undefined;
  if (tsType) {
    TS_TYPE_TOKEN_RE.lastIndex = 0;
    let match = TS_TYPE_TOKEN_RE.exec(tsType);
    while (result === undefined && match !== null) {
      if (enumNames.has(match[0])) {
        result = match[0];
      } else {
        match = TS_TYPE_TOKEN_RE.exec(tsType);
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
